import { MicLevelMonitor, type MicLevelSnapshot } from '@/lib/audio/mic-level.ts';
import { ContinuousRecorder } from '@/lib/audio/recorder.ts';
import { ScreenWakeLock } from '@/lib/audio/wake-lock.ts';
import { db, newId, type Session, type SessionKind } from '@/lib/db.ts';

/**
 * Owns one recording sitting end to end: microphone, level monitoring, chunk
 * persistence, wake lock and the unload guard.
 *
 * The invariant everything here serves (SPEC constraint 6): audio is written
 * to IndexedDB the moment it exists, before any network call is considered.
 * Crash, tab close, sleep or network loss can cost at most the last timeslice
 * (~5 s) — never a session.
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
  /** When recording stopped; the timer freezes against this, not Date.now(). */
  endedAt: number | null;
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
  level: 0,
  inputWarning: null,
  error: null,
};

export class RecordingSession {
  private state: RecordingState = INITIAL;
  private readonly listeners = new Set<(s: RecordingState) => void>();

  private stream: MediaStream | null = null;
  private monitor: MicLevelMonitor | null = null;
  private recorder: ContinuousRecorder | null = null;
  private wakeLock: ScreenWakeLock | null = null;
  private unsubscribeLevel: (() => void) | null = null;

  /**
   * Per-frame microphone data, deliberately outside React state.
   *
   * The ribbon wants all three frequency bands at 60 fps. Pushing that through
   * the store would re-render the whole screen sixty times a second for
   * something only one canvas reads.
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

  /**
   * Clear the leftovers of the LAST recording (frozen timer, stale error) when
   * a fresh recorder screen mounts. The singleton survives navigation by
   * design, so without this the new-dictation screen opened showing the
   * previous session's duration. No-op while something is actually recording.
   */
  reset(): void {
    if (
      this.state.status === 'recording' ||
      this.state.status === 'requesting-mic' ||
      this.state.status === 'stopping'
    ) {
      return;
    }
    this.set({ ...INITIAL });
  }

  private set(patch: Partial<RecordingState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  async start(kind: SessionKind, opts?: { parentId?: string }): Promise<void> {
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

    this.monitor = new MicLevelMonitor(stream);
    this.monitor.start();

    const recorder = new ContinuousRecorder(stream, this.monitor, {
      onChunk: (blob, index) => this.persistChunk(blob, index),
      onError: (error) => this.fail(error.message),
      onInputSilent: () =>
        this.set({
          inputWarning:
            'Es wird seit über 15 Sekunden kein Ton empfangen. Bitte prüfen Sie das Mikrofon.',
        }),
      onInputRestored: () => this.set({ inputWarning: null }),
    });

    const session: Session = {
      id: newId(),
      kind,
      startedAt: Date.now(),
      status: 'recording',
      mimeType: recorder.mimeType || 'audio/webm',
      ...(opts?.parentId ? { parentId: opts.parentId } : {}),
    };
    await db.sessions.add(session);

    this.stream = stream;
    this.recorder = recorder;
    this.unsubscribeLevel = this.monitor.subscribe((snapshot: MicLevelSnapshot) => {
      if (this.state.status !== 'recording') return;
      this.emitAudio(snapshot);
      // Coarse: the store value only feeds the fallback indicator.
      if (Math.abs(snapshot.level - this.state.level) > 0.04) {
        this.set({ level: snapshot.level });
      }
    });

    recorder.start();
    this.wakeLock = new ScreenWakeLock();
    void this.wakeLock.acquire();
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.set({
      status: 'recording',
      sessionId: session.id,
      kind,
      startedAt: session.startedAt,
      endedAt: null,
      error: null,
    });
  }

  private async persistChunk(blob: Blob, index: number): Promise<void> {
    const sessionId = this.state.sessionId;
    if (!sessionId) return;
    try {
      await db.chunks.add({ id: newId(), sessionId, index, blob, createdAt: Date.now() });
    } catch (error) {
      this.fail(
        error instanceof Error && error.name === 'QuotaExceededError'
          ? 'Der Speicher ist voll. Bitte löschen Sie alte Aufnahmen in den Einstellungen.'
          : 'Ein Audioabschnitt konnte nicht gespeichert werden.',
      );
    }
  }

  /** Resolves with every chunk on disk and the session marked stopped. */
  async stop(): Promise<string | null> {
    if (this.state.status !== 'recording') return this.state.sessionId;
    const { sessionId, startedAt } = this.state;
    this.set({ status: 'stopping' });

    await this.recorder?.stop();
    await this.teardown();

    const endedAt = Date.now();
    if (sessionId) {
      await db.sessions.update(sessionId, {
        status: 'stopped',
        endedAt,
        durationMs: startedAt ? endedAt - startedAt : 0,
      });
    }

    this.set({ status: 'stopped', level: 0, endedAt });
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
    // Tell the ribbon the live signal is gone, so it stops claiming to hear.
    this.emitAudio(null);
    await this.wakeLock?.release();
    this.wakeLock = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.recorder = null;
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
  };
}

/**
 * Sessions left mid-recording by a crash or closed tab. Their persisted chunks
 * concatenate into a valid playable prefix, so nothing is lost — they just need
 * to be marked stopped and sent through the normal pipeline.
 */
export async function findRecoverableSessions(): Promise<Session[]> {
  const open = (await db.sessions.where('status').equals('recording').toArray())
    // Ergänzungen belong to their parent's page, not the start screen.
    .filter((s) => !s.parentId);
  const withAudio: Session[] = [];
  for (const session of open) {
    const chunkCount = await db.chunks
      .where('[sessionId+index]')
      .between([session.id, 0], [session.id, Infinity])
      .count();
    if (chunkCount > 0) withAudio.push(session);
    else await db.sessions.delete(session.id);
  }
  return withAudio;
}

/** Adopt a crashed session: close it out so the pipeline can run on it. */
export async function recoverSession(sessionId: string): Promise<void> {
  const [session, chunks] = await Promise.all([
    db.sessions.get(sessionId),
    db.chunks.where('[sessionId+index]').between([sessionId, 0], [sessionId, Infinity]).toArray(),
  ]);
  if (!session) return;
  const last = chunks.reduce((max, c) => Math.max(max, c.createdAt), session.startedAt);
  await db.sessions.update(sessionId, {
    status: 'stopped',
    endedAt: last,
    durationMs: last - session.startedAt,
  });
}
