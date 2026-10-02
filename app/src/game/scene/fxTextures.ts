// Small effect textures the road scene needs (particles, sky, fog, night, vignette).
// Drawn on canvases so they work with both the WebGL and Canvas renderers.
import Phaser from 'phaser'
import type { Weather } from '../../engine/types'
import { THEMES } from './theme'

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return
  const tex = scene.textures.createCanvas(key, w, h)
  if (!tex) return
  const ctx = tex.getContext()
  try {
    draw(ctx, w, h)
  } catch {
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, w, h)
  }
  tex.refresh()
}

export const FX = {
  dot: 'fx-dot',
  spark: 'fx-spark',
  rain: 'fx-rain',
  snow: 'fx-snow',
  hillsFar: 'fx-hills-far',
  hillsNear: 'fx-hills-near',
  haze: 'fx-haze',
  fog: 'fx-fog',
  night: 'fx-night',
  vignette: 'fx-vignette',
  caution: 'fx-caution',
  train: 'fx-train',
  car: 'fx-car-fallback',
  missing: 'fx-missing',
  flare: 'fx-flare',
  checker: 'fx-checker',
} as const

export const skyKey = (w: Weather) => `fx-sky-${w}`

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function hills(ctx: CanvasRenderingContext2D, w: number, h: number, waves: [number, number, number][], base: number) {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 4) {
    let y = base
    for (const [amp, periods, phase] of waves) y -= amp * (0.5 + 0.5 * Math.sin((x / w) * Math.PI * 2 * periods + phase))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

export function ensureFxTextures(scene: Phaser.Scene): void {
  canvasTex(scene, FX.dot, 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
  })
  canvasTex(scene, FX.spark, 32, 32, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 16 : 5
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      ctx.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  })
  canvasTex(scene, FX.rain, 4, 40, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 40)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(255,255,255,0.9)')
    ctx.fillStyle = g
    ctx.fillRect(1, 0, 2, 40)
  })
  canvasTex(scene, FX.snow, 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 16)
  })
  for (const w of Object.keys(THEMES) as Weather[]) {
    canvasTex(scene, skyKey(w), 4, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256)
      g.addColorStop(0, THEMES[w].skyTop)
      g.addColorStop(1, THEMES[w].skyBottom)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 4, 256)
    })
  }
  canvasTex(scene, FX.hillsFar, 1024, 128, (ctx, w, h) =>
    hills(ctx, w, h, [[46, 2, 0.4], [30, 5, 1.7], [12, 11, 0.2]], 120),
  )
  canvasTex(scene, FX.hillsNear, 1024, 96, (ctx, w, h) =>
    hills(ctx, w, h, [[30, 3, 2.1], [18, 7, 0.9], [8, 17, 1.3]], 92),
  )
  canvasTex(scene, FX.haze, 4, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 128)
  })
  canvasTex(scene, FX.fog, 4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.97)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0.18)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 256)
  })
  canvasTex(scene, FX.night, 512, 512, (ctx) => {
    ctx.fillStyle = 'rgba(2,6,23,0.82)'
    ctx.fillRect(0, 0, 512, 512)
    // Headlight cone: from the car (bottom center) widening up the road.
    ctx.globalCompositeOperation = 'destination-out'
    const g = ctx.createRadialGradient(256, 470, 10, 256, 330, 300)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.85)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(206, 500)
    ctx.lineTo(306, 500)
    ctx.lineTo(470, 120)
    ctx.lineTo(42, 120)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  })
  canvasTex(scene, FX.vignette, 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(255,255,255,1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  })
  canvasTex(scene, FX.caution, 200, 200, (ctx) => {
    ctx.translate(100, 100)
    ctx.rotate(Math.PI / 4)
    roundRect(ctx, -66, -66, 132, 132, 14)
    ctx.fillStyle = '#facc15'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#111827'
    ctx.stroke()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#111827'
    ctx.font = '900 96px Lexend, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', 100, 106)
  })
  canvasTex(scene, FX.missing, 200, 200, (ctx) => {
    roundRect(ctx, 8, 8, 184, 184, 18)
    ctx.fillStyle = '#f8fafc'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#111827'
    ctx.stroke()
    ctx.fillStyle = '#111827'
    ctx.font = '900 110px Lexend, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', 100, 108)
  })
  canvasTex(scene, FX.train, 720, 120, (ctx) => {
    for (let c = 0; c < 3; c++) {
      const x = c * 240 + 6
      roundRect(ctx, x, 10, 228, 100, 14)
      ctx.fillStyle = c === 0 ? '#1d4ed8' : '#475569'
      ctx.fill()
      ctx.lineWidth = 5
      ctx.strokeStyle = '#0f172a'
      ctx.stroke()
      ctx.fillStyle = '#bae6fd'
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 18 + k * 52, 26, 38, 30)
      ctx.fillStyle = '#facc15'
      ctx.fillRect(x + 6, 72, 216, 8)
    }
  })
  canvasTex(scene, FX.car, 160, 112, (ctx) => {
    roundRect(ctx, 14, 30, 132, 70, 18)
    ctx.fillStyle = '#38bdf8'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
    roundRect(ctx, 38, 8, 84, 34, 12)
    ctx.fillStyle = '#7dd3fc'
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(22, 56, 24, 12)
    ctx.fillRect(114, 56, 24, 12)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(22, 96, 28, 14)
    ctx.fillRect(110, 96, 28, 14)
  })
  canvasTex(scene, FX.flare, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,200,80,0.9)')
    g.addColorStop(1, 'rgba(255,120,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
  canvasTex(scene, FX.checker, 64, 32, (ctx) => {
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#0f172a' : '#f8fafc'
        ctx.fillRect(x * 16, y * 16, 16, 16)
      }
  })
}
