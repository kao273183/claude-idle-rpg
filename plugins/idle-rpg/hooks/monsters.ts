import type { AffixId, Element, Foe } from '../types'

type Rng = () => number

export const WALK_SECONDS = 3
export const AREAS_PER_ACT = 4
export const ACT_COUNT = 5
export const AREAS_PER_DIFFICULTY = AREAS_PER_ACT * ACT_COUNT
/** Packs to clear in an area before moving on; the last is its guardian. */
export const PACKS_PER_AREA = 6
export const MAX_PACK = 5

// ── Difficulties ───────────────────────────────────────────────────────────
export const DIFFICULTIES = [
  { name: '普通', color: '#c8c8c8', resPenalty: 0, monsterRes: 0 },
  { name: '惡夢', color: '#d0a040', resPenalty: 40, monsterRes: 20 },
  { name: '地獄', color: '#d03030', resPenalty: 100, monsterRes: 40 },
] as const

// ── Monsters ───────────────────────────────────────────────────────────────
export type MonsterType = {
  name: string
  /** Which sprite in art.ts. */
  sprite: number
  /** A colour the sprite is pushed toward, for kin of another monster. */
  tint?: number
  element: Element
  res: Partial<Record<Element, number>>
  hp: number
  atk: number
}

export const MONSTER_TYPES: MonsterType[] = [
  { name: '墮落者', sprite: 0, element: 'phys', res: {}, hp: 0.8, atk: 0.9 },
  { name: '骷髏戰士', sprite: 1, element: 'phys', res: { poison: 50, cold: 25 }, hp: 1, atk: 1 },
  { name: '腐屍', sprite: 2, element: 'poison', res: { poison: 50 }, hp: 1.4, atk: 0.8 },
  { name: '地獄犬', sprite: 3, element: 'fire', res: { fire: 50 }, hp: 1, atk: 1.2 },
  { name: '惡魔', sprite: 4, element: 'fire', res: { fire: 33, light: 25 }, hp: 1.2, atk: 1.2 },
  { name: '沙地掠奪者', sprite: 5, element: 'phys', res: { fire: 25 }, hp: 1.1, atk: 1.1 },
  { name: '電甲蟲', sprite: 6, element: 'light', res: { light: 75 }, hp: 0.9, atk: 1 },
  { name: '巨型蜘蛛', sprite: 7, element: 'poison', res: { poison: 75 }, hp: 0.9, atk: 1.1 },
  { name: '山羊人', sprite: 8, element: 'phys', res: { cold: 25 }, hp: 1.2, atk: 1.1 },
  { name: '雪怪', sprite: 9, element: 'cold', res: { cold: 75 }, hp: 1.5, atk: 1 },
  { name: '剝皮者', sprite: 0, tint: 0x40a040, element: 'poison', res: { poison: 33 }, hp: 0.9, atk: 1 },
  { name: '骷髏法師', sprite: 1, tint: 0x6080ff, element: 'cold', res: { cold: 75, poison: 50 }, hp: 0.8, atk: 1.2 },
]

// ── Acts and their areas ───────────────────────────────────────────────────
export type ActDef = {
  name: string
  town: string
  /** Which dungeon palette in scene.ts. */
  look: number
  areas: [string, string, string, string]
  monsters: number[]
  boss: { name: string; sprite: number; tint: number; element: Element; res: Partial<Record<Element, number>> }
}

export const ACTS: ActDef[] = [
  {
    name: '第一幕',
    town: '流浪者營地',
    look: 0,
    areas: ['血腥荒地', '冰冷平原', '埋骨之地', '修道院地窖'],
    monsters: [0, 2, 1],
    boss: { name: '痛苦魔女', sprite: 4, tint: 0x60c040, element: 'poison', res: { poison: 75, fire: 50 } },
  },
  {
    name: '第二幕',
    town: '沙漠綠洲',
    look: 1,
    areas: ['岩石荒漠', '乾燥高地', '失落之城', '古王之墓'],
    monsters: [5, 6, 1, 11],
    boss: { name: '痛苦之王', sprite: 6, tint: 0xc0a070, element: 'cold', res: { cold: 75, light: 50 } },
  },
  {
    name: '第三幕',
    town: '港口碼頭',
    look: 2,
    areas: ['蜘蛛森林', '剝皮叢林', '腐敗集市', '憎恨牢籠'],
    monsters: [7, 10, 2],
    boss: { name: '憎恨之王', sprite: 4, tint: 0x4060ff, element: 'light', res: { light: 75, cold: 75 } },
  },
  {
    name: '第四幕',
    town: '天堂要塞',
    look: 3,
    areas: ['外圍荒原', '絕望平原', '火焰之河', '混沌庇護所'],
    monsters: [3, 4, 8],
    boss: { name: '恐懼之王', sprite: 4, tint: 0xff3010, element: 'fire', res: { fire: 75, light: 50 } },
  },
  {
    name: '第五幕',
    town: '北境要塞',
    look: 4,
    areas: ['血腥丘陵', '冰凍高地', '亞瑞特高原', '世界之石要塞'],
    monsters: [9, 8, 4],
    boss: { name: '毀滅之王', sprite: 4, tint: 0xa040ff, element: 'magic', res: { fire: 50, cold: 50, light: 50, poison: 50 } },
  },
]

/** Where a zone number points: difficulty, act, area within the act. */
export const placeOf = (zone: number) => {
  const tier = Math.floor(zone / AREAS_PER_DIFFICULTY)
  const inTier = zone % AREAS_PER_DIFFICULTY
  const act = Math.floor(inTier / AREAS_PER_ACT)

  return {
    /** 0 normal, 1 nightmare, 2 hell; beyond hell stays hell. */
    difficulty: Math.min(2, tier),
    /** How far past hell, for the endless loop after it. */
    beyond: Math.max(0, tier - 2),
    act,
    area: inTier % AREAS_PER_ACT,
    actDef: ACTS[act]!,
    isBossArea: inTier % AREAS_PER_ACT === AREAS_PER_ACT - 1,
    isLastAct: act === ACT_COUNT - 1,
  }
}

export const zoneName = (zone: number) => {
  const p = placeOf(zone)
  const tier = p.beyond > 0 ? `地獄 +${p.beyond}` : DIFFICULTIES[p.difficulty]!.name

  return `${p.actDef.name}・${p.actDef.areas[p.area]}（${tier}）`
}

export const areaName = (zone: number) => {
  const p = placeOf(zone)

  return p.actDef.areas[p.area]!
}

export const zoneOf = (zone: number) => ({ name: areaName(zone) })

// ── Elite modifiers ────────────────────────────────────────────────────────
export const AFFIXES: Record<AffixId, { name: string; color: string }> = {
  fast: { name: '極快', color: '#e0e0e0' },
  strong: { name: '極強', color: '#ff8080' },
  fire: { name: '火焰強化', color: '#ff8030' },
  cold: { name: '冰冷強化', color: '#80c8ff' },
  light: { name: '閃電強化', color: '#fff070' },
  magicImmune: { name: '魔法免疫', color: '#c080ff' },
  stoneSkin: { name: '石膚', color: '#a0a0a0' },
  vampiric: { name: '吸血', color: '#d02040' },
  manaBurn: { name: '法力燃燒', color: '#6070ff' },
}
const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[]

const UNIQUE_FIRST = ['血', '腐', '狂', '骨', '暗', '屍', '毒', '怒', '冥', '鐵']
const UNIQUE_SECOND = ['牙', '爪', '心', '魂', '眼', '喉', '脊', '顱']
const UNIQUE_TITLE = ['屠夫', '吞噬者', '掠奪者', '巫師', '詛咒者', '守衛', '先知', '暴君']

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]!

/** How strong the monsters of a zone are: one curve for every act and difficulty. */
export const zonePower = (zone: number) => ({ hp: Math.pow(1.45, zone), atk: Math.pow(1.35, zone), reward: Math.pow(1.3, zone) })

const ELITE_MULT = {
  normal: { hp: 0.5, atk: 0.28, xp: 0.5, gold: 0.5 },
  champion: { hp: 1.6, atk: 0.45, xp: 2, gold: 2 },
  unique: { hp: 2.4, atk: 0.6, xp: 4, gold: 5 },
  minion: { hp: 0.7, atk: 0.3, xp: 0.7, gold: 0.5 },
  boss: { hp: 12, atk: 1.1, xp: 30, gold: 40 },
}

export const makeFoe = (
  zone: number,
  type: MonsterType,
  role: keyof typeof ELITE_MULT,
  affixes: AffixId[],
  name: string,
  extra: Partial<Foe> = {},
): Foe => {
  const power = zonePower(zone)
  const m = ELITE_MULT[role]
  const p = placeOf(zone)
  const base = DIFFICULTIES[p.difficulty]!.monsterRes
  const res: Partial<Record<Element, number>> = {}
  for (const el of ['fire', 'cold', 'light', 'poison'] as const) {
    const own = type.res[el] ?? 0
    // Difficulty hardens what a monster resists; a resist of 100 or more is immunity.
    res[el] = own > 0 ? Math.min(100, own + base) : Math.round(base / 2)
  }
  if (affixes.includes('fire')) res.fire = Math.min(100, (res.fire ?? 0) + 50)
  if (affixes.includes('cold')) res.cold = Math.min(100, (res.cold ?? 0) + 50)
  if (affixes.includes('light')) res.light = Math.min(100, (res.light ?? 0) + 50)
  if (affixes.includes('magicImmune')) res.magic = 100
  if (affixes.includes('stoneSkin')) res.phys = 50
  const maxHp = Math.round(35 * power.hp * type.hp * m.hp * (affixes.includes('stoneSkin') ? 1.3 : 1))
  const atk = Math.round(4 * power.atk * type.atk * m.atk * (affixes.includes('strong') ? 1.5 : 1))
  const element: Element = affixes.includes('fire')
    ? 'fire'
    : affixes.includes('cold')
      ? 'cold'
      : affixes.includes('light')
        ? 'light'
        : type.element

  return {
    kind: type.sprite,
    ...(type.tint !== undefined ? { tint: type.tint } : {}),
    name,
    hp: maxHp,
    maxHp,
    atk,
    element,
    res,
    affixes,
    isBoss: false,
    xp: Math.round(10 * power.reward * m.xp),
    gold: Math.round(5 * power.reward * m.gold),
    status: {},
    ...(role === 'normal' || role === 'minion' ? {} : { elite: role === 'boss' ? 'boss' : role }),
    ...extra,
  }
}

export const rollAffixes = (count: number, rng: Rng) => {
  const out: AffixId[] = []
  while (out.length < count) {
    const a = pick(AFFIX_IDS, rng)
    if (!out.includes(a)) out.push(a)
  }

  return out
}

/** The monsters of one pack: the act boss, an area's guardian, a champion pack, or plain monsters. */
export const newPack = (zone: number, packIndex: number, rng: Rng): Foe[] => {
  const p = placeOf(zone)
  const types = p.actDef.monsters.map(i => MONSTER_TYPES[i]!)
  const isLast = packIndex >= PACKS_PER_AREA - 1
  const extraAffixes = p.difficulty + (p.beyond > 0 ? 1 : 0)

  if (isLast && p.isBossArea) {
    const b = p.actDef.boss
    const bossType: MonsterType = { name: b.name, sprite: b.sprite, tint: b.tint, element: b.element, res: b.res, hp: 1, atk: 1 }
    const boss = makeFoe(zone, bossType, 'boss', [], b.name, { isBoss: true, scale: 1.2 })
    const minion = pick(types, rng)

    return [boss, makeFoe(zone, minion, 'minion', [], minion.name), makeFoe(zone, minion, 'minion', [], minion.name)]
  }

  const type = pick(types, rng)
  const r = rng()
  if (isLast || r < 0.12) {
    const name = `${pick(UNIQUE_FIRST, rng)}${pick(UNIQUE_SECOND, rng)}${pick(UNIQUE_TITLE, rng)}`
    const affixes = rollAffixes(Math.min(4, 1 + Math.floor(rng() * 2) + extraAffixes), rng)
    const minions = 2 + Math.floor(rng() * 2)

    return [makeFoe(zone, type, 'unique', affixes, name), ...Array.from({ length: minions }, () => makeFoe(zone, type, 'minion', [], type.name))]
  }
  if (r < 0.32) {
    const affixes = rollAffixes(Math.min(3, 1 + extraAffixes), rng)
    const count = 2 + Math.floor(rng() * 2)

    return Array.from({ length: count }, () => makeFoe(zone, type, 'champion', affixes, type.name))
  }
  const count = 3 + Math.floor(rng() * 3)

  return Array.from({ length: count }, () => {
    const t = pick(types, rng)

    return makeFoe(zone, t, 'normal', [], t.name)
  })
}

/** The pack a fresh area greets the hero with, for places that need one without dice. */
export const firstPack = (zone: number) => newPack(zone, 0, () => 0.5)

/** Grows as fast as the experience the deeper zones pay. */
export const xpToNext = (level: number) => Math.round(20 * Math.pow(level, 1.2) * Math.pow(1.14, level - 1))

export const formatNumber = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)

  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`
}
