import type { MicLevelMonitor } from './mic-level.ts';

/**
 * Segment-rotating recorder.
 *
 * WHY THIS EXISTS, in one paragraph: MediaRecorder's `timeslice` option looks
 * like the obvious way to get periodic chunks, and it is a trap. Only the first
 * chunk carries the container header; every chunk after it is headerless and
 * cannot be decoded or POSTed to a transcription API on its own. So instead of
 * slicing one recording, we rotate whole recorders — each `stop()` yields a
 * complete, independently playable file.
 *
 * Two refinements on top of that:
 *
 * 1. ROTATE DURING SILENCE. A fixed 45 s timer cuts wherever it lands, usually
 *    mid-word, and boundary words are exactly where ASR accuracy collapses. We
 *    aim for 45 s but wait for a short silence window, with a hard cap so a
 *    continuous talker still rotates.
 *
 * 2. OVERLAP, DON'T GAP. The next recorder starts BEFORE the current one stops,
 *    so no audio falls between them. Because rotation happens during silence,
 *    that overlap contains silence — no lost words and no duplicated words.
 */

export interface SegmentMeta {
  index: number;
  startedAt: number;
  durationMs: number;
  mimeType: string;
}

export interface SegmentRecorderOptions {
  /** Aim to rotate at this point, if silence allows. */
  targetSegmentMs?: number;
  /** Rotate regardless once this is reached. */
  maxSegmentMs?: number;
  /** How long the outgoing and incoming recorders overlap. */
  overlapMs?: number;
  /** Continuous silence required before an at-target rotation fires. */
  silenceHoldMs?: number;
  /** Continuous silence after which we assume the input has died. */
  deadInputMs?: number;
}

const DEFAULTS = {
  targetSegmentMs: 45_000,
  maxSegmentMs: 60_000,
  overlapMs: 400,
  silenceHoldMs: 300,
  deadInputMs: 15_000,
} satisfies Required<SegmentRecorderOptions>;

export interface SegmentRecorderCallbacks {
  /**
   * Called the instant a segment is complete. MUST persist before returning —
   * this is the only moment the audio exists solely in memory.
   */
  onSegment: (blob: Blob, meta: SegmentMeta) => void | Promise<void>;
  /** Fatal: recording cannot continue. */
  onError: (error: Error) => void;
  /** Input appears dead (unplugged, muted, silent far too long). Recoverable. */
  onInputSilent?: (silentForMs: number) => void;
  /** Input recovered after an onInputSilent. */
  onInputRestored?: () => void;
}

/** Preference order: Opus in WebM is what Edge/Chromium produces natively. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

export interface RotationInput {
  /** ms since the active segment started. */
  elapsedMs: number;
  /** ms the input has been continuously below the silence threshold. */
  silentForMs: number;
}

export type RotationDecision = 'continue' | 'rotate-quiet' | 'rotate-forced';

/**
 * Pure rotation decision, extracted so it can be tested without a browser.
 *
 * Intent: prefer to cut in a gap between sentences, but never let a segment run
 * away. A continuous talker hits the hard cap and gets a mid-word cut, which is
 * the correct trade — a slightly worse boundary beats an unbounded segment that
 * delays transcription and risks more loss on a crash.
 */
export function decideRotation(
  input: RotationInput,
  options: Required<SegmentRecorderOptions>,
): RotationDecision {
  if (input.elapsedMs >= options.maxSegmentMs) return 'rotate-forced';
  if (input.elapsedMs >= options.targetSegmentMs && input.silentForMs >= options.silenceHoldMs) {
    return 'rotate-quiet';
  }
  return 'continue';
}

export const ROTATION_DEFAULTS: Required<SegmentRecorderOptions> = DEFAULTS;

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return MIME_CANDIDATES[0]!;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

type State = 'idle' | 'recording' | 'stopping' | 'stopped';

export class SegmentRecorder {
  private state: State = 'idle';
  private active: MediaRecorder | null = null;
  private activeIndex = -1;
  private activeStartedAt = 0;
  private nextIndex = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** In-flight onSegment writes, so stop() can wait for them. */
  private readonly pendingPersists = new Set<Promise<void>>();
  private rotating = false;
  private inputDead = false;
  private readonly opts: Required<SegmentRecorderOptions>;
  private readonly mimeType: string;

  constructor(
    private readonly stream: MediaStream,
    private readonly level: MicLevelMonitor,
    private readonly callbacks: SegmentRecorderCallbacks,
    options: SegmentRecorderOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
    this.mimeType = pickMimeType();
  }

  get currentMimeType(): string {
    return this.mimeType;
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'recording';

    // If the device disappears mid-session we must not fail silently.
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', this.handleTrackEnded);
    }

    this.beginSegment();
    this.pollTimer = setInterval(this.poll, 250);
  }

  /** Finalise the current segment and stop. Resolves once it is persisted. */
  async stop(): Promise<void> {
    if (this.state !== 'recording') return;
    this.state = 'stopping';

    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;

    for (const track of this.stream.getAudioTracks()) {
      track.removeEventListener('ended', this.handleTrackEnded);
    }

    const recorder = this.active;
    this.active = null;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }
    // Every segment is on disk before stop() resolves. Anything downstream that
    // reads the session — assembling the transcript, counting outstanding work —
    // can then trust what it finds.
    await Promise.all([...this.pendingPersists]);
    this.state = 'stopped';
  }

  private beginSegment(): void {
    const index = this.nextIndex++;
    const startedAt = Date.now();

    const recorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);

    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener('stop', () => {
      // Tracked so stop() can await it. Fire-and-forget here meant the LAST
      // segment of a recording was still being written to IndexedDB while the
      // result screen was already assembling the transcript — so the tail of a
      // dictation could silently go missing.

      // Assemble here rather than trusting a single dataavailable: a rotation
      // or a browser quirk can split the payload, and a dropped chunk is a
      // dropped sentence.
      const blob = new Blob(chunks, { type: this.mimeType || 'audio/webm' });
      if (blob.size === 0) return;
      this.pendingPersists.add(
        Promise.resolve(
          this.callbacks.onSegment(blob, {
            index,
            startedAt,
            durationMs: Date.now() - startedAt,
            mimeType: this.mimeType || 'audio/webm',
          }),
        ).catch(() => undefined),
      );
    });

    recorder.addEventListener('error', () => {
      this.callbacks.onError(new Error('Die Aufnahme wurde vom Browser unterbrochen.'));
    });

    recorder.start();
    this.active = recorder;
    this.activeIndex = index;
    this.activeStartedAt = startedAt;
  }

  private poll = (): void => {
    if (this.state !== 'recording' || this.rotating) return;

    const elapsedMs = Date.now() - this.activeStartedAt;
    const { silent, silentForMs } = this.level.snapshot();

    this.checkInputHealth(silent, silentForMs);

    if (decideRotation({ elapsedMs, silentForMs }, this.opts) !== 'continue') void this.rotate();
  };

  private checkInputHealth(silent: boolean, silentForMs: number): void {
    if (silent && silentForMs >= this.opts.deadInputMs) {
      if (!this.inputDead) {
        this.inputDead = true;
        this.callbacks.onInputSilent?.(silentForMs);
      }
    } else if (this.inputDead && !silent) {
      this.inputDead = false;
      this.callbacks.onInputRestored?.();
    }
  }

  /**
   * Overlap-then-stop. Start the incoming recorder first so the stream is never
   * unobserved, then retire the outgoing one after the overlap window.
   */
  private async rotate(): Promise<void> {
    if (this.rotating || this.state !== 'recording') return;
    this.rotating = true;

    const outgoing = this.active;
    try {
      this.beginSegment();
      await new Promise((resolve) => setTimeout(resolve, this.opts.overlapMs));
      if (outgoing && outgoing.state !== 'inactive') outgoing.stop();
    } catch (error) {
      this.callbacks.onError(
        error instanceof Error ? error : new Error('Segmentwechsel fehlgeschlagen.'),
      );
    } finally {
      this.rotating = false;
    }
  }

  private handleTrackEnded = (): void => {
    this.callbacks.onError(
      new Error('Das Mikrofon wurde getrennt. Die bisherige Aufnahme ist gespeichert.'),
    );
  };

  /** Index of the segment currently being written, for UI. */
  get currentSegmentIndex(): number {
    return this.activeIndex;
  }
}
