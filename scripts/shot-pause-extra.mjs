import { chromium } from 'playwright-core'
import fs from 'node:fs'
const ROOT = process.env.HOME + '/Library/Caches/ms-playwright'
const exe = fs.readdirSync(ROOT).filter(d => d.startsWith('chromium-'))
  .sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
  .map(d=>`${ROOT}/${d}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)
  .find(p=>fs.existsSync(p))
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],
})
const ctx = await browser.newContext({
  viewport:{width:1440,height:1000}, deviceScaleFactor:2,
  permissions:['microphone'],
  reducedMotion: 'reduce',          // Mateo runs with this on.
})
await ctx.addInitScript(() => {
  localStorage.setItem('arztbrief.zugang','0e3280d966f224c8f56afd0a9db843e03fe483af7457554b9b27e6462fc7aaf8')
})
const page = await ctx.newPage()
const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,150)))

await page.goto('http://localhost:5199/', { waitUntil:'networkidle' })
await page.getByRole('button', { name:/Diktat starten/i }).first().click()
await page.waitForTimeout(700)
await page.getByRole('button', { name:/Aufnahme starten/i }).click()
await page.waitForTimeout(2200)
await page.getByRole('button', { name:/^Pause$/ }).click()
await page.mouse.move(4,4)
await page.waitForTimeout(700)
await page.screenshot({ path:'shots/reduced-motion-paused.png' })

// Now leave the recorder while paused — the global strip must take over.
// Zurück is deliberately disabled during a live sitting; the sidebar is how
// he actually leaves the recorder mid-recording.
await page.getByRole('button', { name:/Einstellungen/i }).first().click()
await page.waitForTimeout(900)
const strip = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="recording-indicator"]')
  if (!el) return null
  return {
    text: el.innerText.replace(/\s+/g,' ').trim(),
    aria: el.getAttribute('aria-label'),
    hasPing: !!el.querySelector('.animate-ping'),
    hasRedDot: !!el.querySelector('.bg-red-600'),
  }
})
await page.screenshot({ path:'shots/indicator-paused.png', clip:{x:0,y:0,width:1440,height:150} })
console.log(JSON.stringify({ strip, errs }, null, 1))
await browser.close()
