// Public art API. Procedural textures for the driving scene: player cars,
// scene props (with cleared + flash frames), roadside scenery and traffic.
//
// Conventions for the scene:
// - Every texture stands on its bottom edge: use setOrigin(0.5, 1).
// - Prop textures are exactly PROP_INFO[prop].width x height at depth z = 1.
// - Flashing props have a second frame at PROP_INFO[prop].flashKey; alternate
//   every ~350 ms unless reduced motion is on.
// - After a stop hazard clears, swap to PROP_INFO[prop].clearedKey (same size).
import type Phaser from 'phaser'
import type { SceneProp } from '../../engine/types'
import { bake, cssColor, fallbackBox, hexToNum } from './draw'
import { PROP_INFO } from './propInfo'
import { propDefs } from './props'
import type { TexDef } from './props'
import { BILLBOARD_KEY, SCENERY_KEYS, sceneryDefs } from './scenery'
import { CAR_H, CAR_W, drawPlayerCar, isCarStyle, playerCarLabels, trafficDefs } from './vehicles'

export { PROP_INFO } from './propInfo'
export type { PropInfo } from './propInfo'
export { BILLBOARD_KEY, BILLBOARD_PANEL, BILLBOARD_W, BILLBOARD_H } from './scenery'
export { CAR_W, CAR_H, CAR_STYLES } from './vehicles'

const DEFAULT_PAINT = 0x38bdf8

function allDefs(): TexDef[] {
  return [...propDefs(), ...sceneryDefs(), ...trafficDefs()]
}

/** Generate every static texture once (safe to call on every scene create). */
export function ensureTextures(scene: Phaser.Scene): void {
  for (const def of allDefs()) bake(scene, def.key, def.w, def.h, def.draw, def.labels)
  // Belt and braces: anything PROP_INFO promises must exist.
  for (const [prop, info] of Object.entries(PROP_INFO)) {
    fallbackBox(scene, `prop-${prop}`, info.width, info.height)
    if (info.clearedKey) fallbackBox(scene, info.clearedKey, info.width, info.height)
    if (info.flashKey) fallbackBox(scene, info.flashKey, info.width, info.height)
  }
}

/**
 * Rear-view player car, CAR_W x CAR_H. Cached per (style, paint, decal).
 * Unknown style falls back to compact; bad paint falls back to sky blue; an
 * empty decal draws no sticker.
 */
export function carTextureKey(scene: Phaser.Scene, style: string, paint: string, decal: string): string {
  const s = isCarStyle(style) ? style : 'compact'
  const color = hexToNum(paint, DEFAULT_PAINT)
  const d = (decal || '').trim()
  const key = `car-${s}-${cssColor(color)}${d ? `-${d}` : ''}`
  bake(scene, key, CAR_W, CAR_H, (g) => drawPlayerCar(g, s, color, d.length > 0), () => playerCarLabels(s, d))
  return key
}

export function propTextureKey(prop: SceneProp): string {
  return `prop-${prop}`
}

/** Roadside scenery for random placement (does not include the blank billboard). */
export function sceneryKeys(): string[] {
  return [...SCENERY_KEYS]
}

/** Ambient traffic, rear view. */
export function vehicleKeys(): string[] {
  return trafficDefs().map((d) => d.key)
}

/** Every static texture key ensureTextures creates (for previews / debugging). */
export function allTextureKeys(): string[] {
  return allDefs().map((d) => d.key)
}

/** The blank billboard frame; overlay the event sign inside BILLBOARD_PANEL. */
export function billboardKey(): string {
  return BILLBOARD_KEY
}
