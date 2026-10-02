// People and animals: pedestrian, blind pedestrian with cane, cyclist,
// motorcycle rider, deer, flagger.
import type { G, Label } from './draw'
import { COLORS, INK, box, capsule, circle, darken, ellipse, fill, glow, lamp, lighten, line, ngon, poly, shadow, strokePoly } from './draw'

export interface WalkerOpts {
  shirt: number
  pants: number
  hair: number
  skin?: number
  blind?: boolean
}

/** Side-view walker facing right, feet at (fx, fy), about 120 px tall at scale 1. */
export function drawWalker(g: G, fx: number, fy: number, scale: number, o: WalkerOpts): void {
  const s = scale
  const skin = o.skin ?? COLORS.skin
  const hipY = fy - 50 * s
  const shoulderY = fy - 88 * s
  shadow(g, fx, fy + 2, 54 * s, 9 * s, 0.25)
  // Back arm + back leg (darker).
  capsule(g, fx - 2 * s, shoulderY + 6 * s, fx - 16 * s, fy - 60 * s, 4.5 * s, darken(o.shirt, 0.25))
  circle(g, fx - 16 * s, fy - 60 * s, 4.5 * s, darken(skin, 0.15), 2)
  capsule(g, fx, hipY, fx - 15 * s, fy - 6 * s, 6.5 * s, darken(o.pants, 0.25))
  ellipse(g, fx - 17 * s, fy - 3 * s, 16 * s, 8 * s, 0x1f2430, 2)
  // Torso.
  box(g, fx - 13 * s, shoulderY - 4 * s, 26 * s, 46 * s, o.shirt, 11 * s)
  fill(g, fx - 8 * s, shoulderY, 5 * s, 34 * s, lighten(o.shirt, 0.3), 2 * s, 0.8)
  // Front leg.
  capsule(g, fx, hipY, fx + 15 * s, fy - 6 * s, 6.5 * s, o.pants)
  ellipse(g, fx + 19 * s, fy - 3 * s, 16 * s, 8 * s, 0x1f2430, 2)
  // Front arm (forward swing; holds the cane when blind).
  const handX = fx + 16 * s
  const handY = fy - 58 * s
  capsule(g, fx + 2 * s, shoulderY + 6 * s, handX, handY, 4.5 * s, o.shirt)
  if (o.blind) {
    // White cane with red tip, sweeping ahead to the ground.
    const tipX = fx + 46 * s
    const tipY = fy
    const midX = handX + (tipX - handX) * 0.78
    const midY = handY + (tipY - handY) * 0.78
    capsule(g, handX, handY, midX, midY, 2.2 * s, 0xffffff, 2)
    capsule(g, midX, midY, tipX, tipY, 2.2 * s, COLORS.red, 2)
  }
  circle(g, handX, handY, 4.8 * s, skin, 2)
  // Head.
  const hx = fx + 2 * s
  const hy = fy - 104 * s
  circle(g, hx, hy, 12.5 * s, skin)
  g.fillStyle(o.hair, 1)
  g.fillEllipse(hx - 2 * s, hy - 7 * s, 26 * s, 14 * s, 24)
  g.fillCircle(hx - 9 * s, hy - 2 * s, 6 * s)
  if (o.blind) {
    fill(g, hx + 2 * s, hy - 3 * s, 12 * s, 6 * s, 0x0b0b10, 2 * s)
    line(g, hx - 6 * s, hy - 1 * s, hx + 3 * s, hy - 1 * s, 0x0b0b10, 2)
  } else {
    circle(g, hx + 6 * s, hy - 1 * s, 2 * s, INK, 0)
  }
  // Smile.
  g.lineStyle(2, INK, 1)
  g.beginPath()
  g.arc(hx + 6 * s, hy + 4 * s, 4 * s, 0.1, Math.PI * 0.6, false)
  g.strokePath()
}

// ---------------------------------------------------------------- crosswalk

/** Continental crosswalk bars across the bottom of the texture. */
export function crosswalkBars(g: G, w: number, y: number, h: number): void {
  const bars = 8
  const pitch = (w - 16) / bars
  const bw = pitch * 0.62
  for (let i = 0; i < bars; i++) {
    const x = 8 + i * pitch + (pitch - bw) / 2
    g.fillStyle(0x000000, 0.18)
    g.fillRect(x + 2, y + 2, bw, h)
    // Slight perspective: tops a touch narrower than bottoms.
    g.fillStyle(0xf8fafc, 1)
    g.fillPoints([{ x: x + 2, y }, { x: x + bw - 2, y }, { x: x + bw, y: y + h }, { x, y: y + h }], true, true)
  }
}

// ---------------------------------------------------------------- cyclist (rear)

export const CYCLIST_W = 96
export const CYCLIST_H = 144

export function drawCyclist(g: G): void {
  const cx = CYCLIST_W / 2
  const jersey = 0x0ea5e9
  shadow(g, cx, 138, 48, 10)
  // Rear wheel + fender.
  box(g, cx - 5, 92, 10, 48, COLORS.rubber, 5)
  box(g, cx - 8, 86, 16, 10, 0x334155, 4, 2)
  // Legs (one pedal down, one up).
  capsule(g, cx - 9, 70, cx - 15, 96, 6.5, 0x1e293b)
  capsule(g, cx - 15, 96, cx - 11, 120, 5, COLORS.skin)
  box(g, cx - 18, 118, 14, 8, 0x111827, 3, 2)
  capsule(g, cx + 9, 70, cx + 17, 88, 6.5, 0x1e293b)
  capsule(g, cx + 17, 88, cx + 12, 104, 5, COLORS.skin)
  box(g, cx + 5, 102, 14, 8, 0x111827, 3, 2)
  // Seat post light.
  lamp(g, cx, 82, 5, true, COLORS.redLit, COLORS.redDim, 2)
  // Arms out to the bar ends.
  line(g, 10, 52, CYCLIST_W - 10, 52, 0x1f2937, 4)
  capsule(g, cx - 14, 38, 14, 50, 5, jersey)
  capsule(g, cx + 14, 38, CYCLIST_W - 14, 50, 5, jersey)
  circle(g, 13, 52, 5, 0x111827, 2)
  circle(g, CYCLIST_W - 13, 52, 5, 0x111827, 2)
  // Back.
  box(g, cx - 19, 30, 38, 46, jersey, 14)
  fill(g, cx - 15, 56, 30, 5, 0xe0f2fe, 2, 0.95)
  fill(g, cx - 3, 34, 6, 36, darken(jersey, 0.25), 2)
  // Helmet.
  ellipse(g, cx, 22, 34, 24, 0xfacc15)
  g.lineStyle(2, darken(0xfacc15, 0.45), 1)
  for (const dx of [-8, 0, 8]) g.lineBetween(cx + dx, 13, cx + dx, 28)
  fill(g, cx - 10, 30, 20, 4, COLORS.skin, 2)
}

// ---------------------------------------------------------------- motorcycle (rear)

export const MOTO_W = 112
export const MOTO_H = 144

export function drawMotorcycle(g: G): void {
  const cx = MOTO_W / 2
  shadow(g, cx, 138, 70, 12)
  // Exhaust + tire + fender.
  capsule(g, cx + 12, 118, cx + 34, 108, 5, COLORS.chrome)
  box(g, cx - 11, 94, 22, 46, COLORS.rubber, 9)
  box(g, cx - 14, 84, 28, 16, 0x1f2937, 6)
  // Saddlebags.
  box(g, cx - 42, 70, 24, 32, 0x3f3f46, 7)
  box(g, cx + 18, 70, 24, 32, 0x3f3f46, 7)
  // Legs.
  capsule(g, cx - 14, 72, cx - 30, 98, 6.5, 0x1d4ed8)
  capsule(g, cx + 14, 72, cx + 30, 98, 6.5, 0x1d4ed8)
  box(g, cx - 38, 96, 15, 10, 0x111827, 3, 2)
  box(g, cx + 23, 96, 15, 10, 0x111827, 3, 2)
  // Lights + plate.
  lamp(g, cx, 90, 6, true, COLORS.redLit, COLORS.redDim, 2)
  lamp(g, cx - 22, 90, 3.5, true, COLORS.amberLit, COLORS.amberDim, 1.5)
  lamp(g, cx + 22, 90, 3.5, true, COLORS.amberLit, COLORS.amberDim, 1.5)
  box(g, cx - 10, 99, 20, 11, 0xf8fafc, 2, 2)
  // Bars, mirrors, arms.
  line(g, 8, 56, MOTO_W - 8, 56, 0x1f2937, 4)
  capsule(g, 14, 54, 10, 34, 2, 0x334155, 2)
  capsule(g, MOTO_W - 14, 54, MOTO_W - 10, 34, 2, 0x334155, 2)
  ellipse(g, 9, 30, 14, 10, 0x94a3b8, 2)
  ellipse(g, MOTO_W - 9, 30, 14, 10, 0x94a3b8, 2)
  capsule(g, cx - 16, 38, 16, 54, 6, 0x27272a)
  capsule(g, cx + 16, 38, MOTO_W - 16, 54, 6, 0x27272a)
  circle(g, 15, 56, 5.5, 0x111827, 2)
  circle(g, MOTO_W - 15, 56, 5.5, 0x111827, 2)
  // Jacket.
  box(g, cx - 22, 30, 44, 46, 0x27272a, 15)
  fill(g, cx - 16, 50, 32, 4, 0xf97316, 2)
  // Helmet.
  circle(g, cx, 22, 16, 0xdc2626)
  fill(g, cx - 3, 7, 6, 30, 0xf8fafc, 2, 0.95)
  g.fillStyle(0xffffff, 0.5)
  g.fillCircle(cx - 7, 15, 4)
}

// ---------------------------------------------------------------- deer (side)

export const DEER_W = 170
export const DEER_H = 144

export function drawDeer(g: G): void {
  const brown = 0x9a5b2a
  const far = darken(brown, 0.25)
  const antler = 0xe8d5b0
  shadow(g, 92, 138, 118, 10)
  // Far legs.
  capsule(g, 66, 88, 60, 130, 4.5, far)
  capsule(g, 118, 88, 126, 130, 4.5, far)
  // Tail flag up (white).
  poly(g, [128, 64, 146, 48, 150, 60, 136, 74], 0xffffff, 2.5)
  // Body.
  ellipse(g, 94, 78, 96, 48, brown)
  g.fillStyle(0xe8c9a0, 1)
  g.fillEllipse(96, 92, 64, 14, 24)
  // Near legs with hooves.
  capsule(g, 74, 92, 76, 130, 5, brown)
  capsule(g, 112, 92, 108, 130, 5, brown)
  for (const x of [60, 76, 108, 126]) box(g, x - 5, 128, 10, 7, 0x1f1a17, 2, 2)
  // Neck + head.
  capsule(g, 62, 72, 46, 46, 10, brown)
  ellipse(g, 38, 42, 36, 24, brown)
  ellipse(g, 22, 48, 18, 13, 0xc8955f, 2)
  circle(g, 14, 46, 3.5, 0x111111, 0)
  poly(g, [48, 32, 62, 20, 58, 38], brown, 2.5)
  // Antlers.
  for (const ox of [0, 8]) {
    capsule(g, 40 + ox, 30, 48 + ox, 12, 2.4, antler, 2)
    capsule(g, 48 + ox, 12, 62 + ox, 6, 2.4, antler, 2)
    capsule(g, 45 + ox, 20, 36 + ox, 10, 2.2, antler, 2)
    capsule(g, 55 + ox, 9, 54 + ox, 2, 2.2, antler, 2)
  }
  // Deer-in-headlights eye shine.
  glow(g, 32, 38, 3.5, 0xfffbe6, 1.2)
  circle(g, 32, 38, 3.6, 0xfffbe6, 1.5)
}

// ---------------------------------------------------------------- flagger

export const FLAGGER_W = 112
export const FLAGGER_H = 184

/** Work-zone flagger holding a STOP (octagon) or SLOW (diamond) paddle. */
export function drawFlagger(g: G, sign: 'stop' | 'slow'): void {
  const cx = 44
  const vest = 0xc6f432
  shadow(g, cx + 8, 178, 82, 10)
  // Legs + boots.
  box(g, cx - 15, 118, 13, 52, 0x1e40af, 4)
  box(g, cx + 2, 118, 13, 52, 0x1e40af, 4)
  box(g, cx - 18, 166, 17, 10, 0x3f2a1d, 3, 2)
  box(g, cx + 1, 166, 17, 10, 0x3f2a1d, 3, 2)
  // Paddle pole.
  capsule(g, 86, 50, 86, 170, 2.6, 0x9ca3af, 2)
  // Arms.
  capsule(g, cx - 16, 70, cx - 24, 104, 5.5, 0xf97316)
  circle(g, cx - 24, 106, 5.5, COLORS.skin, 2)
  // Torso with safety vest.
  box(g, cx - 19, 60, 38, 62, vest, 12)
  fill(g, cx - 16, 86, 32, 5, 0xe2e8f0, 1)
  fill(g, cx - 16, 102, 32, 5, 0xe2e8f0, 1)
  fill(g, cx - 10, 62, 5, 26, 0xe2e8f0, 1)
  fill(g, cx + 5, 62, 5, 26, 0xe2e8f0, 1)
  capsule(g, cx + 16, 70, 82, 96, 5.5, 0xf97316)
  circle(g, 85, 96, 6, COLORS.skin, 2)
  // Head + hard hat.
  circle(g, cx, 44, 13, COLORS.skin)
  circle(g, cx - 5, 44, 1.8, INK, 0)
  circle(g, cx + 5, 44, 1.8, INK, 0)
  g.lineStyle(2, INK, 1)
  g.beginPath()
  g.arc(cx, 48, 5, 0.25, Math.PI - 0.25, false)
  g.strokePath()
  poly(g, [cx - 16, 36, cx - 14, 26, cx - 6, 20, cx + 6, 20, cx + 14, 26, cx + 16, 36], 0xf97316, 2.5)
  box(g, cx - 20, 34, 40, 6, 0xf97316, 3, 2.5)
  // Paddle.
  const px = 86
  const py = 30
  if (sign === 'stop') {
    poly(g, ngon(px, py, 25, 8, Math.PI / 8), COLORS.red, 3)
    strokePoly(g, ngon(px, py, 21, 8, Math.PI / 8), 0xffffff, 2)
  } else {
    poly(g, [px, py - 26, px + 26, py, px, py + 26, px - 26, py], COLORS.orange, 3)
    strokePoly(g, [px, py - 21, px + 21, py, px, py + 21, px - 21, py], INK, 2)
  }
}

export function flaggerLabels(sign: 'stop' | 'slow'): Label[] {
  return sign === 'stop'
    ? [{ text: 'STOP', x: 86, y: 30.5, size: 12, color: '#ffffff', maxWidth: 36 }]
    : [{ text: 'SLOW', x: 86, y: 30.5, size: 10, color: '#15151f', maxWidth: 32 }]
}
