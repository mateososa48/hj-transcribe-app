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
  GESPRAECH_SECTIONS,
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../prompts/gespraech.ts';
import { extractFehltMarkers } from '../prompts/beurteilung.ts';
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
    // "Nehmen Sie Medikamente? Nein, gar keine."
    must: [/^\s*Keine\s*$/im],
    mustNot: [/\d/],
  },
  'G3-unsauber': {
    must: [/\bMetoprolol 50\b/, /\bTorasemid 10\b/, /\bXarelto 20\b/, /\bSimvastatin 40\b/, /\bMetformin 1000\b/],
    // Atorvastatin was a misrecognition the speaker corrected away; 95 was a
    // dose the speaker corrected away. Either surviving is a fabrication.
    mustNot: [/Atorvastatin/i, /\b95\b/],
  },
};

/** Properties a section must have, judged mechanically. */
function check(s: Record<string, string>, fixture?: string) {
  const flags: string[] = [];
  const all = Object.values(s).join('\n');

  // Diagnosen is a list; Anamnese is prose. Swapping them is the classic failure.
  if (s.diagnosen && !/^\s*-/m.test(s.diagnosen)) flags.push('DIAG_NOT_LIST');
  if (s.anamnese && /^\s*-\s/m.test(s.anamnese)) flags.push('ANAM_IS_LIST');

  // Medication: bare strength, no unit, tab before the scheme.
  const medLines = (s.medikation ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\[FEHLT/i.test(l) && l.toLowerCase() !== 'keine');
  if (medLines.some((l) => /\b\d+\s*(mg|milligramm|g|µg|ml|IE)\b/i.test(l))) flags.push('MED_HAS_UNIT');
  if (medLines.length && !medLines.every((l) => /\t/.test(l))) flags.push('MED_NO_TAB');
  // A dosing scheme must survive as a scheme, never collapse into a number.
  const schemeOf = (l: string) => (l.includes('\t') ? l.slice(l.indexOf('\t') + 1) : '');
  if (medLines.some((l) => /\b[01]{3}\b/.test(schemeOf(l)))) flags.push('MED_SCHEME_COLLAPSED');

  // Machine measurements must not appear — they happen after the conversation.
  if (/\b(EF|LVEF|Ejektionsfraktion|TAPSE)\b|\bmmHg\b/i.test(all)) flags.push('MACHINE_VALUES');

  // No commentary about the recording, and no summary/recommendation.
  if (/(Gespräch|Aufnahme|Diktat)[^.\n]{0,60}(nicht verwertbar|enthält keine)/i.test(all)) flags.push('BANNER');
  if (/\b(empfehle|empfiehlt sich|sollte.{0,20}erfolgen|Kontrolle in \d)/i.test(all)) flags.push('RECOMMENDS');

  const markers = extractFehltMarkers(all);
  const longest = Math.max(0, ...markers.map((m) => m.split(/\s+/).length));
  if (longest > 8) flags.push(`MARKER_${longest}w`);

  const missing = GESPRAECH_SECTIONS.filter((k) => !s[k]?.trim());
  if (missing.length) flags.push(`EMPTY:${missing.join('+')}`);

  const expected = fixture ? EXPECTED_MEDS[fixture] : undefined;
  if (expected) {
    const med = s.medikation ?? '';
    const absent = expected.must.filter((re) => !re.test(med));
    const forbidden = expected.mustNot.filter((re) => re.test(med));
    if (absent.length) flags.push(`MED_MISSING:${absent.length}`);
    if (forbidden.length) flags.push('MED_FABRICATED');
  }

  return { flags, markers: markers.length, longest };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.txt')).sort();
console.log(`PROMPT_VERSION ${PROMPT_VERSION} — ${RUNS} run(s) per fixture\n`);

for (const file of files) {
  const src = readFileSync(`${DIR}/${file}`, 'utf8');
  for (let i = 0; i < RUNS; i++) {
    try {
      const { sections, wellFormed } = await run(src);
      const { flags, markers, longest } = check(sections, file.replace('.txt', ''));
      console.log(
        `${file.replace('.txt', '').padEnd(22)} run${i + 1}  ${wellFormed ? 'tagged  ' : 'UNTAGGED'}  ` +
          `d:${String(sections.diagnosen.length).padStart(4)} a:${String(sections.anamnese.length).padStart(4)} ` +
          `m:${String(sections.medikation.length).padStart(4)}  markers:${markers}/${longest}w  ` +
          `${flags.length ? '⚠ ' + flags.join(',') : 'clean'}`,
      );
      if (VERBOSE) {
        for (const k of GESPRAECH_SECTIONS) {
          console.log(`\n  ── ${k} ──\n${sections[k].split('\n').map((l) => '  ' + l).join('\n')}`);
        }
        console.log();
      }
    } catch (error) {
      console.log(`${file.padEnd(22)} run${i + 1}  ERROR ${String(error).slice(0, 120)}`);
    }
  }
}
