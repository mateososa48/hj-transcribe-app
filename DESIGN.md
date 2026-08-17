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
| Success / approved | `foreground` + check icon | Freigegeben, exported |
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

Requirements, from SPEC:

- **Big timer**, live elapsed time, readable across the room.
- **Live input level**, driven by real microphone data.
- **Loud error state** if input goes silent or the device dies. Silence during a
  dictation must be impossible to miss.
- Recording is a **whole-screen state**, not a small badge. He should be able to
  tell from two metres away whether it is recording.

Explicitly not: a pulsing microphone as decoration, chat bubbles, waveform eye
candy that doesn't reflect real input.

### How it is built (P1, ribbon since 2026-08-16)

`RecordingWave` renders a WebGL2 ribbon — one fragment shader, one full-screen
triangle, no geometry or framebuffers. It reads the stream the recorder already
opened: `MicLevelMonitor` reports three frequency bands **grouped by Hz**
(60–320 / 320–1600 / 1600–6000), not by even thirds of the FFT array, which is
the difference between a wave that moves on a voice and one that barely twitches.
Low sets amplitude, high sets colour separation, level sets brightness. Per-frame
audio goes through `recordingSession.subscribeAudio()` and never through React.

Three rules it must keep:

1. **While recording it is never simulated.** Real input or a flat line. The
   ambient idle animation exists so the panel is not empty when nothing is
   running, and it is damped hard so waiting and hearing are told apart at a
   glance — a resting grey thread versus a ribbon in full colour.
2. **Reduced motion silences drift, not response.** The idle animation stops and
   the loop stops drawing; a live signal still moves it. An indicator that cannot
   move cannot do its job.
3. **It degrades.** No WebGL2 falls back to `RecordingOrb`, the ring-and-core
   indicator, which takes the same `level` prop.

For tuning: in dev, `?wave=low,mid,high,level` pins the ribbon to a pose without
a microphone. The branch is stripped from production builds.

---

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
