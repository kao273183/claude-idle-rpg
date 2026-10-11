import type { Character } from '../types'

import { BELT_SIZE, heroStats, rankOf } from './character'
import { xpToNext } from './monsters'
import { hash, mix, scale } from './pixels'
import { compact, toBase64 } from './scene'
import { classSkills, skillOf } from './skilltree'
import { MAX_LEVEL, talentCost, talentPointsLeft } from './talents'
import type { FxKind } from './skilltree'

/** Terminal rows of the HUD under the scene: two pixels a row. */
export const HUD_ROWS = 6
const HEIGHT = HUD_ROWS * 2
const ORB = 12 // the orbs' diameter in pixels

const STONE = 0x24201a
const STONE_DARK = 0x14110d
const GOLD = 0xc8a040
const GOLD_DARK = 0x6a5020
const GOLD_LIGHT = 0xffe090

const POTION: Record<'red' | 'blue', number> = { red: 0xd02020, blue: 0x2848e0 }

/** A skill's mark in its slot: a few pixels that say what kind of skill it is. */
const GLYPHS: Partial<Record<FxKind, readonly string[]>> = {
  melee: ['....##', '...##.', '..##..', '.##...', '##....', '#.....'],
  spin: ['.####.', '#....#', '#.##.#', '#.##.#', '#....#', '.####.'],
  leap: ['..##..', '.#..#.', '#....#', '......', '.####.', '######'],
  projectile: ['......', '...##.', '#.####', '#.####', '...##.', '......'],
  orb: ['.#..#.', '..##..', '#####.', '.#####', '..##..', '.#..#.'],
  beam: ['..##..', '.##...', '####..', '..####', '...##.', '..##..'],
  nova: ['#.##.#', '.#..#.', '#.##.#', '#.##.#', '.#..#.', '#.##.#'],
  rain: ['#..#..', '.#..#.', '..#..#', '#..#..', '.#..#.', '######'],
  wall: ['.#..#.', '##.###', '######', '######', '######', '######'],
  burst: ['#.#.#.', '.###..', '##.##.', '.###..', '#.#.#.', '......'],
  shout: ['..#...', '.##.#.', '###..#', '###..#', '.##.#.', '..#...'],
  curse: ['.#..#.', '######', '.#..#.', '.#..#.', '######', '.#..#.'],
  summon: ['.####.', '#.##.#', '######', '.#..#.', '.####.', '#.##.#'],
  aura: ['..#...', '.###..', '#.#.#.', '..#...', '..#...', '..#...'],
}

/**
 * The bottom of the screen as in the old game: a carved stone bar, the life
 * orb on the left and the mana orb on the right in gold, the skills and the
 * belt between them, experience along the top.
 */
export const drawHud = (c: Character, frame: number, width: number): string => {
  const s = heroStats(c)
  const px = new Array<number>(width * HEIGHT).fill(STONE)
  const set = (x: number, y: number, color: number) => {
    if (x >= 0 && x < width && y >= 0 && y < HEIGHT) px[Math.round(y) * width + Math.round(x)] = color
  }

  // Carved stone: blocks with worn edges, a gold trim with rivets along the top.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const course = Math.floor((y - 2) / 5)
      const bx = x + (course % 2) * 6
      const isJoint = (y - 2) % 5 === 0 || bx % 12 === 0
      px[y * width + x] = isJoint ? STONE_DARK : scale(STONE, 0.8 + hash(Math.floor(bx / 12), course) * 0.35 + hash(x, y) * 0.08)
    }
  }
  for (let x = 0; x < width; x++) {
    set(x, 0, x % 8 === 4 ? GOLD_LIGHT : GOLD)
    set(x, 1, GOLD_DARK)
  }

  const orb = (left: number, fill: number, liquid: number) => {
    const r = ORB / 2
    const cx = left + r - 0.5
    const cy = HEIGHT / 2
    const level = cy + r - fill * ORB
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = left - 2; x <= left + ORB + 1; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.05)
        if (d > r + 1.6) continue
        if (d > r + 0.6) {
          set(x, y, y < cy ? GOLD_LIGHT : GOLD_DARK)
          continue
        }
        if (d > r - 0.4) {
          set(x, y, GOLD)
          continue
        }
        const wave = Math.sin(x * 0.9 + frame * 0.35) * 0.5
        const isLiquid = y >= level + wave
        let color = isLiquid ? mix(liquid, 0x000000, ((y - level) / ORB) * 0.55) : 0x120a0a
        if (isLiquid && Math.abs(y - (level + wave)) < 1) color = mix(liquid, 0xffffff, 0.4)
        if (isLiquid && hash(x, y + (frame >> 2)) > 0.92) color = mix(color, 0xffffff, 0.25)
        // A glint on the glass.
        if (x - cx < -1 && y - cy < -1 && d > r - 2.4) color = mix(color, 0xffffff, 0.5)
        set(x, y, color)
      }
    }
  }
  orb(2, Math.max(0, Math.min(1, c.hp / s.maxHp)), 0xc81818)
  orb(width - ORB - 3, Math.max(0, Math.min(1, c.mana / s.maxMana)), 0x2040d8)

  // The belt in the middle: four red, four blue.
  const slot = 4
  const beltWidth = BELT_SIZE * slot
  const beltLeft = Math.round(width / 2 - beltWidth / 2)
  for (let k = 0; k < BELT_SIZE; k++) {
    const x0 = beltLeft + k * slot
    const color = k < BELT_SIZE / 2 ? 'red' : 'blue'
    const has = k < BELT_SIZE / 2 ? k < Math.min(BELT_SIZE / 2, c.belt.red) : k - BELT_SIZE / 2 < Math.min(BELT_SIZE / 2, c.belt.blue)
    for (let y = 5; y < HEIGHT - 1; y++) for (let x = x0; x < x0 + slot - 1; x++) set(x, y, 0x0c0a08)
    set(x0 - 1, 5, GOLD_DARK)
    if (!has) continue
    // A little bottle: cork, neck, round belly.
    set(x0 + 1, 6, 0x8a6a40)
    set(x0 + 1, 7, 0xa0a0a8)
    for (const [dx, dy] of [[0, 8], [1, 8], [2, 8], [0, 9], [1, 9], [2, 9], [1, 10]] as const) {
      set(x0 + dx, dy, dy === 8 && dx === 0 ? mix(POTION[color], 0xffffff, 0.55) : scale(POTION[color], dy === 10 ? 0.6 : 1))
    }
  }

  // Experience: a gold line across the belt, with a moving shine.
  const xp = c.level >= MAX_LEVEL ? Math.min(1, c.talentXp / talentCost(c.talentEarned)) : Math.min(1, c.xp / xpToNext(c.level))
  for (let x = beltLeft; x < beltLeft + beltWidth; x++) {
    const filled = x - beltLeft < xp * beltWidth
    const shine = filled && (x - frame) % 24 === 0
    set(x, 3, filled ? (shine ? GOLD_LIGHT : 0xd8a838) : 0x2a2418)
  }

  // Skill slots either side of the belt: the main attack, and the strongest thing kept up.
  const icon = (x0: number, id: string) => {
    const def = skillOf(id)
    const glyph = GLYPHS[def.fx.kind] ?? GLYPHS.melee!
    for (let y = 3; y < HEIGHT - 1; y++) {
      for (let x = x0; x < x0 + 8; x++) {
        const isEdge = y === 3 || y === HEIGHT - 2 || x === x0 || x === x0 + 7
        set(x, y, isEdge ? (y === 3 ? GOLD_LIGHT : GOLD) : mix(0x100c08, def.fx.color, 0.15 + ((y - 3) / 6) * 0.15))
      }
    }
    glyph.forEach((row, gy) => {
      ;[...row].forEach((ch, gx) => {
        if (ch === '#') set(x0 + 1 + gx, 4 + gy, mix(def.fx.color, 0xffffff, gy < 2 ? 0.35 : 0))
      })
    })
  }
  const kept = classSkills(c.classId)
    .filter(sk => sk.kind !== 'attack' && sk.kind !== 'passive' && rankOf(c, sk.id) > 0)
    .sort((a, b) => rankOf(c, b.id) - rankOf(c, a.id))[0]
  icon(beltLeft - 11, c.mainSkill ?? 'attack')
  if (kept) icon(beltLeft + beltWidth + 3, kept.id)

  // Cells, then the numbers beside the orbs.
  const words = new Uint32Array(width * HUD_ROWS * 3)
  for (let cy = 0; cy < HUD_ROWS; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const w = (cy * width + cx) * 3
      words[w] = 0x2580
      words[w + 1] = px[cy * 2 * width + cx]!
      words[w + 2] = px[(cy * 2 + 1) * width + cx]!
    }
  }
  const text = (label: string, x: number, row: number, color: number) => {
    ;[...label].forEach((ch, k) => {
      const cx = x + k
      if (cx < 0 || cx >= width) return
      const w = (row * width + cx) * 3
      words[w] = ch.codePointAt(0) ?? 0x20
      words[w + 1] = color
      words[w + 2] = px[(row * 2 + 1) * width + cx]!
    })
  }
  const lifeText = `${compact(Math.max(0, c.hp))}/${compact(s.maxHp)}`
  const manaText = `${compact(Math.max(0, c.mana))}/${compact(s.maxMana)}`
  text('LIFE', ORB + 6, 2, 0xb09878)
  text(lifeText, ORB + 6, 3, 0xff6050)
  text('MANA', width - ORB - 6 - 4, 2, 0xb09878)
  text(manaText, width - ORB - 6 - manaText.length, 3, 0x7090ff)
  const spare = talentPointsLeft(c)
  const lv = c.level >= MAX_LEVEL ? `LV ${c.level}${spare > 0 ? ` +${spare}` : ''}` : `LV ${c.level}`
  text(lv, Math.round(width / 2 - lv.length / 2), 1, GOLD_LIGHT)

  return toBase64(new Uint8Array(words.buffer))
}
