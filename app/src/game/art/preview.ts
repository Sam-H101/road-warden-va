// Art sheet: lays out every texture in a labeled grid so the integrator can
// screenshot and inspect the art. Usage inside any scene's create():
//   const sheet = renderArtSheet(this)
//   // sheet.height = total pixel height; the mouse wheel scrolls the camera.
//   // sheet.destroy() removes everything.
import Phaser from 'phaser'
import { CAR_STYLES, allTextureKeys, carTextureKey, ensureTextures } from './textures'

export interface ArtSheetOptions {
  /** cell size in px (default 190) */
  cell?: number
  /** sheet width (default: scene scale width) */
  width?: number
  /** extra car variants: [style, paint, decal] (default: a small showcase) */
  cars?: ReadonlyArray<readonly [string, string, string]>
}

export interface ArtSheet {
  objects: Phaser.GameObjects.GameObject[]
  height: number
  destroy: () => void
}

const SHOWCASE: ReadonlyArray<readonly [string, string, string]> = [
  ['compact', '#ef4444', '⭐'],
  ['muscle', '#f8fafc', '🔥'],
  ['hyper', '#1f2937', '⚡'],
  ['legend', '#fbbf24', '👑'],
  ['rally', '#84cc16', '🏁'],
  ['pickup', '#64748b', ''],
]

export function renderArtSheet(scene: Phaser.Scene, opts: ArtSheetOptions = {}): ArtSheet {
  ensureTextures(scene)
  const cell = opts.cell ?? 190
  const width = opts.width ?? scene.scale.width
  const pad = 10
  const labelH = 30
  const cols = Math.max(1, Math.floor((width - pad) / (cell + pad)))

  const entries: Array<{ key: string; label: string }> = []
  for (const style of CAR_STYLES) entries.push({ key: carTextureKey(scene, style, '#38bdf8', ''), label: `car ${style}` })
  for (const [style, paint, decal] of opts.cars ?? SHOWCASE) {
    entries.push({ key: carTextureKey(scene, style, paint, decal), label: `${style} ${paint} ${decal}`.trim() })
  }
  for (const key of allTextureKeys()) entries.push({ key, label: key })

  const objects: Phaser.GameObjects.GameObject[] = []
  const bg = scene.add.graphics()
  objects.push(bg)

  entries.forEach((e, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = pad + col * (cell + pad)
    const y = pad + row * (cell + labelH + pad)
    // Alternate road-gray and grass so outlines and light colors both show.
    bg.fillStyle((row + col) % 2 === 0 ? 0x4b5563 : 0x3f7d3a, 1)
    bg.fillRoundedRect(x, y, cell, cell + labelH, 8)
    bg.fillStyle(0x0f172a, 0.85)
    bg.fillRect(x, y + cell, cell, labelH)
    if (!scene.textures.exists(e.key)) return
    const img = scene.add.image(x + cell / 2, y + cell - 8, e.key).setOrigin(0.5, 1)
    const s = Math.min(1, (cell - 16) / img.width, (cell - 16) / img.height)
    img.setScale(s)
    const txt = scene.add
      .text(x + cell / 2, y + cell + labelH / 2, e.label, {
        fontFamily: 'Lexend, Arial, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: cell - 8 },
      })
      .setOrigin(0.5)
    const dims = scene.add
      .text(x + 6, y + 4, `${img.width}x${img.height}`, { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#e2e8f0' })
      .setAlpha(0.8)
    objects.push(img, txt, dims)
  })

  const rows = Math.ceil(entries.length / cols)
  const height = pad + rows * (cell + labelH + pad)

  const cam = scene.cameras.main
  const onWheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, height - cam.height))
  }
  scene.input.on('wheel', onWheel)

  return {
    objects,
    height,
    destroy: () => {
      scene.input.off('wheel', onWheel)
      for (const o of objects) o.destroy()
    },
  }
}
