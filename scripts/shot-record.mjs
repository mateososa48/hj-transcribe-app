import { chromium } from 'playwright-core'
import fs from 'node:fs'
const ROOT = process.env.HOME + '/Library/Caches/ms-playwright'
const exe = fs.readdirSync(ROOT).filter(d => d.startsWith('chromium-'))
  .sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(d=>`${ROOT}/${d}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)
  .find(p=>fs.existsSync(p))

const kind = process.argv[2] ?? 'beurteilung'   // beurteilung = Diktat, gespraech = Termin
const width = Number(process.argv[3] ?? 1440)
const tag = process.argv[4] ?? 'desktop'

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const ctx = await browser.newContext({
  viewport: { width, height: width < 500 ? 844 : 1000 },
  deviceScaleFactor: 2,
  permissions: ['microphone'],
  ...(width < 500 ? { isMobile: true, hasTouch: true } : {}),
})
// Seed the unlock the same way the lock screen does, so the harness does not
// need the password to reach the recorder.
await ctx.addInitScript(() => {
  localStorage.setItem(
    'arztbrief.zugang',
    '0e3280d966f224c8f56afd0a9db843e03fe483af7457554b9b27e6462fc7aaf8',
  )
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e)))
page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 160)))

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' })
// Straight to the recorder for this feature.
const label = kind === 'gespraech' ? /Termin aufnehmen/i : /Diktat starten/i
await page.getByRole('button', { name: label }).first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: `shots/${kind}-${tag}-1-idle.png` })

await page.getByRole('button', { name: /Aufnahme starten/i }).click()
await page.waitForTimeout(2600)
await page.screenshot({ path: `shots/${kind}-${tag}-2-recording.png` })
const runningClock = await page.evaluate(() => document.querySelector('.text-6xl')?.textContent?.trim())

const measure = () => page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => /Pause|Fortsetzen|beenden/.test(b.textContent||''))
  return btns.map(b => { const r = b.getBoundingClientRect()
    return { text: b.textContent.trim(), w: +r.width.toFixed(2), x: +r.x.toFixed(2), centerY: +(r.y+r.height/2).toFixed(2) } })
})
await page.mouse.move(4, 4); await page.waitForTimeout(300)
const runningGeom = await measure()

await page.getByRole('button', { name: /^Pause$/ }).click()
await page.mouse.move(4, 4)
await page.waitForTimeout(900)
const pausedGeom = await measure()
await page.screenshot({ path: `shots/${kind}-${tag}-3-paused.png` })
const pausedClock = await page.evaluate(() => document.querySelector('.text-6xl')?.textContent?.trim())
await page.waitForTimeout(2600)
const pausedClockLater = await page.evaluate(() => document.querySelector('.text-6xl')?.textContent?.trim())

await page.getByRole('button', { name: /Fortsetzen/i }).click()
await page.waitForTimeout(1600)
const resumedClock = await page.evaluate(() => document.querySelector('.text-6xl')?.textContent?.trim())
await page.screenshot({ path: `shots/${kind}-${tag}-4-resumed.png` })

// Park the pointer: the house keys lift on hover, and measuring a hovered
// button reports the lift as a layout offset.
await page.mouse.move(4, 4)
await page.waitForTimeout(350)
// Measure the two keys so a label swap cannot shuffle the row.
const metrics = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => /Pause|Fortsetzen|beenden/.test(b.textContent||''))
  return btns.map(b => {
    const r = b.getBoundingClientRect()
    const cs = getComputedStyle(b)
    return {
      text: b.textContent.trim(),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      x: +r.x.toFixed(2), y: +r.y.toFixed(2),
      centerY: +(r.y + r.height / 2).toFixed(2),
      radius: cs.borderRadius, color: cs.color,
    }
  })
})
console.log(JSON.stringify({ kind, tag, runningClock, pausedClock, pausedClockLater, resumedClock, runningGeom, pausedGeom, metrics, errs }, null, 1))
await browser.close()
