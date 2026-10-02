import { describe, it, expect } from 'vitest'
import {
  BASE_POINTS,
  multiplierFor,
  pointsFor,
  streakReward,
  xpForRun,
  type EventOutcome,
  type RunPlan,
  type RunResult,
} from './run'

const plan: RunPlan = { mode: 'quick', key: 'quick', title: 'Quick', events: [], ramp: 0, perksAllowed: true, newItemIds: [] }

function outcome(correct: boolean, i = 0): EventOutcome {
  return {
    eventId: `e${i}`,
    itemId: `i${i}`,
    kind: 'gates',
    correct,
    reactionMs: 1000,
    windowMs: 3500,
    points: correct ? 100 : 0,
    streakAfter: 0,
    isRequeue: false,
  }
}

function result(pattern: boolean[], extra: Partial<RunResult> = {}): RunResult {
  return {
    plan,
    outcomes: pattern.map((c, i) => outcome(c, i)),
    score: 0,
    maxStreak: 0,
    durationMs: 60000,
    completed: true,
    slowMoUsed: 0,
    ...extra,
  }
}

describe('multiplierFor', () => {
  it('follows the streak thresholds 3 / 6 / 10', () => {
    const table: [number, number][] = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 2],
      [5, 2],
      [6, 3],
      [9, 3],
      [10, 5],
      [50, 5],
    ]
    for (const [streak, mult] of table) expect(multiplierFor(streak)).toBe(mult)
  })

  it('never decreases as the streak grows', () => {
    for (let s = 1; s < 40; s++) expect(multiplierFor(s)).toBeGreaterThanOrEqual(multiplierFor(s - 1))
  })
})

describe('pointsFor', () => {
  it('uses the multiplier of the streak after this answer', () => {
    // streakBefore 2 -> this answer makes 3 -> x2
    expect(pointsFor(2, 3500, 3500)).toBe(BASE_POINTS * 2)
    expect(pointsFor(1, 3500, 3500)).toBe(BASE_POINTS)
    expect(pointsFor(9, 3500, 3500)).toBe(BASE_POINTS * 5)
  })

  it('adds up to 50 for speed', () => {
    expect(pointsFor(0, 0, 3500)).toBe(BASE_POINTS + 50)
    expect(pointsFor(0, 1750, 3500)).toBe(BASE_POINTS + 25)
    expect(pointsFor(0, 3500, 3500)).toBe(BASE_POINTS)
  })

  it('never gives a negative speed bonus for slow answers', () => {
    expect(pointsFor(0, 99999, 3500)).toBe(BASE_POINTS)
  })

  it('handles a zero window safely', () => {
    expect(pointsFor(0, 100, 0)).toBe(BASE_POINTS)
    expect(Number.isFinite(pointsFor(0, 0, 0))).toBe(true)
  })

  it('faster is never worth less', () => {
    for (let r = 0; r < 3500; r += 250) expect(pointsFor(4, r, 3500)).toBeGreaterThanOrEqual(pointsFor(4, r + 250, 3500))
  })

  it('returns whole numbers', () => {
    expect(Number.isInteger(pointsFor(3, 1234, 3333))).toBe(true)
  })
})

describe('streakReward', () => {
  it('fires on exact thresholds only', () => {
    expect(streakReward(5)).toBe('horn')
    expect(streakReward(10)).toBe('nitro')
    expect(streakReward(15)).toBe('slow-mo-charge')
    expect(streakReward(20)).toBe('gold-trail')
    expect(streakReward(30)).toBe('gold-trail')
    expect(streakReward(100)).toBe('gold-trail')
  })

  it('is undefined between thresholds', () => {
    for (const s of [0, 1, 4, 6, 9, 11, 14, 16, 19, 21, 25, 29, 35]) expect(streakReward(s)).toBeUndefined()
  })
})

describe('xpForRun', () => {
  it('is always positive, even for an empty, quit run', () => {
    expect(xpForRun(result([], { completed: false }), 0)).toBeGreaterThan(0)
  })

  it('is positive for an all-miss run', () => {
    expect(xpForRun(result([false, false, false, false], { completed: false }), 0)).toBeGreaterThan(0)
  })

  it('misses still add a little xp (mistakes never cost xp)', () => {
    const none = xpForRun(result([], { completed: false }), 0)
    const misses = xpForRun(result([false, false], { completed: false }), 0)
    expect(misses).toBeGreaterThan(none)
  })

  it('correct answers are worth more than misses', () => {
    expect(xpForRun(result([true, true]), 0)).toBeGreaterThan(xpForRun(result([false, false]), 0))
  })

  it('rewards completion, score and medals', () => {
    const base = xpForRun(result([true], { completed: false }), 0)
    expect(xpForRun(result([true], { completed: true }), 0)).toBeGreaterThan(base)
    expect(xpForRun(result([true], { completed: false, score: 1000 }), 0)).toBe(base + 10)
    expect(xpForRun(result([true], { completed: false }), 2)).toBe(base + 50)
  })

  it('returns whole numbers', () => {
    expect(Number.isInteger(xpForRun(result([true, false, true], { score: 1234 }), 1))).toBe(true)
  })
})
