// Road Warden progress sync (Cloudflare Worker).
//
// The game is static files on GitHub Pages, so it cannot keep secrets or talk
// to GitHub with write access itself. This small worker does three things:
//   POST /auth              swap a Google ID token for a 30-day session token
//   GET  /progress/:state   read the player's save for one state
//   PUT  /progress/:state   write it
// Saves are JSON files in a private GitHub repository (DATA_REPO), one file per
// player per state: users/<player key>/<state>.json. The player key is a hash
// of the Google account id, so the repository never holds names or emails.

export interface Env {
  GOOGLE_CLIENT_ID: string
  GITHUB_TOKEN: string
  SESSION_SECRET: string
  DATA_REPO: string // owner/name
  DATA_BRANCH?: string
  ALLOWED_ORIGINS?: string // comma separated
}

/** Injected so tests can stand in for Google and GitHub. */
export interface Deps {
  fetch: typeof fetch
  now: () => number
}

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const SESSION_DAYS = 30
const MAX_SAVE_BYTES = 512 * 1024
const STATE_RE = /^[a-z]{2}$/

export interface SavedProgress {
  updatedAt: number
  data: unknown
}

// ---------- small helpers ----------

const enc = new TextEncoder()

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64ToUtf8(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s.replace(/\s/g, '')))
}

function utf8ToB64(s: string): string {
  const bytes = enc.encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function decodePart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T
}

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

class HttpError extends Error {
  status: number
  body?: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

// ---------- Google ID token ----------

interface GoogleClaims {
  iss: string
  aud: string
  sub: string
  exp: number
  iat?: number
  email?: string
  name?: string
  given_name?: string
  picture?: string
}

let jwksCache: { at: number; keys: JsonWebKey[] } | null = null

async function googleKeys(deps: Deps): Promise<JsonWebKey[]> {
  if (jwksCache && deps.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys
  const res = await deps.fetch(GOOGLE_JWKS)
  if (!res.ok) throw new HttpError(502, 'Could not reach Google.')
  const body = (await res.json()) as { keys: JsonWebKey[] }
  jwksCache = { at: deps.now(), keys: body.keys }
  return body.keys
}

/** Test hook: forget cached Google keys. */
export function resetKeyCache() {
  jwksCache = null
}

export async function verifyGoogleIdToken(token: string, clientId: string, deps: Deps): Promise<GoogleClaims> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Bad sign-in token.')
  const header = decodePart<{ alg: string; kid: string }>(parts[0])
  if (header.alg !== 'RS256') throw new HttpError(401, 'Bad sign-in token.')
  const jwk = (await googleKeys(deps)).find((k) => (k as { kid?: string }).kid === header.kid)
  if (!jwk) throw new HttpError(401, 'Unknown sign-in key.')
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`))
  if (!ok) throw new HttpError(401, 'Bad sign-in token.')
  const claims = decodePart<GoogleClaims>(parts[1])
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new HttpError(401, 'Bad sign-in token.')
  if (claims.aud !== clientId) throw new HttpError(401, 'This sign-in is for a different app.')
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < deps.now()) throw new HttpError(401, 'Sign-in expired.')
  if (!claims.sub) throw new HttpError(401, 'Bad sign-in token.')
  return claims
}

// ---------- session token (HS256 JWT) ----------

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(userKey: string, secret: string, now: number): Promise<{ token: string; exp: number }> {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 86400
  const head = bytesToB64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = bytesToB64url(enc.encode(JSON.stringify({ sub: userKey, exp })))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`)))
  return { token: `${head}.${body}.${bytesToB64url(sig)}`, exp }
}

export async function verifySession(token: string, secret: string, now: number): Promise<string> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Please sign in again.')
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`))
  if (!ok) throw new HttpError(401, 'Please sign in again.')
  const claims = decodePart<{ sub: string; exp: number }>(parts[1])
  if (!claims.sub || claims.exp * 1000 < now) throw new HttpError(401, 'Please sign in again.')
  return claims.sub
}

/** Stable, non-reversible folder name for a Google account. */
export function userKeyFor(googleSub: string): Promise<string> {
  return sha256Hex(`road-warden:${googleSub}`)
}

// ---------- GitHub contents API ----------

function ghHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'road-warden-sync',
  }
}

function contentsUrl(env: Env, path: string, withRef: boolean) {
  const url = `https://api.github.com/repos/${env.DATA_REPO}/contents/${path}`
  return withRef ? `${url}?ref=${encodeURIComponent(env.DATA_BRANCH || 'main')}` : url
}

async function readFile(env: Env, deps: Deps, path: string): Promise<{ sha: string; saved: SavedProgress } | null> {
  const res = await deps.fetch(contentsUrl(env, path, true), { headers: ghHeaders(env) })
  if (res.status === 404) return null
  if (!res.ok) throw new HttpError(502, `Storage read failed (${res.status}).`)
  const body = (await res.json()) as { sha: string; content: string }
  return { sha: body.sha, saved: JSON.parse(b64ToUtf8(body.content)) as SavedProgress }
}

async function writeFile(env: Env, deps: Deps, path: string, saved: SavedProgress, sha: string | undefined) {
  const res = await deps.fetch(contentsUrl(env, path, false), {
    method: 'PUT',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `progress: ${path}`,
      content: utf8ToB64(JSON.stringify(saved)),
      branch: env.DATA_BRANCH || 'main',
      ...(sha ? { sha } : {}),
    }),
  })
  // 409/422: someone wrote in between (another device). The caller retries.
  if (res.status === 409 || res.status === 422) return false
  if (!res.ok) throw new HttpError(502, `Storage write failed (${res.status}).`)
  return true
}

// ---------- routes ----------

async function handleAuth(req: Request, env: Env, deps: Deps) {
  const body = (await req.json().catch(() => null)) as { credential?: string } | null
  if (!body?.credential) throw new HttpError(400, 'Missing sign-in token.')
  const claims = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID, deps)
  const key = await userKeyFor(claims.sub)
  const session = await signSession(key, env.SESSION_SECRET, deps.now())
  return {
    token: session.token,
    expiresAt: session.exp * 1000,
    user: { name: claims.given_name || claims.name || '', picture: claims.picture || '' },
  }
}

async function handleProgress(req: Request, env: Env, deps: Deps, state: string) {
  const auth = req.headers.get('Authorization') || ''
  const user = await verifySession(auth.replace(/^Bearer\s+/i, ''), env.SESSION_SECRET, deps.now())
  const path = `users/${user}/${state}.json`

  if (req.method === 'GET') {
    const file = await readFile(env, deps, path)
    return file ? file.saved : { updatedAt: 0, data: null }
  }

  // PUT
  const text = await req.text()
  if (text.length > MAX_SAVE_BYTES) throw new HttpError(413, 'Save is too big.')
  let incoming: SavedProgress
  try {
    incoming = JSON.parse(text) as SavedProgress
  } catch {
    throw new HttpError(400, 'Save is not valid JSON.')
  }
  if (typeof incoming?.updatedAt !== 'number' || typeof incoming.data !== 'object' || incoming.data === null) {
    throw new HttpError(400, 'Save is missing fields.')
  }
  // `base` is the updatedAt the client last saw from the server. If the server
  // copy moved on since then (another device), the client must merge first.
  const base = Number(new URL(req.url).searchParams.get('base') ?? '0')
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readFile(env, deps, path)
    if (current && current.saved.updatedAt > base) throw new HttpError(409, 'Newer progress is on the server.', current.saved)
    const saved: SavedProgress = { updatedAt: Math.max(incoming.updatedAt, deps.now()), data: incoming.data }
    if (await writeFile(env, deps, path, saved, current?.sha)) return { updatedAt: saved.updatedAt }
  }
  throw new HttpError(503, 'Storage is busy. Try again.')
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function handle(req: Request, env: Env, deps: Deps = { fetch: (...a) => fetch(...a), now: Date.now }): Promise<Response> {
  const cors = corsHeaders(req, env)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors })
  // Browsers always send Origin on cross-site calls; refuse sites we do not know.
  if (req.headers.get('Origin') && !cors['Access-Control-Allow-Origin']) return json(403, { error: 'Origin not allowed.' })

  const { pathname } = new URL(req.url)
  try {
    if (pathname === '/auth' && req.method === 'POST') return json(200, await handleAuth(req, env, deps))
    const m = pathname.match(/^\/progress\/([^/]+)$/)
    if (m && (req.method === 'GET' || req.method === 'PUT')) {
      if (!STATE_RE.test(m[1])) return json(400, { error: 'Unknown state.' })
      return json(200, await handleProgress(req, env, deps, m[1]))
    }
    if (pathname === '/' && req.method === 'GET') return json(200, { ok: true, service: 'road-warden-sync' })
    return json(404, { error: 'Not found.' })
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, e.body !== undefined ? { error: e.message, remote: e.body } : { error: e.message })
    console.error(e)
    return json(500, { error: 'Something went wrong.' })
  }
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
}
