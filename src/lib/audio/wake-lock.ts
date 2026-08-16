/**
 * Screen Wake Lock, held for the duration of a recording.
 *
 * The lock is released by the browser whenever the document becomes hidden, and
 * it is NOT restored automatically — so re-acquiring on visibilitychange is the
 * whole point of this wrapper, not a nicety. Without it, HJ tabs away for
 * thirty seconds, Windows sleeps the display, and the session is at risk.
 *
 * Not supported everywhere. Failure is non-fatal: recording continues, the UI
 * just cannot promise the screen stays awake.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  get held(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async acquire(): Promise<boolean> {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    return this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    try {
      await this.sentinel?.release();
    } catch {
      // Already released by the browser; nothing to do.
    }
    this.sentinel = null;
  }

  private async request(): Promise<boolean> {
    if (!ScreenWakeLock.supported) return false;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      return true;
    } catch {
      // Typically: document not visible, or user/policy denial.
      this.sentinel = null;
      return false;
    }
  }

  private handleVisibilityChange = (): void => {
    if (this.wanted && document.visibilityState === 'visible' && !this.held) {
      void this.request();
    }
  };
}
