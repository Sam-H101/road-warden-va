import { chromium } from 'playwright'
const shots = 'F:/driving game/screenshots'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto('http://localhost:5199/')
await p.evaluate(() => localStorage.setItem('road-warden-va', JSON.stringify({ state: { version: 1, playerName: 'Tester', seenIntro: true }, version: 1 })))
await p.reload(); await p.waitForTimeout(1000)
await p.evaluate(async () => {
  const c = await import('/src/engine/content.ts')
  const stops = c.allEvents.filter(e => e.kind === 'action' && e.action === 'stop' && e.prop === 'traffic-light-red').slice(0, 2)
  const plan = { mode: 'mission', key: 'test:stops', title: 'Stop test', district: 'd06-signals', missionIndex: 0, events: stops, ramp: 0, perksAllowed: false, newItemIds: [] }
  ;(await import('/src/app/nav.ts')).useNav.getState().go({ name: 'drive', plan })
})
await p.waitForFunction(() => !!window.__roadScene, null, { timeout: 15000 })
await p.keyboard.press('Space') // skip countdown
await p.waitForTimeout(300)
await p.keyboard.up('Space')
const results = []
for (let round = 0; round < 2; round++) {
  await p.waitForFunction(() => { const s = window.__roadScene; return s && s.cur && !s.cur.decided && s.cur.ev.action === 'stop' }, null, { timeout: 30000 })
  await p.keyboard.press('Enter') // GO
  // wait for the cue
  await p.waitForFunction(() => window.__roadScene?.cur?.brakeCue === 'now', null, { timeout: 30000 })
  if (round === 0) await p.screenshot({ path: `${shots}/brakeguide-cue.png` })
  const atCue = await p.evaluate(() => { const s = window.__roadScene; return { z: s.cur.z, speed: s.speed, pred: s.predictStopDistance() } })
  await p.keyboard.down('Space')
  await p.waitForTimeout(700)
  if (round === 0) await p.screenshot({ path: `${shots}/brakeguide-braking.png` })
  await p.waitForFunction(() => { const s = window.__roadScene; return s.director.outcomes.length > 0 && (s.speed === 0 || s.cur === null || s.cur.decided) }, null, { timeout: 15000 })
  await p.waitForTimeout(400)
  await p.keyboard.up('Space')
  const out = await p.evaluate(() => window.__roadScene.director.outcomes.map(o => o.correct))
  results.push({ round, atCue, outcomes: out })
  await p.waitForTimeout(2500)
}
console.log(JSON.stringify({ results, errs }, null, 1))
await b.close()
