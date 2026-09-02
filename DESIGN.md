# Design

The visual and interaction system for the Arztbrief-Assistent. Read this before
writing any UI. Strategic context (who this is for, why) lives in `PRODUCT.md`.

---

## 1. The one-line brief

A modern product UI built entirely from shadcn/ui, scaled up and calmed down for
a 75-year-old who is not fluent with software. Professional white and black.
Nothing decorative.

Positioning: **between a clinical instrument and a modern product UI, leaning
product UI.** It should feel like a good contemporary app — not like a medical
device panel, and emphatically not like German hospital software.

---

## 2. Component system — shadcn/ui, exclusively

**All UI comes from shadcn/ui. Do not hand-roll a component that shadcn has.**

| Setting | Value |
|---|---|
| Style / preset | `base-nova` |
| Base library | **Base UI** (`@base-ui/react`) — not Radix |
| Base color | `neutral` |
| CSS variables | yes |
| Icon library | **Lucide** (`lucide-react`) — never mix icon families |
| Config | `components.json` |

Add components with the CLI, never by pasting from memory:

```bash
npx shadcn@latest add <component>
```

The official shadcn agent skill is installed at `.agents/skills/shadcn`; it reads
`components.json` and supplies current component APIs. Use it rather than
recalling props.

**Installed so far:** button, card, input, label, select, separator, badge,
alert-dialog, sonner, tabs, empty, item, skeleton, spinner, switch, field.

### Composition rules

- Forms use the **Field** family (`FieldGroup`, `Field`, `FieldLabel`,
  `FieldDescription`, `FieldError`) — not bare `<Label>` + `<Input>` stacks.
- Lists of settings/status use the **Item** family (`Item`, `ItemMedia`,
  `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`).
- Empty states use **Empty** (`EmptyHeader`, `EmptyMedia`, `EmptyTitle`,
  `EmptyDescription`, `EmptyContent`) and must teach the next action, never say
  "nothing here".
- Destructive actions use **AlertDialog**, always with a typed or explicit
  confirmation — never a bare button.
- Feedback uses **sonner** toasts. No custom notification layer.

---

## 3. Color

Pure achromatic neutral. `oklch(1 0 0)` white, `oklch(0.145 0 0)` near-black —
shadcn's `neutral` base, unmodified. **Do not introduce a brand hue.** The user
asked for professional white and black; the only saturated color in the product
is reserved for state (see below), so when something turns red it means
something.

Strategy: **Restrained.** Accent is used for primary action, current selection,
and state indicators only. Never for decoration.

### The one exception: the recording ribbon

The recording indicator is drawn in four spectral colours — blue, violet, rose,
amber. This is the only chromatic thing in the product and it is deliberate.

It is not a brand hue and it is not decoration: the colours *are* the reading.
The same wave is drawn four times, each copy phase-shifted; where the wave is
flat the copies overlap and cancel toward neutral, and where it bends hard they
separate and the edge fringes into a rainbow. So the colour appearing at all
means the microphone is picking up shape, and how far it separates is the high
band — sibilance — made visible. Nothing else in the app may borrow this
palette; the moment it appears on a button it stops meaning anything.

Definitions live in `src/features/record/wave/shaders.ts`.

### Semantic state vocabulary

Defined once, used everywhere. Every state carries a **text label** as well as a
color — color is never the only signal.

| State | Token | Where |
|---|---|---|
| Neutral / idle | `muted-foreground` | Waiting, not started |
| In progress | `foreground` + Spinner | Transcribing, drafting |
| Success / copied | `foreground` + check icon | "Kopiert" on a section |
| Warning / queued | `muted` surface | "wird nachgeholt" retry queue |
| Error / destructive | `destructive` | Failed transcription, dead mic, delete |
| **Recording** | dedicated, see §7 | The one place with real color presence |

Dark mode: tokens exist (shadcn ships them) but the app ships **light only**.
He works in a lit consulting room; a theme toggle is one more control to explain.

---

## 4. Typography

Single family: **Geist Variable**, self-hosted via `@fontsource-variable/geist`.

> Two notes on this choice, since Geist is normally on the avoid-list.
> First, it is bundled, not fetched — an external font request would violate
> SPEC constraint 2 outright. Second, this is single-user clinical software in
> German; there is no brand to differentiate and legibility is the only
> criterion. Product register explicitly permits familiar UI sans defaults.
> If it reads as too generic later, swap to a bundled Source Sans 3 or IBM Plex
> Sans — both are more legible at size, and the swap is one `--font-sans` line.

### The single most important rule

```css
html { font-size: 18px; }   /* not the 16px default */
```

Everything in Tailwind and shadcn is rem-based, so this one line scales **type,
control heights, padding, gaps and icon sizes together**, proportionally, with
zero component forks. A `h-8` button becomes 36px instead of 32px; an `h-9`
becomes 40px.

This is the primary accommodation for the user's age. Do not "fix" it back to
16px and then hand-patch sizes.

### Scale

Fixed rem steps, ratio ~1.2. No `clamp()` — this is product UI at a consistent
desktop DPI, and fluid headings serve nothing here.

| Role | Class | Weight |
|---|---|---|
| Page title | `text-2xl` | 600 |
| Section heading | `text-lg` | 600 |
| Body / labels | `text-base` | 400–500 |
| Supporting / description | `text-sm` `text-muted-foreground` | 400 |
| Never | `text-xs` for anything he must read | — |

Prose caps at 65–75ch. `text-wrap: balance` on headings.

---

## 5. Layout & density

- Deliberately **less dense than default shadcn**. Generous vertical rhythm;
  whitespace is doing accessibility work here, not aesthetic work.
- Content column max ~`72ch` for reading surfaces; settings and the editor get a
  wider fixed max-width with real gutters.
- Flexbox for 1D, Grid for 2D. `repeat(auto-fit, minmax(280px, 1fr))` for
  responsive card rows.
- **Cards are not the default answer.** Use `Item` for lists and plain sections
  with a `Separator` for grouping. Never nest cards.
- Radius: shadcn default (`--radius`). Cards stay ≤ 16px. No 24px+ rounding.

### Control sizing

| Control | Size | Rendered (@18px root) |
|---|---|---|
| Primary action | `size="lg"` | 40px |
| Standard control | default | 36px |
| `size="sm"` / `"xs"` | **avoid** | too small for this user |

Anything he clicks routinely is ≥ 40px tall.

---

## 6. Motion

Purposeful and short. Motion conveys **state change**, never decoration.

- 150–250 ms on transitions; ease-out curves (no bounce, no elastic).
- `tw-animate-css` is installed; use it for component enter/exit only.
- No orchestrated page-load sequences. The app loads into a task.
- **`prefers-reduced-motion: reduce` gets a crossfade or instant transition on
  every animation.** Non-optional.
- The recording indicator is the one continuous animation in the product, and it
  is functional: it proves the mic is live.

---

## 7. The recording state

This is the only place in the product with real visual presence, because it is
the only place where being unmissable outranks being calm.

- **Big timer**, live elapsed time, readable across the room.
- **Live input level**, driven by real microphone data.
- **Loud error state** if input goes silent or the device dies. Silence during a
  30-minute consultation is unrecoverable.
- The start/stop button must sit **above the fold on a 700px viewport** — his PC
  is old and its window is short. Measured, not assumed: currently 697px.

Explicitly not: a pulsing microphone as decoration, waveform eye candy that does
not reflect real input.

### How it is built

`RecordingWave` renders a WebGL2 ribbon — one fragment shader, one full-screen
triangle. It reads the stream the recorder already opened: `MicLevelMonitor`
reports three frequency bands **grouped by Hz** (60-320 / 320-1600 / 1600-6000),
not by even thirds of the FFT array, which is the difference between a wave that
moves on a voice and one that barely twitches. Per-frame audio goes through
`recordingSession.subscribeAudio()` and never through React.

Three rules it must keep:

1. **While recording it is never simulated.** Real input or a flat line. The
   idle ambience exists so the panel is not empty, and is damped hard so waiting
   and hearing are told apart at a glance.
2. **Reduced motion silences drift, not response.** The idle animation stops; a
   live signal still moves it.
3. **It degrades.** No WebGL2 falls back to `RecordingOrb`, same `level` prop.

For tuning: in dev, `?wave=low,mid,high,level` pins the ribbon to a pose without
a microphone. The branch is stripped from production builds.


## 8. German microcopy

- **Sie-Form everywhere.** Never du.
- Plain clinical German, his vocabulary. Buttons are verbs:
  „Aufnahme starten", „Freigeben", „.docx erstellen", „Kopieren".
- Errors say what happened, what it means, and what to do next — never a code.
  „Die Übertragung ist fehlgeschlagen. Die Aufnahme ist gespeichert und wird
  automatisch wiederholt." beats „Fehler 503".
- Status labels are nouns he'd use: „Wird aufgenommen", „Wird übertragen",
  „Wird nachgeholt", „Freigegeben".
- German conventions in all output: decimal comma („4,7 cm"), dates DD.MM.YYYY
  or M/YY, dosing „1-0-0", standard abbreviations (Z.n., V.a., NYHA II, CCS).
- Missing information renders literally as `[FEHLT: …]` — visible, never styled
  away, never guessed.

---

## 9. Hard bans

On top of the shared anti-slop rules:

- No gradient text, no glassmorphism, no side-stripe borders.
- No `border: 1px` + wide soft `box-shadow` on the same element.
- No card radius above 16px.
- No hand-drawn/sketchy SVG illustration.
- No emoji in the interface.
- No decorative motion.
- No icon family other than Lucide.
- No external font, script, style, or image at runtime — everything bundled
  (SPEC constraint 2, enforced by the CSP in `vite.config.ts`).
- No `text-xs` on anything the user must read.
- No modal as a first thought; exhaust inline alternatives.

---

## 10. Enforcement

Two constraints are enforced by the build, not by discipline:

- **CSP** (`vite.config.ts`) restricts `connect-src` to the origins listed in
  `src/lib/providers/origins.ts`. Adding a network destination requires editing
  that file, so every exfiltration path is visible in one diff.
- **No analytics, error reporting, or CDN** is possible under that policy —
  `default-src 'self'`, `script-src 'self'`.

---

## 8. The shape of the app (rebuilt 2026-08-24)

A sidebar app, Notion/Granola-shaped: everything ever recorded on the left,
grouped by day; the selected recording on the right. Built on shadcn's sidebar
primitives.

    ┌──────────────┬──────────────────────────────┐
    │ + Termin     │  Title (editable)            │
    │ + Diktat     │  Mo · 12:30 min · 2 Sprecher │
    │──────────────│  [Notizen] [Transkript]      │
    │ Heute        │                              │
    │  · Termin …  │  …                           │
    │  · Diktat …  │                              │
    │ Einstellungen│                              │
    └──────────────┴──────────────────────────────┘

**Two features that must not feel alike.** Termin records while he talks to a
patient — it stays inside the frame, calm, glanceable. Diktat is his solo task:
also in-frame and on the light surface (an earlier black full-screen takeover
was asked out), distinguished by the dark CTA card, the glossy finish and the
recording ribbon. The ribbon's additive dark mode survives as an option
(`RecordingWave dark`) and is used by the Studio design experiment.

**The recording architecture** (v3): ONE continuous MediaRecorder, flushed to
IndexedDB every 5 s. Timeslice chunks concatenate into one valid WebM — that
single property gives crash-safety (any prefix replays), one seekable file for
playback, and whole-file speaker diarization with consistent labels. Verified
in-browser: EBML header on chunk 0 only, 13-chunk concat decodes as one 63 s
file. This replaced segment rotation, which could do none of those.

**The pipeline is visible, not a queue.** Stop → upload → diarized transcript
(AssemblyAI EU, `speaker_labels` + `keyterms_prompt`) → notes (one LLM pass).
The session page shows each step. The whole class of "generated from half a
transcript" races died with the background queue.

**Notes are lossy on purpose; the transcript is not.** The `[FEHLT: …]` marker
system is gone. What the notes can't use they omit, because the ground truth —
speaker-split transcript and audio — is one tab away. The safety rules survive
in the prompt (never invent, negations verbatim, never guess or narrate a
dose); the eval batteries hold them at 0/16 garbage-assertions.

**Speakers are editable.** Diarization says "Sprecher 1 said this"; he says who
Sprecher 1 was (click the name → Arzt/Patient/…). Names feed the notes prompt.

**One setting is load-bearing**: persistent storage. A segment of audio is on
disk before any network call, and an interrupted session is offered back.


## Experiment status

Both evaluations are RESOLVED and the harness is deleted (git has it all):

- **Shell**: the sidebar layout ("standard") won; the six alternatives are
  gone. The content column width adapts per view (`MAIN_WIDTHS` in
  StandardLayout) — a session gets nearly the whole area.
- **Diktat page**: the two-column arrangement won. `DiktatContent.tsx` is the
  final page: two framed panels with tinted header strips — the Beurteilung
  left (header carries the primary glossy Kopieren; footer holds regenerate +
  undo), the Aufnahme right (player row, rule, follow-along transcript as
  rows of one panel, sticky at xl). While the pipeline runs the page shows
  ONLY the ProcessingHandoff animation; on completion a check mark pops,
  fades, and the panels appear (skipped entirely when reopening an old
  Diktat — the sequence only plays if this mount watched the run). The
  sequence timers live in a ref cleared on unmount only: the result object
  changes identity on reload, and per-run effect cleanup would cancel the
  check mark mid-flight.
- The Termin page is untouched by all of this.

**Diktat page: final form.** Two equal-height framed panels with aligned
h-16 header rules — the letter left (glossy pill Kopieren in the header),
the Aufnahme right (player row + follow-along transcript scrolling inside
the height the letter dictates; the panel is absolutely positioned in its
grid cell so only the letter drives the row height). The Beurteilung is one
ALWAYS-EDITABLE contentEditable surface rendering bulletsToHtml — real
discs, hanging indents, 1.25em markers — so editing never changes the
formatting; input serializes back to the stored "• " line format
(BeurteilungText.serializeEditable), paste is forced to plain text, blur
flushes the save. bulletsToHtml turns prose outside items into <p> instead
of dropping it. No regenerate button on the page (his call). btn-gloss v3:
subtler finish, hover lifts the key (translateY(-1px) + wider shadow)
instead of brightening. The play button is a quiet secondary circle. The
variant experiment is deleted; this page IS the design.

**Ergänzung (Nachdiktat).** "Ergänzen" in the Aufnahme panel header opens a
small floating recorder (clock + ribbon + red Fertig pill) that records an
ADDITION as a child session (`Session.parentId`) — same crash-safe chunk
machinery. On Fertig the child is transcribed (`pipeline.transcribeOnly`)
and the LLM integrates the addition into the CURRENT text of the parent
(`src/lib/ergaenzung.ts`; the current text, not the original transcript, so
manual corrections survive; previousSections backs up the old text). The
popup resolves recording → processing → check mark → slides away; the child
recording files at the bottom of the Aufnahme panel as a collapsible
"N. Ergänzung" row (player + follow-along, animated grid expand). Child
sessions never appear in the sidebar or the start-screen recovery list.
A DEV-only scaffold (`window.__ergaenzungTest`) fabricates a finished child
so the merge path is testable without a microphone.

**Bericht (the third feature).** A Word-feeling document (TipTap v3 on our
own toolbar keys — no Radix, no TipTap UI kit): page sheet on a muted
canvas, sticky toolbar (Absatzformat, Schriftgröße, B/I/U, lists, undo/redo,
Einfügen, Word-Datei, Kopieren). New Berichte are template-seeded with his
five real sections (Diagnosen, Anamnese, Befunde, Zusammenfassende
Beurteilung, Aktuelle Therapie) — partial by design. Hovering a block
floats a "+" (DragHandle) that starts a dictation via the shared
RecorderPopup (generalized from the Ergänzung popup; injected process
step); prompts/abschnitt.ts recognizes spoken section announcements and
normalizes them to the canonical names (shares HJ_STYLE with the
Beurteilung prompt; providers gained draftAbschnitt). Insert positions are
transaction-mapped against concurrent edits; a dictation finishing after
the editor closed appends via documents.appendToDocument — never lost.
ImportDialog pulls sections from existing Termine/Diktate (working copy,
with corrections) as heading + content; Medikation keeps literal tabs
end-to-end (editor CSS tab-size, plain-clipboard flavour, real <w:tab/>
in the .docx export via export-docx.ts). Data: Dexie v4 `documents`
table; child dictations use Session.parentId = documentId. The sidebar is
now a three-node file tree (Diktate/Termine/Berichte): house grid-rows
animation, guide line via SidebarMenuSub, per-row stagger, inert collapsed
branches; the VISIBLE_LIMIT/"Alle anzeigen" mechanism is gone.

## 11. The landing page (2026-09-01)

A second Vite entry, `landing.html` → `src/landing/main.tsx`, built alongside the app (`vite.config.ts` `rollupOptions.input`). It shares `index.css` (tokens, `btn-liquid-dark`, Geist, the document face) and adds only `src/landing/landing.css` (paper minis, framed screenshots, selection colour).

**Design read.** Product-led landing for German clinicians, calm and precise: monochrome Geist, the ribbon's four spectral hues as the single colour device, the product shown real and running. Studied against wisprflow.ai, granola.ai, heidihealth.com, linear.app, raycast.com and lovable.dev; each owns one signature visual device and shows the product large. Ours is the ribbon.

**Composition** (`Landing.tsx`): floating pill nav → hero (left-aligned two-line headline, ≤20-word sub, one primary + one secondary CTA) → the one picture: `HeroDemo` (the headline, sub and CTAs on the left with the app's recording window under them, its ribbon the real `WaveEngine` listening to the demo; on the right the letter itself as a tall A4 page in the document face that dissolves below the fold through a CSS mask, the demo writing its section into the page and the job chip filing it) over `ShaderField`, a WebGL2 fragment shader under the whole hero: domain-warped noise lays the ribbon's four hues on white with film grain, densest behind the demo, masked to white at both ends, listening to the demo through `voice.ts` so it breathes while the recorder hears and settles while the letter is written (half-resolution canvas, still frame under reduced motion, CSS field without WebGL2) → `Genauigkeit` (accuracy shown, never claimed: a lexicon with a stage. One headword at a time, set large in the display face in one of the ribbon's hues, arrives on a spring; above it the same thing as it was said, streaming; beneath it the real ribbon breathing while it hears, the same shader field as the hero under the stage at half strength; beside it the lexicon of every term on one continuous line with a single marker that slides to the current word, like the rail in the tools slab, any of them a click away; the last entry is the amber gap marker. The headword and its kind label carry the hue, nothing else does: violet term, blue value, rose dosage, amber not-said. No percentages anywhere) → `Scrollytelling` (the only dark slab, titled "Drei Werkzeuge, ein Brief."; three chapters as one pinned scene with a camera: each opens on the whole tool, then the frame moves in on the detail the text is about and counter-scaled callouts land on real UI elements; screenshots from `public/landing/*.webp`, camera focus and callout anchors as fractions of the image, a progress rail, click-to-jump; driven by plain motion values from one scroll listener because Motion tries to compile transform chains into native scroll animations) → `Bento` (wide tile + narrow tile + full-width band, each a working model) → `Vorlagen` (a small working template editor: five report types as tabs plus a blank one, the active template's sections as rows the reader can drag into a new order with motion's `Reorder`, an input that adds a section, and the letter beside it re-ordering live with a real line or two per known section; the tabs tour on their own until touched; this feature is not built yet in the app and is shown as if it were) → Vertrauen (three divided columns) → the closing: the last words and key over the same shader field run to the bottom edge, with the footer line resting on the colour.

**Type.** Two faces: Outfit (variable, bundled via `@fontsource-variable/outfit`, `.font-display` in `landing.css`) at medium weight, never heavier, for the headline, the slab title and the section titles; Geist for everything else, as in the app. The headline is one colour: no grey first line. The letter and the paper minis use the document face.

**Rhythm and alignment.** The nav pill (`Nav.tsx`) shares the content container: the wordmark sits on the page's left content edge and the key on its right one, at every width (measured, not eyeballed). Resting on the hero it is transparent and 56px tall; once the page moves it turns solid white and 48px, steps out of the way on the way down and returns on the first move up, and one highlight slides between the section links, following the pointer and otherwise resting on the section that crosses the middle of the viewport. Every text on white clears 4.5:1; Lighthouse reads 100 for accessibility, best practices and SEO.

**Rules that hold here.** No eyebrows (uppercase tracked labels), no em-dashes anywhere visible, no mixed-family italic in headlines, no three-equal-cards, one dark slab per page, buttons and chips are pills, panels 24px, paper 6px. One CTA label per intent ("Früher Zugang" everywhere). Every loop pauses offscreen and stands still under reduced motion.

**Verifying.** Desktop at 1440 and a true 390 in two browser tabs (phone tab: `new_page` with an isolated context, then emulate, then reload). If `innerWidth` differs from `documentElement.clientWidth` on the phone tab, the page overflows: find the first element whose right edge passes `clientWidth`. Full-page screenshots skip `whileInView` reveals; scroll each section into view and capture the viewport. The contact address in `CONTACT` is a placeholder for the real inbox.
