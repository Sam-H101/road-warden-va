// Small helpers shared by the ui-b screens (Exam, Garage, Contracts, Settings, Stats, Library).
import { useEffect, useState } from 'react'
import { districtById } from '../engine/content'
import { describeSource, type CosmeticDef } from '../engine/loadout'
import { medalById } from '../engine/medals'
import { buildQuick } from '../engine/runBuilder'
import type { DistrictId } from '../engine/types'
import { useNav } from '../app/nav'
import { useGame } from '../store/gameStore'
import { buildCtx, startPlan } from './play'

/** True when animation should be kept to a minimum (setting or OS preference). */
export function useReducedMotion(): boolean {
  const setting = useGame((s) => s.settings.reducedMotion)
  const [os, setOs] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setOs(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return setting || os
}

export function districtName(id: DistrictId | string | undefined, short = false): string {
  if (!id) return ''
  const d = districtById.get(id as DistrictId)
  if (!d) return id
  return short ? d.short : d.name
}

/** Where a cosmetic comes from, in plain words (medal sources name the medal). */
export function sourceLabel(c: CosmeticDef): string {
  if (c.source.kind === 'medal') {
    const m = medalById.get(c.source.medal)
    return m ? `Earn the ${m.name} medal` : 'Earn a medal'
  }
  return describeSource(c, (d) => districtName(d, true))
}

/** "1h 05m", "12m", "45s". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

/** Countdown text: "2d 4h", "4h 31m", "12m". */
export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** "Oct 2" from a day key like "2026-10-02". */
export function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Start a Quick Play run (the scheduler picks what is due). Goes through the
 * briefing when the run introduces items the player has not been briefed on.
 * Falls back to the map when there is nothing to play yet.
 */
export function startQuickPlay(): void {
  if (!startPlan(buildQuick(buildCtx()))) useNav.getState().go({ name: 'map' })
}

/** Milliseconds until local midnight. */
export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

/** Milliseconds until next Monday 00:00 local (weekly contracts reset). */
export function msUntilMonday(now = new Date()): number {
  const day = now.getDay() // 0 Sun .. 6 Sat
  const add = ((8 - day) % 7) || 7
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add)
  return next.getTime() - now.getTime()
}

/** Re-render every `ms` (for countdowns). */
export function useTick(ms: number): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => x + 1), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return n
}
