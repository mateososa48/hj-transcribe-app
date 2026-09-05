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
const ctx = await browser.newContext({ viewport:{width:1440,height:1000}, permissions:['microphone'] })
await ctx.addInitScript(() => localStorage.setItem('arztbrief.zugang','0e3280d966f224c8f56afd0a9db843e03fe483af7457554b9b27e6462fc7aaf8'))
const page = await ctx.newPage()
const errs=[]; page.on('pageerror',e=>errs.push(String(e)))

await page.goto('http://localhost:5199/', { waitUntil:'networkidle' })
await page.getByRole('button', { name:/Diktat starten/i }).first().click()
await page.getByRole('button', { name:/Aufnahme starten/i }).click()

// Record ~7s, pause 4s, resume ~7s — long enough to span several 5s timeslices
// on BOTH sides of the pause, which is where a broken container would show.
await page.waitForTimeout(7000)
await page.getByRole('button', { name:/^Pause$/ }).click()
await page.waitForTimeout(4000)
await page.getByRole('button', { name:/Fortsetzen/i }).click()
await page.waitForTimeout(7000)
await page.getByRole('button', { name:/beenden/i }).click()
await page.waitForTimeout(4000)

// Pull the assembled audio straight out of IndexedDB, the way the pipeline does.
const result = await page.evaluate(async () => {
  const open = indexedDB.open('arztbrief')
  const db = await new Promise((res, rej) => { open.onsuccess=()=>res(open.result); open.onerror=()=>rej(open.error) })
  const read = (store, fn) => new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly'); const r = fn(tx.objectStore(store))
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  const sessions = await read('sessions', s => s.getAll())
  const latest = sessions.sort((a,b)=>b.startedAt-a.startedAt)[0]
  const chunks = (await read('chunks', s => s.getAll())).filter(c=>c.sessionId===latest.id).sort((a,b)=>a.index-b.index)
  const blob = new Blob(chunks.map(c=>c.blob), { type: latest.mimeType })
  const buf = new Uint8Array(await blob.arrayBuffer())
  // Decode it: if pause/resume broke the container this throws or comes back short.
  let decodedSeconds = null, decodeError = null
  try {
    const acx = new (window.AudioContext||window.webkitAudioContext)()
    const audio = await acx.decodeAudioData(buf.slice().buffer)
    decodedSeconds = +audio.duration.toFixed(2)
  } catch (e) { decodeError = String(e).slice(0,120) }
  return {
    mimeType: latest.mimeType,
    durationMs: latest.durationMs,
    chunkCount: chunks.length,
    bytes: buf.length,
    magic: Array.from(buf.slice(0,4)).map(b=>b.toString(16).padStart(2,'0')).join(' '),
    decodedSeconds, decodeError,
    // Hand the bytes out so the real upload path can be exercised.
    b64: btoa(Array.from(buf, b => String.fromCharCode(b)).join('')),
  }
})
fs.writeFileSync('/tmp/pause-e2e.webm', Buffer.from(result.b64, 'base64'))
const { b64, ...rest } = result
console.log(JSON.stringify({ ...rest, errs, wrote: '/tmp/pause-e2e.webm' }, null, 1))
await browser.close()
