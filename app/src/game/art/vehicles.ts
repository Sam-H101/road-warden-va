// Vehicles: the player's car styles (rear view), ambient traffic, and the
// special vehicles used by scene props (police, ambulance, tow, trash, school
// bus, semi, tailgater, funeral procession).
import type { G, Label } from './draw'
import {
  COLORS,
  INK,
  box,
  circle,
  darken,
  ellipse,
  fill,
  glow,
  lamp,
  lighten,
  line,
  luminance,
  ngon,
  poly,
  shadow,
  stripes,
  strokePoly,
  EMOJI_FONT,
} from './draw'

export const CAR_W = 160
export const CAR_H = 112

export const CAR_STYLES = ['compact', 'sedan', 'hatch', 'pickup', 'muscle', 'interceptor', 'rally', 'hyper', 'legend'] as const
export type CarStyle = (typeof CAR_STYLES)[number]

export function isCarStyle(s: string): s is CarStyle {
  return (CAR_STYLES as readonly string[]).includes(s)
}

// ---------------------------------------------------------------- rear car

type TailKind = 'block' | 'tall' | 'bar' | 'round' | 'strip'

export interface RearSpec {
  /** texture size */
  w: number
  h: number
  bodyW: number
  beltY: number
  bottomY: number
  roofW: number
  roofY: number
  cabinW: number
  r: number
  tail: TailKind
  tireW: number
  bumper?: number
  /** pickup: small cab window instead of a full rear glass */
  smallWindow?: boolean
}

export interface RearGeom {
  cx: number
  left: number
  right: number
  winCx: number
  winCy: number
  plateY: number
}

export function rearGeom(s: RearSpec): RearGeom {
  const cx = s.w / 2
  const top = s.roofY + 6
  const bottom = s.beltY - 1
  return {
    cx,
    left: cx - s.bodyW / 2,
    right: cx + s.bodyW / 2,
    winCx: cx,
    winCy: s.smallWindow ? s.roofY + 6 + (s.beltY - s.roofY - 12) / 2 : (top + bottom) / 2,
    plateY: s.bottomY - 20,
  }
}

interface RearHooks {
  /** after body and glass, before lights/bumper (stripes, liveries) */
  afterBody?: (geo: RearGeom) => void
  /** after everything (wings, light bars, antennas) */
  after?: (geo: RearGeom) => void
  /** draw the sticker disc for a decal */
  decal?: boolean
}

export function drawRearCar(g: G, s: RearSpec, paint: number, hooks: RearHooks = {}): RearGeom {
  const geo = rearGeom(s)
  const { cx, left } = geo
  const bumper = s.bumper ?? 0x2a2e38
  const panelHi = lighten(paint, 0.35)
  const panelLo = darken(paint, 0.22)

  shadow(g, cx, s.bottomY + 5, s.bodyW + 18, 16)

  // Tires peek out under the body.
  box(g, left + 5, s.bottomY - 20, s.tireW, 27, COLORS.rubber, 5)
  box(g, geo.right - 5 - s.tireW, s.bottomY - 20, s.tireW, 27, COLORS.rubber, 5)

  // Side mirrors.
  const mirrorY = s.beltY - 15
  box(g, cx - s.cabinW / 2 - 9, mirrorY, 14, 10, paint, 3, 2)
  box(g, cx + s.cabinW / 2 - 5, mirrorY, 14, 10, paint, 3, 2)

  // Greenhouse (cabin).
  poly(g, [cx - s.cabinW / 2, s.beltY + 4, cx - s.roofW / 2, s.roofY, cx + s.roofW / 2, s.roofY, cx + s.cabinW / 2, s.beltY + 4], paint)
  g.fillStyle(panelHi, 0.6)
  g.fillRect(cx - s.roofW / 2 + 4, s.roofY + 2, s.roofW - 8, 3)

  // Rear glass.
  if (s.smallWindow) {
    const ww = s.roofW - 34
    box(g, cx - ww / 2, s.roofY + 7, ww, s.beltY - s.roofY - 14, COLORS.glass, 5, 2)
    g.fillStyle(COLORS.glassHi, 0.55)
    g.fillRect(cx - ww / 2 + 6, s.roofY + 10, 10, s.beltY - s.roofY - 20)
  } else {
    const wTop = s.roofY + 6
    const wBot = s.beltY - 1
    const t = (wBot - wTop) / Math.max(1, s.beltY + 4 - s.roofY)
    const halfBot = s.cabinW / 2 - 9
    const halfTop = s.roofW / 2 - 7
    const halfBotAdj = halfTop + (halfBot - halfTop) * Math.min(1, t + 0.05)
    poly(g, [cx - halfBotAdj, wBot, cx - halfTop, wTop, cx + halfTop, wTop, cx + halfBotAdj, wBot], COLORS.glass, 2)
    // Specular streak.
    g.fillStyle(COLORS.glassHi, 0.55)
    g.fillPoints(
      [
        { x: cx - halfTop + 10, y: wTop + 2 },
        { x: cx - halfTop + 24, y: wTop + 2 },
        { x: cx - halfBotAdj + 22, y: wBot - 2 },
        { x: cx - halfBotAdj + 8, y: wBot - 2 },
      ],
      true,
      true,
    )
    // High-mount brake light.
    fill(g, cx - 10, wTop + 2, 20, 3, COLORS.red, 1)
  }

  // Rear fascia.
  box(g, left, s.beltY, s.bodyW, s.bottomY - s.beltY, paint, s.r)
  fill(g, left + 7, s.beltY + 3, s.bodyW - 14, 4, panelHi, 2, 0.85)
  fill(g, left + 4, s.bottomY - 21, s.bodyW - 8, 6, panelLo, 2, 0.9)

  hooks.afterBody?.(geo)

  // Bumper.
  const br = Math.min(10, s.r * 0.7)
  box(g, left + 2, s.bottomY - 15, s.bodyW - 4, 15, bumper, { tl: 3, tr: 3, bl: br, br: br })
  fill(g, left + 8, s.bottomY - 12, s.bodyW - 16, 2, lighten(bumper, 0.3), 1, 0.7)

  tailLights(g, s, geo)

  // License plate.
  box(g, cx - 17, geo.plateY - 7, 34, 14, 0xf8fafc, 2, 2)

  if (hooks.decal) {
    circle(g, geo.winCx, geo.winCy, 13, 0xffffff, 2)
  }

  hooks.after?.(geo)
  return geo
}

function tailLights(g: G, s: RearSpec, geo: RearGeom): void {
  const { left, right } = geo
  const ty = s.beltY + 7
  const hi = 0xfecaca
  switch (s.tail) {
    case 'block': {
      for (const x of [left + 6, right - 6 - 32]) {
        box(g, x, ty, 32, 13, COLORS.red, 3, 2)
        fill(g, x + 3, ty + 3, 26, 3, hi, 1, 0.9)
        fill(g, x + (x < geo.cx ? 24 : 2), ty + 7, 6, 4, COLORS.amber, 1)
      }
      break
    }
    case 'tall': {
      for (const x of [left + 3, right - 3 - 15]) {
        box(g, x, s.beltY + 3, 15, 27, COLORS.red, 4, 2)
        fill(g, x + 3, s.beltY + 6, 4, 18, hi, 1, 0.85)
        fill(g, x + 3, s.beltY + 23, 9, 4, COLORS.amber, 1)
      }
      break
    }
    case 'bar': {
      const w = s.bodyW - 18
      box(g, left + 9, ty, w, 12, COLORS.red, 4, 2)
      g.lineStyle(2, darken(COLORS.red, 0.5), 1)
      for (let x = left + 9 + 18; x < left + 9 + w - 6; x += 18) g.lineBetween(x, ty + 2, x, ty + 10)
      fill(g, left + 12, ty + 2, w - 6, 3, hi, 1, 0.8)
      break
    }
    case 'round': {
      for (const x of [left + 15, left + 33, right - 33, right - 15]) {
        lamp(g, x, ty + 7, 7, true, COLORS.redLit, COLORS.redDim)
      }
      break
    }
    case 'strip': {
      g.fillStyle(COLORS.redLit, 0.25)
      g.fillRoundedRect(left + 4, ty - 2, s.bodyW - 8, 12, 5)
      box(g, left + 7, ty + 1, s.bodyW - 14, 6, COLORS.redLit, 3, 2)
      fill(g, left + 10, ty + 2, s.bodyW - 20, 2, 0xffe4e4, 1, 0.9)
      break
    }
  }
}

// ---------------------------------------------------------------- player styles

function base(over: Partial<RearSpec>): RearSpec {
  return {
    w: CAR_W,
    h: CAR_H,
    bodyW: 136,
    beltY: 54,
    bottomY: 100,
    roofW: 96,
    roofY: 16,
    cabinW: 124,
    r: 12,
    tail: 'block',
    tireW: 24,
    ...over,
  }
}

export const STYLE_SPECS: Record<CarStyle, RearSpec> = {
  compact: base({ bodyW: 128, beltY: 52, roofW: 94, roofY: 14, cabinW: 118, r: 18, tail: 'tall', tireW: 22 }),
  sedan: base({ bodyW: 142, beltY: 56, roofW: 94, roofY: 20, cabinW: 124, r: 10, tail: 'block', tireW: 22 }),
  hatch: base({ bodyW: 136, beltY: 54, roofW: 104, roofY: 16, cabinW: 126, r: 12, tail: 'block', tireW: 24 }),
  pickup: base({ bodyW: 146, beltY: 46, bottomY: 98, roofW: 112, roofY: 10, cabinW: 124, r: 6, tail: 'tall', tireW: 28, bumper: COLORS.chrome, smallWindow: true }),
  muscle: base({ bodyW: 152, beltY: 58, roofW: 88, roofY: 24, cabinW: 116, r: 8, tail: 'bar', tireW: 28 }),
  interceptor: base({ bodyW: 144, beltY: 56, roofW: 96, roofY: 20, cabinW: 124, r: 10, tail: 'strip', tireW: 24, bumper: 0x1b1f27 }),
  rally: base({ bodyW: 138, beltY: 54, roofW: 100, roofY: 20, cabinW: 126, r: 10, tail: 'block', tireW: 26 }),
  hyper: base({ bodyW: 154, beltY: 62, roofW: 74, roofY: 32, cabinW: 104, r: 18, tail: 'strip', tireW: 30, bumper: 0x1b1f27 }),
  legend: base({ bodyW: 146, beltY: 56, roofW: 86, roofY: 22, cabinW: 112, r: 20, tail: 'round', tireW: 24, bumper: COLORS.chrome }),
}

function contrastStripe(paint: number): number {
  return luminance(paint) > 0.62 ? 0x1e293b : 0xf8fafc
}

/** Stripe over the roof edge and down the trunk, skipping the rear glass. */
function racingStripe(g: G, x: number, s: RearSpec, color: number): void {
  g.fillStyle(color, 1)
  g.fillRect(x, s.roofY + 2, 10, 4)
  g.fillRect(x, s.beltY + 2, 10, s.bottomY - 16 - s.beltY - 2)
}

export function drawPlayerCar(g: G, style: CarStyle, paint: number, withDecal: boolean): void {
  const s = STYLE_SPECS[style]
  const stripe = contrastStripe(paint)
  const hooks: RearHooks = { decal: withDecal }
  switch (style) {
    case 'compact':
      hooks.after = (geo) => {
        // Cute roof rails.
        fill(g, geo.cx - s.roofW / 2 + 6, s.roofY - 4, s.roofW - 12, 4, 0x334155, 2)
      }
      break
    case 'sedan':
      hooks.afterBody = (geo) => {
        fill(g, geo.left + 40, s.beltY + 12, s.bodyW - 80, 4, COLORS.chrome, 2)
      }
      break
    case 'hatch':
      hooks.after = (geo) => {
        box(g, geo.cx - s.roofW / 2 - 5, s.roofY - 7, s.roofW + 10, 9, darken(paint, 0.35), 4, 2)
        circle(g, geo.cx - 7, s.bottomY - 2, 4, COLORS.chrome, 2)
        circle(g, geo.cx + 7, s.bottomY - 2, 4, COLORS.chrome, 2)
      }
      break
    case 'pickup':
      hooks.afterBody = (geo) => {
        fill(g, geo.left + 3, s.beltY + 1, s.bodyW - 6, 5, darken(paint, 0.35), 2)
        line(g, geo.left + 22, s.beltY + 34, geo.right - 22, s.beltY + 34, darken(paint, 0.3), 2)
        box(g, geo.cx - 12, s.beltY + 10, 24, 7, darken(paint, 0.4), 3, 2)
      }
      hooks.after = (geo) => {
        // Bed rails behind the cab.
        fill(g, geo.left + 8, s.beltY - 4, 8, 6, darken(paint, 0.3), 1)
        fill(g, geo.right - 16, s.beltY - 4, 8, 6, darken(paint, 0.3), 1)
      }
      break
    case 'muscle':
      hooks.afterBody = (geo) => {
        for (const dx of [-14, 4]) racingStripe(g, geo.cx + dx, s, stripe)
        // Ducktail lip.
        fill(g, geo.left + 8, s.beltY - 2, s.bodyW - 16, 5, darken(paint, 0.35), 2)
      }
      hooks.after = (geo) => {
        box(g, geo.left + 16, s.bottomY - 5, 14, 8, COLORS.chrome, 3, 2)
        box(g, geo.left + 32, s.bottomY - 5, 14, 8, COLORS.chrome, 3, 2)
        box(g, geo.right - 30, s.bottomY - 5, 14, 8, COLORS.chrome, 3, 2)
        box(g, geo.right - 46, s.bottomY - 5, 14, 8, COLORS.chrome, 3, 2)
      }
      break
    case 'interceptor':
      hooks.afterBody = (geo) => {
        fill(g, geo.left + 3, s.beltY + 22, s.bodyW - 6, s.bottomY - s.beltY - 36, 0x1f2430, 2)
      }
      hooks.after = (geo) => {
        // Hidden light strip in the rear glass + antenna.
        glow(g, geo.cx - 13, s.roofY + 10, 6, COLORS.redLit, 0.7)
        glow(g, geo.cx + 13, s.roofY + 10, 6, COLORS.blueLit, 0.7)
        box(g, geo.cx - 26, s.roofY + 7, 25, 6, COLORS.redLit, 2, 1.5)
        box(g, geo.cx + 1, s.roofY + 7, 25, 6, COLORS.blueLit, 2, 1.5)
        line(g, geo.cx + s.roofW / 2 - 10, s.roofY, geo.cx + s.roofW / 2 - 2, s.roofY - 16, INK, 2)
        fill(g, geo.cx - s.roofW / 2 - 2, s.beltY - 3, s.roofW + 4, 4, darken(paint, 0.4), 2)
      }
      break
    case 'rally':
      hooks.afterBody = (geo) => {
        g.fillStyle(stripe, 0.95)
        g.fillPoints(
          [
            { x: geo.left + 30, y: s.beltY + 2 },
            { x: geo.left + 54, y: s.beltY + 2 },
            { x: geo.left + 34, y: s.bottomY - 16 },
            { x: geo.left + 10, y: s.bottomY - 16 },
          ],
          true,
          true,
        )
      }
      hooks.after = (geo) => {
        // Mud flaps, roof scoop, big wing.
        box(g, geo.left + 4, s.bottomY - 2, s.tireW + 2, 10, COLORS.red, 2, 2)
        box(g, geo.right - 6 - s.tireW, s.bottomY - 2, s.tireW + 2, 10, COLORS.red, 2, 2)
        line(g, geo.cx - 34, s.roofY - 2, geo.cx - 30, s.roofY - 10, INK, 4)
        line(g, geo.cx + 34, s.roofY - 2, geo.cx + 30, s.roofY - 10, INK, 4)
        box(g, geo.cx - 64, s.roofY - 17, 128, 9, darken(paint, 0.45), 3, 2)
        box(g, geo.cx - 68, s.roofY - 21, 8, 16, darken(paint, 0.55), 2, 2)
        box(g, geo.cx + 60, s.roofY - 21, 8, 16, darken(paint, 0.55), 2, 2)
      }
      break
    case 'hyper':
      hooks.afterBody = (geo) => {
        // Engine vents.
        g.lineStyle(2, darken(paint, 0.45), 1)
        for (let i = 0; i < 5; i++) {
          const y = s.beltY + 18 + i * 4
          g.lineBetween(geo.cx - 22, y, geo.cx + 22, y)
        }
      }
      hooks.after = (geo) => {
        // Diffuser fins and quad exhaust.
        g.lineStyle(3, 0x0b0d12, 1)
        for (let x = geo.left + 22; x < geo.right - 18; x += 14) g.lineBetween(x, s.bottomY - 13, x, s.bottomY)
        for (const dx of [-15, -5, 5, 15]) circle(g, geo.cx + dx, s.bottomY - 5, 4, COLORS.chrome, 2)
        // Swan-neck wing.
        line(g, geo.cx - 32, s.beltY + 2, geo.cx - 30, s.roofY - 12, INK, 5)
        line(g, geo.cx + 32, s.beltY + 2, geo.cx + 30, s.roofY - 12, INK, 5)
        box(g, geo.cx - 76, s.roofY - 22, 152, 10, darken(paint, 0.5), 4, 2)
        fill(g, geo.cx - 70, s.roofY - 20, 140, 2, lighten(paint, 0.3), 1)
      }
      break
    case 'legend':
      hooks.afterBody = (geo) => {
        for (const dx of [-13, 3]) racingStripe(g, geo.cx + dx, s, stripe)
        fill(g, geo.left + 6, s.beltY + 24, s.bodyW - 12, 3, COLORS.chrome, 1)
      }
      hooks.after = (geo) => {
        // Little tail fins.
        poly(g, [geo.left + 2, s.beltY + 4, geo.left + 8, s.beltY - 8, geo.left + 18, s.beltY + 2], darken(paint, 0.1), 2)
        poly(g, [geo.right - 2, s.beltY + 4, geo.right - 8, s.beltY - 8, geo.right - 18, s.beltY + 2], darken(paint, 0.1), 2)
        circle(g, geo.left + 26, s.bottomY - 3, 4, COLORS.chrome, 2)
        circle(g, geo.right - 26, s.bottomY - 3, 4, COLORS.chrome, 2)
      }
      break
  }
  drawRearCar(g, s, paint, hooks)
}

export function playerCarLabels(style: CarStyle, decal: string): Label[] {
  const geo = rearGeom(STYLE_SPECS[style])
  const out: Label[] = [{ text: 'VA', x: geo.cx, y: geo.plateY + 0.5, size: 9, color: '#1e3a8a', weight: '900' }]
  if (decal) out.push({ text: decal, x: geo.winCx, y: geo.winCy + 1, size: 18, font: EMOJI_FONT, weight: '400' })
  return out
}

// ---------------------------------------------------------------- ambient traffic

export interface VehicleDef {
  key: string
  w: number
  h: number
  draw: (g: G) => void
  labels?: Label[]
}

const SUV: RearSpec = { w: 160, h: 120, bodyW: 146, beltY: 60, bottomY: 108, roofW: 122, roofY: 10, cabinW: 134, r: 8, tail: 'tall', tireW: 26 }
const VAN: RearSpec = { w: 160, h: 120, bodyW: 142, beltY: 62, bottomY: 108, roofW: 118, roofY: 12, cabinW: 128, r: 14, tail: 'tall', tireW: 24 }

function plateLabel(spec: RearSpec): Label {
  const geo = rearGeom(spec)
  return { text: 'VA', x: geo.cx, y: geo.plateY + 0.5, size: 9, color: '#1e3a8a' }
}

export function trafficDefs(): VehicleDef[] {
  const cars: Array<[string, RearSpec, number]> = [
    ['traffic-sedan-red', STYLE_SPECS.sedan, 0xdc2626],
    ['traffic-hatch-blue', STYLE_SPECS.hatch, 0x2563eb],
    ['traffic-suv-white', SUV, 0xeef2f7],
    ['traffic-pickup-green', STYLE_SPECS.pickup, 0x15803d],
    ['traffic-compact-yellow', STYLE_SPECS.compact, 0xfacc15],
    ['traffic-van-silver', VAN, 0x9ca3af],
  ]
  const defs: VehicleDef[] = cars.map(([key, spec, paint]) => ({
    key,
    w: spec.w,
    h: spec.h,
    draw: (g: G) => {
      drawRearCar(g, spec, paint, spec === STYLE_SPECS.pickup ? {
        afterBody: (geo) => {
          fill(g, geo.left + 3, spec.beltY + 1, spec.bodyW - 6, 5, darken(paint, 0.35), 2)
          box(g, geo.cx - 12, spec.beltY + 10, 24, 7, darken(paint, 0.4), 3, 2)
        },
      } : {})
    },
    labels: [plateLabel(spec)],
  }))
  defs.push({ key: 'traffic-mail-truck', w: 150, h: 150, draw: drawMailTruck, labels: [{ text: 'MAIL', x: 75, y: 50, size: 14, color: '#1d4ed8', stroke: '#ffffff', strokeWidth: 3 }] })
  return defs
}

function drawMailTruck(g: G): void {
  const cx = 75
  shadow(g, cx, 142, 140, 14)
  box(g, cx - 60, 122, 24, 24, COLORS.rubber, 5)
  box(g, cx + 36, 122, 24, 24, COLORS.rubber, 5)
  box(g, cx - 64, 10, 128, 124, 0xf8fafc, 10)
  // Red / blue stripe bands.
  fill(g, cx - 61, 30, 122, 6, 0xdc2626)
  fill(g, cx - 61, 36, 122, 6, 0x1d4ed8)
  // Roll-up door.
  box(g, cx - 40, 62, 80, 64, 0xe2e8f0, 4, 2)
  g.lineStyle(2, 0x94a3b8, 1)
  for (let y = 72; y < 124; y += 9) g.lineBetween(cx - 36, y, cx + 36, y)
  box(g, cx - 8, 112, 16, 6, 0x64748b, 2, 2)
  // Lights.
  box(g, cx - 60, 76, 12, 30, COLORS.red, 4, 2)
  box(g, cx + 48, 76, 12, 30, COLORS.red, 4, 2)
  box(g, cx - 66, 124, 132, 12, 0x2a2e38, 4)
}

// ---------------------------------------------------------------- light bar

/**
 * Segmented emergency light bar. `phase` swaps which half is lit so two
 * textures (key and key + '-b') make a flash animation.
 */
export function lightBar(g: G, cx: number, y: number, w: number, h: number, colors: readonly number[], phase: 0 | 1): void {
  const n = colors.length
  const segW = (w - 8) / n
  const litAt = (i: number) => (phase === 0 ? i < n / 2 : i >= n / 2)
  for (let i = 0; i < n; i++) if (litAt(i)) glow(g, cx - w / 2 + 4 + segW * (i + 0.5), y + h / 2, h * 0.9, colors[i], 1)
  box(g, cx - w / 2, y, w, h, 0x1f2430, Math.min(6, h / 2))
  for (let i = 0; i < n; i++) {
    const lit = litAt(i)
    const x = cx - w / 2 + 4 + segW * i
    fill(g, x + 1, y + 3, segW - 2, h - 6, lit ? colors[i] : darken(colors[i], 0.65), 3)
    if (lit) fill(g, x + 3, y + 4, segW - 8, 2, 0xffffff, 1, 0.7)
  }
}

// ---------------------------------------------------------------- police car

export const POLICE_W = 180
export const POLICE_H = 140
const POLICE: RearSpec = { w: POLICE_W, h: POLICE_H, bodyW: 152, beltY: 82, bottomY: 128, roofW: 100, roofY: 46, cabinW: 130, r: 10, tail: 'block', tireW: 24, bumper: 0x1b1f27 }

export function drawPolice(g: G, phase: 0 | 1): void {
  drawRearCar(g, POLICE, 0xf1f5f9, {
    afterBody: (geo) => {
      fill(g, geo.left + 3, POLICE.beltY + 24, POLICE.bodyW - 6, POLICE.bottomY - POLICE.beltY - 38, 0x1f2937, 2)
    },
    after: (geo) => {
      line(g, geo.cx + 40, POLICE.roofY, geo.cx + 46, POLICE.roofY - 26, INK, 2)
      lightBar(g, geo.cx, POLICE.roofY - 16, 120, 16, [COLORS.redLit, COLORS.redLit, COLORS.redLit, COLORS.blueLit, COLORS.blueLit, COLORS.blueLit], phase)
    },
  })
}

export function policeLabels(): Label[] {
  const geo = rearGeom(POLICE)
  return [
    { text: 'POLICE', x: geo.cx, y: POLICE.beltY + 14, size: 12, color: '#1e3a8a' },
    { text: 'VA', x: geo.cx, y: geo.plateY + 0.5, size: 9, color: '#1e3a8a' },
  ]
}

// ---------------------------------------------------------------- ambulance

export const AMBULANCE_W = 180
export const AMBULANCE_H = 176

export function drawAmbulance(g: G, phase: 0 | 1): void {
  const cx = AMBULANCE_W / 2
  shadow(g, cx, 166, 168, 16)
  box(g, cx - 68, 146, 28, 26, COLORS.rubber, 5)
  box(g, cx + 40, 146, 28, 26, COLORS.rubber, 5)
  // Box body.
  box(g, cx - 76, 22, 152, 132, 0xf8fafc, 10)
  fill(g, cx - 73, 106, 146, 13, COLORS.red)
  fill(g, cx - 73, 119, 146, 4, 0xf97316)
  // Split rear doors with windows.
  line(g, cx, 26, cx, 146, INK, 2)
  box(g, cx - 62, 36, 50, 30, COLORS.glass, 5, 2)
  box(g, cx + 12, 36, 50, 30, COLORS.glass, 5, 2)
  fill(g, cx - 58, 39, 10, 24, COLORS.glassHi, 2, 0.5)
  fill(g, cx + 16, 39, 10, 24, COLORS.glassHi, 2, 0.5)
  box(g, cx - 12, 92, 8, 5, 0x94a3b8, 2, 1.5)
  box(g, cx + 4, 92, 8, 5, 0x94a3b8, 2, 1.5)
  // Star of life (blue) on the left door.
  starOfLife(g, cx - 38, 86, 12)
  starOfLife(g, cx + 38, 86, 12)
  // Corner flashers.
  lamp(g, cx - 66, 30, 6, phase === 0, COLORS.redLit, COLORS.redDim)
  lamp(g, cx + 66, 30, 6, phase === 1, COLORS.blueLit, COLORS.blueDim)
  // Tail lights + bumper.
  box(g, cx - 74, 126, 12, 24, COLORS.red, 3, 2)
  box(g, cx + 62, 126, 12, 24, COLORS.red, 3, 2)
  box(g, cx - 80, 146, 160, 12, 0x374151, 4)
  lightBar(g, cx, 6, 128, 15, [COLORS.redLit, COLORS.redLit, 0xffffff, COLORS.blueLit, COLORS.blueLit, 0xffffff], phase)
}

function starOfLife(g: G, cx: number, cy: number, r: number): void {
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3
    const c = Math.cos(a)
    const s = Math.sin(a)
    const hw = r * 0.32
    const pts = [
      cx + c * r - s * hw, cy + s * r + c * hw,
      cx + c * r + s * hw, cy + s * r - c * hw,
      cx - c * r + s * hw, cy - s * r - c * hw,
      cx - c * r - s * hw, cy - s * r + c * hw,
    ]
    poly(g, pts, 0x2563eb, 2)
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3
    const c = Math.cos(a)
    const s = Math.sin(a)
    const hw = r * 0.32 - 1
    g.fillStyle(0x2563eb, 1)
    g.fillPoints(
      [
        { x: cx + c * (r - 1) - s * hw, y: cy + s * (r - 1) + c * hw },
        { x: cx + c * (r - 1) + s * hw, y: cy + s * (r - 1) - c * hw },
        { x: cx - c * (r - 1) + s * hw, y: cy - s * (r - 1) - c * hw },
        { x: cx - c * (r - 1) - s * hw, y: cy - s * (r - 1) + c * hw },
      ],
      true,
      true,
    )
  }
  line(g, cx, cy - r * 0.7, cx, cy + r * 0.7, 0xffffff, 2)
}

export function ambulanceLabels(): Label[] {
  return [{ text: 'AMBULANCE', x: AMBULANCE_W / 2, y: 113, size: 12, color: '#ffffff', stroke: '#7f1d1d', strokeWidth: 3, maxWidth: 136 }]
}

// ---------------------------------------------------------------- tow truck

export const TOW_W = 200
export const TOW_H = 176

export function drawTowTruck(g: G, phase: 0 | 1): void {
  const cx = TOW_W / 2
  const body = 0xdc2626
  shadow(g, cx, 168, 188, 16)
  // Dual rear tires.
  box(g, cx - 88, 136, 34, 34, COLORS.rubber, 6)
  box(g, cx + 54, 136, 34, 34, COLORS.rubber, 6)
  // Cab.
  box(g, cx - 58, 26, 116, 56, body, 10)
  box(g, cx - 44, 36, 88, 26, COLORS.glass, 5, 2)
  fill(g, cx - 38, 39, 10, 20, COLORS.glassHi, 2, 0.5)
  // Amber light bar.
  lightBar(g, cx, 10, 104, 15, [COLORS.amberLit, COLORS.amberLit, COLORS.amberLit, COLORS.amberLit], phase)
  // Body with tool boxes.
  box(g, cx - 90, 78, 180, 66, darken(body, 0.12), 8)
  for (const x of [cx - 84, cx + 30]) {
    box(g, x, 86, 54, 46, COLORS.steel, 5, 2)
    g.lineStyle(1.5, lighten(COLORS.steel, 0.45), 1)
    for (let i = 0; i < 4; i++) g.lineBetween(x + 6 + i * 12, 92, x + 14 + i * 12, 126)
    box(g, x + 20, 104, 14, 5, 0x334155, 2, 1.5)
  }
  // Boom, cable and hook.
  box(g, cx - 11, 30, 22, 116, COLORS.yellow, 4)
  fill(g, cx - 7, 34, 4, 106, lighten(COLORS.yellow, 0.4), 2)
  line(g, cx, 40, cx, 112, INK, 3)
  g.lineStyle(4, 0x334155, 1)
  g.beginPath()
  g.arc(cx + 6, 118, 7, Math.PI * 0.95, Math.PI * 0.05, true)
  g.strokePath()
  // Wheel-lift crossbar.
  box(g, cx - 66, 146, 132, 10, COLORS.yellow, 3)
  box(g, cx - 72, 140, 12, 20, COLORS.yellow, 3, 2)
  box(g, cx + 60, 140, 12, 20, COLORS.yellow, 3, 2)
  // Tail lights.
  lamp(g, cx - 82, 82, 5, true, COLORS.redLit, COLORS.redDim)
  lamp(g, cx + 82, 82, 5, true, COLORS.redLit, COLORS.redDim)
}

export function towLabels(): Label[] {
  return [{ text: 'TOW', x: TOW_W / 2 - 57, y: 72, size: 13, color: '#ffffff', stroke: '#15151f', strokeWidth: 3 }]
}

// ---------------------------------------------------------------- trash truck

export const TRASH_W = 210
export const TRASH_H = 204

export function drawTrashTruck(g: G, phase: 0 | 1): void {
  const cx = TRASH_W / 2
  const body = 0x16a34a
  shadow(g, cx, 196, 196, 16)
  box(g, cx - 92, 166, 36, 32, COLORS.rubber, 6)
  box(g, cx + 56, 166, 36, 32, COLORS.rubber, 6)
  // Packer body with rounded top.
  box(g, cx - 94, 16, 188, 156, body, { tl: 30, tr: 30, bl: 6, br: 6 })
  fill(g, cx - 80, 22, 160, 6, lighten(body, 0.35), 3, 0.8)
  // Tailgate.
  box(g, cx - 84, 54, 168, 108, darken(body, 0.15), 10)
  // Hopper mouth with trash bags.
  box(g, cx - 70, 110, 140, 42, 0x1c1917, { tl: 18, tr: 18, bl: 4, br: 4 })
  ellipse(g, cx - 36, 140, 34, 22, 0x334155, 2)
  ellipse(g, cx - 4, 144, 30, 18, 0x0f172a, 2)
  ellipse(g, cx + 30, 140, 36, 22, 0x475569, 2)
  box(g, cx + 6, 126, 12, 12, 0xfbbf24, 2, 2)
  // Grab bars + riding steps.
  box(g, cx - 92, 70, 6, 60, COLORS.steel, 3, 2)
  box(g, cx + 86, 70, 6, 60, COLORS.steel, 3, 2)
  box(g, cx - 96, 156, 24, 6, COLORS.steel, 2, 2)
  box(g, cx + 72, 156, 24, 6, COLORS.steel, 2, 2)
  // Chevron bumper.
  stripes(g, cx - 92, 172, 184, 14, COLORS.yellow, INK, 9)
  g.lineStyle(3, INK, 1)
  g.strokeRect(cx - 92, 172, 184, 14)
  // Lights.
  lamp(g, cx - 72, 34, 8, phase === 0, COLORS.amberLit, COLORS.amberDim)
  lamp(g, cx + 72, 34, 8, phase === 1, COLORS.amberLit, COLORS.amberDim)
  lamp(g, cx, 14, 8, phase === 0, COLORS.amberLit, COLORS.amberDim)
  box(g, cx - 80, 116, 8, 30, COLORS.red, 3, 2)
  box(g, cx + 72, 116, 8, 30, COLORS.red, 3, 2)
}

export function trashLabels(): Label[] {
  return [{ text: 'TRASH', x: TRASH_W / 2, y: 82, size: 18, color: '#ffffff', stroke: '#15151f', strokeWidth: 4 }]
}

// ---------------------------------------------------------------- school bus

export const BUS_W = 250
export const BUS_H = 214

/** Rear view of a school bus. `arm` true = stop arm out (left), lights flashing. */
export function drawSchoolBus(g: G, arm: boolean, phase: 0 | 1): void {
  const cx = BUS_W / 2
  const L = cx - 80
  const R = cx + 80
  const yellow = COLORS.busYellow
  shadow(g, cx, 204, 190, 16)
  box(g, L + 8, 184, 32, 26, COLORS.rubber, 6)
  box(g, R - 40, 184, 32, 26, COLORS.rubber, 6)
  box(g, L, 14, 160, 174, yellow, { tl: 24, tr: 24, bl: 6, br: 6 })
  fill(g, L + 10, 18, 140, 5, lighten(yellow, 0.4), 3, 0.8)
  // Warning lamps: red outboard, amber inboard. When the arm is out the reds
  // alternate; when cleared every lamp is dark.
  lamp(g, L + 18, 32, 8, arm && phase === 0, COLORS.redLit, COLORS.redDim)
  lamp(g, R - 18, 32, 8, arm && phase === 1, COLORS.redLit, COLORS.redDim)
  lamp(g, L + 42, 32, 7, false, COLORS.amberLit, COLORS.amberDim)
  lamp(g, R - 42, 32, 7, false, COLORS.amberLit, COLORS.amberDim)
  // Name band.
  fill(g, L + 14, 46, 132, 20, 0xfde68a, 4)
  // Windows + emergency door.
  box(g, L + 10, 74, 38, 44, COLORS.glass, 5, 2)
  box(g, R - 48, 74, 38, 44, COLORS.glass, 5, 2)
  box(g, cx - 24, 70, 48, 108, darken(yellow, 0.08), 4)
  box(g, cx - 18, 76, 36, 44, COLORS.glass, 4, 2)
  fill(g, L + 14, 78, 8, 36, COLORS.glassHi, 2, 0.5)
  fill(g, cx - 14, 80, 8, 36, COLORS.glassHi, 2, 0.5)
  box(g, cx - 14, 136, 28, 6, 0x64748b, 2, 2)
  // Black rub rails.
  fill(g, L + 3, 126, 154, 5, INK)
  fill(g, L + 3, 150, 154, 5, INK)
  // Tail lights.
  lamp(g, L + 18, 140, 7, true, COLORS.redLit, COLORS.redDim)
  lamp(g, R - 18, 140, 7, true, COLORS.redLit, COLORS.redDim)
  box(g, L - 4, 174, 168, 16, 0x1f2430, 4)
  box(g, cx - 17, 160, 34, 13, 0xf8fafc, 2, 2)

  if (arm) {
    // Stop arm sticks out on the driver's (left) side.
    box(g, L - 12, 104, 14, 6, 0x334155, 2, 2)
    const ax = 26
    const ay = 107
    poly(g, ngon(ax, ay, 25, 8, Math.PI / 8), COLORS.red, 3)
    strokePoly(g, ngon(ax, ay, 21, 8, Math.PI / 8), 0xffffff, 2)
    lamp(g, ax, ay - 18, 3.5, phase === 0, COLORS.redLit, COLORS.redDim, 1.5)
    lamp(g, ax, ay + 18, 3.5, phase === 1, COLORS.redLit, COLORS.redDim, 1.5)
  } else {
    // Folded flat against the side.
    box(g, L - 8, 90, 10, 36, COLORS.red, 3, 2)
  }
}

export function busLabels(arm: boolean): Label[] {
  const cx = BUS_W / 2
  const out: Label[] = [
    { text: 'SCHOOL BUS', x: cx, y: 56.5, size: 15, color: '#15151f', maxWidth: 124 },
    { text: 'VA', x: cx, y: 167, size: 9, color: '#1e3a8a' },
  ]
  if (arm) out.push({ text: 'STOP', x: 26, y: 107.5, size: 11, color: '#ffffff', maxWidth: 34 })
  return out
}

// ---------------------------------------------------------------- semi trailer

export const SEMI_W = 220
export const SEMI_H = 252

export function drawSemi(g: G): void {
  const cx = SEMI_W / 2
  shadow(g, cx, 244, 210, 16)
  // Dual tires and mud flaps.
  box(g, 18, 200, 48, 36, COLORS.rubber, 6)
  box(g, SEMI_W - 66, 200, 48, 36, COLORS.rubber, 6)
  line(g, 42, 202, 42, 234, 0x3a3a46, 2)
  line(g, SEMI_W - 42, 202, SEMI_W - 42, 234, 0x3a3a46, 2)
  box(g, 16, 222, 52, 24, 0x111827, 3)
  box(g, SEMI_W - 68, 222, 52, 24, 0x111827, 3)
  // Underride guard.
  box(g, 34, 208, 4, 18, COLORS.darkSteel, 1, 2)
  box(g, SEMI_W - 38, 208, 4, 18, COLORS.darkSteel, 1, 2)
  box(g, 26, 222, SEMI_W - 52, 9, COLORS.steel, 2)
  // Trailer box.
  box(g, 12, 8, SEMI_W - 24, 198, 0xe2e8f0, 6)
  fill(g, 16, 12, SEMI_W - 32, 6, 0xffffff, 2, 0.8)
  line(g, cx, 22, cx, 196, INK, 3)
  // Lock rods + handles.
  for (const x of [44, 80, SEMI_W - 80, SEMI_W - 44]) {
    line(g, x, 22, x, 196, 0x64748b, 4)
    box(g, x - 3, 150, 6, 10, 0x475569, 2, 1.5)
  }
  for (const y of [34, 104, 176]) {
    circle(g, 18, y, 3, 0x64748b, 1.5)
    circle(g, SEMI_W - 18, y, 3, 0x64748b, 1.5)
  }
  // Conspicuity tape.
  for (let x = 16, i = 0; x < SEMI_W - 16; x += 16, i++) fill(g, x, 192, 16, 8, i % 2 ? 0xffffff : COLORS.red)
  g.lineStyle(2, INK, 1)
  g.strokeRect(16, 192, SEMI_W - 32, 8)
  // Mirror sticker panel.
  box(g, cx - 82, 92, 164, 44, COLORS.yellow, 6, 3)
  // Marker lights.
  for (const dx of [-14, 0, 14]) lamp(g, cx + dx, 16, 4, true, COLORS.amberLit, COLORS.amberDim, 1.5)
  lamp(g, 26, 16, 4, true, COLORS.redLit, COLORS.redDim, 1.5)
  lamp(g, SEMI_W - 26, 16, 4, true, COLORS.redLit, COLORS.redDim, 1.5)
  lamp(g, 36, 202, 7, true, COLORS.redLit, COLORS.redDim)
  lamp(g, SEMI_W - 36, 202, 7, true, COLORS.redLit, COLORS.redDim)
}

export function semiLabels(): Label[] {
  const cx = SEMI_W / 2
  return [
    { text: "CAN'T SEE MY MIRRORS?", x: cx, y: 106, size: 12, color: '#15151f', maxWidth: 150 },
    { text: "I CAN'T SEE YOU!", x: cx, y: 123, size: 13, color: '#b91c1c', maxWidth: 150 },
  ]
}

// ---------------------------------------------------------------- tailgater

export const TAILGATER_W = 176
export const TAILGATER_H = 132

/** Front view of a car right behind you, high beams glaring. */
export function drawTailgater(g: G): void {
  const cx = TAILGATER_W / 2
  const paint = 0xdc2626
  shadow(g, cx, 124, 168, 14)
  box(g, cx - 70, 104, 24, 24, COLORS.rubber, 5)
  box(g, cx + 46, 104, 24, 24, COLORS.rubber, 5)
  // Roof + windshield.
  poly(g, [cx - 62, 64, cx - 46, 22, cx + 46, 22, cx + 62, 64], paint)
  poly(g, [cx - 52, 62, cx - 40, 30, cx + 40, 30, cx + 52, 62], COLORS.glass, 2)
  // Grumpy driver.
  circle(g, cx - 14, 50, 11, COLORS.skin, 2)
  fill(g, cx - 26, 38, 24, 8, 0x3f2a1d, 4)
  line(g, cx - 21, 45, cx - 15, 48, INK, 2.5)
  line(g, cx - 7, 45, cx - 13, 48, INK, 2.5)
  circle(g, cx - 18, 51, 1.6, INK, 0)
  circle(g, cx - 10, 51, 1.6, INK, 0)
  line(g, cx - 18, 57, cx - 10, 57, INK, 2)
  g.fillStyle(COLORS.glassHi, 0.45)
  g.fillPoints([{ x: cx + 18, y: 32 }, { x: cx + 30, y: 32 }, { x: cx + 22, y: 60 }, { x: cx + 10, y: 60 }], true, true)
  // Hood / front.
  box(g, cx - 74, 62, 148, 50, paint, 14)
  fill(g, cx - 64, 66, 128, 4, lighten(paint, 0.35), 2, 0.85)
  box(g, cx - 28, 82, 56, 20, 0x1f2430, 6)
  g.lineStyle(2, 0x475569, 1)
  for (let y = 87; y < 100; y += 4) g.lineBetween(cx - 22, y, cx + 22, y)
  // High beams with glare.
  for (const x of [cx - 50, cx + 50]) {
    g.fillStyle(0xfffbe6, 0.12)
    g.fillCircle(x, 80, 34)
    glow(g, x, 80, 11, 0xfff7c2, 1.4)
    ellipse(g, x, 80, 30, 18, 0xfffbe6, 2)
    circle(g, x - 4, 78, 4, 0xffffff, 0)
  }
  box(g, cx - 76, 104, 152, 12, 0x2a2e38, 5)
  box(g, cx - 16, 104, 32, 13, 0xf8fafc, 2, 2)
}

export function tailgaterLabels(): Label[] {
  return [{ text: 'VA', x: TAILGATER_W / 2, y: 111, size: 9, color: '#1e3a8a' }]
}

// ---------------------------------------------------------------- funeral procession

export const FUNERAL_W = 330
export const FUNERAL_H = 128

/** Side view: hearse leading a car, headlights on, little funeral flags. */
export function drawFuneral(g: G): void {
  const ground = 118
  sideCar(g, 8, ground, 140, 0x1f2937, false)
  sideCar(g, 166, ground, 158, 0x111827, true)
}

function sideCar(g: G, x: number, ground: number, len: number, paint: number, hearse: boolean): void {
  const front = x + len
  shadow(g, x + len / 2, ground + 4, len + 6, 10, 0.3)
  // Cabin.
  const cabinBack = hearse ? x + 6 : x + len * 0.2
  const cabinFront = x + len * 0.72
  poly(g, [cabinBack, ground - 36, cabinBack + 8, ground - 66, cabinFront - 12, ground - 66, cabinFront + 8, ground - 36], paint)
  if (hearse) {
    // Long solid rear with chrome landau bar, small front window.
    box(g, cabinFront - 40, ground - 60, 40, 22, COLORS.glass, 3, 2)
    g.lineStyle(3, COLORS.chrome, 1)
    g.beginPath()
    g.moveTo(x + 30, ground - 44)
    g.lineTo(x + 46, ground - 58)
    g.lineTo(x + 62, ground - 44)
    g.strokePath()
    circle(g, x + 46, ground - 52, 3, COLORS.chrome, 1.5)
  } else {
    box(g, cabinBack + 10, ground - 60, (cabinFront - cabinBack) / 2 - 12, 22, COLORS.glass, 3, 2)
    box(g, cabinBack + (cabinFront - cabinBack) / 2 + 2, ground - 60, (cabinFront - cabinBack) / 2 - 8, 22, COLORS.glass, 3, 2)
  }
  // Lower body.
  box(g, x, ground - 40, len, 28, paint, { tl: 8, tr: 14, bl: 6, br: 8 })
  fill(g, x + 6, ground - 36, len - 16, 3, lighten(paint, 0.35), 1, 0.9)
  fill(g, x + 4, ground - 22, len - 8, 3, COLORS.chrome, 1)
  // Wheels.
  for (const wx of [x + len * 0.2, x + len * 0.8]) {
    circle(g, wx, ground - 10, 13, COLORS.rubber)
    circle(g, wx, ground - 10, 6, COLORS.chrome, 2)
  }
  // Headlight (lit) and tail light.
  glow(g, front - 3, ground - 30, 6, 0xfff7c2, 1.3)
  box(g, front - 8, ground - 35, 9, 9, 0xfffbe6, 3, 2)
  box(g, x - 1, ground - 36, 6, 9, COLORS.red, 2, 2)
  // Little funeral flag on the front fender.
  const fx = front - 26
  line(g, fx, ground - 40, fx, ground - 72, INK, 3)
  poly(g, [fx, ground - 72, fx - 26, ground - 72, fx - 22, ground - 64, fx - 26, ground - 56, fx, ground - 56], 0xf97316, 2)
  fill(g, fx - 19, ground - 66, 13, 4, 0xffffff, 1, 0.9)
}

