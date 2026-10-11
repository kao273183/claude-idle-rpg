import type { ClassId, Element, MinionKind } from '../types'

export type { Element }

export const ELEMENT_COLORS: Record<Element, number> = {
  phys: 0xf0f0f0,
  fire: 0xff8030,
  cold: 0x80c8ff,
  light: 0xfff070,
  poison: 0x60e040,
  magic: 0xe0d0ff,
}

/** How a skill looks when it goes off. */
export type FxKind =
  | 'melee'
  | 'spin'
  | 'leap'
  | 'projectile'
  | 'beam'
  | 'nova'
  | 'rain'
  | 'orb'
  | 'wall'
  | 'aura'
  | 'curse'
  | 'summon'
  | 'shout'
  | 'burst'

export type PassiveEffect = Partial<{
  dmgPct: number
  defPct: number
  lifePct: number
  crit: number
  critDmg: number
  dr: number
  manaRegenPct: number
  firePct: number
  coldPct: number
  lightPct: number
  minionPct: number
  potionFind: number
  bleedPct: number
  res: number
}>

export type BuffEffect = Partial<{ lifePct: number; manaPct: number; defPct: number; dmgPct: number; shieldPct: number }>

export type CurseEffect = Partial<{
  dmgTakenPct: number
  foeDmgPct: number
  lifeTapPct: number
  reflectPct: number
  /** Lowers the monster's elemental resistances, immunities included. */
  resMinus: number
  fear: boolean
  chill: boolean
}>

export type SkillDef = {
  id: string
  classId: ClassId
  tree: 0 | 1 | 2
  name: string
  /** Hero level that opens it. */
  unlock: number
  kind: 'attack' | 'buff' | 'curse' | 'summon' | 'passive'
  mana?: (r: number) => number
  cooldown?: number
  element?: Element
  /** Weapon-damage multiplier, for physical attacks. */
  phys?: (r: number) => number
  /** Spell damage at a rank, before the hero's level and masteries. */
  spell?: (r: number) => number
  aoe?: boolean
  /** Share of the damage dealt over time instead of at once (1: all of it). */
  dotShare?: number
  dotSecs?: number
  chill?: number
  stun?: number
  /** Static field: this share of the monster's current life. */
  staticPct?: number
  /** Corpse explosion: this share of the last corpse's life. */
  corpsePct?: (r: number) => number
  synergies?: { from: string; pct: number }[]
  buff?: { secs: number; effect: (r: number) => BuffEffect }
  curse?: { secs: (r: number) => number; effect: (r: number) => CurseEffect }
  summon?: { kind: MinionKind; count: (r: number) => number; life: (r: number) => number; dmg: (r: number) => number }
  passive?: (r: number) => PassiveEffect
  fx: { kind: FxKind; color: number }
  describe: (r: number) => string
}

export const MAX_SKILL_RANK = 20
export const UNLOCKS = [1, 6, 12, 18, 24, 30] as const

const lin = (base: number, per: number) => (r: number) => base + per * (r - 1)
const pct = (n: number) => `${Math.round(n * 100)}%`
const n = (x: number) => `${Math.round(x)}`
/** Skeletons and mages: one a rank to three, then one more every three ranks. */
const armySize = (r: number) => Math.min(8, Math.min(r, 3) + Math.floor(Math.max(0, r - 3) / 3))

const SKILL_LIST: SkillDef[] = [
  // ── Barbarian: combat ───────────────────────────────────────────────────
  {
    id: 'bash', classId: 'barbarian', tree: 0, name: '猛擊', unlock: 1, kind: 'attack',
    mana: () => 2, element: 'phys', phys: lin(1.5, 0.1), stun: 0.5,
    fx: { kind: 'melee', color: 0xffffff },
    describe: r => `重擊敵人，造成 ${pct(lin(1.5, 0.1)(r))} 武器傷害並短暫暈眩`,
  },
  {
    id: 'doubleSwing', classId: 'barbarian', tree: 0, name: '雙重揮擊', unlock: 6, kind: 'attack',
    mana: () => 2, element: 'phys', phys: lin(2, 0.12),
    fx: { kind: 'melee', color: 0xd0e8ff },
    describe: r => `雙手各揮一擊，共 ${pct(lin(2, 0.12)(r))} 武器傷害`,
  },
  {
    id: 'leap', classId: 'barbarian', tree: 0, name: '跳躍攻擊', unlock: 12, kind: 'attack',
    mana: () => 7, cooldown: 4, element: 'phys', phys: lin(2.4, 0.15), stun: 1.5, aoe: true,
    fx: { kind: 'leap', color: 0xffe0a0 },
    describe: r => `躍起重砸，對所有敵人造成 ${pct(lin(2.4, 0.15)(r))} 武器傷害並暈眩（冷卻 4 秒）`,
  },
  {
    id: 'frenzy', classId: 'barbarian', tree: 0, name: '狂亂', unlock: 18, kind: 'attack',
    mana: () => 4, element: 'phys', phys: lin(2.6, 0.16),
    fx: { kind: 'melee', color: 0xff6040 },
    describe: r => `瘋狂連砍，造成 ${pct(lin(2.6, 0.16)(r))} 武器傷害`,
  },
  {
    id: 'whirlwind', classId: 'barbarian', tree: 0, name: '旋風斬', unlock: 24, kind: 'attack',
    mana: () => 10, element: 'phys', phys: lin(2.4, 0.15), aoe: true,
    fx: { kind: 'spin', color: 0xff8030 },
    describe: r => `化身旋風，對所有敵人造成 ${pct(lin(2.4, 0.15)(r))} 武器傷害`,
  },
  {
    id: 'berserk', classId: 'barbarian', tree: 0, name: '狂暴', unlock: 30, kind: 'attack',
    mana: () => 6, cooldown: 2, element: 'magic', phys: lin(4, 0.25),
    fx: { kind: 'burst', color: 0xc080ff },
    describe: r => `捨棄防禦的一擊，造成 ${pct(lin(4, 0.25)(r))} 武器傷害（魔法，冷卻 2 秒）`,
  },
  // ── Barbarian: masteries ────────────────────────────────────────────────
  {
    id: 'weaponMastery', classId: 'barbarian', tree: 1, name: '武器精通', unlock: 1, kind: 'passive',
    passive: r => ({ dmgPct: 6 * r, crit: 0.5 * r }),
    fx: { kind: 'aura', color: 0xc0c0c0 },
    describe: r => `物理傷害 +${6 * r}%、爆擊率 +${0.5 * r}%`,
  },
  {
    id: 'ironSkin', classId: 'barbarian', tree: 1, name: '鋼鐵之膚', unlock: 6, kind: 'passive',
    passive: r => ({ defPct: 10 * r }),
    fx: { kind: 'aura', color: 0x8090a0 },
    describe: r => `防禦 +${10 * r}%`,
  },
  {
    id: 'toughness', classId: 'barbarian', tree: 1, name: '強韌體魄', unlock: 12, kind: 'passive',
    passive: r => ({ lifePct: 3 * r }),
    fx: { kind: 'aura', color: 0xc04040 },
    describe: r => `最大生命 +${3 * r}%`,
  },
  {
    id: 'deepWounds', classId: 'barbarian', tree: 1, name: '撕裂傷口', unlock: 18, kind: 'passive',
    passive: r => ({ bleedPct: 6 * r }),
    fx: { kind: 'aura', color: 0xa01010 },
    describe: r => `攻擊使敵人流血，3 秒內額外受到 ${6 * r}% 傷害`,
  },
  {
    id: 'naturalRes', classId: 'barbarian', tree: 1, name: '自然抗性', unlock: 24, kind: 'passive',
    passive: r => ({ res: Math.min(80, 8 + 3 * r), dr: Math.min(25, r) }),
    fx: { kind: 'aura', color: 0x60a060 },
    describe: r => `所有元素抗性 +${Math.min(80, 8 + 3 * r)}%、受到的物理傷害 -${Math.min(25, r)}%`,
  },
  {
    id: 'rage', classId: 'barbarian', tree: 1, name: '怒火', unlock: 30, kind: 'passive',
    passive: r => ({ critDmg: 8 * r, crit: 0.5 * r }),
    fx: { kind: 'aura', color: 0xff4020 },
    describe: r => `爆擊傷害 +${8 * r}%、爆擊率 +${0.5 * r}%`,
  },
  // ── Barbarian: warcries ─────────────────────────────────────────────────
  {
    id: 'howl', classId: 'barbarian', tree: 2, name: '咆哮', unlock: 1, kind: 'curse',
    mana: () => 3, cooldown: 10,
    curse: { secs: lin(1.5, 0.15), effect: () => ({ fear: true }) },
    fx: { kind: 'shout', color: 0xd0b080 },
    describe: r => `震懾敵人，${lin(1.5, 0.15)(r).toFixed(1)} 秒內無法攻擊（冷卻 10 秒）`,
  },
  {
    id: 'findPotion', classId: 'barbarian', tree: 2, name: '尋找藥水', unlock: 6, kind: 'passive',
    passive: r => ({ potionFind: 6 * r }),
    fx: { kind: 'aura', color: 0xff4040 },
    describe: r => `擊殺時找到藥水的機率 +${6 * r}%`,
  },
  {
    id: 'taunt', classId: 'barbarian', tree: 2, name: '嘲諷', unlock: 12, kind: 'curse',
    mana: () => 3,
    curse: { secs: () => 8, effect: r => ({ foeDmgPct: -(15 + 2 * r) }) },
    fx: { kind: 'shout', color: 0xff8060 },
    describe: r => `激怒敵人使其亂了章法，傷害 -${15 + 2 * r}%`,
  },
  {
    id: 'battleCry', classId: 'barbarian', tree: 2, name: '戰鬥怒吼', unlock: 18, kind: 'curse',
    mana: () => 5,
    curse: { secs: () => 10, effect: r => ({ dmgTakenPct: 15 + 2 * r, foeDmgPct: -(10 + r) }) },
    fx: { kind: 'shout', color: 0xffd040 },
    describe: r => `敵人受到的傷害 +${15 + 2 * r}%、造成的傷害 -${10 + r}%`,
  },
  {
    id: 'battleOrders', classId: 'barbarian', tree: 2, name: '戰鬥命令', unlock: 24, kind: 'buff',
    mana: () => 7, cooldown: 30,
    buff: { secs: 30, effect: r => ({ lifePct: 30 + 3 * r, manaPct: 30 + 3 * r }) },
    fx: { kind: 'shout', color: 0xffd040 },
    describe: r => `30 秒內最大生命與法力 +${30 + 3 * r}%`,
  },
  {
    id: 'warCry', classId: 'barbarian', tree: 2, name: '戰嚎', unlock: 30, kind: 'attack',
    mana: () => 8, cooldown: 4, element: 'phys', spell: lin(30, 6), aoe: true, stun: 1.5,
    fx: { kind: 'shout', color: 0xffffff },
    describe: r => `震耳欲聾的戰嚎，對所有敵人造成 ${n(lin(30, 6)(r))} 點傷害並暈眩（冷卻 4 秒）`,
  },

  // ── Sorceress: fire ─────────────────────────────────────────────────────
  {
    id: 'fireBolt', classId: 'sorceress', tree: 0, name: '火焰彈', unlock: 1, kind: 'attack',
    mana: () => 2.5, element: 'fire', spell: lin(8, 2.4),
    synergies: [{ from: 'fireball', pct: 10 }, { from: 'meteor', pct: 10 }],
    fx: { kind: 'projectile', color: 0xff8030 },
    describe: r => `射出火焰彈，造成 ${n(lin(8, 2.4)(r))} 點火焰傷害`,
  },
  {
    id: 'warmth', classId: 'sorceress', tree: 0, name: '暖流', unlock: 6, kind: 'passive',
    passive: r => ({ manaRegenPct: 15 * r }),
    fx: { kind: 'aura', color: 0xff9040 },
    describe: r => `法力回復速度 +${15 * r}%`,
  },
  {
    id: 'fireball', classId: 'sorceress', tree: 0, name: '火球', unlock: 12, kind: 'attack',
    mana: () => 5, element: 'fire', spell: lin(18, 5), aoe: true,
    synergies: [{ from: 'fireBolt', pct: 10 }, { from: 'meteor', pct: 10 }],
    fx: { kind: 'projectile', color: 0xff6010 },
    describe: r => `擲出爆裂火球，對所有敵人造成 ${n(lin(18, 5)(r))} 點火焰傷害`,
  },
  {
    id: 'fireWall', classId: 'sorceress', tree: 0, name: '火牆', unlock: 18, kind: 'attack',
    mana: () => 9, cooldown: 3, element: 'fire', spell: lin(30, 8), aoe: true, dotShare: 1, dotSecs: 3,
    synergies: [{ from: 'warmth', pct: 4 }],
    fx: { kind: 'wall', color: 0xff5010 },
    describe: r => `升起火牆，3 秒內對所有敵人造成共 ${n(lin(30, 8)(r))} 點火焰傷害（冷卻 3 秒）`,
  },
  {
    id: 'meteor', classId: 'sorceress', tree: 0, name: '隕石', unlock: 24, kind: 'attack',
    mana: () => 13, cooldown: 3, element: 'fire', spell: lin(45, 12), aoe: true, dotShare: 0.3, dotSecs: 3,
    synergies: [{ from: 'fireBolt', pct: 5 }, { from: 'fireball', pct: 5 }],
    fx: { kind: 'rain', color: 0xff6010 },
    describe: r => `召來隕石，對所有敵人造成 ${n(lin(45, 12)(r))} 點火焰傷害並留下烈焰（冷卻 3 秒）`,
  },
  {
    id: 'fireMastery', classId: 'sorceress', tree: 0, name: '火焰精通', unlock: 30, kind: 'passive',
    passive: r => ({ firePct: 12 * r }),
    fx: { kind: 'aura', color: 0xff6010 },
    describe: r => `火焰傷害 +${12 * r}%`,
  },
  // ── Sorceress: cold ─────────────────────────────────────────────────────
  {
    id: 'iceBolt', classId: 'sorceress', tree: 1, name: '冰彈', unlock: 1, kind: 'attack',
    mana: () => 2, element: 'cold', spell: lin(6, 1.8), chill: 2,
    synergies: [{ from: 'glacialSpike', pct: 8 }, { from: 'frozenOrb', pct: 8 }],
    fx: { kind: 'projectile', color: 0x80c8ff },
    describe: r => `射出冰彈，造成 ${n(lin(6, 1.8)(r))} 點冰冷傷害並使敵人凍傷`,
  },
  {
    id: 'frozenArmor', classId: 'sorceress', tree: 1, name: '冰封裝甲', unlock: 6, kind: 'buff',
    mana: () => 7, cooldown: 60,
    buff: { secs: 60, effect: r => ({ defPct: 40 + 6 * r }) },
    fx: { kind: 'aura', color: 0x80c8ff },
    describe: r => `冰甲護身，60 秒內防禦 +${40 + 6 * r}%`,
  },
  {
    id: 'frostNova', classId: 'sorceress', tree: 1, name: '冰霜新星', unlock: 12, kind: 'attack',
    mana: () => 9, cooldown: 2, element: 'cold', spell: lin(14, 4), aoe: true, chill: 3,
    fx: { kind: 'nova', color: 0x80c8ff },
    describe: r => `冰環擴散，對所有敵人造成 ${n(lin(14, 4)(r))} 點冰冷傷害並凍傷（冷卻 2 秒）`,
  },
  {
    id: 'glacialSpike', classId: 'sorceress', tree: 1, name: '冰尖柱', unlock: 18, kind: 'attack',
    mana: () => 7, element: 'cold', spell: lin(24, 6), stun: 1.5,
    synergies: [{ from: 'iceBolt', pct: 8 }, { from: 'frozenOrb', pct: 5 }],
    fx: { kind: 'projectile', color: 0xb0e8ff },
    describe: r => `射出冰尖柱，造成 ${n(lin(24, 6)(r))} 點冰冷傷害並冰凍敵人`,
  },
  {
    id: 'blizzard', classId: 'sorceress', tree: 1, name: '暴風雪', unlock: 24, kind: 'attack',
    mana: () => 16, cooldown: 3, element: 'cold', spell: lin(50, 13), aoe: true, chill: 3,
    synergies: [{ from: 'iceBolt', pct: 5 }, { from: 'glacialSpike', pct: 5 }],
    fx: { kind: 'rain', color: 0xa0d8ff },
    describe: r => `冰雹傾瀉，對所有敵人造成 ${n(lin(50, 13)(r))} 點冰冷傷害（冷卻 3 秒）`,
  },
  {
    id: 'frozenOrb', classId: 'sorceress', tree: 1, name: '冰封球', unlock: 30, kind: 'attack',
    mana: () => 20, cooldown: 2, element: 'cold', spell: lin(60, 15), aoe: true, chill: 4,
    synergies: [{ from: 'iceBolt', pct: 10 }],
    fx: { kind: 'orb', color: 0xa0e0ff },
    describe: r => `放出旋轉的冰球，碎冰對所有敵人造成 ${n(lin(60, 15)(r))} 點冰冷傷害（冷卻 2 秒）`,
  },
  // ── Sorceress: lightning ────────────────────────────────────────────────
  {
    id: 'chargedBolt', classId: 'sorceress', tree: 2, name: '充能彈', unlock: 1, kind: 'attack',
    mana: () => 3, element: 'light', spell: lin(9, 2.6),
    fx: { kind: 'projectile', color: 0xfff070 },
    describe: r => `放出跳動的電球，造成 ${n(lin(9, 2.6)(r))} 點閃電傷害`,
  },
  {
    id: 'staticField', classId: 'sorceress', tree: 2, name: '靜電力場', unlock: 6, kind: 'attack',
    mana: () => 9, cooldown: 3, element: 'light', staticPct: 0.25, aoe: true,
    fx: { kind: 'nova', color: 0xfff070 },
    describe: () => `使所有敵人失去目前生命的 25%（不會低於三分之一，冷卻 3 秒）`,
  },
  {
    id: 'energyShield', classId: 'sorceress', tree: 2, name: '能量護盾', unlock: 12, kind: 'buff',
    mana: () => 5, cooldown: 10,
    buff: { secs: 0, effect: r => ({ shieldPct: 20 + 3 * r }) },
    fx: { kind: 'aura', color: 0x8080ff },
    describe: r => `張開護盾，吸收最多 ${20 + 3 * r}% 最大生命的傷害（冷卻 10 秒）`,
  },
  {
    id: 'lightning', classId: 'sorceress', tree: 2, name: '閃電', unlock: 18, kind: 'attack',
    mana: () => 8, element: 'light', spell: lin(28, 7),
    synergies: [{ from: 'chargedBolt', pct: 8 }],
    fx: { kind: 'beam', color: 0xfff070 },
    describe: r => `擊出閃電，造成 ${n(lin(28, 7)(r))} 點閃電傷害`,
  },
  {
    id: 'chainLightning', classId: 'sorceress', tree: 2, name: '連鎖閃電', unlock: 24, kind: 'attack',
    mana: () => 10, element: 'light', spell: lin(32, 8), aoe: true,
    synergies: [{ from: 'chargedBolt', pct: 5 }, { from: 'lightning', pct: 5 }],
    fx: { kind: 'beam', color: 0xfff8a0 },
    describe: r => `閃電在敵人間跳躍，對所有敵人造成 ${n(lin(32, 8)(r))} 點閃電傷害`,
  },
  {
    id: 'lightMastery', classId: 'sorceress', tree: 2, name: '閃電精通', unlock: 30, kind: 'passive',
    passive: r => ({ lightPct: 14 * r }),
    fx: { kind: 'aura', color: 0xfff070 },
    describe: r => `閃電傷害 +${14 * r}%`,
  },

  // ── Necromancer: summoning ──────────────────────────────────────────────
  {
    id: 'raiseSkeleton', classId: 'necromancer', tree: 0, name: '骷髏戰士', unlock: 1, kind: 'summon',
    mana: () => 6,
    summon: { kind: 'skeleton', count: armySize, life: lin(30, 3), dmg: lin(4, 0.8) },
    fx: { kind: 'summon', color: 0xe8e0c8 },
    describe: r => `從屍骨中喚起 ${armySize(r)} 名骷髏戰士，每名攻擊 ${n(lin(4, 0.8)(r))}`,
  },
  {
    id: 'skeletonMastery', classId: 'necromancer', tree: 0, name: '骷髏精通', unlock: 6, kind: 'passive',
    passive: r => ({ minionPct: 8 * r }),
    fx: { kind: 'aura', color: 0xe8e0c8 },
    describe: r => `召喚物的生命與傷害 +${8 * r}%`,
  },
  {
    id: 'clayGolem', classId: 'necromancer', tree: 0, name: '黏土魔像', unlock: 12, kind: 'summon',
    mana: () => 15,
    summon: { kind: 'golem', count: () => 1, life: lin(140, 25), dmg: lin(6, 1.2) },
    fx: { kind: 'summon', color: 0xa07850 },
    describe: r => `喚出黏土魔像擋在前方吸引攻擊，生命 ${n(lin(140, 25)(r))}`,
  },
  {
    id: 'skeletalMage', classId: 'necromancer', tree: 0, name: '骷髏法師', unlock: 18, kind: 'summon',
    mana: () => 8,
    summon: { kind: 'mage', count: armySize, life: lin(20, 2), dmg: lin(8, 1.5) },
    fx: { kind: 'summon', color: 0x80c8ff },
    describe: r => `喚起 ${armySize(r)} 名骷髏法師，每名施法 ${n(lin(8, 1.5)(r))}`,
  },
  {
    id: 'bloodGolem', classId: 'necromancer', tree: 0, name: '鮮血魔像', unlock: 24, kind: 'summon',
    mana: () => 25,
    summon: { kind: 'bloodgolem', count: () => 1, life: lin(200, 30), dmg: lin(14, 2.5) },
    fx: { kind: 'summon', color: 0xc01020 },
    describe: r => `以鮮血塑成魔像（取代黏土魔像），攻擊 ${n(lin(14, 2.5)(r))}，並將傷害的 30% 化為你的生命`,
  },
  {
    id: 'revive', classId: 'necromancer', tree: 0, name: '復活', unlock: 30, kind: 'summon',
    mana: () => 30,
    summon: { kind: 'revive', count: r => Math.min(5, 1 + Math.floor(r / 4)), life: lin(120, 15), dmg: lin(20, 3) },
    fx: { kind: 'summon', color: 0xa060ff },
    describe: r => `復活 ${Math.min(5, 1 + Math.floor(r / 4))} 隻倒下的怪物為你而戰，每隻攻擊 ${n(lin(20, 3)(r))}`,
  },
  // ── Necromancer: curses ─────────────────────────────────────────────────
  {
    id: 'amplify', classId: 'necromancer', tree: 1, name: '擴大傷害', unlock: 1, kind: 'curse',
    mana: () => 4,
    curse: { secs: lin(8, 1), effect: r => ({ dmgTakenPct: 30 + 3 * r }) },
    fx: { kind: 'curse', color: 0xc02020 },
    describe: r => `詛咒敵人，受到的傷害 +${30 + 3 * r}%`,
  },
  {
    id: 'weaken', classId: 'necromancer', tree: 1, name: '虛弱', unlock: 6, kind: 'curse',
    mana: () => 4,
    curse: { secs: lin(10, 1), effect: r => ({ foeDmgPct: -(30 + r) }) },
    fx: { kind: 'curse', color: 0x806040 },
    describe: r => `詛咒敵人，造成的傷害 -${30 + r}%`,
  },
  {
    id: 'lifeTap', classId: 'necromancer', tree: 1, name: '生命竊取', unlock: 12, kind: 'curse',
    mana: () => 6,
    curse: { secs: lin(10, 1), effect: r => ({ lifeTapPct: 25 + r }) },
    fx: { kind: 'curse', color: 0xff3050 },
    describe: r => `詛咒敵人，對其造成的傷害有 ${25 + r}% 化為你的生命`,
  },
  {
    id: 'decrepify', classId: 'necromancer', tree: 1, name: '衰老', unlock: 18, kind: 'curse',
    mana: () => 8,
    curse: { secs: lin(6, 0.5), effect: r => ({ dmgTakenPct: 30 + 2 * r, foeDmgPct: -(25 + r), chill: true }) },
    fx: { kind: 'curse', color: 0x8080a0 },
    describe: r => `詛咒敵人：受到的傷害 +${30 + 2 * r}%、造成的傷害 -${25 + r}%、行動遲緩`,
  },
  {
    id: 'ironMaiden', classId: 'necromancer', tree: 1, name: '鋼鐵處女', unlock: 24, kind: 'curse',
    mana: () => 8,
    curse: { secs: lin(10, 1), effect: r => ({ reflectPct: 100 + 25 * r }) },
    fx: { kind: 'curse', color: 0xa0a0b0 },
    describe: r => `詛咒敵人，它造成的傷害有 ${100 + 25 * r}% 反彈到自己身上`,
  },
  {
    id: 'lowerRes', classId: 'necromancer', tree: 1, name: '降低抗性', unlock: 30, kind: 'curse',
    mana: () => 10,
    curse: { secs: lin(12, 1), effect: r => ({ resMinus: 30 + 3 * r, dmgTakenPct: 10 }) },
    fx: { kind: 'curse', color: 0xa040ff },
    describe: r => `詛咒敵人，元素抗性 -${30 + 3 * r}%（足以打破免疫）`,
  },
  // ── Necromancer: poison and bone ────────────────────────────────────────
  {
    id: 'teeth', classId: 'necromancer', tree: 2, name: '牙', unlock: 1, kind: 'attack',
    mana: () => 3, element: 'magic', spell: lin(8, 2.2),
    synergies: [{ from: 'boneSpear', pct: 8 }, { from: 'boneSpirit', pct: 8 }],
    fx: { kind: 'projectile', color: 0xe8e0c8 },
    describe: r => `射出一串利牙，造成 ${n(lin(8, 2.2)(r))} 點魔法傷害`,
  },
  {
    id: 'boneArmor', classId: 'necromancer', tree: 2, name: '骨甲', unlock: 6, kind: 'buff',
    mana: () => 11, cooldown: 12,
    buff: { secs: 0, effect: r => ({ shieldPct: 25 + 4 * r }) },
    fx: { kind: 'aura', color: 0xe8e0c8 },
    describe: r => `骸骨環繞，吸收最多 ${25 + 4 * r}% 最大生命的傷害（冷卻 12 秒）`,
  },
  {
    id: 'corpseExplosion', classId: 'necromancer', tree: 2, name: '屍爆', unlock: 12, kind: 'attack',
    mana: () => 10, cooldown: 2, element: 'fire', corpsePct: lin(0.5, 0.03), aoe: true,
    fx: { kind: 'burst', color: 0xff7030 },
    describe: r => `引爆最近的屍體，對所有敵人造成屍體生命 ${pct(lin(0.5, 0.03)(r))} 的傷害（需要屍體，冷卻 2 秒）`,
  },
  {
    id: 'boneSpear', classId: 'necromancer', tree: 2, name: '骨矛', unlock: 18, kind: 'attack',
    mana: () => 7, element: 'magic', spell: lin(28, 7),
    synergies: [{ from: 'teeth', pct: 7 }, { from: 'boneSpirit', pct: 7 }],
    fx: { kind: 'projectile', color: 0xf0e8d0 },
    describe: r => `擲出骨矛，造成 ${n(lin(28, 7)(r))} 點魔法傷害`,
  },
  {
    id: 'poisonNova', classId: 'necromancer', tree: 2, name: '毒新星', unlock: 24, kind: 'attack',
    mana: () => 20, cooldown: 4, element: 'poison', spell: lin(70, 18), aoe: true, dotShare: 1, dotSecs: 4,
    fx: { kind: 'nova', color: 0x60e040 },
    describe: r => `毒霧擴散，4 秒內對所有敵人造成共 ${n(lin(70, 18)(r))} 點毒素傷害（冷卻 4 秒）`,
  },
  {
    id: 'boneSpirit', classId: 'necromancer', tree: 2, name: '骨靈', unlock: 30, kind: 'attack',
    mana: () => 12, cooldown: 1, element: 'magic', spell: lin(70, 16),
    synergies: [{ from: 'teeth', pct: 6 }, { from: 'boneSpear', pct: 6 }],
    fx: { kind: 'orb', color: 0xf0f0ff },
    describe: r => `放出追蹤的骨靈，造成 ${n(lin(70, 16)(r))} 點魔法傷害（冷卻 1 秒）`,
  },
]

/** The plain swing every class has, never learned. */
export const BASIC_ATTACK: SkillDef = {
  id: 'attack',
  classId: 'barbarian',
  tree: 0,
  name: '普通攻擊',
  unlock: 1,
  kind: 'attack',
  element: 'phys',
  phys: () => 1,
  fx: { kind: 'melee', color: 0xffffff },
  describe: () => '用手上的武器揮擊',
}

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(SKILL_LIST.map(s => [s.id, s]))

export const skillOf = (id: string): SkillDef => SKILLS[id] ?? BASIC_ATTACK

export const classSkills = (classId: ClassId, tree?: number) =>
  SKILL_LIST.filter(s => s.classId === classId && (tree === undefined || s.tree === tree))
