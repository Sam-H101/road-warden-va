// Tiny screen router. Not persisted: every launch starts at home.
// It mirrors in-app steps into browser history, so the phone's Back button (and
// the installed app's back gesture) goes back one screen instead of leaving.
import { create } from 'zustand'
import type { RunPlan, RunResult } from '../engine/run'
import type { RunSummary, ExamSummary } from '../store/gameStore'
import type { DistrictId } from '../engine/types'

export type Screen =
  | { name: 'home' }
  | { name: 'intro' } // first launch: name + how to play
  | { name: 'map' } // campaign map of districts
  | { name: 'district'; district: DistrictId } // missions + boss + study cards for one district
  | { name: 'briefing'; plan: RunPlan } // intel cards for new items, then drive
  | { name: 'drive'; plan: RunPlan } // the Phaser game
  | { name: 'debrief'; result: RunResult; summary: RunSummary }
  | { name: 'exam'; kind: 'exam' | 'boss' | 'signs'; district?: DistrictId }
  | { name: 'exam-result'; summary: ExamSummary }
  | { name: 'modes' } // all play modes
  | { name: 'garage' } // cosmetics + perks loadout
  | { name: 'contracts' } // daily/weekly contracts + season track
  | { name: 'settings' }
  | { name: 'stats' } // progress, readiness, medals, exam history
  | { name: 'library'; district?: DistrictId } // study cards (all facts, searchable)

interface NavState {
  screen: Screen
  history: Screen[]
  go: (s: Screen) => void
  replace: (s: Screen) => void
  back: () => void
  home: () => void
}

// ---------- browser history mirror ----------

const hasWindow = typeof window !== 'undefined' && typeof history !== 'undefined'
/** Browser entries we pushed on top of the app's first entry. */
let depth = 0
/** Pops we caused ourselves (in-app Back/Home) that the popstate handler must ignore. */
let selfPops = 0
/** While driving, the drive screen takes the Back button (it opens the pause menu). */
let backInterceptor: (() => void) | null = null

function pushEntry() {
  if (!hasWindow) return
  try {
    history.pushState({ rw: true }, '')
    depth++
  } catch {
    /* ignore */
  }
}

function popEntries(n: number) {
  if (!hasWindow || n <= 0) return
  try {
    selfPops++
    history.go(-n)
    depth -= n
  } catch {
    selfPops--
  }
}

/** The drive screen registers here so the hardware Back button pauses instead of dropping the run. */
export function setBackInterceptor(fn: (() => void) | null) {
  backInterceptor = fn
  // Make sure there is an entry to catch the Back press (the first drive is reached by replace).
  if (fn && depth === 0) pushEntry()
}

function goBack(set: (p: Partial<NavState>) => void, get: () => NavState) {
  const h = get().history
  if (!h.length) return set({ screen: { name: 'home' } })
  set({ screen: h[h.length - 1], history: h.slice(0, -1) })
}

export const useNav = create<NavState>((set, get) => ({
  screen: { name: 'home' },
  history: [],
  go: (s) => {
    set({ screen: s, history: [...get().history, get().screen].slice(-20) })
    pushEntry()
  },
  replace: (s) => set({ screen: s }),
  back: () => {
    goBack(set, get)
    if (depth > 0) popEntries(1)
  },
  home: () => {
    set({ screen: { name: 'home' }, history: [] })
    popEntries(depth)
  },
}))

if (hasWindow) {
  window.addEventListener('popstate', () => {
    if (selfPops > 0) {
      selfPops--
      return
    }
    // The learner pressed the browser / phone Back button: the entry is already gone.
    depth = Math.max(0, depth - 1)
    if (useNav.getState().screen.name === 'drive' && backInterceptor) {
      backInterceptor()
      pushEntry() // stay on the drive; the pause menu decides (Resume or Quit run)
      return
    }
    goBack(useNav.setState, useNav.getState)
  })
}
