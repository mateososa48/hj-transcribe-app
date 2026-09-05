import { writeFileSync } from 'node:fs';

import {
  BEURTEILUNG_PROMPT_VERSION,
  buildStableSystemPrompt,
  buildUserPrompt,
  parseBeurteilung,
} from '../prompts/beurteilung.ts';
import {
  GESPRAECH_PROMPT_VERSION,
  buildGespraechSystemPrompt,
  buildGespraechUserPrompt,
  parseGespraech,
} from '../prompts/gespraech.ts';
import { loadExamples } from '../prompts/examples/dev/index.ts';

/**
 * Replay the drafting step over recent transcripts.
 *
 * WHAT THIS IS NOT: a retrieval. The Berichte the app actually produced live in
 * IndexedDB in HJ's browser and nowhere else — `generate.ts` posts to no
 * endpoint, the CSP allows three origins, and AI Gateway's generation record
 * keeps cost and token counts but no text. That is the local-first design
 * working as intended, and it means the original bytes cannot be fetched back.
 *
 * WHAT THIS IS: the same transcript, through the same prompt version, the same
 * model and the same parser the app uses. A faithful reconstruction, not a
 * copy — models are non-deterministic, so wording will differ from whatever HJ
 * saw even where the substance matches.
 *
 * Output goes straight to a file. Nothing is printed but counts: this is
 * medical text and stdout is the one place it should not land.
 */

const AAI = process.env.ASSEMBLYAI_API_KEY;
const GATEWAY = process.env.VITE_AI_GATEWAY_API_KEY ?? process.env.AI_GATEWAY_API_KEY;
if (!AAI) throw new Error('ASSEMBLYAI_API_KEY is not set');
if (!GATEWAY) throw new Error('AI gateway key is not set');

const MODEL = 'openai/gpt-5.6-terra';
const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const LIMIT = Number(process.argv[2] ?? 30);
const OUT = process.argv[3] ?? 'drafts.md';

interface ListItem { id: string; status: string; created: string }
interface Detail {
  text: string | null;
  audio_duration: number | null;
  speaker_labels: boolean | null;
  utterances: { speaker: string; text: string }[] | null;
}

async function pooled<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const listed = (await (
  await fetch(`https://api.eu.assemblyai.com/v2/transcript?limit=${LIMIT}`, {
    headers: { Authorization: AAI },
  })
).json()) as { transcripts: ListItem[] };

const jobs = listed.transcripts.filter((t) => t.status === 'completed').slice(0, LIMIT);

const details = await pooled(jobs, 6, async (t) => {
  const d = (await (
    await fetch(`https://api.eu.assemblyai.com/v2/transcript/${t.id}`, {
      headers: { Authorization: AAI },
    })
  ).json()) as Detail;
  return { job: t, detail: d };
});

const { examples } = await loadExamples();

/** One drafting call, shaped exactly as the app shapes it. */
async function draft(system: string, user: string): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GATEWAY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`gateway HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? '';
}

const usable = details.filter((d) => (d.detail.text ?? '').trim().length > 0);

const drafted = await pooled(usable, 3, async ({ job, detail }) => {
  const transcript = (detail.text ?? '').trim();
  const isGespraech = Boolean(detail.speaker_labels);
  try {
    if (isGespraech) {
      const raw = await draft(
        buildGespraechSystemPrompt([]),
        buildGespraechUserPrompt({ transcript, glossary: [] }),
      );
      const { sections, order, labels, wellFormed } = parseGespraech(raw);
      // parseGespraech returns keyed sections plus the order the model asked
      // for — object key order is explicitly not a contract, so walk `order`.
      const parts = order.map((k) => ({
        heading: labels[k] ?? k,
        text: sections[k] ?? '',
      }));
      return { job, detail, kind: 'Gespräch', wellFormed, sections: parts, text: null, error: null };
    }
    const raw = await draft(
      buildStableSystemPrompt(examples, []),
      buildUserPrompt({ transcript }),
    );
    const { text, wellFormed } = parseBeurteilung(raw);
    return { job, detail, kind: 'Beurteilung', wellFormed, sections: null, text, error: null };
  } catch (e) {
    return {
      job,
      detail,
      kind: isGespraech ? 'Gespräch' : 'Beurteilung',
      wellFormed: false,
      sections: null,
      text: null,
      error: (e as Error).message,
    };
  }
});

const when = (iso: string) =>
  new Date(iso)
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');

const size = (s: number) =>
  s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;

const lines: string[] = [
  '# Transcript → draft',
  '',
  `Replayed ${when(new Date().toISOString())} · model \`${MODEL}\``,
  `Prompt versions: Beurteilung \`${BEURTEILUNG_PROMPT_VERSION}\`, Gespräch \`${GESPRAECH_PROMPT_VERSION}\``,
  '',
  '> **This is a reconstruction, not a retrieval.** The drafts the app actually',
  '> produced are in IndexedDB in the browser and nowhere else. These were',
  '> regenerated from the same transcripts, through the same prompts, model and',
  '> parser — so the substance should match, but the wording will not be',
  '> identical to what was seen on screen.',
  '',
  '---',
  '',
];

let ok = 0;
let malformed = 0;
let failed = 0;

drafted.forEach((d, i) => {
  lines.push(
    `## ${i + 1}. ${when(d.job.created)} · ${size(d.detail.audio_duration ?? 0)} · ${d.kind}`,
    '',
    '**Transcript**',
    '',
    (d.detail.text ?? '').trim(),
    '',
    '**Draft**',
    '',
  );

  if (d.error) {
    lines.push(`_Failed: ${d.error}_`, '');
    failed++;
  } else if (d.sections && d.sections.length > 0) {
    for (const s of d.sections) lines.push(`### ${s.heading}`, '', s.text.trim(), '');
    ok++;
  } else if (d.text) {
    lines.push(d.text.trim(), '');
    ok++;
  } else {
    lines.push('_Model returned nothing usable._', '');
    malformed++;
  }

  if (!d.wellFormed && !d.error) {
    lines.push('_Note: response did not match the expected tag structure._', '');
    malformed++;
  }
  lines.push('---', '');
});

const body = lines.join('\n');
writeFileSync(OUT, body, 'utf8');

console.log(
  JSON.stringify(
    {
      file: OUT,
      transcriptsSeen: details.length,
      withSpeech: usable.length,
      drafted: ok,
      malformed,
      failed,
      bytes: Buffer.byteLength(body, 'utf8'),
    },
    null,
    1,
  ),
);
process.exit(0);
