import { describe, it, expect } from 'vitest'
import { allItems, campaignDistricts, eventById, eventsByItem, isSignItem, itemById, missionCount, missionItems } from './content'
import { mulberry32 } from './rng'
import {
  buildHazard,
  buildMission,
  buildNumbers,
  buildQuick,
  buildReplay,
  MAX_NEW_PER_RUN,
  buildSniper,
  pickEventFor,
  recentMissItems,
  requeueEventFor,
  spaceOut,
  type BuildCtx,
} from './runBuilder'
import { review, type ItemState } from './scheduler'
import type { DistrictId, GameEvent } from './types'

const TODAY = '2026-05-10'
const allUnlocked = campaignDistricts.map((d) => d.id)

function ctx(states: Record<string, ItemState> = {}, seed = 1, unlocked: DistrictId[] = allUnlocked): BuildCtx {
  return { states, today: TODAY, unlocked, rng: mulberry32(seed) }
}

function fake(item: string, n: number): GameEvent {
  return { id: `${item}-${n}`, item, kind: 'gates', prompt: 'p', choices: ['a', 'b', 'c'], answer: 0, missLine: 'm' }
}

function adjacentRepeats(events: GameEvent[]): number {
  let n = 0
  for (let i = 1; i < events.length; i++) if (events[i].item === events[i - 1].item) n++
  return n
}

/** An order with no adjacent repeats exists iff the most common item fits in every other slot. */
function adjacentAvoidable(events: GameEvent[]): boolean {
  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.item, (counts.get(e.item) ?? 0) + 1)
  return Math.max(0, ...counts.values()) <= Math.ceil(events.length / 2)
}

const missions: { district: DistrictId; index: number }[] = []
for (const d of campaignDistricts) for (let m = 0; m < missionCount(d.id); m++) missions.push({ district: d.id, index: m })

const multiEventItems = allItems.filter((i) => (eventsByItem.get(i.id) ?? []).length >= 2)

describe('spaceOut', () => {
  it('handles empty and single lists', () => {
    expect(spaceOut([])).toEqual([])
    const one = [fake('a', 1)]
    expect(spaceOut(one)).toEqual(one)
  })

  it('keeps every event exactly once', () => {
    const input = [fake('a', 1), fake('a', 2), fake('b', 1), fake('c', 1), fake('b', 2), fake('a', 3)]
    const out = spaceOut(input)
    expect(out.map((e) => e.id).sort()).toEqual(input.map((e) => e.id).sort())
  })

  it('does not mutate its input', () => {
    const input = [fake('a', 1), fake('a', 2), fake('b', 1)]
    const copy = input.slice()
    spaceOut(input)
    expect(input).toEqual(copy)
  })

  it('keeps the order when nothing repeats', () => {
    const input = ['a', 'b', 'c', 'd', 'e'].map((x) => fake(x, 1))
    expect(spaceOut(input)).toEqual(input)
  })

  it('spreads pairs at least `gap` apart when possible', () => {
    const input = [fake('a', 1), fake('a', 2), fake('b', 1), fake('b', 2), fake('c', 1), fake('c', 2), fake('d', 1), fake('d', 2)]
    const out = spaceOut(input, 3)
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < Math.min(out.length, i + 4); j++) expect(out[j].item).not.toBe(out[i].item)
    }
  })

  it('avoids adjacent repeats when two items alternate', () => {
    const input = [fake('a', 1), fake('a', 2), fake('a', 3), fake('b', 1), fake('b', 2), fake('b', 3)]
    const out = spaceOut(input)
    expect(adjacentRepeats(out)).toBe(0)
  })

  it('avoids adjacent repeats when one item dominates but can still be split', () => {
    const input = [fake('b', 1), fake('c', 1), fake('a', 1), fake('a', 2), fake('a', 3)]
    const out = spaceOut(input)
    expect(adjacentRepeats(out)).toBe(0)
    expect(out.map((e) => e.item).join('')).toMatch(/^a.a.a$/)
  })

  it('avoids adjacent repeats in many random queues where it is possible', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed)
      const n = 2 + Math.floor(rng() * 14)
      const kinds = 2 + Math.floor(rng() * 5)
      const input = Array.from({ length: n }, (_, i) => fake(String.fromCharCode(97 + Math.floor(rng() * kinds)), i))
      const out = spaceOut(input)
      expect(out).toHaveLength(input.length)
      if (adjacentAvoidable(input)) expect(adjacentRepeats(out), input.map((e) => e.item).join('')).toBe(0)
    }
  })

  it('does not hang when every event is the same item', () => {
    const input = [fake('a', 1), fake('a', 2), fake('a', 3)]
    expect(spaceOut(input)).toHaveLength(3)
  })
})

describe('pickEventFor / requeueEventFor', () => {
  it('returns undefined for unknown items', () => {
    expect(pickEventFor('no-such-item', mulberry32(1))).toBeUndefined()
    expect(requeueEventFor('no-such-item', 'x', mulberry32(1))).toBeUndefined()
  })

  it('always returns an event of the same item', () => {
    const rng = mulberry32(5)
    for (const it of allItems) {
      const e = pickEventFor(it.id, rng)
      if ((eventsByItem.get(it.id) ?? []).length) expect(e?.item).toBe(it.id)
      else expect(e).toBeUndefined()
    }
  })

  it('honours a preferred kind when one exists', () => {
    const rng = mulberry32(8)
    for (const it of allItems) {
      const evs = eventsByItem.get(it.id) ?? []
      for (const kind of ['gates', 'action'] as const) {
        if (!evs.some((e) => e.kind === kind)) continue
        expect(pickEventFor(it.id, rng, new Set(), kind)?.kind).toBe(kind)
      }
    }
  })

  it.skipIf(multiEventItems.length === 0)('requeue picks a different event when one exists', () => {
    for (const it of multiEventItems) {
      for (const missed of eventsByItem.get(it.id) ?? []) {
        for (let seed = 1; seed <= 5; seed++) {
          const e = requeueEventFor(it.id, missed.id, mulberry32(seed))
          expect(e).toBeDefined()
          expect(e!.id).not.toBe(missed.id)
          expect(e!.item).toBe(it.id)
        }
      }
    }
  })

  it('requeue falls back to the same event when it is the only one', () => {
    const single = allItems.find((i) => (eventsByItem.get(i.id) ?? []).length === 1)
    if (!single) return
    const only = eventsByItem.get(single.id)![0]
    expect(requeueEventFor(single.id, only.id, mulberry32(1))?.id).toBe(only.id)
  })
})

describe('buildMission', () => {
  it('does not crash for districts with no content', () => {
    for (const d of campaignDistricts) {
      const plan = buildMission(d.id, 0, ctx())
      expect(Array.isArray(plan.events)).toBe(true)
      expect(plan.key).toBe(`mission:${d.id}:0`)
    }
  })

  it.skipIf(missions.length === 0)('includes every mission item at least once (twice when it has events)', () => {
    for (const { district, index } of missions) {
      for (let seed = 1; seed <= 3; seed++) {
        const plan = buildMission(district, index, ctx({}, seed))
        expect(plan.mode).toBe('mission')
        expect(plan.district).toBe(district)
        expect(plan.missionIndex).toBe(index)
        expect(plan.perksAllowed).toBe(true)
        for (const it of missionItems(district, index)) {
          if (!(eventsByItem.get(it.id) ?? []).length) continue
          const n = plan.events.filter((e) => e.item === it.id).length
          expect(n, `${it.id} in ${plan.key}`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it.skipIf(missions.length === 0)('only contains real events and lists new items for the briefing', () => {
    for (const { district, index } of missions) {
      const plan = buildMission(district, index, ctx())
      for (const e of plan.events) expect(eventById.get(e.id)).toBe(e)
      expect(plan.newItemIds.sort()).toEqual(missionItems(district, index).map((i) => i.id).sort())
    }
  })

  it.skipIf(missions.length === 0)('has no adjacent repeats when avoidable', () => {
    for (const { district, index } of missions) {
      for (let seed = 1; seed <= 10; seed++) {
        const plan = buildMission(district, index, ctx({}, seed))
        if (adjacentAvoidable(plan.events)) expect(adjacentRepeats(plan.events), plan.key).toBe(0)
      }
    }
  })

  it.skipIf(missions.length < 2)('mixes in due review items from other missions', () => {
    const [first, second] = missions
    const states: Record<string, ItemState> = {}
    for (const it of missionItems(first.district, first.index)) states[it.id] = review(undefined, false, TODAY, { isSign: isSignItem(it), now: 1 })
    const plan = buildMission(second.district, second.index, ctx(states))
    const reviewIds = new Set(Object.keys(states))
    const missionIds = new Set(missionItems(second.district, second.index).map((i) => i.id))
    const reviewed = plan.events.filter((e) => reviewIds.has(e.item) && !missionIds.has(e.item))
    const reviewable = [...reviewIds].filter((id) => !missionIds.has(id) && (eventsByItem.get(id) ?? []).length)
    if (reviewable.length) expect(reviewed.length).toBeGreaterThan(0)
    expect(reviewed.length).toBeLessThanOrEqual(6)
    expect(plan.newItemIds.every((id) => !states[id]?.seen)).toBe(true)
  })

  it.skipIf(missions.length === 0)('a ghost race is deterministic, whatever the rng', () => {
    for (const { district, index } of missions) {
      const a = buildMission(district, index, ctx({}, 1), { ghost: 1500 })
      const b = buildMission(district, index, ctx({}, 2), { ghost: 1500 })
      const c = buildMission(district, index, { states: {}, today: TODAY, unlocked: allUnlocked }, { ghost: 900 })
      expect(a.mode).toBe('ghost')
      expect(a.ghostScore).toBe(1500)
      expect(a.key).toBe(`mission:${district}:${index}`)
      expect(a.events.map((e) => e.id)).toEqual(b.events.map((e) => e.id))
      expect(a.events.map((e) => e.id)).toEqual(c.events.map((e) => e.id))
    }
  })
})

describe('other modes', () => {
  it('never crash with no progress or nothing unlocked', () => {
    for (const c of [ctx(), ctx({}, 1, [])]) {
      for (const build of [buildQuick, buildSniper, buildHazard, buildNumbers, buildReplay]) {
        const plan = build(c)
        expect(Array.isArray(plan.events)).toBe(true)
      }
    }
    expect(buildQuick(ctx({}, 1, [])).events).toEqual([])
  })

  it('quick play introduces fresh items for a new player', () => {
    const plan = buildQuick(ctx())
    expect(plan.mode).toBe('quick')
    expect(plan.events.length).toBeLessThanOrEqual(8)
    // Never more new facts than the briefing can show.
    expect(plan.newItemIds.length).toBeLessThanOrEqual(MAX_NEW_PER_RUN)
    if (allItems.some((i) => (eventsByItem.get(i.id) ?? []).length)) expect(plan.events.length).toBeGreaterThan(0)
  })

  it('sign sniper only uses gate events with a sign image', () => {
    const plan = buildSniper(ctx())
    expect(plan.timeLimitSec).toBeGreaterThan(0)
    for (const e of [...plan.events, ...(plan.pool ?? [])]) {
      expect(e.kind).toBe('gates')
      if (e.kind === 'gates') expect(e.image).toBeTruthy()
      expect(isSignItem(itemById.get(e.item)!)).toBe(true)
    }
  })

  it('numbers garage only uses number items', () => {
    const plan = buildNumbers(ctx())
    for (const e of plan.pool ?? []) expect(itemById.get(e.item)?.kind).toBe('number')
  })

  it('hazard rush only uses seen items and allows 3 misses', () => {
    const seenItem = allItems.find((i) => (eventsByItem.get(i.id) ?? []).length)
    const states: Record<string, ItemState> = {}
    if (seenItem) states[seenItem.id] = review(undefined, true, TODAY, { isSign: false })
    const plan = buildHazard(ctx(states))
    expect(plan.maxMisses).toBe(3)
    for (const e of plan.pool ?? []) expect(states[e.item]?.seen).toBeTruthy()
    if (seenItem) expect(plan.pool!.length).toBe(eventsByItem.get(seenItem.id)!.length)
  })

  it('replay range uses the most recent misses', () => {
    const items = allItems.filter((i) => (eventsByItem.get(i.id) ?? []).length).slice(0, 3)
    const states: Record<string, ItemState> = {}
    items.forEach((it, i) => (states[it.id] = review(undefined, false, TODAY, { isSign: false, now: 1000 + i })))
    expect(recentMissItems(states).map((i) => i.id)).toEqual(items.map((i) => i.id).reverse())
    const plan = buildReplay(ctx(states))
    expect(new Set(plan.events.map((e) => e.item))).toEqual(new Set(items.map((i) => i.id)))
  })

  it('a fixed miss leaves the replay list', () => {
    const it = allItems[0]
    if (!it) return
    const missed = review(undefined, false, TODAY, { isSign: false, now: 5 })
    const fixed = review(missed, true, TODAY, { isSign: false })
    expect(recentMissItems({ [it.id]: fixed })).toEqual([])
  })
})
