/**
 * Microphone level monitoring.
 *
 * One AudioContext + AnalyserNode serves two consumers:
 *   1. the recording indicator (SPEC: live level, unmissable state), and
 *   2. the segment recorder, which rotates on a silence window so a segment
 *      boundary never lands mid-word.
 *
 * Sharing one instance matters — a second AudioContext on the same stream is
 * wasted CPU on a machine that also has to keep MediaRecorder fed.
 */

export interface MicLevelSnapshot {
  /** 0..1, smoothed RMS. Drives the orb. */
  level: number;
  /** True while the input has been below the silence threshold long enough. */
  silent: boolean;
  /** ms the input has been continuously below the silence threshold. */
  silentForMs: number;
}

export interface MicLevelOptions {
  /** RMS below this counts as silence. Room tone sits well under 0.02. */
  silenceThreshold?: number;
  /** Exponential smoothing factor for the displayed level (0..1, higher = snappier). */
  smoothing?: number;
}

const DEFAULTS = {
  silenceThreshold: 0.015,
  smoothing: 0.3,
} satisfies Required<MicLevelOptions>;

export class MicLevelMonitor {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private raf = 0;

  private smoothed = 0;
  private silentSince: number | null = null;
  private readonly opts: Required<MicLevelOptions>;
  private readonly listeners = new Set<(s: MicLevelSnapshot) => void>();

  constructor(
    private readonly stream: MediaStream,
    options: MicLevelOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
  }

  start(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    // Small FFT: we only need amplitude, not spectral detail, and this keeps
    // the per-frame cost negligible.
    this.analyser.fftSize = 1024;
    this.buffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    // Deliberately NOT connected to the destination — monitoring the mic
    // through the speakers would feed back.
    this.tick();
  }

  private tick = (): void => {
    const { analyser, buffer } = this;
    if (!analyser || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i]!;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);

    this.smoothed += (rms - this.smoothed) * this.opts.smoothing;

    const now = performance.now();
    if (rms < this.opts.silenceThreshold) {
      this.silentSince ??= now;
    } else {
      this.silentSince = null;
    }

    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);

    this.raf = requestAnimationFrame(this.tick);
  };

  snapshot(): MicLevelSnapshot {
    const silentForMs = this.silentSince === null ? 0 : performance.now() - this.silentSince;
    return {
      // Perceptual curve: raw RMS barely moves the needle for speech, which
      // makes the indicator look dead when it is working correctly.
      level: Math.min(1, Math.sqrt(this.smoothed) * 3),
      silent: this.silentSince !== null,
      silentForMs,
    };
  }

  subscribe(listener: (s: MicLevelSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close();
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.buffer = null;
    this.listeners.clear();
  }
}
