import type { Character, Element, Foe, Gem, Item, Minion, MinionKind } from '../types'

import {
  attrPointsLeft,
  autoAllocate,
  BELT_SIZE,
  heroPower,
  heroStats,
  minionStats,
  potionPrice,
  rankOf,
  skillDamage,
  skillPointsLeft,
} from './character'
import type { HeroStats } from './character'
import { addGem, BOSS_DROPS, identify, pickUp, RARITIES, rollDrop, rollGem } from './loot'
import { questFor, questKey } from './quests'
import {
  finishRift,
  isRiftOpen,
  KEY_DROP_CHANCE,
  KEYS_ON_UNLOCK,
  progressFor,
  RIFT_UNLOCK_ZONE,
  riftGuardian,
  riftPack,
  riftZone,
  startRift,
} from './rift'
import { rollRune } from './runes'
import { growTalents, MAX_LEVEL, talentTotals } from './talents'
import type { DropTier, LootAction } from './loot'
import { newPack, PACKS_PER_AREA, placeOf, WALK_SECONDS, xpToNext, zonePower } from './monsters'
import { classSkills, skillOf, SKILLS } from './skilltree'
import type { CurseEffect, SkillDef } from './skilltree'

export type Rng = () => number

export const DEATH_SECONDS = 3
const POTION_DROP = 0.06
/** Deaths in one area before the hero falls back to the one before. */
const RETREAT_AFTER = 3

export type CombatEvent =
  | { kind: 'cast'; skill: string }
  | { kind: 'hit'; foe: number; dmg: number; isCrit: boolean; skill: string; element: Element; immune?: boolean }
  | { kind: 'minionHit'; minion: number; foe: number; dmg: number }
  | { kind: 'dot'; foe: number; dmg: number }
  | { kind: 'hurt'; foe: number; dmg: number; element: Element; absorbed?: number; blocked?: boolean; minion?: number }
  | { kind: 'minionDied'; minion: number; minionKind: MinionKind }
  | { kind: 'summon'; minionKind: MinionKind }
  | { kind: 'potion'; color: 'red' | 'blue' }
  | { kind: 'potionFound'; color: 'red' | 'blue' }
  | { kind: 'kill'; foe: number; name: string; xp: number; gold: number; elite?: Foe['elite'] }
  | { kind: 'explode'; foe: number; dmg: number }
  | { kind: 'loot'; item: Item; action: LootAction }
  | { kind: 'gem'; gem: Gem }
  | { kind: 'rune'; rune: number }
  | { kind: 'levelUp'; level: number }
  | { kind: 'bossAppears'; name: string }
  | { kind: 'eliteAppears'; name: string; elite: 'champion' | 'unique' }
  | { kind: 'areaClear'; zone: number }
  | { kind: 'quest'; name: string; reward: string }
  | { kind: 'actClear'; zone: number }
  | { kind: 'difficultyClear'; zone: number }
  | { kind: 'death'; isRetreat: boolean; goldLost: number }
  | { kind: 'revive' }
  | { kind: 'talentPoint'; total: number }
  | { kind: 'cheatDeath' }
  | { kind: 'minionBurst'; dmg: number }
  | { kind: 'riftStart'; tier: number }
  | { kind: 'riftGuardian'; name: string }
  | { kind: 'riftClear'; tier: number; isInTime: boolean; seconds: number; gem: boolean }
  | { kind: 'riftUnlock' }
  | { kind: 'key' }

const learnedOf = (c: Character, kind: SkillDef['kind']) =>
  classSkills(c.classId).filter(s => s.kind === kind && rankOf(c, s.id) > 0)

const manaCost = (c: Character, s: SkillDef) => s.mana?.(rankOf(c, s.id)) ?? 0
const isReady = (c: Character, s: SkillDef) => (c.cooldowns[s.id] ?? 0) <= 0 && c.mana >= manaCost(c, s)

const curseOf = (foe: Foe): CurseEffect => {
  const curse = foe.status.curse
  if (!curse || curse.left <= 0) return {}
  const def = SKILLS[curse.id]

  return def?.curse?.effect(curse.rank ?? 1) ?? {}
}

/** What share of a blow of an element gets through a monster's resistances: 0 when immune. */
export const resistFactor = (foe: Foe, element: Element) => {
  const curse = curseOf(foe)
  const lowered = element === 'phys' || element === 'magic' ? 0 : (curse.resMinus ?? 0)
  const res = (foe.res[element] ?? 0) - lowered

  return Math.max(0, Math.min(2, 1 - res / 100))
}

/** The kinds of minion a necromancer keeps up, and how many of each. */
const wantedMinions = (c: Character): { skill: SkillDef; kind: MinionKind; count: number }[] => {
  const out: { skill: SkillDef; kind: MinionKind; count: number }[] = []
  for (const s of learnedOf(c, 'summon')) {
    if (!s.summon) continue
    // One golem at a time: the blood golem replaces the clay one.
    if (s.summon.kind === 'golem' && rankOf(c, 'bloodGolem') > 0) continue
    const extra = s.summon.kind === 'skeleton' || s.summon.kind === 'mage' ? talentTotals(c).extraMinions : 0
    out.push({ kind: s.summon.kind, skill: s, count: s.summon.count(rankOf(c, s.id)) + extra })
  }

  return out
}

/** A summon or a buff that has lapsed: what a hero keeps up even on the road. */
const upkeep = (c: Character): SkillDef | undefined => {
  for (const want of wantedMinions(c)) {
    const have = c.minions.filter(m => m.kind === want.kind).length
    if (have < want.count && isReady(c, want.skill)) return want.skill
  }
  for (const s of learnedOf(c, 'buff')) {
    if (!isReady(c, s) || !s.buff) continue
    const isShield = (s.buff.effect(1).shieldPct ?? 0) > 0
    if (isShield ? c.shield <= 0 : (c.buffs[s.id] ?? 0) <= 0) return s
  }

  return undefined
}

const bestCurse = (c: Character) =>
  learnedOf(c, 'curse').reduce<SkillDef | undefined>(
    (best, s) => (!best || rankOf(c, s.id) >= rankOf(c, best.id) ? s : best),
    undefined,
  )

/** What an attack would do to the pack as it stands: resistances, immunities and how many it reaches. */
const attackValue = (c: Character, s: SkillDef, stats: HeroStats) => {
  const alive = c.foes.filter(f => f.hp > 0)
  const targets = s.aoe ? alive : alive.slice(0, 1)
  const element = s.element ?? 'phys'
  if (s.staticPct) return targets.reduce((sum, f) => sum + Math.max(0, Math.min(f.hp * s.staticPct!, f.hp - f.maxHp / 3)), 0)
  const base = s.corpsePct ? c.corpse * s.corpsePct(rankOf(c, s.id)) : skillDamage(c, s.id, stats)

  return targets.reduce((sum, f) => sum + Math.min(f.hp, base * resistFactor(f, element)), 0)
}

/** What the hero does this second, in a fight. */
const chooseAction = (c: Character, stats: HeroStats): SkillDef => {
  const need = upkeep(c)
  if (need) return need

  const target = c.foes.find(f => f.hp > 0)
  const curse = bestCurse(c)
  if (target && curse && isReady(c, curse) && !(target.status.curse && target.status.curse.left > 0)) return curse

  // The attack that does the most to this pack: a cooldown skill when ready, the
  // main skill most of the time, another learned attack when the main one is resisted.
  let best: SkillDef = skillOf('attack')
  let most = attackValue(c, best, stats)
  const main = c.mainSkill ? SKILLS[c.mainSkill] : undefined
  for (const s of learnedOf(c, 'attack')) {
    if (!isReady(c, s)) continue
    if (s.corpsePct && c.corpse <= 0) continue
    // The main skill gets a little favour, so the hero does not flit between equals.
    const value = attackValue(c, s, stats) * (s === main ? 1.15 : 1)
    if (value > most) {
      most = value
      best = s
    }
  }

  return best
}

const summon = (c: Character, s: SkillDef, stats: HeroStats, events: CombatEvent[]): Character => {
  const kind = s.summon!.kind
  const { maxHp } = minionStats(c, kind, stats)
  // A new golem sends any other golem back to the dust.
  const kept = kind === 'golem' || kind === 'bloodgolem' ? c.minions.filter(m => m.kind !== 'golem' && m.kind !== 'bloodgolem') : c.minions
  const minion: Minion = { id: c.nextMinionId, kind, hp: maxHp, maxHp }
  events.push({ kind: 'summon', minionKind: kind })

  return { ...c, minions: [...kept, minion], nextMinionId: c.nextMinionId + 1 }
}

/** Casting a skill: its mana, its cooldown, and what it does. */
const cast = (start: Character, s: SkillDef, stats: HeroStats, rng: Rng, events: CombatEvent[]): Character => {
  let c: Character = {
    ...start,
    mana: start.mana - manaCost(start, s),
    cooldowns:
      s.cooldown && !(s.corpsePct && stats.talent.corpseMaster)
        ? { ...start.cooldowns, [s.id]: Math.max(1, Math.round(s.cooldown * (1 - Math.min(60, stats.talent.cdr) / 100))) }
        : start.cooldowns,
  }
  events.push({ kind: 'cast', skill: s.id })
  const r = Math.max(1, rankOf(c, s.id))

  if (s.kind === 'summon') return summon(c, s, stats, events)
  if (s.kind === 'buff' && s.buff) {
    const shieldPct = s.buff.effect(r).shieldPct ?? 0
    if (shieldPct > 0) return { ...c, shield: Math.round((stats.maxHp * shieldPct) / 100) }

    return { ...c, buffs: { ...c.buffs, [s.id]: s.buff.secs } }
  }
  if (s.kind === 'curse' && s.curse) {
    const secs = s.curse.secs(r)
    const fear = s.curse.effect(r).fear

    return {
      ...c,
      foes: c.foes.map(f =>
        f.hp > 0 ? { ...f, status: { ...f.status, curse: { id: s.id, left: secs, rank: r }, ...(fear ? { stun: secs } : {}) } } : f,
      ),
    }
  }

  // An attack.
  const element = s.element ?? 'phys'
  const base = skillDamage(c, s.id, stats) * (c.chilled > 0 ? 0.75 : 1)
  const alive = c.foes.map((f, i) => ({ f, i })).filter(({ f }) => f.hp > 0)
  const targets = s.aoe ? alive : alive.slice(0, 1)
  let healed = 0
  const foes = c.foes.map(f => ({ ...f, status: { ...f.status } }))
  for (const { i } of targets) {
    const foe = foes[i]!
    const curse = curseOf(foe)
    let dmg: number
    let isCrit = false
    if (s.staticPct) {
      dmg = Math.max(0, Math.min(foe.hp * s.staticPct, foe.hp - foe.maxHp / 3))
    } else if (s.corpsePct) {
      dmg = c.corpse * s.corpsePct(r)
    } else {
      isCrit = rng() < stats.critRate
      dmg = base * (0.85 + rng() * 0.3) * (isCrit ? stats.critMult : 1)
    }
    const through = s.staticPct ? 1 : resistFactor(foe, element)
    if (through === 0) {
      events.push({ kind: 'hit', foe: i, dmg: 0, isCrit: false, skill: s.id, element, immune: true })
      continue
    }
    // Talents that turn on the moment: low life, a dying foe, a chilled or cursed one, a wide swing.
    const tt = stats.talent
    let bonus = 0
    if (s.aoe) bonus += tt.aoePct
    if (tt.lowLifeDmg && c.hp < stats.maxHp * 0.5) bonus += tt.lowLifeDmg
    if (tt.execute && foe.hp < foe.maxHp * 0.3) bonus += tt.execute
    if (tt.chilledBonus && (foe.status.chill ?? 0) > 0) bonus += tt.chilledBonus
    if (tt.cursedBonus && foe.status.curse) bonus += tt.cursedBonus
    if (s.corpsePct && tt.corpseMaster) bonus += 50
    dmg = Math.round(dmg * through * (1 + (curse.dmgTakenPct ?? 0) / 100) * (1 + bonus / 100))
    if (dmg <= 0) continue

    const share = s.dotShare ?? 0
    const now = Math.round(dmg * (1 - share))
    if (share > 0) {
      const secs = s.dotSecs ?? 3
      const dot = { dps: Math.round((dmg * share) / secs), left: secs }
      if (element === 'poison') foe.status.poison = dot
      else foe.status.burn = dot
    }
    if (element === 'phys' && stats.bleedPct > 0) {
      foe.status.poison = { dps: Math.round((now * stats.bleedPct) / 100 / 3), left: 3 }
    }
    foe.hp = Math.max(0, foe.hp - now)
    if (s.chill) foe.status.chill = Math.max(foe.status.chill ?? 0, s.chill)
    if (stats.talent.fusion && element === 'fire') foe.status.chill = Math.max(foe.status.chill ?? 0, 2)
    if (s.stun && !foe.isBoss) foe.status.stun = Math.max(foe.status.stun ?? 0, s.stun)
    healed += (now * ((curse.lifeTapPct ?? 0) + stats.leech)) / 100
    events.push({ kind: 'hit', foe: i, dmg: share >= 1 ? dmg : now, isCrit, skill: s.id, element })
  }
  if (s.corpsePct && !stats.talent.corpseMaster) c = { ...c, corpse: 0 }
  // An earth-shaking blow carries to the rest of the pack.
  const struck = events.filter(ev => ev.kind === 'hit' && !ev.immune)
  if (!s.aoe && stats.talent.splash && struck.length === 1) {
    const first = struck[0]
    const share = first?.kind === 'hit' ? Math.round((first.dmg * stats.talent.splash) / 100) : 0
    foes.forEach((f, i) => {
      if (f.hp <= 0 || i === (first?.kind === 'hit' ? first.foe : -1) || share <= 0) return
      f.hp = Math.max(0, f.hp - Math.round(share * resistFactor(f, element)))
    })
  }

  return { ...c, foes, hp: Math.min(stats.maxHp, c.hp + Math.round(healed)) }
}

const MINION_ELEMENT: Record<MinionKind, Element> = { skeleton: 'phys', mage: 'cold', golem: 'phys', bloodgolem: 'phys', revive: 'phys' }

const minionsAttack = (start: Character, stats: HeroStats, rng: Rng, events: CombatEvent[]): Character => {
  const foes = start.foes.map(f => ({ ...f }))
  let hp = start.hp
  start.minions.forEach((m, k) => {
    // The army spreads its blows over the pack.
    const alive = foes.map((f, i) => ({ f, i })).filter(({ f }) => f.hp > 0)
    if (alive.length === 0) return
    const { f: foe, i } = alive[k % alive.length]!
    const curse = curseOf(foe)
    const through = resistFactor(foe, MINION_ELEMENT[m.kind])
    const dmg = Math.round(minionStats(start, m.kind, stats).dmg * (0.85 + rng() * 0.3) * through * (1 + (curse.dmgTakenPct ?? 0) / 100))
    foe.hp = Math.max(0, foe.hp - dmg)
    hp += (dmg * ((curse.lifeTapPct ?? 0) + stats.talent.minionLeech)) / 100 + (m.kind === 'bloodgolem' ? dmg * 0.3 : 0)
    events.push({ kind: 'minionHit', minion: m.id, foe: i, dmg })
  })

  return { ...start, foes, hp: Math.min(stats.maxHp, Math.round(hp)) }
}

/** A blow reaching the hero: armour and toughness take physical blows, resistances the rest. */
const blowToHero = (raw: number, element: Element, stats: HeroStats) =>
  element === 'phys'
    ? Math.max(1, Math.round(((raw * 60) / (60 + stats.def)) * (1 - stats.dr)))
    : Math.max(1, Math.round(raw * (1 - stats.res / 100)))

const foesAttack = (start: Character, stats: HeroStats, rng: Rng, events: CombatEvent[]): Character => {
  let c = { ...start, foes: start.foes.map(f => ({ ...f })), minions: start.minions.map(m => ({ ...m })) }
  c.foes.forEach((foe, i) => {
    if (foe.hp <= 0 || (foe.status.stun ?? 0) > 0) return
    const swings = foe.affixes.includes('fast') ? 2 : 1
    for (let swing = 0; swing < swings; swing++) {
      const curse = curseOf(foe)
      const chilled = (foe.status.chill ?? 0) > 0 || curse.chill
      const raw = foe.atk * (0.85 + rng() * 0.3) * Math.max(0.1, 1 + (curse.foeDmgPct ?? 0) / 100) * (chilled ? 0.6 : 1)
      if (curse.reflectPct) foe.hp = Math.max(0, foe.hp - Math.round((raw * curse.reflectPct) / 100))

      // Golems draw the blows; otherwise the minions take their share of them.
      const golem = c.minions.find(m => (m.kind === 'golem' || m.kind === 'bloodgolem') && m.hp > 0)
      const standing = c.minions.filter(m => m.hp > 0)
      const other = standing.length > 0 && rng() < standing.length / (standing.length + 2) ? standing[Math.floor(rng() * standing.length)] : undefined
      const minion = golem ?? other
      if (minion) {
        const dmg = Math.max(1, Math.round(raw))
        minion.hp -= dmg
        events.push({ kind: 'hurt', foe: i, dmg, element: foe.element, minion: minion.id })
        if (minion.hp <= 0) {
          events.push({ kind: 'minionDied', minion: minion.id, minionKind: minion.kind })
          // A servant bursting as it falls.
          if (stats.talent.minionExplode) {
            const burst = Math.round((minion.maxHp * stats.talent.minionExplode) / 100)
            c.foes.forEach(f => {
              if (f.hp > 0) f.hp = Math.max(0, f.hp - Math.round(burst * resistFactor(f, 'fire')))
            })
            events.push({ kind: 'minionBurst', dmg: burst })
          }
        }
        continue
      }

      if (foe.element === 'phys' && rng() < stats.block) {
        events.push({ kind: 'hurt', foe: i, dmg: 0, element: foe.element, blocked: true })
        continue
      }
      const blow = blowToHero(raw, foe.element, stats)
      const absorbed = Math.min(c.shield, blow)
      c.shield -= absorbed
      // A mana shield takes its share out of mana while mana lasts.
      const fromMana = Math.min(c.mana, Math.round(((blow - absorbed) * stats.talent.manaShield) / 100))
      c.mana -= fromMana
      const taken = blow - absorbed - fromMana
      c.hp = Math.max(0, c.hp - taken)
      if (foe.affixes.includes('vampiric')) foe.hp = Math.min(foe.maxHp, foe.hp + Math.round(taken * 0.5))
      if (foe.affixes.includes('manaBurn')) c.mana = Math.max(0, c.mana - taken)
      if (foe.element === 'cold' && taken > 0) c.chilled = Math.max(c.chilled, 2)
      events.push({ kind: 'hurt', foe: i, dmg: taken, element: foe.element, ...(absorbed > 0 ? { absorbed } : {}) })
    }
  })

  return { ...c, minions: c.minions.filter(m => m.hp > 0) }
}

const drinkPotions = (c: Character, stats: HeroStats, events: CombatEvent[]): Character => {
  let next = c
  if (next.hp < stats.maxHp * 0.4 && next.belt.red > 0) {
    next = { ...next, hp: Math.min(stats.maxHp, next.hp + Math.round(stats.maxHp * 0.4 * (1 + stats.talent.potionPct / 100))), belt: { ...next.belt, red: next.belt.red - 1 } }
    events.push({ kind: 'potion', color: 'red' })
  }
  if (next.mana < stats.maxMana * 0.2 && next.belt.blue > 0) {
    next = { ...next, mana: Math.min(stats.maxMana, next.mana + Math.round(stats.maxMana * 0.5)), belt: { ...next.belt, blue: next.belt.blue - 1 } }
    events.push({ kind: 'potion', color: 'blue' })
  }

  return next
}

const tierOf = (foe: Foe): DropTier => foe.elite ?? 'normal'

/** Rewards for each monster that fell this second. */
const reap = (start: Character, before: Character, stats: HeroStats, rng: Rng, events: CombatEvent[]): Character => {
  let c = start
  c.foes.forEach((foe, i) => {
    if (foe.hp > 0 || (before.foes[i]?.hp ?? 0) <= 0) return
    const gold = Math.round(foe.gold * (1 + stats.goldFind / 100))
    const xp = Math.round(foe.xp * (1 + stats.xpPct / 100))
    events.push({ kind: 'kill', foe: i, name: foe.name, xp, gold, ...(foe.elite ? { elite: foe.elite } : {}) })
    c = { ...c, gold: c.gold + gold, xp: c.xp + xp, totalKills: c.totalKills + 1, corpse: foe.maxHp }
    if (stats.talent.onKillHeal) {
      c = {
        ...c,
        hp: Math.min(stats.maxHp, c.hp + Math.round((stats.maxHp * stats.talent.onKillHeal) / 100)),
        mana: Math.min(stats.maxMana, c.mana + (stats.maxMana * stats.talent.onKillHeal) / 100),
      }
    }

    // A fire-enchanted monster bursts into flame as it dies.
    if (foe.affixes.includes('fire')) {
      const dmg = blowToHero(stats.maxHp * 0.15, 'fire', stats)
      c = { ...c, hp: Math.max(0, c.hp - dmg) }
      events.push({ kind: 'explode', foe: i, dmg })
    }

    const tier = tierOf(foe)
    const depth = c.rift ? riftZone(c.rift.tier) : c.zone
    if (c.rift) c = { ...c, rift: { ...c.rift, progress: Math.min(100, c.rift.progress + progressFor(foe)) } }
    const keyChance = c.rift || placeOf(c.zone).difficulty === 2 ? KEY_DROP_CHANCE[tier] : 0
    if (rng() < keyChance && !(c.rift && foe.isBoss)) {
      c = { ...c, keys: c.keys + 1 }
      events.push({ kind: 'key' })
    }
    for (let n = 0; n < (tier === 'boss' && !c.rift ? BOSS_DROPS : 1); n++) {
      const found = rollDrop(depth, tier, c.nextItemId, rng, stats.magicFind)
      if (!found) continue
      const drop = c.autoIdentify && found.unid ? identify(found) : found
      const picked = pickUp({ ...c, nextItemId: c.nextItemId + 1 }, drop, heroPower)
      c = picked.save
      events.push({ kind: 'loot', item: drop, action: picked.action })
    }
    const gem = rollGem(depth, tier, rng)
    if (gem) {
      c = addGem(c, gem)
      events.push({ kind: 'gem', gem })
    }
    const rune = rollRune(depth, tier, rng)
    if (rune !== null) {
      c = { ...c, runes: c.runes.map((n, k) => (k === rune ? n + 1 : n)) }
      events.push({ kind: 'rune', rune })
    }
    if (rng() < POTION_DROP * (1 + stats.potionFind / 100)) {
      const color = c.belt.red <= c.belt.blue ? 'red' : 'blue'
      if (c.belt[color] < BELT_SIZE) {
        c = { ...c, belt: { ...c.belt, [color]: c.belt[color] + 1 } }
        events.push({ kind: 'potionFound', color })
      }
    }
  })

  let leveled = false
  // At the cap, experience grows talents instead of levels.
  if (c.level >= MAX_LEVEL && c.xp > 0) {
    const grown = growTalents({ ...c, xp: 0 }, c.xp)
    c = grown.c
    if (grown.gained > 0) {
      events.push({ kind: 'talentPoint', total: c.talentEarned })
      c = autoAllocate(c)
    }
  }
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c = { ...c, xp: c.xp - xpToNext(c.level), level: c.level + 1 }
    leveled = true
    events.push({ kind: 'levelUp', level: c.level })
  }
  if (leveled) {
    c = autoAllocate(c)
    const full = heroStats(c)
    c = { ...c, hp: full.maxHp, mana: full.maxMana }
  }

  return c
}

/** The next pack for where the hero now stands, announced if it is worth announcing. */
const arrive = (c: Character, rng: Rng, events: CombatEvent[]): Character => {
  const foes = newPack(c.zone, c.packs, rng)
  const boss = foes.find(f => f.isBoss)
  const leader = foes.find(f => f.elite === 'unique' || f.elite === 'champion')
  if (boss) events.push({ kind: 'bossAppears', name: boss.name })
  else if (leader?.elite === 'unique' || leader?.elite === 'champion') events.push({ kind: 'eliteAppears', name: leader.name, elite: leader.elite })

  return { ...c, foes, walk: WALK_SECONDS }
}

/** The pack is down: on to the next, or the next area, act or difficulty. */
const advanceRift = (start: Character, rng: Rng, events: CombatEvent[]): Character => {
  const rift = start.rift!
  if (rift.hasGuardian) {
    const { save, reward } = finishRift(start, heroStats(start).magicFind, rng)
    let c = save
    for (const item of reward.items) {
      const picked = pickUp(c, item, heroPower)
      c = picked.save
      events.push({ kind: 'loot', item, action: picked.action })
    }
    events.push({ kind: 'riftClear', tier: rift.tier, isInTime: reward.isInTime, seconds: reward.seconds, gem: reward.gemSlot !== undefined })

    return c
  }
  if (rift.progress >= 100) {
    const foes = riftGuardian(rift.tier, rng)
    events.push({ kind: 'riftGuardian', name: foes[0]!.name })

    return { ...start, rift: { ...rift, hasGuardian: true }, foes, walk: WALK_SECONDS }
  }

  return { ...start, foes: riftPack(rift.tier, rng), walk: WALK_SECONDS }
}

const advance = (start: Character, rng: Rng, events: CombatEvent[]): Character => {
  if (start.rift) return advanceRift(start, rng, events)
  let c: Character = { ...start, packs: start.packs + 1, areaDeaths: 0 }
  if (c.packs < PACKS_PER_AREA) return arrive(c, rng, events)

  const place = placeOf(c.zone)
  events.push({ kind: 'areaClear', zone: c.zone })
  const open = questFor(c, c.zone)
  if (open) {
    c = { ...open.quest.apply(c, rng), quests: [...c.quests, questKey(open.difficulty, open.quest.id)] }
    events.push({ kind: 'quest', name: open.quest.name, reward: open.quest.reward })
  }
  if (place.isBossArea) {
    events.push({ kind: 'actClear', zone: c.zone })
    if (place.isLastAct) events.push({ kind: 'difficultyClear', zone: c.zone })
  }
  const wasLocked = !isRiftOpen(c)
  c = { ...c, maxZone: Math.max(c.maxZone, c.zone + 1), packs: 0 }
  if (wasLocked && c.maxZone >= RIFT_UNLOCK_ZONE) {
    c = { ...c, keys: c.keys + KEYS_ON_UNLOCK }
    events.push({ kind: 'riftUnlock' })
  }
  // Into ground that beat the hero, only once a level stronger.
  const isNewGround = c.zone + 1 >= c.maxZone
  if (c.autoAdvance && (!isNewGround || c.level >= c.retryLevel)) c = { ...c, zone: c.zone + 1 }

  return arrive(c, rng, events)
}

/** The most gold a death can take: what this many plain monsters of the area drop. */
const DEATH_GOLD_KILLS = 30
export const deathGoldCap = (zone: number) => Math.round(5 * 0.5 * zonePower(zone).reward * DEATH_GOLD_KILLS)

const die = (c: Character, rng: Rng, events: CombatEvent[]): Character => {
  if (c.rift) {
    events.push({ kind: 'death', isRetreat: false, goldLost: 0 })

    return { ...c, hp: 0, deaths: c.deaths + 1, deadFor: DEATH_SECONDS, minions: [], buffs: {}, shield: 0, chilled: 0, walk: 0 }
  }
  const areaDeaths = c.areaDeaths + 1
  const isRetreat = areaDeaths >= RETREAT_AFTER && c.zone > 0
  const goldLost = Math.min(Math.floor(c.gold * 0.1), deathGoldCap(c.zone))
  events.push({ kind: 'death', isRetreat, goldLost })
  const zone = isRetreat ? c.zone - 1 : c.zone
  const fallen: Character = {
    ...c,
    hp: 0,
    gold: c.gold - goldLost,
    deaths: c.deaths + 1,
    deadFor: DEATH_SECONDS,
    zone,
    areaDeaths: isRetreat ? 0 : areaDeaths,
    retryLevel: isRetreat ? c.level + 1 : c.retryLevel,
    // Falling back to an area already cleared: clearing it again walks the hero forward once more.
    packs: isRetreat ? 0 : c.packs,
    minions: [],
    buffs: {},
    shield: 0,
    chilled: 0,
  }

  return { ...fallen, foes: newPack(zone, fallen.packs, rng), walk: WALK_SECONDS }
}

/** Every timer one second on: cooldowns, buffs, and what lingers on the monsters. */
const timePasses = (c: Character): Character => {
  const cooldowns: Record<string, number> = {}
  for (const [id, left] of Object.entries(c.cooldowns)) if (left > 1) cooldowns[id] = left - 1
  const buffs: Record<string, number> = {}
  for (const [id, left] of Object.entries(c.buffs)) if (left > 1) buffs[id] = left - 1
  const foes = c.foes.map(f => {
    const s = { ...f.status }
    if (s.chill) s.chill = s.chill > 1 ? s.chill - 1 : undefined
    if (s.stun) s.stun = s.stun > 1 ? s.stun - 1 : undefined
    if (s.curse) s.curse = s.curse.left > 1 ? { ...s.curse, left: s.curse.left - 1 } : undefined

    return { ...f, status: s }
  })

  return {
    ...c,
    cooldowns,
    buffs,
    foes,
    chilled: Math.max(0, c.chilled - 1),
    focus: Math.max(0, c.focus - 1),
    blessing: Math.max(0, c.blessing - 1),
    chestCooldown: Math.max(0, c.chestCooldown - 1),
  }
}

const burnAndPoison = (c: Character, events: CombatEvent[]): Character => ({
  ...c,
  foes: c.foes.map((f, i) => {
    if (f.hp <= 0) return f
    let hp = f.hp
    const status = { ...f.status }
    for (const key of ['burn', 'poison'] as const) {
      const dot = status[key]
      if (!dot) continue
      const dmg = Math.min(hp, dot.dps)
      hp -= dmg
      if (dmg > 0) events.push({ kind: 'dot', foe: i, dmg })
      status[key] = dot.left > 1 ? { ...dot, left: dot.left - 1 } : undefined
    }

    return { ...f, hp, status }
  }),
})

/**
 * One second of the hero's life: lying dead, walking to the next pack
 * (keeping summons and buffs up on the way), or one round of battle.
 */
export const tick = (start: Character, rng: Rng): { save: Character; events: CombatEvent[] } => {
  const events: CombatEvent[] = []
  let c = attrPointsLeft(start) > 0 || skillPointsLeft(start) > 0 ? autoAllocate(start) : start
  c = timePasses(c)
  if (c.rift) c = { ...c, rift: { ...c.rift, timeLeft: c.rift.timeLeft - 1 } }
  if (!c.rift && c.autoRift && c.keys > 0 && c.walk > 0 && c.deadFor === 0 && isRiftOpen(c)) {
    c = startRift(c, rng)
    if (c.rift) events.push({ kind: 'riftStart', tier: c.rift.tier })
  }
  let stats = heroStats(c)
  c = { ...c, mana: Math.min(stats.maxMana, c.mana + stats.manaRegen) }

  if (c.deadFor > 0) {
    c = { ...c, deadFor: c.deadFor - 1 }
    if (c.deadFor === 0) {
      c = { ...c, hp: stats.maxHp, mana: stats.maxMana }
      events.push({ kind: 'revive' })
    }

    return { save: c, events }
  }

  if (c.walk > 0) {
    c = {
      ...c,
      walk: c.walk - 1,
      distance: c.distance + 1,
      hp: Math.min(stats.maxHp, c.hp + Math.ceil(stats.maxHp * 0.05)),
      mana: Math.min(stats.maxMana, c.mana + stats.maxMana * 0.05),
      minions: c.minions.map(m => ({ ...m, hp: Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * 0.1)) })),
    }
    const need = upkeep(c)
    if (need) c = cast(c, need, stats, rng, events)
    if (c.autoPotion) {
      for (const color of ['red', 'blue'] as const) {
        if (c.belt[color] < BELT_SIZE / 2 && c.gold >= potionPrice(c) * 3) {
          c = { ...c, gold: c.gold - potionPrice(c), belt: { ...c.belt, [color]: c.belt[color] + 1 } }
        }
      }
    }

    return { save: c, events }
  }

  c = burnAndPoison(c, events)
  c = drinkPotions(c, stats, events)
  c = cast(c, chooseAction(c, stats), stats, rng, events)
  stats = heroStats(c)
  c = minionsAttack(c, stats, rng, events)
  c = foesAttack(c, stats, rng, events)
  c = reap(c, start, stats, rng, events)

  // Undying: a killing blow, once a minute, leaves the hero standing.
  if (c.hp <= 0 && stats.talent.cheatDeath && !((c.cooldowns.cheatDeath ?? 0) > 0)) {
    c = { ...c, hp: Math.round((stats.maxHp * stats.talent.cheatDeath) / 100), cooldowns: { ...c.cooldowns, cheatDeath: 60 } }
    events.push({ kind: 'cheatDeath' })
  }
  if (c.hp <= 0) return { save: die(c, rng, events), events }
  if (c.foes.every(f => f.hp <= 0)) return { save: advance(c, rng, events), events }

  return { save: c, events }
}

export type OfflineReport = {
  seconds: number
  kills: number
  xp: number
  gold: number
  levels: number
  items: number
  gems: number
  deaths: number
  areas: number
  runes: number[]
  best?: Item
}

export const simulateOffline = (c: Character, seconds: number, rng: Rng, cap = 8 * 60 * 60) => {
  const ticks = Math.min(cap, Math.max(0, Math.floor(seconds)))
  const report: OfflineReport = { seconds: ticks, kills: 0, xp: 0, gold: 0, levels: 0, items: 0, gems: 0, deaths: 0, areas: 0, runes: [] }
  let save = c
  for (let i = 0; i < ticks; i++) {
    const r = tick(save, rng)
    save = r.save
    for (const ev of r.events) {
      if (ev.kind === 'kill') {
        report.kills += 1
        report.xp += ev.xp
        report.gold += ev.gold
      } else if (ev.kind === 'levelUp') report.levels += 1
      else if (ev.kind === 'loot') {
        report.items += 1
        if (!report.best || RARITIES[ev.item.rarity].rank > RARITIES[report.best.rarity].rank) report.best = ev.item
      } else if (ev.kind === 'gem') report.gems += 1
      else if (ev.kind === 'rune') report.runes.push(ev.rune)
      else if (ev.kind === 'death') report.deaths += 1
      else if (ev.kind === 'areaClear') report.areas += 1
    }
  }

  return { save, report }
}
