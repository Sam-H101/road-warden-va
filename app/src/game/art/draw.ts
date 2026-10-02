// Shared drawing toolkit for the procedural art. Everything is drawn with
// Phaser Graphics and baked into a canvas texture with generateTexture. Text
// (plates, STOP paddles, emoji decals) is stamped onto that same canvas
// afterwards, so no image files and no RenderTextures are needed.
import Phaser from 'phaser'

export type G = Phaser.GameObjects.Graphics
type Radius = number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius

/** Outline ink: near-black with a hint of blue so it never looks muddy. */
export const INK = 0x15151f
/** Default outline thickness. Chunky so shapes read at 1/4 scale. */
export const LW = 3

export const COLORS = {
  red: 0xef4444,
  redLit: 0xff5a4f,
  redDim: 0x4c1515,
  amber: 0xf59e0b,
  amberLit: 0xffc21a,
  amberDim: 0x4a3510,
  green: 0x22c55e,
  greenLit: 0x3cf07c,
  greenDim: 0x123b22,
  blueLit: 0x3b82f6,
  blueDim: 0x172554,
  yellow: 0xfacc15,
  busYellow: 0xfbbf24,
  orange: 0xf97316,
  white: 0xf8fafc,
  chrome: 0xcbd5e1,
  steel: 0x94a3b8,
  darkSteel: 0x475569,
  rubber: 0x23232c,
  glass: 0x24324a,
  glassHi: 0x5b7aa6,
  skin: 0xf2c29b,
  skinDark: 0x9a6542,
  wood: 0x8b5a2b,
} as const

// ---------------------------------------------------------------- colors

export function hexToNum(hex: string, fallback: number): number {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || '').trim())
  if (!m) return fallback
  let s = m[1]
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return parseInt(s, 16)
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  const r = Math.round(ar + (br - ar) * t)
  const gg = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (gg << 8) | bl
}

export const darken = (c: number, t: number): number => mix(c, 0x000000, t)
export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t)

/** Relative luminance 0..1 (rough, good enough for picking contrast). */
export function luminance(c: number): number {
  const r = ((c >> 16) & 255) / 255
  const g = ((c >> 8) & 255) / 255
  const b = (c & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function cssColor(c: number): string {
  return '#' + c.toString(16).padStart(6, '0')
}

// ---------------------------------------------------------------- shapes

function clampRadius(r: Radius, w: number, h: number): Radius {
  if (typeof r !== 'number') return r
  return Math.max(0, Math.min(r, w / 2 - 0.5, h / 2 - 0.5))
}

/** Filled rectangle (optionally rounded) with an ink outline. */
export function box(g: G, x: number, y: number, w: number, h: number, fill: number, r: Radius = 0, lw = LW, alpha = 1): void {
  const rr = clampRadius(r, w, h)
  const rounded = typeof rr !== 'number' || rr > 0
  g.fillStyle(fill, alpha)
  if (rounded) g.fillRoundedRect(x, y, w, h, rr)
  else g.fillRect(x, y, w, h)
  if (lw > 0) {
    g.lineStyle(lw, INK, 1)
    if (rounded) g.strokeRoundedRect(x, y, w, h, rr)
    else g.strokeRect(x, y, w, h)
  }
}

/** Fill only (no outline). */
export function fill(g: G, x: number, y: number, w: number, h: number, color: number, r: Radius = 0, alpha = 1): void {
  box(g, x, y, w, h, color, r, 0, alpha)
}

export function circle(g: G, cx: number, cy: number, r: number, color: number, lw = LW, alpha = 1): void {
  g.fillStyle(color, alpha)
  g.fillCircle(cx, cy, r)
  if (lw > 0) {
    g.lineStyle(lw, INK, 1)
    g.strokeCircle(cx, cy, r)
  }
}

export function ellipse(g: G, cx: number, cy: number, w: number, h: number, color: number, lw = LW, alpha = 1): void {
  g.fillStyle(color, alpha)
  g.fillEllipse(cx, cy, w, h, 32)
  if (lw > 0) {
    g.lineStyle(lw, INK, 1)
    g.strokeEllipse(cx, cy, w, h, 32)
  }
}

function toPoints(pts: readonly number[]): Phaser.Types.Math.Vector2Like[] {
  const out: Phaser.Types.Math.Vector2Like[] = []
  for (let i = 0; i + 1 < pts.length; i += 2) out.push({ x: pts[i], y: pts[i + 1] })
  return out
}

/** Closed polygon from a flat [x0, y0, x1, y1, ...] list. */
export function poly(g: G, pts: readonly number[], color: number, lw = LW, alpha = 1): void {
  const p = toPoints(pts)
  g.fillStyle(color, alpha)
  g.fillPoints(p, true, true)
  if (lw > 0) {
    g.lineStyle(lw, INK, 1)
    g.strokePoints(p, true, true)
  }
}

/** Outline-only polygon in any color. */
export function strokePoly(g: G, pts: readonly number[], color: number, width: number, alpha = 1): void {
  g.lineStyle(width, color, alpha)
  g.strokePoints(toPoints(pts), true, true)
}

export function line(g: G, x1: number, y1: number, x2: number, y2: number, color: number, width: number, alpha = 1): void {
  g.lineStyle(width, color, alpha)
  g.lineBetween(x1, y1, x2, y2)
}

/** Rounded stick from (x1,y1) to (x2,y2): limbs, poles, cane, antlers. */
export function capsule(g: G, x1: number, y1: number, x2: number, y2: number, r: number, color: number, lw = LW): void {
  const draw = (rad: number, c: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * rad
    const ny = (dx / len) * rad
    g.fillStyle(c, 1)
    g.fillPoints(toPoints([x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny]), true, true)
    g.fillCircle(x1, y1, rad)
    g.fillCircle(x2, y2, rad)
  }
  if (lw > 0) draw(r + lw * 0.85, INK)
  draw(r, color)
}

/** Regular polygon points (octagon paddle, star of life...). */
export function ngon(cx: number, cy: number, r: number, sides: number, rot = 0): number[] {
  const pts: number[] = []
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  return pts
}

/** Star points (sparkles on ice, sheriff stars). */
export function star(cx: number, cy: number, outer: number, inner: number, points: number, rot = -Math.PI / 2): number[] {
  const pts: number[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i / (points * 2)) * Math.PI * 2
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  return pts
}

/** Soft light halo. Draw BEFORE the lamp itself. */
export function glow(g: G, cx: number, cy: number, r: number, color: number, strength = 1): void {
  const rings = [2.3, 1.85, 1.45]
  const alphas = [0.12, 0.18, 0.28]
  for (let i = 0; i < rings.length; i++) {
    g.fillStyle(color, alphas[i] * strength)
    g.fillCircle(cx, cy, r * rings[i])
  }
}

/** A lamp: glow + lens + specular dot when lit, dark lens when off. */
export function lamp(g: G, cx: number, cy: number, r: number, lit: boolean, litColor: number, dimColor: number, lw = 2): void {
  if (lit) glow(g, cx, cy, r, litColor)
  circle(g, cx, cy, r, lit ? litColor : dimColor, lw)
  if (lit) {
    g.fillStyle(0xffffff, 0.75)
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, Math.max(1.5, r * 0.32))
  } else {
    g.fillStyle(0xffffff, 0.12)
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, Math.max(1, r * 0.28))
  }
}

/** Ground shadow under vehicles and figures. */
export function shadow(g: G, cx: number, cy: number, w: number, h: number, alpha = 0.3): void {
  g.fillStyle(0x000000, alpha)
  g.fillEllipse(cx, cy, w, h, 28)
}

/** Diagonal hazard stripes clipped to a rectangle (rail gate, trash truck). */
export function stripes(g: G, x: number, y: number, w: number, h: number, a: number, b: number, band: number, slant = 1): void {
  g.fillStyle(a, 1)
  g.fillRect(x, y, w, h)
  g.fillStyle(b, 1)
  // Draw parallelograms and clip by hand to the rect bounds.
  for (let sx = x - h - band * 2; sx < x + w + h; sx += band * 2) {
    const pts = slant > 0
      ? [sx, y + h, sx + band, y + h, sx + band + h, y, sx + h, y]
      : [sx, y, sx + band, y, sx + band + h, y + h, sx + h, y + h]
    const clipped = clipPolyToRect(pts, x, y, x + w, y + h)
    if (clipped.length >= 6) g.fillPoints(toPoints(clipped), true, true)
  }
}

// Sutherland-Hodgman against an axis-aligned rect.
function clipPolyToRect(pts: number[], x0: number, y0: number, x1: number, y1: number): number[] {
  type P = [number, number]
  let input: P[] = []
  for (let i = 0; i + 1 < pts.length; i += 2) input.push([pts[i], pts[i + 1]])
  const edges: Array<(p: P) => boolean> = [(p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1]
  const inter = (a: P, b: P, e: number): P => {
    const [ax, ay] = a
    const [bx, by] = b
    if (e === 0 || e === 1) {
      const xx = e === 0 ? x0 : x1
      const t = (xx - ax) / (bx - ax || 1e-9)
      return [xx, ay + (by - ay) * t]
    }
    const yy = e === 2 ? y0 : y1
    const t = (yy - ay) / (by - ay || 1e-9)
    return [ax + (bx - ax) * t, yy]
  }
  for (let e = 0; e < 4; e++) {
    const inside = edges[e]
    const out: P[] = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(inter(prev, cur, e))
        out.push(cur)
      } else if (inside(prev)) {
        out.push(inter(prev, cur, e))
      }
    }
    input = out
    if (!input.length) break
  }
  return input.flat()
}

// ---------------------------------------------------------------- text

export const FONT = '"Arial Black", "Arial Bold", "Helvetica Neue", Arial, sans-serif'
export const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif'

export interface Label {
  text: string
  x: number
  y: number
  size: number
  color?: string
  /** outline color; omit for none */
  stroke?: string
  strokeWidth?: number
  font?: string
  weight?: string
  align?: CanvasTextAlign
  /** squash text to fit this width */
  maxWidth?: number
  /** radians, rotates around (x, y) */
  rotate?: number
  alpha?: number
}

export function drawLabel(ctx: CanvasRenderingContext2D, l: Label): void {
  ctx.save()
  ctx.globalAlpha = l.alpha ?? 1
  ctx.translate(l.x, l.y)
  if (l.rotate) ctx.rotate(l.rotate)
  ctx.font = `${l.weight ?? '900'} ${l.size}px ${l.font ?? FONT}`
  ctx.textAlign = l.align ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (l.stroke) {
    ctx.strokeStyle = l.stroke
    ctx.lineWidth = l.strokeWidth ?? Math.max(2, l.size / 5)
    ctx.strokeText(l.text, 0, 0, l.maxWidth)
  }
  ctx.fillStyle = l.color ?? '#ffffff'
  ctx.fillText(l.text, 0, 0, l.maxWidth)
  ctx.restore()
}

/** Stamp text onto an already generated canvas texture. */
export function stampLabels(scene: Phaser.Scene, key: string, labels: readonly Label[]): void {
  if (!labels.length || !scene.textures.exists(key)) return
  const tex = scene.textures.get(key)
  const src = tex.getSourceImage()
  if (!(src instanceof HTMLCanvasElement)) return
  const ctx = src.getContext('2d')
  if (!ctx) return
  for (const l of labels) drawLabel(ctx, l)
  if (tex instanceof Phaser.Textures.CanvasTexture) tex.refresh()
}

// ---------------------------------------------------------------- baking

/**
 * Generate a texture once. `draw` paints into a fresh Graphics; optional
 * labels are stamped on top. A failure in one drawing never takes the game
 * down: it falls back to a labeled box of the same size.
 */
export function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: G) => void,
  labels?: readonly Label[] | (() => readonly Label[]),
): void {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  try {
    draw(g)
    g.generateTexture(key, w, h)
    const ls = typeof labels === 'function' ? labels() : labels
    if (ls) stampLabels(scene, key, ls)
  } catch (err) {
    console.warn(`[art] failed to draw ${key}`, err)
    if (scene.textures.exists(key)) scene.textures.remove(key)
    fallbackBox(scene, key, w, h)
  } finally {
    g.destroy()
  }
}

export function fallbackBox(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  box(g, 2, 2, w - 4, h - 4, 0xff9900, 8)
  g.generateTexture(key, w, h)
  g.destroy()
  stampLabels(scene, key, [{ text: key.replace(/^prop-/, ''), x: w / 2, y: h / 2, size: 12, color: '#15151f', maxWidth: w - 8 }])
}
