export type ClassId = 'barbarian' | 'sorceress' | 'necromancer'

export type Attr = 'str' | 'dex' | 'vit' | 'ene'

/** What a piece of gear is. */
export type GearKind = 'weapon' | 'offhand' | 'helm' | 'armor' | 'gloves' | 'belt' | 'boots' | 'amulet' | 'ring'

/** Where gear is worn: a slot for each kind, and a second ring. */
export type Slot = GearKind | 'ring2'

/** 0 normal, 1 magic, 2 rare, 3 unique, 4 set, 5 runeword. */
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5

/** Where an item goes: worn in a slot, or carried as a charm. */
export type ItemSlot = GearKind | 'charm'

export type CharmSize = 'small' | 'large' | 'grand'

export type Stats = {
  atk?: number
  def?: number
  hp?: number
  crit?: number
  gf?: number
  res?: number
  /** Magic find: better rarities. */
  mf?: number
  /** Life stolen from each blow, in percent. */
  ls?: number
  /** Added to every learned skill. */
  skills?: number
  /** Chance to block a blow, in percent. */
  block?: number
  /** Spell damage, in percent. */
  spell?: number
  /** Servants' life and damage, in percent. */
  minion?: number
  mana?: number
}

export type Element = 'phys' | 'fire' | 'cold' | 'light' | 'poison' | 'magic'

export type AffixId = 'fast' | 'strong' | 'fire' | 'cold' | 'light' | 'magicImmune' | 'stoneSkin' | 'vampiric' | 'manaBurn'

export type GemType = 'amethyst' | 'diamond' | 'ruby' | 'emerald' | 'topaz'

/** 0 chipped, 1 plain, 2 flawless, 3 perfect. */
export type GemGrade = 0 | 1 | 2 | 3

export type Gem = { type: GemType; grade: GemGrade }

export type SetId = 'night' | 'oath' | 'greed' | 'immortal' | 'tal' | 'trang'

export type Item = {
  id: number
  slot: ItemSlot
  rarity: Rarity
  name: string
  level: number
  stats: Stats
  /** Gold when sold, before its gems. */
  value: number
  sockets: number
  gems: Gem[]
  set?: SetId
  /** Attributes needed to wear it. */
  req?: { str?: number; dex?: number }
  /** Runes set in its sockets, by rune index, in order. */
  runes?: number[]
  /** The runeword its runes spell, once they do. */
  runeword?: string
  /** Its name and powers hidden until identified. */
  unid?: boolean
  /** For a charm: how much of the charm space it takes. */
  charm?: CharmSize
  /** The base family (sword, staff, heavy armour…) and its grade: 0 normal, 1 exceptional, 2 elite. */
  base?: string
  grade?: number
  /** A unique's legendary power, in talent terms, and the words for it. */
  power?: Record<string, number>
  legend?: string
}

export type Equipment = Record<Slot, Item | null>

/** Gems held, by type, counted per grade. */
export type GemPouch = Record<GemType, number[]>

/** What lingers on a monster: seconds left, and damage a second for the hurts. */
export type FoeStatus = {
  chill?: number
  stun?: number
  burn?: { dps: number; left: number }
  poison?: { dps: number; left: number }
  curse?: { id: string; left: number; rank?: number }
}

export type Foe = {
  /** Which sprite. */
  kind: number
  /** A colour the sprite is pushed toward. */
  tint?: number
  /** Drawn larger: act bosses. */
  scale?: number
  name: string
  hp: number
  maxHp: number
  atk: number
  /** What its blows deal. */
  element: Element
  /** Resistances in percent; 100 or more is immunity. */
  res: Partial<Record<Element, number>>
  /** Champions come in blue packs, uniques lead minions, bosses end an act. */
  elite?: 'champion' | 'unique' | 'boss'
  affixes: AffixId[]
  /** The act's boss. */
  isBoss: boolean
  xp: number
  gold: number
  status: FoeStatus
}

export type MinionKind = 'skeleton' | 'mage' | 'golem' | 'bloodgolem' | 'revive'

export type Minion = { id: number; kind: MinionKind; hp: number; maxHp: number }

export type Rift = {
  tier: number
  /** 0 to 100: the guardian comes at 100. */
  progress: number
  /** Seconds left on the clock; below zero the rift still ends, but late. */
  timeLeft: number
  hasGuardian: boolean
  /** Which act's look the rift wears. */
  look: number
}

export type RiftResult = { tier: number; seconds: number; isInTime: boolean; gem?: string }

export type Character = {
  classId: ClassId
  level: number
  xp: number
  gold: number
  /** Points spent on each attribute, above the class's base. */
  attrs: Record<Attr, number>
  hp: number
  mana: number
  skills: Record<string, number>
  /** The attack the hero leads with; buffs, curses and summons keep themselves up. */
  mainSkill: string | null
  autoAttr: boolean
  autoSkill: boolean
  /** Buys potions on the road when the belt runs low. */
  autoPotion: boolean
  belt: { red: number; blue: number }
  cooldowns: Record<string, number>
  /** Hero buffs, seconds left. */
  buffs: Record<string, number>
  /** Damage still absorbed (bone armor, energy shield). */
  shield: number
  minions: Minion[]
  nextMinionId: number
  foes: Foe[]
  /** Seconds left lying dead before the hero gets up again. */
  deadFor: number
  /** A fallen monster's max life, for corpse explosion. */
  corpse: number
  zone: number
  maxZone: number
  /** Packs cleared in the current area. */
  packs: number
  /** Deaths in this area since the last cleared pack; three send the hero back an area. */
  areaDeaths: number
  /** After falling back, the level the hero must reach before pushing into new ground again. */
  retryLevel: number
  /** Seconds the hero stays slowed by cold. */
  chilled: number
  autoAdvance: boolean
  totalKills: number
  deaths: number
  walk: number
  distance: number
  equipment: Equipment
  bag: Item[]
  gems: GemPouch
  /** Runes held, counted by rune index. */
  runes: number[]
  /** Charms carried, each working while carried. */
  charms: Item[]
  autoIdentify: boolean
  /** Quests done, as `difficulty:id`. */
  quests: string[]
  /** What quests have granted for good. */
  questBonus: { skill: number; attr: number; lifePct: number; res: number }
  /** Talent points spent, by node. */
  talents: Record<string, number>
  /** Experience banked toward the next talent point, at the level cap. */
  talentXp: number
  /** Talent points earned in all. */
  talentEarned: number
  autoTalent: boolean
  /** The greater rift under way, if any. */
  rift: Rift | null
  /** Keystones held: one opens a rift. */
  keys: number
  /** The tier the next rift opens at. */
  riftTier: number
  /** The highest tier cleared in time. */
  riftBest: number
  /** Opens rifts by itself while keystones last, pushing the tier as far as it holds. */
  autoRift: boolean
  riftLast: RiftResult | null
  autoEquip: boolean
  nextItemId: number
}

export type Game = {
  version: 2
  active: ClassId | null
  chars: Partial<Record<ClassId, Character>>
  /** Shared by every hero. */
  stash: Item[]
  lastSeen: number
}

export type View = 'battle' | 'char' | 'skills' | 'gear' | 'gems' | 'odds' | 'select' | 'town' | 'cube' | 'quests' | 'rift'

export type LogLine = { text: string; color?: string }

/** The socketing bench: which worn item is chosen, and whether every runeword is listed. */
export type GemUi = { slot: number; allWords: boolean }

declare module 'claude-code' {
  interface PluginState {
    'idle-rpg': { game: Game; log: LogLine[]; view: View; tree: number; inspect: number; gemUi: GemUi }
  }
}
