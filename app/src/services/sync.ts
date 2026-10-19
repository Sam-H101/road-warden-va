// Online saves: sign in with Google, then keep this device's save and the
// online copy (server/ worker, stored in a private GitHub repo) in step.
// The game always works without this; the local save stays the main copy and
// is never blocked on the network.
import { create } from 'zustand'
import { mergeSaves } from '../engine/mergeSave'
import { activeState } from '../engine/states'
import { sanitizeSave, snapshotSave, useGame, type GameState } from '../store/gameStore'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SYNC_URL = (import.meta.env.VITE_SYNC_URL ?? '').replace(/\/+$/, '')
const SESSION_KEY = 'road-warden-session'
const META_KEY = `road-warden-sync-${activeState.code}`
/** Wait this long after the last change before saving online. */
const DEBOUNCE_MS = 15_000

export const syncConfigured = !!(CLIENT_ID && SYNC_URL)

interface Session {
  token: string
  expiresAt: number
  user: { name: string; picture: string }
  /** Hashed account id (from the token), to notice a different account signing in. */
  userKey: string
}

interface Meta {
  userKey: string
  remoteUpdatedAt: number
}

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

interface SyncState {
  status: SyncStatus
  user: Session['user'] | null
  lastSyncAt: number
  message: string
}

export const useSync = create<SyncState>(() => ({
  status: syncConfigured ? 'signed-out' : 'off',
  user: null,
  lastSyncAt: 0,
  message: '',
}))

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage full or blocked: online save still works for this session */
  }
}

function session(): Session | null {
  const s = readJson<Session>(SESSION_KEY)
  return s && s.expiresAt > Date.now() ? s : null
}

function tokenSubject(token: string): string {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(part)) as { sub: string }).sub
  } catch {
    return ''
  }
}

// ---------- Google sign-in ----------

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; use_fedcm_for_prompt?: boolean }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
  disableAutoSelect: () => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let gisLoading: Promise<GoogleId> | null = null

function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  gisLoading ??= new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = 'https://accounts.google.com/gsi/client'
    el.async = true
    el.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('no gsi')))
    el.onerror = () => {
      gisLoading = null
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(el)
  })
  return gisLoading
}

/** Draw Google's own sign-in button into `el`. */
export async function renderGoogleButton(el: HTMLElement) {
  try {
    const gid = await loadGoogle()
    gid.initialize({ client_id: CLIENT_ID, callback: (r) => void exchange(r.credential), use_fedcm_for_prompt: true })
    gid.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', width: 280 })
  } catch {
    useSync.setState({ status: 'offline', message: 'Google sign-in did not load. Check the internet connection.' })
  }
}

async function exchange(credential: string) {
  useSync.setState({ status: 'syncing', message: '' })
  try {
    const res = await fetch(`${SYNC_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const body = (await res.json()) as { token?: string; expiresAt?: number; user?: Session['user']; error?: string }
    if (!res.ok || !body.token) throw new Error(body.error || 'Sign-in failed.')
    const s: Session = { token: body.token, expiresAt: body.expiresAt ?? 0, user: body.user ?? { name: '', picture: '' }, userKey: tokenSubject(body.token) }
    writeJson(SESSION_KEY, s)
    useSync.setState({ user: s.user })
    await syncNow()
  } catch (e) {
    useSync.setState({ status: 'error', message: e instanceof Error ? e.message : 'Sign-in failed.' })
  }
}

export function signOut() {
  writeJson(SESSION_KEY, null)
  window.google?.accounts.id.disableAutoSelect()
  useSync.setState({ status: syncConfigured ? 'signed-out' : 'off', user: null, message: 'Signed out. Your progress is still saved on this device.' })
}

// ---------- sync ----------

interface Remote {
  updatedAt: number
  data: unknown
}

class SyncError extends Error {
  status: number
  remote?: Remote
  constructor(status: number, message: string, remote?: Remote) {
    super(message)
    this.status = status
    this.remote = remote
  }
}

async function api(s: Session, method: 'GET' | 'PUT', body?: Remote, base?: number): Promise<Remote> {
  const url = `${SYNC_URL}/progress/${activeState.code}${base !== undefined ? `?base=${base}` : ''}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${s.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as Remote & { error?: string; remote?: Remote }
  if (!res.ok) throw new SyncError(res.status, json.error || `Online save failed (${res.status}).`, json.remote)
  return json
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let running: Promise<void> | null = null
let again = false

/** Pull the online copy, merge it in, and push the result. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = doSync().finally(() => {
    running = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

async function doSync() {
  const s = session()
  if (!syncConfigured) return
  if (!s) {
    useSync.setState({ status: 'signed-out', user: null })
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSync.setState({ status: 'offline', user: s.user, message: 'Offline. Progress will go online when you reconnect.' })
    return
  }
  useSync.setState({ status: 'syncing', user: s.user })
  try {
    let remote = await api(s, 'GET')
    for (let attempt = 0; attempt < 3; attempt++) {
      const meta = readJson<Meta>(META_KEY)
      const local = snapshotSave(useGame.getState())
      const theirs = remote.data ? sanitizeSave(remote.data) : null
      let next: GameState
      if (!theirs) next = local
      // A different account on this device: load that account's progress instead of mixing them.
      else if (meta && meta.userKey !== s.userKey) next = theirs
      else next = mergeSaves(local, theirs)

      if (!same(next, local)) useGame.setState(next)
      if (theirs && same(next, theirs)) {
        writeJson(META_KEY, { userKey: s.userKey, remoteUpdatedAt: remote.updatedAt })
        break
      }
      try {
        const put = await api(s, 'PUT', { updatedAt: Date.now(), data: next }, remote.updatedAt)
        writeJson(META_KEY, { userKey: s.userKey, remoteUpdatedAt: put.updatedAt })
        break
      } catch (e) {
        // Another device saved first: merge with its copy and try again.
        if (e instanceof SyncError && e.status === 409 && e.remote) {
          remote = e.remote
          continue
        }
        throw e
      }
    }
    useSync.setState({ status: 'synced', lastSyncAt: Date.now(), message: '' })
  } catch (e) {
    if (e instanceof SyncError && e.status === 401) {
      writeJson(SESSION_KEY, null)
      useSync.setState({ status: 'signed-out', user: null, message: 'Please sign in again to keep saving online.' })
      return
    }
    useSync.setState({ status: 'error', message: e instanceof Error ? e.message : 'Online save failed. It will try again.' })
  }
}

let timer: number | undefined

/** Start background syncing: on launch, after changes, when leaving the app, and on reconnect. */
export function startSync() {
  if (!syncConfigured || typeof window === 'undefined') return
  const s = session()
  if (s) useSync.setState({ user: s.user })
  void syncNow()
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
  }
  // Writes from sync itself also land here; the next sync then finds nothing new and skips the upload.
  useGame.subscribe(() => {
    if (session()) schedule()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && session()) {
      window.clearTimeout(timer)
      void syncNow()
    }
  })
  window.addEventListener('online', () => void syncNow())
}
