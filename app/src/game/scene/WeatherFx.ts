// Weather overlays: rain and snow particles, fog gradient, night darkness with a
// headlight cone that follows the car.
import Phaser from 'phaser'
import type { Weather } from '../../engine/types'
import { FX } from './fxTextures'
import type { Projection } from './projection'

export class WeatherFx {
  private readonly scene: Phaser.Scene
  private readonly proj: Projection
  private readonly rain: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly snow: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly fog: Phaser.GameObjects.Image
  private readonly night: Phaser.GameObjects.Image
  private readonly nightFloor: Phaser.GameObjects.Rectangle
  private current: Weather = 'clear'
  private reduced = false

  constructor(scene: Phaser.Scene, proj: Projection) {
    this.scene = scene
    this.proj = proj
    const p = proj
    this.rain = scene.add.particles(0, 0, FX.rain, {
      x: { onEmit: () => Math.random() * p.W * 1.3 - p.W * 0.15 },
      y: { onEmit: () => -40 * p.dpr },
      speedY: { onEmit: () => (1300 + Math.random() * 500) * (p.H / 800) },
      speedX: { onEmit: () => -180 * (p.H / 800) },
      rotate: 8,
      scaleX: { onEmit: () => p.dpr },
      scaleY: { onEmit: () => p.dpr * (0.8 + Math.random() * 0.6) },
      alpha: { start: 0.65, end: 0.3 },
      lifespan: { onEmit: () => 900 },
      quantity: 2,
      frequency: 14,
      emitting: false,
    })
    this.rain.setDepth(1900)
    this.snow = scene.add.particles(0, 0, FX.snow, {
      x: { onEmit: () => Math.random() * p.W * 1.2 - p.W * 0.1 },
      y: { onEmit: () => -20 * p.dpr },
      speedY: { onEmit: () => (110 + Math.random() * 160) * (p.H / 800) },
      speedX: { onEmit: () => (Math.random() - 0.5) * 90 * (p.H / 800) },
      scale: { onEmit: () => p.dpr * (0.5 + Math.random() * 0.9) },
      alpha: { start: 0.95, end: 0.6 },
      lifespan: { onEmit: () => 5200 },
      quantity: 1,
      frequency: 40,
      emitting: false,
    })
    this.snow.setDepth(1900)
    this.fog = scene.add.image(0, 0, FX.fog).setOrigin(0, 0).setDepth(1880).setVisible(false).setTint(0xdfe6ee)
    this.night = scene.add.image(0, 0, FX.night).setOrigin(0.5, 1).setDepth(1890).setVisible(false)
    this.nightFloor = scene.add.rectangle(0, 0, 10, 10, 0x020617, 0.82).setOrigin(0, 0).setDepth(1890).setVisible(false)
  }

  get emitters(): Phaser.GameObjects.Particles.ParticleEmitter[] {
    return [this.rain, this.snow]
  }

  get weather(): Weather {
    return this.current
  }

  set(w: Weather, reducedMotion: boolean): void {
    const next = w ?? 'clear'
    if (next === this.current && reducedMotion === this.reduced) return
    this.current = next
    this.reduced = reducedMotion
    this.rain.stop()
    this.snow.stop()
    this.rain.frequency = reducedMotion ? 60 : 14
    this.snow.frequency = reducedMotion ? 160 : 40
    if (next === 'rain') this.rain.start()
    if (next === 'snow') this.snow.start()
    this.fadeTo(this.fog, next === 'fog')
    this.fadeTo(this.night, next === 'night')
    this.nightFloor.setVisible(next === 'night')
    this.layout()
  }

  private fadeTo(img: Phaser.GameObjects.Image, on: boolean): void {
    this.scene.tweens.killTweensOf(img)
    if (on) {
      img.setVisible(true)
      if (this.reduced) img.setAlpha(1)
      else {
        img.setAlpha(0)
        this.scene.tweens.add({ targets: img, alpha: 1, duration: 500 })
      }
    } else if (img.visible) {
      if (this.reduced) img.setVisible(false)
      else this.scene.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.setVisible(false) })
    }
  }

  layout(): void {
    const p = this.proj
    const fogTop = p.horizonY - p.H * 0.18
    this.fog.setPosition(0, fogTop).setDisplaySize(p.W, p.H - fogTop)
    const size = Math.max(p.W, p.H) * 1.8
    this.night.setDisplaySize(size, p.H * 1.35)
    this.nightFloor.setPosition(0, p.H - 2).setSize(p.W, 4)
  }

  /** Keep the headlight cone on the car. */
  follow(carX: number): void {
    if (this.current !== 'night') return
    this.night.setPosition(carX, this.proj.baseY + this.proj.H * 0.06)
    const bottom = this.proj.baseY + this.proj.H * 0.06
    this.nightFloor.setPosition(0, bottom - 1).setSize(this.proj.W, Math.max(0, this.proj.H - bottom + 2))
  }
}
