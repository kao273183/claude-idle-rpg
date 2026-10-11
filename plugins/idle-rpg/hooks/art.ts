import type { ClassId, MinionKind } from '../types'

/** Pixel art: each row a string, each character a palette entry, `.` see-through. */
export type Sprite = { rows: readonly string[]; palette: Record<string, number>; glow?: string }

export const K = 0x0a0808

export type Pose = 'idle' | 'stride' | 'pass' | 'cast'
type Gait = 'idle' | 'stride' | 'pass'

/** Lays `patch` over `rows` at (x, y), only where the rows are see-through. */
const overlay = (rows: readonly string[], x: number, y: number, patch: readonly string[]) =>
  rows.map((row, ry) => {
    const line = patch[ry - y]
    if (line === undefined) return row
    const chars = [...row.padEnd(x + line.length, '.')]
    ;[...line].forEach((ch, k) => {
      if (ch !== '.' && chars[x + k] === '.') chars[x + k] = ch
    })

    return chars.join('')
  })

export const flipSprite = (sprite: Sprite): Sprite => {
  const width = Math.max(...sprite.rows.map(r => r.length))

  return { ...sprite, rows: sprite.rows.map(row => [...row.padEnd(width, '.')].reverse().join('')) }
}

// ── Barbarian: horned helm, a braided beard, a great axe ──────────────────
const BARB_PALETTE = {
  k: K,
  M: 0xc8d0dc, m: 0x8a929e, n: 0x4a505a,
  W: 0xf0e6cc, w: 0xb8a888,
  T: 0xf0b888, S: 0xc88a58, s: 0x8a5630,
  H: 0x8a5428, h: 0x5a3418,
  F: 0xa07a4a, f: 0x6a4a2a,
  b: 0x3a2414, g: 0xe0b040,
  P: 0x6a5236, p: 0x463422,
  O: 0x4a3424, o: 0x2a1c12,
  A: 0xf0f6ff, a: 0xa8b4c4, d: 0x5a6470,
  t: 0x7a4c28, r: 0x4a2c14,
}
const BARB_HEAD = [
  '..w..........w......',
  '.Ww...kkkkk...wW....',
  '.Ww.kkMMMMmkk.wW....',
  '..wwkMMmmmmmnkw.....',
  '...kkmmmmmmmnkk.....',
  '...knnnnnnnnnk......',
  '...kTSkSSSkSsk......',
  '...kTSSSSSSSsk......',
  '....khHHHHHhk.......',
  '....khhHHHhhk.......',
]
const BARB_BODY = [
  '..kFFkhhhhhkFFk.....',
  '.kFFfkSSSSSkfFFk....',
  'kTSfSTSSSSSSSsSTk...',
  'kTSkSTTSSSSSSskSSk..',
  'kSSkSSSSSsSSSskSSk..',
  'kSsk.SSSsSSSsk.kk...',
  '.kk..kbbbgbbbk......',
  '.....kPPPpPPPk......',
  '.....kPPpkpPPk......',
]
const BARB_AXE_REST = ['.kAAk.kAAk', 'kAAAadAAAak', 'kAAaadaAAak', '.kAadtdaak.', '..kk.t.kk..', '....kt.....', '...kkt.....', '....kt.....', '...kt......', '...rk......']
const BARB_AXE_SWING = ['.......kAAk', '.tttrrkAAAAk', 'k....kdaaaAAk', '......kddaak.', '.......kkkk..']
const BARB_LEGS: Record<Gait, string[]> = {
  idle: ['.....kPpk.kPpk......', '.....kPpk.kPpk......', '....kOOok.kOOok.....', '....kooook.kooook...', '....kkkkkk.kkkkkk...'],
  stride: ['....kPpk...kPpk.....', '...kPpk.....kPpk....', '..kOOok......kOOok..', '..kooook.....kooook.', '..kkkkkk.....kkkkkk.'],
  pass: ['......kPpPk.........', '......kPpPk.........', '.....kOOOok.........', '.....koooook........', '.....kkkkkkk........'],
}

// ── Sorceress: flame-red hair, a violet robe trimmed in gold, a crystal staff ─
const SORC_PALETTE = {
  k: K,
  Q: 0xf07848, R: 0xc04428, r: 0x7a2414,
  T: 0xffe0c0, S: 0xf0c098, s: 0xc08a68, e: 0x203040,
  U: 0x8a7ae0, P: 0x6050c0, p: 0x382c80,
  G: 0xe8c050, g: 0x9a7a28, B: 0x2a1a40,
  w: 0x8a6a3a, v: 0x5a4020,
  O: 0x90f4ff, o: 0x30a8d8,
}
const SORC_TOP = [
  '.....kkkk.........',
  '....kQRRRk........',
  '...kQRRRRRk.......',
  '...kRRRRRRk.......',
  '..kRkTSSSkRk......',
  '..kRkSeSeSRk......',
  '..kRkSSSSsRk......',
  '..kRRkSSskRRk.....',
  '..kRrkkkkkrRk.....',
  '..kRkGGPGGkRk.....',
  '.kRkUPPGPPPkRk....',
  '.kSkUPPGPPpkSk....',
  'kTSkUPPGPPpkSSk...',
  '.kk.UPBBBBpk.kk...',
  '....UPPGPPpk......',
  '...kUPPGPPPpk.....',
  '...kUPPGPPPpk.....',
  '..kUPPPGPPPppk....',
  '..kUPPPGPPPppk....',
]
const SORC_CAST_ARM = ['......kOk', 'kSSkwwvOOOk', '......kOk']
const SORC_STAFF = ['kOk', 'OOOk', 'kOk', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.w', '.v', '.v']
const robe = (U: string, P: string, p: string, G: string) => ({
  idle: [`..k${U}${P}${P}${P}${G}${P}${P}${P}${p}${p}k....`, `.k${U}${P}${P}${P}${P}${G}${P}${P}${P}${P}${p}${p}k...`, `.k${U}${P}${P}${P}${P}${G}${P}${P}${P}${P}${p}${p}k...`, `.k${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}k...`, '.kkkkkkkkkkkkkk...'],
  stride: [`..k${U}${P}${P}${P}${G}${P}${P}${P}${p}${p}k....`, `.k${U}${P}${P}${P}${P}${G}${P}${P}${P}${P}${p}${p}k...`, `k${U}${P}${P}${P}${P}${P}${G}${P}${P}${P}${P}${P}${p}${p}k..`, `k${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}k..`, 'kkk.kkkkkkk.kkkk..'],
  pass: [`..k${U}${P}${P}${P}${G}${P}${P}${P}${p}${p}k....`, `..k${U}${P}${P}${P}${G}${P}${P}${P}${p}${p}k....`, `.k${U}${P}${P}${P}${P}${G}${P}${P}${P}${P}${p}k....`, `.k${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}${G}k....`, '.kkkkkkkkkkkkk....'],
})
const SORC_LEGS = robe('U', 'P', 'p', 'G')

// ── Necromancer: a deep hood, eyes alight, bone pauldrons, a skull wand ──
const NECRO_PALETTE = {
  k: K,
  D: 0x5a6a5c, C: 0x3a443e, c: 0x1e2620,
  S: 0xe0d8d0, s: 0xa8a098, E: 0x90ff90,
  W: 0xece4cc, w: 0xa8a088, R: 0x8a1a1a,
  G: 0x60ff60,
}
const NECRO_TOP = [
  '.....kkkk.........',
  '....kDCCCk........',
  '...kDCCCCCk.......',
  '..kDCCkkkCCk......',
  '..kDCksssskCk.....',
  '..kCkEsssEkCk.....',
  '..kCkssSsskCk.....',
  '..kCCksssskCCk....',
  '.kDCCCkkkkCCCCk...',
  '.kDWWCCRCCCWWCk...',
  'kDWWWCCRCCWWWCk...',
  'kSkWCDCRCCCWkSk...',
  'kSkkCDCRCCCkkSSk..',
  '.kk.CDCRCCCck.k...',
  '....kDCRCCCck.....',
  '...kDCCRCCCcck....',
  '...kDCCRCCCcck....',
  '..kDCCCRCCCccck...',
  '..kDCCCRCCCccck...',
]
const NECRO_WAND = ['kWWk', 'WkkW', 'kWWk', '.Wk', '.W', '.W', '.w']
const NECRO_CAST_ARM = ['.......G', 'kSSkwWWWGG', '.......G']
const NECRO_LEGS = robe('D', 'C', 'c', 'R')

export const heroSprite = (classId: ClassId, pose: Pose, gait: Gait): Sprite => {
  const isCast = pose === 'cast'
  switch (classId) {
    case 'barbarian': {
      const top = [...BARB_HEAD, ...BARB_BODY]
      const armed = isCast ? overlay(top, 16, 11, BARB_AXE_SWING) : overlay(top, 12, 3, BARB_AXE_REST)

      return { palette: BARB_PALETTE, rows: [...armed, ...BARB_LEGS[gait]] }
    }
    case 'sorceress': {
      const body = [...SORC_TOP, ...SORC_LEGS[gait]]
      const armed = isCast ? overlay(body, 11, 11, SORC_CAST_ARM) : overlay(body, 14, 0, SORC_STAFF)

      return { palette: SORC_PALETTE, glow: 'Oo', rows: armed }
    }
    case 'necromancer': {
      const body = [...NECRO_TOP, ...NECRO_LEGS[gait]]
      const armed = isCast ? overlay(body, 12, 11, NECRO_CAST_ARM) : overlay(body, 14, 6, NECRO_WAND)

      return { palette: NECRO_PALETTE, glow: 'EG', rows: armed }
    }
  }
}

/** Where on the hero the spell leaves from, relative to the sprite's corner. */
export const HAND: Record<ClassId, { x: number; y: number }> = {
  barbarian: { x: 26, y: 13 },
  sorceress: { x: 20, y: 12 },
  necromancer: { x: 20, y: 12 },
}

// ── Monsters, facing left toward the hero ──────────────────────────────────
export const MONSTERS: Sprite[] = [
  {
    // fallen: a small red imp with big ears and a crooked blade
    palette: { k: K, R: 0xd84a2a, r: 0xa02818, d: 0x5a1008, y: 0xffd020, w: 0xb8b098, W: 0xf0e8d0, t: 0xf0f0e0, l: 0x5a4020 },
    glow: 'y',
    rows: [
      '...k.......k......',
      '..krk.....krk.....',
      '..krrkkkkkrrk.....',
      '...krRRRRRrk......',
      '..kRyykRyykRk.....',
      '..kRRRRRRRRRk.....',
      '...kRtktktRk......',
      '....kkrrrkk.......',
      '.W.krRRRRRrk......',
      'Wk.kRrRRRrRrk.....',
      'wk.kRkrRrkkrk.....',
      '.wkkRk.rr.krk.....',
      '..kk..kllk.kk.....',
      '.....kllllk.......',
      '....krk..krk......',
      '....krk..krk......',
      '...krrk..krrk.....',
      '...kkkk..kkkk.....',
    ],
  },
  {
    // skeleton warrior with a notched sword
    palette: { k: K, W: 0xf0e8d4, w: 0xb8b09a, s: 0x8a8a96, r: 0xff3020 },
    glow: 'r',
    rows: [
      '......kkkkk.......',
      '.....kWWWWWk......',
      '....kWWwwwWWk.....',
      '....kWkkWkkWk.....',
      '....kWkrWkrWk.....',
      '....kWWWkWWwk.....',
      '.....kWkWkWk......',
      '.....kwkwkwk......',
      '......kkkkk.......',
      '...kk..kWk..kk....',
      '..kWWkkWWWkkWWk...',
      '..kWk.kWkWk.kWk...',
      '.ksk.kWWWWWk.kWk..',
      'ksssk.kwkwk..kWk..',
      'kssk..kWWWk...kk..',
      'ksk....kWk........',
      'kk....kWkWk.......',
      '......kWkkWk......',
      '.....kWk..kWk.....',
      '.....kWk..kWk.....',
      '....kWWk..kWWk....',
      '....kkkk..kkkk....',
    ],
  },
  {
    // rotting zombie, arms reaching
    palette: { k: K, G: 0x9aaa76, g: 0x5a6a42, e: 0xd8ff40, C: 0x7a6848, c: 0x5a4a34, d: 0x2a2014, b: 0x7a1414 },
    glow: 'e',
    rows: [
      '......kkkkk.......',
      '.....kGGGGgk......',
      '....kGGgGGGgk.....',
      '....kGekGekgk.....',
      '....kGGGGGGgk.....',
      '....kGkbbbkgk.....',
      '.....kGkkkgk......',
      '......kgggk.......',
      'kkkkkkCCCCCkk.....',
      'GGgggkCCcCCCgk....',
      'kkkkkkCcCbCCgk....',
      '.....kCCCCcCk.....',
      '.....kCcCCCck.....',
      '.....kCCbCcCk.....',
      '.....kdccdcdk.....',
      '.....kgk.kgk......',
      '.....kGk..kgk.....',
      '....kGgk..kGgk....',
      '....kGgk..kGgk....',
      '....kgk...kGgk....',
      '...kGgk...kggk....',
      '...kkkk...kkkk....',
    ],
  },
  {
    // hellhound, a mane of fire down its back
    palette: { k: K, R: 0xb02a1a, r: 0x6a140c, d: 0x3a0806, E: 0xffd040, f: 0xff8030, F: 0xffd060, t: 0xf0f0e0 },
    glow: 'EfF',
    rows: [
      '......F...F...F.......',
      '.....fFf.fFf.fF.......',
      '.kk..ffffffffff.......',
      'kEkk.kffkffkfk....kk..',
      'kRRRkkRRRRRRRRkk.krk..',
      'ktRRrRRRRRRRRRRkkrk...',
      'kttkkRRrRRRRRRRRrk....',
      '.kk.krRRRRRRRRRrk.....',
      '....krrRRdddRRrrk.....',
      '....krk.kd..krk.krk...',
      '...krk...k...krk.krk..',
      '...krk.......krk..kk..',
      '..krrk......krrk......',
      '..kkkk......kkkk......',
    ],
  },
  {
    // winged demon, horned and clawed
    palette: { k: K, R: 0xc03848, r: 0x8a1828, d: 0x4a0a18, E: 0xffcc00, W: 0x7a4a8a, w: 0x5a2a6a, v: 0x2a0a3a, h: 0xd8c8a8, H: 0x8a7a5a, c: 0xe0e0d0 },
    glow: 'E',
    rows: [
      '.h..............h...',
      '.hh............hh...',
      '..Hh..kkkkkk..hH....',
      '...HhkRRRRRRkhH.....',
      '....kRRRRRRRRk......',
      '....kRkEkkEkRk......',
      '....krRRRRRRrk......',
      '.....krcccrrk.......',
      'kk....kkrrkk....kk..',
      'kWk..krRRRRrk..kWk..',
      'kWWkkRRRRRRRRkkWWk..',
      'kWwWkRRrRRrRRkWwWk..',
      'kWwwkRRRrrRRRkwwWk..',
      'kvwwvkRRRRRRkvwwvk..',
      '.kvwvkrRRRRrkvwvk...',
      '..kvvkdrRRrdkvvk....',
      '...kk.kdrrdk.kk.....',
      '......krRRrk........',
      '.....krRkkRrk.......',
      '.....krRk.kRrk......',
      '....krRk...kRrk.....',
      '....krk.....krk.....',
      '...kcck.....kcck....',
      '...kkkk.....kkkk....',
    ],
  },
  {
    // sand raider: turban, red sash, a long spear
    palette: { k: K, T: 0xf0e2c0, t: 0xb8a880, S: 0xc88858, s: 0x8a5430, c: 0xd8b888, C: 0xa88858, r: 0xc02828, W: 0xf0f4f8, w: 0xb8bcc4, h: 0x6a4a28 },
    rows: [
      '.......kkkk........',
      '......kTTTTk.......',
      '.....kTTttTTk......',
      '.....ktTTTTtk......',
      '.....kSkSSkSk......',
      '.....kSSSSSsk......',
      '......kSsssk.......',
      'W.....kkSSkk.......',
      'wW...kccccccck.....',
      '.wh.kcCccccCcck....',
      '..hkcCcrrrrrcck....',
      '...hScCcccccCSk....',
      '...kshCcccccCsk....',
      '....kkhcccccCk.....',
      '.....kcChcCcck.....',
      '.....kcCchCcck.....',
      '.....kcCk.hCck.....',
      '.....kSsk..kSsk....',
      '.....kSsk..kSsk....',
      '....kSsk...kSsk....',
      '....kccck..kccck...',
      '....kkkkk..kkkkk...',
    ],
  },
  {
    // lightning beetle, sparks along its shell
    palette: { k: K, B: 0x6aaaf0, b: 0x2a5a9a, v: 0x1a3060, y: 0xfff070, l: 0x1a2030, e: 0xff4040, m: 0xd0c8b0 },
    glow: 'ye',
    rows: [
      '........y...y.........',
      '.......kkkkkkkk.......',
      '.....kkBBBBBBBBkk.....',
      '....kBBbbbybbbbBBk....',
      '...kBbbbbbybbbbbbBk...',
      '.kkkbbbbbbybbbbbbbvk..',
      'kekbkbbbbbybbbbbbvvk..',
      'mkkbvvvvvvvvvvvvvvk...',
      'm.kkkkkkkkkkkkkkkk....',
      '..l.l.l..l.l..l.l.....',
      '.l.l.l..l.l..l.l......',
    ],
  },
  {
    // giant spider, a cluster of red eyes and a blood mark
    palette: { k: K, P: 0x6a4a6a, p: 0x3a2a3a, R: 0xb01818, r: 0xff3030, L: 0x5a3a5a },
    glow: 'r',
    rows: [
      '..k.........k.........',
      '.kLk...kk..kLk....k...',
      'kL.Lk.kPPk.kL.Lk.kLk..',
      'k...LkPPPPkL...LkL.Lk.',
      '.....kPPpPPk....kL..k.',
      '..kkkPPPPPPPkkkkL.....',
      'krrrkpPRPPPPPPPPPkk...',
      'krkrkpRRRpPPPPPPPPpk..',
      '.kkkkppRpppPPPPPPppk..',
      '..kLkkpppppppppppk....',
      '.kL.Lkkkkkkkkkkkk.....',
      'kL...Lk.kLk.kLk.Lk....',
      'k.....k.k.k.k.k..k....',
    ],
  },
  {
    // goatman: curled horns, shaggy fur, a hand axe
    palette: { k: K, h: 0xd8c8a8, H: 0x8a7a5a, F: 0xa8844e, f: 0x6a4a2a, d: 0x3a2414, r: 0xff4020, n: 0x2a1a10, A: 0xf0f4f8, a: 0xb0b8c4, t: 0x5a3a20 },
    glow: 'r',
    rows: [
      '..h.......h........',
      '.Hh.......hH.......',
      '.H.hkkkkkh.H.......',
      '....kFFFFFk........',
      '...kFrFFrFFk.......',
      '...kFFFFFFfk.......',
      '....kFnnFfk........',
      '....kfFFfk.........',
      '..kkkFFFFFkkk......',
      '.kFfkFFFFFkfFk.....',
      'kFfkFFfFFFFkfFk.aA.',
      'kfk.kFFFFFfk.kfkaAk',
      'kfk.kFfFFFFk..ktAk.',
      'kk..kdffdffk..kt...',
      '....kFk..kFk...t...',
      '....kFk..kFk.......',
      '...kFfk..kFfk......',
      '...kfk....kfk......',
      '..kfk.....kfk......',
      '..kdk.....kdk......',
      '.kddk....kddk......',
      '.kkkk....kkkk......',
    ],
  },
  {
    // yeti: white fur, cold blue eyes, black claws
    palette: { k: K, W: 0xf8fcff, w: 0xd0dce8, g: 0x8a98aa, b: 0x60c0ff, m: 0x3a2030, c: 0x5a6070 },
    glow: 'b',
    rows: [
      '.......kkkkk.........',
      '.....kkWWWWWkk.......',
      '....kWWWWWWWWwk......',
      '....kWbWWWbWWwk......',
      '....kWWWWWWWwwk......',
      '....kwWmmmmWwgk......',
      '.....kwkkkkwgk.......',
      '..kkkWWWWWWWwkkk.....',
      '.kWWWWWWWWWWWwwgk....',
      'kWWwkWWWWWWWWwkwgk...',
      'kWwk.kWWWWWWwwk.kwk..',
      'kWwk.kWWWWWWwgk.kwgk.',
      'kwgk.kwWWWWwwgk.kwgk.',
      'kcck.kwwWWwwggk..kcck',
      '.kk..kwwwwwwggk...kk.',
      '.....kwWWkkWwgk......',
      '.....kwWk..kWgk......',
      '....kwWWk..kWwgk.....',
      '....kwWk....kWgk.....',
      '....kwgk....kwgk.....',
      '...kccck....kccck....',
      '...kkkkk....kkkkk....',
    ],
  },
]

export const CORPSE: Sprite = {
  palette: { k: K, b: 0x6a0a0a, B: 0x3a0404, w: 0xb8b09a },
  rows: ['.....kwk..kwk..........', '...kwkkkwkkwkk.........', '..BbbbbwbbbbbbbB.......', '.BbbbbbbbbbbbbbbbB.....'],
}

/** A sprite drawn larger, nearest pixel. */
export const scaleSprite = (sprite: Sprite, by: number): Sprite => {
  if (by === 1) return sprite
  const height = Math.round(sprite.rows.length * by)
  const width = Math.round(Math.max(...sprite.rows.map(r => r.length)) * by)
  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    const src = sprite.rows[Math.min(sprite.rows.length - 1, Math.floor(y / by))] ?? ''
    let row = ''
    for (let x = 0; x < width; x++) row += src[Math.floor(x / by)] ?? '.'
    rows.push(row)
  }

  return { ...sprite, rows }
}

// ── The necromancer's servants, facing right toward the monsters ──────────
const GOLEM_ROWS = [
  '.....kkkkkk.........',
  '....kCCCCCck........',
  '....kCEcEccdk.......',
  '....kCcccccdk.......',
  '..kkkkCcccckkkk.....',
  '.kCCCkCCcccdkCCk....',
  'kCCcckCcRcccdkcCk...',
  'kCcck.kcRRccdkkcCk..',
  'kCck..kCcRccdk.kcCk.',
  'kcck..kCccccdk.kccdk',
  'kddk..kCccccdk..kddk',
  '.kk...kddddddk...kk.',
  '.....kCcck.kCcck....',
  '.....kCcdk.kCcdk....',
  '....kCccdk.kCccdk...',
  '....kddddk.kddddk...',
  '....kkkkkk.kkkkkk...',
]

export const minionSprite = (kind: MinionKind, monsterKind: number): Sprite => {
  const skeleton = flipSprite(MONSTERS[1]!)
  switch (kind) {
    case 'skeleton':
      return { ...skeleton, palette: { ...skeleton.palette, r: 0x80ff80 } }
    case 'mage':
      return { ...skeleton, palette: { ...skeleton.palette, W: 0xd8e4f8, w: 0x8aa0c8, s: 0x60c8ff, r: 0x80d0ff }, glow: 'rs' }
    case 'golem':
      return { palette: { k: K, C: 0xb08a5a, c: 0x8a6a42, d: 0x5a4228, E: 0xffd040, R: 0xffa040 }, glow: 'ER', rows: GOLEM_ROWS }
    case 'bloodgolem':
      return { palette: { k: K, C: 0xd02838, c: 0x9a1020, d: 0x5a0810, E: 0xffe0e0, R: 0xff6070 }, glow: 'ER', rows: GOLEM_ROWS }
    case 'revive': {
      const m = MONSTERS[monsterKind % MONSTERS.length]!

      return flipSprite(m)
    }
  }
}
