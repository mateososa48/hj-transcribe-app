# Product

## Register

product

## Users

**One user: Prof. H.-J. R., ~75, cardiologist at a private clinic in Germany.**

He is an expert clinician and a novice computer user — not "a bit slow with tech", genuinely not fluent with software. He types slowly. He writes every report in a fixed Microsoft Word template and has done so for decades. He is the sole user; there are no accounts, no colleagues, no admin.

His context when using this: sitting at his desk, between or after patients, with a report to write that he would otherwise type by hand over 20+ minutes. He is not exploring the app. He has one job and wants it done.

**The job:** turn what he says about a patient into a correctly formatted German Arztbrief in his own template, his own phrasing, without inventing anything — and let him check and approve it before it exists as a document.

## Product Purpose

Drafting only, never deciding. The app produces a draft; he reviews and approves every document before it can be copied or exported. It suggests no diagnoses and no billing codes — deliberately, both to stay outside MDR medical-device classification and because that is not the problem worth solving.

Success is the SPEC's definition of done: a full patient case (dictation + measurements + previous letter) becomes a correctly formatted .docx in under five minutes of his interaction, with zero invented facts.

Failure — the thing that ends adoption on day one — is him losing a recording, or finding a fabricated value in a letter with his name on it.

## Brand Personality

**Calm. Legible. Unambiguous.**

The interface should read as a well-made professional instrument: it states plainly what it is doing and what just happened, and it never makes him guess. Tone is German, Sie-Form throughout, plain clinical register — the voice of a competent assistant, not a chatbot and not a consumer app.

No personality-for-its-own-sake. Delight here is "it worked and I could tell that it worked".

## Anti-references

Three named failure modes, from the user directly:

1. **Startup-y / consumer app.** Gradients, playful illustration, pill-shaped everything, marketing energy. Wrong register for a clinical document he signs.
2. **German hospital software (KIS / PVS).** Dense grey toolbars, 11px text, forty controls per screen. Familiar to him, and precisely the thing he is escaping.
3. **Gimmicky voice assistant.** Big pulsing microphone as decoration, chat bubbles, "Hallo! Wie kann ich helfen?". Makes a serious tool feel like a toy and quietly undermines trust in the output.

## Design Principles

1. **State is never implied.** Recording, transcribing, queued, failed, approved — each has an explicit, labelled, visible representation. He must never have to infer what the app is doing from the absence of something.
2. **The document is his, not the model's.** The app drafts; he approves. Nothing leaves the screen (copy, export) before an explicit Freigeben. Gaps show as `[FEHLT: …]`, never as a plausible guess.
3. **Nothing is lost.** Every recording survives a crash, a closed tab, a sleeping PC. Anything else is a bug of the highest severity.
4. **Fewer, larger, clearer.** One obvious action per screen, sized for a 75-year-old, in language he already uses. When in doubt, remove the control rather than shrink it.
5. **Familiar over clever.** Standard shadcn/ui components used the standard way. He should never have to learn an invented affordance.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**, with two deliberate over-deliveries driven by the user's age:

- **Body text ≥ 4.5:1**, and in practice near-maximum contrast (near-black on pure white). No grey body text on tinted backgrounds anywhere.
- **Base font size 18px, not 16px** — the whole rem-based scale rides on this, so every control and gap grows with it.
- Click targets ≥ 40px on anything he uses routinely; the record control much larger.
- Full keyboard operation and visible focus rings, unmodified from shadcn defaults.
- `prefers-reduced-motion` honoured on every transition.
- Colour is never the only signal — status always carries a text label as well.
- Desktop Edge (Chromium) on Windows only. No mobile layout (explicit non-goal).
