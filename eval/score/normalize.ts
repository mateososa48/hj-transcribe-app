/**
 * German transcript normalisation for trap scoring.
 *
 * The problem this solves: an ASR provider may legitimately return
 * "achtundvierzig Millimeter", "48 Millimeter", or "48 mm" for the same speech.
 * All three are correct. Naive string matching would score two of them as
 * hallucinations and send us chasing a provider that is actually fine.
 *
 * So we normalise both the transcript and the expected form to a canonical
 * shape, then compare. The normaliser handles the MECHANICAL variation (case,
 * punctuation, number words, unit spellings). Genuine wording alternatives
 * ("1-0-0" vs "eins null null") belong in a fixture's `accept` array instead —
 * keeping the normaliser dumb keeps it trustworthy.
 */

const ONES = [
  'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
] as const;
/** Form used inside compounds: "einundzwanzig", not "einsundzwanzig". */
const ONES_COMPOUND = [
  '', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
] as const;
const TEENS = [
  'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn',
  'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn',
] as const;
const TENS: Record<number, string> = {
  20: 'zwanzig', 30: 'dreißig', 40: 'vierzig', 50: 'fünfzig',
  60: 'sechzig', 70: 'siebzig', 80: 'achtzig', 90: 'neunzig',
};

function germanNumberWord(n: number): string {
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    return ones === 0 ? TENS[tens]! : `${ONES_COMPOUND[ones]}und${TENS[tens]}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const head = `${hundreds === 1 ? 'ein' : ONES_COMPOUND[hundreds]}hundert`;
    return rest === 0 ? head : head + germanNumberWord(rest);
  }
  // Years matter: "März zweitausendfünfundzwanzig" must reach 03/2025.
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = `${thousands === 1 ? 'ein' : ONES_COMPOUND[thousands]}tausend`;
  return rest === 0 ? head : head + germanNumberWord(rest);
}

/**
 * Upper bound: covers every clinically plausible figure (doses, distances,
 * pressures) plus calendar years through 2100.
 */
const MAX_NUMBER = 2100;

const NUMBER_LOOKUP = new Map<string, string>();
for (let n = 0; n <= MAX_NUMBER; n++) NUMBER_LOOKUP.set(germanNumberWord(n), String(n));
// Standalone forms that differ from the compound form used above.
NUMBER_LOOKUP.set('eine', '1');
NUMBER_LOOKUP.set('ein', '1');
NUMBER_LOOKUP.set('hundert', '100');
NUMBER_LOOKUP.set('tausend', '1000');

/**
 * ONE alternation regex, longest-first, built once. Iterating thousands of
 * individual replacements would rebuild a RegExp per word per call — far too
 * slow to run inside a scoring loop. JS alternation is leftmost-first, so
 * longest-first ordering yields greedy longest match ("achtundvierzig" wins
 * over "acht").
 */
const NUMBER_RE = new RegExp(
  `\\b(${[...NUMBER_LOOKUP.keys()].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'g',
);

/**
 * Unit spellings -> canonical short form.
 * ORDER MATTERS: "millimeter" must be replaced before "meter", or "milli"
 * is left stranded. Longest-first is enforced by the sort below.
 */
const UNIT_PAIRS: Array<[string, string]> = [
  ['millimeter quecksilbersäule', 'mmhg'],
  ['milligramm pro deziliter', 'mg/dl'],
  ['schläge pro minute', '/min'],
  ['pro deziliter', '/dl'],
  ['pro minute', '/min'],
  ['quadratzentimeter', 'cm²'],
  ['millimeter', 'mm'],
  ['zentimeter', 'cm'],
  ['milligramm', 'mg'],
  ['mikrogramm', 'µg'],
  ['milliliter', 'ml'],
  ['deziliter', 'dl'],
  ['prozent', '%'],
  ['gramm', 'g'],
  ['meter', 'm'],
];

/** Longest-first, so "millimeter" is consumed before "meter". */
const UNITS = [...UNIT_PAIRS].sort((a, b) => b[0].length - a[0].length);

/** Sentinel standing in for a period inside an abbreviation, so that the
 *  sentence-period stripper cannot eat it. Never appears in real transcripts. */
const DOT = '';

export function normalizeGerman(input: string): string {
  // Unicode: normalise so "fünf" compares equal regardless of composition form.
  let s = input.normalize('NFC').toLowerCase();

  // Collapse whitespace FIRST. Multi-word units ("millimeter quecksilbersäule",
  // "milligramm pro deziliter") are matched with single-space patterns, so a
  // line break inside one would silently defeat the match. Real transcripts
  // wrap too — this is not just a fixture-formatting concern.
  s = s.replace(/\s+/g, ' ');

  // Protect dotted abbreviations (z.n., v.a., i.v., p.o., d.d.) BEFORE any
  // period stripping. Generic single-letter-dot-single-letter-dot pattern, so
  // this covers the whole family without an explicit list.
  s = s.replace(/\b([a-zäöüß])\.\s*([a-zäöüß])\./g, `$1${DOT}$2${DOT}`);

  // Strip punctuation that carries no meaning for trap matching. KEEP comma
  // (decimal separator), hyphen (dosing "1-0-0"), slash (blood pressure), and %.
  s = s.replace(/[?!;:()"„“»«]/g, ' ');

  // Sentence-final periods -> space. Abbreviations are already sentinel-protected.
  s = s.replace(/\.(?=\s|$)/g, ' ');

  // Number words -> digits. Must run BEFORE the "komma" decimal rule, which
  // needs digits on both sides ("vier komma sieben" -> "4 komma 7" -> "4,7").
  s = s.replace(NUMBER_RE, (w) => NUMBER_LOOKUP.get(w) ?? w);

  // Spoken punctuation (SPEC: "Punkt", "Komma" must be tolerated, never required).
  s = s.replace(/(\d)\s*komma\s*(\d)/g, '$1,$2');

  // Unit spellings -> canonical short forms.
  for (const [long, short] of UNITS) {
    s = s.replace(new RegExp(`\\b${long}\\b`, 'g'), short);
  }

  // Decimal separator: accept "4.7" or "4 , 7", canonicalise to "4,7".
  s = s.replace(/(\d)\s*[.,]\s*(\d)/g, '$1,$2');

  // Dosing scheme: "1 - 0 - 0" -> "1-0-0".
  s = s.replace(/(\d)\s*-\s*(\d)\s*-\s*(\d)/g, '$1-$2-$3');

  // Blood pressure: "140 / 90" -> "140/90".
  s = s.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');

  // Value+unit spacing. Two passes: alphabetic units take \b, symbol units
  // cannot (\b after "%" never matches). Longest alternatives first.
  s = s.replace(/(\d)\s+(mmhg|cm²|mm|cm|mg|ml|µg|g|m)\b/g, '$1$2');
  s = s.replace(/(\d)\s+(%|\/min)/g, '$1$2');

  // Restore abbreviation periods.
  s = s.replaceAll(DOT, '.');

  // Collapse whitespace.
  return s.replace(/\s+/g, ' ').trim();
}

/** True if `needle` (normalised) appears in `haystack` (normalised). */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  return normalizeGerman(haystack).includes(normalizeGerman(needle));
}
