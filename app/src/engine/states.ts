// Which US state the player is studying for. The choice is stored on the
// device and read once at startup: every content index and the save itself
// are built for one state, so changing state reloads the app.
import statesJson from '@content/states/states.json'

export interface StateInfo {
  code: string // two lowercase letters, e.g. "va"
  name: string
  /** ready = the full course from this state's manual. preview = national sign facts only. */
  status: 'ready' | 'preview'
  agency?: string | null
  manualTitle?: string | null
  manualUrl?: string | null
  exam?: { questions?: number | null; passPercent?: number | null; note?: string | null }
  sources?: string[]
}

/** The state whose facts tagged scope "national" are shared with preview states. */
export const NATIONAL_SOURCE = 'va'
/** Players from before multi-state support are Virginia players. */
export const DEFAULT_STATE = 'va'

const STATE_KEY = 'road-warden-state'

export const states: StateInfo[] = (statesJson as StateInfo[]).slice().sort((a, b) => a.name.localeCompare(b.name))
export const stateByCode = new Map(states.map((s) => [s.code, s]))

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** localStorage key of the save for one state. Virginia keeps the original key. */
export function saveKeyFor(code: string): string {
  return code === 'va' ? 'road-warden-va' : `road-warden-${code}`
}

function readChoice(): string | null {
  const ls = storage()
  const code = ls?.getItem(STATE_KEY)
  if (code && stateByCode.has(code)) return code
  // A save from before states existed: keep that player in Virginia. (An empty
  // save written before the player picked a state does not count.)
  try {
    const old = JSON.parse(ls?.getItem(saveKeyFor('va')) ?? 'null') as { state?: { playerName?: string } } | null
    if (old?.state?.playerName) return 'va'
  } catch {
    /* unreadable save: ask */
  }
  return null
}

const chosen = readChoice()

/** False until the player has picked a state (first launch). */
export const hasChosenState = chosen !== null
export const activeState: StateInfo = stateByCode.get(chosen ?? DEFAULT_STATE) ?? stateByCode.get(DEFAULT_STATE)!

/**
 * Switch to another state and reload. The new state's save starts with the
 * player's name and accessibility settings so nothing has to be set up again.
 */
export function switchState(code: string, carry: { playerName: string; settings: unknown }) {
  const ls = storage()
  if (!ls || !stateByCode.has(code)) return
  ls.setItem(STATE_KEY, code)
  const key = saveKeyFor(code)
  if (!ls.getItem(key)) {
    ls.setItem(key, JSON.stringify({ state: { version: 1, playerName: carry.playerName, settings: carry.settings, seenIntro: true }, version: 1 }))
  }
  if (typeof location !== 'undefined') location.reload()
}

/** First launch: remember the pick. Reloads only if content for another state is loaded. */
export function chooseFirstState(code: string) {
  const ls = storage()
  if (!ls || !stateByCode.has(code)) return
  ls.setItem(STATE_KEY, code)
  if (code !== activeState.code && typeof location !== 'undefined') location.reload()
}

/** One plain sentence about what a state's course covers. */
export function stateCoverage(s: StateInfo): string {
  return s.status === 'ready'
    ? `You get the full course from the ${s.name} driver's manual.`
    : `We have not added the ${s.name} manual yet. For now you can practice road signs and signals, which are the same in every state.`
}

/** Two-letter code shown on license plates in the game art. */
export const PLATE = activeState.code.toUpperCase()
