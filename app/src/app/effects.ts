// App-wide side effects: settings -> <html> classes, audio + speech config,
// and a session timer that powers the friendly break reminder.
import { useEffect, useSyncExternalStore } from 'react'
import { setSfxVolume, unlockAudio } from '../services/sfx'
import { configureSpeech } from '../services/speech'
import { useGame, type Settings } from '../store/gameStore'

// ---------- settings -> document ----------

export function applySettings(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('big-text', s.bigText)
  root.classList.toggle('high-contrast', s.highContrast)
  root.classList.toggle('reduced-motion', s.reducedMotion)
  root.classList.toggle('font-system', s.font === 'system')
  setSfxVolume(s.volume, s.muted)
  configureSpeech({ rate: s.voiceRate, enabled: s.readAloud !== 'off' })
}

// ---------- session timer ----------
// Counts minutes of *active* play: time while the page is visible. If the tab
// is hidden for a long stretch (a real break), the session starts over.

const BREAK_RESET_MS = 10 * 60 * 1000

let activeMs = 0
let visibleSince: number | null = typeof document === 'undefined' || document.visibilityState === 'visible' ? Date.now() : null
let hiddenSince: number | null = null
let timerInstalled = false

function installSessionTimer() {
  if (timerInstalled || typeof document === 'undefined') return
  timerInstalled = true
  document.addEventListener('visibilitychange', () => {
    const now = Date.now()
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) activeMs += now - visibleSince
      visibleSince = null
      hiddenSince = now
    } else {
      if (hiddenSince !== null && now - hiddenSince >= BREAK_RESET_MS) activeMs = 0
      hiddenSince = null
      visibleSince = now
    }
  })
}

/** Minutes of active play this session. */
export function getSessionMinutes(): number {
  const live = visibleSince !== null ? Date.now() - visibleSince : 0
  return (activeMs + live) / 60000
}

/** Start the session clock over (the learner took a break, or chose to keep going). */
export function resetSession() {
  activeMs = 0
  visibleSince = Date.now()
}

/** True when the break reminder should show. */
export function isBreakDue(breakReminderMin: number): boolean {
  return breakReminderMin > 0 && getSessionMinutes() >= breakReminderMin
}

// ---------- reduced motion ----------

function subscribeMotion(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function osPrefersReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True if the learner turned on reduced motion or the OS asks for it. */
export function useReducedMotion(): boolean {
  const setting = useGame((s) => s.settings.reducedMotion)
  const os = useSyncExternalStore(subscribeMotion, osPrefersReduced, () => false)
  return setting || os
}

// ---------- the hook App uses ----------

export function useAppEffects() {
  const settings = useGame((s) => s.settings)

  useEffect(() => {
    applySettings(settings)
  }, [settings])

  useEffect(() => {
    installSessionTimer()
    // Fresh daily / weekly contracts on every launch.
    useGame.getState().refreshContracts()
    // Contracts roll over at midnight and on Monday; check when the app comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') useGame.getState().refreshContracts()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}
