import { atom, read, update } from 'claude-code'
import type { Register, RenderNode } from 'claude-code'

import type { Character, ClassId, Game, LogLine, View } from '../types'
import { clampVitals, newCharacter } from './character'
import { CLASS_IDS, CLASSES } from './classes'
import { simulateOffline, tick } from './combat'
import type { CombatEvent } from './combat'
import { drawHud, HUD_ROWS } from './hud'
import { emptyPouch, GEM_TYPES, gemName, normalizeItem, RARITIES, shownName, statText } from './loot'
import { formatDuration, formatNumber, newPack, placeOf, zoneName } from './monsters'
import { BattlePage, BLOOD, CharPage, CubePage, GearPage, GemsPage, GOLD, OddsPage, QuestsPage, RiftPage, SelectPage, SkillsPage, TownPage } from './pages'
import { formatClock } from './rift'
import { bless, BLESSING_MF, gainFocus, isCommitCommand, isTestCommand, openChest } from './coding'
import { CHECK_EVERY_MS, isNewer, LATEST_URL, VERSION, versionIn } from './version'
import { ACT_INTROS, emptyQuestBonus } from './quests'
import { RUNE_COLOR, runeName, RUNES } from './runes'
import type { PageCtx } from './pages'
import { drawPortrait, drawScene, foeX, PORTRAIT_COLUMNS, PORTRAIT_ROWS, SCENE_ROWS, scrollOf } from './scene'
import type { Corpse } from './scene'

const PANE = 'idle-rpg'
const SCENE_KEY = 'scene'
const HUD_KEY = 'hud'
/** The v1 save stays under 'save', untouched. */
const STORE_KEY = 'v2'
const TICK_MS = 1000
const FRAME_MS = 80
const SAVE_EVERY_TICKS = 5

const gameRef = { plugin: 'idle-rpg', key: 'game' } as const
const newGame = (now: number): Game => ({ version: 2, active: null, chars: {}, stash: [], lastSeen: now })
const gameAtom = atom(gameRef, newGame(0))
const logAtom = atom({ plugin: 'idle-rpg', key: 'log' } as const, [] as LogLine[])
const viewAtom = atom({ plugin: 'idle-rpg', key: 'view' } as const, 'battle' as View)
const treeAtom = atom({ plugin: 'idle-rpg', key: 'tree' } as const, 0)
const inspectAtom = atom({ plugin: 'idle-rpg', key: 'inspect' } as const, 0)
const gemUiAtom = atom({ plugin: 'idle-rpg', key: 'gemUi' } as const, { slot: 0, allWords: false })

/** A stored game, each hero filled out with any field a newer version added. */
const loadGame = (stored: unknown): Game | undefined => {
  const g = stored as Partial<Game> | undefined
  if (g?.version !== 2) return undefined
  const chars: Game['chars'] = {}
  for (const id of CLASS_IDS) {
    const c = g.chars?.[id]
    if (!c) continue
    const fresh = newCharacter(id)
    const equipment = { ...fresh.equipment, ...c.equipment }
    for (const slot of Object.keys(equipment) as (keyof typeof equipment)[]) {
      const item = equipment[slot]
      if (item) equipment[slot] = normalizeItem(item)
    }
    const loaded = { ...fresh, ...c, equipment, bag: (c.bag ?? []).map(normalizeItem), gems: { ...emptyPouch(), ...c.gems } }
    // Monsters from an older version lack today's fields: meet a fresh pack instead.
    const isCurrent = (c.foes ?? []).every(f => f.res !== undefined && f.affixes !== undefined && f.name !== undefined)
    const withRunes = {
      ...loaded,
      runes: RUNES.map((_, i) => c.runes?.[i] ?? 0),
      charms: (c.charms ?? []).map(normalizeItem),
      quests: c.quests ?? [],
      // A hero already past the cap gets a talent point for each level over it.
      talentEarned: c.talentEarned ?? Math.max(0, (c.level ?? 1) - 99),
      questBonus: { ...emptyQuestBonus(), ...c.questBonus },
    }
    chars[id] = isCurrent ? withRunes : { ...withRunes, foes: newPack(loaded.zone, loaded.packs, Math.random), walk: 3 }
  }

  return { version: 2, active: g.active ?? null, chars, stash: (g.stash ?? []).map(normalizeItem), lastSeen: g.lastSeen ?? 0 }
}

const describe = (ev: CombatEvent): LogLine | undefined => {
  switch (ev.kind) {
    case 'kill':
      return ev.elite
        ? {
            text: `${ev.name} 被斬殺！+${formatNumber(ev.xp)} 經驗 +${formatNumber(ev.gold)} 金幣`,
            color: ev.elite === 'champion' ? '#7090ff' : ev.elite === 'unique' ? '#d4a84b' : BLOOD,
          }
        : undefined
    case 'eliteAppears':
      return { text: `${ev.elite === 'unique' ? '★' : '◆'} ${ev.name}${ev.elite === 'champion' ? '菁英群' : ''} 擋住了去路`, color: ev.elite === 'unique' ? '#d4a84b' : '#7090ff' }
    case 'areaClear':
      return { text: `✠ ${zoneName(ev.zone)} 已肅清` }
    case 'actClear':
      return { text: `✠ 幕首領倒下了！${ACT_INTROS[placeOf(ev.zone + 1).act] ?? ''}`, color: GOLD }
    case 'quest':
      return { text: `✔ 任務完成：${ev.name}（${ev.reward}）`, color: '#40c040' }
    case 'riftStart':
      return { text: `◈ 大秘境第 ${ev.tier} 層開啟，倒數五分鐘……`, color: '#c060ff' }
    case 'riftGuardian':
      return { text: `☠ ${ev.name} 降臨了！`, color: BLOOD }
    case 'riftClear':
      return {
        text: `◈ 大秘境第 ${ev.tier} 層${ev.isInTime ? '準時通關' : '超時完成'}（${formatClock(ev.seconds)}）${ev.gem ? '・寶石升級了！' : ''}`,
        color: ev.isInTime ? GOLD : '#a04040',
      }
    case 'riftUnlock':
      return { text: '◈ 地獄已被征服。大秘境的大門為你開啟（獲得 3 把秘境鑰石）', color: '#c060ff' }
    case 'key':
      return { text: '◈ 拾取了秘境鑰石', color: '#c060ff' }
    case 'talentPoint':
      return { text: `★ 獲得天賦點（共 ${ev.total} 點）`, color: GOLD }
    case 'cheatDeath':
      return { text: '★ 不屈：你撐過了致命的一擊！', color: GOLD }
    case 'minionBurst':
      return { text: `僕從爆裂，造成 ${formatNumber(ev.dmg)} 點火焰傷害`, color: '#ff8030' }
    case 'difficultyClear':
      return { text: `✠ 你征服了這個難度。更深的恐懼在等著你……`, color: GOLD }
    case 'levelUp':
      return { text: `✦ 力量湧現…… 等級 ${ev.level}`, color: GOLD }
    case 'bossAppears':
      return { text: `☠ ${ev.name} 自黑暗中現身！`, color: BLOOD }
    case 'death':
      return {
        text: `你已死亡…… 失去 ${formatNumber(ev.goldLost)} 金幣${ev.isRetreat ? '，退回上一層' : ''}`,
        color: BLOOD,
      }
    case 'loot': {
      const verb = ev.action === 'equipped' ? '裝備了' : ev.action === 'sold' ? '賣掉了' : ev.action === 'charm' ? '帶上了' : '拾取了'

      return {
        text: `${verb}【${RARITIES[ev.item.rarity].name}】${shownName(ev.item)}  ${ev.item.unid ? '' : statText(ev.item.stats)}`,
        color: RARITIES[ev.item.rarity].color,
      }
    }
    case 'gem':
      return { text: `拾取了 ${gemName(ev.gem)}`, color: GEM_TYPES[ev.gem.type].color }
    case 'rune':
      return { text: `● 拾取了 ${runeName(ev.rune)} 符文`, color: RUNE_COLOR }
    case 'potionFound':
      return { text: `撿到一瓶${ev.color === 'red' ? '紅' : '藍'}藥水`, color: ev.color === 'red' ? '#d05050' : '#5070d0' }
    default:
      return undefined
  }
}

const statusText = (g: Game, newer?: string) => {
  const note = newer ? `・有新版 ${newer}，重開 Claude Code 即可更新` : ''

  const c = g.active ? g.chars[g.active] : undefined
  const boons = c ? (c.focus > 0 ? `・⚡專注 ${formatClock(c.focus)}` : '') + (c.blessing > 0 ? `・✚祝福 ${formatClock(c.blessing)}` : '') : ''

  return gameStatus(g) + boons + note
}

const gameStatus = (g: Game) => {
  const c = g.active ? g.chars[g.active] : undefined
  if (!c) return '☠ 暗黑放置：輸入 /rpg 選擇你的英雄'
  const who = c.rift
    ? `◈ ${CLASSES[c.classId].name} Lv.${c.level} 大秘境 ${c.rift.tier} 層 ${Math.floor(c.rift.progress)}% ⧗${formatClock(c.rift.timeLeft)}`
    : `☠ ${CLASSES[c.classId].name} Lv.${c.level} ${zoneName(c.zone)}`
  if (c.deadFor > 0) return `${who}・你已死亡`
  const alive = c.foes.filter(f => f.hp > 0)
  const lead = alive.find(f => f.elite) ?? alive[0]
  if (c.walk > 0 || !lead) return `${who}・探索中…・金幣 ${formatNumber(c.gold)}`
  const pct = Math.round((alive.reduce((s, f) => s + f.hp, 0) / c.foes.reduce((s, f) => s + f.maxHp, 0)) * 100)

  return `${who}・${lead.name}${alive.length > 1 ? ` 等 ${alive.length} 隻` : ''} ${pct}%・金幣 ${formatNumber(c.gold)}`
}

export const register: Register = on => {
  // Animation, the module's own: lost on a reload, which costs one blink.
  let lastEvents: CombatEvent[] = []
  let lastTickAt = 0
  let corpse: Corpse | undefined
  let frame = 0
  let sceneColumns = 0
  let isPaneOpen = false
  let currentView: View = 'battle'
  let latest: Game | undefined
  let $now: () => Promise<number> = async () => 0
  /** A newer published version, once a check has found one. */
  let newer: string | undefined

  const activeChar = (g: Game | undefined) => (g?.active ? g.chars[g.active] : undefined)
  const sceneT = async () => Math.min(1, Math.max(0, ((await $now()) - lastTickAt) / TICK_MS))

  on('session.start', async ($, e, next) => {
    $now = () => $.clock.now()
    await $.command.register({ name: 'rpg', description: '打開暗黑放置 RPG' })

    const now = await $.clock.now()
    const held = await $.state.get(gameRef)

    // A hot reload keeps the session's game; a fresh session loads the store
    // and pays out the time the hero spent fighting while Claude Code was closed.
    if ((held.value as Game | undefined)?.version !== 2) {
      const stored = loadGame(await $.store.get(STORE_KEY))
      let game = stored ?? newGame(now)
      const c = activeChar(game)
      const away = (now - game.lastSeen) / 1000
      if (stored && c && away >= 60) {
        const { save, report } = simulateOffline(c, away, Math.random)
        game = { ...game, chars: { ...game.chars, [c.classId]: save } }
        $.ui.toast(
          `離線 ${formatDuration(report.seconds)}：斬殺 ${report.kills} 隻、+${formatNumber(report.gold)} 金幣` +
            (report.levels > 0 ? `、升了 ${report.levels} 級` : '') +
            (report.items > 0 ? `、拾獲 ${report.items} 件裝備` : '') +
            (report.deaths > 0 ? `、陣亡 ${report.deaths} 次` : '') +
            (report.best && RARITIES[report.best.rarity].rank >= 2 ? `（最佳：${report.best.name}）` : ''),
          { timeoutMs: 9000 },
        )
      }
      game = { ...game, lastSeen: now }
      await $.state.set(gameRef, game)
      await $.store.set(STORE_KEY, game)
    } else {
      // A hot reload: the game was kept, but by an older version of this code,
      // so bring it up to date the same way a stored one is.
      const game = loadGame(held.value) ?? newGame(now)
      await $.state.set(gameRef, game)
      await $.store.set(STORE_KEY, game)
    }
    latest = await read($, gameAtom)
    lastTickAt = now
    $.ui.status(statusText(latest, newer))

    // Installed copies only learn of a new version on restart: look now and then, and say so once.
    const checkForUpdate = async () => {
      try {
        const res = await $.http.fetch(LATEST_URL)
        const found = res.ok ? versionIn(res.text) : undefined
        if (!found || !isNewer(found, VERSION) || found === newer) return
        newer = found
        $.ui.toast(`✦ 暗黑放置有新版 ${found}（你的是 ${VERSION}）。重開 Claude Code 即可更新，存檔會保留。`, { timeoutMs: 12000 })
        if (latest) $.ui.status(statusText(latest, newer))
      } catch {
        // Offline or refused: try again at the next check.
      }
    }
    void checkForUpdate()
    $.clock.every(CHECK_EVERY_MS, checkForUpdate)

    let ticks = 0
    $.clock.every(TICK_MS, async () => {
      const id = latest?.active
      if (!id) return
      const before = latest?.chars[id]
      let events: CombatEvent[] = []
      const game = await update($, gameAtom, g => {
        const c = g.active ? g.chars[g.active] : undefined
        if (!c) return g
        const r = tick(c, Math.random)
        events = r.events

        return { ...g, chars: { ...g.chars, [c.classId]: r.save } }
      })

      const kill = events.find(ev => ev.kind === 'kill')
      if (kill?.kind === 'kill' && before && sceneColumns > 0) {
        const loot = events.find(ev => ev.kind === 'loot')
        const gem = events.find(ev => ev.kind === 'gem')
        const rune = events.find(ev => ev.kind === 'rune')
        corpse = {
          worldX: scrollOf(before, 1) + foeX(sceneColumns, kill.foe, before.foes.length, before.minions.length > 0),
          loot: loot?.kind === 'loot' ? loot.item.rarity : undefined,
          gem: gem?.kind === 'gem' ? GEM_TYPES[gem.gem.type].pixel : rune?.kind === 'rune' ? 0xff9a30 : undefined,
        }
      }
      lastEvents = events
      lastTickAt = await $.clock.now()
      latest = game

      const lines = events.map(describe).filter((line): line is LogLine => line !== undefined)
      if (lines.length > 0) await update($, logAtom, log => [...log, ...lines].slice(-6))
      for (const ev of events) {
        if (ev.kind === 'loot' && RARITIES[ev.item.rarity].rank >= 2) {
          $.ui.toast(`✦ ${RARITIES[ev.item.rarity].name}掉落：${shownName(ev.item)}`, { timeoutMs: 6000 })
        } else if (ev.kind === 'rune' && ev.rune >= 11) {
          $.ui.toast(`● 高階符文掉落：${runeName(ev.rune)}`, { timeoutMs: 8000 })
        } else if (
          ev.kind === 'quest' ||
          ev.kind === 'talentPoint' ||
          ev.kind === 'levelUp' ||
          ev.kind === 'actClear' ||
          ev.kind === 'difficultyClear' ||
          ev.kind === 'bossAppears' ||
          ev.kind === 'riftClear' ||
          ev.kind === 'riftUnlock' ||
          ev.kind === 'riftGuardian'
        ) {
          $.ui.toast(describe(ev)?.text ?? '')
        }
      }
      $.ui.status(statusText(game, newer))

      ticks += 1
      if (ticks % SAVE_EVERY_TICKS === 0) await $.store.set(STORE_KEY, { ...game, lastSeen: lastTickAt })
    })

    // The scene and the orbs between ticks: walking, spells and flicker, repainted in place.
    $.clock.every(FRAME_MS, async () => {
      const c = activeChar(latest)
      if (!isPaneOpen || currentView !== 'battle' || !c || sceneColumns === 0) return
      frame += 1
      const t = await sceneT()
      const scene = await $.ui.blit({
        requestId: PANE,
        key: SCENE_KEY,
        cells: drawScene({ char: c, events: lastEvents, t, frame, columns: sceneColumns, corpse }),
      })
      if (scene.deny !== undefined) {
        isPaneOpen = false

        return
      }
      if (frame % 2 === 0) await $.ui.blit({ requestId: PANE, key: HUD_KEY, cells: drawHud(c, frame, sceneColumns) })
    })

    return next(e)
  })

  // Claude's work feeds the hero: every tool brings focus, a commit a chest, passing tests a blessing.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    try {
      if (!latest?.active || result.deny !== undefined) return result
      const command = e.tool === 'Bash' || e.tool === 'PowerShell' ? String((e as { command?: unknown }).command ?? '') : ''
      const isOk = !result.isError
      const committed =
        isOk && (((result.result as { gitOperation?: { commit?: unknown } } | undefined)?.gitOperation?.commit !== undefined) || isCommitCommand(command))
      const isBlessed = isOk && isTestCommand(command)
      let chest: ReturnType<typeof openChest>['events'] = []
      const game = await update($, gameAtom, g => {
        const c = g.active ? g.chars[g.active] : undefined
        if (!c) return g
        let hero = gainFocus(c)
        if (isBlessed) hero = bless(hero)
        if (committed) {
          const opened = openChest(hero, Math.random)
          hero = opened.save
          chest = opened.events
        }

        return { ...g, chars: { ...g.chars, [c.classId]: hero } }
      })
      latest = game
      const lines: LogLine[] = []
      for (const ev of chest) {
        if (ev.kind !== 'chest' || ev.event.kind !== 'loot') continue
        const item = ev.event.item
        const text = `▣ 提交了程式碼，打開寶箱：+${formatNumber(ev.gold)} 金幣、【${RARITIES[item.rarity].name}】${shownName(item)}`
        lines.push({ text, color: RARITIES[item.rarity].color })
        $.ui.toast(text, { timeoutMs: 8000 })
      }
      if (isBlessed) {
        const text = `✚ 測試通過！祝福降臨：生命法力全滿，魔法尋寶 +${BLESSING_MF}%（10 分鐘）`
        lines.push({ text, color: '#40c040' })
        $.ui.toast(text, { timeoutMs: 6000 })
      }
      if (lines.length > 0) await update($, logAtom, log => [...log, ...lines].slice(-6))
      $.ui.status(statusText(game, newer))
    } catch {
      // The game never gets in the way of the work.
    }

    return result
  })

  on('session.end', async ($, e, next) => {
    const game = await read($, gameAtom)
    await $.store.set(STORE_KEY, { ...game, lastSeen: await $.clock.now() })

    return next(e)
  })

  on('command.run', { command: 'rpg' }, async $ => {
    const game = await read($, gameAtom)
    if (!game.active) await update($, viewAtom, () => 'select' as View)
    await $.ui.open({ id: PANE, title: '暗黑放置', focus: true, closeOnEscape: true })

    return { text: game.active ? '你踏入了黑暗……（按 Esc 離開面板，戰鬥會繼續）' : '選擇你的英雄。' }
  })

  on('ui.close', { id: PANE }, ($, e, next) => {
    isPaneOpen = false

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Text } = els
    const game = await read($, gameAtom)
    const log = await read($, logAtom)
    const tree = await read($, treeAtom)
    const inspect = await read($, inspectAtom)
    const gemUi = await read($, gemUiAtom)
    let view = await read($, viewAtom)
    latest = game
    const c = activeChar(game)
    if (!c) view = 'select'
    currentView = view

    const persist = (fn: (c: Character) => Character | null) => {
      void (async () => {
        const after = await update($, gameAtom, g => {
          const cur = g.active ? g.chars[g.active] : undefined
          const changed = cur ? fn(cur) : null
          if (!cur || !changed) return g

          return { ...g, chars: { ...g.chars, [cur.classId]: clampVitals(changed) } }
        })
        latest = after
        await $.store.set(STORE_KEY, { ...after, lastSeen: await $.clock.now() })
      })()
    }
    const persistGame = (fn: (g: Game) => Game | null) => {
      void (async () => {
        const after = await update($, gameAtom, g => fn(g) ?? g)
        latest = after
        await $.store.set(STORE_KEY, { ...after, lastSeen: await $.clock.now() })
      })()
    }
    const setView = (v: View) => () => {
      currentView = v
      void update($, viewAtom, () => v)
    }
    const setTree = (n: number) => () => void update($, treeAtom, () => n)
    const selectClass = (id: ClassId) => () => {
      void (async () => {
        const after = await update($, gameAtom, g => ({
          ...g,
          active: id,
          chars: { ...g.chars, [id]: g.chars[id] ?? newCharacter(id) },
        }))
        latest = after
        lastEvents = []
        corpse = undefined
        await update($, logAtom, () => [
          { text: `${CLASSES[id].name} 踏入了黑暗……`, color: GOLD },
          { text: ACT_INTROS[placeOf(after.chars[id]?.zone ?? 0).act] ?? '' },
        ])
        await $.store.set(STORE_KEY, { ...after, lastSeen: await $.clock.now() })
        currentView = 'battle'
        await update($, viewAtom, () => 'battle' as View)
        $.ui.status(statusText(after, newer))
      })()
    }
    const toast = (text: string) => $.ui.toast(text)
    const setInspect = (id: number) => () => void update($, inspectAtom, () => id)
    const setGemUi = (next: typeof gemUi) => void update($, gemUiAtom, () => next)

    if (view === 'select' || !c) {
      const portraits = {} as Record<ClassId, RenderNode>
      for (const id of CLASS_IDS) {
        portraits[id] =
          'Raster' in els ? (
            <els.Raster key={`portrait-${id}`} columns={PORTRAIT_COLUMNS} rows={PORTRAIT_ROWS} cells={drawPortrait(id, 0)} />
          ) : (
            <Text> </Text>
          )
      }
      const ctx: PageCtx = { els, game, char: c ?? newCharacter('barbarian'), view, tree, persist, persistGame, setView, setTree, selectClass, toast, inspect, setInspect, gemUi, setGemUi }

      return SelectPage({ ...ctx, portraits })
    }

    const ctx: PageCtx = { els, game, char: c, view, tree, persist, persistGame, setView, setTree, selectClass, toast, inspect, setInspect, gemUi, setGemUi }
    switch (view) {
      case 'char':
        return CharPage(ctx)
      case 'skills':
        return SkillsPage(ctx)
      case 'gear':
        return GearPage(ctx)
      case 'gems':
        return GemsPage(ctx)
      case 'odds':
        return OddsPage(ctx)
      case 'town':
        return TownPage(ctx)
      case 'cube':
        return CubePage(ctx)
      case 'quests':
        return QuestsPage(ctx)
      case 'rift':
        return RiftPage(ctx)
    }

    let scene: RenderNode
    let hud: RenderNode
    if ('Raster' in els) {
      const { Raster } = els
      // Room for the frame around the scene.
      sceneColumns = Math.max(48, Math.min(100, (e.viewport?.columns ?? 72) - 6))
      isPaneOpen = true
      scene = (
        <Raster
          key={SCENE_KEY}
          columns={sceneColumns}
          rows={SCENE_ROWS}
          cells={drawScene({ char: c, events: lastEvents, t: await sceneT(), frame, columns: sceneColumns, corpse })}
        />
      )
      hud = <Raster key={HUD_KEY} columns={sceneColumns} rows={HUD_ROWS} cells={drawHud(c, frame, sceneColumns)} />
    } else {
      scene = <Text dimColor>（這個介面無法顯示像素畫面，請在終端機開啟）</Text>
      hud = <Text> </Text>
    }

    return BattlePage({ ...ctx, scene, hud, log })
  })
}
