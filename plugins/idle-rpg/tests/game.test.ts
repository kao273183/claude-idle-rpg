import { expect, mock, test } from 'claude-code/testing'

import type { Character, Item } from '../types'
import {
  attrOf,
  attrPointsLeft,
  autoAllocate,
  canWear,
  heroPower,
  heroStats,
  newCharacter,
  rankOf,
  respecCost,
  respecSkills,
  skillDamage,
  skillPointsLeft,
} from '../hooks/character'
import { CLASS_IDS } from '../hooks/classes'
import { deathGoldCap, DEATH_SECONDS, resistFactor, simulateOffline, tick } from '../hooks/combat'
import type { CombatEvent } from '../hooks/combat'
import { drawHud, HUD_ROWS } from '../hooks/hud'
import { isNewer, versionIn } from '../hooks/version'
import { bless, BLESSING_MF, BLESSING_SECONDS, CHEST_COOLDOWN, FOCUS_MAX, FOCUS_PCT, gainFocus, isCommitCommand, isTestCommand, openChest } from '../hooks/coding'
import {
  activeSets,
  BAG_SIZE,
  CHARM_SPACE,
  charmCells,
  combineGems,
  dropOdds,
  gamble,
  identify,
  itemStats,
  makeCharm,
  makeItem,
  pickUp,
  rarityShares,
  rollDrop,
  socketGem,
} from '../hooks/loot'
import { RUNES, runCube, socketRune, upgradeRune } from '../hooks/runes'
import { AREAS_PER_ACT, AREAS_PER_DIFFICULTY, newPack, PACKS_PER_AREA, placeOf, WALK_SECONDS } from '../hooks/monsters'
import type { Foe } from '../types'
import { drawScene, SCENE_ROWS } from '../hooks/scene'
import { classSkills, SKILLS } from '../hooks/skilltree'

/** One monster of the first area, with whatever a test needs changed. */
const newFoe = (zone = 0, extra: Partial<Foe> = {}): Foe => ({ ...newPack(zone, 0, () => 0.9)[0]!, affixes: [], elite: undefined, ...extra })

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296

  return seed / 4294967296
}

/** A hero at a level, points spent by the auto switches, standing in front of a monster. */
const hero = (classId: Character['classId'], level = 1, extra: Partial<Character> = {}): Character => {
  const c = autoAllocate({ ...newCharacter(classId), level })
  const s = heroStats(c)

  return { ...c, hp: s.maxHp, mana: s.maxMana, walk: 0, ...extra }
}

// ── Characters ─────────────────────────────────────────────────────────────
test('every class starts at full life and mana, its skill trees 6 skills deep', () => {
  for (const id of CLASS_IDS) {
    const c = newCharacter(id)
    const s = heroStats(c)
    expect(c.hp).toBe(s.maxHp)
    expect(c.mana).toBe(s.maxMana)
    for (const tree of [0, 1, 2]) expect(classSkills(id, tree)).toHaveLength(6)
  }
})

test('five attribute points a level, spent by the class split', () => {
  const barb = hero('barbarian', 11)
  expect(attrPointsLeft(barb)).toBe(0)
  expect(attrOf(barb, 'str') - 30).toBeGreaterThan(attrOf(barb, 'dex') - 20)
  expect(barb.attrs.ene).toBe(0)

  const sorc = hero('sorceress', 11)
  expect(sorc.attrs.vit).toBeGreaterThan(sorc.attrs.str)
})

test('a skill point a level, on skills the level has opened', () => {
  const c = hero('sorceress', 13)
  expect(skillPointsLeft(c)).toBe(0)
  for (const [id, rank] of Object.entries(c.skills)) {
    expect(SKILLS[id]?.unlock ?? 99).toBeLessThanOrEqual(13)
    expect(rank).toBeGreaterThan(0)
  }
  expect(c.mainSkill).not.toBe(null)
  expect(rankOf(c, 'meteor')).toBe(0)
})

test('respec costs gold and gives the points back', () => {
  const c = { ...hero('barbarian', 10), gold: 5000 }
  const reset = respecSkills(c)
  expect(skillPointsLeft(reset)).toBe(9)
  expect(reset.gold).toBe(5000 - respecCost(c))
  expect(respecSkills({ ...c, gold: 0 })).toEqual({ ...c, gold: 0 })
})

// ── Combat ─────────────────────────────────────────────────────────────────
test('the barbarian bashes harder than a plain swing, and pays mana for it', () => {
  const c = hero('barbarian', 2)
  expect(c.mainSkill).toBe('bash')
  expect(skillDamage(c, 'bash')).toBeGreaterThan(skillDamage(c, 'attack'))
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6 }] }, seeded(1))
  expect(r.events.some(ev => ev.kind === 'cast' && ev.skill === 'bash')).toBe(true)
})

test('a sorceress out of mana falls back to her staff', () => {
  const c = hero('sorceress', 3, { mana: 0, belt: { red: 0, blue: 0 } })
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6 }] }, seeded(2))
  const cast = r.events.find(ev => ev.kind === 'cast')
  expect(cast?.kind === 'cast' && cast.skill).toBe('attack')
})

test('the necromancer raises skeletons on the road, and they fight', () => {
  let c = hero('necromancer', 4, { walk: 3 })
  expect(rankOf(c, 'raiseSkeleton')).toBeGreaterThan(0)
  for (let i = 0; i < 3; i++) c = tick(c, seeded(i)).save
  expect(c.minions.length).toBeGreaterThan(0)

  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6 }] }, seeded(5))
  expect(r.events.some(ev => ev.kind === 'minionHit')).toBe(true)
})

test('a curse makes the monster take more damage', () => {
  const c = hero('necromancer', 3)
  const foe = { ...newFoe(0), hp: 1e6, maxHp: 1e6 }
  const cursed = { ...foe, status: { curse: { id: 'amplify', left: 5, rank: 5 } } }
  const plain = tick({ ...c, minions: [], skills: {}, foes: [foe] }, () => 0.5)
  const hit = tick({ ...c, minions: [], skills: {}, foes: [cursed] }, () => 0.5)
  expect(1e6 - hit.save.foes[0]!.hp).toBeGreaterThan(1e6 - plain.save.foes[0]!.hp)
})

test('a shield takes the blows first', () => {
  const c = hero('sorceress', 13, { shield: 1000 })
  const r = tick({ ...c, foes: [{ ...newFoe(3), hp: 1e9, maxHp: 1e9 }] }, () => 0.5)
  const hurt = r.events.find(ev => ev.kind === 'hurt')
  expect(hurt?.kind === 'hurt' && (hurt.absorbed ?? 0)).toBeGreaterThan(0)
  expect(r.save.hp).toBe(c.hp)
})

test('a low hero drinks a red potion', () => {
  const c = hero('barbarian', 2)
  const r = tick({ ...c, hp: 5, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6, atk: 1 }] }, () => 0.9)
  expect(r.events.some(ev => ev.kind === 'potion' && ev.color === 'red')).toBe(true)
  expect(r.save.belt.red).toBe(c.belt.red - 1)
})

test('death costs a tenth of the gold, and the hero gets up again', () => {
  const c = hero('sorceress', 1, { hp: 1, gold: 500, belt: { red: 0, blue: 0 } })
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6, atk: 1e6 }] }, () => 0.9)
  expect(r.events.some(ev => ev.kind === 'death')).toBe(true)
  expect(r.save.gold).toBe(450)
  expect(r.save.deadFor).toBe(DEATH_SECONDS)

  let s = r.save
  for (let i = 0; i < DEATH_SECONDS; i++) s = tick(s, seeded(i)).save
  expect(s.deadFor).toBe(0)
  expect(s.hp).toBe(heroStats(s).maxHp)
})

test('a cleared pack pays and brings the next; the last pack of an act is its boss', () => {
  const c = hero('barbarian', 1, { zone: AREAS_PER_ACT - 1, maxZone: AREAS_PER_ACT - 1, packs: PACKS_PER_AREA - 2 })
  const foe = { ...newFoe(0), hp: 1, gold: 7 }
  const r = tick({ ...c, foes: [foe] }, seeded(3))
  expect(r.save.gold).toBeGreaterThanOrEqual(7)
  expect(r.save.packs).toBe(PACKS_PER_AREA - 1)
  expect(r.save.foes.some(f => f.isBoss)).toBe(true)
  expect(r.events.some(ev => ev.kind === 'bossAppears')).toBe(true)
  expect(r.save.walk).toBe(WALK_SECONDS)
})

test('the act boss falls: the act is cleared and the next area opens', () => {
  const zone = AREAS_PER_ACT - 1
  const c = hero('barbarian', 1, { zone, maxZone: zone, packs: PACKS_PER_AREA - 1 })
  const r = tick({ ...c, foes: [{ ...newFoe(zone), hp: 1, isBoss: true, elite: 'boss' }] }, seeded(4))
  expect(r.events.some(ev => ev.kind === 'actClear')).toBe(true)
  expect(r.save.maxZone).toBe(zone + 1)
  expect(r.save.zone).toBe(zone + 1)
  expect(placeOf(r.save.zone).act).toBe(1)
})

test('packs come three to five strong, with elites among them', () => {
  const rng = seeded(8)
  let elites = 0
  for (let i = 0; i < 200; i++) {
    const pack = newPack(5, i % (PACKS_PER_AREA - 1), rng)
    expect(pack.length).toBeGreaterThanOrEqual(2)
    expect(pack.length).toBeLessThanOrEqual(5)
    if (pack.some(f => f.elite)) elites++
  }
  expect(elites).toBeGreaterThan(20)
  expect(newPack(5, PACKS_PER_AREA - 1, rng).some(f => f.elite === 'unique')).toBe(true)
})

test('an immune monster takes nothing from its element; the sorceress turns to another', () => {
  const foe = { ...newFoe(0), hp: 1e6, maxHp: 1e6, res: { fire: 100 } }
  expect(resistFactor(foe, 'fire')).toBe(0)
  expect(resistFactor(foe, 'cold')).toBe(1)
  const c = hero('sorceress', 5, { skills: { fireBolt: 3, iceBolt: 1 }, mainSkill: 'fireBolt', autoSkill: false })
  const r = tick({ ...c, foes: [foe] }, seeded(1))
  const cast = r.events.find(ev => ev.kind === 'cast')
  expect(cast?.kind === 'cast' && cast.skill).toBe('iceBolt')
})

test('lower resist breaks an immunity', () => {
  const foe = { ...newFoe(0), res: { fire: 110 }, status: { curse: { id: 'lowerRes', left: 5, rank: 5 } } }
  expect(resistFactor(foe, 'fire')).toBeGreaterThan(0)
})

test('nightmare and hell take their toll on resistances', () => {
  const c = hero('barbarian', 30)
  expect(heroStats({ ...c, zone: AREAS_PER_DIFFICULTY }).res).toBe(heroStats(c).res - 40)
  expect(heroStats({ ...c, zone: 2 * AREAS_PER_DIFFICULTY }).res).toBe(heroStats(c).res - 100)
})

test('an extra-fast elite strikes twice a second', () => {
  // No skills: a howl would leave it cowering.
  const c = hero('barbarian', 5, { skills: {}, mainSkill: null, autoSkill: false })
  const foe = { ...newFoe(0), hp: 1e6, maxHp: 1e6, affixes: ['fast' as const] }
  const r = tick({ ...c, foes: [foe] }, () => 0.9)
  expect(r.events.filter(ev => ev.kind === 'hurt')).toHaveLength(2)
})

test('three deaths in an area send the hero back one, to grow a level first', () => {
  const c = hero('sorceress', 4, { zone: 5, maxZone: 5, areaDeaths: 2, hp: 1, belt: { red: 0, blue: 0 } })
  const r = tick({ ...c, foes: [{ ...newFoe(5), hp: 1e9, maxHp: 1e9, atk: 1e9, element: 'phys' }] }, () => 0.9)
  const death = r.events.find(ev => ev.kind === 'death')
  expect(death?.kind === 'death' && death.isRetreat).toBe(true)
  expect(r.save.zone).toBe(4)
  expect(r.save.retryLevel).toBe(5)
})

for (const id of CLASS_IDS) {
  test(`an hour offline takes a new ${id} through the first act`, () => {
    const { save, report } = simulateOffline(newCharacter(id), 3600, seeded(7))
    expect(report.kills).toBeGreaterThan(200)
    expect(save.level).toBeGreaterThan(15)
    expect(save.maxZone).toBeGreaterThanOrEqual(AREAS_PER_ACT)
  })
}

// ── Items ──────────────────────────────────────────────────────────────────
test('heavy gear needs strength, and auto-equip leaves it in the bag', () => {
  const c = hero('sorceress', 1)
  const heavy: Item = { ...makeItem(20, 2, 1, seeded(1)), slot: 'armor', req: { str: 999 } }
  expect(canWear(c, heavy)).toBe(false)
  const r = pickUp(c, heavy, heroPower)
  expect(r.action).toBe('bag')
  expect(r.save.equipment.armor).toBe(null)
})

test('bosses always drop, deeper zones drop stronger items', () => {
  for (let i = 0; i < 30; i++) expect(rollDrop(0, 'boss', i, seeded(i))).not.toBe(null)
  expect(makeItem(12, 2, 2, seeded(9)).value).toBeGreaterThan(makeItem(0, 2, 1, seeded(9)).value)
})

test('sets, gems and the odds still hold', () => {
  const piece = (id: number, slot: Item['slot']): Item => ({
    id, slot, rarity: 4, name: 't', level: 1, stats: { atk: 1 }, value: 1, sockets: 0, gems: [], set: 'night',
  })
  let c = hero('barbarian', 1)
  c = { ...c, equipment: { ...c.equipment, weapon: piece(1, 'weapon'), armor: piece(2, 'armor'), helm: piece(3, 'helm'), ring: piece(4, 'ring') } }
  expect(activeSets(c.equipment)[0]?.tiers.every(t => t.isActive)).toBe(true)

  c = { ...c, gems: { ...c.gems, ruby: [3, 0, 0, 0] } }
  c = combineGems(c, 'ruby', 0)
  expect(c.gems.ruby).toEqual([0, 1, 0, 0])
  const socketed = socketGem({ ...c, equipment: { ...c.equipment, armor: { ...piece(2, 'armor'), sockets: 1 } } }, 'armor', { type: 'ruby', grade: 1 })
  expect(socketed.equipment.armor?.gems).toHaveLength(1)

  for (const tier of ['normal', 'champion', 'unique', 'boss'] as const) {
    const odds = dropOdds(tier)
    expect(Math.abs(odds.rarities.reduce((sum, r) => sum + r.chance, 0) + odds.charm - odds.item)).toBeLessThan(1e-9)
  }
  expect(BAG_SIZE).toBe(12)
})

// ── Drawing ────────────────────────────────────────────────────────────────
test('the scene and the HUD encode a cell per column and row, for every class and skill', () => {
  for (const id of CLASS_IDS) {
    const c = hero(id, 30, { minions: [{ id: 1, kind: 'skeleton', hp: 1, maxHp: 1 }, { id: 2, kind: 'revive', hp: 1, maxHp: 1 }], shield: 5 })
    for (const s of classSkills(id)) {
      for (const t of [0.1, 0.4, 0.8]) {
        const events = [
          { kind: 'cast' as const, skill: s.id },
          { kind: 'hit' as const, foe: 0, dmg: 12, isCrit: true, skill: s.id, element: s.element ?? 'phys' },
          { kind: 'hurt' as const, foe: 0, dmg: 3, element: 'fire' as const },
        ]
        expect(drawScene({ char: c, events, t, frame: 3, columns: 60 }).length).toBe(Math.ceil((60 * SCENE_ROWS * 12) / 3) * 4)
      }
    }
    expect(drawScene({ char: { ...c, deadFor: 2 }, events: [], t: 0.5, frame: 1, columns: 60 }).length).toBeGreaterThan(0)
    expect(drawHud(c, 3, 60).length).toBe(Math.ceil((60 * HUD_ROWS * 12) / 3) * 4)
  }
})

// ── The pane ───────────────────────────────────────────────────────────────
for (const surface of ['terminal', 'desktop'] as const) {
  test(`picking a class and walking every page on ${surface}`, async ($, on) => {
    mock.clock(on)
    mock.store(on)
    on('command.register', () => ({ value: undefined }) as never)
    on('session.start', (_$, e) => e as never)
    await $.session.start({ source: 'startup', cwd: '.' } as never)

    const ui = await $.ui.mount({ plugin: 'idle-rpg', surface, component: 'Pane', requestId: 'idle-rpg', props: {} as never })
    expect(await ui.find({ key: 'pick-sorceress' })).toBeDefined()
    await ui.press({ key: 'pick-sorceress' })
    expect(await ui.find({ key: 'tab-char' })).toBeDefined()
    if (surface === 'terminal') expect(await ui.find({ key: 'scene' })).toBeDefined()

    for (const tab of ['tab-char', 'tab-skills', 'tab-gear', 'tab-gems', 'tab-town', 'tab-odds', 'tab-battle']) {
      await ui.press({ key: tab })
      expect(await ui.find({ key: tab })).toBeDefined()
    }
    await ui.press({ key: 'switch' })
    expect(await ui.find({ key: 'pick-necromancer' })).toBeDefined()
  })
}

test('attribute and skill buttons spend points', async ($, on) => {
  const c = { ...newCharacter('barbarian'), level: 3, autoAttr: false, autoSkill: false }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: c }, lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  expect((await ui.find({ key: 'tab-char' }))?.text).toContain('+10')
  await ui.press({ key: 'tab-char' })
  await ui.press({ key: 'attr-str' })
  expect((await ui.find({ key: 'tab-char' }))?.text).toContain('+9')

  await ui.press({ key: 'tab-skills' })
  await ui.press({ key: 'skill-bash' })
  await ui.press({ key: 'skill-leap' }) // opens at 12: nothing happens
  expect((await ui.find({ key: 'tab-skills' }))?.text).toContain('+1')
  expect(await ui.find({ key: 'main-bash' })).toBeDefined()
})

test('the stash keeps an item for every hero, and waypoints go where the hero has been', async ($, on) => {
  const item = makeItem(2, 2, 77, seeded(2))
  const barb = { ...newCharacter('barbarian'), bag: [item], maxZone: 3, nextItemId: 100 }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: barb }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-town' })
  await ui.press({ key: `store-${item.id}` })
  expect(await ui.find({ key: 'take-0' })).toBeDefined()
  expect(await ui.find({ key: `store-${item.id}` })).toBeUndefined()

  expect(await ui.find({ key: 'wp-3' })).toBeDefined()
  expect(await ui.find({ key: 'wp-4' })).toBeUndefined()
  await ui.press({ key: 'wp-2' })
  expect((await ui.find({ key: 'wp-2' }))?.text).toContain('【')

  await ui.press({ key: 'take-0' })
  expect(await ui.find({ key: 'take-0' })).toBeUndefined()
})

// ── Phase 3: affixes, magic find, runes, the cube, charms ──────────────────
const rune = (en: string) => RUNES.findIndex(r => r.en === en)

test('magic items wear a prefix, a suffix or both, and deeper zones roll higher tiers', () => {
  const rng = seeded(31)
  for (let i = 0; i < 30; i++) {
    const item = makeItem(3, 1, i, rng)
    expect(Object.keys(item.stats).length).toBeGreaterThan(0)
    expect(item.name.length).toBeGreaterThan(2)
    expect(item.unid).toBe(undefined)
  }
  const shallow = makeItem(0, 2, 1, seeded(5), 'armor')
  const deep = makeItem(30, 2, 1, seeded(5), 'armor')
  expect(itemStats(deep).hp).toBeGreaterThan(itemStats(shallow).hp)
  expect(shallow.unid).toBe(true)
})

test('magic find raises the better rarities, less and less', () => {
  const share = (mf: number) => rarityShares('normal', mf).find(([r]) => r === 3)![1]
  expect(share(100)).toBeGreaterThan(share(0))
  expect(share(400) - share(300)).toBeLessThan(share(100) - share(0))
})

test('the right runes in a plain item make a runeword', () => {
  const plain = { ...makeItem(5, 0, 1, seeded(1), 'weapon'), sockets: 2, gems: [], runes: [] }
  let c: Character = { ...hero('barbarian', 10), equipment: { ...newCharacter('barbarian').equipment, weapon: plain } }
  c = { ...c, runes: c.runes.map((_, i) => (i === rune('Tir') || i === rune('El') ? 1 : 0)) }
  c = socketRune(c, 'weapon', rune('Tir'))
  expect(c.equipment.weapon?.runeword).toBe(undefined)
  c = socketRune(c, 'weapon', rune('El'))
  expect(c.equipment.weapon?.runeword).toBe('steel')
  expect(c.equipment.weapon?.rarity).toBe(5)
  // The runeword's own crit, on top of whatever the base gives.
  expect(itemStats(c.equipment.weapon!).crit - (c.equipment.weapon!.stats.crit ?? 0)).toBe(5)
  expect(c.runes[rune('El')]).toBe(0)
})

test('three lesser runes cube into the next', () => {
  const c = { ...hero('sorceress', 1) }
  const up = upgradeRune({ ...c, runes: c.runes.map((_, i) => (i === 0 ? 3 : 0)) }, 0)
  expect(up.runes[0]).toBe(0)
  expect(up.runes[1]).toBe(1)
})

test('the cube punches sockets into a plain item for three chipped gems', () => {
  const plain = { ...makeItem(2, 0, 9, seeded(2), 'armor'), sockets: 0 }
  const c = { ...hero('barbarian', 1), bag: [plain], gems: { ...newCharacter('barbarian').gems, ruby: [3, 0, 0, 0] } }
  const after = runCube(c, 'sockets', plain.id, seeded(3))
  expect(after.bag[0]!.sockets).toBeGreaterThan(0)
  expect(after.gems.ruby[0]).toBe(0)
})

test('charms are carried while they fit, and count', () => {
  let c = hero('necromancer', 5)
  const before = heroStats(c)
  for (let i = 0; i < 6; i++) c = pickUp(c, makeCharm(10, 100 + i, seeded(i), 'large'), heroPower).save
  expect(charmCells(c.charms)).toBeLessThanOrEqual(CHARM_SPACE)
  expect(c.charms.length).toBe(4)
  expect(c.bag.length).toBe(2)
  const after = heroStats(c)
  expect(after.maxHp + after.weapon + after.def + after.goldFind + after.res + after.magicFind).toBeGreaterThan(
    before.maxHp + before.weapon + before.def + before.goldFind + before.res + before.magicFind,
  )
})

test('+skills raise every learned skill, and only those', () => {
  const c = hero('sorceress', 13)
  const ring = { ...makeItem(5, 1, 50, seeded(4), 'ring'), stats: { skills: 2 } }
  const worn = { ...c, equipment: { ...c.equipment, ring } }
  expect(rankOf(worn, 'fireBolt')).toBe(rankOf(c, 'fireBolt') + 2)
  expect(rankOf(worn, 'meteor')).toBe(0)
})

test('gambling costs gold and hands over an unidentified item', () => {
  const c = { ...hero('barbarian', 10), gold: 1e9, bag: [] }
  const r = gamble(c, 'helm', seeded(6))
  expect(r.item?.unid).toBe(true)
  expect(r.item?.slot).toBe('helm')
  expect(r.save.gold).toBeLessThan(1e9)
  expect(identify(r.item!).unid).toBe(undefined)
})

test('life leech heals with every blow', () => {
  const c = hero('barbarian', 5, { hp: 10, skills: {}, mainSkill: null, autoSkill: false, belt: { red: 0, blue: 0 } })
  const ring = { ...makeItem(5, 1, 50, seeded(4), 'ring'), stats: { ls: 50 }, req: undefined }
  const r = tick({ ...c, equipment: { ...c.equipment, ring }, foes: [{ ...newFoe(0), hp: 1e6, maxHp: 1e6, atk: 0 }] }, () => 0.5)
  expect(r.save.hp).toBeGreaterThan(10)
})

test('the rune and cube pages show runes and act on them', async ($, on) => {
  const plain = { ...makeItem(2, 0, 7, seeded(2), 'weapon'), sockets: 2, gems: [], runes: [], req: undefined }
  const barb = { ...newCharacter('barbarian'), equipment: { ...newCharacter('barbarian').equipment, weapon: plain } }
  const withRunes = { ...barb, runes: barb.runes.map((_, i) => (i === rune('Tir') || i === rune('El') ? 1 : i === 0 ? 4 : 0)) }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: withRunes }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-gems' })
  // The weapon is the bench's first choice: Tir then El make Steel.
  await ui.press({ key: 'bench-weapon' })
  await ui.press({ key: `rune-${rune('Tir')}` })
  await ui.press({ key: `rune-${rune('El')}` })
  expect(await ui.find({ key: `rune-${rune('El')}` })).toBeUndefined()
  await ui.press({ key: 'all-words' })
  expect((await ui.find({ key: 'all-words' }))?.text).toContain('只看')
  await ui.press({ key: 'tab-cube' })
  expect(await ui.find({ key: 'tab-cube' })).toBeDefined()
  await ui.press({ key: 'tab-gear' })
  expect(await ui.find({ key: 'tab-gear' })).toBeDefined()
})

// ── Phase 4: quests and tooltips ──────────────────────────────────────────
test('clearing the first area finishes a quest and grants a skill point, once a difficulty', () => {
  const c = hero('barbarian', 3, { zone: 0, maxZone: 0, packs: PACKS_PER_AREA - 1 })
  const before = skillPointsLeft(c)
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1 }] }, seeded(9))
  expect(r.events.some(ev => ev.kind === 'quest' && ev.name === '邪惡洞穴')).toBe(true)
  expect(r.save.quests).toEqual(['0:den'])
  expect(r.save.questBonus.skill).toBe(1)
  expect(skillPointsLeft({ ...r.save, autoSkill: false }) + Object.values(r.save.skills).reduce((a, b) => a + b, 0)).toBe(
    before + Object.values(c.skills).reduce((a, b) => a + b, 0) + 1,
  )

  const again = tick({ ...r.save, zone: 0, packs: PACKS_PER_AREA - 1, walk: 0, foes: [{ ...newFoe(0), hp: 1 }] }, seeded(10))
  expect(again.events.some(ev => ev.kind === 'quest')).toBe(false)
})

test('the tooltip opens on an item and closes again; the quest log draws', async ($, on) => {
  const item = { ...makeItem(4, 2, 55, seeded(3), 'armor'), unid: undefined, req: undefined }
  const barb = { ...newCharacter('barbarian'), bag: [item] }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: barb }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-gear' })
  await ui.press({ key: `look-${item.id}` })
  expect(await ui.find({ key: 'close-tip' })).toBeDefined()
  await ui.press({ key: 'close-tip' })
  expect(await ui.find({ key: 'close-tip' })).toBeUndefined()
  await ui.press({ key: 'tab-quests' })
  expect(await ui.find({ key: 'tab-quests' })).toBeDefined()
})

// ── Greater rifts ──────────────────────────────────────────────────────────
import { RIFT_SECONDS, RIFT_UNLOCK_ZONE, startRift } from '../hooks/rift'

/** Ticks until an event comes (a hero may curse or shout before it strikes), keeping the monsters harmless. */
const untilEvent = (start: Character, kind: string) => {
  let c = start
  for (let i = 0; i < 10; i++) {
    const r = tick({ ...c, hp: heroStats(c).maxHp }, seeded(50 + i))
    if (r.events.some(ev => ev.kind === kind)) return r
    c = { ...r.save, foes: r.save.foes.map(f => ({ ...f, hp: Math.min(f.hp, 1), atk: 0 })) }
  }

  return { save: c, events: [] }
}

test('conquering hell opens the rifts and hands over three keystones', () => {
  const zone = RIFT_UNLOCK_ZONE - 1
  const c = hero('barbarian', 60, { zone, maxZone: zone, packs: PACKS_PER_AREA - 1, autoRift: false })
  const r = untilEvent({ ...c, foes: [{ ...newFoe(zone), hp: 1, atk: 0, isBoss: true, elite: 'boss' }] }, 'riftUnlock')
  expect(r.events.some(ev => ev.kind === 'riftUnlock')).toBe(true)
  // Three for opening the rifts, and the one every boss in hell drops.
  expect(r.save.keys).toBe(4)
})

test('a rift: kills fill the bar, the guardian comes, its fall ends the rift in time', () => {
  let c = hero('barbarian', 60, { maxZone: RIFT_UNLOCK_ZONE, keys: 1, autoRift: true })
  c = startRift(c, seeded(1))
  expect(c.keys).toBe(0)
  expect(c.rift?.tier).toBe(1)
  expect(c.rift?.timeLeft).toBe(RIFT_SECONDS)

  // Monsters that fall at a touch: fill the bar.
  for (let i = 0; i < 200 && !c.rift?.hasGuardian; i++) {
    c = tick({ ...c, walk: 0, hp: heroStats(c).maxHp, foes: c.foes.map(f => ({ ...f, hp: 1, atk: 0 })) }, seeded(i)).save
  }
  expect(c.rift?.hasGuardian).toBe(true)
  expect(c.foes.some(f => f.isBoss)).toBe(true)

  const r = untilEvent({ ...c, walk: 0, foes: c.foes.map(f => ({ ...f, hp: 1, atk: 0 })) }, 'riftClear')
  const clear = r.events.find(ev => ev.kind === 'riftClear')
  expect(clear?.kind === 'riftClear' && clear.isInTime).toBe(true)
  expect(r.save.rift).toBe(null)
  expect(r.save.riftBest).toBe(1)
  expect(r.save.riftTier).toBe(2)
  expect(r.events.filter(ev => ev.kind === 'loot').length).toBeGreaterThanOrEqual(2)
})

test('a late rift still ends, but the tier eases back', () => {
  let c = hero('barbarian', 60, { maxZone: RIFT_UNLOCK_ZONE, keys: 1, autoRift: true, riftTier: 5 })
  c = startRift(c, seeded(2))
  c = { ...c, rift: { ...c.rift!, timeLeft: -10, progress: 100, hasGuardian: true }, walk: 0, foes: [{ ...newFoe(0), hp: 1, atk: 0, isBoss: true, elite: 'boss' }] }
  const r = untilEvent(c, 'riftClear')
  const clear = r.events.find(ev => ev.kind === 'riftClear')
  expect(clear?.kind === 'riftClear' && clear.isInTime).toBe(false)
  expect(r.save.riftTier).toBe(4)
  expect(r.save.riftBest).toBe(0)
})

test('the rift page opens a rift', async ($, on) => {
  const barb = { ...newCharacter('barbarian'), maxZone: RIFT_UNLOCK_ZONE, keys: 2, autoRift: false }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: barb }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-rift' })
  await ui.press({ key: 'rift-start' })
  expect((await ui.find({ key: 'tab-rift' }))?.text).toContain('秘境中')
})

test('the cube combines every gem at once and shows what each recipe lacks', async ($, on) => {
  const base = newCharacter('sorceress')
  const sorc = { ...base, gems: { ...base.gems, ruby: [9, 0, 0, 0], topaz: [3, 3, 0, 0] } }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'sorceress', chars: { sorceress: sorc }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-cube' })
  expect(await ui.find({ key: 'combine-ruby-0' })).toBeDefined()
  await ui.press({ key: 'combine-all' })
  // 9 chipped rubies → 3 plain → 1 flawless; 3 chipped topaz + 3 plain → 2 plain → nothing more.
  expect(await ui.find({ key: 'combine-ruby-0' })).toBeUndefined()
  expect(await ui.find({ key: 'combine-ruby-1' })).toBeUndefined()
  expect(await ui.find({ key: 'combine-topaz-0' })).toBeUndefined()
})

// ── Talents ────────────────────────────────────────────────────────────────
import { canTakeTalent, MAX_LEVEL, takeTalent, talentCost, talentPointsLeft, talentTotals } from '../hooks/talents'

test('levels stop at the cap; past it, experience becomes talent points', () => {
  const c = hero('barbarian', MAX_LEVEL, { xp: 0, autoTalent: false, skills: {}, mainSkill: null, autoSkill: false })
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1, xp: talentCost(0) * 2 + 5 }] }, seeded(3))
  expect(r.save.level).toBe(MAX_LEVEL)
  expect(r.save.talentEarned).toBeGreaterThanOrEqual(1)
  expect(r.events.some(ev => ev.kind === 'talentPoint')).toBe(true)
})

test('talents go in order, and a branch ends in one keystone of two', () => {
  let c = hero('barbarian', MAX_LEVEL, { talentEarned: 20, autoTalent: false })
  expect(canTakeTalent(c, 'b.lethal')).toBe(false)
  c = takeTalent(c, 'b.edge')
  expect(canTakeTalent(c, 'b.lethal')).toBe(true)
  for (const id of ['b.lethal', 'b.carnage', 'b.fury', 'b.thirst']) c = takeTalent(c, id)
  expect(canTakeTalent(c, 'b.bloodrage')).toBe(true)
  c = takeTalent(c, 'b.bloodrage')
  expect(canTakeTalent(c, 'b.executioner')).toBe(false)
  expect(talentPointsLeft(c)).toBe(14)
  expect(talentTotals(c).lowLifeDmg).toBe(60)
})

test('undying keeps the hero up once a minute', () => {
  const c = hero('barbarian', MAX_LEVEL, { talents: { 'b.hide': 1, 'b.wall': 1, 'b.mountain': 1, 'b.ward': 1, 'b.parry': 1, 'b.undying': 1 }, talentEarned: 6, autoTalent: false, hp: 1, belt: { red: 0, blue: 0 } })
  const r = tick({ ...c, foes: [{ ...newFoe(0), hp: 1e12, maxHp: 1e12, atk: 1e12, element: 'phys' }] }, () => 0.9)
  expect(r.events.some(ev => ev.kind === 'cheatDeath')).toBe(true)
  expect(r.save.deadFor).toBe(0)
  expect(r.save.hp).toBeGreaterThan(0)
})

test('the bone lord raises a bigger army', () => {
  const c = hero('necromancer', MAX_LEVEL, { talents: { 'n.bond': 1, 'n.marrow': 1, 'n.bonelord': 1 }, talentEarned: 3, autoTalent: false, minions: [], walk: 3, mana: 1e9 })
  let s = c
  for (let i = 0; i < 40; i++) s = tick({ ...s, walk: 3, mana: 1e9 }, seeded(i)).save
  const plain = hero('necromancer', MAX_LEVEL, { talents: {}, autoTalent: false, minions: [], walk: 3, mana: 1e9 })
  let p = plain
  for (let i = 0; i < 40; i++) p = tick({ ...p, walk: 3, mana: 1e9 }, seeded(i)).save
  expect(s.minions.filter(m => m.kind === 'skeleton').length).toBe(p.minions.filter(m => m.kind === 'skeleton').length + 2)
})

test('the talent tab takes a point', async ($, on) => {
  // A save from before talents: no talent fields at all, the level past the cap.
  const { talentEarned: _earned, talents: _talents, ...barb } = { ...newCharacter('barbarian'), level: 116, autoTalent: false }
  mock.clock(on)
  mock.store(on, { v2: { version: 2, active: 'barbarian', chars: { barbarian: barb }, stash: [], lastSeen: 0 } })
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '.' } as never)

  const ui = await $.ui.mount({ plugin: 'idle-rpg', surface: 'terminal', component: 'Pane', requestId: 'idle-rpg', props: {} as never })
  await ui.press({ key: 'tab-skills' })
  await ui.press({ key: 'talent-tab-0' })
  await ui.press({ key: 'talent-b.edge' })
  expect((await ui.find({ key: 'talent-b.edge' }))?.text).toContain('＋')
  await ui.press({ key: 'talent-b.edge' })
  await ui.press({ key: 'talent-b.edge' })
  expect((await ui.find({ key: 'talent-b.edge' }))?.text).toContain('✔')
})

// ── More gear: ten slots, bases, uniques, class sets ──────────────────────
import { SLOTS } from '../hooks/loot'

test('every slot fills, two rings go on two fingers', () => {
  const rng = seeded(77)
  const kinds = new Set<string>()
  for (let i = 0; i < 400; i++) kinds.add(makeItem(20, 1, i, rng).slot)
  expect(kinds.size).toBe(9)

  let c = hero('sorceress', 30, { autoEquip: true })
  const ring = (id: number, spell: number) => ({ ...makeItem(5, 1, id, seeded(id), 'ring'), stats: { spell }, req: undefined })
  c = pickUp(c, ring(1, 10), heroPower).save
  c = pickUp(c, ring(2, 20), heroPower).save
  expect(c.equipment.ring?.id !== undefined && c.equipment.ring2?.id !== undefined).toBe(true)
  expect(SLOTS).toHaveLength(10)
})

test('uniques keep their names and powers; a worn power works like a talent', () => {
  const rng = seeded(5)
  let found = makeItem(20, 3, 1, rng, 'armor')
  for (let i = 0; i < 50 && found.name !== '不朽之甲'; i++) found = makeItem(20, 3, i, rng, 'armor')
  expect(found.name).toBe('不朽之甲')
  expect(found.power?.cheatDeath).toBe(20)
  const c = hero('barbarian', 30, { equipment: { ...newCharacter('barbarian').equipment, armor: { ...found, unid: undefined, req: undefined } } })
  expect(heroStats(c).talent.cheatDeath).toBe(20)
})

test('a class set of six earns its six-piece power', () => {
  const rng = seeded(9)
  const pieces = new Map<string, Item>()
  for (let i = 0; pieces.size < 6 && i < 2000; i++) {
    const it = makeItem(30, 4, i, rng)
    if (it.set === 'trang') pieces.set(it.slot, { ...it, unid: undefined, req: undefined })
  }
  expect(pieces.size).toBe(6)
  const base = newCharacter('necromancer')
  const c = hero('necromancer', 40, { equipment: { ...base.equipment, ...Object.fromEntries(pieces) } })
  const set = activeSets(c.equipment).find(s => s.id === 'trang')
  expect(set?.count).toBe(6)
  expect(heroStats(c).talent.minionExplode).toBe(60)
})

test('version check: only a later published version counts as an update', () => {
  expect(isNewer('1.1.0', '1.0.0')).toBe(true)
  expect(isNewer('1.10.0', '1.9.3')).toBe(true)
  expect(isNewer('2.0', '1.9.9')).toBe(true)
  expect(isNewer('1.1.0', '1.1.0')).toBe(false)
  expect(isNewer('1.0.9', '1.1.0')).toBe(false)
  expect(versionIn('{"name":"idle-rpg","version":"1.2.0"}')).toBe('1.2.0')
  expect(versionIn('404: Not Found')).toBe(undefined)
  expect(versionIn('{"version":"latest"}')).toBe(undefined)
})

test('coding: tools give capped focus that boosts damage, xp and gold, then fades', () => {
  const c = newCharacter('barbarian')
  let f = c
  for (let i = 0; i < 20; i++) f = gainFocus(f)
  expect(f.focus).toBe(FOCUS_MAX)
  const plain = heroStats(c)
  const sharp = heroStats(f)
  expect(sharp.physMult).toBeGreaterThan(plain.physMult)
  expect(sharp.xpPct).toBe(FOCUS_PCT)
  expect(sharp.goldFind).toBe(plain.goldFind + FOCUS_PCT)
  expect(tick({ ...f, walk: 3 }, () => 0.5).save.focus).toBe(FOCUS_MAX - 1)
})

test('coding: passing tests bless, a commit opens a chest at most every ten minutes', () => {
  const c = { ...newCharacter('sorceress'), zone: 30, maxZone: 30, hp: 1, gold: 0 }
  const blessed = bless(c)
  expect(blessed.blessing).toBe(BLESSING_SECONDS)
  expect(blessed.hp).toBe(heroStats(blessed).maxHp)
  expect(heroStats(blessed).magicFind).toBe(heroStats(c).magicFind + BLESSING_MF)

  const opened = openChest(c, () => 0.5)
  expect(opened.save.gold).toBeGreaterThan(0)
  expect(opened.save.chestCooldown).toBe(CHEST_COOLDOWN)
  const ev = opened.events[0]
  expect(ev?.kind === 'chest' && ev.event.kind === 'loot' && ev.event.item.rarity >= 2).toBe(true)
  expect(openChest(opened.save, () => 0.5).events.length).toBe(0)

  expect(isTestCommand('npm test')).toBe(true)
  expect(isTestCommand('npx vitest run')).toBe(true)
  expect(isTestCommand('claude plugin test .')).toBe(true)
  expect(isTestCommand('cat latest.txt')).toBe(false)
  expect(isCommitCommand('git add -A && git commit -m "x"')).toBe(true)
  expect(isCommitCommand('git status')).toBe(false)
})

test('a death costs at most the death cap', () => {
  const c = { ...newCharacter('necromancer'), zone: 50, maxZone: 50, hp: 1, gold: 1e12 }
  let r = { save: c, events: [] as CombatEvent[] }
  for (let i = 0; i < 40 && r.save.deadFor === 0; i++) {
    r = tick({ ...r.save, hp: 1, walk: 0, foes: r.save.foes.length ? r.save.foes : newPack(50, 0, () => 0.5) }, () => 0.5)
  }
  const death = r.events.find(ev => ev.kind === 'death')
  expect(death?.kind === 'death' && death.goldLost === deathGoldCap(50)).toBe(true)
  expect(deathGoldCap(50)).toBeLessThan(1e11)
})
