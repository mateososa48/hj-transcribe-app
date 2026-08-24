/**
 * The medication quarantine, measured over many runs.
 *
 * NOT part of `npm test` — costs money, hits the network.
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx eval/med-quarantine.mts 10
 *
 * Two opposite failures, both of which have actually happened:
 *
 *  - ASSERTING garbage. The A-dialog fixture contains "400 mg Cholesterin,
 *    400 mg Advil und Proposteron, alle zwei Stunden" — not a prescription in
 *    any sense. On 2026-08-17 gpt-5.6-terra wrote it into the letter as a real
 *    one, 2 of 10 runs. Rule 3 was extended to stop that.
 *  - DROPPING a real drug. That extension then over-fired: on 2026-08-23 the
 *    G3 statin, which the speaker corrects from Atorvastatin to Simvastatin,
 *    was replaced by a "nicht verwertbar" marker 1 of 8 runs. Rule 3 now says
 *    to apply the correction FIRST and only then judge writability.
 *
 * Both directions are checked here because fixing either one alone is what
 * caused the other. Repeats matter: the 2/10 failure showed 0/6 on a smaller
 * sample and was very nearly shipped.
 */
import { readFileSync } from 'node:fs';

import {
  buildStableSystemPrompt,
  buildUserPrompt,
  parseBeurteilung,
} from '../prompts/beurteilung.ts';
import {
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../prompts/gespraech.ts';
import { DEV_BEURTEILUNG_EXAMPLES } from '../prompts/examples/dev/index.ts';
import { DEFAULT_GATEWAY_MODEL } from '../src/lib/providers/gateway-draft.ts';
import { PROMPT_VERSION } from '../prompts/rules.ts';

const key = process.env.AI_GATEWAY_API_KEY;
if (!key) throw new Error('AI_GATEWAY_API_KEY missing — set -a; . ./.env.local; set +a');
const N = Number(process.argv[2] ?? 8);

async function ask(system: string, user: string): Promise<string> {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DEFAULT_GATEWAY_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? '';
}

console.log(`PROMPT_VERSION ${PROMPT_VERSION} on ${DEFAULT_GATEWAY_MODEL} — ${N} runs each\n`);

// 1. Garbage must never be asserted as therapy.
const dialog = readFileSync('eval/probe/A-dialog.txt', 'utf8');
const beurtSystem = buildStableSystemPrompt(DEV_BEURTEILUNG_EXAMPLES, []);
let asserted = 0;
const a = await Promise.all(
  Array.from({ length: N }, () =>
    ask(beurtSystem, buildUserPrompt({ transcript: dialog })).then((r) => parseBeurteilung(r).text),
  ),
);
a.forEach((text, i) => {
  const offending = text
    .split('\n')
    .filter((l) => /(Advil|Proposteron|400\s*mg)/i.test(l))
    .filter((l) => !/\[FEHLT[^\]]*\]/i.test(l) && !/nicht verwertbar|nicht nachvollziehbar|nicht plausib/i.test(l));
  if (offending.length) {
    asserted++;
    console.log(`assert run${i + 1} ✗ ${offending[0]!.trim().slice(0, 150)}`);
  }
});
console.log(`garbage asserted as therapy: ${asserted}/${N}\n`);

// 2. A corrected-but-real drug must never be dropped.
const messy = readFileSync('eval/probe-gespraech/G3-unsauber.txt', 'utf8');
const gespSystem = buildGespraechSystemPrompt([]);
const MUST = [/\bMetoprolol 50\b/, /\bTorasemid 10\b/, /\bXarelto 20\b/, /\bSimvastatin 40\b/, /\bMetformin 1000\b/];
let broken = 0;
const g = await Promise.all(
  Array.from({ length: N }, () =>
    ask(gespSystem, buildGespraechUserPrompt({ transcript: messy })).then(
      (r) => parseGespraech(r).sections.medikation ?? '',
    ),
  ),
);
g.forEach((med, i) => {
  const missing = MUST.filter((re) => !re.test(med));
  // Atorvastatin was corrected away; printing it invents a drug he does not take.
  const invented = /Atorvastatin/i.test(med);
  if (missing.length || invented) {
    broken++;
    console.log(`drop   run${i + 1} ✗ ${missing.length ? `missing ${missing.length}` : ''}${invented ? ' Atorvastatin present' : ''}`);
  }
});
console.log(`medication lists wrong: ${broken}/${N}`);

if (asserted > 0 || broken > 0) process.exitCode = 1;
