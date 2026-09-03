# REVIEW — Arztbrief-Assistent (pre-demo assessment)

Prepared for an external reviewer with no prior exposure to this code.
Evidence is cited as `file:line` or as the command that produced it. Nothing
here contains keys, `.env` contents, patient data, or sample letters.

Reviewed at commit `412646b`, working tree clean apart from an untracked
`.shots/` directory.

---

## 1. Overview

A local-first web app for one cardiologist. It records audio in the browser,
transcribes it through a third-party ASR, and drafts German medical text with an
LLM. Three features: **Diktat** (free dictation → "Zusammenfassende
Beurteilung"), **Termin** (recorded consultation → sectioned meeting notes), and
**Bericht** (a Word-like page he assembles from typing, dictation and imports,
exportable to `.docx`). Everything persists in IndexedDB on his machine; there
is no backend of ours.

Version `0.1.0`, `private: true` (`package.json:2-4`). No README exists — this
review is currently the only onboarding document.

```bash
npm install
npm run dev        # vite, localhost:5173
npm run typecheck  # tsc --noEmit
npm test           # 141 tests, node:test via tsx
npm run build      # tsc -b && vite build
```

Provider keys are read from `VITE_*` variables at build time (see §4.2). Without
them the UI runs but every transcription and drafting call fails.

---

## 2. Structure and dependencies

### 2.1 Tree (2 levels)

```
src/
  components/     shared UI: sidebar, players, the animated brand mark, ui/ (shadcn on Base UI)
  features/       one directory per surface: document (Bericht), record, session,
                  sessions (list hooks), settings, start
  hooks/          small shared React hooks
  layouts/        StandardLayout — sidebar + main column, per-view widths
  lib/            all non-React logic: db, providers, audio, transcription, settings, format
  motion-lab/     dev-only animation sandbox, not reachable from the app
  preview/        dev-only preview harness for processing states
  store/          zustand store: current view + a sessions-changed counter
prompts/          LLM prompts as versioned TS: rules, beurteilung, gespraech, abschnitt
  examples/       few-shot examples; only examples/dev is tracked (see §7)
eval/             node:test suites, ASR trap eval, live prompt batteries, fixtures
docs/             provider spike, UI audits, motion experiments, screenshots
```

### 2.2 Dependencies worth explaining

| Package | Why it is here |
|---|---|
| `dexie` | IndexedDB wrapper; the entire datastore (`src/lib/db.ts`, schema v4) |
| `@anthropic-ai/sdk` | LLM calls direct from the browser (`dangerouslyAllowBrowser: true`) |
| `@base-ui/react` | Primitive layer under shadcn in this project — **not Radix**; triggers use `render={...}`, not `asChild` |
| `shadcn` | Component registry CLI; components are vendored into `src/components/ui` |
| `@tiptap/*` | The Bericht editor (starter-kit, text-style for font size) |
| `docx` (dev dep) | Builds the `.docx` programmatically — see §9 |
| `docxtemplater` + `pizzip` | **Installed but unused in `src/`** (verified by grep). Left from the SPEC's template-based export plan |
| `border-beam` | Third-party press animation on the three sidebar keys |
| `motion` | Installed; used only in the dev motion-lab and one accordion |
| `sonner` | Toasts |
| `zustand` | View state |
| `next-themes` | Installed; the app ships light-only |
| `@fontsource-variable/geist`, `@fontsource/carlito` | Bundled fonts — no external font host (§4.3) |
| `react-resizable-panels` | Installed; no current usage found in `src/features` |

Five installed packages are unused or near-unused (`docxtemplater`, `pizzip`,
`next-themes`, `react-resizable-panels`, and `motion` outside the lab). Harmless
but worth pruning before a handover.

---

## 3. Feature status vs SPEC.md

SPEC.md describes a **six-section letter builder**. The app that exists is a
**three-feature tool**. That divergence is deliberate and client-driven, but a
reviewer comparing the two documents should know the spec is stale.

| SPEC feature | Status | Detail | Main files |
|---|---|---|---|
| Rant mode (rant → Beurteilung) | **Done** | Shipped as "Diktat", end-to-end: record → transcribe → draft → edit → copy | `features/record/`, `features/session/DiktatContent.tsx`, `prompts/beurteilung.ts` |
| Messwerte mode | **Missing** | No code path, no prompt. Grep for `Messwerte` in `src/` returns nothing. The consultation prompt explicitly *excludes* machine values as out of scope | — |
| Six-section editor | **Partial** | Became "Bericht": a TipTap page seeded with 5 template headings, dictation per section, import from recordings. Not the spec's six fixed sections with per-section fill modes | `features/document/` |
| Vorbrief input | **Missing** | No occurrence of `Vorbrief` anywhere in `src/` | — |
| Verification pass | **Missing** | No second-model check exists. The only `verification` hit is an unrelated comment | — |
| Glossary + learning loop | **Missing** | Prompts accept a glossary parameter, but every call site passes `glossary: []` (`lib/generate.ts:75,78`, `features/document/dictate.ts:26`). No term store, no diff/learn UI | — |
| Settings | **Partial** | Three sections only: Speicher, Verbindungen (read-only status), Alle Daten löschen. Provider pickers, retention controls and key fields were deliberately removed (`SettingsPage.tsx:28`) | `features/settings/SettingsPage.tsx` |
| .docx export | **Partial** | Works, but built programmatically rather than from his template (§9) | `features/document/export-docx.ts` |
| Backups (File System Access) | **Missing** | No `showDirectoryPicker`, no backup writer, no manual export button | — |
| Retention | **Missing** | Settings text references it historically; no policy or deletion job exists | — |
| Session recovery | **Done** | Unfinished sessions with audio are offered on the start screen, with a guarded discard | `lib/session/recording-session.ts:303-330`, `features/start/StartScreen.tsx` |

**Spec deviation that matters most:** SPEC constraint 5 requires every gap to be
rendered as a visible `[FEHLT: …]` marker. The app now does the opposite — it
omits silently and relies on the transcript being one tab away. This was a
deliberate reversal, documented at `prompts/rules.ts:12-21`, and the client
asked for it. A reviewer holding the spec will read it as a violation; it is a
decision, and the safety rules the markers enforced still exist as CORE_RULES 1–3.

---

## 4. Architecture check

### 4.1 Server code and outbound hosts

**No server code exists.** No `api/`, `server/`, or `functions/` directory;
`vercel.json` contains only headers. The app is a static SPA.

Every outbound host, from grepping `https://` across `src/`, `prompts/`,
`index.html`, cross-checked against the CSP `connect-src`:

| Host | Purpose |
|---|---|
| `api.eu.assemblyai.com` | ASR (EU region) |
| `api.anthropic.com` | LLM, direct browser calls |
| `ai-gateway.vercel.sh` | LLM via Vercel AI Gateway (current default) |

CSP is enforced at the edge (`vercel.json`): `default-src 'self'`, no
`unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, and `connect-src`
limited to exactly those three hosts. Adapters for OpenAI, ElevenLabs and
Mistral exist in `src/lib/providers/` but their hosts are **not** in `connect-src`,
so selecting them would be blocked in production.

### 4.2 Keys — the biggest issue in this review

Keys are read as build-time constants and inlined into the client bundle:

```ts
// src/lib/config.ts
export const BUILT_IN_KEYS = {
  'assemblyai-eu': trim(import.meta.env.VITE_ASSEMBLYAI_API_KEY),
  gateway:         trim(import.meta.env.VITE_AI_GATEWAY_API_KEY),
  // …
}
```

Stored keys in IndexedDB (`lib/settings.ts:33`, key `apiKeys`) override them, but
the settings UI no longer exposes a field to enter one — it tells the user
"Der Zugang ist fest hinterlegt" (`SettingsPage.tsx:117`). So in practice the
build-time path is the only path.

**Consequences.** Any key present at build time ships inside public JavaScript
and is extractable by anyone who loads the page. The production deployment has
no auth (Vercel SSO protection was disabled deliberately, per the project's own
notes), so the page is world-readable.

**What I could and could not verify.** `vercel env ls production` shows both
`VITE_AI_GATEWAY_API_KEY` and `VITE_ASSEMBLYAI_API_KEY` set for Production
(names only; values encrypted). I fetched the deployed bundle and searched for
key-shaped tokens: no 32-hex token, no 55–70-character token, and neither local
`.env.local` value appears literally. I did **not** attempt a live provider call
from the deployed page. So I cannot confirm from the client side whether the
shipped build carries usable credentials — but the architecture guarantees that
if it works for the user, the key is in the bundle.

**This should be resolved before any demo where the URL is shared.**

### 4.3 Storage, telemetry, fonts, CDNs

- `localStorage` / `sessionStorage`: **none** (grep across `src/` returns nothing). All state is IndexedDB.
- Analytics / error reporting: **none**. No Sentry, PostHog, GA, Plausible in `src/` or `package.json`. The intent is stated at `lib/providers/origins.ts:14`.
- Fonts: bundled via `@fontsource*`; `index.html` carries a comment forbidding CDN links; CSP `font-src 'self'` would block a CDN anyway.
- Runtime CDN loads: none permitted by CSP (`script-src 'self'`).

### 4.4 Diagnosis or code suggestion

No feature suggests diagnoses or ICD/GOÄ codes, and the prompts forbid it
explicitly — CORE_RULE 5 (`prompts/rules.ts`) bans stating any diagnosis not
made in the recording, bans ICD and GOÄ codes outright, and bans upgrading lay
language into clinical terms ("hohes Cholesterin" must not become
"Hypercholesterinämie"). There is a test asserting the safety rules are present
in both prompts (`eval/prompts.test.ts`).

---

## 5. Audio pipeline

**One continuous `MediaRecorder` per sitting, flushed on a timeslice** — not
segment rotation. The design note at `src/lib/audio/recorder.ts:1-19` explains
the change: rotation produced independently sendable ~45 s files but broke
speaker diarization and the global timeline.

```ts
// src/lib/audio/recorder.ts
const TIMESLICE_MS = 5_000;              // :35
recorder.start(TIMESLICE_MS);            // :103
```

```ts
// src/lib/session/recording-session.ts:224
private async persistChunk(blob: Blob, index: number): Promise<void> {
  const sessionId = this.state.sessionId;
  if (!sessionId) return;
  try {
    await db.chunks.add({ id: newId(), sessionId, index, blob, createdAt: Date.now() });
  } catch (error) {
    this.fail(error instanceof Error && error.name === 'QuotaExceededError'
      ? 'Der Speicher ist voll. Bitte löschen Sie alte Aufnahmen in den Einstellungen.'
      : 'Ein Audioabschnitt konnte nicht gespeichert werden.');
  }
}
```

- **Persistence timing:** every chunk is written to IndexedDB the moment it
  arrives, before any network call.
- **Transcription during recording:** **no.** `pipeline.process(sessionId)` runs
  only after stop (`features/record/RecordFlow.tsx:68-75`). Nothing leaves the
  machine while recording.
- **Wake lock:** acquired on start, released on stop
  (`recording-session.ts:207-208, 286`).
- **`beforeunload` guard:** registered on start, removed on stop (`:209, :279`).
- **Recovery:** sessions still marked `recording` that have at least one chunk
  are offered on the start screen; "Weiterverwenden" stitches the chunks and
  runs the pipeline, "Verwerfen" is behind an AlertDialog
  (`recording-session.ts:303-330`).

**Maximum audio loss on a crash: the current 5-second timeslice, plus whatever
the recorder has buffered but not yet emitted — under ~10 seconds in practice.**
Chunks are not independently playable (only the first carries the container
header), but concatenated in order they form a valid prefix, which is what
recovery relies on.

Not covered: no quota pre-flight before a long recording — the failure surfaces
mid-session as the QuotaExceededError branch above.

---

## 6. Providers

**ASR:** AssemblyAI EU is the only one wired to a working host. Adapters exist
for ElevenLabs, Mistral Voxtral and an OpenAI-compatible endpoint, but their
hosts are absent from the CSP.
Default: `asrProviderId: 'assemblyai-eu'` (`lib/settings.ts:24`).

**LLM:** two adapters — Anthropic direct (`anthropic-draft.ts`, model
`claude-opus-5`) and the Vercel AI Gateway (`gateway-draft.ts`, default model
`openai/gpt-5.6-terra`).
Default: `llmProviderId: 'gateway'` (`lib/settings.ts:27`), with the in-code note
"Switch to `anthropic` before real patient use."

**That default deserves a decision before the demo:** the gateway routes patient
text through an additional US intermediary, and the shipped default model is not
the Claude model the spec assumes.

**Provider spike** (`docs/providers.md`, dated 2026-08-15, method = CORS
preflight with no key):

| Provider | `Access-Control-Allow-Origin` | Verdict |
|---|---|---|
| AssemblyAI (EU) | `*` | viable, EU |
| Mistral Voxtral | `*` | viable, EU |
| ElevenLabs Scribe | `*` | viable, non-EU |
| OpenAI Whisper | echoes origin | viable, non-EU |
| Anthropic | `*` conditionally | viable, non-EU |
| Corti (data plane) | `*` | data plane OK |
| Corti (auth) | no preflight response | **disqualifying** |

The doc says to re-run before shipping; it is two weeks old.

---

## 7. Prompts

| File | Role |
|---|---|
| `prompts/rules.ts` | `CORE_RULES` shared by every prompt, plus `PROMPT_VERSION` |
| `prompts/beurteilung.ts` | Diktat → Zusammenfassende Beurteilung; exports `HJ_STYLE` |
| `prompts/gespraech.ts` | Consultation → free-form sectioned notes |
| `prompts/abschnitt.ts` | One dictated section inside a Bericht, with heading detection |

Rules enforced (all in German, deliberately — `rules.ts:9-12`):

1. **Never invent.** Anything missing or unintelligible is omitted, with no
   placeholders and no bracketed markers.
2. **Negations preserved verbatim** — a dropped "verneint" reads to the next
   doctor as "never asked".
3. **Never guess a dose.** A partial scheme means drug and strength only; an
   unusable medication statement is dropped entirely rather than partially
   reported.
4. Numbers, units and drug names copied exactly; contradictory values kept side
   by side with their source.
5. No diagnoses, no ICD/GOÄ codes, no upgrading of lay terms.
6. German conventions: decimal comma, `1-0-0` dosing, `Z.n.`/`V.a.`, ß not ss.
7. Requested content only — no preamble or commentary.
8. A conversation is an untidy source: questions aren't statements, self-
   corrections keep the last version, another speaker's contradiction is not a
   correction.

**`[FEHLT]` markers no longer exist** — removed deliberately, history at
`rules.ts:12-21`. The live batteries now *fail* on any bracketed gap marker.

**Few-shot examples are git-ignored:**

```
# .gitignore:14-15
# Real anonymised letters used as few-shot examples
prompts/examples/real/

# .gitignore:38
HJ report examples/
```

`git ls-files prompts/examples` returns only `prompts/examples/dev/index.ts`, so
no real letters are tracked. Confirmed.

---

## 8. Eval

`npm run eval` exists (`eval/run.ts`) and is an **ASR** trap-set eval, not an
end-to-end one. It transcribes generated TTS audio (`eval/audio/*.wav`, produced
by `npm run eval:tts`) and scores each transcript against traps split into
`safety` and `style`; `--gate=<provider>` exits non-zero unless that provider
passes 100% of safety traps.

Latest stored run — `eval/results/2026-08-16T18-41-05-577Z.json`, **two weeks old**:

```
assemblyai-eu   10 runs   safety 67/69   style 7/7
```

Two safety traps failed on the most recent recorded run and the failures have
not been re-run since. **By the spec's own definition ("green means every safety
trap passes"), the eval is not currently green.**

Separately there are 141 unit tests (`npm test`, all passing) covering prompt
parsing, bullet/clipboard formatting, docx structure, and the Bericht insert
engine; plus two **live** batteries requiring a real key
(`eval/gespraech-battery.mts`, `eval/abschnitt-battery.mts`). The consultation
battery was run during this session against three fixtures × 2 runs: 6/6 clean
after the current prompt changes.

---

## 9. Docx export

`src/features/document/export-docx.ts` walks the TipTap JSON and builds a
document with the `docx` library — `new Document({...})` at :126, `Packer.toBlob`
at :177, then an anchor download. It defines its own styles (Calibri, heading
sizes) and a numbering config for bullets, and interleaves literal tabs as `Tab()`
runs so the medication columns survive.

**There is no template.** `docxtemplater` and `pizzip` are installed but unused
in `src/`; the SPEC's "export via his template" is not implemented.

**Known limitation:** because the file is generated rather than filled, it
carries none of his letterhead — no practice address, no logo, no footer, no
page setup from his own `.docx`. Fidelity is limited to headings, bold/italic/
underline, bullets (one nesting level), paragraphs and tabs. For the demo the
output is a clean but anonymous document he would still paste into his own
template.

---

## 10. UI

**Language.** German throughout the app surfaces. A heuristic scan for English
sentences in `src/features` and `src/layouts` found none; the only English
strings are inside vendored shadcn primitives (`components/ui/sidebar.tsx:198`,
a screen-reader description), which are user-visible only to assistive tech.
Worth fixing before shipping to a German-speaking user with a screen reader.

**Recording indicator.** While recording, the recorder screen shows a running
clock and an animated waveform driven by real microphone level, with an
`aria-label` that reports the input level as a percentage and switches to
"Aufnahme läuft, aber es wird kein Ton empfangen" when the mic goes silent
(`features/record/RecordingWave.tsx:116-118`). A screen wake lock keeps the
display on. **There is no global recording indicator** — navigate away from the
recorder screen and nothing in the sidebar or header says a recording is still
running.

**Three moments a 70-year-old non-technical user will find confusing:**

1. **Nothing tells him a recording is still running once he leaves that screen.**
   The sidebar looks identical whether or not the microphone is live. Combined
   with the fact that stopping is only possible on that one screen, this is the
   most likely way to lose a consultation.
2. **The Bericht page has three different ways to insert text** — the per-section
   "Diktieren" key, the toolbar's "Diktieren" menu, and "Einfügen" (import from
   a recording) — with no explanation of how they differ. "Einfügen" in German
   reads as "paste", which is not what it does.
3. **Processing has no time expectation.** After stopping, transcription and
   drafting run for tens of seconds with a spinner and no estimate; on a slow
   connection it is indistinguishable from a hang, and the natural response is to
   press something else.

---

## 11. Known bugs, TODOs, demo scaffolding — ranked

There are **no `TODO`/`FIXME`/`HACK` comments** anywhere in `src/`, `prompts/`
or `eval/`. The following come from reading the code and this session's work.

| # | Severity | Issue |
|---|---|---|
| 1 | **Critical** | Provider keys are inlined into a public, unauthenticated bundle by design (§4.2). Anyone with the URL can extract whatever key the build carries. |
| 2 | **High** | Default LLM is the Vercel AI Gateway on `openai/gpt-5.6-terra`, with an in-code note saying to switch to Anthropic before real patient use (`lib/settings.ts:24-27`). Patient text currently routes through an extra US hop. |
| 3 | **High** | No global recording indicator and no way to stop from anywhere else (§10.1). |
| 4 | **High** | The stored ASR eval is two weeks old and shows 2 failed safety traps; nothing has re-run it since (§8). |
| 5 | **Medium** | No backups, no retention, no export-all. A cleared browser profile or a corrupted IndexedDB loses every recording and letter, with no recovery path. |
| 6 | **Medium** | Storage quota is only handled after it fails, mid-recording. No pre-flight estimate, no proactive cleanup. |
| 7 | **Medium** | Existing Termin results in his database were drafted under the previous four-section prompt and keep that shape until regenerated — a demo on old data will not show the new behaviour. |
| 8 | **Low** | Dev scaffolds `__berichtTest` / `__ergaenzungTest` attach to `window`, guarded by `import.meta.env.DEV` so they do not ship — but `src/motion-lab` and `src/preview` are still in the source tree. |
| 9 | **Low** | Five unused/near-unused dependencies (§2.2), including the two the spec's export design was meant to use. |
| 10 | **Low** | No README; onboarding depends on a stale SPEC.md that describes a different product. |

---

## 12. Top five concerns about demoing this now

1. **The public URL leaks credentials.** Before showing anything at a shared
   link, either put the deployment behind Vercel's access protection or move key
   entry back into the settings screen so nothing is baked into the bundle. This
   is the one item I would not demo without.

2. **The LLM default contradicts the privacy story.** The pitch is "everything
   stays on this computer", and it is true of storage — but drafting currently
   sends the transcript to a US gateway on a non-Claude default model, against an
   in-code note saying to switch first. If the client asks "where does the text
   go?", the honest answer today is longer than the pitch.

3. **A live recording can be silently orphaned.** Stopping exists only on the
   recorder screen and nothing anywhere else shows that the microphone is open.
   The demo failure mode — clicking into the sidebar mid-consultation and losing
   the thread — is easy to hit and embarrassing.

4. **The safety eval is stale and not green.** The most recent stored ASR run
   failed 2 of 69 safety traps, two weeks and many prompt changes ago. For a
   medical tool, "we cannot currently show a green safety run" is a fair question
   to be asked and a bad one to be surprised by. Re-run it before the meeting.

5. **The spec and the product no longer describe the same thing.** Four spec
   features are absent (Messwerte, Vorbrief, verification pass, glossary loop),
   the six-section editor became something different, and the `[FEHLT]` marker
   requirement was deliberately reversed. All defensible — but if the client
   reads SPEC.md as the contract, that conversation should be led, not
   discovered.

**What is genuinely strong**, and worth demoing deliberately: crash-safe audio
with a bounded loss of ~5 seconds, a strict CSP with a three-host allowlist, no
telemetry or third-party fonts of any kind, safety rules that are enforced in
prompt text *and* pinned by tests and live batteries, and a consultation feature
that now shapes its output to what was actually said.
