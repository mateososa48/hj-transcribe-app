/**
 * Reproduce a Beurteilung draft outside the browser, against the real prompt.
 * Usage: tsx repro.ts <transcript-file> [label]
 */
import { readFileSync } from 'node:fs';
import { buildStableSystemPrompt, buildUserPrompt, parseBeurteilung }
  from '../prompts/beurteilung.ts';
import { DEFAULT_GATEWAY_MODEL } from '../src/lib/providers/gateway-draft.ts';
import { DEV_BEURTEILUNG_EXAMPLES }
  from '../prompts/examples/dev/index.ts';

const key = process.env.AI_GATEWAY_API_KEY;
if (!key) throw new Error('AI_GATEWAY_API_KEY missing');

const transcript = readFileSync(process.argv[2]!, 'utf8').trim();
const system = buildStableSystemPrompt(DEV_BEURTEILUNG_EXAMPLES, []);
const user = buildUserPrompt({ transcript });

const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: DEFAULT_GATEWAY_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const json: any = await res.json();
const raw = json.choices?.[0]?.message?.content ?? '';
const { text, wellFormed } = parseBeurteilung(raw);
console.log('='.repeat(72));
console.log(process.argv[3] ?? 'DRAFT', '| wellFormed:', wellFormed, '| model:', json.model);
console.log('='.repeat(72));
console.log(text);
console.log('-'.repeat(72));
