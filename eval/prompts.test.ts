/**
 * Prompt contract and parsing.
 *
 * Two classes of guarantee are tested here:
 *
 *  - PARSING: the model's output must survive the trip into the editor, and a
 *    malformed response must degrade to editable text rather than an exception.
 *  - CONTENT: the safety rules must actually be in the prompt. Rules 1-4 are
 *    not style preferences — dropping rule 1 invents facts, dropping rule 2
 *    flips negations, dropping rule 4 walks the product into MDR territory. A
 *    careless edit to rules.ts should fail a test, not ship.
 *
 *   npx tsx --test eval/prompts.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BEURTEILUNG_TAG,
  buildStableSystemPrompt,
  buildUserPrompt,
  extractFehltMarkers,
  parseBeurteilung,
} from '../prompts/beurteilung.ts';
import { DEV_BEURTEILUNG_EXAMPLES } from '../prompts/examples/dev/index.ts';
import { CORE_RULES } from '../prompts/rules.ts';

const GLOSSARY = ['Bisoprolol', 'NSTEMI'];
const stable = () => buildStableSystemPrompt(DEV_BEURTEILUNG_EXAMPLES, GLOSSARY);

// ---------------------------------------------------------------- parsing ---

test('extracts the section from a well-formed response', () => {
  const raw = `Hier ist der Entwurf:\n<${BEURTEILUNG_TAG}>\n- Erster Punkt\n- Zweiter Punkt\n</${BEURTEILUNG_TAG}>\nEnde.`;
  const { text, wellFormed } = parseBeurteilung(raw);
  assert.equal(wellFormed, true);
  assert.equal(text, '- Erster Punkt\n- Zweiter Punkt');
  assert.ok(!text.includes('Hier ist der Entwurf'), 'preamble must be stripped');
});

test('an unclosed tag still yields usable text, flagged as malformed', () => {
  const raw = `<${BEURTEILUNG_TAG}>\n- Ein Punkt, abgeschnitten`;
  const { text, wellFormed } = parseBeurteilung(raw);
  assert.equal(wellFormed, false);
  assert.equal(text, '- Ein Punkt, abgeschnitten');
});

test('no tag at all falls back to the whole response rather than throwing', () => {
  // Losing a usable draft to a strict parser would be worse than the mis-format.
  const { text, wellFormed } = parseBeurteilung('- Ein Punkt ohne Tags');
  assert.equal(wellFormed, false);
  assert.equal(text, '- Ein Punkt ohne Tags');
});

test('German content survives parsing byte-for-byte', () => {
  const body = '- LVEF 55 %, LVEDD 4,7 cm, keine Angina pectoris, Bisoprolol 5 mg 1-0-0';
  const { text } = parseBeurteilung(`<${BEURTEILUNG_TAG}>${body}</${BEURTEILUNG_TAG}>`);
  assert.equal(text, body);
  assert.ok(text.includes('4,7 cm'), 'decimal comma must survive');
  assert.ok(text.includes('keine Angina pectoris'), 'negation must survive');
  assert.ok(text.includes('1-0-0'), 'dosing scheme must survive');
});

// ------------------------------------------------------------ [FEHLT] --------

test('finds every [FEHLT: …] marker', () => {
  const text =
    '- Ein Punkt\n- [FEHLT: LVEF nicht erhoben]\n- Noch einer\n- [FEHLT: Geburtsdatum]';
  assert.deepEqual(extractFehltMarkers(text), ['LVEF nicht erhoben', 'Geburtsdatum']);
});

test('reports no markers when the draft is complete', () => {
  assert.deepEqual(extractFehltMarkers('- Alles vollständig'), []);
});

// ------------------------------------------------------- prompt contents ----

test('the core safety rules are present in the system prompt', () => {
  const prompt = stable();
  const required: Array<[string, string]> = [
    ['never invent', 'NIEMALS ETWAS ERFINDEN'],
    ['[FEHLT] instruction', '[FEHLT:'],
    ['negations preserved', 'NEGATIONEN BLEIBEN WÖRTLICH ERHALTEN'],
    ['values unchanged', 'ZAHLEN, EINHEITEN UND MEDIKAMENTE UNVERÄNDERT'],
    ['no diagnoses / codes (MDR)', 'KEINE DIAGNOSEN UND KEINE CODES'],
    ['decimal comma', '4,7 cm'],
    ['dosing scheme', '1-0-0'],
  ];
  for (const [label, needle] of required) {
    assert.ok(prompt.includes(needle), `system prompt lost its "${label}" rule`);
  }
});

test('the ICD/GOÄ prohibition is explicit', () => {
  // This one keeps the product outside medical-device classification.
  assert.match(CORE_RULES, /ICD-\s*oder\s*GOÄ-Codes/);
});

test('the rules cover the failure that shipped on 2026-08-16', () => {
  // A recorded conversation produced a whole-draft refusal instead of a letter,
  // and the refusal arrived as a paragraph inside a [FEHLT: …] marker — the only
  // channel the prompt gave the model for addressing the doctor. Each of these
  // is load-bearing; deleting one brings the behaviour back.
  assert.match(CORE_RULES, /Gespräch mit\s*\n?\s*dem Patienten/, 'a conversation must be a legitimate source');
  assert.match(CORE_RULES, /Eine\s*\n?\s*Frage des Arztes ist für sich keine Angabe/, 'a question is not a datum');
  assert.match(CORE_RULES, /niemals "Schwindel wird\s*\n?\s*verneint"/, 'no negation may be read off an unanswered question');
  assert.match(CORE_RULES, /Höchstens acht Wörter/, 'markers must stay short');
  assert.match(CORE_RULES, /kein\s*\n?\s*Kommentarfeld/, 'a marker is not a comment field');
  assert.match(CORE_RULES, /EINE EINZIGE VERWERTBARE ANGABE GENÜGT/, 'partial input still gets a letter');
  assert.match(CORE_RULES, /kein verwertbares Diktat, bitte neu aufnehmen/, 'refusal has one fixed shape');

  // 2026-08-17: gpt-5.6-terra silently resolved a wife-vs-patient disagreement
  // 6/6 times because rule 8a's self-correction clause did not say WHOSE
  // correction. Naming the speaker took it to 6/6 carried. Opus never hit this,
  // so the ambiguity was invisible until the model changed.
  assert.match(CORE_RULES, /Selbstkorrektur ist eine Korrektur DERSELBEN Person/);
  assert.match(CORE_RULES, /Widerspricht dagegen eine ANDERE Person/);
  assert.match(CORE_RULES, /Wer zuletzt gesprochen hat, entscheidet nichts/);

  // Same session: terra wrote "400 mg Cholesterin ... verordnet" into the
  // letter 2/10 times. Rule 3 covered an INCOMPLETE scheme but not a medication
  // that has no writable form at all. Framed as a format test, not a clinical
  // one, so the model is never asked to judge whether a drug makes sense.
  assert.match(CORE_RULES, /nicht in die\s*\n?\s*übliche Form bringen lässt/);
  assert.match(CORE_RULES, /Formfrage, keine medizinische Beurteilung/);
  assert.match(CORE_RULES, /was unverwertbar erkannt wurde, wird markiert, nicht\s*\n?\s*berichtet/);
  // Rule 5 must forbid upgrading lay language into a diagnosis.
  assert.match(CORE_RULES, /"hohes Cholesterin" wird nicht "Hypercholesterinämie"/);
  // The prompt itself must not teach Swiss orthography.
  assert.doesNotMatch(CORE_RULES, /\bblosse\b|\bausserdem\b|\beinschliesslich\b/);
});

test('the output contract names the tag the parser looks for', () => {
  const prompt = stable();
  assert.ok(prompt.includes(`<${BEURTEILUNG_TAG}>`));
  assert.ok(prompt.includes(`</${BEURTEILUNG_TAG}>`));
});

test('the glossary reaches the prompt', () => {
  const prompt = stable();
  for (const term of GLOSSARY) assert.ok(prompt.includes(term), `glossary term ${term} missing`);
});

// ------------------------------------------------- caching / data hygiene ---

test('the cached half contains NO patient data', () => {
  // Load-bearing twice over: patient text in the cached prefix would both
  // invalidate the cache on every letter AND persist patient content into a
  // shared cache entry. The signature makes this structurally impossible —
  // this test stops anyone "helpfully" adding a transcript parameter.
  const transcript = 'Patient Mustermann, geboren am 01.01.1950, keine Angina pectoris.';
  const prompt = stable();
  assert.ok(!prompt.includes(transcript));
  assert.ok(!prompt.includes('Mustermann'));
  assert.ok(!prompt.includes('01.01.1950'));
});

test('the volatile half carries the transcript and the Vorbrief', () => {
  const user = buildUserPrompt({ transcript: 'DIKTAT-TEXT', vorbrief: 'VORBRIEF-TEXT' });
  assert.ok(user.includes('DIKTAT-TEXT'));
  assert.ok(user.includes('VORBRIEF-TEXT'));
});

test('the Vorbrief block is omitted entirely when there is none', () => {
  const user = buildUserPrompt({ transcript: 'NUR DIKTAT' });
  assert.ok(!user.includes('VORBRIEF'));
  assert.ok(user.includes('NUR DIKTAT'));
});

test('the Vorbrief is framed as context, never as a source to copy from', () => {
  const user = buildUserPrompt({ transcript: 'x', vorbrief: 'y' });
  assert.match(user, /übernehmen Sie daraus nichts/i);
});

test('the stable prompt is byte-identical across calls (cacheable)', () => {
  // Any nondeterminism here — a timestamp, an unsorted map — silently destroys
  // the cache hit rate and costs real money on every letter.
  assert.equal(stable(), stable());
});

test('the cached prefix is long enough to actually cache', () => {
  // Sonnet 5 will not create a cache entry below ~1024 tokens; a rough
  // 4-chars-per-token estimate keeps this honest without a tokenizer.
  const approxTokens = stable().length / 4;
  assert.ok(
    approxTokens > 1024,
    `stable prompt is only ~${Math.round(approxTokens)} tokens — below the cache minimum`,
  );
});
