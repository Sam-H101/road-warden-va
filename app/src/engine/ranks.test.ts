import { describe, it, expect } from 'vitest'
import {
  MAX_RANK,
  MODE_UNLOCK_RANK,
  SEASON_TIERS,
  SEASON_XP_PER_TIER,
  rankForXp,
  rankProgress,
  rankTitle,
  seasonTier,
  xpForRank,
  xpToNext,
} from './ranks'

describe('ranks', () => {
  it('starts at rank 1 with 0 xp', () => {
    expect(rankForXp(0)).toBe(1)
    expect(xpForRank(1)).toBe(0)
  })

  it('negative xp never goes below rank 1', () => {
    expect(rankForXp(-500)).toBe(1)
  })

  it('xp needed per rank is positive, non-decreasing and capped', () => {
    for (let r = 1; r < MAX_RANK; r++) {
      expect(xpToNext(r)).toBeGreaterThan(0)
      expect(xpToNext(r + 1)).toBeGreaterThanOrEqual(xpToNext(r))
      expect(xpToNext(r)).toBeLessThanOrEqual(1500)
    }
  })

  it('xpForRank is strictly increasing', () => {
    for (let r = 2; r <= MAX_RANK; r++) expect(xpForRank(r)).toBeGreaterThan(xpForRank(r - 1))
  })

  it('rankForXp is the inverse of xpForRank at every boundary', () => {
    for (let r = 1; r <= MAX_RANK; r++) {
      expect(rankForXp(xpForRank(r))).toBe(r)
      if (r > 1) expect(rankForXp(xpForRank(r) - 1)).toBe(r - 1)
    }
  })

  it('rankForXp is monotonic and caps at MAX_RANK', () => {
    let prev = 1
    for (let xp = 0; xp <= xpForRank(MAX_RANK) + 5000; xp += 97) {
      const r = rankForXp(xp)
      expect(r).toBeGreaterThanOrEqual(prev)
      expect(r).toBeLessThanOrEqual(MAX_RANK)
      prev = r
    }
    expect(rankForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_RANK)
  })

  it('xpForRank clamps out-of-range ranks', () => {
    expect(xpForRank(0)).toBe(0)
    expect(xpForRank(-3)).toBe(0)
    expect(xpForRank(MAX_RANK + 10)).toBe(xpForRank(MAX_RANK))
  })

  it('the first session gives several rank-ups (early ranks are cheap)', () => {
    // About five runs at ~150 xp each.
    expect(rankForXp(750)).toBeGreaterThanOrEqual(4)
  })

  it('rankProgress reports a fraction within the current rank', () => {
    for (let xp = 0; xp < xpForRank(MAX_RANK); xp += 331) {
      const p = rankProgress(xp)
      expect(p.rank).toBe(rankForXp(xp))
      expect(p.pct).toBeGreaterThanOrEqual(0)
      expect(p.pct).toBeLessThan(1)
      expect(p.into).toBeGreaterThanOrEqual(0)
      expect(p.into).toBeLessThan(p.needed)
      expect(p.needed).toBe(xpToNext(p.rank))
      expect(p.title).toBe(rankTitle(p.rank))
    }
  })

  it('rankProgress at an exact boundary starts at 0%', () => {
    const p = rankProgress(xpForRank(7))
    expect(p.rank).toBe(7)
    expect(p.into).toBe(0)
    expect(p.pct).toBe(0)
  })

  it('rankProgress at max rank is full', () => {
    expect(rankProgress(xpForRank(MAX_RANK) + 99999)).toMatchObject({ rank: MAX_RANK, pct: 1, into: 0, needed: 0 })
  })

  it('titles follow the decade of the rank', () => {
    expect(rankTitle(1)).toBe('Rookie')
    expect(rankTitle(9)).toBe('Rookie')
    expect(rankTitle(10)).toBe('Cadet')
    expect(rankTitle(99)).toBe('Legend')
    expect(rankTitle(100)).toBe('Road Warden Prime')
    for (let r = 1; r <= MAX_RANK; r++) expect(rankTitle(r)).toBeTruthy()
  })

  it('mode unlock ranks are reachable', () => {
    for (const r of Object.values(MODE_UNLOCK_RANK)) {
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(MAX_RANK)
    }
  })
})

describe('season track', () => {
  it('tiers grow with xp and cap', () => {
    expect(seasonTier(0)).toBe(0)
    expect(seasonTier(SEASON_XP_PER_TIER - 1)).toBe(0)
    expect(seasonTier(SEASON_XP_PER_TIER)).toBe(1)
    expect(seasonTier(SEASON_XP_PER_TIER * 1000)).toBe(SEASON_TIERS)
  })
})
