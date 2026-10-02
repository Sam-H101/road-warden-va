// Projects how the learner would do on the real exam right now.
import { allItems, isSignItem, itemsIn, questionsByItem } from './content'
import { confidence, isMastered, type ItemState } from './scheduler'
import type { DistrictId } from './types'

export interface Readiness {
  signPct: number // average chance of getting a sign question right (0..1)
  signPassChance: number // chance of 10/10 on part one (0..1)
  generalPct: number // expected part-two score (0..1)
  overall: number // single number for the home screen meter (0..1)
  masteredSigns: number
  totalSigns: number
  masteredGeneral: number
  totalGeneral: number
}

export function readiness(states: Record<string, ItemState>): Readiness {
  const examItems = allItems.filter((i) => (questionsByItem.get(i.id) ?? []).length > 0)
  const signs = examItems.filter((i) => isSignItem(i))
  const general = examItems.filter((i) => !isSignItem(i))
  const avg = (list: typeof allItems) =>
    list.length ? list.reduce((s, i) => s + confidence(states[i.id]), 0) / list.length : 0
  const signPct = avg(signs)
  const generalPct = avg(general)
  const signPassChance = Math.pow(signPct, 10)
  // The meter blends both parts but weights the sign gate heavily, because
  // missing one sign fails the whole exam.
  const overall = Math.min(signPassChance * 0.5 + signPct * 0.1 + generalPct * 0.4, 1)
  return {
    signPct,
    signPassChance,
    generalPct,
    overall,
    masteredSigns: signs.filter((i) => isMastered(states[i.id], true)).length,
    totalSigns: signs.length,
    masteredGeneral: general.filter((i) => isMastered(states[i.id], false)).length,
    totalGeneral: general.length,
  }
}

/** 0..5 stars for a district from the average box of its items. */
export function districtStars(district: DistrictId, states: Record<string, ItemState>): number {
  const items = itemsIn(district)
  if (!items.length) return 0
  const avgBox = items.reduce((s, i) => s + (states[i.id]?.box ?? 0), 0) / items.length
  return Math.max(0, Math.min(5, Math.floor(avgBox + 0.0001)))
}

/** Weakest districts among those the player has started, weakest first. */
export function weakestDistricts(states: Record<string, ItemState>, unlocked: DistrictId[]): DistrictId[] {
  const score = (d: DistrictId) => {
    const items = itemsIn(d)
    if (!items.length) return 99
    const seen = items.filter((i) => states[i.id]?.seen)
    if (!seen.length) return 50
    return items.reduce((s, i) => s + confidence(states[i.id]), 0) / items.length
  }
  return unlocked.filter((d) => itemsIn(d).length).sort((a, b) => score(a) - score(b))
}
