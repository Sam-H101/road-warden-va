// Merge two saves of the same player (this device and the online copy) so that
// playing on two devices never loses progress: every fact keeps its fuller
// history, every unlock and medal is kept, and counters take the larger value.
// Choices (settings, loadout, name) come from `mine`, the save on this device.
import type { GameState } from '../store/gameStore'
import type { ItemState } from './scheduler'

function union<T>(a: T[], b: T[]): T[] {
  return [...new Set([...a, ...b])]
}

function maxRecord<K extends string>(a: Partial<Record<K, number>>, b: Partial<Record<K, number>>): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = { ...a }
  for (const [k, v] of Object.entries(b) as [K, number][]) out[k] = Math.max(out[k] ?? 0, v ?? 0)
  return out
}

/** The record with more answers wins; on a tie, the one answered later. */
function pickItem(a: ItemState | undefined, b: ItemState | undefined): ItemState {
  if (!a) return b!
  if (!b) return a
  if (a.seen !== b.seen) return a.seen > b.seen ? a : b
  return (b.lastDay || '') > (a.lastDay || '') ? b : a
}

export function mergeSaves(mine: GameState, theirs: GameState): GameState {
  const items: Record<string, ItemState> = {}
  for (const id of union(Object.keys(mine.items), Object.keys(theirs.items))) items[id] = pickItem(mine.items[id], theirs.items[id])

  const missionsCleared: GameState['missionsCleared'] = { ...mine.missionsCleared }
  for (const [d, list] of Object.entries(theirs.missionsCleared) as [keyof GameState['missionsCleared'], number[]][]) {
    missionsCleared[d] = union(missionsCleared[d] ?? [], list ?? []).sort((x, y) => x - y)
  }

  // XP resets on prestige, so XP is only comparable at the same prestige level.
  const ahead = theirs.prestige > mine.prestige ? theirs : mine
  const xp = mine.prestige === theirs.prestige ? Math.max(mine.xp, theirs.xp) : ahead.xp

  const examKey = (e: GameState['examHistory'][number]) => `${e.day}|${e.part1Correct}|${e.part2Correct}|${e.passed}|${e.ready}`
  const exams = new Map<string, GameState['examHistory'][number]>()
  for (const e of [...mine.examHistory, ...theirs.examHistory]) if (!exams.has(examKey(e))) exams.set(examKey(e), e)

  const stats = { ...mine.stats }
  for (const k of Object.keys(stats) as (keyof GameState['stats'])[]) stats[k] = Math.max(mine.stats[k] ?? 0, theirs.stats[k] ?? 0)

  return {
    ...mine,
    playerName: mine.playerName || theirs.playerName,
    createdAt: Math.min(mine.createdAt, theirs.createdAt),
    items,
    xp,
    prestige: Math.max(mine.prestige, theirs.prestige),
    seasonXp: Math.max(mine.seasonXp, theirs.seasonXp),
    missionsCleared,
    bossesCleared: union(mine.bossesCleared, theirs.bossesCleared),
    starsMax: maxRecord(mine.starsMax, theirs.starsMax),
    medals: maxRecord(mine.medals, theirs.medals) as Record<string, number>,
    owned: union(mine.owned, theirs.owned),
    bestScores: maxRecord(mine.bestScores, theirs.bestScores) as Record<string, number>,
    stats,
    playDays: union(mine.playDays, theirs.playDays).sort(),
    examHistory: [...exams.values()].sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0)),
    briefedItems: union(mine.briefedItems, theirs.briefedItems),
    seenIntro: mine.seenIntro || theirs.seenIntro,
  }
}
