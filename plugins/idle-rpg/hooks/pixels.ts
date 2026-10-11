/** Colours as 0xRRGGBB, and the few things a pixel painter does with them. */
export const channel = (c: number, shift: number) => (c >> shift) & 255

export const rgb = (r: number, g: number, b: number) =>
  (Math.max(0, Math.min(255, Math.round(r))) << 16) |
  (Math.max(0, Math.min(255, Math.round(g))) << 8) |
  Math.max(0, Math.min(255, Math.round(b)))

export const scale = (c: number, k: number) => rgb(channel(c, 16) * k, channel(c, 8) * k, channel(c, 0) * k)

export const mix = (a: number, b: number, t: number) =>
  rgb(
    channel(a, 16) + (channel(b, 16) - channel(a, 16)) * t,
    channel(a, 8) + (channel(b, 8) - channel(a, 8)) * t,
    channel(a, 0) + (channel(b, 0) - channel(a, 0)) * t,
  )

/** A stable pseudo-random number in [0, 1) for a pair of integers. */
export const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth noise: the hash grid, blended between its points. */
export const noise = (x: number, y: number) => {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash(x0, y0)
  const b = hash(x0 + 1, y0)
  const c = hash(x0, y0 + 1)
  const d = hash(x0 + 1, y0 + 1)

  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}
