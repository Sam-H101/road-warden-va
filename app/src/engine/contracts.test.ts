import { describe, it, expect } from 'vitest'
import { advanceContract, dailyContracts, weeklyContracts, type Contract, type ContractContext, type RunFacts } from './contracts'
import type { EventOutcome, RunMode, RunResult } from './run'
import type { DistrictId } from './types'

const ctx: ContractContext = {
  weakDistricts: ['d03-regulatory', 'd02-shapes'],
  districtName: (d) => `Name of ${d}`,
  unlockedModes: ['mission', 'quick', 'sniper', 'numbers', 'replay'],
}

const newPlayer: ContractContext = { weakDistricts: [], districtName: (d) => d, unlockedModes: ['mission', 'quick'] }

function run(pattern: boolean[], opts: { mode?: RunMode; completed?: boolean; maxStreak?: number } = {}): RunResult {
  const outcomes: EventOutcome[] = pattern.map((c, i) => ({
    eventId: `e${i}`,
    itemId: `i${i}`,
    kind: 'gates',
    correct: c,
    reactionMs: 500,
    windowMs: 3500,
    points: 100,
    streakAfter: 0,
    isRequeue: false,
  }))
  return {
    plan: { mode: opts.mode ?? 'mission', key: 'k', title: 't', events: [], ramp: 0, perksAllowed: true, newItemIds: [] },
    outcomes,
    score: 0,
    maxStreak: opts.maxStreak ?? 0,
    durationMs: 1000,
    completed: opts.completed ?? true,
    slowMoUsed: 0,
  }
}

function facts(result: RunResult, extra: Partial<RunFacts> = {}): RunFacts {
  return {
    result,
    correctByDistrict: new Map<DistrictId, number>(),
    signCorrect: 0,
    numberCorrect: 0,
    medals: 0,
    bossCleared: false,
    newPlayDay: false,
    ...extra,
  }
}

function contract(patch: Partial<Contract>): Contract {
  return { id: 'c', title: 'test', metric: 'runs', goal: 2, progress: 0, rewardXp: 50, done: false, claimed: false, ...patch }
}

describe('contract generation', () => {
  it('is deterministic per day', () => {
    for (const day of ['2026-10-01', '2026-10-02', '2027-01-15']) {
      expect(dailyContracts(day, ctx)).toEqual(dailyContracts(day, ctx))
    }
    expect(weeklyContracts('2026-W40', ctx)).toEqual(weeklyContracts('2026-W40', ctx))
  })

  it('changes from day to day', () => {
    const titles = new Set<string>()
    for (let d = 1; d <= 14; d++) titles.add(dailyContracts(`2026-10-${String(d).padStart(2, '0')}`, ctx).map((c) => c.title).join('|'))
    expect(titles.size).toBeGreaterThan(1)
  })

  it('gives three fresh daily and weekly contracts with unique ids', () => {
    for (const c of [ctx, newPlayer]) {
      for (const list of [dailyContracts('2026-10-02', c), weeklyContracts('2026-W40', c)]) {
        expect(list).toHaveLength(3)
        expect(new Set(list.map((x) => x.id)).size).toBe(3)
        for (const x of list) {
          expect(x).toMatchObject({ progress: 0, done: false, claimed: false })
          expect(x.goal).toBeGreaterThan(0)
          expect(x.rewardXp).toBeGreaterThan(0)
          expect(x.title.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('never asks for a locked mode or a district the player has not started', () => {
    for (let d = 1; d <= 28; d++) {
      for (const c of dailyContracts(`2026-02-${String(d).padStart(2, '0')}`, newPlayer)) {
        expect(c.mode === undefined || newPlayer.unlockedModes.includes(c.mode)).toBe(true)
        expect(c.district).toBeUndefined()
        expect(c.metric).not.toBe('numbers')
      }
    }
  })

  it('names the weakest district in district contracts', () => {
    for (let d = 1; d <= 28; d++) {
      for (const c of dailyContracts(`2026-02-${String(d).padStart(2, '0')}`, ctx)) {
        if (c.district) {
          expect(c.district).toBe('d03-regulatory')
          expect(c.title).toContain('Name of d03-regulatory')
        }
      }
    }
  })
})

describe('advanceContract', () => {
  it('caps progress at the goal and marks done', () => {
    const c = contract({ metric: 'correct', goal: 5, progress: 3 })
    const next = advanceContract(c, facts(run([true, true, true, true, true, true])))
    expect(next.progress).toBe(5)
    expect(next.done).toBe(true)
    expect(c.progress).toBe(3) // returns a new object
  })

  it('leaves finished contracts untouched', () => {
    const c = contract({ metric: 'correct', goal: 5, progress: 5, done: true })
    expect(advanceContract(c, facts(run([true, true])))).toBe(c)
  })

  it('counts only completed runs, of the right mode', () => {
    const any = contract({ metric: 'runs', goal: 3 })
    expect(advanceContract(any, facts(run([true]))).progress).toBe(1)
    expect(advanceContract(any, facts(run([true], { completed: false }))).progress).toBe(0)
    const sniper = contract({ metric: 'runs', goal: 1, mode: 'sniper' })
    expect(advanceContract(sniper, facts(run([true], { mode: 'quick' }))).progress).toBe(0)
    const done = advanceContract(sniper, facts(run([true], { mode: 'sniper' })))
    expect(done).toMatchObject({ progress: 1, done: true })
  })

  it('streak contracts use the best streak, not a sum', () => {
    const c = contract({ metric: 'streak', goal: 6, progress: 4 })
    expect(advanceContract(c, facts(run([], { maxStreak: 3 }))).progress).toBe(4)
    expect(advanceContract(c, facts(run([], { maxStreak: 5 }))).progress).toBe(5)
    expect(advanceContract(c, facts(run([], { maxStreak: 12 })))).toMatchObject({ progress: 6, done: true })
  })

  it('district contracts only count that district', () => {
    const c = contract({ metric: 'correct', goal: 10, district: 'd02-shapes' })
    const f = facts(run([true, true, true]), { correctByDistrict: new Map<DistrictId, number>([['d02-shapes', 2], ['d03-regulatory', 1]]) })
    expect(advanceContract(c, f).progress).toBe(2)
    expect(advanceContract(contract({ metric: 'correct', goal: 10, district: 'd09-lanes' }), f).progress).toBe(0)
  })

  it('counts signs, numbers, medals, bosses and play days', () => {
    const f = facts(run([]), { signCorrect: 4, numberCorrect: 2, medals: 3, bossCleared: true, newPlayDay: true })
    expect(advanceContract(contract({ metric: 'signs', goal: 12 }), f).progress).toBe(4)
    expect(advanceContract(contract({ metric: 'numbers', goal: 6 }), f).progress).toBe(2)
    expect(advanceContract(contract({ metric: 'medals', goal: 2 }), f)).toMatchObject({ progress: 2, done: true })
    expect(advanceContract(contract({ metric: 'boss', goal: 1 }), f)).toMatchObject({ progress: 1, done: true })
    expect(advanceContract(contract({ metric: 'days', goal: 4 }), f).progress).toBe(1)
    const none = facts(run([]))
    expect(advanceContract(contract({ metric: 'boss', goal: 1 }), none).progress).toBe(0)
    expect(advanceContract(contract({ metric: 'days', goal: 4 }), none).progress).toBe(0)
  })

  it('perfect runs need 8+ answers, all right, and a finished run', () => {
    const c = contract({ metric: 'perfect', goal: 3 })
    expect(advanceContract(c, facts(run(Array(8).fill(true)))).progress).toBe(1)
    expect(advanceContract(c, facts(run(Array(7).fill(true)))).progress).toBe(0)
    expect(advanceContract(c, facts(run([...Array(8).fill(true), false]))).progress).toBe(0)
    expect(advanceContract(c, facts(run(Array(8).fill(true), { completed: false }))).progress).toBe(0)
  })
})
