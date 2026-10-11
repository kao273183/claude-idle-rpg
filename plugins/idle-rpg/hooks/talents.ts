import type { Character, ClassId } from '../types'

import { xpToNext } from './monsters'

/** The highest a hero's level goes; past it, experience grows talents instead. */
export const MAX_LEVEL = 99

/** What talents can add up to: plain bonuses, and a few that change how a fight goes. */
export type TalentEffect = Partial<{
  dmgPct: number
  physPct: number
  firePct: number
  coldPct: number
  lightPct: number
  poisonPct: number
  magicPct: number
  lifePct: number
  manaPct: number
  defPct: number
  res: number
  crit: number
  critDmg: number
  dr: number
  block: number
  leech: number
  mf: number
  gf: number
  manaRegenPct: number
  minionPct: number
  potionPct: number
  /** Cooldowns shortened, in percent. */
  cdr: number
  /** Damage of skills that strike every monster, in percent. */
  aoePct: number
  skills: number
  // ── Keystones ──
  /** Damage while below half life, in percent. */
  lowLifeDmg: number
  /** Damage to monsters below 30% life, in percent. */
  execute: number
  /** Survive a killing blow at this share of life, once a minute. */
  cheatDeath: number
  /** Single-target attacks splash this share onto the rest of the pack. */
  splash: number
  /** Share of each blow taken from mana instead of life. */
  manaShield: number
  /** Damage to chilled monsters, in percent. */
  chilledBonus: number
  /** Fire spells chill too. */
  fusion: number
  /** More skeletons and skeletal mages. */
  extraMinions: number
  /** Servants burst for this share of their life when they fall. */
  minionExplode: number
  /** Share of servants' damage that heals the hero. */
  minionLeech: number
  /** Damage to cursed monsters, in percent. */
  cursedBonus: number
  /** Life and mana regained on each kill, in percent. */
  onKillHeal: number
  /** Corpse explosion without a cooldown, and stronger. */
  corpseMaster: number
}>

export type TalentNode = {
  id: string
  name: string
  kind: 'minor' | 'notable' | 'keystone'
  max: number
  effect: (rank: number) => TalentEffect
  describe: (rank: number) => string
  /** Of the two keystones at a branch's end, only one. */
  rival?: string
}

export type TalentBranch = { name: string; color: string; nodes: TalentNode[] }

const minor = (id: string, name: string, key: keyof TalentEffect, per: number, text: string): TalentNode => ({
  id,
  name,
  kind: 'minor',
  max: 3,
  effect: r => ({ [key]: per * r }),
  describe: r => text.replace('#', String(per * Math.max(1, r))),
})

const notable = (id: string, name: string, effect: TalentEffect, text: string): TalentNode => ({
  id,
  name,
  kind: 'notable',
  max: 1,
  effect: () => effect,
  describe: () => text,
})

const keystone = (id: string, name: string, rival: string, effect: TalentEffect, text: string): TalentNode => ({
  id,
  name,
  kind: 'keystone',
  max: 1,
  rival,
  effect: () => effect,
  describe: () => text,
})

export const TALENTS: Record<ClassId, TalentBranch[]> = {
  barbarian: [
    {
      name: '殺戮',
      color: '#e05030',
      nodes: [
        minor('b.edge', '鋒刃', 'physPct', 4, '物理傷害 +#%'),
        minor('b.lethal', '致命', 'crit', 1, '爆擊率 +#%'),
        notable('b.carnage', '血腥屠戮', { critDmg: 30 }, '爆擊傷害 +30%'),
        minor('b.fury', '狂怒', 'dmgPct', 3, '所有傷害 +#%'),
        minor('b.thirst', '嗜血', 'leech', 1, '生命竊取 +#%'),
        keystone('b.bloodrage', '浴血狂戰', 'b.executioner', { lowLifeDmg: 60 }, '生命低於 50% 時，傷害 +60%'),
        keystone('b.executioner', '處刑者', 'b.bloodrage', { execute: 80 }, '對生命低於 30% 的敵人，傷害 +80%'),
      ],
    },
    {
      name: '鋼鐵',
      color: '#a0a8b8',
      nodes: [
        minor('b.hide', '厚皮', 'lifePct', 4, '最大生命 +#%'),
        minor('b.wall', '鐵壁', 'defPct', 8, '防禦 +#%'),
        notable('b.mountain', '不動如山', { dr: 8 }, '受到的物理傷害 -8%'),
        minor('b.ward', '元素抵抗', 'res', 5, '全抗性 +#%'),
        minor('b.parry', '格擋', 'block', 2, '格擋率 +#%'),
        keystone('b.undying', '不屈', 'b.fortress', { cheatDeath: 30 }, '受到致命傷時以 30% 生命存活（每 60 秒一次）'),
        keystone('b.fortress', '鋼鐵堡壘', 'b.undying', { defPct: 100, dmgPct: -15 }, '防禦 +100%，但傷害 -15%'),
      ],
    },
    {
      name: '戰吼',
      color: '#e0b040',
      nodes: [
        minor('b.command', '號令', 'cdr', 5, '技能冷卻 -#%'),
        minor('b.sweep', '橫掃', 'aoePct', 6, '範圍技能傷害 +#%'),
        notable('b.instinct', '戰場直覺', { mf: 25, gf: 25 }, '魔法尋獲 +25%、金幣尋獲 +25%'),
        minor('b.echo', '迴響', 'manaRegenPct', 15, '法力回復 +#%'),
        minor('b.vigor', '熱血', 'potionPct', 15, '藥水回復量 +#%'),
        keystone('b.quake', '震地', 'b.warlord', { splash: 40 }, '單體攻擊會波及其餘敵人，造成 40% 傷害'),
        keystone('b.warlord', '戰神', 'b.quake', { skills: 1 }, '所有技能 +1'),
      ],
    },
  ],
  sorceress: [
    {
      name: '烈焰',
      color: '#ff7030',
      nodes: [
        minor('s.kindle', '火焰親和', 'firePct', 6, '火焰傷害 +#%'),
        minor('s.flare', '烈焰', 'crit', 1, '爆擊率 +#%'),
        notable('s.wildfire', '燎原', { aoePct: 15 }, '範圍技能傷害 +15%'),
        minor('s.blaze', '熾熱', 'firePct', 6, '火焰傷害 +#%'),
        minor('s.ash', '灰燼', 'critDmg', 10, '爆擊傷害 +#%'),
        keystone('s.fusion', '冰火交融', 's.starfall', { fusion: 1, dmgPct: 20 }, '火焰法術也會凍傷敵人，所有傷害 +20%'),
        keystone('s.starfall', '隕落之星', 's.fusion', { cdr: 40 }, '技能冷卻 -40%'),
      ],
    },
    {
      name: '寒冰',
      color: '#80c8ff',
      nodes: [
        minor('s.frost', '寒霜', 'coldPct', 6, '冰冷傷害 +#%'),
        minor('s.iceskin', '冰膚', 'defPct', 10, '防禦 +#%'),
        notable('s.glacier', '寒冰護體', { dr: 8 }, '受到的物理傷害 -8%'),
        minor('s.aegis', '霜之庇護', 'res', 5, '全抗性 +#%'),
        minor('s.vital', '凜冬之心', 'lifePct', 5, '最大生命 +#%'),
        keystone('s.manashield', '法力護盾', 's.permafrost', { manaShield: 30 }, '受到的傷害有 30% 由法力承受'),
        keystone('s.permafrost', '永凍', 's.manashield', { chilledBonus: 40 }, '對凍傷的敵人，傷害 +40%'),
      ],
    },
    {
      name: '雷霆',
      color: '#fff070',
      nodes: [
        minor('s.spark', '電光', 'lightPct', 6, '閃電傷害 +#%'),
        minor('s.well', '法力之泉', 'manaPct', 6, '最大法力 +#%'),
        notable('s.surge', '電湧', { crit: 5 }, '爆擊率 +5%'),
        minor('s.flow', '奔流', 'manaRegenPct', 15, '法力回復 +#%'),
        minor('s.fortune', '天啟', 'mf', 8, '魔法尋獲 +#%'),
        keystone('s.arcane', '奧術湧動', 's.wrath', { cdr: 25, manaRegenPct: 60 }, '技能冷卻 -25%、法力回復 +60%'),
        keystone('s.wrath', '雷霆之怒', 's.arcane', { critDmg: 80, lifePct: -15 }, '爆擊傷害 +80%，但最大生命 -15%'),
      ],
    },
  ],
  necromancer: [
    {
      name: '召喚',
      color: '#c8c0a8',
      nodes: [
        minor('n.bond', '靈魂羈絆', 'minionPct', 5, '召喚物生命與傷害 +#%'),
        minor('n.marrow', '骨髓', 'minionPct', 5, '召喚物生命與傷害 +#%'),
        notable('n.bonelord', '骸骨君主', { extraMinions: 2 }, '骷髏戰士與骷髏法師各多 2 名'),
        minor('n.legion', '軍團', 'minionPct', 5, '召喚物生命與傷害 +#%'),
        minor('n.ward', '亡者之盾', 'lifePct', 4, '最大生命 +#%'),
        keystone('n.burst', '亡者爆裂', 'n.siphon', { minionExplode: 50 }, '僕從倒下時爆炸，對所有敵人造成其生命 50% 的火焰傷害'),
        keystone('n.siphon', '生命虹吸', 'n.burst', { minionLeech: 5 }, '僕從造成的傷害有 5% 化為你的生命'),
      ],
    },
    {
      name: '詛咒',
      color: '#c060ff',
      nodes: [
        minor('n.malice', '惡意', 'cursedBonus', 6, '對被詛咒的敵人傷害 +#%'),
        minor('n.haste', '疾咒', 'cdr', 5, '技能冷卻 -#%'),
        notable('n.dread', '恐懼領域', { dr: 6, res: 10 }, '受到的物理傷害 -6%、全抗性 +10%'),
        minor('n.pact', '血契', 'manaPct', 6, '最大法力 +#%'),
        minor('n.omen', '凶兆', 'mf', 8, '魔法尋獲 +#%'),
        keystone('n.reaper', '靈魂收割', 'n.doom', { onKillHeal: 5 }, '每次擊殺回復 5% 生命與法力'),
        keystone('n.doom', '末日', 'n.reaper', { cursedBonus: 50 }, '對被詛咒的敵人傷害再 +50%'),
      ],
    },
    {
      name: '毒骨',
      color: '#60e040',
      nodes: [
        minor('n.bone', '骨刃', 'magicPct', 6, '魔法傷害 +#%'),
        minor('n.venom', '毒液', 'poisonPct', 6, '毒素傷害 +#%'),
        notable('n.bonewall', '骨牆', { dr: 8 }, '受到的物理傷害 -8%'),
        minor('n.splinter', '碎骨', 'crit', 1, '爆擊率 +#%'),
        minor('n.marrowcrit', '穿髓', 'critDmg', 10, '爆擊傷害 +#%'),
        keystone('n.corpse', '屍體狂潮', 'n.plague', { corpseMaster: 1 }, '屍爆沒有冷卻，傷害 +50%'),
        keystone('n.plague', '劇毒新星', 'n.corpse', { poisonPct: 60, magicPct: 20 }, '毒素傷害 +60%、魔法傷害 +20%'),
      ],
    },
  ],
}

export const talentRank = (c: Character, id: string) => c.talents[id] ?? 0

/** Talent points the hero has earned in all: one per level past the cap, and the rest from experience at it. */
export const talentPointsLeft = (c: Character) => c.talentEarned - Object.values(c.talents).reduce((sum, r) => sum + r, 0)

/** Experience a talent point costs at the cap, a little more each time. */
export const talentCost = (earned: number) => Math.round(xpToNext(MAX_LEVEL) * 0.25 * Math.pow(1.06, earned))

const nodeAt = (c: Character, id: string) => {
  for (const branch of TALENTS[c.classId]) {
    const index = branch.nodes.findIndex(n => n.id === id)
    if (index >= 0) return { branch, index, node: branch.nodes[index]! }
  }

  return undefined
}

/** Whether a node can take a point: one to spare, the one before it taken, below its max, its rival not taken. */
export const canTakeTalent = (c: Character, id: string) => {
  const at = nodeAt(c, id)
  if (!at || talentPointsLeft(c) <= 0 || talentRank(c, id) >= at.node.max) return false
  if (at.node.rival && talentRank(c, at.node.rival) > 0) return false
  // The two keystones both hang from the fifth node.
  const before = at.node.kind === 'keystone' ? at.branch.nodes[4] : at.branch.nodes[at.index - 1]

  return !before || talentRank(c, before.id) > 0
}

export const takeTalent = (c: Character, id: string): Character =>
  canTakeTalent(c, id) ? { ...c, talents: { ...c.talents, [id]: talentRank(c, id) + 1 } } : c

/** The way auto-allocation walks each class's tree. */
const TALENT_PATHS: Record<ClassId, string[]> = {
  barbarian: ['b.hide', 'b.edge', 'b.wall', 'b.lethal', 'b.mountain', 'b.carnage', 'b.ward', 'b.parry', 'b.undying', 'b.fury', 'b.thirst', 'b.bloodrage', 'b.command', 'b.sweep', 'b.instinct', 'b.echo', 'b.vigor', 'b.quake'],
  sorceress: ['s.kindle', 's.iceskin', 's.flare', 's.frost', 's.glacier', 's.wildfire', 's.aegis', 's.vital', 's.manashield', 's.blaze', 's.ash', 's.fusion', 's.spark', 's.well', 's.surge', 's.flow', 's.fortune', 's.arcane'],
  necromancer: ['n.bond', 'n.marrow', 'n.bonelord', 'n.legion', 'n.ward', 'n.siphon', 'n.malice', 'n.haste', 'n.dread', 'n.pact', 'n.omen', 'n.reaper', 'n.bone', 'n.venom', 'n.bonewall', 'n.splinter', 'n.marrowcrit', 'n.corpse'],
}

export const autoTalents = (c: Character): Character => {
  let next = c
  for (;;) {
    const id = TALENT_PATHS[next.classId].find(t => canTakeTalent(next, t))
    if (!id) return next
    next = takeTalent(next, id)
  }
}

export const talentRespecCost = (c: Character) => Math.round(c.level * c.level * 50)

export const respecTalents = (c: Character): Character =>
  c.gold < talentRespecCost(c) ? c : { ...c, gold: c.gold - talentRespecCost(c), talents: {}, autoTalent: false }

const cache = new WeakMap<Record<string, number>, Required<TalentEffect>>()
const ZERO = (): Required<TalentEffect> => ({
  dmgPct: 0, physPct: 0, firePct: 0, coldPct: 0, lightPct: 0, poisonPct: 0, magicPct: 0, lifePct: 0, manaPct: 0, defPct: 0,
  res: 0, crit: 0, critDmg: 0, dr: 0, block: 0, leech: 0, mf: 0, gf: 0, manaRegenPct: 0, minionPct: 0, potionPct: 0,
  cdr: 0, aoePct: 0, skills: 0, lowLifeDmg: 0, execute: 0, cheatDeath: 0, splash: 0, manaShield: 0, chilledBonus: 0,
  fusion: 0, extraMinions: 0, minionExplode: 0, minionLeech: 0, cursedBonus: 0, onKillHeal: 0, corpseMaster: 0,
})

/** Everything the hero's talents add up to. */
export const talentTotals = (c: Character): Required<TalentEffect> => {
  const hit = cache.get(c.talents)
  if (hit) return hit
  const total = ZERO()
  for (const branch of TALENTS[c.classId]) {
    for (const node of branch.nodes) {
      const r = talentRank(c, node.id)
      if (r <= 0) continue
      const effect = node.effect(r)
      for (const key of Object.keys(effect) as (keyof TalentEffect)[]) total[key] += effect[key] ?? 0
    }
  }
  cache.set(c.talents, total)

  return total
}

/** Experience earned at the cap becomes talent points. */
export const growTalents = (c: Character, xp: number): { c: Character; gained: number } => {
  let next = { ...c, talentXp: c.talentXp + xp }
  let gained = 0
  while (next.talentXp >= talentCost(next.talentEarned)) {
    next = { ...next, talentXp: next.talentXp - talentCost(next.talentEarned), talentEarned: next.talentEarned + 1 }
    gained++
  }

  return { c: next, gained }
}
