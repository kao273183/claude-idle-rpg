import type { Character, Foe, GemGrade, Item, Slot } from '../types'

import type { DropTier } from './loot'
import { makeItem, rollRarity, SLOTS } from './loot'
import { ACTS, AREAS_PER_DIFFICULTY, makeFoe, MONSTER_TYPES, newPack, rollAffixes, WALK_SECONDS } from './monsters'
import type { MonsterType } from './monsters'

type Rng = () => number

/** Rifts open once hell's last act is cleared. */
export const RIFT_UNLOCK_ZONE = 3 * AREAS_PER_DIFFICULTY
/** The depth rift monsters start from: the end of hell. */
const RIFT_BASE_ZONE = RIFT_UNLOCK_ZONE - 1
export const RIFT_SECONDS = 5 * 60

/** The depth a rift's loot is made at. */
export const riftZone = (tier: number) => RIFT_BASE_ZONE + Math.floor(tier / 2)
/** Each tier makes the monsters this much stronger. */
export const TIER_STEP = 1.15
export const KEYS_ON_UNLOCK = 3

export const isRiftOpen = (c: Character) => c.maxZone >= RIFT_UNLOCK_ZONE

/** Keystones fall from hell's elites and bosses. */
export const KEY_DROP_CHANCE: Record<DropTier, number> = { normal: 0, champion: 0.08, unique: 0.25, boss: 1 }

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]!

const GUARDIAN_TITLES = ['吞噬者', '虛空織者', '血肉巨像', '永夜領主', '亡魂收割者', '腐化之心']

/** Every rift monster's strength: the end of hell, then a step a tier. */
const strengthen = (foe: Foe, tier: number): Foe => {
  const k = Math.pow(TIER_STEP, tier - 1)

  return {
    ...foe,
    hp: Math.round(foe.hp * k),
    maxHp: Math.round(foe.maxHp * k),
    atk: Math.round(foe.atk * k),
    xp: Math.round(foe.xp * (1 + tier * 0.1)),
    gold: Math.round(foe.gold * (1 + tier * 0.1)),
  }
}

/** A rift pack: any monster of any act, elites more often than outside. */
export const riftPack = (tier: number, rng: Rng): Foe[] => {
  const type = pick(MONSTER_TYPES, rng)
  const r = rng()
  let foes: Foe[]
  if (r < 0.15) {
    const affixes = rollAffixes(2 + Math.min(2, Math.floor(tier / 10)), rng)
    foes = [
      makeFoe(RIFT_BASE_ZONE, type, 'unique', affixes, `秘境${type.name}`),
      ...Array.from({ length: 3 }, () => makeFoe(RIFT_BASE_ZONE, type, 'minion', [], type.name)),
    ]
  } else if (r < 0.4) {
    const affixes = rollAffixes(2 + Math.min(2, Math.floor(tier / 15)), rng)
    foes = Array.from({ length: 3 }, () => makeFoe(RIFT_BASE_ZONE, type, 'champion', affixes, type.name))
  } else {
    foes = Array.from({ length: 4 + Math.floor(rng() * 2) }, () => {
      const t = pick(MONSTER_TYPES, rng)

      return makeFoe(RIFT_BASE_ZONE, t, 'normal', [], t.name)
    })
  }

  return foes.map(f => strengthen(f, tier))
}

export const riftGuardian = (tier: number, rng: Rng): Foe[] => {
  const boss = pick(ACTS, rng).boss
  const type: MonsterType = { name: '', sprite: boss.sprite, tint: pick([0x30ffd0, 0xff30a0, 0xffa020, 0x8040ff], rng), element: boss.element, res: boss.res, hp: 1, atk: 1 }
  const name = `秘境守護者・${pick(GUARDIAN_TITLES, rng)}`
  const guardian = makeFoe(RIFT_BASE_ZONE, type, 'boss', rollAffixes(Math.min(3, 1 + Math.floor(tier / 10)), rng), name, { isBoss: true, scale: 1.2 })

  return [strengthen(guardian, tier)]
}

/** How far a kill moves the rift toward its guardian. */
export const progressFor = (foe: Foe) =>
  foe.elite === 'unique' ? 8 : foe.elite === 'champion' ? 4 : foe.elite === 'boss' ? 0 : 1.6

export const startRift = (c: Character, rng: Rng): Character => {
  if (!isRiftOpen(c) || c.keys < 1 || c.rift || c.deadFor > 0) return c
  const tier = Math.max(1, c.riftTier)

  return {
    ...c,
    keys: c.keys - 1,
    rift: { tier, progress: 0, timeLeft: RIFT_SECONDS, hasGuardian: false, look: Math.floor(rng() * ACTS.length) },
    foes: riftPack(tier, rng),
    walk: WALK_SECONDS,
    areaDeaths: 0,
  }
}

/** Back to the hero's place in the world. */
export const leaveRift = (c: Character, rng: Rng): Character => ({
  ...c,
  rift: null,
  foes: newPack(c.zone, c.packs, rng),
  walk: WALK_SECONDS,
})

/** The best the rift can do for one gem set in the hero's gear: one grade up, if the dice allow. */
const upgradeGem = (c: Character, tier: number, isInTime: boolean, rng: Rng): { c: Character; gem?: string } => {
  const chance = Math.min(1, (isInTime ? 0.6 : 0.3) + tier * 0.02)
  if (rng() >= chance) return { c }
  for (const slot of SLOTS) {
    const item = c.equipment[slot]
    if (!item) continue
    const k = item.gems.findIndex(g => g.grade < 3)
    if (k < 0) continue
    const gems = item.gems.map((g, i) => (i === k ? { ...g, grade: (g.grade + 1) as GemGrade } : g))

    return { c: { ...c, equipment: { ...c.equipment, [slot]: { ...item, gems } } }, gem: `${slot}` }
  }

  return { c }
}

export type RiftReward = { items: Item[]; isInTime: boolean; gemSlot?: Slot; seconds: number }

/**
 * The guardian has fallen: a shower of loot, perhaps a gem grown stronger,
 * and the tier pushed on if the clock was beaten (or eased back if not, when
 * the hero is choosing tiers by itself).
 */
export const finishRift = (start: Character, mf: number, rng: Rng): { save: Character; reward: RiftReward } => {
  const rift = start.rift!
  const isInTime = rift.timeLeft > 0
  const seconds = RIFT_SECONDS - rift.timeLeft
  const level = riftZone(rift.tier)
  const count = 2 + Math.floor(rift.tier / 5)
  const items: Item[] = []
  let c = start
  for (let i = 0; i < count; i++) {
    items.push({ ...makeItem(level, rollRarity('boss', rng, mf + rift.tier * 5), c.nextItemId + i, rng), unid: c.autoIdentify ? undefined : true })
  }
  c = { ...c, nextItemId: c.nextItemId + count }
  const gem = upgradeGem(c, rift.tier, isInTime, rng)
  c = gem.c
  const best = isInTime ? Math.max(c.riftBest, rift.tier) : c.riftBest
  const nextTier = c.autoRift ? (isInTime ? rift.tier + 1 : Math.max(1, rift.tier - 1)) : c.riftTier
  c = {
    ...c,
    riftBest: best,
    riftTier: nextTier,
    riftLast: { tier: rift.tier, seconds, isInTime, ...(gem.gem ? { gem: gem.gem } : {}) },
  }

  return { save: leaveRift(c, rng), reward: { items, isInTime, seconds, ...(gem.gem ? { gemSlot: gem.gem as Slot } : {}) } }
}

export const formatClock = (seconds: number) => {
  const s = Math.abs(Math.round(seconds))

  return `${seconds < 0 ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
