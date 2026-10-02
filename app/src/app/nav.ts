// Tiny screen router. Not persisted: every launch starts at home.
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

export const useNav = create<NavState>((set, get) => ({
  screen: { name: 'home' },
  history: [],
  go: (s) => set({ screen: s, history: [...get().history, get().screen].slice(-20) }),
  replace: (s) => set({ screen: s }),
  back: () => {
    const h = get().history
    if (!h.length) return set({ screen: { name: 'home' } })
    set({ screen: h[h.length - 1], history: h.slice(0, -1) })
  },
  home: () => set({ screen: { name: 'home' }, history: [] }),
}))
