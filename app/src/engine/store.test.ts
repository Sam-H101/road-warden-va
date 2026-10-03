// Store tests. The store persists to localStorage, so an in-memory shim is
// installed on globalThis before the store module is loaded.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { campaignDistricts, eventsByItem, missionCount } from './content'
import { isExamReady, type ExamAnswer, type ExamPaper } from './exam'
import { mulberry32 } from './rng'
import { pointsFor, type EventOutcome, type RunPlan, type RunResult } from './run'
import { buildMission } from './runBuilder'
import type { Question } from './types'

class MemoryStorage {
  data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value))
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
}

const memory = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true, writable: true })

const { useGame, unlockedDistricts, isDistrictComplete } = await import('../store/gameStore')

const DAY1 = new Date(2026, 9, 2, 12, 0, 0)
const nextDay = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0)
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function play(plan: RunPlan, correct: (i: number) => boolean, completed = true): RunResult {
  let streak = 0
  let maxStreak = 0
  let score = 0
  const outcomes: EventOutcome[] = plan.events.map((e, i) => {
    const ok = correct(i)
    const points = ok ? pointsFor(streak, 1200, 3500) : 0
    streak = ok ? streak + 1 : 0
    maxStreak = Math.max(maxStreak, streak)
    score += points
    return {
      eventId: e.id,
      itemId: e.item,
      kind: e.kind,
      action: e.kind === 'action' ? e.action : undefined,
      correct: ok,
      reactionMs: 1200,
      windowMs: 3500,
      points,
      streakAfter: streak,
      isRequeue: false,
    }
  })
  return { plan, outcomes, score, maxStreak, durationMs: 90_000, completed, slowMoUsed: 0 }
}

function missionPlan(district = firstDistrict, index = 0): RunPlan {
  const s = useGame.getState()
  return buildMission(district, index, { states: s.items, today: key(new Date()), unlocked: unlockedDistricts(s), rng: mulberry32(index + 1) })
}

function fakeQ(id: string, part: 1 | 2): Question {
  return { id, item: `test-item-${id}`, part, prompt: 'p', choices: ['a', 'b', 'c', 'd'], answer: 0, explain: 'e' }
}

function fakePaper(kind: 'exam' | 'boss', p1: number, p2: number): ExamPaper {
  return {
    kind,
    district: kind === 'boss' ? 'd02-shapes' : undefined,
    part1: Array.from({ length: p1 }, (_, i) => fakeQ(`${kind}-1-${i}`, 1)),
    part2: Array.from({ length: p2 }, (_, i) => fakeQ(`${kind}-2-${i}`, 2)),
  }
}

function answers(paper: ExamPaper, c1: number, c2: number): ExamAnswer[] {
  return [
    ...paper.part1.map((q, i) => ({ questionId: q.id, chosen: i < c1 ? 0 : 1, correct: i < c1, part: 1 as const })),
    ...paper.part2.map((q, i) => ({ questionId: q.id, chosen: i < c2 ? 0 : 1, correct: i < c2, part: 2 as const })),
  ]
}

const firstDistrict = campaignDistricts[0].id
const firstHasEvents = missionCount(firstDistrict) > 0 && missionPlanHasEvents()

function missionPlanHasEvents(): boolean {
  return buildMission(firstDistrict, 0, { states: {}, today: '2026-01-01', unlocked: [firstDistrict], rng: mulberry32(1) }).events.length > 0
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY1)
  useGame.getState().resetAll()
  memory.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('store: initial state', () => {
  it('starts fresh with the first district unlocked', () => {
    const s = useGame.getState()
    expect(s.xp).toBe(0)
    expect(s.items).toEqual({})
    expect(unlockedDistricts(s)[0]).toBe(firstDistrict)
    expect(s.owned.length).toBeGreaterThan(0)
  })
})

describe('store: recordRun', () => {
  it.skipIf(!firstHasEvents)('a perfect mission gives xp, clears the mission and sets a best score', () => {
    const plan = missionPlan()
    const result = play(plan, () => true)
    const summary = useGame.getState().recordRun(result)
    const s = useGame.getState()

    expect(summary.xpGained).toBeGreaterThan(0)
    expect(s.xp).toBe(summary.xpGained)
    expect(s.seasonXp).toBe(summary.xpGained)
    expect(summary.rankAfter).toBeGreaterThanOrEqual(summary.rankBefore)
    expect(summary.correct).toBe(plan.events.length)
    expect(summary.total).toBe(plan.events.length)
    expect(summary.misses).toEqual([])
    expect(summary.missionCleared).toBe(true)
    expect(summary.newBest).toBe(true)
    expect(summary.previousBest).toBe(0)
    expect(s.bestScores[plan.key]).toBe(result.score)
    expect(s.missionsCleared[firstDistrict]).toEqual([0])
    expect(s.stats).toMatchObject({ runs: 1, correct: plan.events.length, wrong: 0, timePlayedMs: 90_000 })
    expect(s.stats.bestStreak).toBe(result.maxStreak)
    expect(s.playDays).toEqual([key(DAY1)])
    if (plan.events.length >= 8) expect(summary.medals).toContain('flawless')
    for (const m of summary.medals) expect(s.medals[m]).toBe(1)
    for (const e of plan.events) {
      expect(s.items[e.item].box).toBeGreaterThanOrEqual(2)
      expect(s.items[e.item].lastResult).toBe('correct')
    }
  })

  it.skipIf(!firstHasEvents)('replaying a cleared mission still gives xp but is not a new clear', () => {
    const plan = missionPlan()
    const first = useGame.getState().recordRun(play(plan, () => true))
    const xp1 = useGame.getState().xp
    const again = useGame.getState().recordRun(play(plan, () => true))
    expect(again.missionCleared).toBe(false)
    expect(again.newBest).toBe(false)
    expect(again.previousBest).toBe(useGame.getState().bestScores[plan.key])
    expect(again.xpGained).toBeGreaterThan(0)
    expect(useGame.getState().xp).toBe(xp1 + again.xpGained)
    expect(useGame.getState().stats.runs).toBe(2)
    expect(first.missionCleared).toBe(true)
  })

  it.skipIf(!firstHasEvents)('a bad, quit run never costs xp or rank', () => {
    useGame.getState().recordRun(play(missionPlan(), () => true))
    const before = useGame.getState()
    const plan = missionPlan(firstDistrict, 0)
    const summary = useGame.getState().recordRun(play(plan, () => false, false))
    const s = useGame.getState()
    expect(summary.xpGained).toBeGreaterThan(0)
    expect(s.xp).toBeGreaterThan(before.xp)
    expect(summary.rankAfter).toBeGreaterThanOrEqual(summary.rankBefore)
    expect(summary.newBest).toBe(false)
    expect(s.bestScores).toEqual(before.bestScores)
    expect(summary.correct).toBe(0)
    expect(s.stats.wrong).toBe(plan.events.length)
    // One miss card per item.
    const items = new Set(plan.events.map((e) => e.item))
    expect(summary.misses).toHaveLength(items.size)
    expect(new Set(summary.misses.map((m) => m.itemId)).size).toBe(items.size)
    for (const id of items) expect(s.items[id].box).toBe(1)
  })

  it.skipIf(!firstHasEvents)('a quit mission does not count as cleared', () => {
    const summary = useGame.getState().recordRun(play(missionPlan(), () => true, false))
    expect(summary.missionCleared).toBe(false)
    expect(isDistrictComplete(useGame.getState(), firstDistrict)).toBe(false)
  })

  it('an empty quit run is safe and still gives a little xp', () => {
    const plan: RunPlan = { mode: 'quick', key: 'quick', title: 'Quick', events: [], ramp: 0, perksAllowed: true, newItemIds: [] }
    const summary = useGame.getState().recordRun({ plan, outcomes: [], score: 0, maxStreak: 0, durationMs: 0, completed: false, slowMoUsed: 0 })
    expect(summary.xpGained).toBeGreaterThan(0)
    expect(summary.misses).toEqual([])
    expect(summary.medals).toEqual([])
  })

  it.skipIf(!firstHasEvents)('applies answers to the scheduler in order', () => {
    const plan = missionPlan()
    const target = plan.events[0].item
    const idx = plan.events.map((e, i) => (e.item === target ? i : -1)).filter((i) => i >= 0)
    const lastIdx = idx[idx.length - 1]
    useGame.getState().recordRun(play(plan, (i) => i !== lastIdx))
    expect(useGame.getState().items[target].lastResult).toBe('wrong')
    expect(useGame.getState().items[target].box).toBe(1)
  })

  it.skipIf(!firstHasEvents)('refreshes and advances contracts', () => {
    useGame.getState().recordRun(play(missionPlan(), () => true))
    const c = useGame.getState().contracts
    expect(c.day).toBe(key(DAY1))
    expect(c.daily.length).toBeGreaterThan(0)
    expect(c.weekly.length).toBeGreaterThan(0)
    for (const x of [...c.daily, ...c.weekly]) {
      expect(x.progress).toBeGreaterThanOrEqual(0)
      expect(x.progress).toBeLessThanOrEqual(x.goal)
    }
  })

  it.skipIf(!firstHasEvents || campaignDistricts.length < 2)('clearing every mission in a district unlocks the next one', () => {
    const n = missionCount(firstDistrict)
    let unlocked: string | undefined
    for (let m = 0; m < n; m++) {
      expect(unlockedDistricts(useGame.getState())).not.toContain(campaignDistricts[1].id)
      const summary = useGame.getState().recordRun(play(missionPlan(firstDistrict, m), () => true))
      expect(summary.missionCleared).toBe(true)
      if (summary.districtUnlocked) unlocked = summary.districtUnlocked
    }
    expect(unlocked).toBe(campaignDistricts[1].id)
    expect(unlockedDistricts(useGame.getState())).toContain(campaignDistricts[1].id)
  })

  it.skipIf(!firstHasEvents)('persists to localStorage', () => {
    useGame.getState().recordRun(play(missionPlan(), () => true))
    const raw = memory.getItem('road-warden-va')
    expect(raw).toBeTruthy()
    const saved = JSON.parse(raw!) as { state: { xp: number; items: Record<string, unknown> } }
    expect(saved.state.xp).toBe(useGame.getState().xp)
    expect(Object.keys(saved.state.items).length).toBeGreaterThan(0)
  })
})

describe('store: recordExam', () => {
  it('a ready exam is recorded, but one ready day does not clear Exam Day', () => {
    const paper = fakePaper('exam', 10, 30)
    const s1 = useGame.getState().recordExam(paper, answers(paper, 10, 30))
    expect(s1.result.passed).toBe(true)
    expect(s1.result.ready).toBe(true)
    expect(s1.bossNewlyCleared).toBe(false)
    expect(s1.examReadyDays).toBe(1)
    expect(s1.xpGained).toBeGreaterThan(0)
    expect(useGame.getState().bossesCleared).not.toContain('d16-examday')
    expect(useGame.getState().examHistory).toEqual([{ day: key(DAY1), part1Correct: 10, part2Correct: 30, passed: true, ready: true }])

    const s2 = useGame.getState().recordExam(paper, answers(paper, 10, 28))
    expect(s2.bossNewlyCleared).toBe(false)
    expect(s2.examReadyDays).toBe(1) // same day does not count twice
    expect(isExamReady(useGame.getState().examHistory)).toBe(false)
  })

  it('three ready exams on three different days meet the done rule', () => {
    const paper = fakePaper('exam', 10, 30)
    for (let d = 0; d < 3; d++) {
      vi.setSystemTime(nextDay(DAY1, d))
      const s = useGame.getState().recordExam(paper, answers(paper, 10, 27))
      expect(s.examReadyDays).toBe(d + 1)
      expect(s.bossNewlyCleared).toBe(d === 2)
    }
    expect(isExamReady(useGame.getState().examHistory)).toBe(true)
    expect(useGame.getState().bossesCleared).toContain('d16-examday')
    expect(useGame.getState().playDays).toHaveLength(3)
  })

  it('a pass that is not "ready" does not count toward the done rule', () => {
    const paper = fakePaper('exam', 10, 30)
    const s = useGame.getState().recordExam(paper, answers(paper, 10, 25))
    expect(s.result.passed).toBe(true)
    expect(s.result.ready).toBe(false)
    expect(s.examReadyDays).toBe(0)
    expect(useGame.getState().bossesCleared).not.toContain('d16-examday')
  })

  it('a sign miss fails the exam but still gives xp', () => {
    const paper = fakePaper('exam', 10, 30)
    const xp0 = useGame.getState().xp
    const s = useGame.getState().recordExam(paper, answers(paper, 9, 30))
    expect(s.result.passed).toBe(false)
    expect(s.result.stoppedAfterPart1).toBe(true)
    expect(s.xpGained).toBeGreaterThan(0)
    expect(useGame.getState().xp).toBe(xp0 + s.xpGained)
    expect(useGame.getState().examHistory[0]).toMatchObject({ passed: false, ready: false, part1Correct: 9 })
  })

  it('exam answers feed the scheduler', () => {
    const paper = fakePaper('exam', 2, 2)
    useGame.getState().recordExam(paper, answers(paper, 2, 1))
    const items = useGame.getState().items
    expect(items[paper.part1[0].item].lastResult).toBe('correct')
    expect(items[paper.part2[1].item].lastResult).toBe('wrong')
  })

  it('a boss win is recorded once and unlocks its reward', () => {
    const paper = fakePaper('boss', 3, 7)
    const s1 = useGame.getState().recordExam(paper, answers(paper, 3, 5))
    expect(s1.result.passed).toBe(true)
    expect(s1.bossNewlyCleared).toBe(true)
    expect(useGame.getState().bossesCleared).toEqual(['d02-shapes'])
    expect(s1.newCosmetics).toContain('paint-violet')
    expect(useGame.getState().owned).toContain('paint-violet')
    expect(useGame.getState().examHistory).toEqual([]) // bosses are not exam runs

    const s2 = useGame.getState().recordExam(paper, answers(paper, 3, 7))
    expect(s2.bossNewlyCleared).toBe(false)
    expect(s2.newCosmetics).not.toContain('paint-violet')
    expect(s2.xpGained).toBeLessThan(s1.xpGained)
  })

  it('a lost boss is not cleared and still gives xp', () => {
    const paper = fakePaper('boss', 3, 7)
    const s = useGame.getState().recordExam(paper, answers(paper, 2, 7))
    expect(s.result.passed).toBe(false)
    expect(s.bossNewlyCleared).toBe(false)
    expect(s.xpGained).toBeGreaterThan(0)
    expect(useGame.getState().bossesCleared).toEqual([])
  })
})

describe('store: save files', () => {
  it('export then import restores progress', () => {
    const paper = fakePaper('exam', 10, 30)
    useGame.getState().recordExam(paper, answers(paper, 10, 30))
    const xp = useGame.getState().xp
    const json = useGame.getState().exportSave()
    useGame.getState().resetAll()
    expect(useGame.getState().xp).toBe(0)
    expect(useGame.getState().importSave(json)).toEqual({ ok: true })
    expect(useGame.getState().xp).toBe(xp)
    expect(useGame.getState().examHistory).toHaveLength(1)
  })

  it('rejects files that are not saves', () => {
    expect(useGame.getState().importSave('not json').ok).toBe(false)
    expect(useGame.getState().importSave('{"app":"other"}').ok).toBe(false)
    expect(useGame.getState().importSave('{"app":"road-warden-va","data":{"version":1,"items":null}}').ok).toBe(false)
  })

  it('a damaged save keeps only well-typed fields and never replaces actions', () => {
    const json = JSON.stringify({
      app: 'road-warden-va',
      data: { version: 1, items: {}, xp: 120, contracts: { daily: null }, equipped: { car: 'x' }, recordRun: 'nope', stats: 5, playerName: 7 },
    })
    expect(useGame.getState().importSave(json).ok).toBe(true)
    const s = useGame.getState()
    expect(s.xp).toBe(120)
    expect(typeof s.recordRun).toBe('function')
    expect(Array.isArray(s.contracts.daily)).toBe(true)
    expect(s.equipped.paint).toBeTruthy()
    expect(s.stats.runs).toBe(0)
    expect(s.playerName).toBe('')
  })
})

// Sanity: the store tests above rely on real mission content when it exists.
describe('store test fixtures', () => {
  it('mission events reference items with events', () => {
    if (!firstHasEvents) return
    for (const e of missionPlan().events) expect((eventsByItem.get(e.item) ?? []).length).toBeGreaterThan(0)
  })
})
