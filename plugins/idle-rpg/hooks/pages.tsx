import type { Elements, RenderNode, RenderSurface } from 'claude-code'

import type { Character, ClassId, Foe, Game, Gem, GemGrade, GemUi, Item, Slot, View } from '../types'
import {
  attrOf,
  attrPointsLeft,
  BELT_SIZE,
  bestMainSkill,
  buyPotion,
  canWear,
  heroPower,
  heroStats,
  potionPrice,
  clampVitals,
  raiseAttr,
  raiseSkill,
  rankOf,
  respecCost,
  respecSkills,
  skillDamage,
  skillPointsLeft,
} from './character'
import { ATTR_HINTS, ATTR_NAMES, ATTRS, CLASS_IDS, CLASSES } from './classes'
import {
  activeSets,
  BAG_SIZE,
  bonusText,
  combineGems,
  DROP_TIER_NAMES,
  DROP_TIERS,
  dropOdds,
  CHARM_SIZES,
  CHARM_SPACE,
  charmCells,
  dropCharm,
  baseText,
  equip,
  gamble,
  gambleCost,
  GEM_IDS,
  identifyAll,
  shownName,
  usedSockets,
  STAT_KEYS,
  STAT_NAMES,
  punchCost,
  punchSocket,
  SOCKET_MAX,
  STASH_SIZE,
  GEM_TYPES,
  gemName,
  gemStats,
  itemStats,
  GEMS_TO_COMBINE,
  RARITIES,
  sell,
  sellAll,
  sellValue,
  SETS,
  SLOT_NAMES,
  SLOTS,
  socketGem,
  statText,
  unequip,
} from './loot'
import {
  ACTS,
  AFFIXES,
  AREAS_PER_ACT,
  AREAS_PER_DIFFICULTY,
  DIFFICULTIES,
  formatNumber,
  newPack,
  PACKS_PER_AREA,
  placeOf,
  WALK_SECONDS,
  zoneName,
} from './monsters'
import {
  chippedGems,
  combineAllGems,
  cubeCandidates,
  perfectGems,
  CUBE_RECIPES,
  runewordOf,
  maxRuneAt,
  RUNE_COLOR,
  RUNE_DROP_CHANCE,
  runeName,
  runeUpgradeCost,
  RUNES,
  runewordsFor,
  RUNEWORDS,
  runCube,
  socketRune,
  upgradeRune,
} from './runes'
import { classSkills, MAX_SKILL_RANK } from './skilltree'
import { GEAR_KINDS } from './items'
import { QUESTS, questKey } from './quests'
import {
  canTakeTalent,
  MAX_LEVEL,
  respecTalents,
  talentCost,
  talentPointsLeft,
  talentRank,
  talentRespecCost,
  TALENTS,
  takeTalent,
} from './talents'
import { BLESSING_MF, FOCUS_MAX, FOCUS_PCT, FOCUS_PER_CALL } from './coding'
import { deathGoldCap } from './combat'
import { formatClock, isRiftOpen, KEY_DROP_CHANCE, RIFT_SECONDS, RIFT_UNLOCK_ZONE, startRift, TIER_STEP } from './rift'

export const GOLD = '#c7b377'
export const BLOOD = '#b01818'
const DIM_RED = '#a04040'
const RIFT_COLOR = '#c060ff'
const GREEN = '#40c040'
const SET_COLOR = RARITIES[4].color

// Hotkeys: c t i g u h j y o w are the tabs on every page; the bag's rows take what is left.
const BAG_KEYS = 'abdefklmnprv'
const TREE_KEYS = ['z', 'x', 'v'] as const
const TALENT_KEYS = ['b', 'n', 'm'] as const

export type PageCtx = {
  els: Elements[RenderSurface]
  game: Game
  char: Character
  view: View
  tree: number
  /** Changes the active character, saving it. */
  persist: (fn: (c: Character) => Character | null) => void
  /** Changes the whole game: the stash, which every hero shares. */
  persistGame: (fn: (g: Game) => Game | null) => void
  setView: (v: View) => () => void
  setTree: (n: number) => () => void
  selectClass: (id: ClassId) => () => void
  toast: (text: string) => void
  /** The item whose tooltip is open, 0 for none. */
  inspect: number
  setInspect: (id: number) => () => void
  gemUi: GemUi
  setGemUi: (next: GemUi) => void
}

const rarityColor = (item: Item) => RARITIES[item.rarity].color
const pct = (p: number) => (p >= 0.1 ? `${Math.round(p * 100)}%` : `${(p * 100).toFixed(1)}%`)

/** ◆ for each gem set in the item, ● for each rune, ◇ for each socket still empty. */
const socketMarks = (item: Item) => [
  ...item.gems.map(gem => ({ mark: '◆', color: GEM_TYPES[gem.type].color })),
  ...(item.runes ?? []).map(() => ({ mark: '●', color: RUNE_COLOR })),
  ...Array.from({ length: Math.max(0, item.sockets - usedSockets(item)) }, () => ({ mark: '◇', color: '#808080' })),
]

const bar = (value: number, max: number, width: number) => {
  const filled = Math.max(0, Math.min(width, Math.round((value / Math.max(1, max)) * width)))

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const Tabs = ({ els, view, char, setView }: PageCtx) => {
  const { Box, Button } = els
  const tab = (key: View, hotkey: string, label: string) => (
    <Button key={`tab-${key}`} hotkey={hotkey} plain={view !== key ? true : undefined} label={view === key ? `【${label}】` : label} onPress={setView(key)} />
  )
  const skillPts = skillPointsLeft(char) + Math.max(0, talentPointsLeft(char))
  const attrPts = attrPointsLeft(char)

  return (
    <Box columnGap={1} flexWrap="wrap">
      {tab('battle', 'w', '戰鬥')}
      {tab('char', 'c', attrPts > 0 ? `角色 +${attrPts}` : '角色')}
      {tab('skills', 't', skillPts > 0 ? `技能 +${skillPts}` : '技能')}
      {tab('gear', 'i', `物品 ${char.bag.length}/${BAG_SIZE}`)}
      {tab('gems', 'g', '寶石符文')}
      {tab('cube', 'u', '方塊')}
      {tab('town', 'h', '城鎮')}
      {tab('quests', 'j', '任務')}
      {tab('rift', 'y', char.rift ? '秘境中' : '秘境')}
      {tab('odds', 'o', '掉落')}
    </Box>
  )
}

// ── Battle ─────────────────────────────────────────────────────────────────
export type LogLine = { text: string; color?: string }

export const BattlePage = (ctx: PageCtx & { scene: RenderNode; hud: RenderNode; log: LogLine[] }) => {
  const { els, char, persist, setView } = ctx
  const { Box, Text, Button } = els
  const cls = CLASSES[char.classId]
  const foe = char.foes.find(f => f.hp > 0)
  const actives = classSkills(char.classId).filter(s => s.kind !== 'passive' && rankOf(char, s.id) > 0)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text>
          <Text bold color={cls.color}>
            {cls.name}
          </Text>
          <Text dimColor> Lv.{char.level}　</Text>
          <Text bold color={char.rift ? RIFT_COLOR : GOLD}>
            {char.rift ? `大秘境 第 ${char.rift.tier} 層` : zoneName(char.zone)}
          </Text>
          <Text dimColor>　</Text>
          {char.rift ? (
            <Text>
              <Text color={RIFT_COLOR}>{bar(char.rift.progress, 100, 16)}</Text>
              <Text dimColor> {Math.floor(char.rift.progress)}%　</Text>
              <Text color={char.rift.timeLeft > 60 ? undefined : DIM_RED} bold={char.rift.timeLeft <= 60}>
                ⧗ {formatClock(char.rift.timeLeft)}
              </Text>
              {char.rift.hasGuardian && <Text color={BLOOD}> ☠ 守護者</Text>}
            </Text>
          ) : char.foes.some(f => f.isBoss && f.hp > 0) ? (
            <Text bold color={BLOOD}>
              ☠ 幕首領
            </Text>
          ) : (
            <Text dimColor>
              區域進度 {Math.min(char.packs + 1, PACKS_PER_AREA)}/{PACKS_PER_AREA}
              {char.retryLevel > char.level ? `　（Lv.${char.retryLevel} 前在此鍛鍊）` : ''}
            </Text>
          )}
        </Text>
        <Box flexDirection="column" borderStyle="round" borderColor="#6a5020">
          {ctx.scene}
          {ctx.hud}
        </Box>
        {char.deadFor > 0 ? (
          <Text bold color={BLOOD}>
            你已死亡…… {char.deadFor} 秒後復活
          </Text>
        ) : char.walk > 0 || !foe ? (
          <Text dimColor>前方傳來低沉的嘶吼……</Text>
        ) : (
          <Box flexDirection="column">{packLines(char.foes).map(line => foeLine(els, line))}</Box>
        )}
        <Text>
          {actives.map(s => {
            const cd = char.cooldowns[s.id] ?? 0
            const isMain = char.mainSkill === s.id

            return (
              <Text color={cd === 0 ? (isMain ? GOLD : '#c0b8a8') : undefined} dimColor={cd > 0} bold={isMain}>
                {isMain ? '▸' : ''}
                {s.name}
                {cd > 0 ? ` ${cd}s` : ''}
                {'  '}
              </Text>
            )
          })}
          {char.minions.length > 0 && <Text color="#c8c0a8">僕從 ×{char.minions.length}  </Text>}
          {char.shield > 0 && <Text color="#8080ff">護盾 {formatNumber(char.shield)}</Text>}
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="#3a3020" paddingX={1}>
        {ctx.log.length === 0 && <Text dimColor>黑暗中，有什麼正在甦醒……</Text>}
        {ctx.log.map(line => (
          <Text color={line.color} dimColor={line.color === undefined}>
            {line.text}
          </Text>
        ))}
      </Box>

      <Box flexDirection="column">
        {Tabs(ctx)}
        <Box columnGap={1} flexWrap="wrap">
          <Button
            key="auto"
            hotkey="6"
            plain
            label={`自動深入：${char.autoAdvance ? '開' : '關'}`}
            onPress={() => persist(c => ({ ...c, autoAdvance: !c.autoAdvance }))}
          />
          <Button key="switch" hotkey="x" plain label="切換角色" onPress={setView('select')} />
        </Box>
      </Box>
    </Box>
  )
}

const ELITE_COLORS: Record<NonNullable<Foe['elite']>, string> = { champion: '#7090ff', unique: '#d4a84b', boss: BLOOD }

/** The pack as lines: each elite on its own, the plain monsters of a kind together. */
type PackLine = { name: string; hp: number; maxHp: number; count: number; foe: Foe }
const packLines = (foes: Foe[]): PackLine[] => {
  const lines: PackLine[] = []
  for (const f of foes) {
    if (f.hp <= 0) continue
    const same = !f.elite ? lines.find(l => !l.foe.elite && l.name === f.name) : undefined
    if (same) {
      same.hp += f.hp
      same.maxHp += f.maxHp
      same.count += 1
    } else lines.push({ name: f.name, hp: f.hp, maxHp: f.maxHp, count: 1, foe: f })
  }

  return lines
}

const IMMUNE_NAMES: Record<string, string> = { fire: '火', cold: '冰', light: '電', poison: '毒', magic: '魔法', phys: '物理' }

const foeLine = (els: PageCtx['els'], line: PackLine) => {
  const { Text } = els
  const f = line.foe
  const immune = Object.entries(f.res).filter(([, v]) => (v ?? 0) >= 100).map(([k]) => IMMUNE_NAMES[k] ?? k)

  return (
    <Text>
      <Text bold={f.elite !== undefined} color={f.elite ? ELITE_COLORS[f.elite] : '#a89a80'}>
        {line.name}
        {line.count > 1 ? ` ×${line.count}` : ''}{' '}
      </Text>
      <Text color="#7a1010">{bar(line.hp, line.maxHp, 12)}</Text>
      <Text dimColor> {formatNumber(line.hp)}</Text>
      {f.affixes.map(a => (
        <Text color={AFFIXES[a].color}> {AFFIXES[a].name}</Text>
      ))}
      {immune.length > 0 && <Text color="#c080ff"> {immune.join('・')}免疫</Text>}
      {f.status.curse && <Text color="#c060ff"> ✶</Text>}
      {(f.status.chill ?? 0) > 0 && <Text color="#80c8ff"> ❄</Text>}
      {(f.status.stun ?? 0) > 0 && <Text color="#fff070"> ✦</Text>}
    </Text>
  )
}

/** Travel by waypoint: the area's first pack, the walk there. */
const travel = (c: Character, zone: number): Character | null =>
  zone === c.zone || zone > c.maxZone || c.deadFor > 0
    ? null
    : { ...c, zone, packs: 0, areaDeaths: 0, foes: newPack(zone, 0, Math.random), walk: WALK_SECONDS }

// ── Class select ───────────────────────────────────────────────────────────
export const SelectPage = (ctx: PageCtx & { portraits: Record<ClassId, RenderNode> }) => {
  const { els, game, selectClass, setView } = ctx
  const { Box, Text, Button } = els

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={GOLD}>
        選擇你的英雄
      </Text>
      {CLASS_IDS.map((id, i) => {
        const cls = CLASSES[id]
        const existing = game.chars[id]
        const isActive = game.active === id

        return (
          <Box columnGap={2}>
            {ctx.portraits[id]}
            <Box flexDirection="column">
              <Text>
                <Text bold color={cls.color}>
                  {cls.name}
                </Text>
                {existing ? (
                  <Text dimColor>
                    {'  '}Lv.{existing.level}・{zoneName(existing.zone)}
                    {isActive ? '・出戰中' : ''}
                  </Text>
                ) : (
                  <Text dimColor>{'  '}尚未建立</Text>
                )}
              </Text>
              <Text dimColor>{cls.blurb}</Text>
              <Text dimColor>技能系：{cls.trees.join('・')}</Text>
              <Box>
                <Button
                  key={`pick-${id}`}
                  hotkey={String(i + 1)}
                  variant={isActive ? undefined : 'primary'}
                  label={isActive ? '出戰中' : existing ? '換他出戰' : '建立角色'}
                  onPress={selectClass(id)}
                />
              </Box>
            </Box>
          </Box>
        )
      })}
      <Text dimColor>同時只有一名英雄在戰鬥；其他英雄會停在原地等你回來。</Text>
      {game.active && (
        <Box>
          <Button key="tab-battle" hotkey="w" label="返回戰鬥" onPress={setView('battle')} />
        </Box>
      )}
    </Box>
  )
}

// ── Character: attributes and potions ─────────────────────────────────────
export const CharPage = (ctx: PageCtx) => {
  const { els, char, persist } = ctx
  const { Box, Text, Button } = els
  const s = heroStats(char)
  const left = attrPointsLeft(char)
  const main = char.mainSkill ?? 'attack'

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Text>
        <Text bold color={GOLD}>
          屬性
        </Text>
        <Text> 剩餘點數 </Text>
        <Text bold color={left > 0 ? GREEN : undefined} dimColor={left === 0}>
          {left}
        </Text>
        <Text dimColor>　每升一級得 5 點</Text>
      </Text>
      <Box flexDirection="column">
        {ATTRS.map((a, i) => (
          <Box columnGap={1}>
            <Button key={`attr-${a}`} hotkey={String(i + 1)} label="＋" onPress={() => persist(c => raiseAttr(c, a))} />
            <Text bold>{ATTR_NAMES[a]}</Text>
            <Text color={GOLD}>{String(attrOf(char, a)).padStart(4)}</Text>
            <Text dimColor>{ATTR_HINTS[a]}</Text>
          </Box>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text>
          <Text dimColor>生命 </Text>
          <Text color="#ff6050">{formatNumber(s.maxHp)}</Text>
          <Text dimColor>　法力 </Text>
          <Text color="#7090ff">{formatNumber(s.maxMana)}</Text>
          <Text dimColor>　法力回復 </Text>
          {s.manaRegen.toFixed(1)}/秒
        </Text>
        <Text>
          <Text dimColor>武器傷害 </Text>
          {formatNumber(s.weapon)}
          <Text dimColor>　主技能傷害 </Text>
          {formatNumber(skillDamage(char, main, s))}
          <Text dimColor>　爆擊 </Text>
          {Math.round(s.critRate * 100)}%
          <Text dimColor> ×</Text>
          {s.critMult.toFixed(1)}
        </Text>
        <Text>
          <Text dimColor>防禦 </Text>
          {formatNumber(s.def)}
          <Text dimColor>　格擋 </Text>
          {Math.round(s.block * 100)}%<Text dimColor>　減傷 </Text>
          {Math.round(s.dr * 100)}%<Text dimColor>　金幣尋獲 </Text>+{s.goldFind}%
        </Text>
        <Text>
          <Text dimColor>魔法尋獲 </Text>+{s.magicFind}%<Text dimColor>　生命竊取 </Text>
          {s.leech}%<Text dimColor>　所有技能 </Text>+{s.plusSkills}
        </Text>
        <Text>
          <Text dimColor>元素抗性 </Text>
          <Text color={s.res < 0 ? DIM_RED : s.res >= 75 ? GREEN : undefined}>{s.res}%</Text>
          <Text dimColor>
            {'  '}火・冰・電・毒共用；{DIFFICULTIES[placeOf(char.zone).difficulty]!.name}難度 -{DIFFICULTIES[placeOf(char.zone).difficulty]!.resPenalty}%，上限 75%
          </Text>
        </Text>
        <Text>
          <Text dimColor>擊殺 </Text>
          {formatNumber(char.totalKills)}
          <Text dimColor>　死亡 </Text>
          {char.deaths}
          <Text dimColor>　金幣 </Text>
          <Text color={GOLD}>{formatNumber(char.gold)}</Text>
          <Text dimColor>　死亡最多損失 {formatNumber(deathGoldCap(char.zone))}</Text>
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text bold color={GOLD}>
          寫程式的加成
        </Text>
        <Text>
          <Text color={char.focus > 0 ? '#ffd040' : undefined} dimColor={char.focus === 0}>
            ⚡ 專注 {char.focus > 0 ? formatClock(char.focus) : '—'}
          </Text>
          <Text dimColor>　Claude 每執行一次工具 +{FOCUS_PER_CALL} 秒（最多 {FOCUS_MAX / 60} 分鐘）：傷害、經驗、金幣 +{FOCUS_PCT}%</Text>
        </Text>
        <Text>
          <Text color={char.blessing > 0 ? GREEN : undefined} dimColor={char.blessing === 0}>
            ✚ 祝福 {char.blessing > 0 ? formatClock(char.blessing) : '—'}
          </Text>
          <Text dimColor>　測試通過時：生命法力全滿，魔法尋寶 +{BLESSING_MF}%，持續 10 分鐘</Text>
        </Text>
        <Text>
          <Text color={char.chestCooldown > 0 ? undefined : GOLD} dimColor={char.chestCooldown > 0}>
            ▣ 寶箱 {char.chestCooldown > 0 ? formatClock(char.chestCooldown) : '可開啟'}
          </Text>
          <Text dimColor>　每次 git commit 開一箱：金幣與稀有以上的裝備（每 10 分鐘最多一箱）</Text>
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text>
          <Text bold color={GOLD}>
            腰帶
          </Text>
          <Text color="#ff6050"> 紅藥水 {char.belt.red}/{BELT_SIZE}</Text>
          <Text color="#7090ff">　藍藥水 {char.belt.blue}/{BELT_SIZE}</Text>
          <Text dimColor>　生命低於 40%、法力低於 20% 時自動飲用</Text>
        </Text>
        <Box columnGap={1} flexWrap="wrap">
          <Button key="buy-red" hotkey="r" label={`買紅藥水 (${potionPrice(char)})`} onPress={() => persist(c => buyPotion(c, 'red'))} />
          <Button key="buy-blue" hotkey="b" label={`買藍藥水 (${potionPrice(char)})`} onPress={() => persist(c => buyPotion(c, 'blue'))} />
          <Button
            key="autopotion"
            hotkey="p"
            plain
            label={`自動補給：${char.autoPotion ? '開' : '關'}`}
            onPress={() => persist(c => ({ ...c, autoPotion: !c.autoPotion }))}
          />
          <Button
            key="autoattr"
            hotkey="a"
            plain
            label={`自動配點：${char.autoAttr ? '開' : '關'}`}
            onPress={() => persist(c => ({ ...c, autoAttr: !c.autoAttr }))}
          />
        </Box>
      </Box>
    </Box>
  )
}

// ── Skills ─────────────────────────────────────────────────────────────────
/** The skill trees and the talent branches, side by side as tabs. */
const TreeTabs = (ctx: PageCtx) => {
  const { els, char, tree, setTree } = ctx
  const { Box, Text, Button } = els
  const cls = CLASSES[char.classId]
  const left = skillPointsLeft(char)
  const talentsLeft = talentPointsLeft(char)

  return (
    <Box flexDirection="column">
      <Box columnGap={1} flexWrap="wrap">
        <Text dimColor>技能</Text>
        {cls.trees.map((name, i) => (
          <Button key={`tree-${i}`} hotkey={TREE_KEYS[i]} plain={tree !== i ? true : undefined} label={tree === i ? `【${name}】` : name} onPress={setTree(i)} />
        ))}
        <Text dimColor>剩餘 </Text>
        <Text bold color={left > 0 ? GREEN : undefined} dimColor={left === 0}>
          {left}
        </Text>
      </Box>
      <Box columnGap={1} flexWrap="wrap">
        <Text dimColor>天賦</Text>
        {TALENTS[char.classId].map((branch, i) => (
          <Button
            key={`talent-tab-${i}`}
            hotkey={TALENT_KEYS[i]}
            plain={tree !== i + 3 ? true : undefined}
            label={tree === i + 3 ? `【${branch.name}】` : branch.name}
            onPress={setTree(i + 3)}
          />
        ))}
        <Text dimColor>剩餘 </Text>
        <Text bold color={talentsLeft > 0 ? GREEN : undefined} dimColor={talentsLeft === 0}>
          {talentsLeft}
        </Text>
      </Box>
    </Box>
  )
}

const KIND_MARKS = { minor: '●', notable: '◆', keystone: '★' } as const

const TalentPage = (ctx: PageCtx) => {
  const { els, char, tree, persist } = ctx
  const { Box, Text, Button } = els
  const branch = TALENTS[char.classId][tree - 3] ?? TALENTS[char.classId][0]!
  const isCapped = char.level >= MAX_LEVEL
  const cost = talentCost(char.talentEarned)

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      {TreeTabs(ctx)}
      <Text>
        {isCapped ? (
          <Text>
            <Text dimColor>天賦經驗 </Text>
            <Text color={GOLD}>{bar(char.talentXp, cost, 16)}</Text>
            <Text dimColor>
              {' '}
              {formatNumber(char.talentXp)}/{formatNumber(cost)}　已獲得 {char.talentEarned} 點
            </Text>
          </Text>
        ) : (
          <Text dimColor>
            天賦點在等級 {MAX_LEVEL} 後才會獲得：之後的經驗值改為累積天賦點（目前 Lv.{char.level}）
          </Text>
        )}
      </Text>

      <Box flexDirection="column" borderStyle="round" borderColor={branch.color} paddingX={1}>
        <Text bold color={branch.color}>
          {branch.name}
        </Text>
        {branch.nodes.map((node, i) => {
          const rank = talentRank(char, node.id)
          const isOpen = canTakeTalent(char, node.id)
          const isBlocked = node.rival !== undefined && talentRank(char, node.rival) > 0
          const isFirstKey = node.kind === 'keystone' && branch.nodes[i - 1]?.kind !== 'keystone'
          const color = rank > 0 ? branch.color : undefined

          return (
            <Box flexDirection="column">
              {i > 0 && !(node.kind === 'keystone' && !isFirstKey) && (
                <Text color={rank > 0 || talentRank(char, branch.nodes[i - 1]!.id) > 0 ? branch.color : undefined} dimColor={rank === 0}>
                  {isFirstKey ? '  ├────────┐  二選一' : '  │'}
                </Text>
              )}
              <Box columnGap={1}>
                <Button
                  key={`talent-${node.id}`}
                  hotkey={String(i + 1)}
                  plain={isOpen ? undefined : true}
                  label={rank >= node.max ? '✔' : '＋'}
                  onPress={() => persist(c => takeTalent(c, node.id))}
                />
                <Text bold={node.kind !== 'minor'} color={color} dimColor={rank === 0 && !isOpen}>
                  {KIND_MARKS[node.kind]} {node.name}
                </Text>
                <Text dimColor={rank === 0}>
                  {rank}/{node.max}
                </Text>
                {isBlocked && <Text color={DIM_RED}>已選另一個</Text>}
              </Box>
              <Text dimColor>
                {'      '}
                {node.describe(Math.max(1, rank))}
                {node.kind === 'minor' && rank < node.max && rank > 0 ? `　→ ${node.describe(rank + 1)}` : ''}
              </Text>
            </Box>
          )
        })}
      </Box>
      <Box columnGap={1} flexWrap="wrap">
        <Button
          key="autotalent"
          hotkey="a"
          plain
          label={`自動配點：${char.autoTalent ? '開' : '關'}`}
          onPress={() => persist(c => ({ ...c, autoTalent: !c.autoTalent }))}
        />
        <Button key="respec-talents" hotkey="r" plain label={`重置天賦 (${formatNumber(talentRespecCost(char))} 金幣)`} onPress={() => persist(respecTalents)} />
      </Box>
      <Text dimColor>● 小天賦（最多 3 級）・◆ 大天賦・★ 關鍵天賦（分支最後二選一）。要點下一個節點，必須先點過前一個。</Text>
    </Box>
  )
}

export const SkillsPage = (ctx: PageCtx) => {
  const { els, char, tree, persist } = ctx
  const { Box, Text, Button } = els
  if (tree >= 3) return TalentPage(ctx)
  const skills = classSkills(char.classId, tree)
  const stats = heroStats(char)

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      {TreeTabs(ctx)}
      <Box flexDirection="column">
        {skills.map((s, i) => {
          const rank = rankOf(char, s.id)
          const isLocked = char.level < s.unlock
          const isMain = char.mainSkill === s.id
          const kind = { attack: '攻擊', buff: '增益', curse: '詛咒', summon: '召喚', passive: '被動' }[s.kind]
          const cost = s.mana ? `・${s.mana(Math.max(1, rank)).toFixed(0)} 法力` : ''
          const cd = s.cooldown ? `・冷卻 ${s.cooldown}s` : ''

          return (
            <Box flexDirection="column" marginBottom={1}>
              <Box columnGap={1}>
                <Button key={`skill-${s.id}`} hotkey={String(i + 1)} label="＋" onPress={() => persist(c => raiseSkill(c, s.id))} />
                <Text bold color={isLocked ? undefined : `#${s.fx.color.toString(16).padStart(6, '0')}`} dimColor={isLocked}>
                  {s.name}
                </Text>
                <Text dimColor={rank === 0}>
                  {rank}/{MAX_SKILL_RANK}
                </Text>
                <Text dimColor>
                  {kind}
                  {cost}
                  {cd}
                </Text>
                {isLocked && <Text color={DIM_RED}>Lv.{s.unlock} 解鎖</Text>}
                {s.kind === 'attack' && rank > 0 && !s.cooldown && !s.staticPct && !s.corpsePct && (
                  <Button
                    key={`main-${s.id}`}
                    plain
                    label={isMain ? '★主技能' : '設為主技能'}
                    onPress={() => persist(c => ({ ...c, mainSkill: s.id, autoSkill: false }))}
                  />
                )}
                {s.kind === 'attack' && rank > 0 && <Text dimColor>≈{formatNumber(skillDamage(char, s.id, stats))}</Text>}
              </Box>
              <Text dimColor>
                {'     '}
                {rank > 0 ? s.describe(rank) : '尚未學習'}
                {rank < MAX_SKILL_RANK && !isLocked ? `　→ ${s.describe(rank + 1)}` : ''}
              </Text>
              {(s.synergies ?? []).length > 0 && (
                <Text dimColor>
                  {'     '}協同：
                  {(s.synergies ?? []).map(syn => `${classSkills(char.classId).find(o => o.id === syn.from)?.name ?? syn.from} 每級 +${syn.pct}%`).join('、')}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
      <Box columnGap={1} flexWrap="wrap">
        <Button
          key="autoskill"
          hotkey="a"
          plain
          label={`自動配點：${char.autoSkill ? '開' : '關'}`}
          onPress={() => persist(c => ({ ...c, autoSkill: !c.autoSkill, mainSkill: !c.autoSkill ? bestMainSkill(c) : c.mainSkill }))}
        />
        <Button key="respec" hotkey="r" plain label={`重置技能 (${formatNumber(respecCost(char))} 金幣)`} onPress={() => persist(respecSkills)} />
      </Box>
      <Text dimColor>召喚、增益、詛咒會自動維持；冷卻好的強力技能會優先施放，其餘時間使用主技能。</Text>
    </Box>
  )
}

// ── Items ──────────────────────────────────────────────────────────────────
const ItemLine = ({ els, item, char }: { els: PageCtx['els']; item: Item; char: Character }) => {
  const { Box, Text } = els
  const unmet = !canWear(char, item)

  return (
    <Box columnGap={1}>
      <Text color={rarityColor(item)}>{shownName(item)}</Text>
      <Text>
        {socketMarks(item).map(m => (
          <Text color={m.color}>{m.mark}</Text>
        ))}
      </Text>
      <Text dimColor>{item.unid ? '？？？（到城鎮鑑定）' : statText(itemStats(item))}</Text>
      {item.req?.str ? (
        <Text color={unmet ? DIM_RED : undefined} dimColor={!unmet}>
          需力量 {item.req.str}
        </Text>
      ) : (
        <Text> </Text>
      )}
    </Box>
  )
}

/** Where an item is, so its tooltip can find it again. */
const findItem = (char: Character, id: number) =>
  [...SLOTS.map(s => char.equipment[s]), ...char.charms, ...char.bag].find(item => item?.id === id) ?? undefined

const statLine = (key: keyof Item['stats'], value: number) =>
  key === 'skills' ? `所有技能 +${value}` : `${STAT_NAMES[key]} +${value}${key === 'atk' || key === 'def' || key === 'hp' ? '' : '%'}`

/** The old game's item box: the name in its colour, the base, blue properties, sockets, requirements. */
const Tooltip = (ctx: PageCtx, item: Item) => {
  const { els, char } = ctx
  const { Box, Text, Button } = els
  const stats = itemStats(item)
  const worn = item.slot !== 'charm' ? char.equipment[item.slot] : null
  const theirs = worn && worn.id !== item.id ? itemStats(worn) : undefined
  const unmet = !canWear(char, item)
  const word = runewordOf(item)
  const base = item.charm ? CHARM_SIZES[item.charm].name : baseText(item)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={rarityColor(item)} paddingX={2} alignItems="center">
      <Text bold color={rarityColor(item)}>
        {shownName(item)}
      </Text>
      <Text dimColor>
        {RARITIES[item.rarity].name}・{base}
      </Text>
      {word && <Text color={RUNE_COLOR}>'{word.runes.map(r => RUNES[r]!.en).join('')}'</Text>}
      {item.unid ? (
        <Text color={DIM_RED}>未鑑定</Text>
      ) : (
        <Box flexDirection="column" alignItems="center">
          {STAT_KEYS.filter(key => stats[key]).map(key => {
            const diff = theirs ? stats[key] - theirs[key] : 0

            return (
              <Text>
                <Text color="#7070ff">{statLine(key, stats[key])}</Text>
                {theirs && diff !== 0 && (
                  <Text color={diff > 0 ? GREEN : DIM_RED}>
                    {'  '}
                    {diff > 0 ? '▲' : '▼'}
                    {Math.abs(diff)}
                  </Text>
                )}
              </Text>
            )
          })}
        </Box>
      )}
      {item.sockets > 0 && (
        <Text>
          插槽（{item.sockets}）{' '}
          {socketMarks(item).map(m => (
            <Text color={m.color}>{m.mark}</Text>
          ))}
        </Text>
      )}
      {item.legend && !item.unid && <Text color="#ff9a30">✦ {item.legend}</Text>}
      {item.set && <Text color={RARITIES[4].color}>{SETS[item.set].name}</Text>}
      <Text dimColor>物品等級 {item.level}</Text>
      {item.req?.str ? <Text color={unmet ? DIM_RED : undefined}>需要力量 {item.req.str}</Text> : <Text> </Text>}
      {theirs && <Text dimColor>▲▼ 與身上的{SLOT_NAMES[item.slot]}相比</Text>}
      <Box>
        <Button key="close-tip" hotkey="x" plain label="關閉" onPress={ctx.setInspect(0)} />
      </Box>
    </Box>
  )
}

export const GearPage = (ctx: PageCtx) => {
  const { els, char, persist, toast } = ctx
  const { Box, Text, Button } = els
  const now = heroPower(char)
  const s = heroStats(char)
  const sets = activeSets(char.equipment)
  const looked = ctx.inspect ? findItem(char, ctx.inspect) : undefined
  const look = (item: Item) => <Button key={`look-${item.id}`} plain label="詳情" onPress={ctx.setInspect(item.id)} />

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      {looked && Tooltip(ctx, looked)}
      <Box flexDirection="column">
        <Text bold color={GOLD}>
          裝備
        </Text>
        {SLOTS.map((slot: Slot) => {
          const item = char.equipment[slot]

          return (
            <Box columnGap={1}>
              <Text dimColor>{SLOT_NAMES[slot]}</Text>
              {item ? ItemLine({ els, item, char }) : <Text dimColor>—</Text>}
              {item && look(item)}
              {item && <Button key={`off-${slot}`} plain label="卸下" onPress={() => persist(c => unequip(c, slot))} />}
            </Box>
          )
        })}
        <Text dimColor>
          武器傷害 {formatNumber(s.weapon)}　防禦 {formatNumber(s.def)}　生命 {formatNumber(s.maxHp)}　爆擊 {Math.round(s.critRate * 100)}%　金幣尋獲 +{s.goldFind}%
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold color={GOLD}>
            護身符
          </Text>
          <Text dimColor>
            {'  '}
            {charmCells(char.charms)}/{CHARM_SPACE} 格・放著就生效（小 1 格、大 2 格、超大 3 格）
          </Text>
        </Text>
        {char.charms.length === 0 && <Text dimColor>沒有攜帶護身符。</Text>}
        {char.charms.map(charm => (
          <Box columnGap={1}>
            <Text dimColor>{CHARM_SIZES[charm.charm ?? 'small'].cells} 格</Text>
            {ItemLine({ els, item: charm, char })}
            {look(charm)}
            <Button key={`uncharm-${charm.id}`} plain label="收起" onPress={() => persist(c => dropCharm(c, charm.id))} />
          </Box>
        ))}
      </Box>

      {sets.length > 0 && (
        <Box flexDirection="column">
          {sets.map(set => (
            <Box flexDirection="column">
              <Text color={SET_COLOR} bold>
                {set.name} ({set.count}/{set.size})
              </Text>
              {set.tiers.map(tier => (
                <Text color={tier.isActive ? SET_COLOR : undefined} dimColor={!tier.isActive}>
                  {'  '}
                  {tier.pieces} 件：{bonusText(tier.bonus)}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      )}

      <Box flexDirection="column">
        <Text>
          <Text bold color={GOLD}>
            背包
          </Text>
          <Text dimColor>
            {' '}
            {char.bag.length}/{BAG_SIZE}　按字母穿上
          </Text>
        </Text>
        {char.bag.length === 0 && <Text dimColor>空空如也……</Text>}
        {char.bag.map((item, i) => {
          const d = item.unid ? 0 : canWear(char, item) ? heroPower(equip(char, item.id)) - now : -1

          return (
            <Box columnGap={1}>
              <Button
                key={`wear-${item.id}`}
                hotkey={BAG_KEYS[i]}
                label="穿上"
                onPress={() => {
                  if (!canWear(char, item)) {
                    toast(`力量不足：需要 ${item.req?.str ?? 0}`)

                    return
                  }
                  persist(c => equip(c, item.id))
                }}
              />
              <Button key={`sell-${item.id}`} plain label={`賣 ${formatNumber(sellValue(item))}`} onPress={() => persist(c => sell(c, item.id))} />
              <Text dimColor>{SLOT_NAMES[item.slot]}</Text>
              {ItemLine({ els, item, char })}
              {look(item)}
              <Text color={d > 0 ? GREEN : d < 0 ? DIM_RED : undefined} dimColor={d === 0}>
                {item.unid ? '?' : d > 0 ? '▲' : d < 0 ? '▼' : '='}
              </Text>
            </Box>
          )
        })}
      </Box>

      <Box columnGap={1} flexWrap="wrap">
        <Button
          key="sellall"
          hotkey="s"
          label={`全部賣掉 (${formatNumber(char.bag.reduce((sum, item) => sum + sellValue(item), 0))})`}
          onPress={() => persist(sellAll)}
        />
        <Button
          key="autoequip"
          hotkey="q"
          plain
          label={`自動換裝：${char.autoEquip ? '開' : '關'}`}
          onPress={() => persist(c => ({ ...c, autoEquip: !c.autoEquip }))}
        />
      </Box>
    </Box>
  )
}

// ── The socketing bench ────────────────────────────────────────────────────
const GRADE_SHORT = ['碎裂', '一般', '無瑕', '完美'] as const

/** One fixed-width cell of a table row. */
const cell = (els: PageCtx['els'], width: number, node: RenderNode) => {
  const { Box } = els

  return <Box width={width}>{node}</Box>
}

type StepState = 'set' | 'held' | 'missing' | 'wrong'

/** How far a worn item is along the way to one runeword. */
const wordProgress = (char: Character, item: Item, w: (typeof RUNEWORDS)[number]) => {
  const placed = item.runes ?? []
  const isOnTrack = placed.every((r, i) => w.runes[i] === r)
  const isFitting = item.rarity === 0 && item.gems.length === 0 && item.sockets === w.runes.length && isOnTrack
  const steps = w.runes.map((r, i) => ({
    rune: r,
    state: (i < placed.length ? (placed[i] === r ? 'set' : 'wrong') : (char.runes[r] ?? 0) > 0 ? 'held' : 'missing') as StepState,
  }))

  return { isFitting, steps, next: isFitting ? w.runes[placed.length] : undefined }
}

const STEP_COLORS = { set: GREEN, held: RUNE_COLOR, missing: DIM_RED, wrong: DIM_RED } as const

export const GemsPage = (ctx: PageCtx) => {
  const { els, char, persist, toast } = ctx
  const { Box, Text, Button } = els
  const slot = SLOTS[ctx.gemUi.slot] ?? 'weapon'
  const item = char.equipment[slot]
  const free = item ? item.sockets - usedSockets(item) : 0
  const pick = (i: number) => () => ctx.setGemUi({ ...ctx.gemUi, slot: i })
  const intoChosen = (fn: (c: Character) => Character) => () => {
    if (!item || free <= 0) {
      toast(item ? `${SLOT_NAMES[slot]}沒有空的鑲孔了` : `沒有穿戴${SLOT_NAMES[slot]}`)

      return
    }
    persist(fn)
  }
  const words = item ? RUNEWORDS.filter(w => w.slot === slot) : []
  // The runes that would carry a runeword on: their buttons stand out.
  const wanted = new Set(item ? words.map(w => wordProgress(char, item, w)).filter(p => p.isFitting && p.next !== undefined).map(p => p.next!) : [])
  const isWordBase = item !== null && item !== undefined && item.rarity === 0 && item.gems.length === 0

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}

      <Box flexDirection="column" borderStyle="round" borderColor="#6a5020" paddingX={1}>
        <Text>
          <Text bold color={GOLD}>
            鑲嵌工作台
          </Text>
          <Text dimColor>　按 1～9、0 選擇裝備，再按下面的寶石或符文鑲入</Text>
        </Text>
        {SLOTS.map((s, i) => {
          const it = char.equipment[s]
          const isChosen = s === slot

          return (
            <Box columnGap={1}>
              <Button key={`bench-${s}`} hotkey={String((i + 1) % 10)} plain={!isChosen ? true : undefined} label={isChosen ? `▶${SLOT_NAMES[s]}` : ` ${SLOT_NAMES[s]}`} onPress={pick(i)} />
              {it ? (
                <Text>
                  <Text color={rarityColor(it)}>{shownName(it)} </Text>
                  {socketMarks(it).map(m => (
                    <Text color={m.color}>{m.mark}</Text>
                  ))}
                  {it.sockets === 0 && <Text dimColor>無鑲孔</Text>}
                </Text>
              ) : (
                <Text dimColor>—</Text>
              )}
            </Box>
          )
        })}
        {item && (
          <Text dimColor>
            {SLOT_NAMES[slot]}：{item.sockets} 孔，空 {free} 孔{free > 0 ? '' : '（可到城鎮找鐵匠、或用方塊打孔）'}
          </Text>
        )}
      </Box>

      <Box flexDirection="column">
        <Text bold color={GOLD}>
          寶石
          <Text dimColor>　鑲入時用該種最高品級；合成在「方塊」頁</Text>
        </Text>
        <Box>
          {cell(els, 10, <Text dimColor> </Text>)}
          {GRADE_SHORT.map(g => cell(els, 6, <Text dimColor>{g}</Text>))}
        </Box>
        {GEM_IDS.map(type => {
          const counts = char.gems[type]
          const best = [3, 2, 1, 0].find(g => (counts[g] ?? 0) > 0) as GemGrade | undefined

          return (
            <Box>
              {cell(els, 10, <Text color={GEM_TYPES[type].color}>◆ {GEM_TYPES[type].name}</Text>)}
              {counts.map(n => cell(els, 6, <Text dimColor={n === 0}>{n === 0 ? '·' : n}</Text>))}
              {best !== undefined && (
                <Button
                  key={`gem-socket-${type}`}
                  plain
                  label={`鑲入（${statText(gemStats({ type, grade: best }))}）`}
                  onPress={intoChosen(c => socketGem(c, slot, { type, grade: best }))}
                />
              )}
            </Box>
          )
        })}
      </Box>

      <Box flexDirection="column">
        <Text bold color={RUNE_COLOR}>
          符文
          <Text dimColor>　按下就鑲入選中的裝備；升級在「方塊」頁</Text>
        </Text>
        {char.runes.every(n => n === 0) ? (
          <Text dimColor>還沒有符文。菁英、頭目和幕首領最常掉落。</Text>
        ) : (
          <Box columnGap={1} flexWrap="wrap">
            {char.runes.map((count, rune) =>
              count > 0 ? (
                <Button
                  key={`rune-${rune}`}
                  plain={wanted.has(rune) ? undefined : true}
                  variant={wanted.has(rune) ? 'primary' : undefined}
                  label={`${wanted.has(rune) ? '★' : ''}${RUNES[rune]!.en}×${count}`}
                  onPress={intoChosen(c => socketRune(c, slot, rune))}
                />
              ) : null,
            )}
          </Box>
        )}
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold color={RARITIES[5].color}>
            符文之語
          </Text>
          <Text dimColor>　{ctx.gemUi.allWords ? '全部' : `${SLOT_NAMES[slot]}可做的`}</Text>
        </Text>
        {!ctx.gemUi.allWords && item && !isWordBase && <Text dimColor>只有「普通（白色）」且沒鑲寶石的裝備能做成符文之語。</Text>}
        {(ctx.gemUi.allWords ? RUNEWORDS : words).map(w => {
          const p = item && w.slot === slot ? wordProgress(char, item, w) : undefined

          return (
            <Box flexDirection="column">
              <Text>
                <Text bold color={p?.isFitting ? RARITIES[5].color : undefined} dimColor={!p?.isFitting}>
                  {w.name}
                </Text>
                <Text dimColor>
                  {'  '}
                  {SLOT_NAMES[w.slot]}・{w.runes.length} 孔{'   '}
                </Text>
                {w.runes.map((r, i) => {
                  const state = p?.steps[i]?.state

                  return (
                    <Text color={state ? STEP_COLORS[state] : undefined} dimColor={!state}>
                      {RUNES[r]!.en}
                      {state === 'set' ? '✔' : ''}{' '}
                    </Text>
                  )
                })}
              </Text>
              <Text dimColor>
                {'    '}
                {statText(w.stats(1))}（隨裝備等級成長）
                {p?.isFitting && p.next !== undefined ? `　下一個：${RUNES[p.next]!.en}` : ''}
                {p && !p.isFitting && item && item.sockets !== w.runes.length && isWordBase ? `　需要剛好 ${w.runes.length} 孔` : ''}
              </Text>
            </Box>
          )
        })}
        <Box>
          <Button
            key="all-words"
            hotkey="a"
            plain
            label={ctx.gemUi.allWords ? '只看這個部位' : '顯示全部符文之語'}
            onPress={() => ctx.setGemUi({ ...ctx.gemUi, allWords: !ctx.gemUi.allWords })}
          />
        </Box>
        <Text dimColor>綠色 ✔ 已鑲入・橘色 持有・紅色 缺少・★ 下一個該放的符文。寶石和符文一旦鑲入就無法取出。</Text>
      </Box>
    </Box>
  )
}

export const OddsPage = (ctx: PageCtx) => {
  const { els } = ctx
  const { Box, Text } = els
  const mf = heroStats(ctx.char).magicFind
  const rows = DROP_TIERS.map(tier => ({ label: DROP_TIER_NAMES[tier], odds: dropOdds(tier, mf), rune: RUNE_DROP_CHANCE[tier] }))

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Text bold color={GOLD}>
        每次擊殺的掉落機率
        <Text dimColor>（已計入你的魔法尋獲 +{mf}%）</Text>
      </Text>
      {rows.map(row => (
        <Box flexDirection="column">
          <Text bold>
            {row.label}
            <Text dimColor>
              裝備 {pct(row.odds.item)}・護身符 {pct(row.odds.charm)}・寶石 {pct(row.odds.gem)}・符文 {pct(row.rune)}
            </Text>
          </Text>
          <Box columnGap={2} flexWrap="wrap">
            {row.odds.rarities.map(r => (
              <Text color={RARITIES[r.rarity].color}>
                {RARITIES[r.rarity].name} {pct(r.chance)}
              </Text>
            ))}
          </Box>
        </Box>
      ))}
      <Box flexDirection="column">
        <Text dimColor>・魔法尋獲提高稀有、套裝、暗金的比例，但越多效果越遞減。</Text>
        <Text dimColor>
          ・符文越高階越罕見（每一階約為前一階的一半）；這裡最高可掉到 {runeName(maxRuneAt(ctx.char.zone))}。
        </Text>
        <Text dimColor>・稀有以上的裝備掉落時是未鑑定的；詞綴每深入 8 個區域高一階。</Text>
        <Text dimColor>・裝備強度與力量需求隨區域深度成長；力量不足時無法穿上。</Text>
        <Text dimColor>・幕首領一次掉落 3 件裝備；寶石品質每深入 10 個區域提升一級，頭目與首領再高一級。</Text>
        <Text dimColor>・帶鑲孔機率：普通 60%（1–3 孔）、魔法 40%、稀有 25%、暗金 20%、套裝無孔；戒指最多 1 孔。</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold color={SET_COLOR}>
          套裝一覽
        </Text>
        {Object.values(SETS).map(set => (
          <Text>
            <Text color={SET_COLOR}>{set.name}</Text>
            <Text dimColor>
                  {'  '}
                  {Object.entries(set.bonuses)
                    .map(([n, b]) => `${n} 件 ${bonusText(b)}`)
                    .join('・')}
            </Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}

// ── Town: merchant, smith, stash, waypoints ────────────────────────────────
export const TownPage = (ctx: PageCtx) => {
  const { els, char, game, persist, persistGame } = ctx
  const { Box, Text, Button } = els
  const place = placeOf(char.zone)
  const act = place.actDef
  const shown = Math.min(2, Math.floor(char.maxZone / AREAS_PER_DIFFICULTY))

  const deposit = (id: number) =>
    persistGame(g => {
      const c = g.active ? g.chars[g.active] : undefined
      const item = c?.bag.find(one => one.id === id)
      if (!c || !item || g.stash.length >= STASH_SIZE) return null

      return { ...g, stash: [...g.stash, item], chars: { ...g.chars, [c.classId]: { ...c, bag: c.bag.filter(one => one.id !== id) } } }
    })
  const withdraw = (index: number) =>
    persistGame(g => {
      const c = g.active ? g.chars[g.active] : undefined
      const item = g.stash[index]
      if (!c || !item || c.bag.length >= BAG_SIZE) return null
      // Items carry ids from the hero who found them; give it a fresh one here.
      const moved = { ...item, id: c.nextItemId }

      return {
        ...g,
        stash: g.stash.filter((_, i) => i !== index),
        chars: { ...g.chars, [c.classId]: { ...c, bag: [...c.bag, moved], nextItemId: c.nextItemId + 1 } },
      }
    })

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Text>
        <Text bold color={GOLD}>
          {act.town}
        </Text>
        <Text dimColor>
          {'　'}
          {act.name}・{DIFFICULTIES[place.difficulty]!.name}　金幣 {formatNumber(char.gold)}
        </Text>
      </Text>

      <Box flexDirection="column">
        <Text bold>商人</Text>
        <Box columnGap={1} flexWrap="wrap">
          <Button key="buy-red" hotkey="r" label={`紅藥水 ${char.belt.red}/${BELT_SIZE} (${potionPrice(char)})`} onPress={() => persist(c => buyPotion(c, 'red'))} />
          <Button key="buy-blue" hotkey="b" label={`藍藥水 ${char.belt.blue}/${BELT_SIZE} (${potionPrice(char)})`} onPress={() => persist(c => buyPotion(c, 'blue'))} />
          <Button
            key="sellall"
            hotkey="s"
            plain
            label={`賣掉背包 (${formatNumber(char.bag.reduce((sum, item) => sum + sellValue(item), 0))})`}
            onPress={() => persist(sellAll)}
          />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold>老學者</Text>
          <Text dimColor>　免費鑑定背包裡的物品</Text>
        </Text>
        <Box columnGap={1} flexWrap="wrap">
          <Button
            key="identify"
            hotkey="d"
            label={`鑑定全部 (${char.bag.filter(item => item.unid).length})`}
            onPress={() => persist(identifyAll)}
          />
          <Button
            key="autoidentify"
            plain
            label={`撿到就自動鑑定：${char.autoIdentify ? '開' : '關'}`}
            onPress={() => persist(c => ({ ...c, autoIdentify: !c.autoIdentify }))}
          />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold>賭博</Text>
          <Text dimColor>
            　{formatNumber(gambleCost(char.maxZone))} 金幣買一件未鑑定物品：魔法 86%、稀有 12%、套裝 1%、暗金 0.6%
          </Text>
        </Text>
        <Box columnGap={1} flexWrap="wrap">
          {([...GEAR_KINDS, 'charm'] as const).map(slot => (
            <Button
              key={`gamble-${slot}`}
              plain
              label={SLOT_NAMES[slot]}
              onPress={() => {
                if (char.gold < gambleCost(char.maxZone)) {
                  ctx.toast('金幣不夠')

                  return
                }
                persist(c => gamble(c, slot, Math.random).save)
                ctx.toast(`買下一件未鑑定的${SLOT_NAMES[slot]}，到老學者那裡鑑定吧`)
              }}
            />
          ))}
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold>鐵匠</Text>
          <Text dimColor>　為身上的裝備打孔（套裝和符文之語不行）</Text>
        </Text>
        {SLOTS.map(slot => {
          const item = char.equipment[slot]
          const isFull = !item || item.set !== undefined || item.runeword !== undefined || item.sockets >= SOCKET_MAX[slot]

          return (
            <Box columnGap={1}>
              <Text dimColor>{SLOT_NAMES[slot]}</Text>
              {item ? ItemLine({ els, item, char }) : <Text dimColor>—</Text>}
              {item && !isFull && (
                <Button key={`punch-${slot}`} plain label={`打孔 (${formatNumber(punchCost(item))})`} onPress={() => persist(c => punchSocket(c, slot))} />
              )}
            </Box>
          )
        })}
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold>共用倉庫</Text>
          <Text dimColor>
            {'　'}
            {game.stash.length}/{STASH_SIZE}　所有英雄都拿得到
          </Text>
        </Text>
        {game.stash.map((item, i) => (
          <Box columnGap={1}>
            <Button key={`take-${i}`} plain label="取出" onPress={() => withdraw(i)} />
            <Text dimColor>{SLOT_NAMES[item.slot]}</Text>
            {ItemLine({ els, item, char })}
          </Box>
        ))}
        {char.bag.map(item => (
          <Box columnGap={1}>
            <Button key={`store-${item.id}`} plain label="存入" onPress={() => deposit(item.id)} />
            <Text dimColor>背包・{SLOT_NAMES[item.slot]}</Text>
            {ItemLine({ els, item, char })}
          </Box>
        ))}
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text bold>傳送點</Text>
          <Text dimColor>　到過的區域都能直接前往</Text>
        </Text>
        {Array.from({ length: shown + 1 }, (_, d) =>
          ACTS.map((a, ai) => {
            const first = d * AREAS_PER_DIFFICULTY + ai * AREAS_PER_ACT
            if (first > char.maxZone) return null

            return (
              <Box columnGap={1} flexWrap="wrap">
                <Text color={DIFFICULTIES[d]!.color}>
                  {DIFFICULTIES[d]!.name}・{a.name}
                </Text>
                {a.areas.map((name, k) => {
                  const zone = first + k
                  if (zone > char.maxZone) return null

                  return (
                    <Button
                      key={`wp-${zone}`}
                      plain
                      label={zone === char.zone ? `【${name}】` : name}
                      onPress={() => persist(c => travel(c, zone))}
                    />
                  )
                })}
              </Box>
            )
          }),
        ).flat()}
      </Box>
    </Box>
  )
}

// ── The Horadric Cube ──────────────────────────────────────────────────────
export const CubePage = (ctx: PageCtx) => {
  const { els, char, persist } = ctx
  const { Box, Text, Button } = els
  const heldRunes = char.runes.map((count, rune) => ({ rune, count })).filter(r => r.count > 0)
  const canCombine = GEM_IDS.some(g => [0, 1, 2].some(grade => (char.gems[g][grade] ?? 0) >= GEMS_TO_COMBINE))

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Box flexDirection="column" borderStyle="round" borderColor="#6a5020" paddingX={1}>
        <Text bold color={GOLD}>
          赫拉迪克方塊
        </Text>
        <Text>
          <Text dimColor>材料　碎裂寶石 </Text>
          {chippedGems(char)}
          <Text dimColor>　完美寶石 </Text>
          {perfectGems(char)}
          <Text dimColor>　符文 </Text>
          {char.runes.reduce((sum, n) => sum + n, 0)}
          <Text dimColor>　背包 </Text>
          {char.bag.length}/{BAG_SIZE}
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>
          寶石合成
          <Text dimColor>　{GEMS_TO_COMBINE} 顆同種同級 → 高一級 1 顆</Text>
        </Text>
        <Box>
          {cell(els, 10, <Text dimColor> </Text>)}
          {GRADE_SHORT.map(g => cell(els, 6, <Text dimColor>{g}</Text>))}
        </Box>
        {GEM_IDS.map(type => (
          <Box>
            {cell(els, 10, <Text color={GEM_TYPES[type].color}>◆ {GEM_TYPES[type].name}</Text>)}
            {char.gems[type].map((n, grade) =>
              cell(
                els,
                6,
                <Text color={grade < 3 && n >= GEMS_TO_COMBINE ? GREEN : undefined} dimColor={n === 0}>
                  {n === 0 ? '·' : n}
                </Text>,
              ),
            )}
            {[0, 1, 2].map(grade =>
              (char.gems[type][grade] ?? 0) >= GEMS_TO_COMBINE ? (
                <Button
                  key={`combine-${type}-${grade}`}
                  plain
                  label={`${GRADE_SHORT[grade]}→${GRADE_SHORT[grade + 1]}`}
                  onPress={() => persist(c => combineGems(c, type, grade as GemGrade))}
                />
              ) : null,
            )}
          </Box>
        ))}
        <Box>
          <Button key="combine-all" hotkey="a" plain={!canCombine ? true : undefined} label="全部合成" onPress={() => persist(combineAllGems)} />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text bold color={RUNE_COLOR}>
          符文升級
          <Text dimColor>　艾爾～索爾：3 個 → 1 個；夏以上：2 個 + 1 顆完美寶石</Text>
        </Text>
        {heldRunes.length === 0 && <Text dimColor>還沒有符文。</Text>}
        <Box columnGap={2} flexWrap="wrap">
          {heldRunes.map(({ rune, count }) => {
            const cost = runeUpgradeCost(rune)
            const isTop = rune >= RUNES.length - 1
            const ready = !isTop && count >= cost.runes && perfectGems(char) >= cost.perfect

            return (
              <Box columnGap={1}>
                <Text color={RUNE_COLOR}>
                  {RUNES[rune]!.en}×{count}
                </Text>
                {ready ? (
                  <Button key={`rune-up-${rune}`} plain label={`→${RUNES[rune + 1]!.en}`} onPress={() => persist(c => upgradeRune(c, rune))} />
                ) : (
                  <Text dimColor>{isTop ? '最高階' : `${count}/${cost.runes}`}</Text>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text bold>裝備配方</Text>
        {CUBE_RECIPES.filter(r => r.fits).map(recipe => {
          const items = cubeCandidates(char, recipe)
          const mats = recipe.materials(char)
          const ready = recipe.ready(char)

          return (
            <Box flexDirection="column" borderStyle="single" borderColor={ready && items.length > 0 ? '#3a6a30' : '#3a3020'} paddingX={1}>
              <Text>
                <Text bold color={ready && items.length > 0 ? GREEN : undefined}>
                  {recipe.name}
                </Text>
                <Text dimColor>　→ {recipe.makes}</Text>
              </Text>
              {mats.map(m => (
                <Text>
                  <Text color={m.have >= m.need ? GREEN : DIM_RED}>{m.have >= m.need ? '✔' : '✘'} </Text>
                  {m.name}
                  <Text dimColor>
                    {' '}
                    {m.have}/{m.need}
                  </Text>
                </Text>
              ))}
              <Text>
                <Text color={items.length > 0 ? GREEN : DIM_RED}>{items.length > 0 ? '✔' : '✘'} </Text>
                背包裡合適的裝備<Text dimColor> {items.length} 件</Text>
              </Text>
              {ready &&
                items.map(it => (
                  <Box columnGap={1}>
                    <Button key={`cube-${recipe.id}-${it.id}`} plain label="放入" onPress={() => persist(c => runCube(c, recipe.id, it.id, Math.random))} />
                    {ItemLine({ els, item: it, char })}
                  </Box>
                ))}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Quests ─────────────────────────────────────────────────────────────────
export const QuestsPage = (ctx: PageCtx) => {
  const { els, char } = ctx
  const { Box, Text } = els
  const reached = Math.min(2, Math.floor(char.maxZone / AREAS_PER_DIFFICULTY))
  const b = char.questBonus

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Text>
        <Text bold color={GOLD}>
          任務日誌
        </Text>
        <Text dimColor>　每個難度都能再完成一次</Text>
      </Text>
      <Text dimColor>
        已獲得：技能點 +{b.skill}・屬性點 +{b.attr}・最大生命 +{b.lifePct}%・全抗性 +{b.res}%
      </Text>
      {Array.from({ length: reached + 1 }, (_, d) => (
        <Box flexDirection="column">
          <Text bold color={DIFFICULTIES[d]!.color}>
            {DIFFICULTIES[d]!.name}
          </Text>
          {ACTS.map((act, ai) => (
            <Box flexDirection="column">
              <Text dimColor>{act.name}</Text>
              {QUESTS.filter(q => q.act === ai).map(q => {
                const isDone = char.quests.includes(questKey(d, q.id))

                return (
                  <Text>
                    <Text color={isDone ? GREEN : undefined} dimColor={!isDone}>
                      {'  '}
                      {isDone ? '✔' : '○'} {q.name}
                    </Text>
                    <Text dimColor>
                      {'　'}
                      {q.goal}　→ {q.reward}
                    </Text>
                  </Text>
                )
              })}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ── Greater rifts ──────────────────────────────────────────────────────────
export const RiftPage = (ctx: PageCtx) => {
  const { els, char, persist } = ctx
  const { Box, Text, Button } = els
  const isOpen = isRiftOpen(char)
  const last = char.riftLast

  return (
    <Box flexDirection="column" gap={1}>
      {Tabs(ctx)}
      <Text>
        <Text bold color={RIFT_COLOR}>
          大秘境
        </Text>
        <Text dimColor>　隨機的地圖、更強的怪物、更好的寶物</Text>
      </Text>
      {!isOpen ? (
        <Box flexDirection="column">
          <Text color={DIM_RED}>打通地獄難度第五幕後開放。</Text>
          <Text dimColor>
            目前進度：{zoneName(Math.min(char.maxZone, RIFT_UNLOCK_ZONE - 1))}（{Math.min(char.maxZone, RIFT_UNLOCK_ZONE)}/{RIFT_UNLOCK_ZONE} 個區域）
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>秘境鑰石 </Text>
            <Text bold color={RIFT_COLOR}>
              {char.keys}
            </Text>
            <Text dimColor>　最高通關 </Text>
            <Text bold color={GOLD}>
              第 {char.riftBest} 層
            </Text>
          </Text>
          {char.rift ? (
            <Text color={RIFT_COLOR}>
              正在第 {char.rift.tier} 層：進度 {Math.floor(char.rift.progress)}%・剩 {formatClock(char.rift.timeLeft)}
            </Text>
          ) : (
            <Box columnGap={1} flexWrap="wrap">
              <Button key="tier-down" plain label="－" onPress={() => persist(c => ({ ...c, riftTier: Math.max(1, c.riftTier - 1) }))} />
              <Text bold>第 {char.riftTier} 層</Text>
              <Button
                key="tier-up"
                plain
                label="＋"
                onPress={() => persist(c => ({ ...c, riftTier: Math.min(c.riftBest + 1, c.riftTier + 1) }))}
              />
              <Button
                key="rift-start"
                hotkey="n"
                variant="primary"
                label={char.keys > 0 ? '開啟秘境（用掉 1 把鑰石）' : '沒有鑰石'}
                onPress={() => {
                  if (char.keys < 1) {
                    ctx.toast('沒有秘境鑰石：地獄的菁英、頭目和首領會掉落')

                    return
                  }
                  persist(c => startRift(c, Math.random))
                  ctx.setView('battle')()
                }}
              />
            </Box>
          )}
          <Box>
            <Button
              key="autorift"
              hotkey="a"
              plain
              label={`自動挑戰：${char.autoRift ? '開' : '關'}（有鑰石就開，通關往上一層、超時往下一層）`}
              onPress={() => persist(c => ({ ...c, autoRift: !c.autoRift }))}
            />
          </Box>
          {last && (
            <Text color={last.isInTime ? GREEN : DIM_RED}>
              上一次：第 {last.tier} 層，{formatClock(last.seconds)} {last.isInTime ? '準時通關' : '超時'}
              {last.gem ? '・寶石升級了一級' : ''}
            </Text>
          )}
        </Box>
      )}
      <Box flexDirection="column">
        <Text bold>規則</Text>
        <Text dimColor>・擊殺怪物累積進度，滿了秘境守護者出現；擊敗它就通關。</Text>
        <Text dimColor>・限時 {RIFT_SECONDS / 60} 分鐘。準時通關才算成功、能挑戰更高層；超時一樣會結束並拿到獎勵。</Text>
        <Text dimColor>・每升一層，怪物強 {Math.round((TIER_STEP - 1) * 100)}%，掉落更多、更好；在秘境裡算地獄難度（抗性 -100）。</Text>
        <Text dimColor>・通關時有機會讓身上一顆寶石升一級，準時、層數越高機率越大。</Text>
        <Text dimColor>
          ・鑰石：地獄與秘境裡，菁英 {Math.round(KEY_DROP_CHANCE.champion * 100)}%、頭目 {Math.round(KEY_DROP_CHANCE.unique * 100)}%、幕首領必掉；開放時贈送 3 把。
        </Text>
        <Text dimColor>・在秘境裡死亡不掉金幣，但時間照走。</Text>
      </Box>
    </Box>
  )
}
