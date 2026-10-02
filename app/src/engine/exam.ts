// Exam Day (real DMV format) and district bosses (mini exams).
import { allQuestions, itemById, itemsIn } from './content'
import { shuffle, type Rng, defaultRng } from './rng'
import type { DistrictId, Question } from './types'

export const EXAM_PART1_COUNT = 10
export const EXAM_PART1_PASS = 10 // all ten
export const EXAM_PART2_COUNT = 30
export const EXAM_PART2_PASS = 24 // 80%
export const READY_PART2 = 27 // 90% for the game's "ready" rule
export const READY_RUNS_NEEDED = 3

export const BOSS_QUESTION_COUNT = 10
export const BOSS_PASS_PCT = 0.8

export interface ExamPaper {
  kind: 'exam' | 'boss'
  district?: DistrictId
  part1: Question[]
  part2: Question[]
}

export interface ExamAnswer {
  questionId: string
  chosen: number
  correct: boolean
  part: 1 | 2
}

export interface ExamResult {
  paper: ExamPaper
  answers: ExamAnswer[]
  part1Correct: number
  part2Correct: number
  part1Passed: boolean
  passed: boolean
  ready: boolean // met the game's stricter "ready" bar (exam only)
  stoppedAfterPart1: boolean
  byDistrict: Record<string, { correct: number; total: number }>
}

/** One question per item where possible so the paper covers more ground. */
function pickSpread(pool: Question[], n: number, rng: Rng): Question[] {
  const byItem = new Map<string, Question[]>()
  for (const q of shuffle(pool, rng)) {
    const arr = byItem.get(q.item)
    if (arr) arr.push(q)
    else byItem.set(q.item, [q])
  }
  const items = shuffle([...byItem.keys()], rng)
  const out: Question[] = []
  let round = 0
  while (out.length < n && round < 10) {
    for (const it of items) {
      const qs = byItem.get(it)!
      if (qs[round]) out.push(qs[round])
      if (out.length >= n) break
    }
    round++
  }
  return out
}

/** Spread part-2 questions across districts in proportion to how many items each has. */
function pickProportional(pool: Question[], n: number, rng: Rng): Question[] {
  const byDistrict = new Map<string, Question[]>()
  for (const q of pool) {
    const d = itemById.get(q.item)?.district ?? 'x'
    const arr = byDistrict.get(d)
    if (arr) arr.push(q)
    else byDistrict.set(d, [q])
  }
  const total = pool.length
  const out: Question[] = []
  for (const [, qs] of byDistrict) {
    const share = Math.round((qs.length / total) * n)
    out.push(...pickSpread(qs, share, rng))
  }
  const used = new Set(out.map((q) => q.id))
  const usedItems = new Set(out.map((q) => q.item))
  // Top up or trim to exactly n, preferring unused items.
  const rest = shuffle(
    pool.filter((q) => !used.has(q.id)),
    rng,
  ).sort((a, b) => Number(usedItems.has(a.item)) - Number(usedItems.has(b.item)))
  while (out.length < n && rest.length) out.push(rest.shift()!)
  return shuffle(out, rng).slice(0, n)
}

export function buildExam(rng: Rng = defaultRng): ExamPaper {
  const p1 = allQuestions.filter((q) => q.part === 1)
  const p2 = allQuestions.filter((q) => q.part === 2)
  return {
    kind: 'exam',
    part1: pickSpread(p1, EXAM_PART1_COUNT, rng),
    part2: pickProportional(p2, EXAM_PART2_COUNT, rng),
  }
}

export function buildBoss(district: DistrictId, rng: Rng = defaultRng): ExamPaper {
  const ids = new Set(itemsIn(district).map((i) => i.id))
  const pool = allQuestions.filter((q) => ids.has(q.item))
  const qs = pickSpread(pool, BOSS_QUESTION_COUNT, rng)
  return {
    kind: 'boss',
    district,
    part1: qs.filter((q) => q.part === 1),
    part2: qs.filter((q) => q.part === 2),
  }
}

/** Shuffle a question's choices; returns the new choices and new answer index. */
export function shuffleChoices(q: Question, rng: Rng = defaultRng): { choices: string[]; answer: number } {
  // Keep "All of these" / "None of these" style answers last, like the real exam.
  const isAnchor = (c: string) => /^(all|none|both) of (these|the above)/i.test(c.trim())
  const idx = q.choices.map((_, i) => i)
  const anchors = idx.filter((i) => isAnchor(q.choices[i]))
  const movable = shuffle(
    idx.filter((i) => !isAnchor(q.choices[i])),
    rng,
  )
  const order = [...movable, ...anchors]
  return { choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) }
}

export function gradeExam(paper: ExamPaper, answers: ExamAnswer[]): ExamResult {
  const part1Correct = answers.filter((a) => a.part === 1 && a.correct).length
  const part2Correct = answers.filter((a) => a.part === 2 && a.correct).length
  const byDistrict: ExamResult['byDistrict'] = {}
  const all = [...paper.part1, ...paper.part2]
  for (const q of all) {
    const d = itemById.get(q.item)?.district ?? 'unknown'
    byDistrict[d] ??= { correct: 0, total: 0 }
    const a = answers.find((x) => x.questionId === q.id)
    if (a) {
      byDistrict[d].total += 1
      if (a.correct) byDistrict[d].correct += 1
    }
  }
  if (paper.kind === 'exam') {
    const part1Passed = part1Correct >= EXAM_PART1_PASS
    const stoppedAfterPart1 = !part1Passed
    const passed = part1Passed && part2Correct >= EXAM_PART2_PASS
    const ready = part1Passed && part2Correct >= READY_PART2
    return { paper, answers, part1Correct, part2Correct, part1Passed, passed, ready, stoppedAfterPart1, byDistrict }
  }
  const total = paper.part1.length + paper.part2.length
  const part1Passed = part1Correct === paper.part1.length
  const passed = part1Passed && (part1Correct + part2Correct) / Math.max(1, total) >= BOSS_PASS_PCT
  return { paper, answers, part1Correct, part2Correct, part1Passed, passed, ready: false, stoppedAfterPart1: false, byDistrict }
}

export interface ExamRecord {
  day: string
  part1Correct: number
  part2Correct: number
  passed: boolean
  ready: boolean
}

/** The game's done rule: 3 "ready" exams (10/10 signs, 27+/30) on 3 different days. */
export function readyDays(history: ExamRecord[]): string[] {
  return [...new Set(history.filter((h) => h.ready).map((h) => h.day))]
}

export function isExamReady(history: ExamRecord[]): boolean {
  return readyDays(history).length >= READY_RUNS_NEEDED
}
