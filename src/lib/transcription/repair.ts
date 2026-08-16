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

/** All repairs, in order. Safe to run more than once. */
export function repairTranscript(text: string): string {
  return repairCombinationDoses(repairPressureUnits(repairDosingSchemes(text)));
}
