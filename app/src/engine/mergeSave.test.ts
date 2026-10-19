import { describe, expect, it } from 'vitest'
import { mergeSaves } from './mergeSave'
import { newItemState } from './scheduler'
import { sanitizeSave } from '../store/gameStore'

const base = () => sanitizeSave({})

describe('mergeSaves', () => {
  it('keeps progress from both devices', () => {
    const phone = base()
    phone.items = { a: { ...newItemState(), seen: 4, box: 3, lastDay: '2026-10-01' } }
    phone.missionsCleared = { 'd02-shapes': [0] }
    phone.xp = 300
    phone.playDays = ['2026-10-01']
    phone.settings = { ...phone.settings, bigText: true }

    const laptop = base()
    laptop.items = { a: { ...newItemState(), seen: 2, box: 2, lastDay: '2026-10-02' }, b: { ...newItemState(), seen: 1 } }
    laptop.missionsCleared = { 'd02-shapes': [1], 'd03-regulatory': [0] }
    laptop.xp = 200
    laptop.playDays = ['2026-10-02']
    laptop.bossesCleared = ['d02-shapes']

    const m = mergeSaves(phone, laptop)
    expect(m.items.a.seen).toBe(4)
    expect(m.items.b.seen).toBe(1)
    expect(m.missionsCleared).toEqual({ 'd02-shapes': [0, 1], 'd03-regulatory': [0] })
    expect(m.xp).toBe(300)
    expect(m.playDays).toEqual(['2026-10-01', '2026-10-02'])
    expect(m.bossesCleared).toEqual(['d02-shapes'])
    // Settings follow this device.
    expect(m.settings.bigText).toBe(true)
  })

  it('takes XP from the save with the higher prestige', () => {
    const a = base()
    a.prestige = 1
    a.xp = 50
    const b = base()
    b.xp = 9000
    expect(mergeSaves(a, b).xp).toBe(50)
    expect(mergeSaves(b, a).xp).toBe(50)
  })

  it('does not duplicate exam history', () => {
    const rec = { day: '2026-10-01', part1Correct: 10, part2Correct: 28, passed: true, ready: true }
    const a = base()
    a.examHistory = [rec]
    const b = base()
    b.examHistory = [rec, { ...rec, day: '2026-09-30' }]
    expect(mergeSaves(a, b).examHistory.map((e) => e.day)).toEqual(['2026-09-30', '2026-10-01'])
  })

  it('is stable when merged with itself', () => {
    const a = base()
    a.items = { x: { ...newItemState(), seen: 3 } }
    a.xp = 10
    expect(mergeSaves(a, a)).toEqual(a)
  })
})
