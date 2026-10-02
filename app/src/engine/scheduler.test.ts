import { describe, it, expect } from 'vitest'
import { dayNumber } from './rng'
import {
  BOX_CONFIDENCE,
  BOX_INTERVAL_DAYS,
  MAX_BOX,
  SIGN_DAYS_FOR_MASTERY,
  confidence,
  isDue,
  isMastered,
  newItemState,
  review,
  reviewPriority,
  type ItemState,
} from './scheduler'

const DAY0 = '2026-03-01'

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Answer correctly once per day for `days` consecutive days. */
function correctOnDays(days: number, isSign: boolean, start = DAY0): ItemState {
  let s: ItemState | undefined
  for (let i = 0; i < days; i++) s = review(s, true, addDays(start, i), { isSign, now: 1 })
  return s!
}

describe('scheduler constants', () => {
  it('box intervals never shrink as the box rises', () => {
    expect(BOX_INTERVAL_DAYS).toHaveLength(MAX_BOX + 1)
    for (let b = 1; b <= MAX_BOX; b++) expect(BOX_INTERVAL_DAYS[b]).toBeGreaterThanOrEqual(BOX_INTERVAL_DAYS[b - 1])
  })

  it('confidence rises with the box and stays a probability', () => {
    expect(BOX_CONFIDENCE).toHaveLength(MAX_BOX + 1)
    for (let b = 0; b <= MAX_BOX; b++) {
      expect(BOX_CONFIDENCE[b]).toBeGreaterThan(0)
      expect(BOX_CONFIDENCE[b]).toBeLessThanOrEqual(1)
      if (b > 0) expect(BOX_CONFIDENCE[b]).toBeGreaterThan(BOX_CONFIDENCE[b - 1])
    }
  })
})

describe('newItemState', () => {
  it('starts unseen in box 0', () => {
    const s = newItemState()
    expect(s).toMatchObject({ box: 0, seen: 0, correct: 0, wrong: 0, lastDay: '', lastResult: 'none', recentMissAt: 0 })
    expect(s.correctDays).toEqual([])
  })
})

describe('review transitions', () => {
  it('a brand new item answered right jumps to box 2, due tomorrow', () => {
    const s = review(undefined, true, DAY0, { isSign: false })
    expect(s.box).toBe(2)
    expect(s.seen).toBe(1)
    expect(s.correct).toBe(1)
    expect(s.wrong).toBe(0)
    expect(s.lastResult).toBe('correct')
    expect(s.lastDay).toBe(DAY0)
    expect(s.correctDays).toEqual([DAY0])
    expect(s.nextDue).toBe(dayNumber(DAY0) + BOX_INTERVAL_DAYS[2])
  })

  it('treats a box-0 state the same as undefined', () => {
    expect(review(newItemState(), true, DAY0, { isSign: false })).toEqual(review(undefined, true, DAY0, { isSign: false }))
  })

  it('a brand new item answered wrong goes to box 1 and is due today', () => {
    const s = review(undefined, false, DAY0, { isSign: false, now: 1234 })
    expect(s.box).toBe(1)
    expect(s.wrong).toBe(1)
    expect(s.correct).toBe(0)
    expect(s.lastResult).toBe('wrong')
    expect(s.recentMissAt).toBe(1234)
    expect(s.nextDue).toBe(dayNumber(DAY0))
    expect(s.correctDays).toEqual([])
  })

  it('climbs only once per day (no cramming)', () => {
    let s = review(undefined, true, DAY0, { isSign: false })
    for (let i = 0; i < 5; i++) s = review(s, true, DAY0, { isSign: false })
    expect(s.box).toBe(2)
    expect(s.correct).toBe(6)
    expect(s.seen).toBe(6)
    expect(s.correctDays).toEqual([DAY0])
  })

  it('a rule item climbs one box per day up to the max', () => {
    const boxes: number[] = []
    let s: ItemState | undefined
    for (let i = 0; i < 7; i++) {
      s = review(s, true, addDays(DAY0, i), { isSign: false })
      boxes.push(s.box)
    }
    expect(boxes).toEqual([2, 3, 4, 5, 5, 5, 5])
  })

  it('sets nextDue from the box interval', () => {
    let s: ItemState | undefined
    for (let i = 0; i < 6; i++) {
      const day = addDays(DAY0, i)
      s = review(s, true, day, { isSign: false })
      expect(s.nextDue).toBe(dayNumber(day) + BOX_INTERVAL_DAYS[s.box])
    }
  })

  it('a miss drops any box to 1 but keeps history', () => {
    const before = correctOnDays(4, false)
    expect(before.box).toBe(5)
    const s = review(before, false, addDays(DAY0, 4), { isSign: false, now: 99 })
    expect(s.box).toBe(1)
    expect(s.correct).toBe(before.correct)
    expect(s.wrong).toBe(1)
    expect(s.seen).toBe(before.seen + 1)
    expect(s.correctDays).toEqual(before.correctDays)
    expect(s.recentMissAt).toBe(99)
    expect(s.nextDue).toBe(dayNumber(addDays(DAY0, 4)))
  })

  it('a miss then a correct answer on the same day climbs back to box 2', () => {
    const miss = review(undefined, false, DAY0, { isSign: false, now: 1 })
    const s = review(miss, true, DAY0, { isSign: false })
    expect(s.box).toBe(2)
    expect(s.lastResult).toBe('correct')
  })

  it('does not mutate the previous state', () => {
    const prev = correctOnDays(2, true)
    const snapshot = JSON.parse(JSON.stringify(prev)) as ItemState
    review(prev, true, addDays(DAY0, 5), { isSign: true })
    review(prev, false, addDays(DAY0, 5), { isSign: true, now: 5 })
    expect(prev).toEqual(snapshot)
  })

  it('keeps at most 5 distinct correct days, newest last', () => {
    const s = correctOnDays(9, false)
    expect(s.correctDays).toHaveLength(5)
    expect(s.correctDays[4]).toBe(addDays(DAY0, 8))
    expect(new Set(s.correctDays).size).toBe(5)
  })

  it('box always stays within 1..MAX_BOX once seen', () => {
    let s: ItemState | undefined
    let seed = 7
    for (let i = 0; i < 300; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      const correct = seed % 3 !== 0
      s = review(s, correct, addDays(DAY0, Math.floor(i / 4)), { isSign: i % 2 === 0, now: i })
      expect(s.box).toBeGreaterThanOrEqual(1)
      expect(s.box).toBeLessThanOrEqual(MAX_BOX)
      expect(s.seen).toBe(s.correct + s.wrong)
    }
  })
})

describe(`sign ${SIGN_DAYS_FOR_MASTERY}-day rule`, () => {
  it('a sign needs correct answers on 3 different days to pass box 3', () => {
    expect(correctOnDays(1, true).box).toBe(2)
    expect(correctOnDays(2, true).box).toBe(3)
    expect(correctOnDays(3, true).box).toBe(4)
    expect(isMastered(correctOnDays(2, true), true)).toBe(false)
    expect(isMastered(correctOnDays(3, true), true)).toBe(true)
  })

  it('a sign stays capped at box 3 after many answers spread over only two days', () => {
    let s: ItemState | undefined
    for (let i = 0; i < 10; i++) s = review(s, true, DAY0, { isSign: true })
    for (let i = 0; i < 10; i++) s = review(s, true, addDays(DAY0, 1), { isSign: true })
    expect(s!.box).toBe(3)
    expect(isMastered(s, true)).toBe(false)
  })

  it('caps a sign at box 3 even if it got there by a fast path', () => {
    // A sign state in box 3 with only two correct days, answered on a new day after a
    // miss-free run: the third distinct day is what unlocks box 4, not the box itself.
    const twoDays: ItemState = { ...newItemState(), box: 3, seen: 2, correct: 2, correctDays: [DAY0, addDays(DAY0, 1)], lastDay: addDays(DAY0, 1), lastResult: 'correct' }
    const sameDay = review(twoDays, true, addDays(DAY0, 1), { isSign: true })
    expect(sameDay.box).toBe(3)
    const asRule = review({ ...twoDays, lastDay: DAY0 }, true, addDays(DAY0, 1), { isSign: false })
    expect(asRule.box).toBe(4)
    const asSign = review({ ...twoDays, lastDay: DAY0 }, true, addDays(DAY0, 1), { isSign: true })
    expect(asSign.box).toBe(3)
  })

  it('after a miss, old correct days still count toward the rule', () => {
    let s = correctOnDays(3, true) // box 4
    s = review(s, false, addDays(DAY0, 3), { isSign: true, now: 1 })
    expect(s.box).toBe(1)
    s = review(s, true, addDays(DAY0, 4), { isSign: true })
    expect(s.box).toBe(2)
    s = review(s, true, addDays(DAY0, 5), { isSign: true })
    expect(s.box).toBe(3)
    s = review(s, true, addDays(DAY0, 6), { isSign: true })
    expect(s.box).toBe(4)
  })
})

describe('isDue', () => {
  it('is false for unseen items', () => {
    expect(isDue(undefined, DAY0)).toBe(false)
    expect(isDue(newItemState(), DAY0)).toBe(false)
  })

  it('a missed item is due the same day', () => {
    expect(isDue(review(undefined, false, DAY0, { isSign: false, now: 1 }), DAY0)).toBe(true)
  })

  it('a box-2 item is due tomorrow, not today', () => {
    const s = review(undefined, true, DAY0, { isSign: false })
    expect(isDue(s, DAY0)).toBe(false)
    expect(isDue(s, addDays(DAY0, 1))).toBe(true)
    expect(isDue(s, addDays(DAY0, 30))).toBe(true)
  })

  it('a box-5 item waits 14 days', () => {
    const s = correctOnDays(4, false)
    const last = addDays(DAY0, 3)
    expect(s.box).toBe(5)
    expect(isDue(s, addDays(last, 13))).toBe(false)
    expect(isDue(s, addDays(last, 14))).toBe(true)
  })

  it('works across month and year boundaries', () => {
    const s = review(undefined, true, '2026-12-31', { isSign: false })
    expect(isDue(s, '2027-01-01')).toBe(true)
  })
})

describe('isMastered / confidence / reviewPriority', () => {
  it('rule items are mastered at box 4+', () => {
    expect(isMastered(undefined, false)).toBe(false)
    expect(isMastered({ ...newItemState(), box: 3 }, false)).toBe(false)
    expect(isMastered({ ...newItemState(), box: 4 }, false)).toBe(true)
  })

  it('sign items also need enough correct days', () => {
    expect(isMastered({ ...newItemState(), box: 5, correctDays: ['a', 'b'] }, true)).toBe(false)
    expect(isMastered({ ...newItemState(), box: 5, correctDays: ['a', 'b', 'c'] }, true)).toBe(true)
  })

  it('confidence for undefined is box 0', () => {
    expect(confidence(undefined)).toBe(BOX_CONFIDENCE[0])
    expect(confidence({ ...newItemState(), box: 5 })).toBe(BOX_CONFIDENCE[5])
  })

  it('lower box and more overdue are more urgent', () => {
    const today = addDays(DAY0, 10)
    const low = { ...newItemState(), box: 1, nextDue: dayNumber(today) }
    const high = { ...newItemState(), box: 4, nextDue: dayNumber(today) }
    const overdue = { ...newItemState(), box: 4, nextDue: dayNumber(DAY0) }
    expect(reviewPriority(low, today)).toBeLessThan(reviewPriority(high, today))
    expect(reviewPriority(overdue, today)).toBeLessThan(reviewPriority(high, today))
  })

  it('the overdue bonus is capped at 30 days', () => {
    const today = '2026-12-31'
    const a = { ...newItemState(), box: 3, nextDue: dayNumber(today) - 30 }
    const b = { ...newItemState(), box: 3, nextDue: dayNumber(today) - 300 }
    expect(reviewPriority(a, today)).toBe(reviewPriority(b, today))
  })
})
