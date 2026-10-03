// Creates and owns the Phaser.Game for one run. Loaded lazily by GameView so the
// Phaser bundle is only fetched when the learner actually drives.
import Phaser from 'phaser'
import type { RunResult } from '../engine/run'
import type { Command } from './protocol'
import { RoadScene, type SceneInit } from './RoadScene'

export interface GameHandle {
  send(cmd: Command): void
  partialResult(): RunResult
  destroy(): void
}

const MAX_DPR = 2

function pixelRatio(): number {
  return Math.max(1, Math.min(MAX_DPR, window.devicePixelRatio || 1))
}

export function createGame(parent: HTMLElement, init: SceneInit): GameHandle {
  let dpr = pixelRatio()
  const size = () => ({ w: Math.max(1, parent.clientWidth), h: Math.max(1, parent.clientHeight) })
  const { w, h } = size()
  const scene = new RoadScene(init)

  // The canvas renders at device pixels (crisp text on phones) and is shown at
  // CSS size through the scale manager's zoom.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b1020',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: true, mouse: false, touch: false, gamepad: false },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
      zoom: 1 / dpr,
    },
    scene: [scene],
  })

  // Dev only: lets automated play tests drive the scene.
  if (import.meta.env.DEV) (window as unknown as { __roadScene?: RoadScene }).__roadScene = scene

  let raf = 0
  const resize = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const s = size()
      const next = pixelRatio()
      if (next !== dpr) {
        dpr = next
        game.scale.setZoom(1 / dpr)
      }
      game.scale.resize(Math.round(s.w * dpr), Math.round(s.h * dpr))
    })
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  ro?.observe(parent)
  window.addEventListener('orientationchange', resize)

  let destroyed = false
  return {
    send: (cmd) => init.bus.emit('cmd', cmd),
    partialResult: () => scene.partialResult(),
    destroy: () => {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('orientationchange', resize)
      if (import.meta.env.DEV) {
        const w = window as unknown as { __roadScene?: RoadScene }
        if (w.__roadScene === scene) delete w.__roadScene
      }
      try {
        game.destroy(true)
      } catch (err) {
        console.warn('[game] destroy failed', err)
      }
    },
  }
}
