import { db, logAudit, newId, type Segment } from '@/lib/db.ts';
import {
  ProviderError,
  TRANSCRIPTION_PROVIDERS,
  type TranscriptionProvider,
  type TranscriptionProviderId,
} from '@/lib/providers/index.ts';
import { loadApiKeys, loadSettings } from '@/lib/settings.ts';
import { repairTranscript } from './repair.ts';

/**
 * Background transcription.
 *
 * Two rules this exists to enforce (SPEC "Audio pipeline"):
 *
 *  1. Transcription runs DURING recording, not after. By the time HJ stops
 *     talking, most of the text already exists.
 *  2. Recording never depends on the network. This queue is entirely
 *     downstream of persistence — if it is offline, wedged, or misconfigured,
 *     segments simply accumulate as `pending` and it catches up later. Nothing
 *     it does can lose audio.
 *
 * Failures retry with exponential backoff and surface as "wird nachgeholt"
 * rather than as an error, because from HJ's point of view that is what is
 * happening: nothing is lost, it is just not done yet.
 */

export interface QueueState {
  pending: number;
  running: number;
  failed: number;
  done: number;
  /** True while at least one segment is awaiting a retry. */
  retrying: boolean;
  lastError: string | null;
}

const IDLE: QueueState = {
  pending: 0,
  running: 0,
  failed: 0,
  done: 0,
  retrying: false,
  lastError: null,
};

/** 5 s, 10 s, 20 s, 40 s, 80 s, then every 2 min. */
function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 120_000);
}

const MAX_ATTEMPTS = 8;
const POLL_MS = 2_000;

export class TranscriptionQueue {
  private timer: ReturnType<typeof setInterval> | null = null;
  private working = false;
  private state: QueueState = IDLE;
  private readonly listeners = new Set<(s: QueueState) => void>();

  subscribe(listener: (s: QueueState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): QueueState {
    return this.state;
  }

  private set(patch: Partial<QueueState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.drain(), POLL_MS);
    void this.drain();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Reset failed segments so the user can force an immediate retry. */
  async retryFailed(): Promise<void> {
    const failed = await db.segments.where('transcriptionStatus').equals('failed').toArray();
    await Promise.all(
      failed.map((s) =>
        db.segments.update(s.id, {
          transcriptionStatus: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
        }),
      ),
    );
    void this.drain();
  }

  private async resolveProvider(): Promise<TranscriptionProvider | null> {
    const [settings, keys] = await Promise.all([loadSettings(), loadApiKeys()]);
    const id = settings.asrProviderId as Exclude<TranscriptionProviderId, 'corti'>;
    const factory = TRANSCRIPTION_PROVIDERS[id];
    const key = keys[id];
    if (!factory || !key) return null;
    return factory(key);
  }

  private async refreshCounts(): Promise<void> {
    const [pending, running, failed, done] = await Promise.all([
      db.segments.where('transcriptionStatus').equals('pending').count(),
      db.segments.where('transcriptionStatus').equals('running').count(),
      db.segments.where('transcriptionStatus').equals('failed').count(),
      db.segments.where('transcriptionStatus').equals('done').count(),
    ]);
    this.set({ pending, running, failed, done, retrying: failed > 0 });
  }

  private async drain(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      await this.refreshCounts();

      const now = Date.now();
      const candidates = await db.segments
        .where('transcriptionStatus')
        .anyOf('pending', 'failed')
        .toArray();

      // Oldest first, and only those whose backoff has elapsed.
      const ready = candidates
        .filter((s) => (s.nextAttemptAt ?? 0) <= now && s.attempts < MAX_ATTEMPTS && s.blob)
        .sort((a, b) => a.createdAt - b.createdAt);

      if (ready.length === 0) return;

      const provider = await this.resolveProvider();
      if (!provider) {
        this.set({ lastError: 'Kein Zugangsschlüssel für die Spracherkennung hinterlegt.' });
        return;
      }

      // One at a time: keeps ordering obvious and avoids hammering the API from
      // a single desktop. Segments are ~45 s, transcription a few seconds — it
      // keeps up comfortably.
      for (const segment of ready) {
        await this.process(segment, provider);
      }
      await this.refreshCounts();
    } finally {
      this.working = false;
    }
  }

  private async process(segment: Segment, provider: TranscriptionProvider): Promise<void> {
    if (!segment.blob) return;
    await db.segments.update(segment.id, { transcriptionStatus: 'running' });
    this.set({ running: this.state.running + 1 });

    try {
      const keyterms = (await db.glossary.toArray()).map((g) => g.preferred ?? g.term);
      const chunk = await provider.transcribeSegment(segment.blob, { language: 'de', keyterms });

      await db.transcripts.add({
        id: newId(),
        sessionId: segment.sessionId,
        segmentId: segment.id,
        providerId: provider.id,
        // Repaired before storage, not at render time: a dosing scheme that
        // reads as a dose ("5 mg 100") must never exist in the record at all.
        text: repairTranscript(chunk.text),
        createdAt: Date.now(),
      });

      // modify() rather than update(): clearing an optional field means
      // removing the key, which an UpdateSpec cannot express.
      await db.segments.where('id').equals(segment.id).modify((s) => {
        s.transcriptionStatus = 'done';
        delete s.lastError;
        delete s.nextAttemptAt;
      });
      await logAudit('transcript.created', {
        sessionId: segment.sessionId,
        detail: provider.id,
      });

      await this.applyAudioRetention(segment.id);
      this.set({ lastError: null });
    } catch (error) {
      const attempts = segment.attempts + 1;
      const message =
        error instanceof ProviderError
          ? `${error.message}${error.body ? ` — ${error.body.slice(0, 200)}` : ''}`
          : error instanceof Error
            ? error.message
            : 'Unbekannter Fehler';

      await db.segments.update(segment.id, {
        transcriptionStatus: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attempts,
        lastError: message,
        nextAttemptAt: Date.now() + backoffMs(attempts),
      });
      this.set({ lastError: message });
    }
  }

  /** Drop the audio blob if the retention setting says to. */
  private async applyAudioRetention(segmentId: string): Promise<void> {
    const { audioRetention } = await loadSettings();
    if (audioRetention !== 'afterTranscription') return;
    await db.segments.where('id').equals(segmentId).modify((s) => {
      delete s.blob;
      s.audioDeletedAt = Date.now();
    });
    await logAudit('audio.deleted', { detail: 'nach Übertragung' });
  }
}

/** Assemble a session's transcripts into one text, in segment order. */
export async function assembleTranscript(sessionId: string): Promise<string> {
  const [segments, transcripts] = await Promise.all([
    db.segments.where('sessionId').equals(sessionId).toArray(),
    db.transcripts.where('sessionId').equals(sessionId).toArray(),
  ]);

  const bySegment = new Map(transcripts.map((t) => [t.segmentId, t]));
  return segments
    .sort((a, b) => a.index - b.index)
    .map((s) => bySegment.get(s.id)?.text.trim())
    .filter((text): text is string => Boolean(text))
    .join(' ');
}
