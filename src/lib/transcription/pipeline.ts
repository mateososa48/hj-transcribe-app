import { assembleAudio, db, newId, type SessionKind, type TimedWord, type Transcription, type Utterance } from '@/lib/db.ts';
import { generate } from '@/lib/generate.ts';
import { TRANSCRIPTION_PROVIDERS } from '@/lib/providers/index.ts';
import { repairTranscript } from '@/lib/transcription/repair.ts';
import { CARDIOLOGY_KEYTERMS } from '@/lib/transcription/keyterms.ts';
import { loadApiKeys, loadSettings } from '@/lib/settings.ts';

/**
 * Recording → transcript → notes, as one visible pipeline.
 *
 * This replaced the per-segment background queue. With one continuous file
 * there is nothing to schedule: the session ends, the file uploads, the
 * provider diarizes it as a whole (speaker labels stay consistent because it
 * IS a whole), and the notes are generated from the finished transcript. The
 * entire class of "the button enabled before the tail was transcribed" bugs
 * dies with the queue.
 */

export type PipelinePhase =
  | 'idle'
  | 'transcribing'
  | 'notes'
  | 'done'
  | 'error';

export interface PipelineState {
  phase: PipelinePhase;
  error: string | null;
}

const IDLE: PipelineState = { phase: 'idle', error: null };

class PipelineManager {
  private readonly states = new Map<string, PipelineState>();
  private readonly listeners = new Set<() => void>();
  private readonly running = new Set<string>();

  get(sessionId: string): PipelineState {
    return this.states.get(sessionId) ?? IDLE;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(sessionId: string, state: PipelineState): void {
    this.states.set(sessionId, state);
    for (const listener of this.listeners) listener();
  }

  /**
   * Run the full pipeline for a stopped session. Idempotent per session — a
   * second call while one is running is a no-op, and a re-run after failure
   * starts from whatever is missing (transcript kept if it succeeded).
   */
  async process(sessionId: string): Promise<void> {
    if (this.running.has(sessionId)) return;
    this.running.add(sessionId);
    try {
      const session = await db.sessions.get(sessionId);
      if (!session) return;

      let transcription = await db.transcriptions.where('sessionId').equals(sessionId).first();

      if (!transcription || transcription.status !== 'done') {
        this.set(sessionId, { phase: 'transcribing', error: null });
        transcription = await this.transcribe(sessionId, session.kind);
      }

      if (!transcription.text.trim()) {
        this.set(sessionId, {
          phase: 'error',
          error: 'In der Aufnahme wurde keine Sprache erkannt.',
        });
        return;
      }

      this.set(sessionId, { phase: 'notes', error: null });
      await generate(sessionId, session.kind);

      this.set(sessionId, { phase: 'done', error: null });
    } catch (error) {
      this.set(sessionId, {
        phase: 'error',
        error: error instanceof Error ? error.message : 'Die Verarbeitung ist fehlgeschlagen.',
      });
    } finally {
      this.running.delete(sessionId);
    }
  }

  private async transcribe(sessionId: string, kind: SessionKind): Promise<Transcription> {
    const [settings, keys, audio] = await Promise.all([
      loadSettings(),
      loadApiKeys(),
      assembleAudio(sessionId),
    ]);
    if (!audio || audio.size === 0) {
      throw new Error('Zu dieser Aufnahme ist kein Ton gespeichert.');
    }
    const factory = TRANSCRIPTION_PROVIDERS[settings.asrProviderId];
    const key = keys[settings.asrProviderId];
    if (!factory || !key) {
      throw new Error('Für die Spracherkennung ist kein Zugang hinterlegt. Bitte geben Sie Bescheid.');
    }
    const provider = factory(key);

    const existing = await db.transcriptions.where('sessionId').equals(sessionId).first();
    const row: Transcription = existing ?? {
      id: newId(),
      sessionId,
      status: 'processing',
      providerId: provider.id,
      text: '',
      utterances: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    row.status = 'processing';
    row.updatedAt = Date.now();
    await db.transcriptions.put(row);

    try {
      const chunk = await provider.transcribeFile(audio, {
        language: 'de',
        keyterms: CARDIOLOGY_KEYTERMS,
        // A consulting room is the doctor, the patient, sometimes a relative
        // or an assistant. Solo dictations skip diarization entirely.
        ...(kind === 'gespraech' ? { diarize: { minSpeakers: 1, maxSpeakers: 4 } } : {}),
      });

      // Dosing repair on everything that will be read or prompted with:
      // "eins null null" must be 1-0-0 before anyone sees it.
      const utterances: Utterance[] = (chunk.utterances ?? []).map((u) => ({
        speaker: u.speaker,
        text: repairTranscript(u.text),
        startMs: u.startMs,
        endMs: u.endMs,
      }));

      row.text = repairTranscript(chunk.text);
      row.utterances = utterances;
      const words: TimedWord[] = (chunk.words ?? []).map((w) => ({
        text: w.text,
        startMs: w.startMs,
        endMs: w.endMs,
      }));
      if (words.length) row.words = words;
      row.status = 'done';
      delete row.error;
      row.updatedAt = Date.now();
      await db.transcriptions.put(row);
      return row;
    } catch (error) {
      row.status = 'failed';
      row.error = error instanceof Error ? error.message : 'Transkription fehlgeschlagen.';
      row.updatedAt = Date.now();
      await db.transcriptions.put(row);
      throw error;
    }
  }
}

export const pipeline = new PipelineManager();
