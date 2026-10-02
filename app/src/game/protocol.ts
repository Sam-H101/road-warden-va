// Messages that flow between the Phaser scene and the React HUD.
// The scene is the source of truth for the run; React only renders and sends commands.
import type { GameEvent, RequiredAction, SceneProp, Weather } from '../engine/types'
import type { PerkId, RunMode, RunResult } from '../engine/run'

export type Lane = 0 | 1 | 2

/** Fixed lane colors so the HUD choice chips match the gates on the road. */
export const LANE_COLORS = [0x38bdf8, 0xa78bfa, 0xfb923c] as const
export const LANE_CSS = ['#38bdf8', '#a78bfa', '#fb923c'] as const
export const LANE_NAMES = ['LEFT', 'MIDDLE', 'RIGHT'] as const

export interface LaneChoice {
  label: string
  /** Knocked out by a hint flare. */
  removed: boolean
  /** Set after the decision so the HUD can show the right answer. */
  correct?: boolean
}

export type PromptStatus = 'live' | 'correct' | 'miss'

export interface PromptInfo {
  /** Unique per spawn (the same event can come back as a requeue). */
  key: string
  eventId: string
  kind: GameEvent['kind']
  text: string
  image?: string
  prop?: SceneProp
  weather?: Weather
  action?: RequiredAction
  /** Gates only: what is written on each lane's gate (index = lane). */
  lanes?: [LaneChoice, LaneChoice, LaneChoice]
  isRequeue: boolean
  status: PromptStatus
  /** Short live coaching line, e.g. "Wait for it..." while stopped. */
  note?: string
}

export interface PerkHud {
  flare?: { charges: number; usable: boolean }
  slowMo?: { charges: number; usable: boolean; active: boolean }
  secondChance?: 'ready' | 'used'
  radar?: boolean
}

export type Phase = 'loading' | 'countdown' | 'drive' | 'replay' | 'ending' | 'done'

export interface HudState {
  phase: Phase
  mode: RunMode
  score: number
  streak: number
  mult: number
  progress?: { done: number; total: number }
  timeLeftMs?: number
  timeTotalMs?: number
  lives?: { left: number; max: number }
  ghostDelta?: number
  speed: number // 0..1 of cruise
  mph: number
  braking: boolean
  /** GO is on: the car is speeding up toward the next gate. */
  going: boolean
  /** The GO button can be pressed right now. */
  goAvailable: boolean
  /** Seconds until the current gate or hazard reaches the car, while it is live. */
  etaSec?: number
  /** Learning modes: slow roll with up to a minute per gate. */
  slowRoll: boolean
  lane: Lane
  perks: PerkHud
  nitro: boolean
  siren: boolean
  slowMo: boolean
}

export interface ReplayInfo {
  key: string
  image?: string
  propEmoji?: string
  prompt: string
  /** The right answer, or the right action in plain words. */
  correctText: string
  /** Which control does that action, e.g. "Hold BRAKE". */
  controlHint?: string
  missLine: string
  encouragement?: string
  livesLeft?: number
  streakSaved: boolean
}

export type BannerTone = 'streak' | 'nitro' | 'good' | 'info' | 'finish'

export interface BannerInfo {
  id: number
  text: string
  sub?: string
  tone: BannerTone
  durationMs: number
}

export type Command =
  | { type: 'lane'; dir: -1 | 1 }
  | { type: 'to-lane'; lane: Lane }
  | { type: 'brake'; down: boolean }
  | { type: 'horn' }
  | { type: 'go' }
  | { type: 'perk'; id: Extract<PerkId, 'hint-flare' | 'slow-mo'> }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'skip-countdown' }
  | { type: 'replay-done' }

export interface BusEvents {
  hud: HudState
  prompt: PromptInfo | null
  replay: ReplayInfo | null
  banner: BannerInfo
  countdown: number | 'GO' | null
  paused: boolean
  finish: RunResult
  cmd: Command
}
