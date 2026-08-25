# Processing Motion Lab — compiled brief

## Product and audience

- Product: a standalone local motion-prototyping lab for the Arztbrief-Assistent.
- Audience: Mateo evaluates the prototypes; the eventual product animation serves one approximately 75-year-old cardiologist.
- Primary job: compare ten visibly different ways to communicate the path from recording to transcription to drafted clinical text.
- Operating environment: local Vite server in Chromium; desktop-first, with a short 700 px-tall window included because that is the clinician's real constraint.

## Fixed content and assets

- German stage language: „Aufnahme gesichert“, „Transkript wird erstellt“, „Notizen werden erstellt“, „Fertig“.
- Ten concepts: Signal → Satz, Klinischer Setzer, Übergabe, Fokus-Scan, Prozesslinie, Transkript-Montage, Sprecher-Gewebe, Korrekturlauf, Dokument-Puls, Randfortschritt.
- No external assets or runtime network requests.
- Existing self-hosted Geist Variable font may be reused.

## Tasks and states

- Primary: observe all ten concepts concurrently and identify the strongest motion language.
- Secondary: replay, pause/resume, change speed, and preview reduced motion.
- States: running, paused, replayed, 0.5×/1×/2× speed, reduced motion.
- The lab simulates work; it does not call transcription or drafting APIs.

## Viewports and accessibility

- Required captures: 1440×1000 desktop, 1024×700 short-window/tablet, 390×844 narrow.
- Pointer and keyboard operation for every control.
- Visible focus, labelled controls, live status, no horizontal overflow.
- Reduced-motion preview plus system `prefers-reduced-motion` handling.

## Technical constraints

- React 19, Vite 8, TypeScript 7, Tailwind 4 already exist.
- A separate `/motion-lab.html` entry keeps the product application untouched.
- Predetermined motion should be CSS-first; animate transform and opacity.
- No added dependency, CDN, analytics, or deployment.

## Known decisions

- Glass is allowed in the experimental lab, by user request.
- Glass is not automatically approved for the production clinical app; the winning motion will be translated to that app's design rules later.
- The lab is exploratory and does not choose a production winner by itself.

