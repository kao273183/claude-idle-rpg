import type { Character, Rarity } from '../types'
import { heroPower, heroStats } from './character'
export { BLESSING_MF, FOCUS_PCT } from './character'
import type { CombatEvent } from './combat'
import { makeItem, pickUp } from './loot'
import { zonePower } from './monsters'

type Rng = () => number

/** Each tool Claude runs adds this much focus, up to the cap. */
export const FOCUS_PER_CALL = 30
export const FOCUS_MAX = 300
export const BLESSING_SECONDS = 600
/** A chest per commit, but no more often than this. */
export const CHEST_COOLDOWN = 600
/** A chest's gold: as much as this many plain monsters of the deepest area would drop. */
const CHEST_GOLD_KILLS = 40

export type CodingEvent =
  | { kind: 'chest'; gold: number; event: CombatEvent }
  | { kind: 'blessing' }

/** Claude ran a tool: the hero fights harder for a while. */
export const gainFocus = (c: Character): Character => ({ ...c, focus: Math.min(FOCUS_MAX, c.focus + FOCUS_PER_CALL) })

/** The tests passed: life and mana restored, and better finds for ten minutes. */
export const bless = (c: Character): Character => {
  const stats = heroStats(c)

  return c.deadFor > 0
    ? { ...c, blessing: BLESSING_SECONDS }
    : { ...c, blessing: BLESSING_SECONDS, hp: stats.maxHp, mana: stats.maxMana }
}

const chestRarity = (rng: Rng): Rarity => {
  const r = rng()

  return r < 0.08 ? 3 : r < 0.25 ? 4 : 2
}

/** A commit landed: a chest with gold and an item of rare or better, unless one opened lately. */
export const openChest = (c: Character, rng: Rng): { save: Character; events: CodingEvent[] } => {
  if (c.chestCooldown > 0) return { save: c, events: [] }
  const gold = Math.round(5 * 0.5 * zonePower(c.maxZone).reward * CHEST_GOLD_KILLS)
  const item = makeItem(c.maxZone, chestRarity(rng), c.nextItemId, rng)
  const picked = pickUp({ ...c, nextItemId: c.nextItemId + 1, gold: c.gold + gold }, item, heroPower)

  return {
    save: { ...picked.save, chestCooldown: CHEST_COOLDOWN },
    events: [{ kind: 'chest', gold, event: { kind: 'loot', item, action: picked.action } }],
  }
}

/** Whether a shell command was a test run. */
export const isTestCommand = (command: string) =>
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(jest|vitest|pytest|mocha|phpunit|rspec)\b|\b(cargo|go|dotnet|mix|deno)\s+test\b|\bplugin\s+test\b|\bgradlew?\s+test\b|\bmvn\s+test\b/.test(
    command,
  )

/** Whether a shell command made a commit. */
export const isCommitCommand = (command: string) => /\bgit\b[^|;&]*\bcommit\b/.test(command)
