// Contract checks between content JSON and the engine. Content is written in
// parts, so these only check what exists.
import { describe, it, expect } from 'vitest'
import {
  ITEMS_PER_MISSION,
  allEvents,
  allItems,
  allQuestions,
  campaignDistricts,
  districts,
  itemById,
  itemsIn,
  missionCount,
  missionItems,
} from './content'

function dupes(ids: string[]): string[] {
  const seen = new Set<string>()
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
}

describe('content contract', () => {
  it('has 16 districts in order with one final', () => {
    expect(districts.map((d) => d.order)).toEqual([...districts].map((d) => d.order).sort((a, b) => a - b))
    expect(districts.filter((d) => d.isFinal)).toHaveLength(1)
    expect(campaignDistricts.every((d) => !d.isFinal)).toBe(true)
  })

  it('ids are unique', () => {
    expect(dupes(allItems.map((i) => i.id))).toEqual([])
    expect(dupes(allEvents.map((e) => e.id))).toEqual([])
    expect(dupes(allQuestions.map((q) => q.id))).toEqual([])
  })

  it('every event and question points at a real item', () => {
    expect(allEvents.filter((e) => !itemById.has(e.item)).map((e) => e.id)).toEqual([])
    expect(allQuestions.filter((q) => !itemById.has(q.item)).map((q) => q.id)).toEqual([])
  })

  it('answers are in range', () => {
    for (const e of allEvents) {
      if (e.kind === 'gates') {
        expect(e.choices).toHaveLength(3)
        expect(e.answer, e.id).toBeGreaterThanOrEqual(0)
        expect(e.answer, e.id).toBeLessThan(3)
      }
    }
    for (const q of allQuestions) {
      expect(q.choices, q.id).toHaveLength(4)
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.id).toBeLessThan(4)
      expect(new Set(q.choices).size, q.id).toBe(4)
    }
  })

  it('missions split every district item exactly once', () => {
    for (const d of campaignDistricts) {
      const n = missionCount(d.id)
      const items = itemsIn(d.id)
      expect(n).toBe(items.length ? Math.max(1, Math.ceil(items.length / ITEMS_PER_MISSION)) : 0)
      const split = Array.from({ length: n }, (_, m) => missionItems(d.id, m))
      expect(split.flat().map((i) => i.id)).toEqual(items.map((i) => i.id))
      for (const m of split) expect(m.length).toBeGreaterThan(0)
    }
  })
})
