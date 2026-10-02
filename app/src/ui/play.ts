// Shared helpers for starting runs and reading campaign progress.
// Used by Home, Intro, District, Modes, Debrief.
import { useNav } from '../app/nav'
import { campaignDistricts, districtById, itemById, missionCount } from '../engine/content'
import { dayKey, dayNumber } from '../engine/rng'
import type { RunPlan } from '../engine/run'
import {
  buildHazard,
  buildMission,
  buildNumbers,
  buildQuick,
  buildReplay,
  buildSniper,
  type BuildCtx,
} from '../engine/runBuilder'
import { isDue } from '../engine/scheduler'
import type { DistrictId, RequiredAction } from '../engine/types'
import { unlockedDistricts, useGame, type GameState } from '../store/gameStore'

/** Build context from the live store. */
export function buildCtx(): BuildCtx {
  const s = useGame.getState()
  return { states: s.items, today: dayKey(), unlocked: unlockedDistricts(s) }
}

/** A plan with nothing on the road would end instantly. */
export function planHasRoad(plan: RunPlan): boolean {
  return plan.events.length > 0 || (plan.pool?.length ?? 0) > 0
}

/** Items in the plan that still need an intel card. */
export function unbriefedItems(plan: RunPlan): string[] {
  const briefed = new Set(useGame.getState().briefedItems)
  return plan.newItemIds.filter((id) => !briefed.has(id) && itemById.has(id))
}

/**
 * Go to the briefing (if there are new items) or straight to the drive.
 * Returns false when the plan has nothing to drive.
 */
export function startPlan(plan: RunPlan, how: 'go' | 'replace' = 'go'): boolean {
  if (!planHasRoad(plan)) return false
  const nav = useNav.getState()
  const target = unbriefedItems(plan).length ? ({ name: 'briefing', plan } as const) : ({ name: 'drive', plan } as const)
  if (how === 'replace') nav.replace(target)
  else nav.go(target)
  return true
}

export function missionKey(d: DistrictId, i: number): string {
  return `mission:${d}:${i}`
}

export function clearedSet(s: Pick<GameState, 'missionsCleared'>, d: DistrictId): Set<number> {
  return new Set(s.missionsCleared[d] ?? [])
}

/** First uncleared mission in a district (missions open in order). */
export function nextMissionIn(s: Pick<GameState, 'missionsCleared'>, d: DistrictId): number | undefined {
  const n = missionCount(d)
  const done = clearedSet(s, d)
  for (let i = 0; i < n; i++) if (!done.has(i)) return i
  return undefined
}

/** A mission is open if it is the first one or the one before it is cleared. */
export function isMissionOpen(s: Pick<GameState, 'missionsCleared'>, d: DistrictId, i: number): boolean {
  if (i === 0) return true
  const done = clearedSet(s, d)
  return done.has(i - 1) || done.has(i)
}

/** The next campaign mission to play, in district order. */
export function campaignNext(s: Pick<GameState, 'missionsCleared'>): { district: DistrictId; missionIndex: number } | undefined {
  for (const d of unlockedDistricts(s)) {
    const i = nextMissionIn(s, d)
    if (i !== undefined) return { district: d, missionIndex: i }
  }
  return undefined
}

/** The district the player is "in" right now: newest unlocked district with content. */
export function currentDistrict(s: Pick<GameState, 'missionsCleared'>): DistrictId | undefined {
  const next = campaignNext(s)
  if (next) return next.district
  const withContent = unlockedDistricts(s).filter((d) => missionCount(d) > 0)
  return withContent[withContent.length - 1]
}

/** Most advanced cleared mission (stands in for "most recent"). */
export function latestClearedMission(s: Pick<GameState, 'missionsCleared'>): { district: DistrictId; missionIndex: number } | undefined {
  let out: { district: DistrictId; missionIndex: number } | undefined
  for (const d of campaignDistricts) {
    const list = s.missionsCleared[d.id] ?? []
    if (list.length) out = { district: d.id, missionIndex: Math.max(...list) }
  }
  return out
}

export function allClearedMissions(s: Pick<GameState, 'missionsCleared'>): { district: DistrictId; missionIndex: number }[] {
  const out: { district: DistrictId; missionIndex: number }[] = []
  for (const d of campaignDistricts) for (const i of s.missionsCleared[d.id] ?? []) out.push({ district: d.id, missionIndex: i })
  return out
}

/** How many items are due for review today. */
export function dueCount(s: Pick<GameState, 'items'>): number {
  const today = dayKey()
  let n = 0
  for (const [id, st] of Object.entries(s.items)) if (itemById.has(id) && isDue(st, today)) n++
  return n
}

/** Consecutive days played, counting back from today (or yesterday if not yet today). */
export function dayStreak(playDays: string[]): number {
  if (!playDays.length) return 0
  const nums = new Set(playDays.map(dayNumber))
  let d = dayNumber(dayKey())
  if (!nums.has(d)) d -= 1
  let n = 0
  while (nums.has(d)) {
    n++
    d--
  }
  return n
}

export function playedToday(playDays: string[]): boolean {
  return playDays.includes(dayKey())
}

export function missionPlan(d: DistrictId, i: number, ghost?: number): RunPlan {
  return buildMission(d, i, buildCtx(), ghost !== undefined ? { ghost } : {})
}

/** Build a fresh plan of the same kind (for NEXT RUN / play again). */
export function rebuildPlan(plan: RunPlan): RunPlan {
  const ctx = buildCtx()
  switch (plan.mode) {
    case 'mission':
      return buildMission(plan.district!, plan.missionIndex ?? 0, ctx)
    case 'ghost': {
      const best = useGame.getState().bestScores[plan.key] ?? plan.ghostScore ?? 0
      return buildMission(plan.district!, plan.missionIndex ?? 0, ctx, { ghost: best })
    }
    case 'quick':
      return buildQuick(ctx)
    case 'sniper':
      return buildSniper(ctx)
    case 'hazard':
      return buildHazard(ctx)
    case 'numbers':
      return buildNumbers(ctx)
    case 'replay':
      return buildReplay(ctx)
  }
}

export function districtName(d: DistrictId | undefined): string {
  if (!d) return ''
  return districtById.get(d)?.name ?? d
}

/** Plain-words version of an action rule, for miss cards. */
export const ACTION_WORDS: Record<RequiredAction, string> = {
  stop: 'Come to a full stop.',
  slow: 'Slow down.',
  go: 'Keep going. Do not stop.',
  'move-left': 'Move over one lane, away from it.',
  'move-right': 'Move over one lane, away from it.',
  'pull-over': 'Pull over to the right and stop.',
  'brake-straight': 'Brake. Stay in your lane. Do not swerve.',
}

/** Greeting by time of day. */
export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late shift'
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}
