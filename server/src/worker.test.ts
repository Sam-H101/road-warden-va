import { beforeEach, describe, expect, it } from 'vitest'
import { handle, resetKeyCache, signSession, userKeyFor, type Deps, type Env } from './worker'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const ORIGIN = 'https://sam-h101.github.io'

const env: Env = {
  GOOGLE_CLIENT_ID: CLIENT_ID,
  GITHUB_TOKEN: 'gh-test',
  SESSION_SECRET: 'a-long-random-test-secret',
  DATA_REPO: 'owner/data',
  DATA_BRANCH: 'main',
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
}

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

let keys: CryptoKeyPair
let jwk: JsonWebKey
let now = Date.UTC(2026, 9, 19)

async function googleToken(claims: Record<string, unknown>, kid = 'k1') {
  const head = enc({ alg: 'RS256', kid, typ: 'JWT' })
  const body = enc({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1234', exp: now / 1000 + 600, given_name: 'Ava', ...claims })
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

/** In-memory stand-in for Google's key endpoint and the GitHub contents API. */
function fakeWorld() {
  const files = new Map<string, { sha: string; content: string }>()
  let shaN = 0
  const calls: string[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url.startsWith('https://www.googleapis.com/')) return Response.json({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256' }] })
    const m = url.match(/^https:\/\/api\.github\.com\/repos\/owner\/data\/contents\/([^?]+)/)
    if (!m) return new Response('no', { status: 500 })
    const path = m[1]
    if (method === 'GET') {
      const file = files.get(path)
      return file ? Response.json(file) : new Response('{}', { status: 404 })
    }
    const body = JSON.parse(String(init!.body)) as { content: string; sha?: string }
    const cur = files.get(path)
    if ((cur?.sha ?? undefined) !== body.sha) return new Response('{}', { status: 409 })
    files.set(path, { sha: `s${++shaN}`, content: body.content })
    return Response.json({ ok: true })
  }) as typeof fetch
  const deps: Deps = { fetch: f, now: () => now }
  return { files, calls, deps }
}

function req(path: string, init: RequestInit & { origin?: string | null } = {}) {
  const headers = new Headers(init.headers)
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN)
  return new Request(`https://sync.example${path}`, { ...init, headers })
}

beforeEach(async () => {
  resetKeyCache()
  now = Date.UTC(2026, 9, 19)
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
})

describe('auth', () => {
  it('swaps a valid Google token for a session', async () => {
    const w = fakeWorld()
    const res = await handle(req('/auth', { method: 'POST', body: JSON.stringify({ credential: await googleToken({}) }) }), env, w.deps)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const body = (await res.json()) as { token: string; user: { name: string } }
    expect(body.user.name).toBe('Ava')
    expect(body.token.split('.')).toHaveLength(3)
  })

  it('refuses a token for another app', async () => {
    const w = fakeWorld()
    const res = await handle(req('/auth', { method: 'POST', body: JSON.stringify({ credential: await googleToken({ aud: 'other' }) }) }), env, w.deps)
    expect(res.status).toBe(401)
  })

  it('refuses an expired token', async () => {
    const w = fakeWorld()
    const res = await handle(req('/auth', { method: 'POST', body: JSON.stringify({ credential: await googleToken({ exp: now / 1000 - 5 }) }) }), env, w.deps)
    expect(res.status).toBe(401)
  })

  it('refuses a tampered token', async () => {
    const w = fakeWorld()
    const t = (await googleToken({})).split('.')
    t[1] = enc({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'someone-else', exp: now / 1000 + 600 })
    const res = await handle(req('/auth', { method: 'POST', body: JSON.stringify({ credential: t.join('.') }) }), env, w.deps)
    expect(res.status).toBe(401)
  })

  it('refuses unknown origins', async () => {
    const w = fakeWorld()
    const res = await handle(req('/auth', { method: 'POST', origin: 'https://evil.example', body: '{}' }), env, w.deps)
    expect(res.status).toBe(403)
  })
})

describe('progress', () => {
  async function session() {
    return (await signSession(await userKeyFor('1234'), env.SESSION_SECRET, now)).token
  }

  it('needs a session', async () => {
    const w = fakeWorld()
    const res = await handle(req('/progress/va'), env, w.deps)
    expect(res.status).toBe(401)
  })

  it('returns empty progress for a new player, then saves and reads it back', async () => {
    const w = fakeWorld()
    const auth = { Authorization: `Bearer ${await session()}` }
    let res = await handle(req('/progress/va', { headers: auth }), env, w.deps)
    expect(await res.json()).toEqual({ updatedAt: 0, data: null })

    res = await handle(req('/progress/va?base=0', { method: 'PUT', headers: auth, body: JSON.stringify({ updatedAt: now, data: { xp: 50 } }) }), env, w.deps)
    expect(res.status).toBe(200)
    const { updatedAt } = (await res.json()) as { updatedAt: number }

    res = await handle(req('/progress/va', { headers: auth }), env, w.deps)
    expect(await res.json()).toEqual({ updatedAt, data: { xp: 50 } })

    // The file path uses the hashed id, never the Google id itself.
    const [path] = [...w.files.keys()]
    expect(path).toMatch(/^users\/[0-9a-f]{64}\/va\.json$/)
    expect(path).not.toContain('1234')
  })

  it('reports a conflict when another device saved since the client last synced', async () => {
    const w = fakeWorld()
    const auth = { Authorization: `Bearer ${await session()}` }
    await handle(req('/progress/tx?base=0', { method: 'PUT', headers: auth, body: JSON.stringify({ updatedAt: now, data: { xp: 1 } }) }), env, w.deps)
    now += 1000
    const res = await handle(req('/progress/tx?base=0', { method: 'PUT', headers: auth, body: JSON.stringify({ updatedAt: now, data: { xp: 2 } }) }), env, w.deps)
    expect(res.status).toBe(409)
    const body = (await res.json()) as { remote: { data: { xp: number } } }
    expect(body.remote.data.xp).toBe(1)
  })

  it('rejects bad state codes and oversized saves', async () => {
    const w = fakeWorld()
    const auth = { Authorization: `Bearer ${await session()}` }
    expect((await handle(req('/progress/..%2Fx', { headers: auth }), env, w.deps)).status).toBe(400)
    const big = JSON.stringify({ updatedAt: now, data: { pad: 'x'.repeat(600 * 1024) } })
    expect((await handle(req('/progress/va', { method: 'PUT', headers: auth, body: big }), env, w.deps)).status).toBe(413)
  })

  it('refuses an expired session', async () => {
    const w = fakeWorld()
    const token = await session()
    now += 31 * 86400 * 1000
    const res = await handle(req('/progress/va', { headers: { Authorization: `Bearer ${token}` } }), env, w.deps)
    expect(res.status).toBe(401)
  })
})
