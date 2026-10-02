import { describe, it, expect } from 'vitest'
import { allItems, isSignItem } from './content'
import { MEDALS, awardMedals, medalById } from './medals'
import type { EventOutcome, RunResult } from './run'
import type { RequiredAction } from './types'

interface O {
  correct: boolean
  item?: string
  event?: string
  action?: RequiredAction
  reactionMs?: number
}

function run(list: O[], extra: Partial<RunResult> = {}): RunResult {
  const outcomes: EventOutcome[] = list.map((o, i) => ({
    eventId: o.event ?? `e${i}`,
    itemId: o.item ?? `unknown-${i}`,
    kind: o.action ? 'action' : 'gates',
    action: o.action,
    correct: o.correct,
    reactionMs: o.reactionMs ?? 3000,
    windowMs: 3500,
    points: o.correct ? 100 : 0,
    streakAfter: 0,
    isRequeue: false,
  }))
  let streak = 0
  let maxStreak = 0
  for (const o of outcomes) {
    streak = o.correct ? streak + 1 : 0
    maxStreak = Math.max(maxStreak, streak)
  }
  return { plan: { mode: 'quick', key: 'q', title: 'q', events: [], ramp: 0, perksAllowed: true, newItemIds: [] }, outcomes, score: 0, maxStreak, durationMs: 1, completed: true, slowMoUsed: 0, ...extra }
}

const right = (n: number, o: Partial<O> = {}): O[] => Array.from({ length: n }, () => ({ correct: true, ...o }))
const wrong = (o: Partial<O> = {}): O => ({ correct: false, ...o })

describe('medal definitions', () => {
  it('have unique ids and all fields', () => {
    expect(new Set(MEDALS.map((m) => m.id)).size).toBe(MEDALS.length)
    for (const m of MEDALS) {
      expect(m.name && m.icon && m.description).toBeTruthy()
      expect(medalById.get(m.id)).toBe(m)
    }
  })

  it('every awarded id is a known medal', () => {
    const r = run([...right(30, { action: 'stop', reactionMs: 100 })])
    for (const id of awardMedals(r, new Set())) expect(medalById.has(id)).toBe(true)
  })
})

describe('awardMedals', () => {
  it('awards nothing for an empty run', () => {
    expect(awardMedals(run([]), new Set())).toEqual([])
  })

  it('flawless: 8+ answers, zero misses, finished', () => {
    expect(awardMedals(run(right(8)), new Set())).toContain('flawless')
    expect(awardMedals(run(right(7)), new Set())).not.toContain('flawless')
    expect(awardMedals(run([...right(8), wrong()]), new Set())).not.toContain('flawless')
    expect(awardMedals(run(right(10), { completed: false }), new Set())).not.toContain('flawless')
  })

  it('comeback: 5 right in a row after a miss', () => {
    expect(awardMedals(run([wrong(), ...right(5)]), new Set())).toContain('comeback')
    expect(awardMedals(run([...right(3), wrong(), ...right(5), wrong()]), new Set())).toContain('comeback')
    expect(awardMedals(run([wrong(), ...right(4)]), new Set())).not.toContain('comeback')
    expect(awardMedals(run([wrong(), ...right(4), wrong(), ...right(4)]), new Set())).not.toContain('comeback')
    expect(awardMedals(run(right(12)), new Set())).not.toContain('comeback')
  })

  it('comeback is awarded once even with several comebacks', () => {
    const ids = awardMedals(run([wrong(), ...right(5), wrong(), ...right(5)]), new Set())
    expect(ids.filter((x) => x === 'comeback')).toHaveLength(1)
  })

  it('streak medals at 10 and 20', () => {
    expect(awardMedals(run(right(9)), new Set())).not.toContain('iron-nerves')
    expect(awardMedals(run(right(10)), new Set())).toContain('iron-nerves')
    expect(awardMedals(run(right(19)), new Set())).not.toContain('unstoppable')
    const twenty = awardMedals(run(right(20)), new Set())
    expect(twenty).toContain('unstoppable')
    expect(twenty).toContain('iron-nerves')
  })

  it('quick draw needs fast average reactions on 5+ answers', () => {
    expect(awardMedals(run(right(5, { reactionMs: 1000 })), new Set())).toContain('quick-draw')
    expect(awardMedals(run(right(4, { reactionMs: 1000 })), new Set())).not.toContain('quick-draw')
    expect(awardMedals(run(right(5, { reactionMs: 2000 })), new Set())).not.toContain('quick-draw')
  })

  it('brake master: 3+ stops with no stop misses', () => {
    expect(awardMedals(run(right(3, { action: 'stop' })), new Set())).toContain('brake-master')
    expect(awardMedals(run([...right(3, { action: 'stop' }), wrong({ action: 'stop' })]), new Set())).not.toContain('brake-master')
    expect(awardMedals(run(right(2, { action: 'stop' })), new Set())).not.toContain('brake-master')
  })

  it('storm chaser counts only weather events', () => {
    const wx = new Set(['w1', 'w2'])
    expect(awardMedals(run([{ correct: true, event: 'w1' }, { correct: true, event: 'w2' }]), wx)).toContain('storm-chaser')
    expect(awardMedals(run([{ correct: true, event: 'w1' }, { correct: false, event: 'w2' }]), wx)).not.toContain('storm-chaser')
    expect(awardMedals(run(right(5)), new Set())).not.toContain('storm-chaser')
  })

  it('marathon at 25 answers, misses included', () => {
    expect(awardMedals(run([...right(24), wrong()]), new Set())).toContain('marathon')
    expect(awardMedals(run(right(24)), new Set())).not.toContain('marathon')
  })

  it('sign sniper uses real sign items', () => {
    const sign = allItems.find((i) => isSignItem(i))
    if (!sign) return
    expect(awardMedals(run(right(5, { item: sign.id })), new Set())).toContain('sign-sniper')
    expect(awardMedals(run([...right(5, { item: sign.id }), wrong({ item: sign.id })]), new Set())).not.toContain('sign-sniper')
  })

  it('number cruncher uses real number items', () => {
    const num = allItems.find((i) => i.kind === 'number')
    if (!num) return
    expect(awardMedals(run(right(4, { item: num.id })), new Set())).toContain('number-cruncher')
    expect(awardMedals(run(right(3, { item: num.id })), new Set())).not.toContain('number-cruncher')
  })

  it('does not crash on unknown item ids', () => {
    expect(() => awardMedals(run([wrong({ item: 'nope' }), ...right(5, { item: 'nope' })]), new Set())).not.toThrow()
  })
})
