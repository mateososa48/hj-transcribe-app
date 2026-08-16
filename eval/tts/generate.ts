/**
 * Renders each fixture to synthetic German audio with macOS `say`.
 *
 * Why synthetic: SPEC constraint 7 forbids real patient audio in dev, and we
 * need the eval to be reproducible and runnable by anyone who clones the repo.
 *
 * What this DOES test: German medical vocabulary, drug names, spoken numbers,
 * negations, spoken punctuation — i.e. every trap in the fixture set.
 *
 * What this does NOT test: HJ's actual voice, his pace, mumbling, room noise,
 * a headset mic, or the 70-year-old-male vocal range. Those change ASR accuracy
 * a lot. Treat this as a DISCRIMINATOR, not a ground truth: it will reliably
 * tell us which provider mangles "Ticagrelor" or drops "keine", and it will not
 * tell us the absolute accuracy we will see in the clinic. Before shipping a
 * default provider, re-run the trap set against a real recording of HJ reading
 * these same five scripts (that recording is git-ignored).
 *
 *   npm run eval:tts            # generate missing files
 *   npm run eval:tts -- --force # regenerate everything
 */
import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { FIXTURES } from '../fixtures/cases.ts';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
export const AUDIO_DIR = join(HERE, '..', 'audio');

/** 16 kHz mono 16-bit PCM: what every ASR API wants, and what `say` can emit. */
const SAMPLE_RATE = 16_000;
const DATA_FORMAT = `LEI16@${SAMPLE_RATE}`;

/**
 * Collapse the template-literal indentation so the voice reads continuous
 * prose. Spoken-punctuation words ("Komma", "Punkt") are deliberately KEPT —
 * fixture 03 exists to prove the pipeline tolerates them.
 */
function cleanForSpeech(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function audioPath(fixtureId: string, part: 'rant' | 'messwerte'): string {
  return join(AUDIO_DIR, `${fixtureId}.${part}.wav`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Duration from the PCM byte count — no ffmpeg needed. */
async function durationSeconds(path: string): Promise<number> {
  const { size } = await stat(path);
  return (size - 44) / (SAMPLE_RATE * 2);
}

async function synthesize(text: string, voice: string, outPath: string): Promise<void> {
  // Route text through a temp file rather than argv: the fixtures contain
  // newlines, quotes and umlauts, and shell-escaping all of that is a bug farm.
  const txtPath = `${outPath}.txt`;
  await writeFile(txtPath, cleanForSpeech(text), 'utf8');
  try {
    await execFileAsync('say', [
      '-v', voice,
      '-f', txtPath,
      '-o', outPath,
      '--data-format', DATA_FORMAT,
    ]);
  } finally {
    await execFileAsync('rm', ['-f', txtPath]);
  }
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.error('eval:tts requires macOS (`say`). Generate the WAVs on a Mac and commit-ignore them.');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  await mkdir(AUDIO_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;

  for (const fixture of FIXTURES) {
    for (const part of ['rant', 'messwerte'] as const) {
      const out = audioPath(fixture.id, part);
      if (!force && (await exists(out))) {
        skipped++;
        console.log(`  skip   ${fixture.id}.${part}.wav (exists)`);
        continue;
      }
      await synthesize(fixture[part], fixture.voice, out);
      const secs = await durationSeconds(out);
      generated++;
      console.log(`  ok     ${fixture.id}.${part}.wav  ${secs.toFixed(1)}s  voice=${fixture.voice}`);
    }
  }

  console.log(`\n${generated} generated, ${skipped} skipped -> ${AUDIO_DIR}`);
  if (skipped && !force) console.log('Use --force to regenerate.');
}

// Only run when invoked directly, so audioPath() can be imported by the runner.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
