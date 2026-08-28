import { resolveDraftProvider } from '@/lib/generate.ts';
import { DraftError } from '@/lib/providers/index.ts';
import { pipeline } from '@/lib/transcription/pipeline.ts';

/**
 * A dictation INTO a Bericht: transcribe the child recording, then have the
 * model shape it into a section — announced heading recognized and
 * normalized to his real section names, content as his kind of bullets.
 */
export async function processAbschnittDiktat(
  childId: string,
): Promise<{ heading: string | null; text: string }> {
  const transcription = await pipeline.transcribeOnly(childId);
  if (!transcription.text.trim()) {
    throw new Error('Im Diktat wurde keine Sprache erkannt.');
  }
  const provider = await resolveDraftProvider();
  if (!provider) {
    throw new DraftError(
      'anthropic',
      'Für die Texterstellung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.',
    );
  }
  const response = await provider.draftAbschnitt({
    transcript: transcription.text,
    glossary: [],
  });
  return { heading: response.heading, text: response.text };
}
