// RunDirector: pacing (slow roll + GO), queue, requeues, streaks, perks and lives.
import { describe, expect, it } from 'vitest'
import type { RunPlan } from '../engine/run'
import type { ActionEvent, GameEvent, GateEvent } from '../engine/types'
import { BASE_WINDOW_MS, GO_ARRIVE_MS, MIN_WINDOW_MS, RunDirector, SLOW_ROLL_WINDOW_MS, isPlayable, runHasEvents } from './director'

const gate = (id: string, item = id): GateEvent => ({
  id,
  item,
  kind: 'gates',
  prompt: 'Q?',
  choices: ['a', 'b', 'c'],
  answer: 1,
  missLine: 'It is b.',
})
const action = (id: string, item = id): ActionEvent => ({ id, item, kind: 'action', prompt: 'Stop!', action: 'stop', missLine: 'Stop.' })

const plan = (over: Partial<RunPlan> = {}): RunPlan => ({
  mode: 'mission',
  key: 'test',
  title: 'Test',
  events: [gate('g1'), gate('g2'), action('a1'), gate('g3')],
  ramp: 0,
  perksAllowed: true,
  newItemIds: [],
  ...over,
})

describe('pacing', () => {
  it('learning modes slow roll with a one-minute window and a GO that arrives in ~4.5 s', () => {
    for (const mode of ['mission', 'quick', 'replay', 'ghost'] as const) {
      const d = new RunDirector(plan({ mode }), [])
      expect(d.slowRoll).toBe(true)
      expect(d.windowMs(1)).toBe(SLOW_ROLL_WINDOW_MS)
      expect(d.windowMs(2)).toBe(SLOW_ROLL_WINDOW_MS)
      expect(SLOW_ROLL_WINDOW_MS / d.goMultiplier).toBeCloseTo(GO_ARRIVE_MS)
    }
  })

  it('timed and survival modes use the 6.5 s base, scaled, with a floor', () => {
    const d = new RunDirector(plan({ mode: 'sniper', pool: [gate('p1'), gate('p2')], ramp: 0.5 }), [])
    expect(d.slowRoll).toBe(false)
    expect(d.goMultiplier).toBe(2)
    d.next()
    expect(d.windowMs(1)).toBe(BASE_WINDOW_MS)
    expect(d.windowMs(1.5)).toBe(BASE_WINDOW_MS * 1.5)
    for (let i = 0; i < 30; i++) d.next()
    expect(d.windowMs(1)).toBe(MIN_WINDOW_MS)
  })

  it('radar gives timed modes 30% more time', () => {
    const d = new RunDirector(plan({ mode: 'hazard', pool: [gate('p1')] }), ['radar'])
    d.next()
    expect(d.windowMs(1)).toBeCloseTo(BASE_WINDOW_MS * 1.3)
  })
})

describe('queue and requeues', () => {
  it('skips malformed events and reports empty runs', () => {
    const bad = { id: 'x', item: 'x', kind: 'gates', choices: ['a'], answer: 0 } as unknown as GameEvent
    expect(isPlayable(bad)).toBe(false)
    expect(isPlayable(undefined)).toBe(false)
    expect(runHasEvents(plan({ events: [bad] }))).toBe(false)
    const d = new RunDirector(plan({ events: [bad, gate('ok')] }), [])
    expect(d.total).toBe(1)
    expect(d.next()?.ev.id).toBe('ok')
    expect(d.next()).toBeUndefined()
  })

  it('a miss re-queues the item 2-3 events later, once per item', () => {
    const d = new RunDirector(plan({ events: [gate('g1'), gate('g2'), gate('g3'), gate('g4'), gate('g5')] }), [], () => 0)
    const q = d.next()!
    const r = d.resolve(q, false, 1000, 60000)
    expect(r.requeued).toBe(true)
    expect(d.total).toBe(6)
    const order = [d.next(), d.next(), d.next()].map((x) => x!)
    expect(order[2].isRequeue).toBe(true)
    expect(order[2].ev.item).toBe('g1')
    // Missing the requeue again does not add a third copy.
    expect(d.resolve(order[2], false, 1000, 60000).requeued).toBe(false)
    expect(d.total).toBe(6)
  })

  it('endless modes space a requeue 3-4 spawns later instead of right after the Replay', () => {
    const d = new RunDirector(plan({ mode: 'hazard', events: [], pool: [gate('p1'), gate('p2'), gate('p3'), gate('p4'), gate('p5')] }), [], () => 0)
    const first = d.next()!
    expect(d.resolve(first, false, 1000, 6500).requeued).toBe(true)
    const after = [d.next(), d.next(), d.next()].map((x) => x!)
    expect(after[0].isRequeue).toBe(false)
    expect(after[1].isRequeue).toBe(false)
    expect(after[2].isRequeue).toBe(true)
    expect(after[2].ev.item).toBe(first.ev.item)
  })

  it('calm (slow roll) scoring gives a flat bonus, so waiting scores the same as rushing', () => {
    const d = new RunDirector(plan({ events: [gate('g1'), gate('g2')] }), [])
    const fast = d.resolve(d.next()!, true, 0, 60000, undefined, true).points
    const d2 = new RunDirector(plan({ events: [gate('g1'), gate('g2')] }), [])
    const slow = d2.resolve(d2.next()!, true, 59000, 60000, undefined, true).points
    expect(fast).toBe(slow)
  })

  it('endless modes keep drawing from the pool', () => {
    const d = new RunDirector(plan({ mode: 'numbers', events: [], pool: [gate('p1'), gate('p2'), gate('p3')] }), [])
    for (let i = 0; i < 10; i++) expect(d.next()).toBeDefined()
  })
})

describe('scoring, streaks and perks', () => {
  it('scores with the multiplier and resets the streak on a miss', () => {
    const d = new RunDirector(plan({ events: Array.from({ length: 12 }, (_, i) => gate(`g${i}`)) }), [])
    let last = 0
    for (let i = 0; i < 10; i++) {
      const res = d.resolve(d.next()!, true, 0, 60000)
      expect(res.points).toBeGreaterThan(0)
      last = res.points
      if (i === 4) expect(res.reward).toBe('horn')
      if (i === 9) expect(res.reward).toBe('nitro')
    }
    expect(last).toBe(550)
    expect(d.streak).toBe(10)
    d.resolve(d.next()!, false, 0, 60000)
    expect(d.streak).toBe(0)
    expect(d.maxStreak).toBe(10)
    const r = d.result(true, 1234)
    expect(r.outcomes).toHaveLength(11)
    expect(r.score).toBe(d.score)
    expect(r.completed).toBe(true)
  })

  it('second chance keeps the streak on the first miss only', () => {
    const d = new RunDirector(plan({ events: Array.from({ length: 6 }, (_, i) => gate(`g${i}`)) }), ['second-chance'])
    d.resolve(d.next()!, true, 0, 60000)
    d.resolve(d.next()!, true, 0, 60000)
    const saved = d.resolve(d.next()!, false, 0, 60000)
    expect(saved.streakSaved).toBe(true)
    expect(d.streak).toBe(2)
    const lost = d.resolve(d.next()!, false, 0, 60000)
    expect(lost.streakSaved).toBe(false)
    expect(d.streak).toBe(0)
  })

  it('perks are ignored when the plan does not allow them', () => {
    const d = new RunDirector(plan({ perksAllowed: false }), ['hint-flare', 'slow-mo'])
    expect(d.useFlare()).toBe(false)
    expect(d.useSlowMo()).toBe(false)
    const on = new RunDirector(plan(), ['hint-flare', 'slow-mo'])
    expect(on.flareCharges).toBe(3)
    expect(on.useSlowMo()).toBe(true)
    expect(on.slowMoUsed).toBe(1)
  })

  it('hazard mode ends after max misses', () => {
    const d = new RunDirector(plan({ mode: 'hazard', events: [], pool: [gate('p1'), gate('p2')], maxMisses: 2 }), [])
    d.resolve(d.next()!, false, 0, 6500)
    expect(d.outOfLives).toBe(false)
    expect(d.livesLeft).toBe(1)
    d.resolve(d.next()!, false, 0, 6500)
    expect(d.outOfLives).toBe(true)
  })
})
