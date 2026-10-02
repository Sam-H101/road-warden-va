import { describe, it, expect } from 'vitest'
import { allItems, campaignDistricts, isSignItem, itemsIn, questionsByItem } from './content'
import { districtStars, readiness, weakestDistricts, type Readiness } from './readiness'
import { mulberry32 } from './rng'
import { newItemState, type ItemState } from './scheduler'
import type { DistrictId } from './types'

function allAtBox(box: number, days = 5): Record<string, ItemState> {
  const out: Record<string, ItemState> = {}
  for (const it of allItems) {
    out[it.id] = { ...newItemState(), box, seen: box ? 1 : 0, correctDays: Array.from({ length: days }, (_, i) => `2026-01-0${i + 1}`) }
  }
  return out
}

function inBounds(r: Readiness) {
  for (const v of [r.signPct, r.signPassChance, r.generalPct, r.overall]) {
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  }
  expect(r.masteredSigns).toBeLessThanOrEqual(r.totalSigns)
  expect(r.masteredGeneral).toBeLessThanOrEqual(r.totalGeneral)
}

const examItems = allItems.filter((i) => (questionsByItem.get(i.id) ?? []).length > 0)

describe('readiness', () => {
  it('stays within 0..1 for a brand new player', () => {
    const r = readiness({})
    inBounds(r)
    expect(r.masteredSigns).toBe(0)
    expect(r.masteredGeneral).toBe(0)
  })

  it('stays within 0..1 at full mastery', () => {
    const r = readiness(allAtBox(5))
    inBounds(r)
    if (examItems.length) expect(r.overall).toBeGreaterThan(0.5)
  })

  it('stays within 0..1 for random progress', () => {
    const rng = mulberry32(11)
    for (let k = 0; k < 50; k++) {
      const states: Record<string, ItemState> = {}
      for (const it of allItems) if (rng() < 0.7) states[it.id] = { ...newItemState(), box: Math.floor(rng() * 6), correctDays: ['a', 'b', 'c'] }
      inBounds(readiness(states))
    }
  })

  it('never goes down when every item moves up a box', () => {
    let prev = -1
    for (let box = 0; box <= 5; box++) {
      const r = readiness(allAtBox(box))
      expect(r.overall).toBeGreaterThanOrEqual(prev)
      prev = r.overall
    }
  })

  it('counts signs and general items from content', () => {
    const r = readiness({})
    expect(r.totalSigns + r.totalGeneral).toBe(examItems.length)
    expect(r.totalSigns).toBe(examItems.filter((i) => isSignItem(i)).length)
  })

  it('signs need the 3-day rule to count as mastered', () => {
    const r = readiness(allAtBox(5, 2))
    expect(r.masteredSigns).toBe(0)
    expect(r.masteredGeneral).toBe(r.totalGeneral)
  })

  it('sign pass chance is the chance of 10 in a row', () => {
    const r = readiness(allAtBox(3))
    expect(r.signPassChance).toBeCloseTo(Math.pow(r.signPct, 10), 10)
  })
})

describe('districtStars', () => {
  it('is 0..5 and 0 for empty districts', () => {
    const ids: DistrictId[] = campaignDistricts.map((d) => d.id)
    for (const d of ids) {
      expect(districtStars(d, {})).toBe(0)
      const full = districtStars(d, allAtBox(5))
      expect(full).toBe(itemsIn(d).length ? 5 : 0)
      for (let b = 0; b <= 5; b++) {
        const s = districtStars(d, allAtBox(b))
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('weakestDistricts', () => {
  it('only lists unlocked districts that have content', () => {
    const unlocked = campaignDistricts.map((d) => d.id)
    const weak = weakestDistricts({}, unlocked)
    for (const d of weak) {
      expect(unlocked).toContain(d)
      expect(itemsIn(d).length).toBeGreaterThan(0)
    }
    expect(weakestDistricts({}, [])).toEqual([])
  })

  it('puts a started, struggling district first', () => {
    const withContent = campaignDistricts.map((d) => d.id).filter((d) => itemsIn(d).length)
    if (withContent.length < 2) return
    const [a, b] = withContent
    const states: Record<string, ItemState> = {}
    for (const it of itemsIn(a)) states[it.id] = { ...newItemState(), box: 1, seen: 1 }
    for (const it of itemsIn(b)) states[it.id] = { ...newItemState(), box: 5, seen: 3 }
    const weak = weakestDistricts(states, [a, b])
    expect(weak[0]).toBe(a)
  })
})
