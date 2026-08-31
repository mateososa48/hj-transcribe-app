/**
 * Live battery for the consultation feature.
 *
 * NOT part of `npm test` — it costs money and hits the network. Run it several
 * times; the failure modes here are non-deterministic and one run proves
 * nothing.
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx eval/gespraech-battery.mts eval/probe-gespraech 2
 *
 * The three fixtures are synthetic and cover what his sessions actually look
 * like: a follow-up with a known history and a full medication list, a first
 * visit with no medication at all, and a messy one with a spouse interrupting,
 * a corrected dose, a corrected year and a misrecognised drug name.
 */
import { readFileSync, readdirSync } from 'node:fs';

import {
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../prompts/gespraech.ts';
import { PROMPT_VERSION } from '../prompts/rules.ts';
import { DEFAULT_GATEWAY_MODEL } from '../src/lib/providers/gateway-draft.ts';

const DIR = process.argv[2] ?? 'eval/probe-gespraech';
const RUNS = Number(process.argv[3] ?? 2);
const VERBOSE = process.argv.includes('--print');
const key = process.env.AI_GATEWAY_API_KEY;
if (!key) throw new Error('AI_GATEWAY_API_KEY missing — set -a; . ./.env.local; set +a');

// GUIDE=<file> swaps in a candidate section guide, so competing versions can be
// measured against the same fixtures without touching prompts/gespraech.ts.
const guideFile = process.env.GUIDE;
const system = guideFile
  ? buildGespraechSystemPrompt([], readFileSync(guideFile, 'utf8'))
  : buildGespraechSystemPrompt([]);
if (guideFile) console.log(`(guide override: ${guideFile})`);

async function run(transcript: string) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DEFAULT_GATEWAY_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildGespraechUserPrompt({ transcript }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseGespraech(json.choices?.[0]?.message?.content ?? '');
}

/**
 * What each fixture's medication list must and must not contain.
 *
 * Added 2026-08-23 after an adversarial pass found the battery reporting
 * "clean" on a run that listed BOTH Atorvastatin 40 and Simvastatin 40 as
 * concurrent therapy — G3 corrects the first into the second, so printing both
 * invents a drug the patient does not take. The form checks below could never
 * have seen it: they validate the shape of the lines that are there and say
 * nothing about which drugs should be there at all.
 *
 * A drug that vanishes is equally invisible to a shape check, so both
 * directions are pinned.
 */
const EXPECTED_MEDS: Record<string, { must: RegExp[]; mustNot: RegExp[] }> = {
  'G1-verlaufskontrolle': {
    must: [/\bASS 100\b/, /\bClopidogrel 75\b/, /\bBisoprolol 5\b/, /\bRamipril 5\b/, /\bAtorvastatin 40\b/],
    mustNot: [],
  },
  'G2-erstvorstellung': {
    // "Nehmen Sie Medikamente? Nein, gar keine." — the notes must SAY she
    // takes none. Written section-agnostically: the sections are the
    // conversation's own now, and the old rule (the medication block must be
    // exactly the word "Keine") only made sense when there was one.
    must: [/kein[e]?\s+(Dauer)?medikation|keine\s+Medikamente|Medikamente[^\n]{0,12}keine/i],
    // She takes nothing, so ANY drug line is invention. The old rule banned
    // every digit in the medication block; applied to notes that also carry
    // her age, height and weight, that flagged the truth as a fabrication.
    mustNot: [/^[^\n\t]{2,40}\t\s*\d[-\d]/m, /\b\d-\d-\d\b/],
  },
  'G3-unsauber': {
    must: [/\bMetoprolol 50\b/, /\bTorasemid 10\b/, /\bXarelto 20\b/, /\bSimvastatin 40\b/, /\bMetformin 1000\b/],
    // Atorvastatin was a misrecognition the speaker corrected away; 95 was a
    // dose the speaker corrected away. Either surviving is a fabrication.
    mustNot: [/Atorvastatin/i, /\b95\b/],
  },
};

/**
 * Properties the notes must have, judged mechanically.
 *
 * The sections are the conversation's own now, so nothing here may name one.
 * What is checked is the FORM — bullets, medication shape, no invented
 * measurements, no placeholders — across whatever sections came back.
 */
function check(s: Record<string, string>, fixture?: string) {
  const flags: string[] = [];
  const all = Object.values(s).join('\n');
  const bodies = Object.values(s).filter((t) => t.trim());

  // Bullets are the default form. Prose is allowed for a section or two (an
  // Anamnese told as a story, a run of negations) — a majority in prose is not.
  const listy = bodies.filter((t) => /^\s*[-•]/m.test(t)).length;
  if (bodies.length >= 2 && listy * 2 < bodies.length) flags.push('MOSTLY_PROSE');

  // A section that came back with a heading and nothing under it.
  if (Object.values(s).some((t) => !t.trim())) flags.push('EMPTY_SECTION');

  // Medication, wherever it landed: bare strength, no unit, tab before scheme.
  const medLines = all
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\t/.test(l) || /\b\d+\s*(mg|milligramm|µg|IE)\b/i.test(l));
  if (medLines.some((l) => /\b\d+\s*(mg|milligramm|g|µg|ml|IE)\b/i.test(l))) flags.push('MED_HAS_UNIT');
  if (medLines.some((l) => !/\t/.test(l) && /\d-\d(-\d)?/.test(l))) flags.push('MED_NO_TAB');
  const schemeOf = (l: string) => (l.includes('\t') ? l.slice(l.indexOf('\t') + 1) : '');
  if (medLines.some((l) => /\b[01]{3}\b/.test(schemeOf(l)))) flags.push('MED_SCHEME_COLLAPSED');

  // Machine measurements must not appear — they happen after the conversation.
  if (/\b(EF|LVEF|Ejektionsfraktion|TAPSE)\b|\bmmHg\b/i.test(all)) flags.push('MACHINE_VALUES');

  // No commentary about the recording, and no recommendation of its own.
  if (/(Gespräch|Aufnahme|Diktat)[^.\n]{0,60}(nicht verwertbar|enthält keine)/i.test(all)) flags.push('BANNER');
  if (/(empfehle|empfiehlt sich|sollte.{0,20}erfolgen)/i.test(all)) flags.push('RECOMMENDS');

  // The thing he complained about: a gap written down as a gap. Any bracketed
  // note about something missing, unclear or not said is a relic.
  if (/\[FEHLT/i.test(all)) flags.push('MARKER_RELIC');
  if (/\[[^\]\n]{0,60}(fehlt|unklar|unverständlich|nicht genannt|nicht erwähnt|keine Angabe)[^\]\n]{0,60}\]/i.test(all)) {
    flags.push('PLACEHOLDER');
  }
  if (/(nicht|keine)\s+(genannt|erwähnt|besprochen|angegeben)\b/i.test(all)) flags.push('ABSENCE_REPORTED');

  // The course of the conversation is not a note. "Anschließend Besprechung des
  // Weiteren" is the doctor saying "then we'll talk" — it carries nothing.
  if (/Besprechung des Weiteren|anschließend.{0,20}besprech|bis gleich|kommen Sie herein|setzen Sie sich|sehen uns (nachher|gleich)/i.test(all)) {
    flags.push('SMALLTALK');
  }

  const expected = fixture ? EXPECTED_MEDS[fixture] : undefined;
  if (expected) {
    const absent = expected.must.filter((re) => !re.test(all));
    const forbidden = expected.mustNot.filter((re) => re.test(all));
    if (absent.length) flags.push(`MED_MISSING:${absent.length}`);
    if (forbidden.length) flags.push('MED_FABRICATED');
  }

  return { flags };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.txt')).sort();
console.log(`PROMPT_VERSION ${PROMPT_VERSION} — ${RUNS} run(s) per fixture\n`);

for (const file of files) {
  const src = readFileSync(`${DIR}/${file}`, 'utf8');
  for (let i = 0; i < RUNS; i++) {
    try {
      const { sections, order, labels, wellFormed } = await run(src);
      const { flags } = check(sections, file.replace('.txt', ''));
      const chars = Object.values(sections).join('').length;
      console.log(
        `${file.replace('.txt', '').padEnd(22)} run${i + 1}  ${wellFormed ? 'tagged  ' : 'UNTAGGED'}  ` +
          `${String(order.length).padStart(2)} Abschnitte  ${String(chars).padStart(5)} Zeichen  ` +
          `${flags.length ? '⚠ ' + flags.join(',') : 'clean'}`,
      );
      console.log(`${' '.repeat(24)}${order.map((k) => labels[k] ?? k).join(' · ')}`);
      if (VERBOSE) {
        for (const k of order) {
          console.log(`\n  ── ${labels[k] ?? k} ──\n${(sections[k] ?? '').split('\n').map((l) => '  ' + l).join('\n')}`);
        }
        console.log();
      }
    } catch (error) {
      console.log(`${file.padEnd(22)} run${i + 1}  ERROR ${String(error).slice(0, 120)}`);
    }
  }
}
