import type { Character } from '../types'

import { makeItem, SOCKET_MAX, SLOTS } from './loot'
import { AREAS_PER_DIFFICULTY, placeOf } from './monsters'
import { RUNES } from './runes'

type Rng = () => number

export type QuestDef = {
  id: string
  act: number
  name: string
  /** Clearing this area, counted within a difficulty, finishes it. */
  area: number
  goal: string
  reward: string
  apply: (c: Character, rng: Rng) => Character
}

const bonus = (c: Character, change: Partial<Character['questBonus']>): Character => ({
  ...c,
  questBonus: {
    skill: c.questBonus.skill + (change.skill ?? 0),
    attr: c.questBonus.attr + (change.attr ?? 0),
    lifePct: c.questBonus.lifePct + (change.lifePct ?? 0),
    res: c.questBonus.res + (change.res ?? 0),
  },
})

const giveItem = (c: Character, rarity: 2 | 3, rng: Rng): Character => {
  const item = { ...makeItem(c.zone, rarity, c.nextItemId, rng), unid: undefined }

  return { ...c, bag: [...c.bag, item], nextItemId: c.nextItemId + 1 }
}

export const QUESTS: QuestDef[] = [
  {
    id: 'den', act: 0, name: '邪惡洞穴', area: 0,
    goal: '肅清血腥荒地', reward: '技能點 +1',
    apply: c => bonus(c, { skill: 1 }),
  },
  {
    id: 'burial', act: 0, name: '姊妹的墓地', area: 2,
    goal: '肅清埋骨之地', reward: '一件稀有裝備',
    apply: (c, rng) => giveItem(c, 2, rng),
  },
  {
    id: 'radament', act: 1, name: '拉達曼特的巢穴', area: 6,
    goal: '肅清失落之城', reward: '技能點 +1',
    apply: c => bonus(c, { skill: 1 }),
  },
  {
    id: 'tombs', act: 1, name: '七座古墓', area: 7,
    goal: '擊敗痛苦之王', reward: '一件暗金裝備',
    apply: (c, rng) => giveItem(c, 3, rng),
  },
  {
    id: 'goldenBird', act: 2, name: '金鳥', area: 9,
    goal: '肅清剝皮叢林', reward: '最大生命永久 +5%',
    apply: c => bonus(c, { lifePct: 5 }),
  },
  {
    id: 'tome', act: 2, name: '蘭伊森之書', area: 10,
    goal: '肅清腐敗集市', reward: '屬性點 +5',
    apply: c => bonus(c, { attr: 5 }),
  },
  {
    id: 'fallenAngel', act: 3, name: '墮落天使', area: 13,
    goal: '肅清絕望平原', reward: '技能點 +2',
    apply: c => bonus(c, { skill: 2 }),
  },
  {
    id: 'forge', act: 3, name: '地獄熔爐', area: 14,
    goal: '肅清火焰之河', reward: '三個隨機符文',
    apply: (c, rng) => {
      const runes = [...c.runes]
      for (let k = 0; k < 3; k++) runes[Math.floor(rng() * Math.min(RUNES.length, 12))]! += 1

      return { ...c, runes }
    },
  },
  {
    id: 'siege', act: 4, name: '鐵匠之魂', area: 16,
    goal: '肅清血腥丘陵', reward: '身上一件裝備免費打一孔',
    apply: c => {
      const slot = SLOTS.find(s => {
        const item = c.equipment[s]

        return item && !item.set && !item.runeword && item.sockets < SOCKET_MAX[s]
      })
      const item = slot ? c.equipment[slot] : null
      if (!slot || !item) return bonus(c, { attr: 2 })

      return { ...c, equipment: { ...c.equipment, [slot]: { ...item, sockets: item.sockets + 1 } } }
    },
  },
  {
    id: 'anya', act: 4, name: '拯救安雅', area: 17,
    goal: '肅清冰凍高地', reward: '全抗性永久 +10%',
    apply: c => bonus(c, { res: 10 }),
  },
]

export const questKey = (difficulty: number, id: string) => `${difficulty}:${id}`

/** The quest an area's clearing finishes, if any is still open for this difficulty. */
export const questFor = (c: Character, zone: number) => {
  const place = placeOf(zone)
  if (place.beyond > 0) return undefined
  const area = zone % AREAS_PER_DIFFICULTY
  const quest = QUESTS.find(q => q.area === area)

  return quest && !c.quests.includes(questKey(place.difficulty, quest.id)) ? { quest, difficulty: place.difficulty } : undefined
}

export const emptyQuestBonus = (): Character['questBonus'] => ({ skill: 0, attr: 0, lifePct: 0, res: 0 })

/** What each act says as the hero arrives. */
export const ACT_INTROS = [
  '流浪者營地的火光搖曳。修道院已經淪陷，痛苦魔女在地窖深處等著你。',
  '沙漠的熱風吹過綠洲。古王之墓裡，有什麼比死亡更古老的東西甦醒了。',
  '港口瀰漫著腐敗的氣味。叢林深處，憎恨之王的牢籠正在低語。',
  '天堂要塞矗立在地獄邊緣。跨過火焰之河，就是恐懼之王的庇護所。',
  '北境要塞被圍困著。世界之石正遭受侵蝕，毀滅之王就在山巔。',
] as const
