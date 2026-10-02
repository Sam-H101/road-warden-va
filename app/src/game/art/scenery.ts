// Roadside scenery: trees, bushes, poles, mailbox, buildings, billboards,
// rocks, fences. All stand on their bottom edge (setOrigin(0.5, 1)).
import type { G } from './draw'
import { COLORS, INK, box, circle, darken, fill, lighten, line, poly, shadow } from './draw'
import type { TexDef } from './props'

/** The blank billboard (not in sceneryKeys) for event sign images. */
export const BILLBOARD_KEY = 'scenery-billboard'
export const BILLBOARD_W = 260
export const BILLBOARD_H = 214
/** Inner white panel of BILLBOARD_KEY, in texture pixels (top-left origin). */
export const BILLBOARD_PANEL = { x: 18, y: 18, w: 224, h: 112 } as const

type Circle = readonly [number, number, number]

/** Cartoon foliage: one shared ink outline around a cluster of circles. */
function canopy(g: G, circles: readonly Circle[], color: number): void {
  g.fillStyle(INK, 1)
  for (const [x, y, r] of circles) g.fillCircle(x, y, r + 3)
  g.fillStyle(darken(color, 0.12), 1)
  for (const [x, y, r] of circles) g.fillCircle(x, y, r)
  g.fillStyle(color, 1)
  for (const [x, y, r] of circles) g.fillCircle(x - r * 0.12, y - r * 0.14, r * 0.84)
  g.fillStyle(lighten(color, 0.3), 1)
  for (const [x, y, r] of circles) g.fillCircle(x - r * 0.32, y - r * 0.34, r * 0.34)
}

function broadleaf(g: G, color: number): void {
  shadow(g, 85, 206, 120, 12)
  poly(g, [72, 206, 76, 120, 94, 120, 98, 206], COLORS.wood)
  poly(g, [64, 208, 76, 192, 94, 192, 106, 208], COLORS.wood, 0)
  line(g, 84, 140, 84, 196, darken(COLORS.wood, 0.3), 2)
  canopy(g, [[85, 112, 42], [44, 98, 38], [126, 98, 38], [60, 58, 38], [110, 56, 38], [85, 40, 34]], color)
}

function pine(g: G): void {
  const green = 0x15803d
  shadow(g, 60, 214, 90, 12)
  box(g, 52, 180, 16, 36, COLORS.wood, 3)
  const tiers: ReadonlyArray<readonly [number, number, number]> = [
    [126, 192, 54],
    [74, 140, 46],
    [8, 88, 36],
  ]
  for (const [top, bottom, half] of tiers) {
    poly(g, [60, top, 60 + half, bottom, 60 - half, bottom], green)
    g.fillStyle(lighten(green, 0.25), 1)
    g.fillPoints([{ x: 60, y: top + 8 }, { x: 60 - half + 12, y: bottom - 6 }, { x: 52, y: bottom - 6 }], true, true)
  }
}

function bush(g: G): void {
  shadow(g, 55, 62, 100, 8)
  canopy(g, [[30, 44, 22], [56, 36, 28], [82, 44, 22], [44, 48, 18], [70, 48, 18]], 0x22a447)
  for (const [x, y] of [[40, 32], [70, 30], [86, 44]] as const) circle(g, x, y, 3.5, 0xf43f5e, 1.5)
}

function utilityPole(g: G): void {
  shadow(g, 35, 256, 40, 8)
  box(g, 30, 10, 10, 248, 0x7c4a22, 2)
  box(g, 4, 26, 62, 7, 0x6b4423, 2)
  line(g, 14, 33, 30, 46, 0x6b4423, 3)
  line(g, 56, 33, 40, 46, 0x6b4423, 3)
  for (const x of [10, 24, 46, 60]) {
    box(g, x - 3, 16, 6, 10, 0x34d399, 2, 1.5)
  }
  // Wires run off both edges.
  g.lineStyle(1.5, INK, 0.9)
  g.lineBetween(0, 18, 10, 17)
  g.lineBetween(60, 17, 70, 18)
  box(g, 41, 62, 18, 28, COLORS.steel, 5, 2)
  fill(g, 44, 66, 4, 20, lighten(COLORS.steel, 0.4), 2)
}

function mailbox(g: G): void {
  shadow(g, 28, 84, 36, 6)
  box(g, 24, 40, 8, 46, COLORS.wood, 2)
  box(g, 6, 20, 44, 24, 0x1e3a8a, { tl: 12, tr: 12, bl: 2, br: 2 })
  fill(g, 10, 24, 30, 4, lighten(0x1e3a8a, 0.35), 2)
  box(g, 46, 6, 5, 22, COLORS.red, 1, 2)
  box(g, 46, 6, 12, 8, COLORS.red, 1, 2)
}

function house(g: G): void {
  const wall = 0xfde68a
  shadow(g, 120, 184, 220, 12)
  box(g, 150, 22, 18, 40, 0x9a3412, 2)
  box(g, 28, 84, 184, 98, wall, 4)
  poly(g, [14, 90, 120, 18, 226, 90], 0xb91c1c)
  fill(g, 30, 88, 180, 4, darken(wall, 0.25))
  // Door + windows.
  box(g, 104, 120, 32, 62, 0x1e40af, { tl: 14, tr: 14, bl: 0, br: 0 })
  circle(g, 129, 152, 2.5, COLORS.yellow, 1)
  for (const x of [46, 160]) {
    box(g, x, 110, 36, 34, 0x7dd3fc, 3)
    line(g, x + 18, 110, x + 18, 144, INK, 2)
    line(g, x, 127, x + 36, 127, INK, 2)
    box(g, x - 6, 108, 6, 38, 0x166534, 1, 2)
    box(g, x + 36, 108, 6, 38, 0x166534, 1, 2)
  }
  box(g, 96, 178, 48, 6, 0x9ca3af, 1, 2)
}

function barn(g: G): void {
  const red = 0xb91c1c
  shadow(g, 120, 204, 224, 12)
  box(g, 24, 90, 192, 112, red, 2)
  // Gambrel roof.
  poly(g, [16, 96, 42, 46, 120, 16, 198, 46, 224, 96], 0x374151)
  fill(g, 26, 92, 188, 4, darken(red, 0.3))
  // Big doors with white X trim.
  box(g, 80, 128, 80, 74, red, 0, 3)
  g.lineStyle(5, 0xffffff, 1)
  g.strokeRect(84, 132, 72, 66)
  g.lineBetween(84, 132, 120, 198)
  g.lineBetween(120, 132, 84, 198)
  g.lineBetween(120, 132, 156, 198)
  g.lineBetween(156, 132, 120, 198)
  g.lineBetween(120, 132, 120, 198)
  // Hay loft.
  box(g, 104, 70, 32, 30, 0xfbbf24, 2)
  g.lineStyle(4, 0xffffff, 1)
  g.strokeRect(104, 70, 32, 30)
}

function billboardFrame(g: G, panel: number): void {
  const P = BILLBOARD_PANEL
  shadow(g, 130, 210, 200, 10)
  box(g, 66, 128, 12, 84, 0x4b5563, 2)
  box(g, 182, 128, 12, 84, 0x4b5563, 2)
  line(g, 72, 150, 188, 190, 0x4b5563, 4)
  line(g, 188, 150, 72, 190, 0x4b5563, 4)
  box(g, 20, 136, 220, 8, 0x6b7280, 2, 2)
  box(g, P.x - 10, P.y - 10, P.w + 20, P.h + 20, 0x1f2937, 6)
  box(g, P.x, P.y, P.w, P.h, panel, 2, 2)
  // Lamps on the catwalk.
  for (const x of [70, 190]) {
    line(g, x, 136, x, 128, INK, 3)
    box(g, x - 9, 122, 18, 7, 0x374151, 3, 2)
  }
}

function rock(g: G): void {
  shadow(g, 50, 62, 92, 8)
  poly(g, [8, 60, 16, 30, 38, 12, 66, 14, 88, 34, 94, 60], 0x8a8f98)
  g.fillStyle(0xb7bcc5, 1)
  g.fillPoints([{ x: 20, y: 32 }, { x: 38, y: 16 }, { x: 52, y: 18 }, { x: 34, y: 40 }], true, true)
  g.fillStyle(0x6b7079, 1)
  g.fillPoints([{ x: 66, y: 18 }, { x: 86, y: 36 }, { x: 90, y: 57 }, { x: 64, y: 57 }], true, true)
}

/** White board fence, Virginia horse-country style. */
function fence(g: G): void {
  shadow(g, 90, 58, 176, 6, 0.2)
  for (const y of [14, 32]) box(g, 2, y, 176, 9, 0xf8fafc, 2, 2.5)
  for (const x of [8, 64, 120, 168]) box(g, x - 5, 6, 10, 52, 0xe5e7eb, 2, 2.5)
}

export function sceneryDefs(): TexDef[] {
  return [
    { key: 'scenery-oak', w: 170, h: 212, draw: (g) => broadleaf(g, 0x22a447) },
    { key: 'scenery-maple', w: 170, h: 212, draw: (g) => broadleaf(g, 0xf97316) },
    { key: 'scenery-pine', w: 120, h: 220, draw: pine },
    { key: 'scenery-bush', w: 110, h: 66, draw: bush },
    { key: 'scenery-pole', w: 70, h: 260, draw: utilityPole },
    { key: 'scenery-mailbox', w: 60, h: 88, draw: mailbox },
    { key: 'scenery-house', w: 240, h: 190, draw: house },
    { key: 'scenery-barn', w: 240, h: 210, draw: barn },
    {
      key: 'scenery-billboard-ad',
      w: BILLBOARD_W,
      h: BILLBOARD_H,
      draw: (g) => billboardFrame(g, 0x1e3a8a),
      labels: [
        { text: 'BUCKLE UP!', x: 130, y: 62, size: 30, color: '#fbbf24', stroke: '#15151f', strokeWidth: 5, maxWidth: 210 },
        { text: 'Every ride. Every seat.', x: 130, y: 100, size: 15, color: '#ffffff', weight: '700', maxWidth: 210 },
      ],
    },
    { key: BILLBOARD_KEY, w: BILLBOARD_W, h: BILLBOARD_H, draw: (g) => billboardFrame(g, 0xffffff) },
    { key: 'scenery-rock', w: 100, h: 64, draw: rock },
    { key: 'scenery-fence', w: 180, h: 62, draw: fence },
  ]
}

export const SCENERY_KEYS: readonly string[] = [
  'scenery-oak',
  'scenery-maple',
  'scenery-pine',
  'scenery-bush',
  'scenery-pole',
  'scenery-mailbox',
  'scenery-house',
  'scenery-barn',
  'scenery-billboard-ad',
  'scenery-rock',
  'scenery-fence',
]
