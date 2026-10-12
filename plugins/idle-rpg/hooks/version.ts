/** Keep in step with .claude-plugin/plugin.json and the marketplace entry. */
export const VERSION = '1.2.0'

/** The published manifest: whatever version it names is the newest one out. */
export const LATEST_URL = 'https://raw.githubusercontent.com/kao273183/claude-idle-rpg/main/plugins/idle-rpg/.claude-plugin/plugin.json'

export const CHECK_EVERY_MS = 60 * 60 * 1000

const parts = (v: string) => v.split('.').map(n => Number.parseInt(n, 10) || 0)

/** Whether version `a` comes after version `b`, compared part by part. */
export const isNewer = (a: string, b: string) => {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }

  return false
}

/** The version a manifest's text names, or undefined for anything unreadable. */
export const versionIn = (text: string): string | undefined => {
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version

    return typeof v === 'string' && /^\d+(\.\d+)*$/.test(v) ? v : undefined
  } catch {
    return undefined
  }
}
