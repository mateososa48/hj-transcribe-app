import type { MicLevelMonitor } from './mic-level.ts';

/**
 * Continuous recorder: ONE MediaRecorder for the whole sitting, flushed to the
 * caller every few seconds via `timeslice`.
 *
 * Timeslice chunks are not independently playable — only the first carries the
 * container header — but concatenated in order they form one valid file. The
 * caller persists every chunk the moment it arrives, so a crash costs at most
 * the last few seconds, and what survives replays as a valid prefix.
 *
 * This replaced a segment-rotation design (whole recorders rotated on silence
 * windows). Rotation made every segment independently sendable, but it split a
 * consultation into ~45 s files: speaker diarization could not stay consistent
 * across them, timestamps were per-segment, and playback meant chaining dozens
 * of blobs. One continuous file gives diarization, a global timeline and
 * trivial playback; chunk persistence keeps the crash-safety rotation existed
 * for.
 */

/** Preference order: Opus in WebM is what Edge/Chromium produces natively. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

/** How often the recorder hands over a chunk. Also the crash-loss ceiling. */
const TIMESLICE_MS = 5_000;

/** Continuous silence after which we assume the input has died. */
const DEAD_INPUT_MS = 15_000;

export interface ContinuousRecorderCallbacks {
  /**
   * Called for every chunk, in order. MUST persist before returning — this is
   * the only moment the audio exists solely in memory.
   */
  onChunk: (blob: Blob, index: number) => void | Promise<void>;
  /** Fatal: recording cannot continue. */
  onError: (error: Error) => void;
  /** Input appears dead (unplugged, muted, silent far too long). Recoverable. */
  onInputSilent?: (silentForMs: number) => void;
  /** Input recovered after an onInputSilent. */
  onInputRestored?: () => void;
}

export class ContinuousRecorder {
  private recorder: MediaRecorder | null = null;
  private state: 'idle' | 'recording' | 'paused' | 'stopping' | 'stopped' = 'idle';
  private index = 0;
  private startedAt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inputWasSilent = false;
  readonly mimeType = pickMimeType();

  /**
   * Total time spent paused, and the moment the current pause began.
   *
   * Recorded duration is wall-clock MINUS this. Without it a sitting paused for
   * ten minutes reports as ten minutes longer than the audio it produced, which
   * would be wrong on the clock, wrong in the session row, and wrong in any
   * cost derived from duration.
   */
  private pausedMs = 0;
  private pausedAt = 0;

  /** In-flight onChunk writes, so stop() can wait for them. */
  private readonly pendingPersists = new Set<Promise<void>>();

  constructor(
    private readonly stream: MediaStream,
    private readonly level: MicLevelMonitor,
    private readonly callbacks: ContinuousRecorderCallbacks,
  ) {}

  /** Time actually captured: wall clock less every pause, including a live one. */
  get elapsedMs(): number {
    if (!this.startedAt) return 0;
    const open = this.pausedAt ? Date.now() - this.pausedAt : 0;
    return Math.max(0, Date.now() - this.startedAt - this.pausedMs - open);
  }

  /** Accumulated pause, including a pause that is still open. */
  get totalPausedMs(): number {
    return this.pausedMs + (this.pausedAt ? Date.now() - this.pausedAt : 0);
  }

  get isPaused(): boolean {
    return this.state === 'paused';
  }

  /**
   * Pause capture without giving up the microphone.
   *
   * MediaRecorder.pause() suspends `dataavailable` and resumes into the SAME
   * container — the paused stretch is simply absent from the file, so the
   * chunks still concatenate into one valid recording and diarization still
   * sees a single continuous stream. Stopping and restarting would not: that
   * makes a second file with its own header.
   *
   * The dead-input watch is suspended too. It exists to catch a microphone that
   * has quietly died, and a deliberate pause is fifteen seconds of silence by
   * design — left running it would raise "no sound is arriving" every time.
   */
  pause(): boolean {
    if (this.state !== 'recording') return false;
    const recorder = this.recorder;
    if (!recorder || recorder.state !== 'recording') return false;

    recorder.pause();
    this.state = 'paused';
    this.pausedAt = Date.now();

    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    // Clear a standing warning: it describes the input, and we just stopped
    // listening on purpose.
    if (this.inputWasSilent) {
      this.inputWasSilent = false;
      this.callbacks.onInputRestored?.();
    }
    return true;
  }

  resume(): boolean {
    if (this.state !== 'paused') return false;
    const recorder = this.recorder;
    if (!recorder || recorder.state !== 'paused') return false;

    recorder.resume();
    this.state = 'recording';
    if (this.pausedAt) {
      this.pausedMs += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    // Fresh window: the monitor kept listening through the pause, so without
    // this the deliberate silence would trip the dead-input watch immediately.
    this.level.resetSilence();
    this.inputWasSilent = false;
    this.pollTimer = setInterval(this.poll, 1_000);
    return true;
  }

  start(): void {
    if (this.state !== 'idle') return;

    const recorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size === 0) return;
      const chunkIndex = this.index++;
      this.pendingPersists.add(
        Promise.resolve(this.callbacks.onChunk(event.data, chunkIndex)).catch((error) => {
          this.callbacks.onError(
            error instanceof Error ? error : new Error('Ein Audioabschnitt konnte nicht gespeichert werden.'),
          );
        }),
      );
    });

    recorder.addEventListener('error', () => {
      this.callbacks.onError(new Error('Die Aufnahme wurde vom Browser unterbrochen.'));
    });

    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', this.handleTrackEnded);
    }

    recorder.start(TIMESLICE_MS);
    this.recorder = recorder;
    this.startedAt = Date.now();
    this.state = 'recording';
    this.pollTimer = setInterval(this.poll, 1_000);
  }

  /**
   * Resolves only after the final chunk is ON DISK. Everything downstream
   * (upload, transcription) can then trust what it reads.
   */
  async stop(): Promise<void> {
    if (this.state !== 'recording' && this.state !== 'paused') return;
    // Close an open pause before it is lost, so durationMs stays honest even
    // when a sitting is ended from the paused state — which is the normal way
    // to end one, since he pauses first and then decides.
    if (this.pausedAt) {
      this.pausedMs += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    this.state = 'stopping';

    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    for (const track of this.stream.getAudioTracks()) {
      track.removeEventListener('ended', this.handleTrackEnded);
    }

    const recorder = this.recorder;
    this.recorder = null;
    if (recorder && recorder.state !== 'inactive') {
      // stop() fires a final dataavailable before the stop event.
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }
    await Promise.all([...this.pendingPersists]);
    this.state = 'stopped';
  }

  private handleTrackEnded = (): void => {
    this.callbacks.onError(
      new Error('Das Mikrofon wurde getrennt. Die Aufnahme wurde gestoppt und ist gespeichert.'),
    );
  };

  /** Dead-input watch: a recording of silence is the unrecoverable failure. */
  private poll = (): void => {
    if (this.state !== 'recording') return;
    const { silentForMs } = this.level.snapshot();
    if (silentForMs >= DEAD_INPUT_MS) {
      if (!this.inputWasSilent) {
        this.inputWasSilent = true;
        this.callbacks.onInputSilent?.(silentForMs);
      }
    } else if (this.inputWasSilent) {
      this.inputWasSilent = false;
      this.callbacks.onInputRestored?.();
    }
  };
}
