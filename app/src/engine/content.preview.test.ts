// A state whose manual is not written yet plays only the national sign facts.
import { describe, expect, it, vi } from 'vitest'

vi.mock('./states', async (orig) => {
  const real = await orig<typeof import('./states')>()
  return { ...real, activeState: { code: 'tx', name: 'Texas', status: 'preview' }, hasChosenState: true }
})

const content = await import('./content')

describe('preview state content', () => {
  it('only has national facts', () => {
    expect(content.isPreviewState).toBe(true)
    expect(content.allItems.length).toBeGreaterThan(50)
    expect(content.allItems.every((i) => i.scope === 'national')).toBe(true)
  })

  it('only has events and questions for those facts', () => {
    const ids = new Set(content.allItems.map((i) => i.id))
    expect(content.allEvents.every((e) => ids.has(e.item))).toBe(true)
    expect(content.allQuestions.every((q) => ids.has(q.item))).toBe(true)
  })

  it('never names Virginia', () => {
    const text = JSON.stringify([content.allItems, content.allEvents, content.allQuestions, content.story])
    expect(text).not.toMatch(/Virginia/)
    expect(content.story.districts[0].intro.join(' ')).not.toMatch(/Virginia/)
  })

  it('leaves state-law districts empty', () => {
    expect(content.missionCount('d14-penalties')).toBe(0)
    expect(content.missionCount('d02-shapes')).toBeGreaterThan(0)
  })
})
