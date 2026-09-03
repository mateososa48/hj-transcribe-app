import { FRAG, VERT } from './shaders.ts';
import { SignalSource, type BandProbe } from './signal.ts';

/**
 * Resolve any CSS colour string to linear 0..1 RGB.
 *
 * Done through a 1x1 canvas rather than by parsing: the app's tokens are
 * `oklch(...)`, which no hand-written hex/rgb regex handles, and the 2D context
 * already knows how to convert every colour syntax the browser accepts.
 */
function resolveColor(value: string, fallback: [number, number, number]): [number, number, number] {
  if (!value) return fallback;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  // Transparent means "did not parse" or "inherits" — neither is a paper colour.
  if ((a ?? 0) < 250) return fallback;
  return [(r ?? 255) / 255, (g ?? 255) / 255, (b ?? 255) / 255];
}

/**
 * The colour actually behind the canvas.
 *
 * Walks up rather than reading the host: the ribbon is meant to sit directly on
 * whatever surface the layout gives it, and the surrounding layouts put the
 * record screen on different ones. Getting this wrong shows up as a faintly
 * visible rectangle where the canvas ends.
 */
function surfaceBehind(el: HTMLElement): [number, number, number] {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    const resolved = resolveColor(bg, [-1, -1, -1]);
    if (resolved[0] >= 0) return resolved;
    node = node.parentElement;
  }
  return [1, 1, 1];
}

export interface WaveEngineOptions {
  /** Live band energy, or null when nothing is being recorded. */
  probe: BandProbe;
  /**
   * Additive rendering on a dark surface — the ribbon IS the light, the
   * original Siri look. Light mode composites subtractively onto the page.
   * This is the Diktat feature's visual signature.
   */
  dark?: boolean;
  /**
   * When true the ribbon stops drifting on its own and only responds to sound.
   * Reduced motion should silence decoration, not an instrument: a recording
   * indicator that cannot move cannot tell you the microphone is working.
   */
  reducedMotion: boolean;
  /**
   * Render as the app mark: rounder, fatter, evenly lit, and without the
   * water surface. The instrument keeps its own look.
   */
  mark?: boolean;
  /**
   * Paint on a transparent canvas instead of an opaque paper, so the ribbon
   * can sit on any surface without carrying a white (or black) ground with
   * it. The app's own surfaces keep the opaque default.
   */
  transparent?: boolean;
}

export class WaveEngine {
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};

  private readonly signal = new SignalSource();

  private raf = 0;
  private last = 0;
  private running = false;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  private presence = 0;
  private presenceTarget = 0.72;
  private wake = 0;
  private wakeLag = 0;
  /** Shader clock. Frozen under reduced motion so nothing drifts by itself. */
  private clock = 0;
  private reducedMotion: boolean;

  private readonly probe: BandProbe;
  private dark: boolean;
  /** Where the surface is between paper (0) and black (1); eases toward `dark`. */
  private darkMix: number;
  private readonly mark: boolean;
  private readonly transparent: boolean;

  constructor(host: HTMLElement, options: WaveEngineOptions) {
    this.host = host;
    this.reducedMotion = options.reducedMotion;
    this.probe = options.probe;
    this.dark = options.dark ?? false;
    this.darkMix = this.dark ? 1 : 0;
    this.mark = options.mark ?? false;
    this.transparent = options.transparent ?? false;
    this.signal.setProbe(options.probe);

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: this.transparent,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    });
    if (!gl) return;
    this.gl = gl;

    const prog = this.build(gl);
    if (!prog) return;
    this.prog = prog;
    gl.useProgram(prog);

    for (const name of [
      'uRes',
      'uTime',
      'uLow',
      'uMid',
      'uHigh',
      'uLevel',
      'uPresence',
      'uWake',
      'uWakeLag',
      'uPaper',
      'uDark',
      'uMark',
      'uTransparent',
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }

    this.pushPalette();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  get ok(): boolean {
    return Boolean(this.gl && this.prog);
  }

  get live(): boolean {
    return this.signal.live;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  private build(gl: WebGL2RenderingContext): WebGLProgram | null {
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        if (import.meta.env.DEV) console.error('[wave]', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (import.meta.env.DEV) console.error('[wave]', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private pushPalette(): void {
    const gl = this.gl;
    if (!gl) return;
    // The ink composites subtractively onto the page's own surface, so it has
    // to know the exact paper colour it is drawing on. An opaque dark panel
    // never shows ink, so black keeps its output exactly as before.
    const paper = this.dark && !this.transparent ? [0, 0, 0] : surfaceBehind(this.host);
    gl.uniform3fv(this.u.uPaper!, paper);
    gl.uniform1f(this.u.uDark!, this.darkMix);
  }

  /**
   * Move the mark to a dark or a light surface. The change eases over a few
   * hundred milliseconds inside the shader instead of remounting the canvas,
   * so nothing flashes while a header crosses onto a dark slab.
   */
  setDark(dark: boolean): void {
    this.dark = dark;
    this.refreshPalette();
  }

  refreshPalette(): void {
    if (!this.gl || !this.prog) return;
    this.gl.useProgram(this.prog);
    this.pushPalette();
  }

  private resize(): void {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    if (!this.running) this.draw(0, true);
  }

  /** The composed pose the ribbon rests in when it must not move by itself. */
  private static readonly STILL_WAKE = 0.34;

  private draw(dt: number, force = false): void {
    const gl = this.gl;
    if (!gl || !this.prog) return;

    // Reduced motion silences the idle ambience but not the instrument: with no
    // live input there is nothing to report, so the ribbon eases to its still
    // pose and the loop stops drawing entirely.
    const frozen = this.reducedMotion && this.probe() === null;
    if (frozen && this.settled() && !force) return;

    const b = this.signal.read(frozen ? 0 : dt);
    this.clock += this.reducedMotion ? 0 : dt;
    // Waiting is a quiet grey thread; hearing you is a ribbon in full colour.
    // Presence carries that difference on top of amplitude, so the two states
    // are told apart at a glance from across the room.
    this.presenceTarget = this.signal.live ? 1 : 0.72;
    this.presence += (this.presenceTarget - this.presence) * Math.min(1, dt * 3);

    const target = frozen
      ? WaveEngine.STILL_WAKE
      : this.signal.live
        ? Math.min(1, b.level * 1.35)
        : 0.06 + 0.34 * this.signal.envelope;

    // Attack stays brisk so a syllable still registers immediately; it is the
    // drift, not the response, that read as too fast.
    const rate = target > this.wake ? 3.6 : 1.1;
    this.wake += (target - this.wake) * Math.min(1, dt * rate);
    this.wakeLag += (this.wake - this.wakeLag) * Math.min(1, dt * 5);

    // The surface crossing: ~250ms from paper to black or back.
    const darkTarget = this.dark ? 1 : 0;
    this.darkMix += (darkTarget - this.darkMix) * Math.min(1, dt * 10);
    if (Math.abs(darkTarget - this.darkMix) < 0.004) this.darkMix = darkTarget;

    gl.useProgram(this.prog);
    gl.uniform1f(this.u.uDark!, this.darkMix);
    gl.uniform2f(this.u.uRes!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime!, this.clock);
    gl.uniform1f(this.u.uLow!, b.low);
    gl.uniform1f(this.u.uMid!, b.mid);
    gl.uniform1f(this.u.uHigh!, b.high);
    gl.uniform1f(this.u.uLevel!, b.level);
    gl.uniform1f(this.u.uPresence!, this.presence);
    gl.uniform1f(this.u.uWake!, this.wake);
    gl.uniform1f(this.u.uWakeLag!, this.wakeLag);
    gl.uniform1f(this.u.uMark!, this.mark ? 1 : 0);
    gl.uniform1f(this.u.uTransparent!, this.transparent ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** True once nothing is left to animate toward. */
  private settled(): boolean {
    return (
      this.darkMix === (this.dark ? 1 : 0) &&
      Math.abs(this.presence - this.presenceTarget) < 0.002 &&
      Math.abs(this.wake - WaveEngine.STILL_WAKE) < 0.002 &&
      Math.abs(this.wakeLag - WaveEngine.STILL_WAKE) < 0.002
    );
  }

  /** One composed frame, so the panel is never empty before the loop starts. */
  renderStill(): void {
    this.darkMix = this.dark ? 1 : 0;
    this.presence = this.presenceTarget;
    this.wake = WaveEngine.STILL_WAKE;
    this.wakeLag = WaveEngine.STILL_WAKE;
    this.clock = 3.2;
    this.draw(0, true);
  }

  start(): void {
    if (this.running || !this.ok || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamped: a backgrounded tab returns one enormous dt, which would snap
      // every follower to its target at once.
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.ro = null;
    const gl = this.gl;
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.prog = null;
    this.gl = null;
    this.canvas.remove();
  }
}
