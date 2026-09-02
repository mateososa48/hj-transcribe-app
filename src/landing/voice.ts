import type { SpeechFrame } from './speech';

/**
 * The hero's one voice, shared by everything that listens to it.
 *
 * The HeroDemo owns the clock and publishes a frame per tick; the full-bleed
 * ribbon behind it samples the latest frame as its probe. So the wave swells
 * while the recorder "hears" speech and settles while the letter is written,
 * instead of two instruments breathing on unrelated timers.
 */
export const SILENCE: SpeechFrame = { low: 0, mid: 0, high: 0, level: 0 };

let current: SpeechFrame = SILENCE;

export function publishVoice(frame: SpeechFrame): void {
  current = frame;
}

export function heroVoice(): SpeechFrame {
  return current;
}
