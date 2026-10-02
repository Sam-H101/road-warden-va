// STUB — the game-art agent replaces the implementations; keep the exported API.
import Phaser from 'phaser'
import type { SceneProp } from '../../engine/types'

export const PROP_INFO: Record<SceneProp, { side: 'road' | 'left' | 'right' | 'behind' | 'overhead'; width: number; height: number; clearedKey?: string }> = {
  'traffic-light-red': { side: 'right', width: 60, height: 160, clearedKey: 'prop-traffic-light-green' },
  'traffic-light-yellow': { side: 'right', width: 60, height: 160 },
  'traffic-light-green': { side: 'right', width: 60, height: 160 },
  'traffic-light-flashing-red': { side: 'right', width: 60, height: 160 },
  'traffic-light-flashing-yellow': { side: 'right', width: 60, height: 160 },
  'traffic-light-out': { side: 'right', width: 60, height: 160 },
  'school-bus-stopped': { side: 'road', width: 220, height: 200, clearedKey: 'prop-school-bus-cleared' },
  'pedestrian-crosswalk': { side: 'road', width: 260, height: 120, clearedKey: 'prop-crosswalk-empty' },
  'blind-pedestrian': { side: 'road', width: 260, height: 120, clearedKey: 'prop-crosswalk-empty' },
  'cyclist-ahead': { side: 'road', width: 80, height: 120 },
  'motorcycle-ahead': { side: 'road', width: 80, height: 120 },
  'deer-on-road': { side: 'road', width: 140, height: 140 },
  'emergency-behind': { side: 'behind', width: 180, height: 140 },
  'emergency-stopped': { side: 'right', width: 200, height: 140 },
  'tow-truck-stopped': { side: 'right', width: 220, height: 160 },
  'trash-truck-stopped': { side: 'right', width: 220, height: 180 },
  'railroad-gate-down': { side: 'road', width: 300, height: 180, clearedKey: 'prop-railroad-gate-up' },
  'railroad-lights-flashing': { side: 'right', width: 120, height: 180, clearedKey: 'prop-railroad-lights-off' },
  'flagger-stop': { side: 'right', width: 90, height: 160, clearedKey: 'prop-flagger-slow' },
  'flagger-slow': { side: 'right', width: 90, height: 160 },
  'funeral-procession': { side: 'road', width: 300, height: 120, clearedKey: 'prop-crosswalk-empty' },
  'work-zone-cones': { side: 'right', width: 220, height: 80 },
  'truck-ahead': { side: 'road', width: 200, height: 220 },
  'tailgater-behind': { side: 'behind', width: 180, height: 140 },
  'ponded-water': { side: 'road', width: 240, height: 60 },
  'icy-bridge': { side: 'road', width: 300, height: 80 },
  'stop-line': { side: 'road', width: 300, height: 30 },
  'driveway-exit': { side: 'road', width: 300, height: 60 },
}

function boxTexture(scene: Phaser.Scene, key: string, w: number, h: number, color: number) {
  if (scene.textures.exists(key)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(color, 1)
  g.fillRoundedRect(0, 0, w, h, 8)
  g.lineStyle(4, 0x000000, 1)
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 8)
  g.generateTexture(key, w, h)
  g.destroy()
}

export function ensureTextures(scene: Phaser.Scene): void {
  for (const [prop, info] of Object.entries(PROP_INFO)) {
    boxTexture(scene, `prop-${prop}`, info.width, info.height, 0xff9900)
    if (info.clearedKey) boxTexture(scene, info.clearedKey, info.width, info.height, 0x22cc55)
  }
  for (const k of sceneryKeys()) boxTexture(scene, k, 60, 120, 0x2f855a)
  for (const k of vehicleKeys()) boxTexture(scene, k, 120, 90, 0x94a3b8)
}

export function carTextureKey(scene: Phaser.Scene, style: string, paint: string, decal: string): string {
  const key = `car-${style}-${paint}-${decal}`
  const color = Phaser.Display.Color.HexStringToColor(paint || '#38bdf8').color
  boxTexture(scene, key, 140, 100, color)
  return key
}

export function propTextureKey(prop: SceneProp): string {
  return `prop-${prop}`
}

export function sceneryKeys(): string[] {
  return ['scenery-tree', 'scenery-pine', 'scenery-pole', 'scenery-bush', 'scenery-house']
}

export function vehicleKeys(): string[] {
  return ['traffic-car-a', 'traffic-car-b', 'traffic-van']
}
