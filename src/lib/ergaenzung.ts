import { loadExamples } from '../../prompts/examples/dev/index.ts';
import { db, newId } from '@/lib/db.ts';
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
   transcript) so the merge + UI path can be exercised without a microphone. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__ergaenzungTest = {
    async fabricate(parentId: string, text: string): Promise<string> {
      const childId = newId();
      const now = Date.now();
      const seconds = 4;
      const rate = 22050;
      const samples = seconds * rate;
      const buf = new ArrayBuffer(44 + samples * 2);
      const v = new DataView(buf);
      const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE');
      str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
      v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) v.setInt16(44 + i * 2, Math.sin(i / 24) * 6000, true);
      await db.sessions.add({
        id: childId, kind: 'beurteilung', startedAt: now - seconds * 1000, endedAt: now,
        status: 'stopped', durationMs: seconds * 1000, mimeType: 'audio/wav', parentId,
      });
      await db.chunks.add({ id: newId(), sessionId: childId, index: 0, blob: new Blob([buf], { type: 'audio/wav' }), createdAt: now });
      await db.transcriptions.add({
        id: newId(), sessionId: childId, status: 'done', providerId: 'assemblyai-eu',
        text, utterances: [], createdAt: now, updatedAt: now,
      });
      return childId;
    },
    processErgaenzung,
    async firstDiktat(): Promise<string | undefined> {
      const rows = await db.sessions
        .filter((s) => s.kind === 'beurteilung' && !s.parentId && s.status === 'stopped')
        .toArray();
      return rows.sort((a, b) => b.startedAt - a.startedAt)[0]?.id;
    },
  };
}
