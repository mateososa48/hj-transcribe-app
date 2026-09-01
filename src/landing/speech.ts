/**
 * A synthetic dictation envelope — the one voice every simulated instrument on
 * the landing page listens to.
 *
 * Bursts of syllables at a talking cadence, breaths between phrases, fast
 * attack and slow release. The WebGL ribbon and the recorder chip's meter bars
 * both sample it, so the page's "voice" is one voice, not three animations
 * that happen to coexist.
 */
export interface SpeechFrame {
  low: number;
  mid: number;
  high: number;
  level: number;
}

export function createSpeechEnvelope() {
  let level = 0;
  let low = 0;
  let high = 0;
  let last = performance.now();

  return (now: number, speakingOverride?: boolean): SpeechFrame => {
    const t = now / 1000;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    // Two slow sines beat against each other so the phrasing never repeats.
    const phrase = Math.sin(t * 0.43) + Math.sin(t * 0.19 + 1.7);
    const speaking = (speakingOverride ?? phrase > -0.35) ? 1 : 0;
    const syllable = Math.max(0, Math.sin(t * 10.7) * 0.6 + Math.sin(t * 6.1 + 0.8) * 0.4);
    const target = speaking * (0.32 + 0.5 * syllable);

    const rate = target > level ? 9 : 3.2;
    level += (target - level) * Math.min(1, rate * dt);
    low += (speaking * (0.45 + 0.25 * Math.sin(t * 1.3)) - low) * Math.min(1, 4 * dt);
    high += (speaking * Math.max(0, Math.sin(t * 13.7)) * 0.5 - high) * Math.min(1, 6 * dt);

    return { low, mid: level * 0.5, high, level };
  };
}
