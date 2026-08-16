# SPEC: Arztbrief-Assistent für Kardiologie (working name: TBD)

Client-only web app that turns a German cardiologist's spoken input into his exact report format. Single user: Prof. H.-J. R., ~70s, cardiologist at a private clinic, writes all reports in a fixed Microsoft Word template, types slowly, not computer-savvy. UI must be dead simple and entirely in German. He reviews everything; the app drafts, never decides.

## Non-negotiable constraints (these override convenience)

1. **No backend. No database server. No proxy.** The app is a static site. All API calls go browser → provider directly, using API keys that belong to the doctor and live only on his machine. If a provider cannot be called browser-direct (CORS), it is disqualified. Never route audio or text through our own serverless functions.
2. **No patient data leaves the browser except to the configured EU AI endpoints.** No telemetry, no analytics, no error reporting to external services, no external fonts or CDNs at runtime. Bundle everything.
3. **No diagnosis suggestions, no ICD/GOÄ code suggestions, ever.** Documentation drafting only. This keeps the app out of medical device (MDR) classification. Do not add "smart" clinical features.
4. **Mandatory review.** Nothing can be exported or copied before the user confirms via a "Freigeben" action per document. Log generate/edit/approve events to a local audit table.
5. **The model never invents medical facts.** Anything not present in the source (transcript/rant/Vorbrief) is rendered as a visible `[FEHLT: …]` marker, never guessed.
6. **A recording must be unlosable.** Crash, tab close, PC sleep, network outage: max acceptable loss is seconds, never a session.
7. Dev and testing use synthetic data only. Real (anonymized) sample letters are added locally by Mateo and are git-ignored. Repo stays private.

## Stack

- Vite + React + TypeScript (no Next.js: there must be no server code to accidentally use)
- Tailwind + shadcn/ui, Zustand for state
- Dexie (IndexedDB) for all persistence; call `navigator.storage.persist()` on first launch and surface the result in settings
- docxtemplater + PizZip for .docx export from the doctor's real Word template
- Deployed as static site on Vercel; also fully functional via `npm run preview` on localhost
- Target browser: current Edge (Chromium) on Windows. Test wake lock, File System Access API, MediaRecorder there.
- UI language: German, hardcoded strings are fine (single user). Sie-Form everywhere.

## The report

Six sections, matching his Word template exactly:

1. **Kopf**: Empfänger (referring doctors), Patient (Name, Geburtsdatum), Datum, Anrede ("Sehr geehrte Frau Kollegin, sehr geehrter Herr Kollege, ich darf nachfolgend über … berichten")
2. **Diagnosen**: hierarchical bullet list, main diagnoses underlined, sub-items as "Z.n. …" style entries with dates
3. **Anamnese / Vorgeschichte**: short prose
4. **Befunde / Messwerte**: structured values from Echo, EKG, Ergometrie (e.g. "LVEF 50 %", "LVEDD 48 mm")
5. **Zusammenfassende Beurteilung**: long bullet points, the most important section, his voice
6. **Aktuelle Therapie**: medication table, dosing notation "1-0-0", "0-0-1", optionally with end dates ("bis 5/26")

German conventions the output must always follow: decimal comma ("4,7 cm", never "4.7 cm"), dates as DD.MM.YYYY or M/YY as in his letters, dosing as 1-0-0 scheme, standard abbreviations (Z.n., V.a., DD, NYHA II, CCS). Negations must survive verbatim ("keine Angina pectoris" must never lose its "keine").

## Features

### v1.0 (build this)

**A. Rant to Beurteilung (primary feature, build first, end-to-end)**
Doctor taps one big button, talks freely about the patient for 1-5 min, gets a formatted Beurteilung draft (section 5) in his style. Spoken punctuation ("Punkt", "Komma", "neuer Absatz") must be tolerated and interpreted, but never required.

**B. Messwerte mode**
Doctor reads values off the ultrasound/EKG machine ("LVEF fünfzig Prozent, LVEDD achtundvierzig Millimeter…"). Values appear live in the structured section-4 block, mapped to known fields; unknown values land in a free list. Use a small/fast LLM for extraction into a JSON schema; render instantly.

**C. Report editor (the spine)**
One canvas with the six sections. Each section can be filled by: rant, Messwerte, typing, pasting, or skipped. A "Vorbrief einfügen" box accepts the previous letter as pasted text; the model uses it to carry diagnoses forward and write comparisons with prior values. Per-section "Kopieren" buttons + full ".docx erstellen" export via his template. Unfilled parts render as `[FEHLT: …]`.

**D. Verification pass**
After drafting, a cheap model checks every factual claim in the draft against the source transcript(s). Unsupported claims get flagged inline (yellow highlight + `[FEHLT]`-style marker). Runs automatically before the draft is shown.

**E. Glossary + learning loop**
Editable term list (drugs, abbreviations, referring doctor names). Passed to the ASR as keyterms and to the LLM in the prompt. When the user edits a draft, diff the changes and suggest glossary additions ("Immer so schreiben?"). One-click accept.

**F. Settings**
API key entry (masked, stored in IndexedDB, never in code or env of the deployed site), provider selection for ASR and LLM, retention settings, backup folder picker, storage-persist status, "Alle Daten löschen".

### v1.1 (scaffold interfaces, do not build yet)
Ambient mode: records the live patient conversation (requires signed patient consent, handled outside the app), diarization, summarizes into sections 1-3. Leave a disabled tab and a provider interface hook.

## Audio pipeline (get this exactly right)

- MediaRecorder with **segment rotation**: restart the recorder every ~45 s so every saved blob is a self-contained playable file (naive `timeslice` chunks after the first are headerless and cannot be sent to APIs individually). Use two alternating recorders or fast stop/start to avoid gaps.
- Every segment is written to IndexedDB the moment it exists, then queued for transcription. Transcription runs during recording, not after.
- Screen Wake Lock API active while recording; re-acquire on visibilitychange.
- `beforeunload` guard while a session is open; on next launch, detect unfinished sessions and offer recovery ("Sitzung vom 14:32 fortsetzen?").
- Offline/API-down: recording never depends on the network. Failed transcription jobs queue with visible "wird nachgeholt" status and retry with backoff.
- Mic level via AnalyserNode exposed as a `useMicLevel()` hook driving the recording indicator (a reactive orb component; visual will be swapped later, keep it a self-contained component with a `level` prop). Recording state must be unmissable: big timer, live level, loud error state if the input goes silent/dies.
- Audio blobs are deleted automatically after successful transcription (configurable off). Drafts auto-delete N days after export (default 14). Retention job runs on app start.

## Provider adapters

```ts
interface TranscriptionProvider {
  id: 'corti' | 'assemblyai-eu' | 'elevenlabs' | 'voxtral' | 'openai';
  transcribeSegment(blob: Blob, opts: { language: 'de'; keyterms: string[] }): Promise<TranscriptChunk>;
}
interface DraftProvider {
  id: 'anthropic' | 'openai' | 'mistral';
  draft(req: DraftRequest): Promise<DraftResponse>; // sections, few-shot, glossary, vorbrief
  verify(draft: string, sources: string[]): Promise<VerificationFlag[]>;
}
```

- Phase 1 includes a **provider spike**: verify browser-direct CORS for Corti and AssemblyAI-EU (base URL `https://api.eu.assemblyai.com`), with ElevenLabs Scribe v2 and Voxtral as fallbacks. Any provider that requires server-side token minting is out. Document findings in `docs/providers.md`.
- Anthropic browser calls: official SDK with `dangerouslyAllowBrowser: true` (raw fetch needs the `anthropic-dangerous-direct-browser-access: true` header). Drafting default: latest Sonnet (`claude-sonnet-5`; verify current model string against docs at build time). Verification + Messwerte extraction: `claude-haiku-4-5`.
- ASR winner is decided by the trap-set eval, not benchmarks. Default config ships with the winner; others stay selectable in settings.

## Prompt architecture

- `prompts/` directory, versioned, plain TS template files. System prompt per task (beurteilung, messwerte, kopf/diagnosen from Vorbrief, verification).
- Few-shot: 2 anonymized real letters (added by Mateo into `prompts/examples/real/`, git-ignored; synthetic stand-ins in `prompts/examples/dev/` for development).
- Rules embedded in every drafting prompt: German conventions above, never invent, `[FEHLT: …]` for gaps, keep his phrasing (learned from examples), output plain structured text mapped to sections (define a strict output format and parse it).
- Use prompt caching for the static prompt+examples block.

## Eval (build before tuning anything)

`fixtures/` with 5 scripted fake cases (German rant transcripts + Messwerte readouts + a Vorbrief), each with expected-output assertions. `npm run eval` runs the pipeline against a live key and checks trap assertions programmatically:
- decimal commas preserved, dosing notation intact, dates formatted
- all negations from source present in draft
- all drug names + doses from source present and unaltered
- zero claims absent from source (spot-check via verification pass)
- `[FEHLT]` markers where fixtures deliberately omit info

Any prompt or glossary change must keep the eval green.

## Backups

File System Access API: user picks a folder once (e.g. `Dokumente/Arztbrief-Assistent`); store the handle, re-request permission gracefully on launch. After every approved export and daily: write JSON snapshots of glossary, templates, settings, and open sessions. Plus a manual "Sicherung herunterladen" button (single JSON file). Restore path in settings.

## Explicit non-goals for v1

No auth/accounts (single machine, single user), no cloud storage, no multi-tenant anything, no PVS/GDT integration, no ambient mode yet, no mobile layout (desktop Edge only), no English UI.

## Build order

- **P0**: scaffold, settings + key storage, Dexie schema (sessions, segments, transcripts, drafts, glossary, templates, settings, audit), storage.persist
- **P1**: provider spike + Rant mode end-to-end thin slice: record → segment → transcribe → draft Beurteilung → editor view → Freigeben → copy. This is the demo that wins HJ over; everything else follows.
- **P2**: full six-section editor, Vorbrief input, docx export with a real template file, per-section copy
- **P3**: Messwerte mode
- **P4**: verification pass, glossary learning loop, eval suite green
- **P5**: backups, retention, recovery flows, orb polish, German microcopy pass

Definition of done for v1: a full fake patient (rant + Messwerte + Vorbrief) becomes a complete, correctly formatted .docx in under 5 minutes of user interaction, with zero invented facts and the eval suite green.
