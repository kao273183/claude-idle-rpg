import type { Attr, Character, ClassId, Item, MinionKind } from '../types'

import { ATTR_POINTS_PER_LEVEL, ATTRS, CLASSES } from './classes'
import { emptyEquipment, emptyPouch, gearStats, SLOTS } from './loot'
import { emptyQuestBonus } from './quests'
import { emptyRunes } from './runes'
import { autoTalents, talentPointsLeft, talentTotals } from './talents'
import { DIFFICULTIES, firstPack, placeOf, WALK_SECONDS } from './monsters'
import { classSkills, MAX_SKILL_RANK, SKILLS, skillOf } from './skilltree'
import type { BuffEffect, PassiveEffect } from './skilltree'

export const BELT_SIZE = 8
export const MAX_MINION_SLOTS = 8

export const newCharacter = (classId: ClassId): Character => {
  const c: Character = {
    classId,
    level: 1,
    xp: 0,
    gold: 0,
    attrs: { str: 0, dex: 0, vit: 0, ene: 0 },
    hp: 1,
    mana: 1,
    skills: {},
    mainSkill: null,
    autoAttr: true,
    autoSkill: true,
    autoPotion: true,
    belt: { red: 4, blue: 4 },
    cooldowns: {},
    buffs: {},
    shield: 0,
    minions: [],
    nextMinionId: 1,
    foes: firstPack(0),
    deadFor: 0,
    corpse: 0,
    zone: 0,
    maxZone: 0,
    packs: 0,
    areaDeaths: 0,
    retryLevel: 0,
    chilled: 0,
    autoAdvance: true,
    totalKills: 0,
    deaths: 0,
    walk: WALK_SECONDS,
    distance: 0,
    equipment: emptyEquipment(),
    bag: [],
    gems: emptyPouch(),
    runes: emptyRunes(),
    charms: [],
    autoIdentify: true,
    quests: [],
    questBonus: emptyQuestBonus(),
    talents: {},
    talentXp: 0,
    talentEarned: 0,
    autoTalent: true,
    rift: null,
    keys: 0,
    riftTier: 1,
    riftBest: 0,
    autoRift: true,
    riftLast: null,
    autoEquip: true,
    nextItemId: 1,
  }
  const allocated = autoAllocate(c)
  const stats = heroStats(allocated)

  return { ...allocated, hp: stats.maxHp, mana: stats.maxMana }
}

// ── Attributes ─────────────────────────────────────────────────────────────
export const attrOf = (c: Character, a: Attr) => CLASSES[c.classId].base[a] + c.attrs[a]

export const attrPointsLeft = (c: Character) =>
  (c.level - 1) * ATTR_POINTS_PER_LEVEL + c.questBonus.attr - ATTRS.reduce((sum, a) => sum + c.attrs[a], 0)

export const raiseAttr = (c: Character, a: Attr): Character =>
  attrPointsLeft(c) > 0 ? { ...c, attrs: { ...c.attrs, [a]: c.attrs[a] + 1 } } : c

/** The class's split, each point to whichever attribute lags its share the most. */
const autoAllocateAttrs = (c: Character): Character => {
  const ratio = CLASSES[c.classId].autoAttr
  const attrs = { ...c.attrs }
  let left = attrPointsLeft(c)
  while (left > 0) {
    let best: Attr = 'vit'
    let lag = Infinity
    for (const a of ATTRS) {
      if (ratio[a] === 0) continue
      const share = attrs[a] / ratio[a]
      if (share < lag) {
        lag = share
        best = a
      }
    }
    attrs[best] += 1
    left -= 1
  }

  return { ...c, attrs }
}

// ── Skills ─────────────────────────────────────────────────────────────────
/** Points put into a skill. */
export const baseRank = (c: Character, id: string) => c.skills[id] ?? 0

/** A skill's working rank: the points in it, and +skills from gear on any skill that has a point. */
export const rankOf = (c: Character, id: string) => {
  const base = c.skills[id] ?? 0

  return base > 0 ? base + gearStats(c.equipment, c.charms).flat.skills + talentTotals(c).skills : 0
}

export const skillPointsLeft = (c: Character) =>
  c.level - 1 + c.questBonus.skill - Object.values(c.skills).reduce((sum, r) => sum + r, 0)

export const canRaiseSkill = (c: Character, id: string) => {
  const def = SKILLS[id]

  return (
    def !== undefined &&
    def.classId === c.classId &&
    skillPointsLeft(c) > 0 &&
    c.level >= def.unlock &&
    baseRank(c, id) < MAX_SKILL_RANK
  )
}

export const raiseSkill = (c: Character, id: string): Character =>
  canRaiseSkill(c, id) ? { ...c, skills: { ...c.skills, [id]: baseRank(c, id) + 1 } } : c

/** Build orders for auto-allocation: each step raises a skill up to a rank. */
const BUILDS: Record<ClassId, [string, number][]> = {
  barbarian: [
    ['bash', 3], ['weaponMastery', 3], ['howl', 1], ['ironSkin', 3], ['doubleSwing', 6], ['findPotion', 2],
    ['weaponMastery', 8], ['leap', 3], ['taunt', 2], ['toughness', 5], ['frenzy', 8], ['battleCry', 5],
    ['deepWounds', 5], ['whirlwind', 10], ['battleOrders', 8], ['naturalRes', 8], ['weaponMastery', 20],
    ['whirlwind', 20], ['berserk', 8], ['rage', 10], ['naturalRes', 20], ['ironSkin', 20], ['toughness', 20],
  ],
  sorceress: [
    ['fireBolt', 4], ['warmth', 1], ['frozenArmor', 1], ['staticField', 2], ['fireBolt', 8], ['fireball', 6],
    ['energyShield', 4], ['fireWall', 3], ['warmth', 4], ['fireball', 12], ['meteor', 8], ['fireBolt', 12],
    ['fireball', 20], ['meteor', 20], ['fireMastery', 20], ['fireBolt', 20], ['energyShield', 12],
  ],
  necromancer: [
    ['raiseSkeleton', 3], ['amplify', 2], ['skeletonMastery', 3], ['raiseSkeleton', 6], ['boneArmor', 2],
    ['skeletonMastery', 6], ['clayGolem', 3], ['raiseSkeleton', 9], ['skeletalMage', 5], ['corpseExplosion', 4],
    ['decrepify', 3], ['skeletonMastery', 12], ['raiseSkeleton', 15], ['bloodGolem', 5], ['skeletalMage', 12],
    ['skeletonMastery', 20], ['raiseSkeleton', 20], ['revive', 12], ['corpseExplosion', 12], ['lowerRes', 5],
  ],
}

const autoAllocateSkills = (c: Character): Character => {
  let save = c
  while (skillPointsLeft(save) > 0) {
    const step = BUILDS[save.classId].find(([id, cap]) => baseRank(save, id) < cap && canRaiseSkill(save, id))
    const id = step?.[0] ?? classSkills(save.classId).find(s => canRaiseSkill(save, s.id))?.id
    if (!id) break
    save = raiseSkill(save, id)
  }

  return save
}

/** Spends every attribute and skill point the auto switches allow, then picks the main skill. */
export const autoAllocate = (c: Character): Character => {
  let save = c
  if (save.autoAttr) save = autoAllocateAttrs(save)
  if (save.autoSkill) {
    save = autoAllocateSkills(save)
    save = { ...save, mainSkill: bestMainSkill(save) }
  }
  if (save.autoTalent && talentPointsLeft(save) > 0) save = autoTalents(save)

  return save
}

export const respecCost = (c: Character) => c.level * c.level * 10

export const respecSkills = (c: Character): Character =>
  c.gold < respecCost(c)
    ? c
    : { ...c, gold: c.gold - respecCost(c), skills: {}, cooldowns: {}, buffs: {}, shield: 0, minions: [], mainSkill: null, autoSkill: false }

// ── Derived stats ──────────────────────────────────────────────────────────
const learned = (c: Character) => classSkills(c.classId).filter(s => rankOf(c, s.id) > 0)

export const passiveTotals = (c: Character): Required<PassiveEffect> => {
  const total: Required<PassiveEffect> = {
    dmgPct: 0, defPct: 0, lifePct: 0, crit: 0, critDmg: 0, dr: 0, manaRegenPct: 0,
    firePct: 0, coldPct: 0, lightPct: 0, minionPct: 0, potionFind: 0, bleedPct: 0, res: 0,
  }
  for (const s of learned(c)) {
    if (!s.passive) continue
    const effect = s.passive(rankOf(c, s.id))
    for (const key of Object.keys(effect) as (keyof PassiveEffect)[]) total[key] += effect[key] ?? 0
  }

  return total
}

export const buffTotals = (c: Character): Required<BuffEffect> => {
  const total = { lifePct: 0, manaPct: 0, defPct: 0, dmgPct: 0, shieldPct: 0 }
  for (const [id, left] of Object.entries(c.buffs)) {
    const def = SKILLS[id]
    if (!def?.buff || left <= 0) continue
    const effect = def.buff.effect(rankOf(c, id))
    for (const key of Object.keys(total) as (keyof BuffEffect)[]) total[key] += effect[key] ?? 0
  }

  return total
}

export const canWear = (c: Character, item: Item) =>
  (item.req?.str ?? 0) <= attrOf(c, 'str') && (item.req?.dex ?? 0) <= attrOf(c, 'dex')

export const heroStats = (c: Character) => {
  const cls = CLASSES[c.classId]
  const gear = gearStats(c.equipment, c.charms)
  const p = passiveTotals(c)
  const b = buffTotals(c)
  // Talents and the legendary powers of worn uniques and sets work the same way.
  const t = { ...talentTotals(c) }
  for (const [k, v] of Object.entries(gear.power)) (t as Record<string, number>)[k] = ((t as Record<string, number>)[k] ?? 0) + v
  const str = attrOf(c, 'str')
  const dex = attrOf(c, 'dex')
  const L = c.level

  const life =
    cls.life.base + cls.life.perLevel * (L - 1) + cls.life.perVit * (attrOf(c, 'vit') - cls.base.vit) + gear.flat.hp
  const mana = cls.mana.base + cls.mana.perLevel * (L - 1) + cls.mana.perEne * (attrOf(c, 'ene') - cls.base.ene) + gear.flat.mana
  const maxMana = Math.round(mana * (1 + (b.manaPct + t.manaPct) / 100))
  // Each difficulty takes its toll on resistances; 75% is the most any can reach.
  const difficulty = c.rift ? 2 : placeOf(c.zone).difficulty
  const resist = Math.min(75, gear.flat.res + p.res + t.res + c.questBonus.res - DIFFICULTIES[difficulty]!.resPenalty)

  return {
    str,
    dex,
    vit: attrOf(c, 'vit'),
    ene: attrOf(c, 'ene'),
    maxHp: Math.round(life * (1 + (gear.pct.hp + p.lifePct + b.lifePct + t.lifePct + c.questBonus.lifePct) / 100)),
    maxMana,
    /** Weapon damage, before skills. */
    weapon: Math.round((3 + 1.2 * L + gear.flat.atk) * (1 + gear.pct.atk / 100)),
    physMult: 1 + str / 125 + (p.dmgPct + b.dmgPct + t.dmgPct + t.physPct) / 100,
    def: Math.round((dex / 4 + L + gear.flat.def) * (1 + (gear.pct.def + p.defPct + b.defPct + t.defPct) / 100)),
    block: Math.min(0.5, dex * 0.002 + (t.block + gear.flat.block) / 100),
    critRate: Math.min(0.75, 0.05 + (gear.flat.crit + p.crit + t.crit) / 100),
    critMult: 2 + (p.critDmg + t.critDmg) / 100,
    dr: Math.min(0.6, (p.dr + t.dr) / 100),
    manaRegen: maxMana * 0.03 * (1 + (p.manaRegenPct + t.manaRegenPct) / 100) + 1,
    goldFind: gear.flat.gf + t.gf,
    magicFind: gear.flat.mf + t.mf,
    leech: gear.flat.ls + t.leech,
    plusSkills: gear.flat.skills,
    potionFind: p.potionFind,
    bleedPct: p.bleedPct,
    elementPct: { fire: p.firePct + t.firePct, cold: p.coldPct + t.coldPct, light: p.lightPct + t.lightPct, poison: t.poisonPct, magic: t.magicPct } as Record<string, number>,
    minionPct: p.minionPct + t.minionPct + gear.flat.minion,
    spellDmgPct: b.dmgPct + t.dmgPct + gear.flat.spell,
    talent: t,
    /** Fire, cold, lightning and poison alike; may be below zero. */
    res: resist,
  }
}

export type HeroStats = ReturnType<typeof heroStats>

/** A skill's damage before crits, variance and curses. */
export const skillDamage = (c: Character, id: string, stats: HeroStats = heroStats(c)) => {
  const def = skillOf(id)
  const r = Math.max(1, rankOf(c, id))
  if (def.phys) {
    const weak = def.id === 'attack' ? CLASSES[c.classId].weakSwing : 1

    return stats.weapon * stats.physMult * def.phys(r) * weak
  }
  if (def.spell) {
    const synergy = (def.synergies ?? []).reduce((sum, s) => sum + rankOf(c, s.from) * s.pct, 0)
    const element = stats.elementPct[def.element ?? 'phys'] ?? 0

    // Spells carry the weapon too, in proportion to their own strength, so gear matters to every class.
    const spell = def.spell(r)

    return (spell * (1 + 0.1 * (c.level - 1)) + (stats.weapon * spell) / 12) * (1 + (element + synergy + stats.spellDmgPct) / 100)
  }

  return 0
}

/** The attack to lead with: the strongest that needs no cooldown and some mana. */
export const bestMainSkill = (c: Character): string | null => {
  const stats = heroStats(c)
  let best: string | null = null
  let most = 0
  for (const s of learned(c)) {
    if (s.kind !== 'attack' || s.cooldown || s.staticPct || s.corpsePct) continue
    const dmg = skillDamage(c, s.id, stats) * (s.aoe ? 1.1 : 1)
    if (dmg > most) {
      most = dmg
      best = s.id
    }
  }

  return best
}

export const minionStats = (c: Character, kind: MinionKind, stats: HeroStats = heroStats(c)) => {
  const def = classSkills(c.classId).find(s => s.summon?.kind === kind)
  if (!def?.summon) return { maxHp: 1, dmg: 0 }
  const r = Math.max(1, rankOf(c, def.id))
  const boost = 1 + stats.minionPct / 100

  return {
    maxHp: Math.round((def.summon.life(r) * (1 + 0.08 * (c.level - 1)) + stats.maxHp * 0.35) * boost),
    // Like spells, servants carry the weapon in proportion to their own strength.
    dmg: (def.summon.dmg(r) * (1 + 0.1 * (c.level - 1)) + (stats.weapon * def.summon.dmg(r)) / 26) * boost,
  }
}

/** One number for how strong the hero is: what auto-equip maximizes. Gear the hero cannot wear makes it hopeless. */
export const heroPower = (c: Character) => {
  for (const slot of SLOTS) {
    const item = c.equipment[slot]
    if (item && !canWear(c, item)) return -Infinity
  }
  const s = heroStats(c)
  // The servants count as much as the hero's own blows.
  const army = classSkills(c.classId)
    .filter(sk => sk.summon && rankOf(c, sk.id) > 0)
    .reduce((sum, sk) => sum + sk.summon!.count(rankOf(c, sk.id)) * minionStats(c, sk.summon!.kind, s).dmg, 0)
  const attack = Math.max(c.mainSkill ? skillDamage(c, c.mainSkill, s) : skillDamage(c, 'attack', s), army)

  return attack * 2 * (1 + s.critRate) * (1 + s.leech / 50) + s.def * 2 + s.maxHp * 0.25 + s.goldFind * 0.5 + s.magicFind * 0.6
}

/** Health and mana back within their maximums. */
export const clampVitals = (c: Character): Character => {
  const s = heroStats(c)

  return { ...c, hp: Math.min(c.hp, s.maxHp), mana: Math.min(c.mana, s.maxMana) }
}

export const potionPrice = (c: Character) => 10 + c.level * 3

export const buyPotion = (c: Character, color: 'red' | 'blue'): Character =>
  c.gold < potionPrice(c) || c.belt[color] >= BELT_SIZE
    ? c
    : { ...c, gold: c.gold - potionPrice(c), belt: { ...c.belt, [color]: c.belt[color] + 1 } }
