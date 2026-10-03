// Full-app smoke test: walks every screen at desktop and phone size in the installed Edge,
// plays a whole first mission to the debrief, and fails on any console or page error.
//
// Usage (dev server must be running on :5199 — `npm run dev -- --port 5199 --strictPort`):
//   node scripts/smoke.mjs            # both viewports
//   node scripts/smoke.mjs 390        # only the phone pass (or 1280)
// Screenshots: F:/driving game/screenshots/smoke-<viewport>-<nn>-<name>.png
import { chromium } from 'playwright'
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://localhost:5199/'
const SHOTS = 'F:/driving game/screenshots'
const KEY = 'road-warden-va'
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800, touch: false },
  { name: '390', width: 390, height: 844, touch: true },
].filter((v) => !process.argv[2] || v.name === process.argv[2])

mkdirSync(SHOTS, { recursive: true })
for (const f of readdirSync(SHOTS)) {
  if (VIEWPORTS.some((v) => f.startsWith(`smoke-${v.name}-`))) unlinkSync(`${SHOTS}/${f}`)
}
if (!process.argv[2]) for (const f of readdirSync(SHOTS)) if (f.startsWith('smoke-artsheet')) unlinkSync(`${SHOTS}/${f}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = { errors: [], screens: [], drives: [] }

try {
  for (const vp of VIEWPORTS) await runViewport(vp)
  if (!process.argv[2] || process.argv[2] === 'artsheet') await artSheet()
} catch (err) {
  report.errors.push(`FATAL: ${err?.stack || err}`)
} finally {
  await browser.close()
}

console.log(JSON.stringify(report, null, 1))
if (report.errors.length) {
  console.error(`\nSMOKE FAILED: ${report.errors.length} error(s)`)
  process.exit(1)
}
console.log('\nSMOKE OK')

// ---------------------------------------------------------------------------

async function newPage(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
    deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => report.errors.push(`[${vp.name}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // Speech synthesis is unavailable in headless Edge; that is environmental, not an app error.
    if (/speechSynthesis/i.test(text)) return
    report.errors.push(`[${vp.name}] console.error: ${text}`)
  })
  return { ctx, page }
}

async function artSheet() {
  const { ctx, page } = await newPage({ name: 'artsheet', width: 1280, height: 800, touch: false })
  await page.goto(`${BASE}?artsheet=1`)
  await page.waitForFunction(() => document.body.dataset.artsheet === 'ready', null, { timeout: 30000 })
  await sleep(500)
  await page.screenshot({ path: `${SHOTS}/smoke-artsheet.png`, fullPage: true })
  report.screens.push('smoke-artsheet.png')
  await ctx.close()
}

async function runViewport(vp) {
  const { ctx, page } = await newPage(vp)
  let n = 0
  const shot = async (name, opts = {}) => {
    await sleep(opts.wait ?? 350)
    const file = `smoke-${vp.name}-${String(++n).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: `${SHOTS}/${file}`, fullPage: !!opts.full })
    report.screens.push(file)
  }
  const tap = async (locator) => {
    await locator.scrollIntoViewIfNeeded().catch(() => {})
    if (vp.touch) await locator.tap()
    else await locator.click()
  }
  const button = (name) => page.getByRole('button', { name }).first()
  const expectText = async (re, what) => {
    try {
      await page.getByText(re).first().waitFor({ timeout: 8000 })
    } catch {
      report.errors.push(`[${vp.name}] ${what}: expected text ${re} not found`)
    }
  }
  /** Overflow check: nothing on the page may be wider than the viewport. */
  const checkOverflow = async (where) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (over > 1) report.errors.push(`[${vp.name}] ${where}: page scrolls sideways by ${over}px`)
  }
  /** Close full-screen celebrations (rank up, unlocks) after a screenshot. */
  const closeCelebrations = async (where) => {
    for (let i = 0; i < 8; i++) {
      const dlg = page.locator('[role="dialog"][aria-modal="true"]').first()
      if (!(await dlg.count())) return
      const label = (await dlg.getAttribute('aria-label')) || 'dialog'
      await shot(`${where}-celebration-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 24)}`, { wait: 600 })
      await tap(dlg.getByRole('button').last())
      await sleep(400)
    }
  }

  log(`== viewport ${vp.name} ==`)
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // ---------- intro ----------
  await page.getByLabel('What should I call you?').waitFor({ timeout: 15000 })
  await shot('intro-name')
  await checkOverflow('intro')
  await page.getByLabel('What should I call you?').fill('Jordan')
  await tap(button(/NEXT/))
  for (let i = 1; i <= 3; i++) {
    await expectText(new RegExp(`STEP ${i} OF 3`), `how-to card ${i}`)
    await shot(`intro-howto-${i}`)
    await checkOverflow(`how-to ${i}`)
    await tap(button(i < 3 ? /NEXT/ : /START MISSION 1/))
  }

  // ---------- briefing ----------
  await expectText(/Intel briefing/i, 'briefing')
  await shot('briefing')
  await checkOverflow('briefing')
  for (let i = 0; i < 10; i++) {
    if (await page.locator('canvas').count()) break
    const start = button(/START DRIVE/)
    if (await start.count()) {
      await tap(start)
      break
    }
    await tap(button(/NEXT CARD/))
    await sleep(250)
  }

  // ---------- drive mission 1 to the debrief ----------
  await drive(page, vp, shot, tap)

  // ---------- debrief ----------
  await expectText(/mission|cleared|score|XP/i, 'debrief')
  await shot('debrief-countup', { wait: 900 })
  await sleep(3200) // score count-up, XP bar, then the rank-up celebration
  await closeCelebrations('debrief')
  await shot('debrief')
  await shot('debrief-full', { full: true })
  await checkOverflow('debrief')
  await closeCelebrations('debrief')
  await tap(page.getByRole('button', { name: 'Home', exact: true }))

  // ---------- home after the first run ----------
  await expectText(/PLAY/, 'home')
  await closeCelebrations('home')
  await shot('home')
  await shot('home-full', { full: true })
  await checkOverflow('home')

  // ---------- a seasoned save: districts 1-6 cleared, perks, history, a miss ----------
  await seedVeteran(page)
  await page.reload()
  await expectText(/PLAY/, 'home (veteran)')
  await closeCelebrations('home-veteran')
  await shot('home-veteran')

  const visit = async (link, name, check, opts = {}) => {
    await tap(page.getByRole('button', { name: link }).first())
    await expectText(check, name)
    await closeCelebrations(name)
    await shot(name)
    if (opts.full) await shot(`${name}-full`, { full: true })
    await checkOverflow(name)
  }
  const goHome = async () => {
    await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().home())
    await sleep(300)
  }

  await visit(/^🗺️\s*Map$|^Map$/, 'map', /Rookie|District/i, { full: true })
  // District 1 from the map.
  await tap(page.getByRole('button', { name: /^Rookie Yard/ }).first())
  await expectText(/missions/i, 'district')
  await shot('district')
  await shot('district-full', { full: true })
  await checkOverflow('district')

  // ---------- boss exam from the district ----------
  await tap(page.getByRole('button', { name: /FIGHT THE BOSS|Fight the boss|Rematch/ }).first())
  await tap(page.getByRole('button', { name: /Fight!/ }).first().or(page.getByRole('button', { name: /start/i }).first()))
  await page.locator('[data-answer]').first().waitFor({ timeout: 8000 })
  await shot('boss-question')
  await checkOverflow('boss question')
  for (let q = 0; q < 40; q++) {
    if (!(await page.locator('[data-answer]').count())) break
    await page.keyboard.press(q % 3 === 2 ? '2' : '1')
    await sleep(250)
    if (q === 0) await shot('boss-feedback')
    await page.keyboard.press('Enter')
    await sleep(250)
  }
  await expectText(/Back to map|Practice|weak|score|Part/i, 'exam result')
  await sleep(800)
  await closeCelebrations('exam-result')
  await shot('exam-result')
  await shot('exam-result-full', { full: true })
  await checkOverflow('exam result')

  // ---------- DMV-style exam intro + one question ----------
  await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().go({ name: 'exam', kind: 'signs' }))
  await sleep(600)
  await shot('signs-intro')
  const startBtn = page.getByRole('button', { name: /start|begin|ready/i }).first()
  if (await startBtn.count()) {
    await tap(startBtn)
    await sleep(500)
    await page.keyboard.press('2')
    await shot('signs-question')
    await checkOverflow('signs question')
  }
  await goHome()

  // ---------- the other hubs ----------
  await visit(/^🎮\s*Modes$|^Modes$/, 'modes', /Quick|Sniper|mode/i, { full: true })
  await goHome()
  await visit(/^🚗\s*Garage$|^Garage$/, 'garage', /Garage|Car|Paint/i, { full: true })
  await goHome()
  await visit(/^📋\s*Contracts$|^Contracts$/, 'contracts', /Daily|Weekly|Season/i, { full: true })
  await goHome()
  await visit(/^⚙️\s*Settings$|^Settings$/, 'settings', /Settings|Read aloud|Reaction/i, { full: true })
  await goHome()
  await visit(/^📊\s*Stats$|^Stats$/, 'stats', /Readiness|Medals|Progress/i, { full: true })
  await goHome()
  await visit(/^📚\s*Library$|^Library$/, 'library', /Study|Search|Library/i, { full: true })

  report.screens.push(`[${vp.name}] ${n} screenshots`)
  await ctx.close()
}

async function seedVeteran(page) {
  await page.evaluate(async (KEY) => {
    const c = await import('/src/engine/content.ts')
    const rng = await import('/src/engine/rng.ts')
    const today = rng.dayKey()
    const day = rng.dayNumber(today)
    const prev = (k) => rng.dayKey(new Date(Date.now() - k * 86400000))
    const signDistricts = ['d01-rookie', 'd02-shapes', 'd03-regulatory', 'd04-warning', 'd05-workzone', 'd06-signals']
    const missionsCleared = {}
    for (const d of signDistricts) missionsCleared[d] = [...Array(c.missionCount(d)).keys()]
    missionsCleared['d07-rightofway'] = [0]
    const items = {}
    let i = 0
    for (const d of signDistricts) {
      for (const it of c.itemsIn(d)) {
        const wrong = i++ % 9 === 0
        items[it.id] = {
          box: wrong ? 1 : 3,
          seen: 4,
          correct: wrong ? 2 : 4,
          wrong: wrong ? 2 : 0,
          lastDay: today,
          nextDue: day + (wrong ? 0 : 3),
          correctDays: [prev(2), prev(1), today],
          lastResult: wrong ? 'wrong' : 'correct',
          recentMissAt: wrong ? Date.now() - 3600000 : 0,
        }
      }
    }
    const state = {
      version: 1,
      playerName: 'Jordan',
      seenIntro: true,
      xp: 2600,
      seasonXp: 2600,
      items,
      missionsCleared,
      bossesCleared: ['d02-shapes'],
      starsMax: { 'd01-rookie': 3, 'd02-shapes': 3, 'd03-regulatory': 2, 'd04-warning': 2 },
      medals: { flawless: 2, comeback: 1 },
      bestScores: { 'mission:d01-rookie:0': 1840 },
      stats: { runs: 24, correct: 310, wrong: 41, bestStreak: 17, timePlayedMs: 3600000 },
      playDays: [prev(3), prev(2), prev(1), today],
      examHistory: [
        { day: prev(2), part1Correct: 9, part2Correct: 22, passed: false, ready: false },
        { day: prev(1), part1Correct: 10, part2Correct: 27, passed: true, ready: true },
      ],
      briefedItems: c.allItems.map((x) => x.id),
    }
    localStorage.setItem(KEY, JSON.stringify({ state, version: 1 }))
  }, KEY)
}

// ---------------------------------------------------------------------------
// Drive bot: plays the run correctly through the dev-only window.__roadScene handle.

async function drive(page, vp, shot, tap) {
  const st = () =>
    page.evaluate(() => {
      const s = window.__roadScene
      if (!s || !s.director) return null
      const e = s.cur
      return {
        phase: s.phase,
        lane: s.lane,
        speed: s.speed,
        goMode: s.goMode,
        finish: !!s.finishLine,
        outcomes: s.director.outcomes.length,
        correct: s.director.outcomes.filter((o) => o.correct).length,
        cur: e ? { key: e.key, kind: e.ev.kind, action: e.ev.action, prop: e.ev.prop, z: e.z, decided: e.decided, done: e.done, correctLane: e.correctLane } : null,
      }
    })
  const waitFor = async (pred, ms = 20000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const s = await st()
      if (s && pred(s)) return s
      if (!s && !(await page.locator('canvas').count())) return null
      await sleep(60)
    }
    return null
  }
  const toLane = async (target) => {
    for (let i = 0; i < 4; i++) {
      const s = await st()
      if (!s || s.lane === target) return
      await page.keyboard.press(s.lane < target ? 'ArrowRight' : 'ArrowLeft')
      await sleep(120)
    }
  }
  const brakeUntil = async (pred, ms = 15000) => {
    await page.keyboard.down('ArrowDown')
    const r = await waitFor(pred, ms)
    await page.keyboard.up('ArrowDown')
    return r
  }
  const goBtn = page.getByRole('button', { name: /^Go: speed up/ })
  const pressGo = async (useTouch) => {
    if (useTouch && vp.touch && (await goBtn.count()) && (await goBtn.isEnabled())) await goBtn.tap()
    else await page.keyboard.press('Enter')
  }

  await page.waitForSelector('canvas', { timeout: 20000 })
  await sleep(700)
  await shot('drive-countdown')
  await page.keyboard.press('Space')
  await waitFor((s) => s.phase === 'drive', 6000)

  // GO and BRAKE must both be fully on screen.
  for (const [name, loc] of [
    ['GO', page.getByRole('button', { name: /^Go/ })],
    ['BRAKE', page.getByRole('button', { name: /Brake/ })],
  ]) {
    const box = await loc.first().boundingBox()
    if (!box) report.errors.push(`[${vp.name}] drive: ${name} button missing`)
    else if (box.x < 0 || box.y < 0 || box.x + box.width > vp.width + 0.5 || box.y + box.height > vp.height + 0.5)
      report.errors.push(`[${vp.name}] drive: ${name} button cut off (${JSON.stringify(box)})`)
  }

  const seen = new Set()
  let shots = 0
  const deadline = Date.now() + 6 * 60 * 1000
  while (Date.now() < deadline) {
    if (!(await page.locator('canvas').count())) break
    if (await page.getByRole('dialog', { name: 'Replay' }).count()) {
      await shot('drive-replay')
      await tap(page.getByRole('dialog', { name: 'Replay' }).getByRole('button').last())
      await sleep(300)
      continue
    }
    const s = await st()
    if (!s || s.phase === 'ending' || s.phase === 'done') {
      await sleep(200)
      continue
    }
    if (!s.cur || s.cur.decided) {
      if (s.finish && !s.cur && !seen.has('finish')) {
        seen.add('finish')
        await sleep(900)
        await shot('drive-finish-ahead')
        await pressGo(true)
      }
      await sleep(80)
      continue
    }
    const e = s.cur
    if (seen.has(e.key)) {
      await sleep(60)
      continue
    }
    seen.add(e.key)
    const decided = (x) => !x.cur || x.cur.key !== e.key || x.cur.decided
    log(`[${vp.name}] event ${seen.size}: ${e.kind} ${e.action ?? ''} ${e.prop ?? ''}`)
    await sleep(900)
    const showcase = shots < 4
    if (showcase) await shot(`drive-event-${++shots}-${(e.action ?? 'gate').replace(/[^a-z-]/g, '')}`)

    if (e.kind === 'gates') {
      await toLane(e.correctLane)
      await sleep(200)
      await pressGo(seen.size % 2 === 1)
      if (showcase) {
        await sleep(1300)
        await shot(`drive-going-${shots}`, { wait: 0 })
      }
      await waitFor(decided, 25000)
      if (showcase) await shot(`drive-result-${shots}`, { wait: 250 })
      continue
    }
    switch (e.action) {
      case 'stop':
        await pressGo(false)
        await waitFor((x) => decided(x) || x.cur.z <= 8, 25000)
        await brakeUntil(decided, 12000)
        await brakeUntil((x) => !x.cur || x.cur.key !== e.key || x.cur.done, 6000)
        break
      case 'slow':
        await pressGo(false)
        await waitFor((x) => decided(x) || x.cur.z <= 5.5, 25000)
        await brakeUntil(decided, 10000)
        break
      case 'move-left':
        await sleep(600)
        await toLane(1)
        await pressGo(false)
        await waitFor(decided, 25000)
        break
      case 'move-right':
        await sleep(600)
        await toLane(1)
        await pressGo(false)
        await waitFor(decided, 25000)
        break
      case 'pull-over':
        await sleep(1000)
        await toLane(2)
        await brakeUntil(decided, 16000)
        break
      case 'brake-straight':
        await pressGo(false)
        await waitFor((x) => decided(x) || x.cur.z <= 7, 25000)
        await brakeUntil(decided, 10000)
        break
      default:
        await pressGo(false)
        await waitFor(decided, 25000)
    }
  }
  const end = await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 30000 }).then(
    () => true,
    () => false,
  )
  if (!end) report.errors.push(`[${vp.name}] drive: run did not reach the debrief`)
  report.drives.push({ viewport: vp.name, events: seen.size })
}
