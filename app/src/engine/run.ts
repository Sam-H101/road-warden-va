// Run plans (what the road will throw at you) and run results (what happened).
import type { DistrictId, GameEvent, RequiredAction } from './types'

export type RunMode =
  | 'mission' // campaign mission in a district
  | 'quick' // scheduler picks what is due
  | 'sniper' // signs only, 90 seconds, speed ramps
  | 'hazard' // survival until 3 misses
  | 'numbers' // numeric facts only
  | 'replay' // recent misses only
  | 'ghost' // race your best run of a mission

export interface RunPlan {
  mode: RunMode
  key: string // stable key for best scores / ghosts, e.g. "mission:d03-regulatory:1"
  title: string
  district?: DistrictId
  missionIndex?: number
  events: GameEvent[] // initial queue, in order
  timeLimitSec?: number // sniper
  maxMisses?: number // hazard
  /** Events per second ramp for timed / survival modes (0 = fixed pacing). */
  ramp: number
  /** Pool to draw more events from in endless modes (sniper, hazard). */
  pool?: GameEvent[]
  ghostScore?: number // best score to race
  perksAllowed: boolean
  newItemIds: string[] // items introduced in this run (for briefing)
}

export interface EventOutcome {
  eventId: string
  itemId: string
  kind: GameEvent['kind']
  action?: RequiredAction
  correct: boolean
  reactionMs: number // time from spawn to decision
  windowMs: number // time available
  points: number
  streakAfter: number
  usedPerk?: PerkId
  isRequeue: boolean // re-shown later after a miss
}

export interface RunResult {
  plan: RunPlan
  outcomes: EventOutcome[]
  score: number
  maxStreak: number
  durationMs: number
  completed: boolean // false if the player quit early
  slowMoUsed: number
}

export type PerkId = 'hint-flare' | 'slow-mo' | 'second-chance' | 'radar'

// ---------- scoring ----------

export const BASE_POINTS = 100

export function multiplierFor(streak: number): number {
  if (streak >= 10) return 5
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

/** Points for a correct answer: base x multiplier + speed bonus up to 50. */
export function pointsFor(streakBefore: number, reactionMs: number, windowMs: number): number {
  const mult = multiplierFor(streakBefore + 1)
  const speed = windowMs > 0 ? Math.max(0, 1 - reactionMs / windowMs) : 0
  return Math.round(BASE_POINTS * mult + 50 * speed)
}

export type StreakReward = 'horn' | 'nitro' | 'slow-mo-charge' | 'gold-trail'

/** Reward triggered when the streak reaches exactly this number. */
export function streakReward(streak: number): StreakReward | undefined {
  if (streak === 20 || (streak > 20 && streak % 10 === 0)) return 'gold-trail'
  if (streak === 15) return 'slow-mo-charge'
  if (streak === 10) return 'nitro'
  if (streak === 5) return 'horn'
  return undefined
}

/** XP for a run: everything counts, XP always goes up, even on a bad run. */
export function xpForRun(result: RunResult, medalCount: number): number {
  const correct = result.outcomes.filter((o) => o.correct).length
  const attempted = result.outcomes.length
  const base = 25 // showing up counts
  const fromAnswers = correct * 12 + (attempted - correct) * 3
  const fromScore = Math.floor(result.score / 100)
  const completion = result.completed ? 40 : 0
  return base + fromAnswers + fromScore + completion + medalCount * 25
}
