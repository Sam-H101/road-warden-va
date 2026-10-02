import { describe, it, expect } from 'vitest'
import { allQuestions, districts, itemById, itemsIn } from './content'
import {
  BOSS_QUESTION_COUNT,
  EXAM_PART1_COUNT,
  EXAM_PART2_COUNT,
  buildBoss,
  buildExam,
  gradeExam,
  isExamReady,
  readyDays,
  shuffleChoices,
  type ExamAnswer,
  type ExamPaper,
  type ExamRecord,
} from './exam'
import { mulberry32 } from './rng'
import type { Question } from './types'

function q(id: string, part: 1 | 2, choices: [string, string, string, string] = ['A', 'B', 'C', 'D'], answer: 0 | 1 | 2 | 3 = 0): Question {
  return { id, item: `item-${id}`, part, prompt: `Question ${id}?`, choices, answer, explain: 'Because.' }
}

function paperOf(kind: 'exam' | 'boss', p1: number, p2: number): ExamPaper {
  return {
    kind,
    district: kind === 'boss' ? 'd02-shapes' : undefined,
    part1: Array.from({ length: p1 }, (_, i) => q(`p1-${i}`, 1)),
    part2: Array.from({ length: p2 }, (_, i) => q(`p2-${i}`, 2)),
  }
}

/** Answer the first `c1` part-1 and first `c2` part-2 questions right, the rest wrong. */
function answer(paper: ExamPaper, c1: number, c2: number): ExamAnswer[] {
  return [
    ...paper.part1.map((x, i) => ({ questionId: x.id, chosen: i < c1 ? x.answer : (x.answer + 1) % 4, correct: i < c1, part: 1 as const })),
    ...paper.part2.map((x, i) => ({ questionId: x.id, chosen: i < c2 ? x.answer : (x.answer + 1) % 4, correct: i < c2, part: 2 as const })),
  ]
}

const p1Pool = allQuestions.filter((x) => x.part === 1)
const p2Pool = allQuestions.filter((x) => x.part === 2)

describe('gradeExam: Exam Day', () => {
  const paper = paperOf('exam', EXAM_PART1_COUNT, EXAM_PART2_COUNT)

  it('passes with 10/10 signs and 24/30 general', () => {
    const r = gradeExam(paper, answer(paper, 10, 24))
    expect(r).toMatchObject({ part1Correct: 10, part2Correct: 24, part1Passed: true, passed: true, ready: false, stoppedAfterPart1: false })
  })

  it('fails with 23/30 general', () => {
    const r = gradeExam(paper, answer(paper, 10, 23))
    expect(r.part1Passed).toBe(true)
    expect(r.passed).toBe(false)
    expect(r.ready).toBe(false)
  })

  it('one sign miss fails the whole exam, even with 30/30 general', () => {
    const r = gradeExam(paper, answer(paper, 9, 30))
    expect(r.part1Passed).toBe(false)
    expect(r.passed).toBe(false)
    expect(r.ready).toBe(false)
    expect(r.stoppedAfterPart1).toBe(true)
  })

  it('a sign miss with no part-2 answers stops after part 1', () => {
    const r = gradeExam(paper, answer(paper, 9, 0).filter((a) => a.part === 1))
    expect(r.stoppedAfterPart1).toBe(true)
    expect(r.part2Correct).toBe(0)
  })

  it('is "ready" at 27/30 with perfect signs', () => {
    expect(gradeExam(paper, answer(paper, 10, 26)).ready).toBe(false)
    const r = gradeExam(paper, answer(paper, 10, 27))
    expect(r.ready).toBe(true)
    expect(r.passed).toBe(true)
    expect(gradeExam(paper, answer(paper, 10, 30)).ready).toBe(true)
  })

  it('counts only answered questions per district', () => {
    const r = gradeExam(paper, answer(paper, 10, 20).slice(0, 15))
    const totals = Object.values(r.byDistrict).reduce((s, d) => s + d.total, 0)
    const correct = Object.values(r.byDistrict).reduce((s, d) => s + d.correct, 0)
    expect(totals).toBe(15)
    expect(correct).toBe(15)
  })

  it('groups by the real district when the item exists', () => {
    const real = p2Pool[0]
    if (!real) return
    const pp: ExamPaper = { kind: 'exam', part1: [], part2: [real] }
    const r = gradeExam(pp, [{ questionId: real.id, chosen: real.answer, correct: true, part: 2 }])
    const d = itemById.get(real.item)?.district ?? 'unknown'
    expect(r.byDistrict[d]).toEqual({ correct: 1, total: 1 })
  })
})

describe('gradeExam: district boss', () => {
  it('passes at 80% with every sign question right', () => {
    const paper = paperOf('boss', 3, 7)
    const r = gradeExam(paper, answer(paper, 3, 5))
    expect(r.passed).toBe(true)
    expect(r.ready).toBe(false)
    expect(r.stoppedAfterPart1).toBe(false)
  })

  it('fails below 80%', () => {
    const paper = paperOf('boss', 3, 7)
    expect(gradeExam(paper, answer(paper, 3, 4)).passed).toBe(false)
  })

  it('fails on any sign miss even at 90%', () => {
    const paper = paperOf('boss', 3, 7)
    const r = gradeExam(paper, answer(paper, 2, 7))
    expect(r.part1Passed).toBe(false)
    expect(r.passed).toBe(false)
  })

  it('a boss with no sign questions is judged on the score alone', () => {
    const paper = paperOf('boss', 0, 10)
    expect(gradeExam(paper, answer(paper, 0, 8)).passed).toBe(true)
    expect(gradeExam(paper, answer(paper, 0, 7)).passed).toBe(false)
  })

  it('an empty boss paper does not crash', () => {
    const r = gradeExam(paperOf('boss', 0, 0), [])
    expect(r.part1Correct).toBe(0)
    expect(r.passed).toBe(false)
  })
})

describe('ready rule: 3 ready exams on 3 different days', () => {
  const rec = (day: string, ready: boolean): ExamRecord => ({ day, part1Correct: 10, part2Correct: ready ? 28 : 24, passed: true, ready })

  it('three ready exams on one day are not enough', () => {
    const h = [rec('2026-01-01', true), rec('2026-01-01', true), rec('2026-01-01', true)]
    expect(readyDays(h)).toEqual(['2026-01-01'])
    expect(isExamReady(h)).toBe(false)
  })

  it('three different days are', () => {
    const h = [rec('2026-01-01', true), rec('2026-01-03', true), rec('2026-01-02', true)]
    expect(readyDays(h)).toHaveLength(3)
    expect(isExamReady(h)).toBe(true)
  })

  it('passing but not ready exams do not count', () => {
    const h = [rec('2026-01-01', true), rec('2026-01-02', false), rec('2026-01-03', false), rec('2026-01-04', true)]
    expect(readyDays(h)).toEqual(['2026-01-01', '2026-01-04'])
    expect(isExamReady(h)).toBe(false)
  })

  it('handles an empty history', () => {
    expect(isExamReady([])).toBe(false)
  })
})

describe('shuffleChoices', () => {
  it('keeps the right answer and is a permutation', () => {
    const question = q('s1', 2, ['Stop', 'Yield', 'Merge', 'Go'], 2)
    for (let seed = 1; seed <= 200; seed++) {
      const { choices, answer: a } = shuffleChoices(question, mulberry32(seed))
      expect(choices[a]).toBe('Merge')
      expect([...choices].sort()).toEqual([...question.choices].sort())
    }
  })

  it('actually shuffles over many seeds', () => {
    const question = q('s2', 2, ['W', 'X', 'Y', 'Z'], 0)
    const firsts = new Set<string>()
    for (let seed = 1; seed <= 100; seed++) firsts.add(shuffleChoices(question, mulberry32(seed)).choices[0])
    expect(firsts.size).toBe(4)
  })

  it('anchors "All of these" last and keeps it correct', () => {
    const question = q('s3', 2, ['Traffic signs', 'All of these', 'Motor vehicle laws', 'Safe driving'], 1)
    for (let seed = 1; seed <= 100; seed++) {
      const { choices, answer: a } = shuffleChoices(question, mulberry32(seed))
      expect(choices[3]).toBe('All of these')
      expect(a).toBe(3)
    }
  })

  it('anchors "None of the above" last even when it is wrong', () => {
    const question = q('s4', 2, ['None of the above', '25 mph', '35 mph', '55 mph'], 2)
    for (let seed = 1; seed <= 100; seed++) {
      const { choices, answer: a } = shuffleChoices(question, mulberry32(seed))
      expect(choices[3]).toBe('None of the above')
      expect(choices[a]).toBe('35 mph')
    }
  })

  it('works on every real question', () => {
    const rng = mulberry32(42)
    for (const real of allQuestions) {
      const { choices, answer: a } = shuffleChoices(real, rng)
      expect(choices).toHaveLength(4)
      expect(choices[a]).toBe(real.choices[real.answer])
    }
  })
})

describe('buildExam', () => {
  it('never crashes and never repeats a question', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const paper = buildExam(mulberry32(seed))
      const ids = [...paper.part1, ...paper.part2].map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(paper.kind).toBe('exam')
      expect(paper.part1.every((x) => x.part === 1)).toBe(true)
      expect(paper.part2.every((x) => x.part === 2)).toBe(true)
    }
  })

  it('uses as many questions as exist when content is short', () => {
    const paper = buildExam(mulberry32(7))
    expect(paper.part1.length).toBe(Math.min(EXAM_PART1_COUNT, new Set(p1Pool.map((x) => x.id)).size))
    expect(paper.part2.length).toBe(Math.min(EXAM_PART2_COUNT, new Set(p2Pool.map((x) => x.id)).size))
  })

  it.skipIf(p1Pool.length < EXAM_PART1_COUNT || p2Pool.length < EXAM_PART2_COUNT)('builds a full 10 + 30 paper', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const paper = buildExam(mulberry32(seed))
      expect(paper.part1).toHaveLength(EXAM_PART1_COUNT)
      expect(paper.part2).toHaveLength(EXAM_PART2_COUNT)
    }
  })

  it.skipIf(new Set(p1Pool.map((x) => x.item)).size < EXAM_PART1_COUNT)('spreads part 1 across different sign items', () => {
    const paper = buildExam(mulberry32(3))
    expect(new Set(paper.part1.map((x) => x.item)).size).toBe(EXAM_PART1_COUNT)
  })

  it('is reproducible with the same seed', () => {
    const a = buildExam(mulberry32(99))
    const b = buildExam(mulberry32(99))
    expect(a.part1.map((x) => x.id)).toEqual(b.part1.map((x) => x.id))
    expect(a.part2.map((x) => x.id)).toEqual(b.part2.map((x) => x.id))
  })
})

describe('buildBoss', () => {
  const withQuestions = districts.filter((d) => {
    const ids = new Set(itemsIn(d.id).map((i) => i.id))
    return allQuestions.some((x) => ids.has(x.item))
  })

  it('returns an empty paper for a district with no content', () => {
    const empty = districts.find((d) => itemsIn(d.id).length === 0)
    if (!empty) return
    const paper = buildBoss(empty.id, mulberry32(1))
    expect(paper.part1).toEqual([])
    expect(paper.part2).toEqual([])
    expect(paper.district).toBe(empty.id)
  })

  it.skipIf(withQuestions.length === 0)('only asks about its own district, without repeats', () => {
    for (const d of withQuestions) {
      const ids = new Set(itemsIn(d.id).map((i) => i.id))
      const pool = allQuestions.filter((x) => ids.has(x.item))
      for (let seed = 1; seed <= 5; seed++) {
        const paper = buildBoss(d.id, mulberry32(seed))
        const all = [...paper.part1, ...paper.part2]
        expect(paper.kind).toBe('boss')
        expect(paper.district).toBe(d.id)
        expect(all.length).toBe(Math.min(BOSS_QUESTION_COUNT, pool.length))
        expect(new Set(all.map((x) => x.id)).size).toBe(all.length)
        expect(all.every((x) => ids.has(x.item))).toBe(true)
        expect(paper.part1.every((x) => x.part === 1)).toBe(true)
        expect(paper.part2.every((x) => x.part === 2)).toBe(true)
      }
    }
  })
})
