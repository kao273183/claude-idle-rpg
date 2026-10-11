import { hash, mix, noise, scale } from './pixels'

/** Pixel kinds: 0 lit by the scene's lights, 1 a sprite, 2 glowing, 3 far away (its own light). */
export const KIND = { lit: 0, sprite: 1, glow: 2, far: 3 } as const

export type Light = { x: number; y: number; power: number; radius: number; color: number }

export type Canvas = { width: number; height: number; color: number[]; kind: Uint8Array }

export type Backdrop = {
  ambient: number
  lights: Light[]
  /** The colour shadows and the dark lean toward. */
  shade: number
  /** Drawn over everything once lit: snow, embers, sand, sparks. */
  overlay: (plot: (x: number, y: number, color: number, k: number) => void) => void
}

type Paint = { c: Canvas; floorY: number; scroll: number; frame: number }

const set = (c: Canvas, x: number, y: number, color: number, kind: number) => {
  if (x < 0 || x >= c.width || y < 0 || y >= c.height) return
  const i = y * c.width + x
  c.color[i] = color
  c.kind[i] = kind
}

const sky = ({ c, floorY }: Paint, top: number, bottom: number) => {
  for (let y = 0; y < floorY; y++) for (let x = 0; x < c.width; x++) set(c, x, y, mix(top, bottom, y / floorY), KIND.far)
}

const stars = ({ c, floorY, frame }: Paint, below: number, drift: number) => {
  for (let y = 0; y < Math.min(floorY - 6, below); y++) {
    for (let x = 0; x < c.width; x++) {
      const wx = Math.floor(x + drift)
      if (hash(wx, y * 31) > 0.988) {
        const twinkle = 0.55 + 0.45 * Math.sin(frame * 0.25 + hash(wx, y) * 20)
        set(c, x, y, mix(c.color[y * c.width + x]!, 0xffffff, twinkle * 0.8), KIND.far)
      }
    }
  }
}

/** A silhouette: rows at and below `height(wx)` take `color`, darkening toward the floor. */
const ridge = ({ c, floorY }: Paint, speed: number, scroll: number, height: (wx: number) => number, color: number, rim?: number) => {
  for (let x = 0; x < c.width; x++) {
    const wx = x + scroll * speed
    const top = Math.round(height(wx))
    for (let y = Math.max(0, top); y < floorY; y++) {
      const depth = (y - top) / Math.max(1, floorY - top)
      set(c, x, y, rim !== undefined && y === top ? rim : scale(color, 1 - depth * 0.35), KIND.far)
    }
  }
}

const disc = ({ c }: Paint, cx: number, cy: number, r: number, color: number, halo: number) => {
  for (let y = Math.floor(cy - r * 3); y <= cy + r * 3; y++) {
    for (let x = Math.floor(cx - r * 4); x <= cx + r * 4; x++) {
      if (x < 0 || x >= c.width || y < 0 || y >= c.height) continue
      const d = Math.hypot(x - cx, (y - cy) * 1.1)
      const i = y * c.width + x
      if (d <= r) set(c, x, y, mix(color, 0xffffff, Math.max(0, 0.4 - d / r / 3)), KIND.glow)
      else if (d <= r * 3.5) c.color[i] = mix(c.color[i]!, halo, 0.35 * (1 - (d - r) / (r * 2.5)))
    }
  }
}

/** The ground: a strip of floor with depth, its texture up to each look. */
const floor = ({ c, floorY, scroll }: Paint, near: number, far: number, texture: (wx: number, y: number, base: number) => number) => {
  for (let y = floorY; y < c.height; y++) {
    const depth = (y - floorY) / (c.height - floorY)
    const base = mix(far, near, depth)
    for (let x = 0; x < c.width; x++) set(c, x, y, texture(Math.floor(x + scroll), y, base), KIND.lit)
  }
}

/** Repeating props in the world: calls `draw` for each that is on screen. */
const every = (p: Paint, spacing: number, speed: number, offset: number, draw: (sx: number, k: number) => void) => {
  const s = p.scroll * speed
  const first = Math.floor((s - offset) / spacing) - 1
  for (let k = first; k * spacing + offset - s < p.c.width + spacing; k++) draw(Math.round(k * spacing + offset - s), k)
}

// ── Act one: a monastery's nave, pillars, glass and banners ────────────────
const monastery = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  const lights: Light[] = []
  // Back wall: dim courses of stone, a little behind the pillars.
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < c.width; x++) {
      const wx = Math.floor(x + p.scroll * 0.7)
      const course = Math.floor(y / 3)
      const bx = wx + (course % 2) * 5
      const isMortar = y % 3 === 0 || bx % 10 === 0
      const vault = Math.min(1, y / 6)
      set(c, x, y, isMortar ? 0x0e0c0a : scale(0x3a342e, (0.55 + hash(Math.floor(bx / 10), course) * 0.3) * (0.4 + 0.6 * vault)), KIND.lit)
    }
  }
  // Stained glass between the pillars, lit by the moon behind it.
  every(p, 36, 0.7, 18, (sx, k) => {
    const panes = [0x2848b0, 0xa02028, 0xc8a040, 0x2a8048]
    for (let y = 6; y < 15; y++) {
      for (let dx = -3; dx <= 3; dx++) {
        const isArch = y === 6 && Math.abs(dx) === 3
        if (isArch) continue
        const isLead = dx === 0 || y % 3 === 0 || Math.abs(dx) === 3
        const pane = panes[Math.floor(hash(k * 7 + dx, y >> 1) * panes.length)]!
        set(c, sx + dx, y, isLead ? 0x14100c : scale(pane, 0.75 + 0.25 * Math.sin(frame * 0.05 + k)), KIND.far)
      }
    }
  })
  // Pillars, with arches between them and a torch on every one.
  every(p, 36, 1, 0, (sx, k) => {
    for (let y = 0; y < floorY; y++) {
      const wide = y < 3 || y >= floorY - 2 ? 1 : 0
      for (let dx = -2 - wide; dx <= 2 + wide; dx++) {
        const tone = dx <= -2 ? 0x8a8070 : dx >= 2 ? 0x3a332a : 0x6a6052
        set(c, sx + dx, y, scale(tone, 0.85 + hash(k, y) * 0.2), KIND.lit)
      }
    }
    for (let dx = 3; dx < 33; dx++) {
      const u = dx / 36
      const y = Math.round(3 - Math.sin(u * Math.PI) * 3)
      set(c, sx + dx, y, 0x5a5246, KIND.lit)
      set(c, sx + dx, y + 1, 0x3a342c, KIND.lit)
    }
    // A banner on every other gap.
    if (k % 2 === 0) {
      for (let y = 4; y < 13; y++) {
        for (let dx = 12; dx <= 16; dx++) {
          const isTail = y === 12 && dx === 14
          if (isTail) continue
          const sway = Math.round(Math.sin(frame * 0.08 + k) * (y - 4) * 0.08)
          set(c, sx + dx + sway, y, y === 4 ? 0xc8a040 : dx === 12 || dx === 16 ? 0x5a0c0c : 0x8a1414, KIND.lit)
        }
      }
    }
    set(c, sx, 10, 0x2a2018, KIND.lit)
    set(c, sx, 9, hash(k, frame) > 0.4 ? 0xffe0a0 : 0xff9a30, KIND.glow)
    set(c, sx, 8, 0xff7a20, KIND.glow)
    lights.push({ x: sx, y: 9, power: 0.8 + hash(k, frame) * 0.3, radius: 16, color: 0xff9a40 })
  })
  floor(p, 0x4a4238, 0x2a251f, (wx, y, base) => {
    const isSeam = (wx + (y - floorY) * 3) % 14 === 0 || y === floorY
    let col = isSeam ? scale(base, 0.55) : scale(base, 0.85 + hash(wx >> 2, y) * 0.25)
    // Bones and skulls on the flagstones.
    if (y === floorY + 2 && hash(wx >> 1, 77) > 0.97) col = 0xc8c0a8

    return col
  })

  return {
    ambient: 0.22,
    lights,
    shade: 0x0a0806,
    overlay: plot => {
      // Dust motes in the torchlight.
      for (let k = 0; k < 14; k++) {
        const x = (hash(k, 1) * c.width + frame * 0.15 * (hash(k, 2) - 0.5)) % c.width
        const y = (hash(k, 3) * floorY + Math.sin(frame * 0.05 + k) * 2) % floorY
        plot((x + c.width) % c.width, y, 0xd8c8a0, 0.25)
      }
    },
  }
}

// ── Act two: desert at dusk, dunes and broken columns ──────────────────────
const desert = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  sky(p, 0x2a1a40, 0xe8884a)
  stars(p, 6, p.scroll * 0.02)
  disc(p, c.width * 0.72, floorY - 9, 4, 0xffd890, 0xffa860)
  ridge(p, 0.15, p.scroll, wx => floorY - 7 + 2.5 * Math.sin(wx * 0.05) + 1.5 * Math.sin(wx * 0.13 + 1), 0x6a3a48)
  ridge(p, 0.4, p.scroll, wx => floorY - 3 + 1.6 * Math.sin(wx * 0.07 + 2), 0xa86a48, 0xd89060)
  every(p, 70, 0.55, 30, (sx, k) => {
    const h = 9 + Math.floor(hash(k, 5) * 6)
    for (let y = floorY - h; y < floorY; y++) {
      const top = y === floorY - h
      for (let dx = 0; dx < 4; dx++) {
        if (top && hash(k * 4 + dx, 9) > 0.6) continue
        set(c, sx + dx, y, dx === 0 ? 0xe0b080 : dx === 3 ? 0x7a5034 : 0xb88a5c, KIND.lit)
      }
    }
  })
  floor(p, 0xd8a868, 0xa87848, (wx, y, base) => scale(base, 0.9 + 0.12 * Math.sin((wx + y * 4) * 0.35) + hash(wx, y) * 0.05))

  return {
    ambient: 0.62,
    lights: [{ x: c.width * 0.72, y: floorY - 9, power: 0.35, radius: c.width, color: 0xffa060 }],
    shade: 0x3a1a20,
    overlay: plot => {
      // Sand on the wind.
      for (let k = 0; k < 18; k++) {
        const x = (hash(k, 11) * c.width * 3 - frame * (1.2 + hash(k, 12))) % c.width
        const y = floorY - 6 + hash(k, 13) * (c.height - floorY + 6)
        plot((x + c.width) % c.width, y, 0xf0d8a0, 0.5)
      }
    },
  }
}

// ── Act three: jungle by moonlight ─────────────────────────────────────────
const jungle = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  sky(p, 0x040a0e, 0x10302a)
  stars(p, 10, p.scroll * 0.03)
  disc(p, c.width * 0.8, 5, 2.5, 0xe8f0d0, 0x406058)
  ridge(p, 0.2, p.scroll, wx => 9 + 3 * Math.sin(wx * 0.08) + 2 * Math.sin(wx * 0.21) + hash(Math.floor(wx), 3) * 1.5, 0x0a1c16)
  every(p, 26, 0.6, 10, (sx, k) => {
    const w = 3 + Math.floor(hash(k, 2) * 2)
    for (let y = 0; y < floorY; y++) for (let dx = 0; dx < w; dx++) set(c, sx + dx, y, dx === 0 ? 0x3a2c20 : 0x221810, KIND.lit)
    // Canopy over the trunk, vines hanging from it.
    for (let y = 0; y < 6; y++) {
      for (let dx = -6; dx < w + 6; dx++) {
        if (hash(sx + dx * 3 + k, y) > 0.35 + y * 0.08) set(c, sx + dx, y, scale(0x1c4026, 0.7 + hash(dx, y + k) * 0.5), KIND.lit)
      }
    }
    for (let v = 0; v < 2; v++) {
      const vx = sx + w + 2 + Math.floor(hash(k, v + 7) * 10)
      const len = 6 + Math.floor(hash(k, v + 9) * 9)
      const sway = Math.sin(frame * 0.06 + k + v)
      for (let y = 4; y < 4 + len; y++) set(c, vx + Math.round(sway * (y - 4) * 0.12), y, y % 3 === 0 ? 0x4a8a3a : 0x2a5a2a, KIND.lit)
    }
  })
  floor(p, 0x2a4220, 0x101c0c, (wx, y, base) => {
    if (y === floorY) return hash(wx, 1) > 0.45 ? 0x4a7a34 : 0x2a4a20
    return scale(base, 0.8 + hash(wx >> 1, y) * 0.35)
  })
  // Fireflies: a few soft lights drifting through the leaves.
  const flies = Array.from({ length: 7 }, (_, k) => ({
    x: (hash(k, 21) * c.width * 1.3 - p.scroll * 0.3 + Math.sin(frame * 0.04 + k) * 4 + c.width * 2) % c.width,
    y: 6 + hash(k, 22) * (floorY - 6) + Math.sin(frame * 0.07 + k * 2) * 2,
    on: Math.sin(frame * 0.12 + k * 1.7) > -0.2,
  }))

  return {
    ambient: 0.3,
    lights: [
      { x: c.width * 0.8, y: 5, power: 0.25, radius: c.width, color: 0x90a8c8 },
      ...flies.filter(f => f.on).map(f => ({ x: f.x, y: f.y, power: 0.3, radius: 5, color: 0xd0ff60 })),
    ],
    shade: 0x02100c,
    overlay: plot => {
      for (const f of flies) if (f.on) plot(f.x, f.y, 0xe8ff80, 1)
    },
  }
}

// ── Act four: hell, spires and falls of molten rock ────────────────────────
const hell = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  sky(p, 0x120202, 0x7a1a08)
  // Smoke drifting across the red sky.
  for (let y = 0; y < floorY - 4; y++) {
    for (let x = 0; x < c.width; x++) {
      const n = noise((x + p.scroll * 0.05 + frame * 0.1) * 0.08, y * 0.25)
      if (n > 0.55) c.color[y * c.width + x] = mix(c.color[y * c.width + x]!, 0x1a0606, (n - 0.55) * 1.6)
    }
  }
  const spire = (wx: number) => 4 + 9 * (1 - Math.abs(Math.sin(wx * 0.045))) + hash(Math.floor(wx / 2), 4) * 2
  ridge(p, 0.18, p.scroll, spire, 0x1a0404)
  const lights: Light[] = []
  every(p, 64, 0.18, 24, sx => {
    const top = Math.round(spire(sx + p.scroll * 0.18)) + 2
    for (let y = top; y < floorY; y++) {
      for (const dx of [0, 1]) set(c, sx + dx, y, hash(y + frame, dx) > 0.5 ? 0xffa030 : 0xff5010, KIND.glow)
    }
    lights.push({ x: sx, y: floorY - 2, power: 0.6, radius: 14, color: 0xff4010 })
  })
  ridge(p, 0.45, p.scroll, wx => floorY - 4 + 2 * Math.sin(wx * 0.09) + hash(Math.floor(wx), 6), 0x2a0c08, 0xb03810)
  floor(p, 0x2a1410, 0x140806, (wx, y, base) => {
    if (hash(wx, y * 7) > 0.93) return mix(0xff4010, 0xffb030, hash(wx, frame >> 2))
    return scale(base, 0.85 + hash(wx >> 2, y) * 0.3)
  })
  // The cracks glow.
  for (let y = floorY; y < c.height; y++) for (let x = 0; x < c.width; x++) if (hash(Math.floor(x + p.scroll), y * 7) > 0.93) c.kind[y * c.width + x] = KIND.glow

  return {
    ambient: 0.32,
    lights,
    shade: 0x200404,
    overlay: plot => {
      // Embers rising.
      for (let k = 0; k < 16; k++) {
        const life = (frame * (0.6 + hash(k, 31)) + hash(k, 32) * 40) % 40
        const x = (hash(k, 33) * c.width + Math.sin(life * 0.3 + k) * 2 + c.width) % c.width
        const y = c.height - life * 0.8
        plot(x, y, life < 20 ? 0xffc040 : 0xff5010, 1 - life / 40)
      }
    },
  }
}

// ── Act five: a snowbound night under the aurora ───────────────────────────
const snow = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  sky(p, 0x050a1c, 0x22345a)
  stars(p, 12, p.scroll * 0.02)
  // The aurora: a ribbon of green light, slowly moving.
  for (let x = 0; x < c.width; x++) {
    const wx = x + p.scroll * 0.03
    const centre = 5 + 2 * Math.sin(wx * 0.05 + frame * 0.02) + Math.sin(wx * 0.13)
    for (let y = 0; y < 12; y++) {
      const d = Math.abs(y - centre)
      if (d < 3) {
        const i = y * c.width + x
        c.color[i] = mix(c.color[i]!, d < 1 ? 0x60ffb0 : 0x30a0a0, (1 - d / 3) * (0.35 + 0.15 * Math.sin(wx * 0.2 + frame * 0.05)))
      }
    }
  }
  const peak = (wx: number) => 9 + 6 * Math.abs(Math.sin(wx * 0.035)) + 2 * Math.sin(wx * 0.11)
  for (let x = 0; x < c.width; x++) {
    const wx = x + p.scroll * 0.12
    const top = Math.round(peak(wx))
    for (let y = top; y < floorY; y++) set(c, x, y, y < top + 2 ? 0xd0dcf0 : mix(0x3a4868, 0x1a2238, (y - top) / (floorY - top)), KIND.far)
  }
  every(p, 18, 0.5, 6, (sx, k) => {
    const h = 9 + Math.floor(hash(k, 3) * 6)
    for (let y = floorY - h; y < floorY; y++) {
      const half = Math.floor(((y - (floorY - h)) / h) * 4) + ((y - (floorY - h)) % 3 === 0 ? 0 : -1)
      for (let dx = -half; dx <= half; dx++) set(c, sx + dx, y, Math.abs(dx) === half && y % 3 === 0 ? 0xe0e8f0 : 0x0c1a20, KIND.lit)
    }
  })
  floor(p, 0xe0eaf4, 0x90a2bc, (wx, y, base) => scale(base, 0.92 + hash(wx >> 1, y) * 0.1))
  for (let y = floorY; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (hash(Math.floor(x + p.scroll), y * 13) > 0.985 && Math.sin(frame * 0.3 + x) > 0.3) set(c, x, y, 0xffffff, KIND.glow)
    }
  }

  return {
    ambient: 0.5,
    lights: [{ x: c.width / 2, y: 2, power: 0.15, radius: c.width, color: 0x80c0ff }],
    shade: 0x101830,
    overlay: plot => {
      // Snow falling, the wind behind it.
      for (let k = 0; k < 30; k++) {
        const fall = (frame * (0.35 + hash(k, 41) * 0.4) + hash(k, 42) * c.height) % c.height
        const x = (hash(k, 43) * c.width + fall * 0.6 + Math.sin(frame * 0.05 + k) * 2) % c.width
        plot(x, fall, 0xffffff, 0.55 + hash(k, 44) * 0.45)
      }
    },
  }
}

// ── The greater rift: a void of drifting stone ─────────────────────────────
const voidLook = (p: Paint): Backdrop => {
  const { c, floorY, frame } = p
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < c.width; x++) {
      const n = noise((x + p.scroll * 0.08) * 0.07 + frame * 0.004, y * 0.18)
      const m = noise((x + p.scroll * 0.05) * 0.13 + 7, y * 0.3 - frame * 0.003)
      let col = mix(0x06020c, 0x1e0a32, y / floorY)
      col = mix(col, 0x8a20c0, Math.max(0, n - 0.5) * 1.1)
      col = mix(col, 0x2060c0, Math.max(0, m - 0.65) * 1.2)
      set(c, x, y, col, KIND.far)
    }
  }
  stars(p, floorY, p.scroll * 0.05)
  every(p, 58, 0.3, 20, (sx, k) => {
    const cy = 6 + Math.floor(hash(k, 5) * 8) + Math.round(Math.sin(frame * 0.04 + k) * 1)
    const w = 7 + Math.floor(hash(k, 6) * 6)
    for (let dx = -w; dx <= w; dx++) {
      const depth = Math.round((1 - Math.abs(dx) / w) * 3) + 1
      for (let dy = 0; dy < depth; dy++) set(c, sx + dx, cy + dy, dy === depth - 1 ? 0x8040c0 : 0x1a1024, KIND.far)
      if (hash(k * 31 + dx, 7) > 0.85) set(c, sx + dx, cy - 1, 0xc080ff, KIND.glow)
    }
  })
  floor(p, 0x1e1428, 0x0c0814, (wx, y, base) => scale(base, 0.85 + hash(wx >> 1, y) * 0.3))
  for (let y = p.floorY; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const wx = Math.floor(x + p.scroll)
      if (hash(wx, y * 5) > 0.95) set(c, x, y, mix(0x8030ff, 0x40c0ff, 0.5 + 0.5 * Math.sin(frame * 0.2 + wx)), KIND.glow)
    }
  }

  return {
    ambient: 0.35,
    lights: [{ x: c.width / 2, y: floorY, power: 0.3, radius: c.width * 0.7, color: 0xa040ff }],
    shade: 0x0a0414,
    overlay: plot => {
      for (let k = 0; k < 14; k++) {
        const life = (frame * (0.5 + hash(k, 51)) + hash(k, 52) * 30) % 30
        const x = (hash(k, 53) * c.width + Math.sin(life * 0.4 + k) * 3 + c.width) % c.width
        plot(x, c.height - life, k % 3 === 0 ? 0x60d0ff : 0xc060ff, 1 - life / 30)
      }
    },
  }
}

export const LOOK_COUNT = 6
export const RIFT_LOOK = 5

/** Paints the world behind the fighting, by look: five acts and the rift. */
export const paintBackdrop = (look: number, c: Canvas, floorY: number, scroll: number, frame: number): Backdrop => {
  const p: Paint = { c, floorY, scroll, frame }
  switch (look) {
    case 1:
      return desert(p)
    case 2:
      return jungle(p)
    case 3:
      return hell(p)
    case 4:
      return snow(p)
    case RIFT_LOOK:
      return voidLook(p)
    default:
      return monastery(p)
  }
}
