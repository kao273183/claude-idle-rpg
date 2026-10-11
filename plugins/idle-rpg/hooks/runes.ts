import type { Character, GemType, Item, Slot, Stats } from '../types'

import type { DropTier } from './loot'
import { BAG_SIZE, GEM_IDS, GEMS_TO_COMBINE, makeItem, powerAt, setSocketStats, SOCKET_MAX, usedSockets, withGems } from './loot'

type Rng = () => number

// ── Runes ──────────────────────────────────────────────────────────────────
/** The runes in order of rarity: each set alone in a socket gives a little. */
export const RUNES: { name: string; en: string; stats: Stats }[] = [
  { name: '艾爾', en: 'El', stats: { atk: 3 } },
  { name: '提爾', en: 'Tir', stats: { gf: 10 } },
  { name: '那夫', en: 'Nef', stats: { def: 10 } },
  { name: '愛斯', en: 'Eth', stats: { res: 5 } },
  { name: '伊司', en: 'Ith', stats: { atk: 8 } },
  { name: '塔爾', en: 'Tal', stats: { res: 8 } },
  { name: '拉爾', en: 'Ral', stats: { res: 8 } },
  { name: '歐特', en: 'Ort', stats: { res: 8 } },
  { name: '書爾', en: 'Thul', stats: { res: 8 } },
  { name: '安姆', en: 'Amn', stats: { ls: 4 } },
  { name: '索爾', en: 'Sol', stats: { def: 40 } },
  { name: '夏', en: 'Shael', stats: { crit: 4 } },
  { name: '盧姆', en: 'Lum', stats: { mf: 10 } },
  { name: '藍姆', en: 'Lem', stats: { gf: 50 } },
  { name: '瑪爾', en: 'Mal', stats: { res: 12 } },
  { name: '伊司特', en: 'Ist', stats: { mf: 30 } },
  { name: '貝', en: 'Ber', stats: { hp: 300 } },
  { name: '喬', en: 'Jah', stats: { hp: 500 } },
]
export const RUNE_COLOR = '#ff9a30'
const R = Object.fromEntries(RUNES.map((r, i) => [r.en, i])) as Record<string, number>

export const runeName = (i: number) => `${RUNES[i]?.name ?? '?'}（${RUNES[i]?.en ?? '?'}）`

export const RUNE_DROP_CHANCE: Record<DropTier, number> = { normal: 0.015, champion: 0.06, unique: 0.12, boss: 0.5 }

/** The highest rune a zone can drop: deeper ground, rarer runes. */
export const maxRuneAt = (zone: number) => Math.min(RUNES.length - 1, 3 + Math.floor(zone * 0.45))

/** A rune a kill drops: each rank about half as common as the one below it. */
export const rollRune = (zone: number, tier: DropTier, rng: Rng): number | null => {
  if (rng() >= RUNE_DROP_CHANCE[tier]) return null
  const top = maxRuneAt(zone)
  let i = 0
  while (i < top && rng() < 0.5) i++

  return i
}

export const emptyRunes = () => RUNES.map(() => 0)

// ── Runewords ──────────────────────────────────────────────────────────────
export type Runeword = {
  id: string
  name: string
  slot: Slot
  runes: number[]
  /** What it grants, flat stats grown with the item's depth. */
  stats: (power: number) => Stats
}

export const RUNEWORDS: Runeword[] = [
  { id: 'stealth', name: '隱密', slot: 'armor', runes: [R.Tal!, R.Eth!], stats: p => ({ def: Math.round(3 * p), res: 15, crit: 3 }) },
  { id: 'steel', name: '鋼鐵', slot: 'weapon', runes: [R.Tir!, R.El!], stats: p => ({ atk: Math.round(5 * p), crit: 5 }) },
  { id: 'malice', name: '惡意', slot: 'weapon', runes: [R.Ith!, R.El!, R.Eth!], stats: p => ({ atk: Math.round(7 * p), ls: 5 }) },
  { id: 'smoke', name: '煙霧', slot: 'armor', runes: [R.Nef!, R.Lum!], stats: p => ({ def: Math.round(4 * p), res: 30 }) },
  { id: 'lore', name: '學識', slot: 'helm', runes: [R.Ort!, R.Sol!], stats: p => ({ def: Math.round(3 * p), skills: 1 }) },
  { id: 'spirit', name: '精神', slot: 'weapon', runes: [R.Tal!, R.Thul!, R.Ort!, R.Amn!], stats: p => ({ hp: Math.round(15 * p), res: 20, skills: 2 }) },
  { id: 'insight', name: '洞察', slot: 'weapon', runes: [R.Ral!, R.Tir!, R.Tal!, R.Sol!], stats: p => ({ atk: Math.round(10 * p), mf: 25, crit: 8 }) },
  { id: 'treachery', name: '背叛', slot: 'armor', runes: [R.Shael!, R.Thul!, R.Lem!], stats: p => ({ def: Math.round(5 * p), crit: 10, gf: 50 }) },
  { id: 'enigma', name: '謎團', slot: 'armor', runes: [R.Jah!, R.Ith!, R.Ber!], stats: p => ({ hp: Math.round(40 * p), def: Math.round(8 * p), mf: 40, skills: 2 }) },
  { id: 'infinity', name: '無限', slot: 'weapon', runes: [R.Ber!, R.Mal!, R.Ber!, R.Ist!], stats: p => ({ atk: Math.round(20 * p), crit: 15, mf: 30, ls: 8 }) },
]

export const runewordOf = (item: Item) => RUNEWORDS.find(w => w.id === item.runeword)

// Runes in a socket count toward an item's stats; a runeword replaces them with its own.
setSocketStats(item => {
  const word = runewordOf(item)
  if (word) return word.stats(powerAt(item.level - 1))
  const total: Stats = {}
  for (const r of item.runes ?? []) {
    for (const [key, value] of Object.entries(RUNES[r]?.stats ?? {}) as [keyof Stats, number][]) total[key] = (total[key] ?? 0) + value
  }

  return total
})

/** The runewords a worn item could still become, given the runes already in it. */
export const runewordsFor = (item: Item) =>
  RUNEWORDS.filter(
    w =>
      w.slot === item.slot &&
      item.rarity === 0 &&
      item.gems.length === 0 &&
      w.runes.length === item.sockets &&
      (item.runes ?? []).every((r, i) => w.runes[i] === r),
  )

/**
 * Sets a rune into a worn item's empty socket. A plain item whose sockets fill
 * with the right runes in the right order becomes that runeword.
 */
export const socketRune = (c: Character, slot: Slot, rune: number): Character => {
  const item = c.equipment[slot]
  if (!item || usedSockets(item) >= item.sockets || (c.runes[rune] ?? 0) < 1) return c
  const runes = [...(item.runes ?? []), rune]
  let next: Item = { ...item, runes }
  const word = RUNEWORDS.find(
    w => w.slot === slot && item.rarity === 0 && item.gems.length === 0 && w.runes.length === item.sockets && w.runes.every((r, i) => runes[i] === r),
  )
  if (word) next = { ...next, rarity: 5, runeword: word.id, name: `${word.name}・${item.name}` }

  return { ...c, runes: c.runes.map((n, i) => (i === rune ? n - 1 : n)), equipment: { ...c.equipment, [slot]: next } }
}

// ── The Horadric Cube ──────────────────────────────────────────────────────
const perfectGems = (c: Character) => GEM_IDS.reduce((sum, g) => sum + (c.gems[g][3] ?? 0), 0)
const chippedGems = (c: Character) => GEM_IDS.reduce((sum, g) => sum + (c.gems[g][0] ?? 0), 0)

/** Takes gems of a grade from whichever type has the most. */
const spendGems = (c: Character, grade: number, count: number): Character => {
  let next = c
  for (let i = 0; i < count; i++) {
    const most = GEM_IDS.reduce<GemType>((best, g) => ((next.gems[g][grade] ?? 0) > (next.gems[best][grade] ?? 0) ? g : best), GEM_IDS[0]!)
    next = withGems(next, most, grade, -1)
  }

  return next
}

/** Runes to the next: three of the lesser runes, two of the greater and a perfect gem. */
export const runeUpgradeCost = (rune: number) => (rune < 10 ? { runes: 3, perfect: 0 } : { runes: 2, perfect: 1 })

export const upgradeRune = (c: Character, rune: number): Character => {
  const cost = runeUpgradeCost(rune)
  if (rune >= RUNES.length - 1 || (c.runes[rune] ?? 0) < cost.runes || perfectGems(c) < cost.perfect) return c
  const runes = c.runes.map((n, i) => (i === rune ? n - cost.runes : i === rune + 1 ? n + 1 : n))

  return spendGems({ ...c, runes }, 3, cost.perfect)
}

export type CubeRecipe = {
  id: string
  name: string
  needs: string
  /** The bag items it works on, if it works on one. */
  fits?: (item: Item) => boolean
  /** Whether the hero has the rest of what it takes. */
  ready: (c: Character) => boolean
  /** What goes in besides the item, as held against needed. */
  materials: (c: Character) => { name: string; have: number; need: number }[]
  /** What comes out, in a few words. */
  makes: string
  apply: (c: Character, item: Item | undefined, rng: Rng) => Character
}

const replace = (c: Character, old: Item, next: Item): Character => ({
  ...c,
  bag: c.bag.map(one => (one.id === old.id ? next : one)),
  nextItemId: c.nextItemId + 1,
})

export const CUBE_RECIPES: CubeRecipe[] = [
  {
    id: 'gems',
    name: '寶石升級',
    needs: `${GEMS_TO_COMBINE} 顆同種同級寶石 → 高一級的 1 顆（在寶石頁合成）`,
    ready: () => false,
    materials: () => [],
    makes: '高一級的寶石',
    apply: c => c,
  },
  {
    id: 'sockets',
    name: '打孔',
    needs: '1 件無孔的普通裝備 + 3 顆碎裂寶石 → 隨機 1～4 孔',
    fits: item => item.slot !== 'charm' && item.rarity === 0 && item.sockets === 0,
    ready: c => chippedGems(c) >= 3,
    materials: c => [{ name: '碎裂寶石（任意種類）', have: chippedGems(c), need: 3 }],
    makes: '同一件裝備，隨機 1～4 孔',
    apply: (c, item, rng) => {
      if (!item || item.slot === 'charm') return c
      const sockets = 1 + Math.floor(rng() * SOCKET_MAX[item.slot])

      return spendGems({ ...c, bag: c.bag.map(one => (one.id === item.id ? { ...one, sockets } : one)) }, 0, 3)
    },
  },
  {
    id: 'rerollMagic',
    name: '重鑄魔法裝備',
    needs: '1 件魔法裝備 + 3 顆完美寶石 → 同部位、同等級的新魔法裝備',
    fits: item => item.slot !== 'charm' && item.rarity === 1,
    ready: c => perfectGems(c) >= 3,
    materials: c => [{ name: '完美寶石（任意種類）', have: perfectGems(c), need: 3 }],
    makes: '同部位、同等級的新魔法裝備',
    apply: (c, item, rng) => {
      if (!item || item.slot === 'charm') return c
      const next = makeItem(item.level - 1, 1, c.nextItemId, rng, item.slot)

      return spendGems(replace(c, item, next), 3, 3)
    },
  },
  {
    id: 'rerollRare',
    name: '重鑄稀有裝備',
    needs: '1 件稀有裝備 + 6 顆完美寶石 → 同部位、同等級的新稀有裝備',
    fits: item => item.slot !== 'charm' && item.rarity === 2,
    ready: c => perfectGems(c) >= 6,
    materials: c => [{ name: '完美寶石（任意種類）', have: perfectGems(c), need: 6 }],
    makes: '同部位、同等級的新稀有裝備',
    apply: (c, item, rng) => {
      if (!item || item.slot === 'charm') return c
      const next = { ...makeItem(item.level - 1, 2, c.nextItemId, rng, item.slot), unid: undefined }

      return spendGems(replace(c, item, next), 3, 6)
    },
  },
  {
    id: 'upgradeItem',
    name: '裝備升級',
    needs: '1 件暗金或套裝 + 喬（Jah）符文 → 以目前最深區域的強度重鑄同部位暗金',
    fits: item => item.slot !== 'charm' && (item.rarity === 3 || item.rarity === 4),
    ready: c => (c.runes[R.Jah!] ?? 0) >= 1,
    materials: c => [{ name: '喬（Jah）符文', have: c.runes[R.Jah!] ?? 0, need: 1 }],
    makes: '以最深區域的強度重鑄成同部位暗金',
    apply: (c, item, rng) => {
      if (!item || item.slot === 'charm') return c
      const next = { ...makeItem(c.maxZone, 3, c.nextItemId, rng, item.slot), unid: undefined }

      return { ...replace(c, item, next), runes: c.runes.map((n, i) => (i === R.Jah ? n - 1 : n)) }
    },
  },
]

export const runCube = (c: Character, recipeId: string, itemId: number | undefined, rng: Rng): Character => {
  const recipe = CUBE_RECIPES.find(r => r.id === recipeId)
  if (!recipe || !recipe.ready(c)) return c
  const item = itemId === undefined ? undefined : c.bag.find(one => one.id === itemId)
  if (recipe.fits && (!item || !recipe.fits(item))) return c
  if (c.bag.length > BAG_SIZE) return c

  return recipe.apply(c, item, rng)
}

/** Combines every gem that can be: chipped up through flawless, lowest first. */
export const combineAllGems = (c: Character): Character => {
  let next = c
  for (let grade = 0; grade < 3; grade++) {
    for (const g of GEM_IDS) {
      while ((next.gems[g][grade] ?? 0) >= GEMS_TO_COMBINE) next = withGems(withGems(next, g, grade, -GEMS_TO_COMBINE), g, grade + 1, 1)
    }
  }

  return next
}

/** Every bag item at least one recipe takes. */
export const cubeCandidates = (c: Character, recipe: CubeRecipe) => (recipe.fits ? c.bag.filter(item => recipe.fits!(item)) : [])

export { chippedGems, perfectGems }
