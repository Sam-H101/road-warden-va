import type { SceneProp } from '../../engine/types'

/**
 * Placement + size for every scene prop. Texture key is `prop-<name>` and the
 * texture is exactly `width` x `height` px at scale 1 (depth z = 1).
 *
 * Anchor: every prop stands on its bottom edge. Use `setOrigin(0.5, 1)` and
 * place the origin on the ground point. Flat road markings (stop-line,
 * ponded-water, icy-bridge, driveway-exit) also anchor bottom-center.
 *
 * side:
 * - road: in the travel lanes (center it on the lane or the road)
 * - left / right: on that shoulder
 * - behind: comes up from the bottom of the screen
 * - overhead: spans the road above (unused today)
 *
 * clearedKey: texture to swap to once the stop hazard clears (light turns
 *   green, bus folds its arm, pedestrian has crossed, gate lifts, flagger
 *   flips to SLOW, procession has passed). Same size as the prop.
 *
 * flashKey: second animation frame (usually `prop-<name>-b`) for flashing
 *   lights. Alternate key / flashKey every ~350 ms. With reduced motion just
 *   show `prop-<name>` (frame A always shows the hazard lit).
 */
export interface PropInfo {
  side: 'road' | 'left' | 'right' | 'behind' | 'overhead'
  width: number
  height: number
  clearedKey?: string
  flashKey?: string
}

export const PROP_INFO: Record<SceneProp, PropInfo> = {
  'traffic-light-red': { side: 'right', width: 80, height: 200, clearedKey: 'prop-traffic-light-green' },
  'traffic-light-yellow': { side: 'right', width: 80, height: 200 },
  'traffic-light-green': { side: 'right', width: 80, height: 200 },
  'traffic-light-flashing-red': { side: 'right', width: 80, height: 200, flashKey: 'prop-traffic-light-flashing-red-b' },
  'traffic-light-flashing-yellow': { side: 'right', width: 80, height: 200, flashKey: 'prop-traffic-light-flashing-yellow-b' },
  'traffic-light-out': { side: 'right', width: 80, height: 200 },
  'school-bus-stopped': { side: 'road', width: 250, height: 214, clearedKey: 'prop-school-bus-cleared', flashKey: 'prop-school-bus-stopped-b' },
  'pedestrian-crosswalk': { side: 'road', width: 300, height: 160, clearedKey: 'prop-crosswalk-empty' },
  'blind-pedestrian': { side: 'road', width: 300, height: 160, clearedKey: 'prop-crosswalk-empty' },
  'cyclist-ahead': { side: 'road', width: 96, height: 144 },
  'motorcycle-ahead': { side: 'road', width: 112, height: 144 },
  'deer-on-road': { side: 'road', width: 170, height: 144 },
  'emergency-behind': { side: 'behind', width: 180, height: 176, flashKey: 'prop-emergency-behind-b' },
  'emergency-stopped': { side: 'right', width: 180, height: 140, flashKey: 'prop-emergency-stopped-b' },
  'tow-truck-stopped': { side: 'right', width: 200, height: 176, flashKey: 'prop-tow-truck-stopped-b' },
  'trash-truck-stopped': { side: 'right', width: 210, height: 204, flashKey: 'prop-trash-truck-stopped-b' },
  'railroad-gate-down': { side: 'road', width: 330, height: 232, clearedKey: 'prop-railroad-gate-up', flashKey: 'prop-railroad-gate-down-b' },
  'railroad-lights-flashing': { side: 'right', width: 130, height: 204, clearedKey: 'prop-railroad-lights-off', flashKey: 'prop-railroad-lights-flashing-b' },
  'flagger-stop': { side: 'right', width: 112, height: 184, clearedKey: 'prop-flagger-slow' },
  'flagger-slow': { side: 'right', width: 112, height: 184 },
  'funeral-procession': { side: 'road', width: 330, height: 128, clearedKey: 'prop-funeral-cleared' },
  'work-zone-cones': { side: 'right', width: 240, height: 104, flashKey: 'prop-work-zone-cones-b' },
  'truck-ahead': { side: 'road', width: 220, height: 252 },
  'tailgater-behind': { side: 'behind', width: 176, height: 132 },
  'ponded-water': { side: 'road', width: 260, height: 70 },
  'icy-bridge': { side: 'road', width: 320, height: 100 },
  'stop-line': { side: 'road', width: 300, height: 56 },
  'driveway-exit': { side: 'road', width: 300, height: 72 },
}
