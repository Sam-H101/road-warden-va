// Leitner-box spaced repetition.
// Box 0 = never seen. Boxes 1-5 = learning. A miss drops to box 1.
// Sign items need correct answers on 3 different days before they can pass box 3,
// because one wrong sign fails the real exam.
import { dayNumber } from './rng'

export interface ItemState {
  box: number // 0..5
  seen: number
  correct: number
  wrong: number
  lastDay: string // day key of last answer, '' if never
  nextDue: number // day number when due again
  correctDays: string[] // distinct day keys with a correct answer (max 5 kept)
  lastResult: 'correct' | 'wrong' | 'none'
  recentMissAt: number // ms timestamp of most recent miss, 0 if none
}

export const MAX_BOX = 5
/** Days until the item is due again after landing in each box. */
export const BOX_INTERVAL_DAYS = [0, 0, 1, 3, 7, 14]
/** Distinct correct days a sign item needs before it may rise above box 3. */
export const SIGN_DAYS_FOR_MASTERY = 3

export function newItemState(): ItemState {
  return {
    box: 0,
    seen: 0,
    correct: 0,
    wrong: 0,
    lastDay: '',
    nextDue: 0,
    correctDays: [],
    lastResult: 'none',
    recentMissAt: 0,
  }
}

export function review(
  prev: ItemState | undefined,
  correct: boolean,
  today: string,
  opts: { isSign: boolean; now?: number },
): ItemState {
  const s: ItemState = prev ? { ...prev, correctDays: prev.correctDays.slice() } : newItemState()
  s.seen += 1
  s.lastDay = today
  if (correct) {
    s.correct += 1
    s.lastResult = 'correct'
    if (!s.correctDays.includes(today)) {
      s.correctDays.push(today)
      if (s.correctDays.length > 5) s.correctDays.shift()
    }
    // A brand new item answered right jumps to box 2; otherwise climb one box,
    // but only once per day so cramming does not fake long-term memory.
    let target = s.box === 0 ? 2 : s.box + 1
    const alreadyClimbedToday = prev?.lastDay === today && prev.lastResult === 'correct' && prev.box >= 2
    if (alreadyClimbedToday) target = s.box
    if (opts.isSign && s.correctDays.length < SIGN_DAYS_FOR_MASTERY) target = Math.min(target, 3)
    s.box = Math.min(MAX_BOX, target)
  } else {
    s.wrong += 1
    s.lastResult = 'wrong'
    s.box = 1
    s.recentMissAt = opts.now ?? Date.now()
  }
  s.nextDue = dayNumber(today) + BOX_INTERVAL_DAYS[s.box]
  return s
}

export function isDue(s: ItemState | undefined, today: string): boolean {
  if (!s || s.box === 0) return false
  return s.nextDue <= dayNumber(today)
}

export function isMastered(s: ItemState | undefined, isSign: boolean): boolean {
  if (!s) return false
  if (isSign) return s.box >= 4 && s.correctDays.length >= SIGN_DAYS_FOR_MASTERY
  return s.box >= 4
}

/** Probability the learner answers this item right on the exam, by box. */
export const BOX_CONFIDENCE = [0.25, 0.45, 0.62, 0.78, 0.9, 0.96]

export function confidence(s: ItemState | undefined): number {
  return BOX_CONFIDENCE[s?.box ?? 0]
}

/** Priority for review: lower is more urgent. Overdue + low box first. */
export function reviewPriority(s: ItemState, today: string): number {
  const overdue = dayNumber(today) - s.nextDue
  return s.box * 10 - Math.min(overdue, 30)
}
