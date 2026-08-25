# Product

## Register

product

## Users

**One user: Prof. H.-J. R., ~75, cardiologist at a private clinic in Germany.**

He is an expert clinician and a novice computer user — not "a bit slow with tech", genuinely not fluent with software. He types slowly. He writes every report in a fixed Microsoft Word template and has done so for decades. He is the sole user; there are no accounts, no colleagues, no admin.

His context when using this: either during a patient appointment, where he wants to stay present instead of typing, or at his desk afterward, where he would otherwise spend 20+ minutes typing a report section by hand. He is not exploring the app. He has one job and wants it done.

**The job:** capture what was said without losing the recording, then turn it into useful German cardiology text without inventing anything. During a consultation, that means editable notes plus a speaker-separated transcript and the original audio. During dictation, that means an editable Zusammenfassende Beurteilung that he can copy into his existing Word template.

## Product Purpose

Drafting only, never deciding. The app records, transcribes and drafts; he reads and corrects the result before using it in his report. It suggests no diagnoses and no billing codes — deliberately, because that is not the problem worth solving and would materially change the product's regulatory risk.

Success has two concrete forms:

1. A recorded appointment becomes four editable note sections — Zusammenfassung, Diagnosen, Anamnese and Medikation — with the speaker-separated transcript and original audio beside them.
2. A free dictation becomes an editable Zusammenfassende Beurteilung in his wording and format, ready to copy into Word.

In both flows, his interaction after recording should take minutes rather than the 20+ minutes he currently spends typing, and the output must contain zero invented facts.

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

1. **State is never implied.** Recording, stopping, transcribing, drafting, done and failed each have an explicit, labelled, visible representation. He must never have to infer what the app is doing from the absence of something.
2. **The source stays beside the draft.** Notes may be concise, but the speaker-separated transcript and original audio remain available for comparison. The app omits unsupported content rather than filling gaps with a plausible guess. He can edit every generated section before copying it.
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
