/**
 * Live battery for the Bericht section-dictation prompt — the same contract
 * the Beurteilung batteries hold, plus what is new here: the spoken section
 * announcement must become a normalized heading and must NEVER leak into the
 * text.
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx eval/abschnitt-battery.mts 2
 */
import {
  buildAbschnittSystemPrompt,
  buildAbschnittUserPrompt,
  parseAbschnitt,
} from '../prompts/abschnitt.ts';
import { ABSCHNITT_PROMPT_VERSION } from '../prompts/abschnitt.ts';
import { DEFAULT_GATEWAY_MODEL } from '../src/lib/providers/gateway-draft.ts';

const RUNS = Number(process.argv[2] ?? 2);
const key = process.env.AI_GATEWAY_API_KEY!;
const system = buildAbschnittSystemPrompt([]);

async function draft(transcript: string) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DEFAULT_GATEWAY_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildAbschnittUserPrompt({ transcript }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseAbschnitt(j.choices?.[0]?.message?.content ?? '');
}

interface Case {
  name: string;
  transcript: string;
  check: (r: { heading: string | null; text: string }) => string[];
}

const CASES: Case[] = [
  {
    name: 'normalize-beurteilung',
    transcript:
      'Dieser Abschnitt ist die Beurteilung. Bezüglich der koronaren Herzkrankheit ist der Patient beschwerdefrei. Eine Angina pectoris wird verneint.',
    check: (r) => {
      const f: string[] = [];
      if (r.heading !== 'Zusammenfassende Beurteilung') f.push(`HEADING:${r.heading}`);
      if (/dieser abschnitt/i.test(r.text)) f.push('ANNOUNCEMENT_LEAKED');
      if (!/verneint/i.test(r.text)) f.push('NEGATION_DROPPED');
      return f;
    },
  },
  {
    name: 'normalize-therapie',
    transcript:
      'Abschnitt Medikation. ASS hundert eins null null. Bisoprolol fünf Milligramm eins null null.',
    check: (r) => {
      const f: string[] = [];
      if (r.heading !== 'Aktuelle Therapie') f.push(`HEADING:${r.heading}`);
      if (!/1-0-0/.test(r.text)) f.push('SCHEME_BROKEN');
      return f;
    },
  },
  {
    name: 'free-title-kept',
    transcript:
      'Überschrift Analyse. Die Belastbarkeit ist gegenüber dem Vorjahr unverändert gut.',
    check: (r) => (r.heading === 'Analyse' ? [] : [`HEADING:${r.heading}`]),
  },
  {
    name: 'no-announcement',
    transcript: 'Der Blutdruck lag heute bei 140 zu 90, im Verlauf stabil.',
    check: (r) => {
      const f: string[] = [];
      if (r.heading !== null) f.push(`SPURIOUS_HEADING:${r.heading}`);
      if (!/140/.test(r.text)) f.push('VALUE_DROPPED');
      return f;
    },
  },
  {
    name: 'garbage-med-quarantined',
    transcript:
      'Abschnitt Therapie. Der Patient nimmt äh dieses äh Advil vierhundert glaube ich, nein, vergessen Sie das. Bisoprolol fünf eins null null.',
    check: (r) => {
      const f: string[] = [];
      // Rule 3: a retracted, unusable drug mention must not be asserted.
      if (/advil[^.\n]{0,40}(verordnet|eingenommen|nimmt|1-0-0|400)/i.test(r.text))
        f.push('GARBAGE_MED_ASSERTED');
      if (!/bisoprolol 5\b/i.test(r.text)) f.push('REAL_MED_DROPPED');
      return f;
    },
  },
];

console.log(`ABSCHNITT ${ABSCHNITT_PROMPT_VERSION} — ${RUNS} runs per case\n`);
let failures = 0;
for (const c of CASES) {
  const rows = await Promise.all(
    Array.from({ length: RUNS }, () =>
      draft(c.transcript).catch((e) => ({ heading: null, text: `ERR ${e}`, wellFormed: false })),
    ),
  );
  for (const [i, r] of rows.entries()) {
    const flags = /^ERR/.test(r.text) ? [r.text] : c.check(r);
    failures += flags.length;
    console.log(
      `${c.name} #${i + 1}: ${flags.length ? '✗ ' + flags.join(', ') : '✓'}  [${r.heading ?? '—'}]`,
    );
  }
}
console.log(`\n${failures === 0 ? 'ALL CLEAR' : `${failures} FLAG(S)`}`);
process.exit(failures === 0 ? 0 : 1);
