import { MicLevelMonitor, type MicLevelSnapshot } from '@/lib/audio/mic-level.ts';
import { SegmentRecorder } from '@/lib/audio/recorder.ts';
import { ScreenWakeLock } from '@/lib/audio/wake-lock.ts';
import { db, newId, type Session, type SessionKind } from '@/lib/db.ts';

/**
 * Owns one recording sitting end to end: microphone, level monitoring, segment
 * rotation, persistence, wake lock and the unload guard.
 *
 * The invariant everything here serves (SPEC constraint 6): a segment is
 * written to IndexedDB the moment it exists, before any network call is
 * considered. Crash, tab close, sleep or network loss can cost at most the
 * few seconds still inside the active recorder — never a session.
 */

export type RecordingStatus =
  | 'idle'
  | 'requesting-mic'
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface RecordingState {
  status: RecordingStatus;
  sessionId: string | null;
  /** Which feature this recording belongs to. Decides the prompt used later. */
  kind: SessionKind | null;
  startedAt: number | null;
  /**
   * When recording stopped. The elapsed time is frozen against this rather than
   * against the wall clock — otherwise navigating away and back re-derives it
   * from Date.now() and shows the time spent away as recorded time.
   */
  endedAt: number | null;
  /** Segments persisted so far. */
  segmentCount: number;
  level: number;
  /** Set when the input has gone silent for long enough to look broken. */
  inputWarning: string | null;
  error: string | null;
}

const INITIAL: RecordingState = {
  status: 'idle',
  sessionId: null,
  kind: null,
  startedAt: null,
  endedAt: null,
  segmentCount: 0,
  level: 0,
  inputWarning: null,
  error: null,
};

export class RecordingSession {
  private state: RecordingState = INITIAL;
  private readonly listeners = new Set<(s: RecordingState) => void>();

  private stream: MediaStream | null = null;
  private monitor: MicLevelMonitor | null = null;
  private recorder: SegmentRecorder | null = null;
  private wakeLock: ScreenWakeLock | null = null;
  private unsubscribeLevel: (() => void) | null = null;

  /**
   * Per-frame microphone data, deliberately outside React state.
   *
   * The visual indicator wants all three frequency bands at 60 fps. Pushing
   * that through the store would re-render the whole screen sixty times a
   * second for something only one canvas reads, so subscribers get it directly
   * and the store keeps a coarse `level` for the non-WebGL fallback.
   */
  private readonly audioListeners = new Set<(s: MicLevelSnapshot | null) => void>();

  getState(): RecordingState {
    return this.state;
  }

  subscribe(listener: (s: RecordingState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Returns null while nothing is recording — never a simulated value. */
  subscribeAudio(listener: (s: MicLevelSnapshot | null) => void): () => void {
    this.audioListeners.add(listener);
    listener(this.monitor ? this.monitor.snapshot() : null);
    return () => this.audioListeners.delete(listener);
  }

  private emitAudio(snapshot: MicLevelSnapshot | null): void {
    for (const listener of this.audioListeners) listener(snapshot);
  }

  private set(patch: Partial<RecordingState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  async start(kind: SessionKind, label?: string): Promise<void> {
    if (this.state.status === 'recording' || this.state.status === 'requesting-mic') return;

    this.set({ ...INITIAL, status: 'requesting-mic' });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      this.set({
        status: 'error',
        error:
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Der Zugriff auf das Mikrofon wurde abgelehnt. Bitte erlauben Sie den Zugriff und versuchen Sie es erneut.'
            : 'Es wurde kein Mikrofon gefunden. Bitte prüfen Sie den Anschluss.',
      });
      return;
    }

    const session: Session = {
      id: newId(),
      kind,
      startedAt: Date.now(),
      status: 'recording',
      ...(label ? { label } : {}),
    };
    await db.sessions.add(session);

    this.stream = stream;
    this.monitor = new MicLevelMonitor(stream);
    this.monitor.start();
    this.unsubscribeLevel = this.monitor.subscribe((snapshot: MicLevelSnapshot) => {
      if (this.state.status !== 'recording') return;
      this.emitAudio(snapshot);
      // Coarse: the store value only feeds the fallback indicator, and a
      // re-render per frame is not worth two decimal places.
      if (Math.abs(snapshot.level - this.state.level) > 0.04) {
        this.set({ level: snapshot.level });
      }
    });

    this.recorder = new SegmentRecorder(stream, this.monitor, {
      onSegment: (blob, meta) => this.persistSegment(session.id, blob, meta),
      onError: (error) => this.fail(error.message),
      onInputSilent: () =>
        this.set({
          inputWarning:
            'Es wird seit über 15 Sekunden kein Ton empfangen. Bitte prüfen Sie das Mikrofon.',
        }),
      onInputRestored: () => this.set({ inputWarning: null }),
    });
    this.recorder.start();

    this.wakeLock = new ScreenWakeLock();
    void this.wakeLock.acquire();

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.set({
      status: 'recording',
      sessionId: session.id,
      kind,
      startedAt: session.startedAt,
      endedAt: null,
      segmentCount: 0,
      error: null,
    });
  }

  /**
   * Persist immediately, then enqueue. Order matters: if the tab dies between
   * these two lines we have the audio and can retry transcription later, which
   * is recoverable. The reverse order is not.
   */
  private async persistSegment(
    sessionId: string,
    blob: Blob,
    meta: { index: number; startedAt: number; durationMs: number; mimeType: string },
  ): Promise<void> {
    try {
      await db.segments.add({
        id: newId(),
        sessionId,
        index: meta.index,
        blob,
        mimeType: meta.mimeType,
        durationMs: meta.durationMs,
        createdAt: meta.startedAt,
        transcriptionStatus: 'pending',
        attempts: 0,
      });
      this.set({ segmentCount: this.state.segmentCount + 1 });
    } catch (error) {
      // Storage failure is the one error we cannot paper over.
      this.fail(
        error instanceof Error && error.name === 'QuotaExceededError'
          ? 'Der Speicher ist voll. Bitte geben Sie in den Einstellungen Speicher frei.'
          : 'Ein Aufnahmeabschnitt konnte nicht gespeichert werden.',
      );
    }
  }

  async stop(): Promise<string | null> {
    if (this.state.status !== 'recording') return this.state.sessionId;
    const sessionId = this.state.sessionId;
    this.set({ status: 'stopping' });

    await this.recorder?.stop();
    await this.teardown();

    if (sessionId) {
      await db.sessions.update(sessionId, { status: 'stopped', endedAt: Date.now() });
    }

    this.set({ status: 'stopped', level: 0, endedAt: Date.now() });
    return sessionId;
  }

  private fail(message: string): void {
    this.set({ status: 'error', error: message, level: 0, endedAt: Date.now() });
    void this.teardown();
  }

  private async teardown(): Promise<void> {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.unsubscribeLevel?.();
    this.unsubscribeLevel = null;
    this.monitor?.stop();
    this.monitor = null;
    // Tell the indicator the live signal is gone, so it stops claiming to hear
    // something the moment the microphone is released.
    this.emitAudio(null);
    await this.wakeLock?.release();
    this.wakeLock = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.recorder = null;
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    // Browsers ignore custom text now, but preventDefault still triggers the
    // native "leave site?" prompt — which is the point.
    event.preventDefault();
  };
}

/**
 * Sessions left in `recording` from a previous launch: the tab died before
 * stop() ran. Their segments are on disk and still usable.
 */
export async function findRecoverableSessions(): Promise<Session[]> {
  return db.sessions.where('status').equals('recording').toArray();
}

export async function markSessionRecovered(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { status: 'stopped', endedAt: Date.now() });
}

export async function discardSession(sessionId: string): Promise<void> {
  await db.segments.where('sessionId').equals(sessionId).delete();
  await db.transcripts.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}
