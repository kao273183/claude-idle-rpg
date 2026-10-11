import type { Attr, ClassId } from '../types'

export type ClassDef = {
  name: string
  blurb: string
  color: string
  /** Attributes at level 1. */
  base: Record<Attr, number>
  life: { base: number; perLevel: number; perVit: number }
  mana: { base: number; perLevel: number; perEne: number }
  /** How auto-allocation splits each level's five points. */
  autoAttr: Record<Attr, number>
  trees: [string, string, string]
  /** The plain swing every class falls back on. */
  weakSwing: number
}

export const ATTR_POINTS_PER_LEVEL = 5

export const ATTR_NAMES: Record<Attr, string> = { str: '力量', dex: '敏捷', vit: '體力', ene: '精力' }
export const ATTR_HINTS: Record<Attr, string> = {
  str: '物理傷害、裝備需求',
  dex: '防禦、格擋',
  vit: '生命',
  ene: '法力',
}
export const ATTRS = Object.keys(ATTR_NAMES) as Attr[]

export const CLASSES: Record<ClassId, ClassDef> = {
  barbarian: {
    name: '野蠻人',
    blurb: '來自北方的戰士。近身揮砍、戰吼鼓舞，皮糙肉厚。',
    color: '#d08040',
    base: { str: 30, dex: 20, vit: 25, ene: 10 },
    life: { base: 55, perLevel: 2, perVit: 4 },
    mana: { base: 10, perLevel: 1, perEne: 1 },
    autoAttr: { str: 2, dex: 1, vit: 2, ene: 0 },
    trees: ['戰鬥技能', '戰鬥精通', '戰吼'],
    weakSwing: 1,
  },
  sorceress: {
    name: '女巫',
    blurb: '駕馭火焰、冰霜與閃電的施法者。傷害驚人，但身子單薄。',
    color: '#8080ff',
    base: { str: 10, dex: 25, vit: 10, ene: 35 },
    life: { base: 40, perLevel: 1, perVit: 2 },
    mana: { base: 35, perLevel: 2, perEne: 2 },
    autoAttr: { str: 1, dex: 0, vit: 3, ene: 1 },
    trees: ['火焰法術', '冰冷法術', '閃電法術'],
    weakSwing: 0.6,
  },
  necromancer: {
    name: '死靈法師',
    blurb: '操弄死亡的術士。驅使骷髏大軍、施放詛咒、引爆屍體。',
    color: '#80c080',
    base: { str: 15, dex: 25, vit: 15, ene: 25 },
    life: { base: 45, perLevel: 1.5, perVit: 2 },
    mana: { base: 25, perLevel: 2, perEne: 2 },
    autoAttr: { str: 1, dex: 0, vit: 3, ene: 1 },
    trees: ['召喚術', '詛咒', '毒與骨'],
    weakSwing: 0.7,
  },
}

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[]
