import { PROMPT_VERSION } from './rules.ts';

/**
 * Translating a finished section into another language.
 *
 * This is a much narrower job than drafting, and the failure modes are
 * different. A translator that "improves" a clinical sentence, converts a unit,
 * or localises a drug name can change what the letter says without ever looking
 * wrong. So the rules here are almost entirely about what must NOT change.
 *
 * Grounded in his own English report (in "HJ report examples/"), which shows
 * how he actually writes across languages: he keeps the German decimal comma
 * ("2,5cm", "0,7 cm") and even leaves some German headings in place. We follow
 * that rather than anglicising numbers.
 */

export const TRANSLATION_TAG = 'uebersetzung';

export interface TargetLanguage {
  code: string;
  /** Shown in the UI, in German. */
  label: string;
  /** Used inside the prompt. */
  name: string;
}

/**
 * Languages worth having in a Mainz cardiology practice: an English report for
 * international patients and insurers, plus the languages most often needed for
 * patients and their families.
 */
export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: 'en', label: 'Englisch', name: 'English' },
  { code: 'fr', label: 'Französisch', name: 'French' },
  { code: 'es', label: 'Spanisch', name: 'Spanish' },
  { code: 'it', label: 'Italienisch', name: 'Italian' },
  { code: 'tr', label: 'Türkisch', name: 'Turkish' },
  { code: 'ru', label: 'Russisch', name: 'Russian' },
  { code: 'pl', label: 'Polnisch', name: 'Polish' },
];

export function buildTranslationSystemPrompt(target: TargetLanguage): string {
  return `You translate a section of a German cardiology letter into ${target.name}.

You are translating a medical document that a physician will sign. Accuracy
outranks fluency everywhere the two conflict.

ABSOLUTE RULES

1. NEVER ADD, REMOVE OR REINTERPRET CLINICAL CONTENT.
   Translate what is written. Do not clarify, do not expand an abbreviation, do
   not "improve" an ambiguous sentence, do not add a connective that implies a
   causal link the German did not state. If the German is vague, the
   translation is vague in the same way.

2. NEGATIONS ARE THE HIGHEST-RISK ITEM.
   Every "keine", "kein", "nicht", "ohne", "verneint", "unauffällig" must
   survive as an explicit negation. Check each one separately after translating.

3. NUMBERS, UNITS AND MEASUREMENTS ARE COPIED CHARACTER FOR CHARACTER.
   Do NOT convert units. Do NOT change the decimal separator: "4,7 cm" stays
   "4,7 cm", never "4.7 cm". Do NOT round. Do NOT reformat a blood pressure or
   a lab value. This physician keeps German number formatting in his own
   English reports; match that.

4. DRUG NAMES AND DOSING STAY EXACTLY AS WRITTEN.
   Never localise a drug name (no "Paracetamol" to "Acetaminophen"), never
   change a strength, never reformat a dosing scheme: "1-0-0" stays "1-0-0",
   "bis 5/26" keeps its date form.

5. KEEP EVERY [FEHLT: ...] MARKER.
   Translate only the text inside the brackets; keep the marker itself and the
   word FEHLT unchanged, so the reviewing physician still recognises it:
       [FEHLT: LVEF not recorded]

6. KEEP THE STRUCTURE.
   Same number of bullet points, in the same order. A bullet starting with "- "
   still starts with "- ". Do not merge or split points.

7. ESTABLISHED CLINICAL TERMS.
   Use the standard term in ${target.name} where one clearly exists
   (Vorhofflimmern -> atrial fibrillation). Where a German abbreviation is also
   used internationally (Z.n., NYHA II, CCS, LVEF, LVEDD), leave it as is.
   If you are unsure of the correct term, keep the German word rather than
   guessing at one.

OUTPUT

Return exactly one block and nothing else:

<${TRANSLATION_TAG}>
... the translated section ...
</${TRANSLATION_TAG}>`;
}

export function buildTranslationUserPrompt(text: string, target: TargetLanguage): string {
  return `Translate the following section into ${target.name}, following every rule above.

${text.trim()}`;
}

export const TRANSLATION_PROMPT_VERSION = PROMPT_VERSION;

/** Pull the translated section out of the response. Forgiving, like the drafter. */
export function parseTranslation(raw: string): { text: string; wellFormed: boolean } {
  const closed = raw.match(
    new RegExp(`<${TRANSLATION_TAG}>([\\s\\S]*?)</${TRANSLATION_TAG}>`, 'i'),
  );
  if (closed?.[1]) return { text: closed[1].trim(), wellFormed: true };

  const open = raw.match(new RegExp(`<${TRANSLATION_TAG}>([\\s\\S]*)`, 'i'));
  if (open?.[1]) return { text: open[1].trim(), wellFormed: false };

  return { text: raw.trim(), wellFormed: false };
}

/**
 * Cheap structural check on a translation before HJ ever sees it.
 *
 * This does NOT judge the language — it verifies the things that are supposed
 * to be copied verbatim actually were. A translation that silently dropped a
 * measurement or a dose is the failure worth catching automatically, because
 * it is the one that reads perfectly fine.
 */
export interface TranslationCheck {
  /** Numbers present in the source but missing from the translation. */
  missingNumbers: string[];
  /** Dosing schemes present in the source but missing. */
  missingDosing: string[];
  /** [FEHLT: ...] markers in the source vs the translation. */
  fehltDelta: number;
  /** Bullet count difference. */
  bulletDelta: number;
  ok: boolean;
}

const NUMBER_RE = /\d+(?:[.,]\d+)?\s*(?:%|mg|g|ml|cm|mm|mmHg|mg\/dl|kg|Watt)?/gi;
const DOSING_RE = /\b\d(?:\s*-\s*\d){2,3}\b/g;

export function checkTranslation(source: string, translated: string): TranslationCheck {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  const srcNums = [...source.matchAll(NUMBER_RE)].map((m) => norm(m[0])).filter(Boolean);
  const outNums = new Set([...translated.matchAll(NUMBER_RE)].map((m) => norm(m[0])));
  const missingNumbers = [...new Set(srcNums.filter((n) => !outNums.has(n)))];

  const srcDose = [...source.matchAll(DOSING_RE)].map((m) => norm(m[0]));
  const outDose = new Set([...translated.matchAll(DOSING_RE)].map((m) => norm(m[0])));
  const missingDosing = [...new Set(srcDose.filter((d) => !outDose.has(d)))];

  const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
  const fehltDelta = count(source, /\[FEHLT:/gi) - count(translated, /\[FEHLT:/gi);
  const bulletDelta = count(source, /^\s*-\s+/gm) - count(translated, /^\s*-\s+/gm);

  return {
    missingNumbers,
    missingDosing,
    fehltDelta,
    bulletDelta,
    ok:
      missingNumbers.length === 0 &&
      missingDosing.length === 0 &&
      fehltDelta === 0 &&
      bulletDelta === 0,
  };
}
