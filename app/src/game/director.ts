// Pure run logic: the event queue, requeues, scoring, streaks, perks and lives.
// No Phaser here, so it can be unit tested and reasoned about on its own.
import { requeueEventFor } from '../engine/runBuilder'
import type { Rng } from '../engine/rng'
import { multiplierFor, pointsFor, streakReward } from '../engine/run'
import type { EventOutcome, PerkId, RunPlan, RunResult, StreakReward } from '../engine/run'
import type { GameEvent, RequiredAction } from '../engine/types'

export interface Queued {
  ev: GameEvent
  isRequeue: boolean
}

export interface Resolution {
  correct: boolean
  points: number
  mult: number
  streak: number
  /** Multiplier went up with this answer. */
  multUp: boolean
  reward?: StreakReward
  /** Second Chance kept the streak alive on this miss. */
  streakSaved: boolean
  requeued: boolean
}

const ACTIONS: ReadonlySet<RequiredAction> = new Set(['stop', 'slow', 'go', 'move-left', 'move-right', 'pull-over', 'brake-straight'])

/** True if the scene knows how to play this event. Malformed content is skipped, never crashes. */
export function isPlayable(ev: GameEvent | undefined | null): ev is GameEvent {
  if (!ev || typeof ev !== 'object' || !ev.id || !ev.item) return false
  if (ev.kind === 'gates') {
    return Array.isArray(ev.choices) && ev.choices.length === 3 && ev.choices.every((c) => typeof c === 'string') && [0, 1, 2].includes(ev.answer)
  }
  if (ev.kind === 'action') return ACTIONS.has(ev.action)
  return false
}

/**
 * Slow roll: in learning modes (campaign, quick play, replay, ghost) each gate or
 * hazard takes up to a full minute to reach the car at the calm cruising speed.
 * The player presses the green GO button when they are ready to speed up.
 */
export const SLOW_ROLL_WINDOW_MS = 60000
/** With GO pressed, the next gate arrives in about this long. */
export const GO_ARRIVE_MS = 4500
/** Timed and survival modes (Sign Sniper, Numbers, Hazard Rush) use this calmer base pace. */
export const BASE_WINDOW_MS = 6500
/** Never let the ramp squeeze an event below this (scaled by the learner's reaction setting). */
export const MIN_WINDOW_MS = 3000
/** An emergency vehicle behind gives this long (scaled) to pull over, even in slow roll. */
export const BEHIND_WINDOW_MS = 12000
export const DEFAULT_TIME_LIMIT: Partial<Record<RunPlan['mode'], number>> = { sniper: 90, numbers: 120 }

export function isTimedMode(plan: RunPlan): boolean {
  return plan.mode === 'sniper' || plan.mode === 'numbers'
}

export function runHasEvents(plan: RunPlan): boolean {
  return plan.events.some(isPlayable) || (plan.pool ?? []).some(isPlayable)
}

export function emptyResult(plan: RunPlan): RunResult {
  return { plan, outcomes: [], score: 0, maxStreak: 0, durationMs: 0, completed: true, slowMoUsed: 0 }
}

export class RunDirector {
  readonly plan: RunPlan
  readonly perks: ReadonlySet<PerkId>
  readonly timed: boolean
  readonly survival: boolean
  readonly timeLimitMs: number
  readonly maxMisses: number

  outcomes: EventOutcome[] = []
  score = 0
  streak = 0
  maxStreak = 0
  misses = 0
  /** Events handed out so far (drives the ramp). */
  spawned = 0
  /** Initial events plus requeues; the "7 / 18" progress total for finite modes. */
  total: number
  flareCharges: number
  slowMoCharges: number
  slowMoUsed = 0
  secondChanceReady: boolean

  private queue: Queued[]
  private readonly poolSrc: GameEvent[]
  private poolIdx = 0
  private recentItems: string[] = []
  private readonly requeued = new Set<string>()
  private readonly rng: Rng

  constructor(plan: RunPlan, perks: PerkId[], rng: Rng = Math.random) {
    this.plan = plan
    this.rng = rng
    this.perks = new Set(plan.perksAllowed ? perks : [])
    this.timed = isTimedMode(plan)
    this.survival = plan.mode === 'hazard'
    this.timeLimitMs = this.timed ? (plan.timeLimitSec ?? DEFAULT_TIME_LIMIT[plan.mode] ?? 90) * 1000 : 0
    this.maxMisses = Math.max(1, plan.maxMisses ?? 3)
    this.queue = plan.events.filter(isPlayable).map((ev) => ({ ev, isRequeue: false }))
    const pool = (plan.pool ?? []).filter(isPlayable)
    this.poolSrc = pool.length ? pool : this.queue.map((q) => q.ev)
    this.total = this.queue.length
    this.flareCharges = this.perks.has('hint-flare') ? 3 : 0
    this.slowMoCharges = this.perks.has('slow-mo') ? 2 : 0
    this.secondChanceReady = this.perks.has('second-chance')
  }

  /** Endless modes keep drawing from the pool until time or lives run out. */
  get endless(): boolean {
    return this.timed || this.survival
  }

  get livesLeft(): number {
    return Math.max(0, this.maxMisses - this.misses)
  }

  get outOfLives(): boolean {
    return this.survival && this.misses >= this.maxMisses
  }

  get hasEvents(): boolean {
    return this.queue.length > 0 || this.poolSrc.length > 0
  }

  /** Next event to spawn, or undefined when a finite run is out of events. */
  next(): Queued | undefined {
    let q = this.queue.shift()
    if (!q && this.endless && this.poolSrc.length) {
      const n = this.poolSrc.length
      // Cycle the pool, skipping items seen in the last two spawns when we can.
      for (let tries = 0; tries < n; tries++) {
        const ev = this.poolSrc[this.poolIdx % n]
        this.poolIdx++
        if (n <= 2 || !this.recentItems.includes(ev.item) || tries === n - 1) {
          q = { ev, isRequeue: false }
          break
        }
      }
    }
    if (!q) return undefined
    this.spawned++
    this.recentItems = [...this.recentItems.slice(-1), q.ev.item]
    return q
  }

  /** Remaining queued events (finite modes). */
  get remaining(): number {
    return this.queue.length
  }

  /** Learning modes roll slowly and let the player choose when to GO. */
  get slowRoll(): boolean {
    return !this.endless
  }

  /** How many times faster than cruise the road moves while GO is held on. */
  get goMultiplier(): number {
    return this.slowRoll ? SLOW_ROLL_WINDOW_MS / GO_ARRIVE_MS : 2
  }

  /** Time from spawn to the player at cruise. */
  windowMs(reactionScale: number): number {
    if (this.slowRoll) return SLOW_ROLL_WINDOW_MS
    const scale = Math.max(0.5, Math.min(3, reactionScale || 1))
    const radar = this.perks.has('radar') ? 1.3 : 1
    const ramp = Math.max(0, this.plan.ramp || 0)
    const eventsSoFar = Math.max(0, this.spawned - 1)
    const raw = (BASE_WINDOW_MS * scale * radar) / (1 + ramp * eventsSoFar)
    return Math.max(MIN_WINDOW_MS * scale, raw)
  }

  useFlare(): boolean {
    if (this.flareCharges <= 0) return false
    this.flareCharges--
    return true
  }

  useSlowMo(): boolean {
    if (this.slowMoCharges <= 0) return false
    this.slowMoCharges--
    this.slowMoUsed++
    return true
  }

  resolve(q: Queued, correct: boolean, reactionMs: number, windowMs: number, usedPerk?: PerkId): Resolution {
    const ev = q.ev
    const reaction = Math.max(0, Math.min(windowMs, Math.round(reactionMs)))
    let points = 0
    let reward: StreakReward | undefined
    let streakSaved = false
    let requeued = false
    let perk = usedPerk
    const multBefore = multiplierFor(this.streak)

    if (correct) {
      points = pointsFor(this.streak, reaction, windowMs)
      this.streak++
      this.score += points
      this.maxStreak = Math.max(this.maxStreak, this.streak)
      reward = streakReward(this.streak)
      if (reward === 'slow-mo-charge' && this.plan.perksAllowed) this.slowMoCharges++
    } else {
      this.misses++
      if (this.secondChanceReady && this.streak > 0) {
        this.secondChanceReady = false
        streakSaved = true
        perk = 'second-chance'
      } else {
        this.streak = 0
      }
      if (!this.requeued.has(ev.item) && !this.outOfLives) {
        this.requeued.add(ev.item)
        const picked = requeueEventFor(ev.item, ev.id, this.rng)
        const again = isPlayable(picked) ? picked : ev
        const at = Math.min(this.queue.length, 2 + Math.floor(this.rng() * 2))
        this.queue.splice(at, 0, { ev: again, isRequeue: true })
        this.total++
        requeued = true
      }
    }

    this.outcomes.push({
      eventId: ev.id,
      itemId: ev.item,
      kind: ev.kind,
      action: ev.kind === 'action' ? ev.action : undefined,
      correct,
      reactionMs: reaction,
      windowMs: Math.round(windowMs),
      points,
      streakAfter: this.streak,
      usedPerk: perk,
      isRequeue: q.isRequeue,
    })

    const mult = multiplierFor(this.streak)
    return { correct, points, mult, streak: this.streak, multUp: correct && mult > multBefore, reward, streakSaved, requeued }
  }

  result(completed: boolean, durationMs: number): RunResult {
    return {
      plan: this.plan,
      outcomes: this.outcomes.slice(),
      score: this.score,
      maxStreak: this.maxStreak,
      durationMs: Math.max(0, Math.round(durationMs)),
      completed,
      slowMoUsed: this.slowMoUsed,
    }
  }
}
