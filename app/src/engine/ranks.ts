// 100 ranks. Early ranks are cheap so the first session has several rank-ups.
export const MAX_RANK = 100

export function xpToNext(rank: number): number {
  return Math.min(60 + 25 * (rank - 1), 1500)
}

const cumulative: number[] = [0, 0] // cumulative[r] = total XP needed to reach rank r
for (let r = 2; r <= MAX_RANK; r++) cumulative[r] = cumulative[r - 1] + xpToNext(r - 1)

export function xpForRank(rank: number): number {
  return cumulative[Math.max(1, Math.min(MAX_RANK, rank))]
}

export function rankForXp(xp: number): number {
  let r = 1
  while (r < MAX_RANK && xp >= cumulative[r + 1]) r++
  return r
}

export interface RankProgress {
  rank: number
  title: string
  into: number // xp into this rank
  needed: number // xp this rank needs
  pct: number // 0..1
}

const TITLES = [
  'Rookie', // 1-9
  'Cadet', // 10-19
  'Patroller', // 20-29
  'Road Scout', // 30-39
  'Warden', // 40-49
  'Senior Warden', // 50-59
  'Road Captain', // 60-69
  'Highway Marshal', // 70-79
  'Commander', // 80-89
  'Legend', // 90-99
  'Road Warden Prime', // 100
]

export function rankTitle(rank: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor(rank / 10))]
}

export function rankProgress(xp: number): RankProgress {
  const rank = rankForXp(xp)
  if (rank >= MAX_RANK) return { rank, title: rankTitle(rank), into: 0, needed: 0, pct: 1 }
  const into = xp - cumulative[rank]
  const needed = cumulative[rank + 1] - cumulative[rank]
  return { rank, title: rankTitle(rank), into, needed, pct: needed ? into / needed : 1 }
}

/** Rank required to unlock each mode. */
export const MODE_UNLOCK_RANK = {
  mission: 1,
  quick: 1,
  sniper: 3,
  numbers: 5,
  hazard: 8,
  replay: 1, // also needs at least one miss
  ghost: 1, // also needs a cleared mission
} as const

// ---------- Season track ----------
export const SEASON_TIERS = 50
export const SEASON_XP_PER_TIER = 300

export function seasonTier(seasonXp: number): number {
  return Math.min(SEASON_TIERS, Math.floor(seasonXp / SEASON_XP_PER_TIER))
}
