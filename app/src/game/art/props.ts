// Scene props: every SceneProp plus cleared and flash frames.
import type { SceneProp } from '../../engine/types'
import type { G, Label } from './draw'
import { COLORS, INK, box, circle, fill, lamp, line, poly, shadow, stripes } from './draw'
import { PROP_INFO } from './propInfo'
import {
  ambulanceLabels,
  busLabels,
  drawAmbulance,
  drawFuneral,
  drawPolice,
  drawSchoolBus,
  drawSemi,
  drawTailgater,
  drawTowTruck,
  drawTrashTruck,
  policeLabels,
  semiLabels,
  tailgaterLabels,
  towLabels,
  trashLabels,
} from './vehicles'
import { crosswalkBars, drawCyclist, drawDeer, drawFlagger, drawMotorcycle, drawWalker, flaggerLabels } from './figures'

export interface TexDef {
  key: string
  w: number
  h: number
  draw: (g: G) => void
  labels?: readonly Label[] | (() => readonly Label[])
}

// ---------------------------------------------------------------- traffic light

type Lit = 'red' | 'yellow' | 'green' | null

function trafficLight(g: G, lit: Lit): void {
  const cx = 40
  shadow(g, cx, 196, 44, 8)
  box(g, cx - 5, 140, 10, 56, 0x6b7280, 2)
  box(g, cx - 14, 188, 28, 10, 0x4b5563, 3)
  // Backplate with yellow reflective border (common in Virginia).
  box(g, 8, 4, 64, 142, 0x1f2430, 10)
  g.lineStyle(3, COLORS.yellow, 1)
  g.strokeRoundedRect(12, 8, 56, 134, 8)
  box(g, 18, 14, 44, 122, 0x2b2f3a, 8, 2)
  const lamps: Array<[number, Exclude<Lit, null>, number, number]> = [
    [35, 'red', COLORS.redLit, COLORS.redDim],
    [75, 'yellow', COLORS.amberLit, COLORS.amberDim],
    [115, 'green', COLORS.greenLit, COLORS.greenDim],
  ]
  for (const [y, name, on, off] of lamps) {
    lamp(g, cx, y, 15, lit === name, on, off, 2.5)
    // Visor hood.
    g.lineStyle(5, 0x0f1115, 1)
    g.beginPath()
    g.arc(cx, y, 18, Math.PI + 0.35, -0.35, false)
    g.strokePath()
  }
}

// ---------------------------------------------------------------- crosswalk

function crosswalk(g: G, who: 'walker' | 'blind' | null): void {
  const w = PROP_INFO['pedestrian-crosswalk'].width
  const h = PROP_INFO['pedestrian-crosswalk'].height
  crosswalkBars(g, w, h - 44, 40)
  if (who === 'walker') drawWalker(g, 140, h - 16, 1.15, { shirt: 0xec4899, pants: 0x1e3a8a, hair: 0x3f2a1d })
  if (who === 'blind') drawWalker(g, 120, h - 16, 1.15, { shirt: 0x0d9488, pants: 0x374151, hair: 0x9ca3af, blind: true })
}

// ---------------------------------------------------------------- railroad

function rotRect(cx: number, cy: number, hl: number, ht: number, a: number): number[] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const pts: number[] = []
  for (const [dx, dy] of [[-hl, -ht], [hl, -ht], [hl, ht], [-hl, ht]] as const) {
    pts.push(cx + dx * c - dy * s, cy + dx * s + dy * c)
  }
  return pts
}

const BUCK_ANGLE = 0.55

function crossbuck(g: G, cx: number, cy: number, hl: number, ht: number): void {
  poly(g, rotRect(cx, cy, hl, ht, BUCK_ANGLE), 0xffffff, 2.5)
  poly(g, rotRect(cx, cy, hl, ht, -BUCK_ANGLE), 0xffffff, 2.5)
}

/** Words split around the crossing point, like the real sign. */
function crossbuckLabels(cx: number, cy: number, size: number, offset: number): Label[] {
  const out: Label[] = []
  const words: Array<[number, string, string]> = [
    [-BUCK_ANGLE, 'RAIL', 'ROAD'],
    [BUCK_ANGLE, 'CROSS', 'ING'],
  ]
  for (const [a, w1, w2] of words) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    out.push({ text: w1, x: cx - c * offset, y: cy - s * offset, size, color: '#15151f', rotate: a, maxWidth: offset * 1.2 })
    out.push({ text: w2, x: cx + c * offset, y: cy + s * offset, size, color: '#15151f', rotate: a, maxWidth: offset * 1.2 })
  }
  return out
}

function signalUnit(g: G, x: number, y: number, r: number, lit: boolean): void {
  circle(g, x, y, r + 8, 0x111318, 2.5)
  g.lineStyle(2, 0xffffff, 0.8)
  g.strokeCircle(x, y, r + 5)
  lamp(g, x, y, r, lit, COLORS.redLit, COLORS.redDim, 2)
  g.lineStyle(4, 0x0f1115, 1)
  g.beginPath()
  g.arc(x, y, r + 3, Math.PI + 0.3, -0.3, false)
  g.strokePath()
}

function railroadLights(g: G, phase: 0 | 1 | null): void {
  const cx = 65
  shadow(g, cx, 200, 60, 8)
  box(g, cx - 5, 26, 10, 170, 0xf1f5f9, 2)
  box(g, cx - 17, 190, 34, 12, 0x4b5563, 3)
  crossbuck(g, cx, 36, 60, 9)
  box(g, 14, 82, 102, 9, 0x1f2430, 3)
  box(g, 30, 88, 4, 8, 0x1f2430, 1, 1.5)
  box(g, 96, 88, 4, 8, 0x1f2430, 1, 1.5)
  signalUnit(g, 32, 110, 12, phase === 0)
  signalUnit(g, 98, 110, 12, phase === 1)
}

function tracks(g: G, w: number, y: number): void {
  for (let x = 4; x < w; x += 24) box(g, x, y, 12, 22, 0x6b4423, 2, 2)
  for (const ry of [y + 4, y + 14]) {
    fill(g, 0, ry, w, 5, 0x9ca3af)
    line(g, 0, ry, w, ry, INK, 1.5)
    line(g, 0, ry + 5, w, ry + 5, INK, 1.5)
  }
}

function railroadGate(g: G, down: boolean, phase: 0 | 1): void {
  const w = PROP_INFO['railroad-gate-down'].width
  tracks(g, w, 206)
  const px = 297
  shadow(g, px, 208, 60, 8)
  box(g, px - 5, 34, 10, 172, 0xf1f5f9, 2)
  box(g, px - 17, 198, 34, 10, 0x4b5563, 3)
  crossbuck(g, px, 22, 32, 6)
  box(g, 266, 50, 62, 7, 0x1f2430, 3)
  signalUnit(g, 280, 72, 8, down && phase === 0)
  signalUnit(g, 314, 72, 8, down && phase === 1)
  // Gate arm on a pivot, drawn in rotated space.
  const pivX = 286
  const pivY = 150
  const L = down ? 278 : 136
  const ang = down ? Math.PI : -Math.PI / 2 - 0.1
  g.save()
  g.translateCanvas(pivX, pivY)
  g.rotateCanvas(ang)
  box(g, -24, -11, 22, 22, 0x374151, 4)
  stripes(g, 0, -7, L, 14, 0xffffff, COLORS.red, 14)
  g.lineStyle(3, INK, 1)
  g.strokeRoundedRect(0, -7, L, 14, 6)
  g.restore()
  box(g, pivX - 12, pivY - 12, 24, 24, 0x4b5563, 5)
  circle(g, pivX, pivY, 4, 0x9ca3af, 2)
  if (down) {
    const lamps: Array<[number, boolean]> = [
      [pivX - L + 8, true],
      [pivX - L * 0.55, phase === 0],
      [pivX - L * 0.2, phase === 1],
    ]
    for (const [x, on] of lamps) lamp(g, x, pivY - 11, 4, on, COLORS.redLit, COLORS.redDim, 1.5)
  }
}

function gateLabels(): Label[] {
  return crossbuckLabels(297, 22, 6, 18)
}

// ---------------------------------------------------------------- work zone

function cone(g: G, cx: number, by: number, h: number): void {
  box(g, cx - h * 0.36, by - 7, h * 0.72, 7, 0x1f2937, 2, 2)
  const top = by - h
  const bot = by - 6
  const hw = (y: number) => h * 0.07 + (h * 0.27 - h * 0.07) * ((y - top) / (bot - top))
  poly(g, [cx - h * 0.27, bot, cx - h * 0.07, top, cx + h * 0.07, top, cx + h * 0.27, bot], COLORS.orange, 2.5)
  g.fillStyle(0xffffff, 1)
  for (const [a, b] of [[0.3, 0.44], [0.58, 0.7]] as const) {
    const y1 = top + (bot - top) * a
    const y2 = top + (bot - top) * b
    g.fillPoints([{ x: cx - hw(y1) + 1.5, y: y1 }, { x: cx + hw(y1) - 1.5, y: y1 }, { x: cx + hw(y2) - 1.5, y: y2 }, { x: cx - hw(y2) + 1.5, y: y2 }], true, true)
  }
}

function barrel(g: G, cx: number, by: number, h: number, lit: boolean): void {
  const w = h * 0.62
  box(g, cx - w / 2 - 4, by - 9, w + 8, 9, 0x1f2937, 3, 2)
  box(g, cx - w / 2, by - h, w, h - 7, COLORS.orange, 9)
  for (const t of [0.2, 0.52]) fill(g, cx - w / 2 + 1.5, by - h + h * t, w - 3, h * 0.14, 0xffffff)
  line(g, cx, by - h, cx, by - h - 8, INK, 3)
  lamp(g, cx, by - h - 12, 6, lit, COLORS.amberLit, COLORS.amberDim, 2)
}

function workZone(g: G, lit: boolean): void {
  const by = 100
  shadow(g, 120, by, 236, 10, 0.22)
  cone(g, 24, by, 54)
  barrel(g, 78, by, 70, lit)
  cone(g, 132, by, 58)
  barrel(g, 184, by, 74, lit)
  cone(g, 222, by, 46)
}

// ---------------------------------------------------------------- road surfaces

function blobs(g: G, list: ReadonlyArray<readonly [number, number, number, number]>, edge: number, body: number, inner: number, alpha = 1): void {
  g.fillStyle(edge, alpha)
  for (const [x, y, w, h] of list) g.fillEllipse(x, y, w + 7, h + 7, 28)
  g.fillStyle(body, alpha)
  for (const [x, y, w, h] of list) g.fillEllipse(x, y, w, h, 28)
  g.fillStyle(inner, alpha)
  for (const [x, y, w, h] of list) g.fillEllipse(x + w * 0.04, y + h * 0.08, w * 0.72, h * 0.55, 28)
}

function pondedWater(g: G): void {
  blobs(g, [[130, 40, 232, 44], [60, 32, 92, 34], [198, 46, 104, 28], [150, 28, 120, 28]], 0x1e3a8a, 0x3b82f6, 0x60a5fa)
  g.lineStyle(3, 0xffffff, 0.75)
  g.lineBetween(52, 30, 92, 30)
  g.lineBetween(150, 46, 210, 46)
  g.lineBetween(120, 24, 140, 24)
  g.lineStyle(2, 0xffffff, 0.55)
  g.strokeEllipse(112, 40, 40, 10, 24)
  g.lineStyle(2, 0xffffff, 0.3)
  g.strokeEllipse(112, 40, 70, 18, 24)
}

function sparkle(g: G, x: number, y: number, r: number): void {
  const pts = [x, y - r, x + r * 0.25, y - r * 0.25, x + r, y, x + r * 0.25, y + r * 0.25, x, y + r, x - r * 0.25, y + r * 0.25, x - r, y, x - r * 0.25, y - r * 0.25]
  g.fillStyle(0x38bdf8, 0.9)
  g.fillCircle(x, y, r * 0.45)
  poly(g, pts, 0xffffff, 0)
}

function icyBridge(g: G): void {
  box(g, 16, 6, 288, 90, 0x6b7a8f, 0)
  fill(g, 18, 12, 284, 4, 0x4b5563)
  fill(g, 18, 84, 284, 4, 0x4b5563)
  blobs(g, [[80, 48, 110, 34], [130, 58, 90, 26], [226, 40, 120, 30], [256, 62, 70, 18]], 0x7dd3fc, 0xcdeffd, 0xf0fbff, 0.95)
  g.lineStyle(2, 0xffffff, 0.9)
  g.lineBetween(56, 42, 92, 42)
  g.lineBetween(204, 36, 248, 36)
  for (const [x, y, r] of [[70, 50, 7], [116, 60, 5], [236, 44, 8], [270, 62, 5], [150, 34, 5]] as const) sparkle(g, x, y, r)
  // Bridge rails.
  for (const x of [0, 302]) {
    box(g, x, 0, 18, 100, 0xcbd5e1, 4)
    g.lineStyle(2, 0x94a3b8, 1)
    for (let y = 12; y < 96; y += 14) g.lineBetween(x + 3, y, x + 15, y)
  }
}

function stopLine(g: G, w: number, h: number): void {
  crosswalkBars(g, w, h - 52, 26)
  g.fillStyle(0x000000, 0.2)
  g.fillRect(8, h - 14, w - 12, 12)
  fill(g, 6, h - 16, w - 12, 12, 0xf8fafc, 2)
}

function drivewayExit(g: G): void {
  const w = PROP_INFO['driveway-exit'].width
  // Street edge + curb, sidewalk, then the driveway apron you are on.
  box(g, 0, 0, w, 10, 0x9ca3af, 0, 2)
  fill(g, 0, 1, w, 3, 0xd1d5db)
  box(g, 0, 10, w, 40, 0xd6d3d1, 0, 2)
  g.lineStyle(2, 0xa8a29e, 1)
  for (let x = 50; x < w; x += 50) g.lineBetween(x, 12, x, 48)
  poly(g, [56, 72, 84, 50, w - 84, 50, w - 56, 72], 0xa8a29e, 2)
  fill(g, 92, 56, w - 184, 7, 0xf8fafc, 2)
}

// ---------------------------------------------------------------- defs

export function propDefs(): TexDef[] {
  const I = PROP_INFO
  const d = (prop: SceneProp, draw: (g: G) => void, labels?: TexDef['labels'], key = `prop-${prop}`): TexDef => ({
    key,
    w: I[prop].width,
    h: I[prop].height,
    draw,
    labels,
  })
  const funeralW = I['funeral-procession'].width
  const funeralH = I['funeral-procession'].height
  return [
    d('traffic-light-red', (g) => trafficLight(g, 'red')),
    d('traffic-light-yellow', (g) => trafficLight(g, 'yellow')),
    d('traffic-light-green', (g) => trafficLight(g, 'green')),
    d('traffic-light-flashing-red', (g) => trafficLight(g, 'red')),
    d('traffic-light-flashing-red', (g) => trafficLight(g, null), undefined, 'prop-traffic-light-flashing-red-b'),
    d('traffic-light-flashing-yellow', (g) => trafficLight(g, 'yellow')),
    d('traffic-light-flashing-yellow', (g) => trafficLight(g, null), undefined, 'prop-traffic-light-flashing-yellow-b'),
    d('traffic-light-out', (g) => trafficLight(g, null)),

    d('school-bus-stopped', (g) => drawSchoolBus(g, true, 0), busLabels(true)),
    d('school-bus-stopped', (g) => drawSchoolBus(g, true, 1), busLabels(true), 'prop-school-bus-stopped-b'),
    d('school-bus-stopped', (g) => drawSchoolBus(g, false, 0), busLabels(false), 'prop-school-bus-cleared'),

    d('pedestrian-crosswalk', (g) => crosswalk(g, 'walker')),
    d('blind-pedestrian', (g) => crosswalk(g, 'blind')),
    d('pedestrian-crosswalk', (g) => crosswalk(g, null), undefined, 'prop-crosswalk-empty'),

    d('cyclist-ahead', drawCyclist),
    d('motorcycle-ahead', drawMotorcycle, [{ text: 'VA', x: 56, y: 104.5, size: 7, color: '#1e3a8a' }]),
    d('deer-on-road', drawDeer),

    d('emergency-behind', (g) => drawAmbulance(g, 0), ambulanceLabels),
    d('emergency-behind', (g) => drawAmbulance(g, 1), ambulanceLabels, 'prop-emergency-behind-b'),
    d('emergency-stopped', (g) => drawPolice(g, 0), policeLabels),
    d('emergency-stopped', (g) => drawPolice(g, 1), policeLabels, 'prop-emergency-stopped-b'),
    d('tow-truck-stopped', (g) => drawTowTruck(g, 0), towLabels),
    d('tow-truck-stopped', (g) => drawTowTruck(g, 1), towLabels, 'prop-tow-truck-stopped-b'),
    d('trash-truck-stopped', (g) => drawTrashTruck(g, 0), trashLabels),
    d('trash-truck-stopped', (g) => drawTrashTruck(g, 1), trashLabels, 'prop-trash-truck-stopped-b'),

    d('railroad-gate-down', (g) => railroadGate(g, true, 0), gateLabels),
    d('railroad-gate-down', (g) => railroadGate(g, true, 1), gateLabels, 'prop-railroad-gate-down-b'),
    d('railroad-gate-down', (g) => railroadGate(g, false, 0), gateLabels, 'prop-railroad-gate-up'),
    d('railroad-lights-flashing', (g) => railroadLights(g, 0), () => crossbuckLabels(65, 36, 10, 32)),
    d('railroad-lights-flashing', (g) => railroadLights(g, 1), () => crossbuckLabels(65, 36, 10, 32), 'prop-railroad-lights-flashing-b'),
    d('railroad-lights-flashing', (g) => railroadLights(g, null), () => crossbuckLabels(65, 36, 10, 32), 'prop-railroad-lights-off'),

    d('flagger-stop', (g) => drawFlagger(g, 'stop'), flaggerLabels('stop')),
    d('flagger-slow', (g) => drawFlagger(g, 'slow'), flaggerLabels('slow')),

    d('funeral-procession', drawFuneral),
    d('funeral-procession', (g) => stopLine(g, funeralW, funeralH), undefined, 'prop-funeral-cleared'),

    d('work-zone-cones', (g) => workZone(g, true)),
    d('work-zone-cones', (g) => workZone(g, false), undefined, 'prop-work-zone-cones-b'),
    d('truck-ahead', drawSemi, semiLabels),
    d('tailgater-behind', drawTailgater, tailgaterLabels),

    d('ponded-water', pondedWater),
    d('icy-bridge', icyBridge),
    d('stop-line', (g) => stopLine(g, I['stop-line'].width, I['stop-line'].height)),
    d('driveway-exit', drivewayExit),
  ]
}

