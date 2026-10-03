// Draws the sky, hills, road bands, roadside posts, stop/finish lines and streams
// roadside scenery. Everything is keyed to distance traveled so motion reads clearly.
import Phaser from 'phaser'
import type { Weather } from '../../engine/types'
import { FX, skyKey } from './fxTextures'
import { Projection, Z_DRAW } from './projection'
import { THEMES, type RoadTheme } from './theme'

/** Length of one road band in depth units. */
const SEG = 1.6
/** Bands fade into the haze past this depth. */
const Z_STRIPES = 34
/** Art pixels per lane at z = 1 (shared with props). */
export const PX_PER_LANE = 210

export interface RoadLine {
  z: number
  kind: 'stop' | 'finish'
}

/**
 * Braking guide for stop events. `boxFrom..boxTo` is the green stop box just
 * before the line (depths); `marker` is where the car will stop if the player
 * holds BRAKE now. `state` colors the marker.
 */
export interface StopGuide {
  boxFrom: number
  boxTo: number
  marker: number
  state: 'early' | 'good' | 'late'
  pulse: number // 0..1 for a gentle glow
}

interface Scenery {
  img: Phaser.GameObjects.Image
  x: number
  p: number
  size: number
}

export class RoadView {
  private readonly scene: Phaser.Scene
  private readonly proj: Projection
  private readonly g: Phaser.GameObjects.Graphics
  private readonly sky: Phaser.GameObjects.Image
  private readonly hillsFar: Phaser.GameObjects.TileSprite
  private readonly hillsNear: Phaser.GameObjects.TileSprite
  private readonly haze: Phaser.GameObjects.Image
  private readonly scenery: Scenery[] = []
  private readonly sceneryKeys: string[]
  theme: RoadTheme = THEMES.clear
  private weather: Weather = 'clear'

  /** `density` = roadside props kept on screen (slow roll uses fewer so the scene stays calm). */
  constructor(scene: Phaser.Scene, proj: Projection, sceneryKeys: string[], density = 26) {
    this.scene = scene
    this.proj = proj
    this.sky = scene.add.image(0, 0, skyKey('clear')).setOrigin(0, 0).setDepth(-100)
    this.hillsFar = scene.add.tileSprite(0, 0, 16, 16, FX.hillsFar).setOrigin(0, 1).setDepth(-95)
    this.hillsNear = scene.add.tileSprite(0, 0, 16, 16, FX.hillsNear).setOrigin(0, 1).setDepth(-94)
    this.g = scene.add.graphics().setDepth(-50)
    this.haze = scene.add.image(0, 0, FX.haze).setOrigin(0, 0).setDepth(-45)
    this.sceneryKeys = sceneryKeys.filter((k) => scene.textures.exists(k))
    const count = this.sceneryKeys.length ? Math.max(0, Math.round(density)) : 0
    for (let i = 0; i < count; i++) {
      const img = scene.add.image(0, 0, this.sceneryKeys[i % this.sceneryKeys.length]).setOrigin(0.5, 1)
      const s: Scenery = { img, x: 0, p: 0, size: 1 }
      this.respawn(s, (i / count) * Z_DRAW + 0.5, i)
      this.scenery.push(s)
    }
    this.setWeather('clear')
  }

  private respawn(s: Scenery, p: number, i: number): void {
    const side = i % 2 === 0 ? 1 : -1
    const key = this.sceneryKeys[Math.floor(Math.random() * this.sceneryKeys.length)]
    if (key) s.img.setTexture(key)
    s.x = side * (2.5 + Math.random() * 2.6)
    s.p = p
    s.size = (0.85 + Math.random() * 0.45) / PX_PER_LANE
  }

  setWeather(w: Weather): void {
    this.weather = w
    this.theme = THEMES[w] ?? THEMES.clear
    const key = skyKey(w)
    if (this.scene.textures.exists(key)) this.sky.setTexture(key)
    this.hillsFar.setTint(this.theme.hillsFar)
    this.hillsNear.setTint(this.theme.hillsNear)
    this.haze.setTint(this.theme.haze)
    const dim = w === 'night' ? 0x4b5578 : w === 'fog' ? 0xc8d0da : 0xffffff
    for (const s of this.scenery) s.img.setTint(dim)
  }

  get currentWeather(): Weather {
    return this.weather
  }

  layout(): void {
    const p = this.proj
    this.sky.setDisplaySize(p.W, p.horizonY + 4)
    const farH = p.H * 0.1
    const nearH = p.H * 0.065
    this.hillsFar.setSize(p.W, farH).setPosition(0, p.horizonY + 1)
    this.hillsFar.setTileScale(farH / 128, farH / 128)
    this.hillsNear.setSize(p.W, nearH).setPosition(0, p.horizonY + 1)
    this.hillsNear.setTileScale(nearH / 96, nearH / 96)
    const hazeBottom = p.yOf(9)
    this.haze.setPosition(0, p.horizonY - 2).setDisplaySize(p.W, Math.max(4, hazeBottom - p.horizonY))
  }

  /** Redraw the road for the current distance. */
  draw(visDist: number, lines: readonly RoadLine[], shadow: { x: number; y: number; w: number } | null, guide?: StopGuide | null): void {
    const p = this.proj
    const t = this.theme
    const g = this.g
    g.clear()

    // Hills drift with the curve for a parallax feel.
    this.hillsFar.tilePositionX = -p.curve * 900 + visDist * 0.02
    this.hillsNear.tilePositionX = -p.curve * 1500 + visDist * 0.05

    // Base grass.
    g.fillStyle(t.grassA, 1)
    g.fillRect(0, p.horizonY, p.W, p.H - p.horizonY)

    const zMin = p.zNear * 0.92
    const n0 = Math.floor((visDist + zMin - 1) / SEG)

    // Grass bands.
    for (let n = n0; ; n++) {
      const zA = Math.max(zMin, n * SEG - visDist + 1)
      const zB = n * SEG + SEG - visDist + 1
      if (zA > Z_STRIPES) break
      if (zB <= zA || n % 2 !== 0) continue
      const yA = p.yOf(zA)
      const yB = p.yOf(zB)
      g.fillStyle(t.grassB, fadeAlpha(zA))
      g.fillRect(0, yB, p.W, yA - yB)
    }

    // Road surface as one curved polygon.
    g.fillStyle(t.road, 1)
    g.beginPath()
    const steps = 28
    for (let i = 0; i <= steps; i++) {
      const y = p.H - (i / steps) * (p.H - p.horizonY - 1.5)
      const z = p.zOfY(y)
      const x = p.xOf(-1.62, z)
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    for (let i = steps; i >= 0; i--) {
      const y = p.H - (i / steps) * (p.H - p.horizonY - 1.5)
      g.lineTo(p.xOf(1.62, p.zOfY(y)), y)
    }
    g.closePath()
    g.fillPath()

    // Bands on the road: subtle shade, rumble strips, lane dashes, edge lines, posts.
    for (let n = n0; ; n++) {
      const zA = Math.max(zMin, n * SEG - visDist + 1)
      const zB = n * SEG + SEG - visDist + 1
      if (zA > Z_STRIPES) break
      if (zB <= zA) continue
      const a = fadeAlpha(zA)
      const even = n % 2 === 0
      if (even) this.quad(-1.5, 1.5, zA, zB, t.roadB, a)
      this.quad(-1.62, -1.5, zA, zB, even ? t.rumbleA : t.rumbleB, a)
      this.quad(1.5, 1.62, zA, zB, even ? t.rumbleA : t.rumbleB, a)
      this.quad(-1.44, -1.41, zA, zB, t.line, a * 0.9)
      this.quad(1.41, 1.44, zA, zB, t.line, a * 0.9)
      if (even) {
        const zD = zA + (zB - zA) * 0.55
        this.quad(-0.52, -0.48, zA, zD, t.line, a)
        this.quad(0.48, 0.52, zA, zD, t.line, a)
      }
      if (n % 3 === 0 && zA < 22) this.posts(zA, a)
    }

    if (guide) this.stopGuide(guide)
    for (const l of lines) this.line(l)

    if (shadow) {
      g.fillStyle(0x000000, 0.32)
      g.fillEllipse(shadow.x, shadow.y, shadow.w, shadow.w * 0.16)
    }

    // Scenery is positioned after the road (sprites, depth sorted by z).
    for (let i = 0; i < this.scenery.length; i++) {
      const s = this.scenery[i]
      let z = s.p - visDist + 1
      if (z < p.zNear * 0.75) {
        this.respawn(s, s.p + Z_DRAW, i)
        z = s.p - visDist + 1
      }
      if (z > Z_DRAW) {
        s.img.setVisible(false)
        continue
      }
      s.img.setVisible(true)
      s.img.setPosition(p.xOf(s.x, z), p.yOf(z))
      s.img.setScale((s.size * p.laneW) / z)
      s.img.setDepth(1000 - z * 10)
      s.img.setAlpha(clamp01((Z_DRAW - z) / 10))
    }
  }

  private quad(x0: number, x1: number, zA: number, zB: number, color: number, alpha: number): void {
    if (alpha <= 0.01) return
    const p = this.proj
    const yA = p.yOf(zA)
    const yB = p.yOf(zB)
    const g = this.g
    g.fillStyle(color, alpha)
    g.beginPath()
    g.moveTo(p.xOf(x0, zA), yA)
    g.lineTo(p.xOf(x1, zA), yA)
    g.lineTo(p.xOf(x1, zB), yB)
    g.lineTo(p.xOf(x0, zB), yB)
    g.closePath()
    g.fillPath()
  }

  private posts(z: number, a: number): void {
    const p = this.proj
    const lp = p.lanePx(z)
    const y = p.yOf(z)
    const w = Math.max(1, lp * 0.05)
    const h = lp * 0.28
    for (const side of [-1.9, 1.9]) {
      const x = p.xOf(side, z)
      this.g.fillStyle(this.theme.post, a)
      this.g.fillRect(x - w / 2, y - h, w, h)
      this.g.fillStyle(0xef4444, a)
      this.g.fillRect(x - w / 2, y - h, w, h * 0.22)
    }
  }

  /** Green stop box before the line, plus a chevron where the car will stop if braking now. */
  private stopGuide(gd: StopGuide): void {
    const zNear = this.proj.zNear * 0.7
    const from = Math.max(zNear, gd.boxFrom)
    const to = Math.min(Z_DRAW, gd.boxTo)
    if (to > from) {
      const a = fadeAlpha(from)
      this.quad(-1.5, 1.5, from, to, 0x22c55e, 0.16 * a + 0.1 * gd.pulse * a)
      this.quad(-1.5, -1.44, from, to, 0x4ade80, 0.8 * a)
      this.quad(1.44, 1.5, from, to, 0x4ade80, 0.8 * a)
    }
    const z = gd.marker
    if (z < zNear || z > Z_DRAW) return
    const a = fadeAlpha(z)
    const color = gd.state === 'good' ? 0x4ade80 : gd.state === 'late' ? 0xf43f5e : 0xfacc15
    // A bar across the road with three arrow notches: "your car stops here".
    this.quad(-1.5, 1.5, z, z + 0.22, color, (0.75 + 0.25 * gd.pulse) * a)
    const g = this.g
    const p = this.proj
    g.fillStyle(color, 0.9 * a)
    for (const x of [-1, 0, 1]) {
      const yBar = p.yOf(z + 0.22)
      const yTip = p.yOf(z + 0.75)
      const w = (p.xOf(x + 0.16, z + 0.22) - p.xOf(x - 0.16, z + 0.22)) / 2
      g.fillTriangle(p.xOf(x, z + 0.22) - w, yBar, p.xOf(x, z + 0.22) + w, yBar, p.xOf(x, z + 0.75), yTip)
    }
  }

  private line(l: RoadLine): void {
    if (l.z < this.proj.zNear * 0.6 || l.z > Z_DRAW) return
    const a = fadeAlpha(l.z)
    if (l.kind === 'stop') {
      this.quad(-1.5, 1.5, l.z, l.z + 0.16, 0xffffff, a)
      return
    }
    // Finish: two rows of checkers across the road.
    const cols = 12
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = -1.5 + (3 * c) / cols
        const x1 = x0 + 3 / cols
        const zA = l.z + r * 0.12
        this.quad(x0, x1, zA, zA + 0.12, (r + c) % 2 === 0 ? 0x0f172a : 0xf8fafc, a)
      }
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function fadeAlpha(z: number): number {
  return clamp01((Z_STRIPES - z) / 12)
}
