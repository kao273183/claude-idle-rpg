import type { GearKind, SetId, Slot, Stats } from '../types'

/** A legendary power, in the same terms as talents (see talents.ts). */
export type Power = Record<string, number>

// ── Where gear goes ────────────────────────────────────────────────────────
export const GEAR_KINDS: readonly GearKind[] = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'belt', 'boots', 'amulet', 'ring']

/** How often each kind drops, against the others. */
export const KIND_WEIGHTS: Record<GearKind, number> = {
  weapon: 14, offhand: 9, helm: 11, armor: 12, gloves: 10, belt: 9, boots: 10, amulet: 7, ring: 12,
}

// ── Bases: families, each in three grades ──────────────────────────────────
export const GRADE_NAMES = ['普通', '擴充', '菁英'] as const

export type BaseFamily = {
  id: string
  kind: GearKind
  /** The base's name at each grade. */
  names: readonly [string, string, string]
  /** What the base itself gives, flat stats a multiple of the item's power. */
  stats: (power: number, grade: number) => Stats
  /** Strength asked, relative to a weapon of the same depth. */
  req: number
  sockets: number
}

const g = (grade: number, by: readonly number[]) => by[grade] ?? by[by.length - 1]!

export const BASE_FAMILIES: BaseFamily[] = [
  { id: 'sword', kind: 'weapon', names: ['短劍', '彎刀', '幻影之刃'], stats: p => ({ atk: Math.round(3 * p) }), req: 1, sockets: 4 },
  { id: 'axe', kind: 'weapon', names: ['手斧', '戰斧', '狂戰斧'], stats: p => ({ atk: Math.round(3.4 * p), crit: 2 }), req: 1.3, sockets: 4 },
  { id: 'mace', kind: 'weapon', names: ['權杖', '戰錘', '雷神之錘'], stats: p => ({ atk: Math.round(3.2 * p), res: 5 }), req: 1.2, sockets: 4 },
  { id: 'staff', kind: 'weapon', names: ['短杖', '長杖', '大法師之杖'], stats: (p, gr) => ({ atk: Math.round(1.8 * p), spell: g(gr, [10, 20, 30]) }), req: 0.5, sockets: 4 },
  { id: 'wand', kind: 'weapon', names: ['魔杖', '骨杖', '墳墓之杖'], stats: (p, gr) => ({ atk: Math.round(1.6 * p), minion: g(gr, [10, 20, 30]) }), req: 0.4, sockets: 2 },
  { id: 'shield', kind: 'offhand', names: ['小圓盾', '鳶盾', '巨塔盾'], stats: (p, gr) => ({ def: Math.round(2.4 * p), block: g(gr, [10, 15, 20]) }), req: 1.1, sockets: 4 },
  { id: 'orb', kind: 'offhand', names: ['水晶球', '日蝕之珠', '永恆之珠'], stats: (_p, gr) => ({ spell: g(gr, [8, 15, 22]), mana: g(gr, [20, 40, 60]) }), req: 0.3, sockets: 2 },
  { id: 'head', kind: 'offhand', names: ['縮小頭顱', '惡魔頭顱', '巫毒頭顱'], stats: (p, gr) => ({ def: Math.round(1.2 * p), minion: g(gr, [8, 15, 22]) }), req: 0.4, sockets: 2 },
  { id: 'helm', kind: 'helm', names: ['頭盔', '骨盔', '惡魔角盔'], stats: p => ({ def: Math.round(1.5 * p) }), req: 0.7, sockets: 2 },
  { id: 'crown', kind: 'helm', names: ['寶冠', '巨冠', '神聖之冠'], stats: p => ({ def: Math.round(1.2 * p) }), req: 0.8, sockets: 3 },
  { id: 'light', kind: 'armor', names: ['皮甲', '魔皮甲', '暗影斗篷'], stats: p => ({ def: Math.round(1.6 * p), hp: Math.round(8 * p) }), req: 0.5, sockets: 3 },
  { id: 'medium', kind: 'armor', names: ['鎖子甲', '鏈甲', '聖騎鎖甲'], stats: p => ({ def: Math.round(2 * p), hp: Math.round(10 * p) }), req: 1, sockets: 4 },
  { id: 'heavy', kind: 'armor', names: ['板甲', '哥德板甲', '聖堂板甲'], stats: p => ({ def: Math.round(2.6 * p), hp: Math.round(12 * p) }), req: 1.5, sockets: 4 },
  { id: 'gloves', kind: 'gloves', names: ['皮手套', '鋼鐵護手', '龍鱗手套'], stats: (p, gr) => ({ def: Math.round(0.8 * p), crit: g(gr, [2, 3, 4]) }), req: 0.5, sockets: 0 },
  { id: 'belt', kind: 'belt', names: ['腰帶', '戰鬥腰帶', '巨龍腰帶'], stats: p => ({ def: Math.round(0.6 * p), hp: Math.round(6 * p) }), req: 0.5, sockets: 0 },
  { id: 'boots', kind: 'boots', names: ['皮靴', '戰靴', '神行靴'], stats: (p, gr) => ({ def: Math.round(0.8 * p), res: g(gr, [5, 8, 12]) }), req: 0.5, sockets: 0 },
  { id: 'amulet', kind: 'amulet', names: ['項鍊', '項鍊', '項鍊'], stats: () => ({}), req: 0, sockets: 0 },
  { id: 'ring', kind: 'ring', names: ['戒指', '戒指', '戒指'], stats: () => ({}), req: 0, sockets: 1 },
]

/** A base's grade at a depth: exceptional from the mid acts, elite toward the end of nightmare and on. */
export const rollGrade = (zone: number, rng: () => number) => {
  const elite = Math.max(0, Math.min(0.7, (zone - 30) / 30))
  const exceptional = Math.max(0, Math.min(0.8, (zone - 10) / 20))
  const r = rng()

  return r < elite ? 2 : r < elite + exceptional * (1 - elite) ? 1 : 0
}

export const GRADE_POWER = [1, 1.15, 1.3] as const

/** How much of an item's power each kind carries: the weapon and the armour most, the trinkets least. */
export const KIND_POWER: Record<GearKind, number> = {
  weapon: 1, armor: 1, offhand: 0.7, helm: 0.7, gloves: 0.5, belt: 0.5, boots: 0.5, amulet: 0.5, ring: 0.5,
}

// ── Uniques: fixed names, fixed stats, and some a legendary power ─────────
export type UniqueDef = {
  name: string
  family: string
  stats: (power: number) => Stats
  power?: Power
  /** The power, in words. */
  legend?: string
}

export const UNIQUES: UniqueDef[] = [
  // Weapons
  { name: '碎魂者', family: 'axe', stats: p => ({ atk: Math.round(1.6 * p), crit: 8 }), power: { lowLifeDmg: 30 }, legend: '生命低於 50% 時傷害 +30%' },
  { name: '弒神者', family: 'sword', stats: p => ({ atk: Math.round(1.8 * p) }), power: { critDmg: 50 }, legend: '爆擊傷害 +50%' },
  { name: '霜之哀傷', family: 'sword', stats: p => ({ atk: Math.round(1.5 * p), res: 15 }), power: { chilledBonus: 25, coldPct: 20 }, legend: '對凍傷敵人傷害 +25%、冰冷傷害 +20%' },
  { name: '血月之誓', family: 'sword', stats: p => ({ atk: Math.round(1.4 * p), ls: 8 }), power: { execute: 40 }, legend: '對生命低於 30% 的敵人傷害 +40%' },
  { name: '雷鳴之錘', family: 'mace', stats: p => ({ atk: Math.round(1.6 * p) }), power: { lightPct: 30, splash: 25 }, legend: '閃電傷害 +30%，單體攻擊波及全場 25%' },
  { name: '大法師之怒', family: 'staff', stats: () => ({ spell: 40, skills: 2 }), power: { manaRegenPct: 50 }, legend: '法力回復 +50%' },
  { name: '亡者低語', family: 'wand', stats: () => ({ minion: 40, skills: 2 }), power: { minionLeech: 2 }, legend: '僕從傷害 2% 化為你的生命' },
  // Off hands
  { name: '暴風之盾', family: 'shield', stats: p => ({ def: Math.round(2 * p), block: 15, res: 25 }), power: { dr: 8 }, legend: '受到的物理傷害 -8%' },
  { name: '混沌之眼', family: 'orb', stats: () => ({ spell: 25, mana: 80 }), power: { firePct: 20, coldPct: 20, lightPct: 20 }, legend: '火焰、冰冷、閃電傷害各 +20%' },
  { name: '死神之顱', family: 'head', stats: p => ({ minion: 35, def: Math.round(p) }), power: { minionExplode: 30 }, legend: '僕從倒下時爆炸，造成其生命 30% 的傷害' },
  // Helms
  { name: '戰神之冠', family: 'crown', stats: p => ({ skills: 2, hp: Math.round(15 * p) }), power: {}, legend: undefined },
  { name: '惡魔王冠', family: 'helm', stats: p => ({ def: Math.round(2 * p), crit: 6, ls: 4 }), power: { lowLifeDmg: 20 }, legend: '生命低於 50% 時傷害 +20%' },
  { name: '無面者之盔', family: 'helm', stats: p => ({ def: Math.round(2 * p), res: 20, mf: 25 }) },
  { name: '亡王的骨冠', family: 'crown', stats: () => ({ minion: 25, skills: 1 }), power: { extraMinions: 1 }, legend: '骷髏戰士與骷髏法師各多 1 名' },
  // Armour
  { name: '永夜之殼', family: 'heavy', stats: p => ({ def: Math.round(3 * p), hp: Math.round(20 * p), res: 15 }) },
  { name: '屠夫的圍裙', family: 'light', stats: p => ({ hp: Math.round(25 * p), ls: 6 }), power: { onKillHeal: 3 }, legend: '每次擊殺回復 3% 生命與法力' },
  { name: '不朽之甲', family: 'heavy', stats: p => ({ def: Math.round(4 * p), hp: Math.round(15 * p) }), power: { cheatDeath: 20 }, legend: '受到致命傷時以 20% 生命存活（每 60 秒一次）' },
  { name: '深淵披風', family: 'medium', stats: p => ({ def: Math.round(2 * p), spell: 20 }), power: { manaShield: 15 }, legend: '受到的傷害有 15% 由法力承受' },
  // Gloves, belts, boots
  { name: '吸血鬼之握', family: 'gloves', stats: () => ({ ls: 6, crit: 5 }) },
  { name: '法師之手', family: 'gloves', stats: () => ({ spell: 15 }), power: { manaRegenPct: 40 }, legend: '法力回復 +40%' },
  { name: '屠戮之手', family: 'gloves', stats: p => ({ atk: Math.round(p) }), power: { critDmg: 40 }, legend: '爆擊傷害 +40%' },
  { name: '巨人腰帶', family: 'belt', stats: p => ({ hp: Math.round(30 * p), res: 10 }), power: { potionPct: 50 }, legend: '藥水回復量 +50%' },
  { name: '吸魂束帶', family: 'belt', stats: p => ({ hp: Math.round(15 * p) }), power: { onKillHeal: 4 }, legend: '每次擊殺回復 4% 生命與法力' },
  { name: '戰爭旅者', family: 'boots', stats: () => ({ mf: 40, gf: 40 }) },
  { name: '沙暴之步', family: 'boots', stats: () => ({ res: 30 }), power: { dr: 5 }, legend: '受到的物理傷害 -5%' },
  // Jewellery
  { name: '萬花筒', family: 'amulet', stats: () => ({ skills: 2, res: 20 }) },
  { name: '先祖之眼', family: 'amulet', stats: () => ({ mf: 30, crit: 5 }) },
  { name: '狂人之心', family: 'amulet', stats: () => ({ crit: 8 }), power: { dmgPct: 20, lifePct: -10 }, legend: '所有傷害 +20%，但最大生命 -10%' },
  { name: '深淵之眼', family: 'ring', stats: () => ({ ls: 5, crit: 4 }) },
  { name: '喬丹之石', family: 'ring', stats: () => ({ skills: 1, mana: 40 }) },
  { name: '渡鴉之霜', family: 'ring', stats: () => ({ res: 20 }), power: { chilledBonus: 20 }, legend: '對凍傷敵人傷害 +20%' },
  { name: '殞落之星', family: 'ring', stats: () => ({ spell: 15, crit: 3 }) },
]

// ── Sets: three for anyone, one for each class ─────────────────────────────
/** A set's bonus at a piece count: flat stats, percentages of the hero's totals, a legendary power. */
export type SetBonus = { stats?: Stats; atkPct?: number; defPct?: number; hpPct?: number; power?: Power; legend?: string }

export type SetDef = {
  name: string
  /** Who it was made for, if anyone. */
  forClass?: 'barbarian' | 'sorceress' | 'necromancer'
  pieces: Partial<Record<GearKind, { name: string; family: string }>>
  favored: (keyof Stats)[]
  bonuses: Record<number, SetBonus>
}

export const SETS: Record<SetId, SetDef> = {
  night: {
    name: '夜行者的遺物',
    pieces: {
      weapon: { name: '夜行者之牙', family: 'sword' },
      armor: { name: '夜行者斗篷', family: 'light' },
      helm: { name: '夜行者面具', family: 'helm' },
      ring: { name: '夜行者印記', family: 'ring' },
    },
    favored: ['crit', 'atk'],
    bonuses: { 2: { stats: { crit: 5 } }, 3: { atkPct: 15 }, 4: { stats: { crit: 10 }, atkPct: 25 } },
  },
  oath: {
    name: '聖騎士的誓言',
    pieces: {
      weapon: { name: '誓約之錘', family: 'mace' },
      armor: { name: '聖盾胸甲', family: 'heavy' },
      helm: { name: '光耀頭冠', family: 'crown' },
      offhand: { name: '救贖之盾', family: 'shield' },
    },
    favored: ['def', 'hp'],
    bonuses: { 2: { defPct: 20 }, 3: { hpPct: 20 }, 4: { defPct: 30, hpPct: 30, stats: { res: 25 } } },
  },
  greed: {
    name: '貪婪之王',
    pieces: {
      amulet: { name: '金權項鍊', family: 'amulet' },
      ring: { name: '貪婪之戒', family: 'ring' },
      gloves: { name: '點金之手', family: 'gloves' },
      boots: { name: '黃金之路', family: 'boots' },
    },
    favored: ['gf', 'mf'],
    bonuses: { 2: { stats: { gf: 30 } }, 3: { stats: { mf: 50 } }, 4: { stats: { gf: 100, mf: 50 }, hpPct: 20 } },
  },
  immortal: {
    name: '不朽之王',
    forClass: 'barbarian',
    pieces: {
      weapon: { name: '不朽之王的石碎', family: 'axe' },
      helm: { name: '不朽之王的意志', family: 'helm' },
      armor: { name: '不朽之王的靈魂牢籠', family: 'heavy' },
      gloves: { name: '不朽之王的鍛造', family: 'gloves' },
      belt: { name: '不朽之王的迷惑', family: 'belt' },
      boots: { name: '不朽之王的步伐', family: 'boots' },
    },
    favored: ['atk', 'hp', 'crit'],
    bonuses: {
      2: { stats: { crit: 5 } },
      4: { atkPct: 30, defPct: 30 },
      6: { stats: { skills: 2 }, power: { splash: 50 }, legend: '單體攻擊波及全場 50%' },
    },
  },
  tal: {
    name: '塔拉夏的外袍',
    forClass: 'sorceress',
    pieces: {
      offhand: { name: '塔拉夏的寶珠', family: 'orb' },
      amulet: { name: '塔拉夏的判決', family: 'amulet' },
      armor: { name: '塔拉夏的守護', family: 'light' },
      belt: { name: '塔拉夏的織帶', family: 'belt' },
      helm: { name: '塔拉夏的面具', family: 'crown' },
      gloves: { name: '塔拉夏的觸手', family: 'gloves' },
    },
    favored: ['spell', 'res', 'mf'],
    bonuses: {
      2: { stats: { res: 20 } },
      4: { stats: { spell: 30 }, power: { cdr: 20 }, legend: '技能冷卻 -20%' },
      6: { stats: { skills: 2 }, power: { fusion: 1, dmgPct: 40 }, legend: '火焰法術也會凍傷，所有傷害 +40%' },
    },
  },
  trang: {
    name: '屍王的化身',
    forClass: 'necromancer',
    pieces: {
      offhand: { name: '屍王的頭顱', family: 'head' },
      helm: { name: '屍王的面容', family: 'helm' },
      armor: { name: '屍王的鱗甲', family: 'medium' },
      gloves: { name: '屍王的爪', family: 'gloves' },
      belt: { name: '屍王的腰帶', family: 'belt' },
      boots: { name: '屍王的足跡', family: 'boots' },
    },
    favored: ['minion', 'hp', 'res'],
    bonuses: {
      2: { stats: { minion: 20 } },
      4: { power: { extraMinions: 2 }, legend: '骷髏戰士與骷髏法師各多 2 名' },
      6: { stats: { skills: 2 }, power: { minionExplode: 60, minionLeech: 5 }, legend: '僕從倒下時爆炸 60%，僕從傷害 5% 化為你的生命' },
    },
  },
}

export const SET_IDS = Object.keys(SETS) as SetId[]

/** Where in the gear each slot's items come from: the second ring takes rings. */
export const kindOfSlot = (slot: Slot): GearKind => (slot === 'ring2' ? 'ring' : slot)
