/**
 * Trap-set eval: which ASR provider survives German cardiology dictation?
 *
 *   npm run eval:tts                     # once, to generate the audio
 *   npm run eval                         # all available providers
 *   npm run eval -- --provider=voxtral   # one provider
 *   npm run eval -- --repeat=3           # N runs per clip (ASR is not deterministic)
 *   npm run eval -- --gate=voxtral       # exit 1 unless that provider is 100% on safety traps
 *
 * The gate is the point. SPEC: "any prompt or glossary change must keep the
 * eval green" — green means every SAFETY trap passes on every run of the
 * provider you ship. Style traps are reported but never gate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROVIDER_ENV_KEYS,
  ProviderError,
  TRANSCRIPTION_PROVIDERS,
  type TranscriptionProviderId,
} from '../src/lib/providers/index.ts';
import { loadEnvLocal } from './env.ts';
import { FIXTURES } from './fixtures/cases.ts';
import { GLOSSARY } from './fixtures/types.ts';
import { scorePart, type PartScore } from './score/traps.ts';
import { audioPath } from './tts/generate.ts';
import { repairTranscript } from '../src/lib/transcription/repair.ts';

loadEnvLocal();

type ProviderId = Exclude<TranscriptionProviderId, 'corti'>;
const ALL_PROVIDERS = Object.keys(TRANSCRIPTION_PROVIDERS) as ProviderId[];

const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

interface Run {
  providerId: ProviderId;
  fixtureId: string;
  part: 'rant' | 'messwerte';
  attempt: number;
  score?: PartScore;
  error?: string;
}

function pct(passed: number, total: number): string {
  if (total === 0) return '  n/a';
  return `${((passed / total) * 100).toFixed(0).padStart(3)}%`;
}

async function main(): Promise<void> {
  const repeat = Number(arg('repeat') ?? '1');
  const gate = arg('gate') as ProviderId | undefined;
  const only = arg('provider')?.split(',') as ProviderId[] | undefined;
  const onlyFixture = arg('fixture');

  const fixtures = onlyFixture ? FIXTURES.filter((f) => f.id === onlyFixture) : FIXTURES;
  if (fixtures.length === 0) {
    console.error(`No fixture matching "${onlyFixture}".`);
    process.exit(1);
  }

  // Only run providers we actually hold a key for. A missing key is a skip,
  // not a failure — nobody has all four.
  const candidates = (only ?? ALL_PROVIDERS).filter((id) => {
    const key = process.env[PROVIDER_ENV_KEYS[id]];
    if (!key) {
      console.log(`skip ${id}: ${PROVIDER_ENV_KEYS[id]} not set in .env.local`);
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    console.error(
      '\nNo provider keys found. Copy .env.local.example to .env.local and fill in at least one key.',
    );
    process.exit(1);
  }

  console.log(
    `\nProviders: ${candidates.join(', ')}\nFixtures:  ${fixtures.length}   Repeats: ${repeat}\n`,
  );

  const runs: Run[] = [];

  for (const providerId of candidates) {
    const apiKey = process.env[PROVIDER_ENV_KEYS[providerId]]!;
    const provider = TRANSCRIPTION_PROVIDERS[providerId](apiKey);
    console.log(`\n=== ${provider.label} ${provider.euHosted ? '(EU)' : '(NON-EU)'}`);

    for (const fixture of fixtures) {
      for (const part of ['rant', 'messwerte'] as const) {
        const traps = part === 'rant' ? fixture.rantTraps : fixture.messwerteTraps;
        let audio: Buffer;
        try {
          audio = await readFile(audioPath(fixture.id, part));
        } catch {
          console.error(
            `  MISSING AUDIO ${fixture.id}.${part}.wav — run \`npm run eval:tts\` first.`,
          );
          process.exit(1);
        }
        // Uint8Array.from() rather than passing the Buffer straight through:
        // Buffer's backing store is typed ArrayBufferLike, which is not a
        // valid BlobPart. This allocates a plain ArrayBuffer.
        const blob = new Blob([Uint8Array.from(audio)], { type: 'audio/wav' });

        for (let attempt = 1; attempt <= repeat; attempt++) {
          try {
            const chunk = await provider.transcribeSegment(blob, {
              language: 'de',
              keyterms: GLOSSARY,
            });
            // Score the REPAIRED text — that is what the app stores and what
            // the drafting stage will see. Scoring the raw text would measure a
            // string the product never uses.
            const score = scorePart(
              fixture[part],
              repairTranscript(chunk.text),
              chunk.latencyMs,
              traps,
            );
            runs.push({ providerId, fixtureId: fixture.id, part, attempt, score });

            const failed = score.results.filter((r) => !r.passed && r.trap.severity === 'safety');
            const mark = failed.length === 0 ? 'ok  ' : 'FAIL';
            console.log(
              `  ${mark} ${fixture.id}.${part} #${attempt}  ` +
                `safety ${score.safetyPassed}/${score.safetyTotal}  ` +
                `style ${score.stylePassed}/${score.styleTotal}  ` +
                `WER ${(score.wer * 100).toFixed(1)}%  ${score.latencyMs}ms`,
            );
            for (const f of failed) {
              console.log(`         ↳ MISSED [${f.trap.kind}] ${f.trap.label}`);
            }
          } catch (err) {
            const message =
              err instanceof ProviderError
                ? `${err.message}${err.body ? ` :: ${err.body.slice(0, 400)}` : ''}`
                : String(err);
            runs.push({ providerId, fixtureId: fixture.id, part, attempt, error: message });
            console.log(`  ERR  ${fixture.id}.${part} #${attempt}  ${message}`);
          }
        }
      }
    }
  }

  // ---- Summary -------------------------------------------------------------
  console.log(`\n\n${'='.repeat(78)}\nSUMMARY\n${'='.repeat(78)}`);
  console.log(
    'provider'.padEnd(16) +
      'safety'.padStart(8) +
      'style'.padStart(8) +
      'WER'.padStart(8) +
      'latency'.padStart(10) +
      'errors'.padStart(8),
  );

  const perProvider = new Map<ProviderId, Run[]>();
  for (const r of runs) {
    const list = perProvider.get(r.providerId) ?? [];
    list.push(r);
    perProvider.set(r.providerId, list);
  }

  for (const [providerId, list] of perProvider) {
    const scored = list.filter((r) => r.score).map((r) => r.score!);
    const errors = list.filter((r) => r.error).length;
    const safetyTotal = scored.reduce((a, s) => a + s.safetyTotal, 0);
    const safetyPassed = scored.reduce((a, s) => a + s.safetyPassed, 0);
    const styleTotal = scored.reduce((a, s) => a + s.styleTotal, 0);
    const stylePassed = scored.reduce((a, s) => a + s.stylePassed, 0);
    const meanWer = scored.length ? scored.reduce((a, s) => a + s.wer, 0) / scored.length : NaN;
    const meanLatency = scored.length
      ? scored.reduce((a, s) => a + s.latencyMs, 0) / scored.length
      : NaN;

    console.log(
      providerId.padEnd(16) +
        pct(safetyPassed, safetyTotal).padStart(8) +
        pct(stylePassed, styleTotal).padStart(8) +
        `${(meanWer * 100).toFixed(1)}%`.padStart(8) +
        `${Math.round(meanLatency)}ms`.padStart(10) +
        String(errors).padStart(8),
    );
  }

  // Every distinct safety trap that failed at least once — the actionable list.
  const missed = new Map<string, number>();
  for (const r of runs) {
    for (const res of r.score?.results ?? []) {
      if (!res.passed && res.trap.severity === 'safety') {
        const key = `${r.providerId} · ${r.fixtureId}.${r.part} · [${res.trap.kind}] ${res.trap.label}`;
        missed.set(key, (missed.get(key) ?? 0) + 1);
      }
    }
  }
  if (missed.size) {
    console.log(`\nFAILED SAFETY TRAPS (${missed.size} distinct)`);
    for (const [key, count] of [...missed.entries()].sort()) {
      console.log(`  ${count}×  ${key}`);
    }
  } else if (runs.some((r) => r.score)) {
    console.log('\nNo safety trap failed.');
  }

  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `${stamp}.json`);
  await writeFile(outPath, JSON.stringify({ runs }, null, 2), 'utf8');
  console.log(`\nFull results: ${outPath}`);

  // ---- Gate ----------------------------------------------------------------
  if (gate) {
    const list = perProvider.get(gate) ?? [];
    const scored = list.filter((r) => r.score).map((r) => r.score!);
    const total = scored.reduce((a, s) => a + s.safetyTotal, 0);
    const passed = scored.reduce((a, s) => a + s.safetyPassed, 0);
    const errored = list.filter((r) => r.error).length;
    const green = total > 0 && passed === total && errored === 0;
    console.log(
      `\nGATE (${gate}): ${green ? 'GREEN' : 'RED'} — ${passed}/${total} safety traps, ${errored} errors`,
    );
    if (!green) process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
