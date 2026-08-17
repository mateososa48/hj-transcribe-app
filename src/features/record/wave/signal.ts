/**
 * What drives the ribbon.
 *
 * Two sources, and the difference between them matters more than it looks:
 *
 *  - LIVE. Real band energy from the microphone the recorder is already using.
 *    The app opens exactly one stream and one AudioContext (see MicLevelMonitor);
 *    this file never touches getUserMedia, so nothing extra is captured.
 *  - IDLE. A simulated signal, so the screen has something to show before a
 *    recording starts. Layered sines at incommensurate rates, so it never
 *    visibly loops.
 *
 * The simulation is only ever used when NOTHING is being recorded. While a
 * recording runs the ribbon shows real input or it shows silence — an indicator
 * that animates whether or not the microphone works is worse than no indicator,
 * because it answers "is it hearing me?" with a guess.
 */

export interface Bands {
  low: number;
  mid: number;
  high: number;
  level: number;
}

/** Returns live band energy, or null when nothing is being recorded. */
export type BandProbe = () => Bands | null;

const PHRASES: { speak: number; pause: number; force: number }[] = [
  { speak: 2.6, pause: 1.5, force: 0.85 },
  { speak: 1.3, pause: 0.9, force: 0.55 },
  { speak: 3.9, pause: 2.1, force: 1.0 },
  { speak: 1.8, pause: 1.2, force: 0.7 },
  { speak: 3.1, pause: 2.6, force: 0.9 },
  { speak: 1.1, pause: 1.7, force: 0.45 },
];

function phraseEnvelope(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const attack = Math.min(1, u / 0.18);
  const release = Math.min(1, (1 - u) / 0.55);

  const a = attack * attack * (3 - 2 * attack);
  const r = release * release * (3 - 2 * release);
  return a * r;
}

/**
 * Asymmetric envelope follower: fast attack, slow release, so the ribbon snaps
 * open on a syllable and eases back instead of jittering once per frame.
 */
function follow(current: number, target: number, dt: number, attack: number, release: number) {
  const rate = target > current ? attack : release;
  return current + (target - current) * Math.min(1, dt * rate);
}

export class SignalSource {
  private bands: Bands = { low: 0, mid: 0, high: 0, level: 0 };
  private clock = 0;

  private phraseIdx = 0;
  private phraseT = 0;
  private phraseEnv = 0;

  private probe: BandProbe | null = null;

  /** True while real microphone data is arriving. */
  private liveNow = false;

  get envelope(): number {
    return this.phraseEnv;
  }

  get live(): boolean {
    return this.liveNow;
  }

  setProbe(probe: BandProbe | null): void {
    this.probe = probe;
  }

  private phrase(dt: number): number {
    this.phraseT += dt;
    const p = PHRASES[this.phraseIdx % PHRASES.length]!;
    const total = p.speak + p.pause;
    if (this.phraseT >= total) {
      this.phraseT -= total;
      this.phraseIdx = (this.phraseIdx + 1) % PHRASES.length;
    }
    const cur = PHRASES[this.phraseIdx % PHRASES.length]!;

    const u = this.phraseT / cur.speak;
    this.phraseEnv = u >= 1 ? 0 : phraseEnvelope(u) * cur.force;
    return this.phraseEnv;
  }

  read(dt: number): Bands {
    this.clock += dt;
    const b = this.bands;
    const raw = this.probe?.() ?? null;
    this.liveNow = raw !== null;

    if (raw) {
      // Soft knee: raw band energy on a quiet consulting-room voice sits low
      // enough that a linear map barely moves the wave.
      const g = (v: number) => {
        const x = v * 2.3;
        return x / (1 + x * 0.55);
      };

      b.low = follow(b.low, g(raw.low), dt, 9, 3.5);
      b.mid = follow(b.mid, g(raw.mid), dt, 10, 4);
      b.high = follow(b.high, g(raw.high), dt, 11, 4.5);
      b.level = follow(b.level, g(raw.level), dt, 8, 3);
      return b;
    }

    const t = this.clock;
    const env = this.phrase(dt);

    const shapeLow = env;
    const shapeMid = Math.pow(env, 0.85);
    const shapeHigh = Math.pow(env, 1.35);

    // Damped hard. The resting ribbon has to look unmistakably quieter than the
    // recording one, or the indicator stops distinguishing the two states —
    // which is the only thing it is for.
    const idle = 0.3;
    const low = (0.45 + 0.45 * Math.sin(t * 0.8) * Math.sin(t * 0.37 + 1.0)) * shapeLow * idle;
    const mid = (0.4 + 0.4 * Math.sin(t * 1.7 + 2.0) * Math.sin(t * 0.53)) * shapeMid * idle;
    const high = (0.3 + 0.3 * Math.sin(t * 2.9 + 4.0) * Math.sin(t * 0.71 + 2.0)) * shapeHigh * idle;
    b.low = follow(b.low, Math.max(0, low), dt, 10, 6);
    b.mid = follow(b.mid, Math.max(0, mid), dt, 12, 7);
    b.high = follow(b.high, Math.max(0, high), dt, 14, 8);
    b.level = follow(b.level, Math.max(0, (low + mid + high) / 2.4), dt, 10, 5);
    return b;
  }
}
