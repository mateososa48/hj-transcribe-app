import { loadExamples } from '../../prompts/examples/dev/index.ts';
import { db } from '@/lib/db.ts';
import { buildErgaenzungTranscript } from '@/lib/ergaenzung-prompt.ts';
import { BULLET_SECTIONS, toBulletText } from '@/lib/format.ts';
import { resolveDraftProvider } from '@/lib/generate.ts';
import { DraftError } from '@/lib/providers/index.ts';
import { pipeline } from '@/lib/transcription/pipeline.ts';

/**
 * Nachdiktat für eine bestehende Beurteilung: the child recording is
 * transcribed on its own (same crash-safe machinery as every recording), and
 * the LLM then integrates the addition into the CURRENT text of the parent —
 * the current text, not the original transcript, because his manual
 * corrections must survive the merge.
 */

/** Transcribe the child, then merge its content into the parent's text. */
export async function processErgaenzung(parentId: string, childId: string): Promise<void> {
  const transcription = await pipeline.transcribeOnly(childId);
  if (!transcription.text.trim()) {
    throw new Error('In der Ergänzung wurde keine Sprache erkannt.');
  }
  await mergeErgaenzung(parentId, transcription.text);
}

export async function mergeErgaenzung(parentId: string, additionTranscript: string): Promise<void> {
  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für die Texterstellung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.',
    );
  }
  const result = await db.results.where('sessionId').equals(parentId).first();
  if (!result) throw new Error('Zu diesem Diktat liegt noch kein Text vor.');

  const existing = result.sections.beurteilung ?? '';
  const response = await provider.draftBeurteilung({
    transcript: buildErgaenzungTranscript(existing, additionTranscript),
    glossary: [],
    examples: (await loadExamples()).examples,
  });

  const merged = BULLET_SECTIONS.has('beurteilung') ? toBulletText(response.text) : response.text;
  await db.results
    .where('id')
    .equals(result.id)
    .modify((row) => {
      // One-step undo stays possible even though the page no longer offers
      // regenerate — losing his standing text silently is never acceptable.
      row.previousSections = { ...row.sections };
      row.sections = { ...row.sections, beurteilung: merged };
      row.updatedAt = Date.now();
    });
}

/* DEV-only test scaffold: fabricate a finished child (tone audio + done
   transcript) so the merge path can be exercised without a microphone. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  void import('./dev-fixtures.ts').then(({ fabricateChild }) => {
    (window as unknown as Record<string, unknown>).__ergaenzungTest = {
      fabricate: fabricateChild,
      processErgaenzung,
      async firstDiktat(): Promise<string | undefined> {
        const rows = await db.sessions
          .filter((s) => s.kind === 'beurteilung' && !s.parentId && s.status === 'stopped')
          .toArray();
        return rows.sort((a, b) => b.startedAt - a.startedAt)[0]?.id;
      },
    };
  });
}
