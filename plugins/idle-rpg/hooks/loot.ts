import type {
  Character as Save,
  CharmSize,
  GearKind,
  Equipment,
  Gem,
  GemGrade,
  GemPouch,
  GemType,
  Item,
  ItemSlot,
  Rarity,
  SetId,
  Slot,
  Stats,
} from '../types'

import {
  BASE_FAMILIES,
  GEAR_KINDS,
  GRADE_NAMES as BASE_GRADES,
  GRADE_POWER,
  KIND_POWER,
  kindOfSlot,
  KIND_WEIGHTS,
  rollGrade,
  SET_IDS,
  SETS,
  UNIQUES,
} from './items'
import type { Power, SetBonus } from './items'

export { SETS }
export type { SetBonus }

type Rng = () => number

export const BAG_SIZE = 12
export const SLOTS: readonly Slot[] = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'belt', 'boots', 'amulet', 'ring', 'ring2']
export const SLOT_NAMES: Record<ItemSlot | Slot, string> = {
  weapon: '武器',
  offhand: '副手',
  helm: '頭盔',
  armor: '護甲',
  gloves: '手套',
  belt: '腰帶',
  boots: '鞋子',
  amulet: '項鍊',
  ring: '戒指',
  ring2: '戒指',
  charm: '護身符',
}

export const RARITIES: Record<Rarity, { name: string; color: string; pixel: number; rank: number }> = {
  0: { name: '普通', color: '#c8c8c8', pixel: 0xc8c8c8, rank: 0 },
  1: { name: '魔法', color: '#7070ff', pixel: 0x7070ff, rank: 1 },
  2: { name: '稀有', color: '#ffff64', pixel: 0xffff64, rank: 2 },
  3: { name: '暗金', color: '#d4a84b', pixel: 0xd4a84b, rank: 4 },
  4: { name: '套裝', color: '#30d030', pixel: 0x30d030, rank: 3 },
  5: { name: '符文之語', color: '#e8c060', pixel: 0xe8c060, rank: 4 },
}

export const STAT_NAMES: Record<keyof Stats, string> = {
  atk: '攻擊',
  def: '防禦',
  hp: '生命',
  crit: '爆擊',
  gf: '金幣尋獲',
  res: '全抗性',
  mf: '魔法尋獲',
  ls: '生命竊取',
  skills: '所有技能',
  block: '格擋',
  spell: '法術傷害',
  minion: '召喚物',
  mana: '法力',
}
export const STAT_KEYS = Object.keys(STAT_NAMES) as (keyof Stats)[]
const isPercent = (key: keyof Stats) => key !== 'atk' && key !== 'def' && key !== 'hp' && key !== 'skills' && key !== 'mana'
export const emptyStats = (): Required<Stats> => ({ atk: 0, def: 0, hp: 0, crit: 0, gf: 0, res: 0, mf: 0, ls: 0, skills: 0, block: 0, spell: 0, minion: 0, mana: 0 })

export const emptyEquipment = (): Equipment => ({
  weapon: null,
  offhand: null,
  helm: null,
  armor: null,
  gloves: null,
  belt: null,
  boots: null,
  amulet: null,
  ring: null,
  ring2: null,
})

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]!

// ── Drop tables: the one source for both the rolls and the odds shown ─────
/** Who fell: a plain monster, a champion, a unique, or an act boss. */
export type DropTier = 'normal' | 'champion' | 'unique' | 'boss'
export const DROP_TIERS: DropTier[] = ['normal', 'champion', 'unique', 'boss']
export const DROP_TIER_NAMES: Record<DropTier, string> = { normal: '一般怪物', champion: '菁英（藍名）', unique: '頭目（金名）', boss: '幕首領' }

export const ITEM_DROP_CHANCE: Record<DropTier, number> = { normal: 0.07, champion: 0.3, unique: 0.75, boss: 1 }
export const GEM_DROP_CHANCE: Record<DropTier, number> = { normal: 0.03, champion: 0.12, unique: 0.3, boss: 0.8 }
/** Of the items that drop, this share are charms. */
export const CHARM_SHARE = 0.1
/** Act bosses drop this many items. */
export const BOSS_DROPS = 3

/** Of the items that drop, the share of each rarity, best first, before magic find. */
export const RARITY_TABLE: Record<DropTier, readonly [Rarity, number][]> = {
  normal: [[3, 0.01], [4, 0.02], [2, 0.07], [1, 0.3], [0, 0.6]],
  champion: [[3, 0.03], [4, 0.05], [2, 0.17], [1, 0.45], [0, 0.3]],
  unique: [[3, 0.06], [4, 0.08], [2, 0.26], [1, 0.45], [0, 0.15]],
  boss: [[3, 0.12], [4, 0.15], [2, 0.35], [1, 0.3], [0, 0.08]],
}

/**
 * Magic find as the old game had it: every bit helps magic items fully, but
 * its pull on rares, sets and uniques fades the more of it there is.
 */
const mfFactor = (rarity: Rarity, mf: number) => {
  if (mf <= 0) return 1
  const soft = rarity === 3 ? 250 : rarity === 4 ? 500 : rarity === 2 ? 600 : 0
  const effective = soft === 0 ? mf : (mf * soft) / (mf + soft)

  return rarity === 0 ? 1 : 1 + effective / 100
}

/** The rarity shares after magic find: the better rarities grow, plain items take what is left. */
export const rarityShares = (tier: DropTier, mf = 0): [Rarity, number][] => {
  let total = 0
  const shares: [Rarity, number][] = []
  for (const [rarity, share] of RARITY_TABLE[tier]) {
    if (rarity === 0) continue
    const s = Math.min(1 - total, share * mfFactor(rarity, mf))
    shares.push([rarity, s])
    total += s
  }
  shares.push([0, Math.max(0, 1 - total)])

  return shares
}

export const rollRarity = (tier: DropTier, rng: Rng, mf = 0): Rarity => {
  let r = rng()
  for (const [rarity, share] of rarityShares(tier, mf)) {
    if (r < share) return rarity
    r -= share
  }

  return 0
}

/** Each rarity's chance per kill, for the odds table, with the hero's magic find. */
export const dropOdds = (tier: DropTier, mf = 0) => {
  const item = ITEM_DROP_CHANCE[tier]

  return {
    item,
    gem: GEM_DROP_CHANCE[tier],
    rarities: rarityShares(tier, mf).map(([rarity, share]) => ({ rarity, chance: share * item * (1 - CHARM_SHARE) })),
    charm: item * CHARM_SHARE,
  }
}

// ── Affixes: prefixes and suffixes, each four tiers deep ──────────────────
type AffixDef = {
  kind: 'prefix' | 'suffix'
  stat: keyof Stats
  names: readonly [string, string, string, string]
  /** Flat stats: this times the item's power. */
  flat?: number
  /** Percentages and the like: a range for each tier. */
  ranges?: readonly (readonly [number, number])[]
  slots?: readonly GearKind[]
  /** How often it rolls, against the others. */
  weight?: number
}

export const AFFIX_TABLE: AffixDef[] = [
  { kind: 'prefix', stat: 'atk', names: ['鋒利的', '殘暴的', '嗜血的', '野蠻的'], flat: 2, slots: ['weapon', 'ring', 'gloves', 'amulet'] },
  { kind: 'prefix', stat: 'def', names: ['堅固的', '強化的', '守護的', '神聖的'], flat: 1.5, slots: ['armor', 'helm', 'offhand', 'gloves', 'belt', 'boots'] },
  { kind: 'prefix', stat: 'spell', names: ['術士的', '秘法的', '大法師的', '禁忌的'], ranges: [[5, 8], [9, 13], [14, 19], [20, 28]], slots: ['weapon', 'offhand', 'helm', 'amulet', 'ring'] },
  { kind: 'prefix', stat: 'res', names: ['五彩的', '稜鏡的', '虹光的', '極光的'], ranges: [[5, 8], [9, 13], [14, 19], [20, 26]] },
  { kind: 'prefix', stat: 'mf', names: ['幸運的', '好運的', '天佑的', '命運的'], ranges: [[5, 10], [10, 18], [18, 28], [28, 40]] },
  { kind: 'prefix', stat: 'skills', names: ['學徒的', '巫師的', '大師的', '傳奇的'], ranges: [[1, 1], [1, 1], [1, 2], [2, 2]], slots: ['weapon', 'offhand', 'helm', 'amulet', 'ring'], weight: 0.3 },
  { kind: 'suffix', stat: 'hp', names: ['之狐', '之狼', '之熊', '之鯨'], flat: 12 },
  { kind: 'suffix', stat: 'crit', names: ['之刺', '之毒牙', '之毀滅', '之屠戮'], ranges: [[2, 3], [3, 5], [5, 7], [7, 10]] },
  { kind: 'suffix', stat: 'gf', names: ['之貪婪', '之黃金', '之財富', '之帝王'], ranges: [[10, 20], [20, 35], [35, 55], [55, 80]] },
  { kind: 'suffix', stat: 'ls', names: ['之水蛭', '之蝙蝠', '之吸血鬼', '之血族'], ranges: [[2, 3], [3, 5], [5, 7], [7, 9]], slots: ['weapon', 'ring', 'gloves', 'amulet'] },
  { kind: 'suffix', stat: 'minion', names: ['之骨', '之墓', '之亡魂', '之死神'], ranges: [[5, 8], [9, 13], [14, 19], [20, 28]], slots: ['weapon', 'offhand', 'helm', 'amulet'] },
]

const TIER_FLAT = [0.6, 0.9, 1.2, 1.6]

/** The deepest affix tier a zone can roll: one more every eight areas. */
export const maxAffixTier = (zone: number) => Math.min(3, Math.floor(zone / 8))

const rollTier = (zone: number, rng: Rng) => {
  const top = maxAffixTier(zone)

  return rng() < 0.6 ? top : Math.max(0, top - 1 - Math.floor(rng() * 2))
}

const rollAffixValue = (a: AffixDef, tier: number, power: number, rng: Rng) => {
  if (a.flat !== undefined) return Math.max(1, Math.round(a.flat * power * TIER_FLAT[tier]! * (0.85 + rng() * 0.3)))
  const [lo, hi] = a.ranges![tier]!

  return Math.round(lo + rng() * (hi - lo))
}

const pickAffix = (slot: GearKind | 'charm', kind: AffixDef['kind'] | undefined, taken: AffixDef[], rng: Rng) => {
  const pool = AFFIX_TABLE.filter(
    a => (!kind || a.kind === kind) && !taken.includes(a) && (slot === 'charm' || !a.slots || a.slots.includes(slot)),
  )
  const total = pool.reduce((sum, a) => sum + (a.weight ?? 1), 0)
  let r = rng() * total
  for (const a of pool) {
    r -= a.weight ?? 1
    if (r <= 0) return a
  }

  return pool[pool.length - 1]
}

// ── Items ──────────────────────────────────────────────────────────────────
const RARE_FIRST = ['血', '骸', '魂', '暗', '怨', '屍', '冥', '咒']
const RARE_SECOND = ['噬', '痕', '牙', '印', '契', '淵', '火', '影']

const AFFIX_COUNT: Record<Rarity, [number, number]> = { 0: [0, 0], 1: [1, 2], 2: [3, 5], 3: [1, 2], 4: [2, 3], 5: [0, 0] }
const RARITY_POWER: Record<Rarity, number> = { 0: 1, 1: 1.1, 2: 1.25, 3: 1.6, 4: 1.35, 5: 1 }

/** The most sockets each slot takes; a base may take fewer. */
export const SOCKET_MAX: Record<Slot, number> = {
  weapon: 4, offhand: 4, helm: 3, armor: 4, gloves: 0, belt: 0, boots: 0, amulet: 0, ring: 1, ring2: 1,
}
/** Socket odds by rarity: no socket, then 1, 2, 3, 4. Plain items hold the most. */
const SOCKET_TABLE: Record<Rarity, readonly number[]> = {
  0: [0.35, 0.2, 0.2, 0.15, 0.1],
  1: [0.6, 0.25, 0.15, 0, 0],
  2: [0.75, 0.25, 0, 0, 0],
  3: [0.8, 0.2, 0, 0, 0],
  4: [1, 0, 0, 0, 0],
  5: [1, 0, 0, 0, 0],
}

const rollSockets = (most: number, rarity: Rarity, rng: Rng) => {
  let r = rng()
  let sockets = 0
  for (const [count, share] of SOCKET_TABLE[rarity].entries()) {
    if (r < share) {
      sockets = count
      break
    }
    r -= share
  }

  return Math.min(most, sockets)
}

/** An item's power at a depth: what its flat stats are multiples of. */
export const powerAt = (zone: number) => Math.pow(1.28, zone)

export const rollDrop = (zone: number, tier: DropTier, id: number, rng: Rng, mf = 0): Item | null => {
  if (rng() >= ITEM_DROP_CHANCE[tier]) return null
  if (rng() < CHARM_SHARE) return makeCharm(zone, id, rng)

  return makeItem(zone, rollRarity(tier, rng, mf), id, rng)
}

const pickKind = (rng: Rng): GearKind => {
  const total = GEAR_KINDS.reduce((sum, k) => sum + KIND_WEIGHTS[k], 0)
  let r = rng() * total
  for (const k of GEAR_KINDS) {
    r -= KIND_WEIGHTS[k]
    if (r <= 0) return k
  }

  return 'weapon'
}

const familyOf = (id: string) => BASE_FAMILIES.find(f => f.id === id)!

export const makeItem = (zone: number, rarity: Rarity, id: number, rng: Rng, onlySlot?: Slot): Item => {
  // What it is: a set piece or a unique decides its own kind and base.
  const set = rarity === 4 ? pick(SET_IDS, rng) : undefined
  const setPieces = set ? (Object.entries(SETS[set].pieces) as [GearKind, { name: string; family: string }][]) : []
  const wanted = onlySlot ? kindOfSlot(onlySlot) : undefined
  const setPiece = set ? (setPieces.find(([k]) => k === wanted) ?? pick(setPieces, rng)) : undefined
  const uniquePool = rarity === 3 ? UNIQUES.filter(u => !wanted || familyOf(u.family).kind === wanted) : []
  const unique = rarity === 3 && uniquePool.length > 0 ? pick(uniquePool, rng) : undefined
  const kind: GearKind = setPiece?.[0] ?? (unique ? familyOf(unique.family).kind : (wanted ?? pickKind(rng)))
  const family = setPiece ? familyOf(setPiece[1].family) : unique ? familyOf(unique.family) : pick(BASE_FAMILIES.filter(f => f.kind === kind), rng)
  const grade = rollGrade(zone, rng)
  const power = powerAt(zone) * RARITY_POWER[rarity] * GRADE_POWER[grade]! * KIND_POWER[kind]
  const stats: Stats = {}
  const add = (stat: keyof Stats, value: number) => {
    stats[stat] = (stats[stat] ?? 0) + value
  }

  // The base: what the item is gives first.
  for (const [k, v] of Object.entries(family.stats(power * (0.9 + rng() * 0.2), grade)) as [keyof Stats, number][]) add(k, v)
  if (unique) for (const [k, v] of Object.entries(unique.stats(power)) as [keyof Stats, number][]) add(k, v)

  const [least, most] = AFFIX_COUNT[rarity]
  const count = least + Math.floor(rng() * (most - least + 1))
  const taken: AffixDef[] = []
  let prefix: string | undefined
  let suffix: string | undefined
  for (let i = 0; i < count; i++) {
    // A magic item has at most one of each kind; a set piece leans toward its set's stats.
    const affixKind = rarity === 1 ? (i === 0 ? (rng() < 0.5 ? 'prefix' : 'suffix') : taken[0]?.kind === 'prefix' ? 'suffix' : 'prefix') : undefined
    const favored = set && rng() < 0.7 ? AFFIX_TABLE.filter(a => SETS[set].favored.includes(a.stat) && !taken.includes(a)) : []
    const affix = favored.length > 0 ? pick(favored, rng) : pickAffix(kind, affixKind, taken, rng)
    if (!affix) continue
    taken.push(affix)
    const tier = rollTier(zone, rng)
    add(affix.stat, rollAffixValue(affix, tier, power, rng))
    if (affix.kind === 'prefix') prefix ??= affix.names[tier]
    else suffix ??= affix.names[tier]
  }

  const baseName = family.names[grade]!
  const name = setPiece
    ? setPiece[1].name
    : unique
      ? unique.name
      : rarity === 2
        ? `${pick(RARE_FIRST, rng)}${pick(RARE_SECOND, rng)}${baseName}`
        : rarity === 1
          ? `${prefix ?? ''}${baseName}${suffix ?? ''}`
          : baseName

  const strReq = Math.round((6 + zone * 2.2) * family.req * (0.85 + rng() * 0.3))
  const item: Item = {
    id,
    slot: kind,
    rarity,
    name,
    level: zone + 1,
    stats,
    value: 0,
    sockets: rollSockets(Math.min(family.sockets, SOCKET_MAX[kind]), rarity, rng),
    gems: [],
    base: family.id,
    grade,
    ...(set ? { set } : {}),
    ...(strReq > 0 ? { req: { str: strReq } } : {}),
    ...(unique?.power && Object.keys(unique.power).length > 0 ? { power: unique.power } : {}),
    ...(unique?.legend ? { legend: unique.legend } : {}),
    // Rares and better come out of the dark unidentified.
    ...(rarity >= 2 ? { unid: true } : {}),
  }

  return { ...item, value: Math.max(1, Math.round(rawScore(stats) * (1 + RARITIES[rarity].rank))) }
}

/** An item's base in words: its grade and family name. */
export const baseText = (item: Item) => {
  const family = item.base ? familyOf(item.base) : undefined
  if (!family || item.slot === 'charm') return SLOT_NAMES[item.slot]

  return `${family.names[item.grade ?? 0]}（${BASE_GRADES[item.grade ?? 0]}・${SLOT_NAMES[item.slot]}）`
}

// ── Charms: carried, not worn ──────────────────────────────────────────────
export const CHARM_SPACE = 9
export const CHARM_SIZES: Record<CharmSize, { name: string; cells: number; mult: number; affixes: [number, number] }> = {
  small: { name: '小型護身符', cells: 1, mult: 0.35, affixes: [1, 1] },
  large: { name: '大型護身符', cells: 2, mult: 0.6, affixes: [1, 2] },
  grand: { name: '超大型護身符', cells: 3, mult: 0.85, affixes: [2, 2] },
}

export const makeCharm = (zone: number, id: number, rng: Rng, size?: CharmSize): Item => {
  const r = rng()
  const kind: CharmSize = size ?? (r < 0.55 ? 'small' : r < 0.85 ? 'large' : 'grand')
  const def = CHARM_SIZES[kind]
  const power = powerAt(zone) * def.mult
  const stats: Stats = {}
  const taken: AffixDef[] = []
  const names: string[] = []
  const count = def.affixes[0] + Math.floor(rng() * (def.affixes[1] - def.affixes[0] + 1))
  for (let i = 0; i < count; i++) {
    const affix = pickAffix('charm', undefined, [...taken, ...AFFIX_TABLE.filter(a => a.stat === 'skills' || a.stat === 'ls')], rng)
    if (!affix) continue
    taken.push(affix)
    const tier = rollTier(zone, rng)
    const value = affix.flat !== undefined ? rollAffixValue(affix, tier, power, rng) : Math.max(1, Math.round(rollAffixValue(affix, tier, 1, rng) * def.mult))
    stats[affix.stat] = (stats[affix.stat] ?? 0) + value
    names.push(affix.names[tier]!)
  }
  // A grand charm, now and then, carries a skill.
  if (kind === 'grand' && rng() < 0.15) stats.skills = (stats.skills ?? 0) + 1

  return {
    id,
    slot: 'charm',
    charm: kind,
    rarity: 1,
    name: `${names[0] ?? ''}${def.name}${names[1] ? `・${names[1]}` : ''}`,
    level: zone + 1,
    stats,
    value: Math.max(1, Math.round(rawScore(stats) * 2)),
    sockets: 0,
    gems: [],
  }
}

export const charmCells = (charms: readonly Item[]) => charms.reduce((sum, c) => sum + CHARM_SIZES[c.charm ?? 'small'].cells, 0)

/** An item from an older save: no sockets, runes or charm fields yet. */
export const normalizeItem = (item: Item): Item => ({ ...item, sockets: item.sockets ?? 0, gems: item.gems ?? [] })

// ── Gems ───────────────────────────────────────────────────────────────────
export const GEM_TYPES: Record<GemType, { name: string; stat: keyof Stats; color: string; pixel: number }> = {
  amethyst: { name: '紫水晶', stat: 'atk', color: '#b060ff', pixel: 0xb060ff },
  diamond: { name: '鑽石', stat: 'def', color: '#e0e8ff', pixel: 0xe0e8ff },
  ruby: { name: '紅寶石', stat: 'hp', color: '#ff4040', pixel: 0xff4040 },
  emerald: { name: '翡翠', stat: 'crit', color: '#40e070', pixel: 0x40e070 },
  topaz: { name: '黃玉', stat: 'mf', color: '#ffd040', pixel: 0xffd040 },
}
export const GEM_IDS = Object.keys(GEM_TYPES) as GemType[]
export const GRADE_NAMES = ['碎裂的', '', '無瑕的', '完美的'] as const
export const GEMS_TO_COMBINE = 3

const GEM_VALUES: Record<keyof Stats, readonly number[]> = {
  atk: [2, 5, 10, 20],
  def: [2, 5, 10, 20],
  hp: [15, 35, 70, 140],
  crit: [1, 2, 4, 7],
  gf: [5, 12, 24, 45],
  res: [4, 8, 12, 18],
  mf: [5, 10, 18, 30],
  ls: [1, 2, 3, 4],
  skills: [0, 0, 0, 1],
  block: [1, 2, 3, 4],
  spell: [2, 4, 6, 10],
  minion: [2, 4, 6, 10],
  mana: [5, 10, 20, 40],
}

export const gemName = (gem: Gem) => `${GRADE_NAMES[gem.grade]}${GEM_TYPES[gem.type].name}`
export const gemStats = (gem: Gem): Stats => {
  const stat = GEM_TYPES[gem.type].stat

  return { [stat]: GEM_VALUES[stat][gem.grade] }
}

export const emptyPouch = (): GemPouch => ({
  amethyst: [0, 0, 0, 0],
  diamond: [0, 0, 0, 0],
  ruby: [0, 0, 0, 0],
  emerald: [0, 0, 0, 0],
  topaz: [0, 0, 0, 0],
})

/** A gem a kill drops: deeper zones drop better grades. */
export const rollGem = (zone: number, tier: DropTier, rng: Rng): Gem | null => {
  if (rng() >= GEM_DROP_CHANCE[tier]) return null
  const isBig = tier === 'unique' || tier === 'boss'
  const grade = Math.min(3, Math.floor(zone / 10) + (rng() < 0.2 ? 1 : 0) + (isBig ? 1 : 0)) as GemGrade

  return { type: pick(GEM_IDS, rng), grade }
}

export const withGems = (save: Save, type: GemType, grade: number, delta: number): Save => ({
  ...save,
  gems: { ...save.gems, [type]: save.gems[type].map((n, g) => (g === grade ? n + delta : n)) },
})

export const addGem = (save: Save, gem: Gem) => withGems(save, gem.type, gem.grade, 1)

/** Three of a grade make one of the next. */
export const combineGems = (save: Save, type: GemType, grade: GemGrade): Save => {
  if (grade >= 3 || (save.gems[type][grade] ?? 0) < GEMS_TO_COMBINE) return save

  return withGems(withGems(save, type, grade, -GEMS_TO_COMBINE), type, grade + 1, 1)
}

export const usedSockets = (item: Item) => item.gems.length + (item.runes?.length ?? 0)

/** Sets a gem into a worn item's empty socket, for good. */
export const socketGem = (save: Save, slot: Slot, gem: Gem): Save => {
  const item = save.equipment[slot]
  if (!item || usedSockets(item) >= item.sockets || (save.gems[gem.type][gem.grade] ?? 0) < 1) return save

  return {
    ...withGems(save, gem.type, gem.grade, -1),
    equipment: { ...save.equipment, [slot]: { ...item, gems: [...item.gems, gem] } },
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────
const addStats = (into: Required<Stats>, stats: Stats) => {
  for (const key of STAT_KEYS) into[key] += stats[key] ?? 0
}

/** Extra stats an item gets from what is set in it: gems, and runes (wired in by runes.ts). */
let socketStats: (item: Item) => Stats = () => ({})
export const setSocketStats = (fn: (item: Item) => Stats) => {
  socketStats = fn
}

/** An item's stats with what is set in it. */
export const itemStats = (item: Item): Required<Stats> => {
  const total = emptyStats()
  addStats(total, item.stats)
  for (const gem of item.gems) addStats(total, gemStats(gem))
  addStats(total, socketStats(item))

  return total
}

const rawScore = (s: Stats) =>
  (s.atk ?? 0) * 2 +
  (s.def ?? 0) * 2 +
  (s.hp ?? 0) * 0.25 +
  (s.crit ?? 0) * 3 +
  (s.gf ?? 0) * 0.5 +
  (s.res ?? 0) * 1.5 +
  (s.mf ?? 0) * 0.6 +
  (s.ls ?? 0) * 4 +
  (s.skills ?? 0) * 40 +
  (s.block ?? 0) * 3 +
  (s.spell ?? 0) * 2.5 +
  (s.minion ?? 0) * 2.5 +
  (s.mana ?? 0) * 0.3

export const itemScore = (item: Item | null | undefined) => (item ? rawScore(itemStats(item)) : 0)

export const sellValue = (item: Item) =>
  item.value + item.gems.reduce((sum, gem) => sum + GEM_VALUES[GEM_TYPES[gem.type].stat][gem.grade]! * 3, 0)

/** The sets worn: pieces per set, and the bonuses those pieces have earned. */
export const activeSets = (equipment: Equipment) =>
  SET_IDS.map(id => {
    const count = SLOTS.filter(slot => equipment[slot]?.set === id).length
    const size = Object.keys(SETS[id].pieces).length
    const tiers = Object.keys(SETS[id].bonuses)
      .map(Number)
      .sort((a, b) => a - b)
      .map(n => ({ pieces: n, bonus: SETS[id].bonuses[n]!, isActive: count >= n }))

    return { id, name: SETS[id].name, count, size, tiers }
  }).filter(set => set.count > 0)

type GearTotals = { flat: Required<Stats>; pct: { atk: number; def: number; hp: number }; power: Power }

const addPower = (into: Power, power: Power | undefined) => {
  for (const [k, v] of Object.entries(power ?? {})) into[k] = (into[k] ?? 0) + v
}
const gearCache = new WeakMap<Equipment, WeakMap<readonly Item[], GearTotals>>()

/** Everything worn and carried: items, gems, runes, set bonuses and charms. */
export const gearStats = (equipment: Equipment, charms: readonly Item[] = []): GearTotals => {
  const cached = gearCache.get(equipment)?.get(charms)
  if (cached) return cached
  const flat = emptyStats()
  const pct = { atk: 0, def: 0, hp: 0 }
  const power: Power = {}
  for (const slot of SLOTS) {
    const item = equipment[slot]
    if (!item) continue
    addStats(flat, itemStats(item))
    if (!item.unid) addPower(power, item.power)
  }
  for (const charm of charms) addStats(flat, charm.stats)
  for (const set of activeSets(equipment)) {
    for (const tier of set.tiers) {
      if (!tier.isActive) continue
      addStats(flat, tier.bonus.stats ?? {})
      addPower(power, tier.bonus.power)
      pct.atk += tier.bonus.atkPct ?? 0
      pct.def += tier.bonus.defPct ?? 0
      pct.hp += tier.bonus.hpPct ?? 0
    }
  }
  const totals = { flat, pct, power }
  const inner = gearCache.get(equipment) ?? new WeakMap()
  inner.set(charms, totals)
  gearCache.set(equipment, inner)

  return totals
}

export const statText = (stats: Stats) =>
  STAT_KEYS.filter(key => stats[key])
    .map(key => (key === 'skills' ? `所有技能+${stats[key]}` : `${STAT_NAMES[key]}+${stats[key]}${isPercent(key) ? '%' : ''}`))
    .join(' ')

export const bonusText = (bonus: SetBonus) =>
  [
    bonus.stats ? statText(bonus.stats) : '',
    bonus.atkPct ? `攻擊+${bonus.atkPct}%` : '',
    bonus.defPct ? `防禦+${bonus.defPct}%` : '',
    bonus.hpPct ? `生命+${bonus.hpPct}%` : '',
    bonus.legend ?? '',
  ]
    .filter(Boolean)
    .join(' ')

/** What an item looks like to the hero: its name, or the base it hides behind. */
export const shownName = (item: Item) => (item.unid ? `未鑑定的${SLOT_NAMES[item.slot]}` : item.name)

// ── Bag ────────────────────────────────────────────────────────────────────
export type LootAction = 'equipped' | 'bag' | 'sold' | 'charm'

/** Keeps the bag within its size by selling its worst items; unidentified ones are kept a while longer. */
const fitBag = (save: Save): { save: Save; sold: Item[] } => {
  const bag = [...save.bag]
  const sold: Item[] = []
  const worth = (item: Item) => itemScore(item) + (item.unid ? 1e12 : 0)
  while (bag.length > BAG_SIZE) {
    let worst = 0
    bag.forEach((item, i) => {
      if (worth(item) < worth(bag[worst]!)) worst = i
    })
    sold.push(...bag.splice(worst, 1))
  }

  return { save: { ...save, bag, gold: save.gold + sold.reduce((sum, item) => sum + sellValue(item), 0) }, sold }
}

/** Charms carried: the best that fit, by worth for the space they take. */
const fitCharms = (charms: Item[]) => {
  const ranked = [...charms].sort(
    (a, b) => itemScore(b) / CHARM_SIZES[b.charm ?? 'small'].cells - itemScore(a) / CHARM_SIZES[a.charm ?? 'small'].cells,
  )
  const kept: Item[] = []
  const left: Item[] = []
  for (const c of ranked) {
    if (charmCells(kept) + CHARM_SIZES[c.charm ?? 'small'].cells <= CHARM_SPACE) kept.push(c)
    else left.push(c)
  }

  return { kept, left }
}

/**
 * A found item: a charm joins the carried ones if it earns its space; gear is
 * worn when auto-equip is on and the hero is stronger with it (by `power`,
 * which counts set bonuses); otherwise bagged, the worst sold on overflow.
 */
export const pickUp = (save: Save, item: Item, power: (s: Save) => number): { save: Save; action: LootAction } => {
  if (item.slot === 'charm') {
    const { kept, left } = fitCharms([...save.charms, item])
    const isKept = save.autoEquip && kept.some(c => c.id === item.id)
    const next = isKept ? { ...save, charms: kept, bag: [...save.bag, ...left] } : { ...save, bag: [...save.bag, item] }
    const fitted = fitBag(next)

    return { save: fitted.save, action: fitted.sold.some(s => s.id === item.id) ? 'sold' : isKept ? 'charm' : 'bag' }
  }
  const slots: Slot[] = item.slot === 'ring' ? ['ring', 'ring2'] : [item.slot]
  const options = slots.map(slot => {
    const current = save.equipment[slot]

    return { ...save, equipment: { ...save.equipment, [slot]: item }, bag: current ? [...save.bag, current] : save.bag } as Save
  })
  const worn = options.reduce((best, o) => (power(o) > power(best) ? o : best))
  // Unidentified gear is not worn on a whim.
  const isBetter = save.autoEquip && !item.unid && power(worn) > power(save)
  const next = isBetter ? worn : { ...save, bag: [...save.bag, item] }
  const fitted = fitBag(next)
  const action: LootAction = fitted.sold.some(sold => sold.id === item.id) ? 'sold' : isBetter ? 'equipped' : 'bag'

  return { save: fitted.save, action }
}

export const equip = (save: Save, id: number): Save => {
  const found = save.bag.find(one => one.id === id)
  if (!found) return save
  const item = { ...found, unid: undefined }
  if (item.slot === 'charm') {
    if (charmCells(save.charms) + CHARM_SIZES[item.charm ?? 'small'].cells > CHARM_SPACE) return save

    return { ...save, charms: [...save.charms, item], bag: save.bag.filter(one => one.id !== id) }
  }
  // A ring goes on an empty finger, or over the weaker of the two.
  const slot: Slot =
    item.slot !== 'ring'
      ? item.slot
      : !save.equipment.ring
        ? 'ring'
        : !save.equipment.ring2
          ? 'ring2'
          : itemScore(save.equipment.ring2) < itemScore(save.equipment.ring)
            ? 'ring2'
            : 'ring'
  const current = save.equipment[slot]

  return {
    ...save,
    equipment: { ...save.equipment, [slot]: item },
    bag: [...save.bag.filter(one => one.id !== id), ...(current ? [current] : [])],
  }
}

export const unequip = (save: Save, slot: Slot): Save => {
  const current = save.equipment[slot]
  if (!current || save.bag.length >= BAG_SIZE) return save

  return { ...save, equipment: { ...save.equipment, [slot]: null }, bag: [...save.bag, current] }
}

export const dropCharm = (save: Save, id: number): Save => {
  const charm = save.charms.find(c => c.id === id)
  if (!charm || save.bag.length >= BAG_SIZE) return save

  return { ...save, charms: save.charms.filter(c => c.id !== id), bag: [...save.bag, charm] }
}

export const sell = (save: Save, id: number): Save => {
  const item = save.bag.find(one => one.id === id)
  if (!item) return save

  return { ...save, gold: save.gold + sellValue(item), bag: save.bag.filter(one => one.id !== id) }
}

/** Sells the bag, keeping what is still unidentified. */
export const sellAll = (save: Save): Save => ({
  ...save,
  gold: save.gold + save.bag.filter(item => !item.unid).reduce((sum, item) => sum + sellValue(item), 0),
  bag: save.bag.filter(item => item.unid),
})

export const identify = (item: Item): Item => ({ ...item, unid: undefined })

export const identifyAll = (save: Save): Save => ({ ...save, bag: save.bag.map(identify) })

// ── Town: the smith's sockets, gambling, and the stash every hero shares ──
export const punchCost = (item: Item) => Math.round(200 * Math.pow(1.25, item.level) * (item.sockets + 1))

/** The smith adds one socket to a worn item; sets and runewords are left alone. */
export const punchSocket = (save: Save, slot: Slot): Save => {
  const item = save.equipment[slot]
  if (!item || item.set || item.runeword || item.sockets >= SOCKET_MAX[slot] || save.gold < punchCost(item)) return save

  return {
    ...save,
    gold: save.gold - punchCost(item),
    equipment: { ...save.equipment, [slot]: { ...item, sockets: item.sockets + 1 } },
  }
}

/** Gambling: never a plain item, rarely a set piece or a unique. */
export const GAMBLE_TABLE: readonly [Rarity, number][] = [[3, 0.006], [4, 0.01], [2, 0.12], [1, 0.864]]

export const gambleCost = (zone: number) => Math.round(150 * Math.pow(1.3, zone))

export const gamble = (save: Save, slot: GearKind | 'charm', rng: Rng): { save: Save; item?: Item } => {
  const cost = gambleCost(save.maxZone)
  if (save.gold < cost || save.bag.length >= BAG_SIZE) return { save }
  let r = rng()
  let rarity: Rarity = 1
  for (const [rar, share] of GAMBLE_TABLE) {
    if (r < share) {
      rarity = rar
      break
    }
    r -= share
  }
  const item =
    slot === 'charm' ? { ...makeCharm(save.maxZone, save.nextItemId, rng), unid: true } : { ...makeItem(save.maxZone, rarity, save.nextItemId, rng, slot), unid: true }

  return { save: { ...save, gold: save.gold - cost, bag: [...save.bag, item], nextItemId: save.nextItemId + 1 }, item }
}

export const STASH_SIZE = 24
