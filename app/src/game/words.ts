// Plain-language words for actions and props, used by the HUD and the Replay card.
import type { GameEvent, RequiredAction, SceneProp, Weather } from '../engine/types'

export const ACTION_WORDS: Record<RequiredAction, string> = {
  stop: 'Come to a full stop before the line.',
  slow: 'Slow down to half speed or less.',
  go: 'Keep going. Do not stop or crawl.',
  'move-left': 'Move over one lane to the left.',
  'move-right': 'Move over one lane to the right.',
  'pull-over': 'Pull over to the right lane and stop.',
  'brake-straight': 'Brake and stay in your lane. Do not swerve.',
}

export const ACTION_CONTROLS: Record<RequiredAction, string> = {
  stop: 'Hold BRAKE (or ↓) until you stop.',
  slow: 'Tap or hold BRAKE (or ↓) to slow down.',
  go: 'Let go of BRAKE and keep driving.',
  'move-left': 'Swipe left (or press ←).',
  'move-right': 'Swipe right (or press →).',
  'pull-over': 'Swipe right to the right lane, then hold BRAKE.',
  'brake-straight': 'Hold BRAKE. Do not change lanes.',
}

export const PROP_EMOJI: Record<SceneProp, string> = {
  'traffic-light-red': '🚦',
  'traffic-light-yellow': '🚦',
  'traffic-light-green': '🚦',
  'traffic-light-flashing-red': '🚦',
  'traffic-light-flashing-yellow': '🚦',
  'traffic-light-out': '🚦',
  'school-bus-stopped': '🚌',
  'pedestrian-crosswalk': '🚶',
  'blind-pedestrian': '🦯',
  'cyclist-ahead': '🚴',
  'motorcycle-ahead': '🏍️',
  'deer-on-road': '🦌',
  'emergency-behind': '🚑',
  'emergency-stopped': '🚓',
  'tow-truck-stopped': '🛻',
  'trash-truck-stopped': '🚛',
  'railroad-gate-down': '🚆',
  'railroad-lights-flashing': '🚆',
  'flagger-stop': '🦺',
  'flagger-slow': '🦺',
  'funeral-procession': '🚘',
  'work-zone-cones': '🚧',
  'truck-ahead': '🚚',
  'tailgater-behind': '🚗',
  'ponded-water': '💧',
  'icy-bridge': '🧊',
  'stop-line': '🛑',
  'driveway-exit': '🏠',
}

export const WEATHER_LABEL: Record<Weather, string> = {
  clear: '',
  rain: '🌧️ Rain',
  fog: '🌫️ Fog',
  night: '🌙 Night',
  snow: '❄️ Snow',
}

export function eventImage(ev: GameEvent): string | undefined {
  return ev.kind === 'gates' ? ev.image : ev.sign
}

/** The generic "emergency vehicle behind" is an ambulance; a prompt about police gets a police car. */
export function isPoliceBehind(ev: GameEvent): boolean {
  return ev.kind === 'action' && (ev.prop === 'emergency-behind' || (!ev.prop && ev.action === 'pull-over')) && /\b(police|officer|trooper)/i.test(ev.prompt)
}

export function propEmoji(ev: GameEvent): string | undefined {
  if (ev.kind !== 'action') return undefined
  if (isPoliceBehind(ev)) return '🚓'
  if (ev.prop && PROP_EMOJI[ev.prop]) return PROP_EMOJI[ev.prop]
  if (ev.action === 'pull-over') return '🚑'
  if (ev.action === 'brake-straight') return '🦌'
  return undefined
}

export function correctText(ev: GameEvent): string {
  if (ev.kind === 'gates') return ev.choices[ev.answer] ?? ''
  return ACTION_WORDS[ev.action] ?? ''
}
