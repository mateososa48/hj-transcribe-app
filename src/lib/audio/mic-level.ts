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
  /** 0..1 energy per band. Drives the recording wave. See BANDS below. */
  low: number;
  mid: number;
  high: number;
}

/**
 * Bands in Hz, not in thirds of the FFT array.
 *
 * An FFT is linear in Hz but hearing is logarithmic: splitting the bins evenly
 * puts almost the whole speech range into the lowest third and leaves the other
 * two reading near zero on a voice. These ranges are roughly fundamental /
 * vowel formants / sibilance, which is what makes a spoken sentence visibly
 * move all three.
 */
export const BANDS = {
  low: [60, 320],
  mid: [320, 1600],
  high: [1600, 6000],
} as const;

/**
 * The FFT bins covering [loHz, hiHz), as a half-open [from, to) range.
 *
 * Pulled out of the class so the mapping can be tested without an AudioContext.
 * This is the step that is easy to get wrong: splitting the bin array into
 * thirds looks equivalent and is not.
 */
export function binRange(
  loHz: number,
  hiHz: number,
  binHz: number,
  binCount: number,
): [number, number] {
  if (!binHz || binCount <= 0) return [0, 0];
  const from = Math.max(0, Math.floor(loHz / binHz));
  const to = Math.min(binCount, Math.ceil(hiHz / binHz));
  return to <= from ? [0, 0] : [from, to];
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
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private binHz = 0;
  private bands = { low: 0, mid: 0, high: 0 };
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
    this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.binHz = this.context.sampleRate / this.analyser.fftSize;
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
    this.readBands();

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

  /** Mean magnitude of the bins covering [loHz, hiHz), normalised to 0..1. */
  private bandEnergy(loHz: number, hiHz: number): number {
    const freq = this.freq;
    if (!freq) return 0;
    const [from, to] = binRange(loHz, hiHz, this.binHz, freq.length);
    if (to <= from) return 0;
    let sum = 0;
    for (let i = from; i < to; i++) sum += freq[i]!;
    return sum / (to - from) / 255;
  }

  private readBands(): void {
    const { analyser, freq } = this;
    if (!analyser || !freq) return;
    analyser.getByteFrequencyData(freq);
    this.bands = {
      low: this.bandEnergy(...BANDS.low),
      mid: this.bandEnergy(...BANDS.mid),
      high: this.bandEnergy(...BANDS.high),
    };
  }

  /**
   * Forget how long the room has been quiet, without touching the levels.
   *
   * Needed when a recording resumes from a pause. The monitor keeps listening
   * while paused — the microphone is still held — so a minute of deliberate
   * silence accumulates in `silentSince`, and the dead-input watch would fire
   * "no sound for over 15 seconds" the instant recording resumed. The silence
   * was real; treating it as a fault is what would be wrong.
   */
  resetSilence(): void {
    this.silentSince = null;
  }

  snapshot(): MicLevelSnapshot {
    const silentForMs = this.silentSince === null ? 0 : performance.now() - this.silentSince;
    return {
      ...this.bands,
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
    this.freq = null;
    this.bands = { low: 0, mid: 0, high: 0 };
    this.listeners.clear();
  }
}
