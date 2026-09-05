import { DRUG_NAMES } from './keyterms.ts';

/**
 * Deterministic repairs applied to a raw transcript before it is stored.
 *
 * These are NOT stylistic tidying. Each one fixes a specific, reproducible way
 * the recogniser mangles clinical German in a way that changes meaning — the
 * class of error that must never reach a letter, and that a language model
 * should not be trusted to catch because it looks plausible either way.
 *
 * Every repair here is anchored on surrounding context so it cannot fire on
 * ordinary numbers. When in doubt, a repair does nothing.
 */

/**
 * Dosing schemes spoken as digits collapse into one number.
 *
 * Observed against AssemblyAI on 2026-08-16: "Bisoprolol fünf Milligramm eins
 * null null" comes back as `Bisoprolol 5 mg 100`, and "null null eins" as `001`.
 *
 * That is dangerous rather than merely untidy: `Bisoprolol 5 mg 100` reads as a
 * 100 mg dose. The scheme is worth repairing precisely because the wrong
 * reading is a plausible one.
 *
 * Anchor: the triple must directly follow a dose WITH ITS UNIT. That is what
 * distinguishes a scheme from a strength — in "ASS 100" the 100 is a strength
 * and there is no preceding unit, so it is left alone.
 */
export function repairDosingSchemes(text: string): string {
  return (
    text
      // "5 mg 100" -> "5 mg 1-0-0"   (three-slot scheme)
      .replace(
        /(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|µg|mcg|IE)\s+)([01])([01])([01])(?![\w-])/gi,
        (_m, dose: string, a: string, b: string, c: string) => `${dose}${a}-${b}-${c}`,
      )
      // "5 mg 1000" -> "5 mg 1-0-0-0" (four-slot scheme, e.g. with a night dose)
      .replace(
        /(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|µg|mcg|IE)\s+)([01])([01])([01])([01])(?![\w-])/gi,
        (_m, dose: string, a: string, b: string, c: string, d: string) =>
          `${dose}${a}-${b}-${c}-${d}`,
      )
  );
}

/**
 * "Millimeter Quecksilbersäule" is frequently half-abbreviated to
 * "mm Quecksilbersäule". Canonicalise to mmHg so a pressure never reads as a
 * length.
 */
export function repairPressureUnits(text: string): string {
  return text.replace(/\b(mm|Millimeter)\s+Quecksilbersäule\b/gi, 'mmHg');
}

/**
 * Combination-product strengths dictated as "97 zu 103" come back hyphenated
 * ("97-103"), which reads like a range. His letters use a slash.
 * Anchored on a following unit so ordinary ranges are untouched.
 */
export function repairCombinationDoses(text: string): string {
  return text.replace(/\b(\d{1,4})-(\d{1,4})(\s*(?:mg|µg|mcg|g)\b)/gi, '$1/$2$3');
}

/**
 * Dosing schemes anchored on the DRUG NAME rather than on a unit.
 *
 * `repairDosingSchemes` above needs a unit in front of the scheme, and says so
 * deliberately: in "ASS 100" the 100 is a strength, and without that anchor the
 * rule would fire on ordinary numbers. But a cardiologist dictating a
 * medication list rarely says the unit — "Valsartan 160 1-0-0", not "Valsartan
 * 160 Milligramm 1-0-0" — so the whole list falls outside it. The recogniser
 * then returns the scheme slash-separated, prompt rule 3 cannot bring the line
 * into Präparat + Stärke form, and it drops the drug entirely. On 2026-09-04
 * that removed ASS and Tebonin from a post-endarterectomy letter.
 *
 * The drug name is the only other reliable anchor in the sentence, so this
 * uses it. It normalises ONLY shapes with a single reading:
 *
 *   Valsartan 160/1/0/0     -> Valsartan 160 1-0-0    (strength, then 3 slots)
 *   Pantoprazol 40 1/0/0    -> Pantoprazol 40 1-0-0   (strength, space, slots)
 *   ASS 1/0/0               -> ASS 1-0-0              (slots only)
 *
 * A dose slot is at most one digit plus an optional half ("0", "1", "0,5"), so
 * a three-digit leading number cannot be one. That is what keeps the ambiguous
 * case out: "ASS 101/0/0" — where 101 is 100 and the first slot fused — has two
 * readings and is left exactly as dictated. Guessing 100 would be inventing a
 * dose, which is the one thing this pipeline must never do.
 */
const DOSE_SLOT = String.raw`\d(?:[.,]\d)?`;
const STRENGTH = String.raw`\d{1,4}(?:[.,]\d{1,2})?`;
/** Up to two words between the name and the numbers: "Tebonin Konzentrat 240". */
const QUALIFIER = String.raw`(?:\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*){0,2}`;

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Longest first, so "L-Thyroxin" is not shadowed by a shorter entry. */
const DRUG_ALTERNATION = [...DRUG_NAMES]
  .sort((a, b) => b.length - a.length)
  .map(escapeForRegex)
  .join('|');

const SCHEME_PATTERNS: RegExp[] = [
  // Strength fused into the run: "160/1/0/0" (and a four-slot variant).
  new RegExp(
    `\\b((?:${DRUG_ALTERNATION})${QUALIFIER})\\s+(${STRENGTH})/(${DOSE_SLOT})/(${DOSE_SLOT})/(${DOSE_SLOT})(/(${DOSE_SLOT}))?(?![\\w/-])`,
    'gi',
  ),
  // Strength separated: "40 1/0/0".
  new RegExp(
    `\\b((?:${DRUG_ALTERNATION})${QUALIFIER})\\s+(${STRENGTH})\\s+(${DOSE_SLOT})/(${DOSE_SLOT})/(${DOSE_SLOT})(/(${DOSE_SLOT}))?(?![\\w/-])`,
    'gi',
  ),
  // No strength at all: "ASS 1/0/0".
  new RegExp(
    `\\b((?:${DRUG_ALTERNATION})${QUALIFIER})\\s+()(${DOSE_SLOT})/(${DOSE_SLOT})/(${DOSE_SLOT})(/(${DOSE_SLOT}))?(?![\\w/-])`,
    'gi',
  ),
];

export function repairDrugDosing(text: string): string {
  let out = text;
  for (const pattern of SCHEME_PATTERNS) {
    out = out.replace(
      pattern,
      (_match, name: string, strength: string, a: string, b: string, c: string, _g6, d?: string) => {
        const scheme = [a, b, c, ...(d ? [d] : [])].join('-');
        return `${name}${strength ? ` ${strength}` : ''} ${scheme}`;
      },
    );
  }
  return out;
}

/**
 * All repairs, in order. Safe to run more than once.
 *
 * Drug-anchored dosing runs FIRST: it turns "Valsartan 160/1/0/0" into
 * "Valsartan 160 1-0-0", and the later unit-anchored rules then see a shape
 * they already understand instead of a slash run.
 */
export function repairTranscript(text: string): string {
  return repairCombinationDoses(
    repairPressureUnits(repairDosingSchemes(repairDrugDosing(text))),
  );
}
