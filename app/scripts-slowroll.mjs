import { chromium } from 'playwright'
const shots = 'F:/driving game/screenshots'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto('http://localhost:5199/')
await page.evaluate(() => localStorage.setItem('road-warden-va', JSON.stringify({ state: { version: 1, playerName: 'Tester', seenIntro: true }, version: 1 })))
await page.reload()
await page.waitForTimeout(1200)
await page.getByText('PLAY', { exact: false }).first().click()
await page.waitForTimeout(1500)
// Briefing: click through to the drive
for (let i = 0; i < 10; i++) {
  const btn = page.getByRole('button', { name: /start|drive|let's go|next/i }).first()
  if (await page.locator('canvas').count()) break
  if (await btn.count()) await btn.click().catch(() => {})
  await page.waitForTimeout(500)
}
await page.waitForSelector('canvas', { timeout: 15000 })
await page.keyboard.press('Space') // skip countdown
const readEta = async () => (await page.locator('text=/Take your time|Here in/').first().textContent().catch(() => null))
const samples = []
for (const t of [2000, 4000, 4000]) {
  await page.waitForTimeout(t)
  samples.push(await readEta())
}
await page.screenshot({ path: `${shots}/slowroll-before-go.png` })
const tBefore = Date.now()
await page.keyboard.press('Enter') // GO
await page.waitForTimeout(1200)
samples.push('after GO: ' + (await readEta()))
await page.screenshot({ path: `${shots}/slowroll-going.png` })
await page.waitForTimeout(4500)
samples.push('4.5s later: ' + (await readEta()))
await page.screenshot({ path: `${shots}/slowroll-after-go.png` })
console.log(JSON.stringify({ samples, errors }, null, 1))
await browser.close()
