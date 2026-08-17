/**
 * Live drafting battery — runs the real prompt against real inputs.
 *
 * NOT part of `npm test`: every run costs money and hits the network. This is
 * the harness for prompt work, because the failure mode being tested for is
 * non-deterministic and a single run proves nothing. Run it several times.
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx eval/draft-battery.mts eval/probe 3
 *
 * The probe inputs in eval/probe/ map the boundary the prompt has to hold:
 * A a messy two-person conversation, B anamnesis only, C findings only,
 * D an ordinary dictation, E genuinely contentless small talk. Everything
 * except E must produce a letter; E must refuse, in one contracted line.
 * A-dialog is a SYNTHETIC re-creation of the recording that exposed this on
 * 2026-08-16 — the original is a real conversation about a real child and is
 * not in the repo.
 */
import { readFileSync } from 'node:fs';
import { buildStableSystemPrompt, buildUserPrompt, parseBeurteilung, extractFehltMarkers, hasReleasableContent }
  from '../prompts/beurteilung.ts';
import { DEV_BEURTEILUNG_EXAMPLES } from '../prompts/examples/dev/index.ts';
import { PROMPT_VERSION } from '../prompts/rules.ts';

const DIR = process.argv[2]!;
const RUNS = Number(process.argv[3] ?? 3);
const key = process.env.AI_GATEWAY_API_KEY!;
const system = buildStableSystemPrompt(DEV_BEURTEILUNG_EXAMPLES, []);

async function draft(transcript: string) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'anthropic/claude-opus-5', max_tokens: 4000,
      messages: [{ role: 'system', content: system }, { role: 'user', content: buildUserPrompt({ transcript }) }] }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const j: any = await res.json();
  return parseBeurteilung(j.choices?.[0]?.message?.content ?? '');
}

// Phrases that judge the recording as a whole — rule 8c forbids these.
// Only words that MUST carry ß. A blanket /ss/ matches "gegessen" and
// "müssen" and cries wolf on every draft.
const SWISS = /\b(ausserdem|einschliesslich|schliesslich|gr[oö]sse[rn]?|gross|bloss|heisst|weiss|strasse|fuss|spass|gem[aä]ss|s[uü]ss|masse)\b/i;

// The doctor ASKED about dizziness and abdominal pain and never got a spoken no.
// Only an asserted denial is invented; "nicht angegeben" is faithful reporting.
const INVENTED_NEG = /(schwindel|bauchweh|bauchschmerz)[^.;]{0,60}\b(verneint|bestehen nicht|besteht nicht)\b/i;

const BANNER = /(diktat|aufnahme)[^.\]]{0,80}(nicht verwertbar|überwiegend|weitgehend|kein ärztliches)|enthält (überwiegend|weitgehend|keine auswertbaren)/i;

const CASES = ['A-dialog', 'B-anamnese-only', 'C-befund-only', 'D-normal', 'E-garbage'];
console.log(`PROMPT_VERSION ${PROMPT_VERSION} — ${RUNS} runs per case\n`);

for (const name of CASES) {
  const src = readFileSync(`${DIR}/${name}.txt`, 'utf8');
  const rows = await Promise.all(Array.from({ length: RUNS }, () => draft(src).catch((e) => ({ text: `ERR ${e}`, wellFormed: false }))));
  for (const [i, r] of rows.entries()) {
    const markers = extractFehltMarkers(r.text);
    const longest = Math.max(0, ...markers.map((m) => m.split(/\s+/).length));
    const releasable = hasReleasableContent(r.text);
    const flags: string[] = [];
    if (BANNER.test(r.text)) flags.push('BANNER');
    if (longest > 8) flags.push(`MARKER_${longest}w`);
    if (SWISS.test(r.text)) flags.push('SWISS_SS');
    if (name === 'A-dialog') {
      if (/Hypercholesterinämie|Myokardinfarkt/i.test(r.text)) flags.push('COINED_DX');
      if (INVENTED_NEG.test(r.text)) flags.push('INVENTED_NEG');
      if (!/32/.test(r.text) || !/34/.test(r.text)) flags.push('WEIGHT_DROPPED');
      if (/(Advil|Proposteron|400\s*mg)/i.test(r.text) && !markers.some((m) => /Medikation|Präparat|Therapie/i.test(m))) flags.push('MED_ASSERTED');
      if (!/nie|verneint|nicht/i.test(r.text)) flags.push('NEGATION_LOST');
    }
    console.log(
      `${name.padEnd(17)} run${i + 1}  ${releasable ? 'releasable' : 'BLOCKED   '}  ${r.wellFormed ? 'tagged  ' : 'UNTAGGED'}  ` +
      `markers:${String(markers.length).padStart(2)} longest:${String(longest).padStart(2)}w  ` +
      `chars:${String(r.text.length).padStart(4)}  ${flags.length ? '⚠ ' + flags.join(',') : 'clean'}`,
    );
  }
}
