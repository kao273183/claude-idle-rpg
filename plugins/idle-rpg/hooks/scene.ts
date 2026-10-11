import type { Character, ClassId, Rarity } from '../types'

import { CORPSE, HAND, heroSprite, minionSprite, MONSTERS, scaleSprite } from './art'
import type { Sprite } from './art'
import type { CombatEvent } from './combat'
import { RARITIES } from './loot'
import { placeOf } from './monsters'
import { ELEMENT_COLORS, SKILLS, skillOf } from './skilltree'
import { KIND, paintBackdrop, RIFT_LOOK } from './backdrop'
import type { Light } from './backdrop'
import { channel, hash, mix, rgb, scale } from './pixels'

export { hash, mix, scale }

/** Terminal rows of the scene; each cell is ▀, two pixels tall. */
export const SCENE_ROWS = 15
const HEIGHT = SCENE_ROWS * 2
const FLOOR_Y = 23
const FEET = 27 // the row a standing sprite's feet rest on
const SPEED = 16 // pixels walked per second
/** The text row damage numbers start from, just above the monsters' heads. */
const NUM_ROW = 2
/** Heroes stand this tall. */
const HERO_H = 24

/** Figures drawn smaller in a narrow pane, so a pack still fits. */
export const unitScale = (columns: number) => (columns >= 90 ? 1 : columns >= 70 ? 0.85 : 0.72)

export const heroX = (_columns: number) => 2

/**
 * Where the i-th of n monsters stands: spread evenly from a little past the
 * middle (further when servants stand between) to the right edge.
 */
export const foeX = (columns: number, i: number, n = 1, hasServants = false) => {
  const first = Math.round(columns * (hasServants ? 0.46 : 0.36))
  const room = Math.max(0, columns - first - Math.round(17 * unitScale(columns)))
  if (n <= 1) return first + Math.round(room * 0.35)
  if (n === 2) return first + Math.round(i * room * 0.7)
  // Three or more: a front rank spread across the room, a back rank in its gaps.
  const front = Math.ceil(n / 2)
  const step = room / Math.max(1, front - 1)
  const place = Math.floor(i / 2) + (i % 2 === 1 ? 0.5 : 0)

  return Math.round(first + place * step)
}

/** With three or more, every other monster stands in the back rank: higher on the screen, smaller, darker. */
export const foeLift = (i: number, n: number) => (n >= 3 && i % 2 === 1 ? 6 : 0)

/** Where the last kill fell, in world pixels, so it scrolls away as the hero walks on. */
export type Corpse = { worldX: number; loot?: Rarity; gem?: number }

export type SceneInput = {
  char: Character
  /** What the last tick did, animated over the second that follows it. */
  events: readonly CombatEvent[]
  /** 0..1: how far into the second since that tick. */
  t: number
  /** Animation frame counter, for flicker. */
  frame: number
  columns: number
  corpse?: Corpse
}

export const scrollOf = (c: Character, t: number) => c.distance * SPEED + (c.walk > 0 && c.deadFor === 0 ? t * SPEED : 0)

/** kind: 0 ground, 1 sprite, 2 glowing (ignores the dark). */
type Layer = { width: number; color: number[]; kind: Uint8Array }

const paint = (layer: Layer, sprite: Sprite, x: number, y: number, mask?: Uint8Array, tint?: (c: number) => number) => {
  const { width } = layer
  sprite.rows.forEach((line, row) => {
    ;[...line].forEach((ch, col) => {
      const color = sprite.palette[ch]
      const px = Math.round(x) + col
      const py = Math.round(y) + row
      if (color === undefined || px < 0 || px >= width || py < 0 || py >= HEIGHT) return
      const i = py * width + px
      layer.color[i] = tint ? tint(color) : color
      layer.kind[i] = sprite.glow?.includes(ch) ? 2 : 1
      if (mask) mask[i] = 1
    })
  })
}

const outline = (out: number[], width: number, mask: Uint8Array, color: number, k: number) => {
  for (let i = 0; i < out.length; i++) {
    if (mask[i]) continue
    if (mask[i - 1] || mask[i + 1] || mask[i - width] || mask[i + width]) out[i] = mix(out[i]!, color, k)
  }
}

/** Text written into the cells over the pixels: ASCII only, one column a character. */
export const writeText = (words: Uint32Array, out: number[], width: number, label: string, x: number, row: number, color: number) => {
  ;[...label].forEach((ch, k) => {
    const cx = Math.round(x) + k
    if (cx < 0 || cx >= width || row < 0 || row >= SCENE_ROWS) return
    const w = (row * width + cx) * 3
    words[w] = ch.codePointAt(0) ?? 0x20
    words[w + 1] = color
    words[w + 2] = out[(row * 2 + 1) * width + cx]!
  })
}

/** The dungeon scene as Raster cells. */
export const drawScene = (input: SceneInput): string => {
  const { char: c, events, t, frame, columns: width } = input
  const lookIndex = c.rift ? RIFT_LOOK : placeOf(c.zone).actDef.look
  const scroll = scrollOf(c, t)
  const layer: Layer = { width, color: new Array<number>(width * HEIGHT).fill(0), kind: new Uint8Array(width * HEIGHT) }
  const isDead = c.deadFor > 0
  const unit = unitScale(width)
  const servants = c.minions.length > 0
  const isWalking = c.walk > 0 && !isDead

  // The world behind: each act its own, the rift a void.
  const backdrop = paintBackdrop(lookIndex, { width, height: HEIGHT, color: layer.color, kind: layer.kind }, FLOOR_Y, scroll, frame)
  const lights: Light[] = [...backdrop.lights]

  /** A soft shadow on the ground under whoever stands at x. */
  const shadow = (cx: number, half: number, lift = 0) => {
    for (const [dy, k] of [[0, 0.45], [1, 0.3]] as const) {
      const y = FEET + dy - lift
      if (y >= HEIGHT) continue
      for (let dx = -half; dx <= half; dx++) {
        const x = Math.round(cx + dx)
        if (x < 0 || x >= width) continue
        const i = y * width + x
        if (layer.kind[i] !== KIND.lit) continue
        const edge = Math.abs(dx) / (half + 1)
        layer.color[i] = mix(layer.color[i]!, backdrop.shade, k * (1 - edge * edge))
      }
    }
  }

  // The last kill's corpse, and what it dropped.
  const corpse = input.corpse
  const corpseX = corpse ? corpse.worldX - scroll : -999
  if (corpse && corpseX > -16 && corpseX < width) {
    shadow(corpseX + 9, 9)
    paint(layer, CORPSE, corpseX, FEET - CORPSE.rows.length + 1)
    if (corpse.loot !== undefined) {
      const color = RARITIES[corpse.loot].pixel
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, -1]] as const) {
        const x = Math.round(corpseX) + 11 + dx
        if (x >= 0 && x < width) {
          layer.color[(FEET - 1 + dy) * width + x] = (frame + dx) % 6 === 0 ? 0xffffff : color
          layer.kind[(FEET - 1 + dy) * width + x] = 2
        }
      }
    }
    if (corpse.gem !== undefined) {
      const x = Math.round(corpseX) + 6
      if (x >= 0 && x < width) {
        layer.color[(FEET - 1) * width + x] = frame % 8 < 2 ? 0xffffff : corpse.gem
        layer.kind[(FEET - 1) * width + x] = 2
      }
    }
  }

  // What this second holds, and when.
  const castEv = events.find(ev => ev.kind === 'cast')
  const skill = castEv?.kind === 'cast' ? skillOf(castEv.skill) : undefined
  const fx = skill?.fx.kind
  const hits = events.filter(ev => ev.kind === 'hit')
  const hurts = events.filter(ev => ev.kind === 'hurt')
  const isAttack = skill?.kind === 'attack'
  const isMelee = isAttack && (fx === 'melee' || fx === 'spin' || fx === 'leap' || (fx === 'burst' && skill?.phys !== undefined))
  const strikeT = isMelee ? 0.3 : 0.25
  const isCasting = skill !== undefined && t < strikeT + 0.1
  const foeStrikes = new Set(hurts.map(ev => (ev.kind === 'hurt' ? ev.foe : -1)))
  const isFoeStriking = t >= 0.45 && t < 0.75

  // The hero: walking, swinging, casting, or lying dead.
  const hx = heroX(width)
  const heroMask = new Uint8Array(width * HEIGHT)
  const step = Math.floor(t * 4) % 2
  let heroDx = isAttack && isMelee && t < strikeT ? 3 : 0
  let heroDy = 0
  if (fx === 'leap' && t < 0.4) {
    heroDx = Math.round(Math.sin((t / 0.4) * Math.PI) * 10)
    heroDy = -Math.round(Math.sin((t / 0.4) * Math.PI) * 6)
  }
  shadow(hx + 9 * unit + heroDx, heroDy < -2 ? 5 : Math.round(8 * unit))
  if (isDead) {
    paint(layer, { ...CORPSE, palette: { ...CORPSE.palette, w: 0x8a8a94 } }, hx, FEET - CORPSE.rows.length + 1)
  } else {
    const sprite = scaleSprite(heroSprite(c.classId, isCasting ? 'cast' : 'idle', isWalking ? (step === 0 ? 'stride' : 'pass') : 'idle'), unit)
    paint(layer, sprite, hx + heroDx, FEET - sprite.rows.length + 1 + heroDy + (isWalking ? step : 0), heroMask)
  }
  lights.push({ x: hx + 9, y: FEET - 12, power: 0.85, radius: 28, color: 0xffd8a0 })
  const hand = { x: hx + HAND[c.classId].x * unit + heroDx, y: FEET - Math.round(HERO_H * unit) + 1 + HAND[c.classId].y * unit }

  // The necromancer's servants, between the hero and the monsters.
  const minionMasks: { id: number; mask: Uint8Array; x: number }[] = []
  const struck = new Set(events.filter(ev => ev.kind === 'minionHit').map(ev => (ev.kind === 'minionHit' ? ev.minion : -1)))
  // The army fills the ground between the hero and the pack, every other one a step back.
  const armyFrom = hx + Math.round(12 * unit)
  const armyTo = foeX(width, 0, c.foes.length, true) - Math.round(14 * unit)
  // A big army is shown by a few of its number, one of each kind first, its size written over it.
  const isGolemKind = (kind: string) => kind === 'golem' || kind === 'bloodgolem'
  const ranks = c.minions.filter(m => !isGolemKind(m.kind))
  const roomForArmy = Math.max(0, armyTo - armyFrom)
  const maxShown = Math.max(2, Math.min(6, Math.floor(roomForArmy / (6 * unit)) + 1))
  const kinds = [...new Set(ranks.map(m => m.kind))]
  const onShow: typeof ranks = []
  for (let round = 0; onShow.length < Math.min(maxShown, ranks.length); round++) {
    for (const kind of kinds) {
      const next = ranks.filter(m => m.kind === kind)[round]
      if (next && onShow.length < maxShown) onShow.push(next)
    }
  }
  const soldiers = onShow.length
  const army = [...onShow, ...c.minions.filter(m => isGolemKind(m.kind))]
  const armyLabel = c.minions.length > army.length ? { text: `x${c.minions.length}`, x: armyFrom + Math.round(roomForArmy / 2) - 1 } : undefined
  let rank = 0
  army.forEach((m, k) => {
    const isGolem = isGolemKind(m.kind)
    const sprite = scaleSprite(minionSprite(m.kind, c.zone), unit * (isGolem ? 1 : m.kind === 'revive' ? 0.75 : 0.9))
    const slot = isGolem ? 0 : rank++
    const back = !isGolem && slot % 2 === 1
    const lane = isGolem
      ? armyTo
      : Math.round(armyFrom + (soldiers > 1 ? (slot * Math.max(0, armyTo - armyFrom)) / (soldiers - 1) : 0))
    const lunge = struck.has(m.id) && t < 0.3 ? 2 : 0
    const bob = (frame + k) % 8 < 4 ? 0 : 1
    const top = FEET - sprite.rows.length + 1 - (back ? 2 : 0)
    const mask = new Uint8Array(width * HEIGHT)
    shadow(lane + sprite.rows[0]!.length / 2, isGolem ? 7 : 5, back ? 2 : 0)
    paint(layer, sprite, lane + lunge + (isWalking ? -step : 0), top + (isWalking ? bob : 0), mask, back ? col => scale(col, 0.8) : undefined)
    minionMasks.push({ id: m.id, mask, x: lane })
  })

  // The monsters: approaching while the hero walks, standing ground otherwise.
  const foeMasks: Uint8Array[] = []
  const foeAt: { x: number; y: number }[] = []
  // Back to front, so the nearer monsters stand over the farther.
  // The back row first, then the front; right to left within each.
  const n = c.foes.length
  const order = c.foes.map((_, i) => i).sort((a, b) => foeLift(b, n) - foeLift(a, n) || b - a)
  for (const i of order) {
    const foe = c.foes[i]!
    const mask = new Uint8Array(width * HEIGHT)
    foeMasks[i] = mask
    const lift = foeLift(i, n)
    const x = foeX(width, i, n, servants) + (isWalking ? (c.walk - t) * SPEED : 0) - (foeStrikes.has(i) && isFoeStriking ? 3 : 0)
    const sprite = scaleSprite(MONSTERS[foe.kind % MONSTERS.length]!, (foe.scale ?? 1) * unit * (lift > 0 ? 0.85 : 1))
    foeAt[i] = { x: x + ((foe.scale ?? 1) - 1) * 8, y: FEET - lift - Math.round(sprite.rows.length / 2) }
    if (foe.hp <= 0) continue
    const stunned = (foe.status.stun ?? 0) > 0
    const bob = stunned ? 0 : Math.floor((frame + i * 3) / 4) % 2
    const chilled = (foe.status.chill ?? 0) > 0
    const tint = foe.tint
    shadow(x + sprite.rows[0]!.length / 2, Math.round(6 * (foe.scale ?? 1) * unit), lift)
    paint(layer, sprite, x, FEET - lift - sprite.rows.length + 1 + bob, mask, col => {
      let out = tint !== undefined && col !== 0x0a0808 ? mix(col, tint, 0.55) : col
      if (chilled) out = mix(out, 0x80c8ff, 0.45)
      if (lift > 0) out = scale(out, 0.72)

      return out
    })
  }

  // Give every figure some volume: a lit top edge, a darker underside.
  const shape = (mask: Uint8Array) => {
    for (let i = width; i < mask.length - width; i++) {
      if (!mask[i] || layer.kind[i] !== KIND.sprite) continue
      if (!mask[i - width]) layer.color[i] = mix(layer.color[i]!, 0xffffff, 0.22)
      else if (!mask[i + width]) layer.color[i] = scale(layer.color[i]!, 0.7)
      else if (!mask[i - 1]) layer.color[i] = scale(layer.color[i]!, 0.85)
    }
  }
  shape(heroMask)
  for (const m of minionMasks) shape(m.mask)
  for (const m of foeMasks) if (m) shape(m)

  // Spells light the world around them.
  const castSkill = events.find(ev => ev.kind === 'cast')
  const lit = castSkill?.kind === 'cast' ? skillOf(castSkill.skill) : undefined
  const glow = lit?.fx.color ?? 0xffffff
  const struckFoe = events.find(ev => ev.kind === 'hit')
  const aim = foeAt[struckFoe?.kind === 'hit' ? struckFoe.foe : 0] ?? { x: foeX(width, 0, c.foes.length, servants), y: FEET - 10 }
  if (lit && lit.kind === 'attack' && !isDead) {
    const kind = lit.fx.kind
    if ((kind === 'projectile' || kind === 'orb') && t < (kind === 'orb' ? 0.55 : 0.35)) {
      const p = t / (kind === 'orb' ? 0.55 : 0.35)
      lights.push({ x: hand.x + (aim.x + 6 - hand.x) * p, y: hand.y + (aim.y - hand.y) * p, power: 0.9, radius: 12, color: glow })
    } else if (t < 0.5 && kind !== 'melee') {
      lights.push({ x: kind === 'nova' || kind === 'shout' || kind === 'spin' ? hx + 9 : aim.x + 6, y: FEET - 10, power: 1.1 * (1 - t * 2), radius: 22, color: glow })
    }
  }
  for (const ev of events) if (ev.kind === 'levelUp' && t < 0.9) lights.push({ x: hx + 9, y: FEET - 12, power: 1 - t, radius: 24, color: 0xffd040 })

  // Light everything: ambient dark, every light in its own colour, a vignette.
  const out = new Array<number>(width * HEIGHT)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const kind = layer.kind[i]!
      const edge = Math.abs(x - width / 2) / (width / 2)
      const vignette = 1 - 0.5 * edge * edge
      if (kind === KIND.glow) {
        out[i] = layer.color[i]!
        continue
      }
      if (kind === KIND.far) {
        out[i] = scale(layer.color[i]!, vignette)
        continue
      }
      let light: number = backdrop.ambient
      let r = 0
      let g = 0
      let b = 0
      let sum = 0
      for (const l of lights) {
        const d = Math.hypot(x - l.x, (y - l.y) * 1.2)
        if (d >= l.radius) continue
        const add = l.power * Math.pow(1 - d / l.radius, 1.6)
        light += add
        sum += add
        r += add * channel(l.color, 16)
        g += add * channel(l.color, 8)
        b += add * channel(l.color, 0)
      }
      light *= vignette
      if (kind === KIND.sprite) light = Math.max(light, 0.5)
      const base = scale(layer.color[i]!, Math.min(1.35, light))
      out[i] = sum > 0 ? mix(base, rgb(r / sum, g / sum, b / sum), Math.min(0.3, sum * 0.14)) : base
    }
  }

  // ── Over the light: effects ─────────────────────────────────────────────
  const plot = (x: number, y: number, color: number, k: number) => {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || px >= width || py < 0 || py >= HEIGHT || k <= 0) return
    const i = py * width + px
    out[i] = mix(out[i]!, color, Math.min(1, k))
  }
  const blob = (x: number, y: number, r: number, color: number, k: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 0.5) plot(x + dx, y + dy, color, k)
  }
  const ring = (x: number, y: number, r: number, color: number, k: number) => {
    for (let a = 0; a < 360; a += 3) {
      const rad = (a * Math.PI) / 180
      plot(x + Math.cos(rad) * r, y + Math.sin(rad) * r * 0.55, color, k)
    }
  }
  const heroCx = hx + 9
  const heroCy = FEET - 11
  const color = skill?.fx.color ?? 0xffffff
  const targets = [...new Set(hits.map(ev => (ev.kind === 'hit' ? ev.foe : 0)))]
  const firstTarget = foeAt[targets[0] ?? 0] ?? { x: foeX(width, 0, c.foes.length, servants), y: FEET - 10 }

  // Buffs that stay on the hero.
  if (!isDead) {
    if ((c.buffs.battleOrders ?? 0) > 0) outline(out, width, heroMask, 0xffd040, 0.3 + 0.15 * Math.sin(frame / 2))
    if ((c.buffs.frozenArmor ?? 0) > 0) outline(out, width, heroMask, 0x80c8ff, 0.45)
    if (c.shield > 0) {
      if (c.classId === 'necromancer') {
        for (let k = 0; k < 6; k++) {
          const rad = frame * 0.3 + (k * Math.PI) / 3
          plot(heroCx + Math.cos(rad) * 11, heroCy + Math.sin(rad) * 7, 0xe8e0c8, 1)
          plot(heroCx + Math.cos(rad) * 11 + 1, heroCy + Math.sin(rad) * 7, 0xe8e0c8, 0.6)
        }
      } else {
        ring(heroCx, heroCy, 11, 0x8080ff, 0.35 + 0.15 * Math.sin(frame / 3))
      }
    }
  }

  // Monster conditions: burning, poisoned, stunned, cursed.
  c.foes.forEach((foe, i) => {
    if (foe.hp <= 0) return
    const at = foeAt[i]!
    if (foe.status.burn) for (let k = 0; k < 4; k++) plot(at.x + 3 + hash(k, frame) * 10, FEET - 2 - hash(frame, k) * 8, 0xff7020, 0.9)
    if (foe.status.poison) for (let k = 0; k < 3; k++) plot(at.x + 3 + hash(k + 9, frame >> 1) * 10, FEET - 4 - ((frame + k * 3) % 8), 0x60e040, 0.8)
    if ((foe.status.stun ?? 0) > 0) for (let k = 0; k < 3; k++) {
      const rad = frame * 0.4 + (k * Math.PI * 2) / 3
      plot(at.x + 8 + Math.cos(rad) * 5, at.y - 13 + Math.sin(rad) * 1.5, 0xfff070, 1)
    }
    const curse = foe.status.curse
    if (curse && curse.left > 0) {
      const cc = SKILLS[curse.id]?.fx.color ?? 0xc02020
      const cx = at.x + 7
      for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [0, -1], [0, 0], [-1, 1], [1, 1]] as const) plot(cx + dx, at.y - 15 + dy, cc, 0.95)
    }
  })

  if (skill && !isDead) {
    switch (fx) {
      case 'melee':
        if (t < 0.3) {
          for (let a = -70; a <= 70; a += 6) {
            const rad = (a * Math.PI) / 180
            plot(hx + 20 + Math.cos(rad) * 8, heroCy + Math.sin(rad) * 8, color, 0.85 * (1 - t / 0.3))
          }
        }
        break
      case 'spin':
        if (t < 0.45) {
          const sweep = (t / 0.45) * 540
          for (let a = sweep - 220; a <= sweep; a += 3) {
            const rad = (a * Math.PI) / 180
            const k = 1 - (sweep - a) / 220
            plot(heroCx + 3 + Math.cos(rad) * 11, heroCy + Math.sin(rad) * 6, color, k)
            plot(heroCx + 3 + Math.cos(rad) * 12, heroCy + Math.sin(rad) * 6.6, 0xffe0a0, k * 0.6)
          }
        }
        break
      case 'leap':
        if (t >= 0.35 && t < 0.6) for (let k = 0; k < 10; k++) plot(hx + 10 + heroDx + (k - 5) * 2, FEET - (t - 0.35) * 16 * hash(k, 3), 0xb0a080, 0.8)
        break
      case 'projectile':
      case 'orb': {
        const flight = fx === 'orb' ? 0.55 : 0.35
        if (t < flight) {
          const p = t / flight
          const x = hand.x + (firstTarget.x + 6 - hand.x) * p
          const y = hand.y + (firstTarget.y - hand.y) * p
          const size = fx === 'orb' ? 2 : skill.aoe ? 2 : 1
          for (let k = 1; k < 6; k++) plot(x - k * 2, y, color, 0.5 - k * 0.08)
          blob(x, y, size, color, 1)
          plot(x, y, 0xffffff, 0.7)
          if (fx === 'orb') for (let k = 0; k < 6; k++) {
            const rad = frame * 0.8 + (k * Math.PI) / 3
            plot(x + Math.cos(rad) * 5, y + Math.sin(rad) * 3, color, 0.8)
          }
        } else if (t < flight + 0.2) {
          const k = 1 - (t - flight) / 0.2
          for (const ti of targets) {
            const at = foeAt[ti]
            if (at) blob(at.x + 6, at.y, skill.aoe ? 4 : 2, color, 0.8 * k)
          }
        }
        break
      }
      case 'beam':
        if (t < 0.25 && frame % 2 === 0) {
          let from = { x: hand.x, y: hand.y }
          for (const ti of targets) {
            const to = foeAt[ti]
            if (!to) continue
            const steps = Math.max(1, Math.round(Math.abs(to.x + 6 - from.x)))
            let y = from.y
            for (let s = 0; s <= steps; s++) {
              const x = from.x + ((to.x + 6 - from.x) * s) / steps
              y += (hash(s, frame) - 0.5) * 2.5 + (to.y - from.y) / steps
              plot(x, y, color, 1)
              plot(x, y - 1, 0xffffff, 0.4)
            }
            from = { x: to.x + 6, y: to.y }
          }
        }
        break
      case 'nova':
        if (t < 0.5) ring(heroCx, heroCy, 4 + (t / 0.5) * width * 0.7, color, 1 - t * 1.6)
        break
      case 'shout':
        if (t < 0.4) for (const r of [0, 6, 12]) ring(heroCx, heroCy - 4, 4 + r + (t / 0.4) * 20, color, 0.8 - t * 2)
        break
      case 'rain':
        if (t < 0.6) {
          for (const ti of targets.length > 0 ? targets : [0]) {
            const at = foeAt[ti]
            if (!at) continue
            if (skill.element === 'fire') {
              const p = Math.min(1, t / 0.35)
              const x = at.x + 6 - (1 - p) * 10
              const y = p * (FEET - 6)
              blob(x, y, 3, color, 1)
              blob(x, y, 1, 0xffffa0, 1)
              for (let k = 1; k < 8; k++) plot(x - k, y - k * 1.5, 0xff8030, 0.6 - k * 0.07)
              if (t >= 0.35) blob(at.x + 6, FEET - 4, 2 + Math.round((t - 0.35) * 24), 0xff6010, 0.8 - (t - 0.35) * 3)
            } else {
              for (let k = 0; k < 14; k++) {
                const x = at.x - 4 + hash(k, 1) * 22
                const y = ((t * 50 + hash(k, 2) * 24) % 22) - 2
                plot(x, y, color, 0.9)
                plot(x - 1, y - 1, 0xffffff, 0.5)
              }
            }
          }
        }
        break
      case 'wall':
        if (t < 0.9) for (const ti of targets) {
          const at = foeAt[ti]
          if (!at) continue
          for (let k = 0; k < 12; k++) {
            const x = at.x + k * 1.2
            const h = 4 + hash(k, frame) * 7 * Math.min(1, t * 4)
            for (let y = 0; y < h; y++) plot(x, FEET - y, y > h - 2 ? 0xffe060 : color, 0.8)
          }
        }
        break
      case 'burst':
        if (t < 0.35) for (const ti of targets) {
          const at = foeAt[ti]
          if (at) {
            blob(at.x + 6, at.y, 2 + Math.round(t * 20), color, 0.9 - t * 2.2)
            blob(at.x + 6, at.y, 1 + Math.round(t * 8), 0xffffff, 0.8 - t * 2)
          }
        }
        break
      case 'curse':
        if (t < 0.4) {
          const at = foeAt[0]
          if (at) for (let k = 0; k < 10; k++) {
            const rad = (k / 10) * Math.PI * 2 + t * 10
            plot(at.x + 7 + Math.cos(rad) * (8 - t * 12), at.y + Math.sin(rad) * 4, color, 0.9)
          }
        }
        break
      case 'aura':
        if (t < 0.5) for (let k = 0; k < 10; k++) plot(heroCx - 7 + hash(k, 5) * 14, heroCy + 6 - t * 30 - hash(k, 6) * 6, color, 0.9 - t * 1.6)
        break
      case 'summon': {
        const newest = minionMasks[minionMasks.length - 1]
        if (newest && t < 0.5) {
          outline(out, width, newest.mask, color, 0.9 - t * 1.6)
          for (let k = 0; k < 6; k++) plot(newest.x + hash(k, 8) * 12, FEET - t * 30 - hash(k, 9) * 6, 0x80ff80, 0.9 - t * 1.6)
        }
        break
      }
    }
  }

  // Sparks where the blows land.
  for (const ev of hits) {
    if (ev.kind !== 'hit' || ev.immune || t > 0.22) continue
    const at = foeAt[ev.foe]
    if (!at) continue
    const r = 1 + Math.round(t * 12)
    const spark = ev.isCrit ? 0xffe060 : 0xffffff
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1.4], [1.4, 0], [0, -1.4], [-1.4, 0]] as const) {
      plot(at.x + 6 + dx * r, at.y + dy * r * 0.7, spark, 1 - t * 4)
    }
  }

  // Struck monsters flash; struck heroes flash red.
  if (isAttack && t < strikeT + 0.1) {
    for (const ti of targets) {
      const mask = foeMasks[ti]
      if (mask && (c.foes[ti]?.hp ?? 0) > 0) for (let i = 0; i < out.length; i++) if (mask[i]) out[i] = mix(out[i]!, 0xffffff, 0.55)
    }
  }
  c.foes.forEach((f, i) => {
    const mask = foeMasks[i]
    if (!mask || f.hp <= 0) return
    if (f.elite === 'boss') outline(out, width, mask, 0xff1010, 0.35 + 0.25 * Math.sin(frame / 2))
    else if (f.elite === 'unique') outline(out, width, mask, 0xd4a84b, 0.55)
    else if (f.elite === 'champion') outline(out, width, mask, 0x6080ff, 0.5)
    const at = foeAt[i]!
    const spark = (color: number) => {
      for (let k = 0; k < 3; k++) plot(at.x + 2 + hash(k + i * 7, frame) * 12, at.y - 6 + hash(frame, k + i) * 14, color, 0.9)
    }
    if (f.affixes.includes('fire')) spark(0xff7020)
    if (f.affixes.includes('cold')) spark(0x80d0ff)
    if (f.affixes.includes('light') && frame % 3 === 0) spark(0xfff070)
  })
  for (const ev of events) {
    if (ev.kind === 'explode' && t < 0.4) {
      const at = foeAt[ev.foe]
      if (at) blob(at.x + 6, at.y, 2 + Math.round(t * 22), 0xff6010, 0.85 - t * 2)
    }
  }
  const heroHurt = hurts.some(ev => ev.kind === 'hurt' && ev.minion === undefined && ev.dmg > 0)
  if (isFoeStriking && heroHurt) for (let i = 0; i < out.length; i++) if (heroMask[i]) out[i] = mix(out[i]!, 0xff2020, 0.45)
  for (const ev of events) {
    if (ev.kind === 'potion' && t < 0.4) ring(heroCx, heroCy, 6 + t * 10, ev.color === 'red' ? 0xff3030 : 0x3060ff, 0.8 - t * 2)
    if (ev.kind === 'levelUp' && t < 0.9) for (let y = 0; y < FEET; y++) for (const dx of [-1, 0, 1]) plot(heroCx + dx, y, 0xffd040, (dx === 0 ? 0.7 : 0.3) * (1 - t))
  }
  if (isDead) for (let i = 0; i < out.length; i++) out[i] = mix(out[i]!, 0x300000, 0.45)

  // A rare or better drop casts a beam of its colour.
  if (corpse?.loot !== undefined && RARITIES[corpse.loot].rank >= 2) {
    const x = Math.round(corpseX) + 12
    const beam = RARITIES[corpse.loot].pixel
    const pulse = 0.75 + 0.25 * Math.sin(frame / 3)
    for (let y = 0; y < FEET - 2; y++) for (const [dx, k] of [[0, 0.6], [-1, 0.25], [1, 0.25]] as const) plot(x + dx, y, beam, k * pulse * (y / (FEET - 2)))
  }

  // The weather over it all.
  backdrop.overlay(plot)

  // A crit, a burst or a boss's blow shakes the picture for a moment.
  const isJolt =
    t < 0.12 && events.some(ev => (ev.kind === 'hit' && ev.isCrit) || ev.kind === 'explode' || (ev.kind === 'hurt' && ev.dmg > 0 && c.foes[ev.foe]?.isBoss))
  if (isJolt) {
    const dx = frame % 2 === 0 ? 1 : -1
    const moved = out.slice()
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < width; x++) out[y * width + x] = moved[y * width + Math.max(0, Math.min(width - 1, x - dx))]!
  }

  // Pack two pixel rows per cell, then write the floating numbers as text.
  const words = new Uint32Array(width * SCENE_ROWS * 3)
  for (let cy = 0; cy < SCENE_ROWS; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const w = (cy * width + cx) * 3
      words[w] = 0x2580
      words[w + 1] = out[cy * 2 * width + cx]!
      words[w + 2] = out[(cy * 2 + 1) * width + cx]!
    }
  }
  const text = (label: string, x: number, row: number, col: number) => writeText(words, out, width, label, x, row, col)

  const shown = new Set<number>()
  for (const ev of hits) {
    if (ev.kind !== 'hit' || shown.has(ev.foe) || t > 0.85) continue
    shown.add(ev.foe)
    const at = foeAt[ev.foe]
    const tone = ev.isCrit ? 0xffd040 : ev.element === 'phys' ? 0xf0f0f0 : ELEMENT_COLORS[ev.element]
    if (at && ev.immune) text('IMMUNE', at.x + 2, NUM_ROW - Math.floor(t * 3), 0xa0a0a0)
    else if (at) text(`${compact(ev.dmg)}${ev.isCrit ? '!' : ''}`, at.x + 4, NUM_ROW - Math.floor(t * 3), tone)
  }
  for (const ev of hurts) {
    if (ev.kind !== 'hurt' || ev.minion !== undefined || t < 0.45) continue
    const label = ev.blocked ? 'BLOCK' : ev.absorbed ? (ev.dmg > 0 ? `-${compact(ev.dmg)}` : `(${compact(ev.absorbed)})`) : `-${compact(ev.dmg)}`
    text(label, hx + 3, NUM_ROW - Math.floor((t - 0.45) * 4), ev.blocked ? 0xc0c0c0 : ev.dmg > 0 ? 0xff4040 : 0x8080ff)
    break
  }
  const kill = events.find(ev => ev.kind === 'kill')
  if (kill?.kind === 'kill' && corpse) text(`+${compact(kill.gold)}g`, corpseX + 3, NUM_ROW + 2 - Math.floor(t * 3), 0xffd040)
  if (events.some(ev => ev.kind === 'levelUp') && t < 0.9) text('LEVEL UP!', hx - 1, NUM_ROW - 3, 0xffd040)
  if (armyLabel && !isDead) text(armyLabel.text, armyLabel.x, NUM_ROW + 1, 0x90e090)
  if (isDead) text('YOU HAVE DIED', Math.round(width / 2) - 6, Math.floor(SCENE_ROWS / 2) - 1, 0xd02020)

  return toBase64(new Uint8Array(words.buffer))
}

export const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export const toBase64 = (bytes: Uint8Array) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : ALPHABET[c & 63]
  }

  return out
}


/** A class's likeness for the select screen: the hero lit from the front, 18 by 9 cells. */
export const PORTRAIT_COLUMNS = 18
export const PORTRAIT_ROWS = 9

export const drawPortrait = (classId: ClassId, frame: number): string => {
  const width = PORTRAIT_COLUMNS
  const height = PORTRAIT_ROWS * 2
  const layer: Layer = { width, color: new Array<number>(width * height).fill(0), kind: new Uint8Array(width * height) }
  const sprite = heroSprite(classId, 'idle', 'idle')
  paint(layer, sprite, 1, 1 + (Math.floor(frame / 6) % 2))
  const words = new Uint32Array(width * PORTRAIT_ROWS * 3)
  const pixel = (x: number, y: number) => {
    const i = y * width + x
    const d = Math.hypot(x - width / 2, (y - height / 2) * 1.1) / (width * 0.6)
    const back = mix(0x2a1810, 0x060404, Math.min(1, d))
    if (layer.kind[i] === 0) return y >= height - 2 ? 0x1a1410 : back
    if (layer.kind[i] === 2) return layer.color[i]!

    return scale(layer.color[i]!, 1.05 - d * 0.4)
  }
  for (let cy = 0; cy < PORTRAIT_ROWS; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const w = (cy * width + cx) * 3
      words[w] = 0x2580
      words[w + 1] = pixel(cx, cy * 2)
      words[w + 2] = pixel(cx, cy * 2 + 1)
    }
  }

  return toBase64(new Uint8Array(words.buffer))
}
