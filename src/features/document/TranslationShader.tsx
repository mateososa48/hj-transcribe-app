import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The light on the page while a letter is being translated.
 *
 * A fragment shader over the sheet: domain-warped noise carrying the ribbon's
 * rose, violet and amber, drifting slowly enough that you never catch it
 * moving — you look back and it has changed. It is the same instrument the
 * mark and the hero field are made of, so the app has one language of light
 * rather than a special effect for this one job.
 *
 * It sits ON TOP of the writing and stays out of its way by compositing with
 * multiply: the shader paints ink on white, white multiplies to nothing, and
 * only the colour lands. He can read his letter the whole time it is being
 * translated.
 *
 * Rendered at half resolution into a canvas the browser upscales — the field
 * is soft by nature, so nothing is lost. Paused offscreen and on hidden tabs,
 * one still frame under reduced motion, nothing at all without WebGL2 (the
 * spinner in the key is what says it is working; this is atmosphere).
 */

const VERT = `#version 300 es
precision highp float;
void main() {
  ivec2 v = ivec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vec2(v) * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_res;
uniform float u_time;
uniform float u_grain;
uniform float u_strength;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = r * p * 1.9 + vec2(0.7, 0.3);
    a *= 0.45;
  }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // A page is tall and narrow. Reading the field in page space instead of
  // pixel space would stretch every cloud into a vertical streak, so the
  // aspect goes into the coordinate and the shapes stay round.
  vec2 p = uv * vec2(u_res.x / max(u_res.y, 1.0), 1.0) * 3.4;

  // Slow. The whole point of it: the page should look alive when he glances
  // back at it, never busy while he is reading.
  float t = u_time * 0.075;

  // The field TRAVELS as well as morphs. Warping alone changes the colours in
  // place, which reads as a page that shimmers rather than one the light moves
  // across; a slow ellipse under the sample point walks the whole field around
  // the sheet, and the two periods are deliberately unequal so it never
  // retraces the same loop.
  p += vec2(sin(t * 0.52), cos(t * 0.37)) * 0.85;

  vec2 q = vec2(fbm(p * 0.7 + vec2(t, -t * 0.6)), fbm(p * 0.7 + vec2(-t * 0.8, t * 0.5) + 3.1));
  vec2 w = p + 1.25 * (q - 0.5);
  float n1 = fbm(w * 0.6 + vec2(t * 0.3, 0.0));

  // The ribbon's palette, exactly as the instrument defines it in
  // features/record/wave/shaders.ts — blue, violet, rose, amber. One warped
  // field walks the ramp through all four and a slow global drift walks the
  // whole page along it, so every hue is somewhere on the sheet and none of
  // them stays put.
  vec3 cBlue = vec3(0.26, 0.18, 1.00);
  vec3 cViolet = vec3(0.74, 0.17, 0.96);
  vec3 cRose = vec3(1.00, 0.22, 0.52);
  vec3 cAmber = vec3(1.00, 0.66, 0.22);
  float h = fbm(w * 0.85 + vec2(t * 0.25, -t * 0.2) + 5.0);
  h = smoothstep(0.18, 0.82, h) + 0.20 * sin(t * 0.55);
  h = clamp(h, 0.0, 1.0) * 3.0;
  vec3 col = mix(cBlue, cViolet, clamp(h, 0.0, 1.0));
  col = mix(col, cRose, clamp(h - 1.0, 0.0, 1.0));
  col = mix(col, cAmber, clamp(h - 2.0, 0.0, 1.0));
  // A step toward grey, a small one: printed light, not candy.
  col = mix(col, vec3(dot(col, vec3(0.30, 0.59, 0.11))), 0.06);

  // Presence with real swells, so the page has weather rather than a tint.
  // Kept low all the same: this lies over his writing, and the writing wins.
  float d = 0.30 + 0.70 * smoothstep(0.14, 0.86, n1);
  float alpha = clamp(d * 0.19 * u_strength, 0.0, 0.85);

  vec3 ink = col * 0.9 + 0.1;
  vec3 outc = mix(vec3(1.0), ink, alpha);
  outc += (hash(gl_FragCoord.xy + fract(u_time * 0.37) * 100.0) - 0.5) * u_grain * clamp(alpha * 4.0, 0.0, 1.0);
  outColor = vec4(outc, 1.0);
}`;

/** The frame a still page holds under reduced motion. */
const STILL_TIME = 31.7;
const SCALE = 0.5;
/** Beyond this the canvas gains nothing and costs memory on a long letter. */
const MAX_PX = 1400;

export function TranslationShader({
  className,
  active = true,
  strength = 1,
}: {
  className?: string;
  /**
   * Whether the light is on. The canvas keeps drawing through the fade out,
   * so it leaves the way it arrived instead of being cut.
   */
  active?: boolean;
  /** Multiplies the field's presence. The ring runs far bolder than the page. */
  strength?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  /**
   * False for one frame after mounting, so the host has a 0 to transition
   * FROM. Without it the element arrives already opaque and the light snaps
   * on, however long the transition says it is.
   */
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(canvas);

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) {
      canvas.remove();
      setFailed(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      canvas.remove();
      setFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.remove();
      setFailed(true);
      return;
    }
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());
    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uGrain = gl.getUniformLocation(program, 'u_grain');
    gl.uniform1f(gl.getUniformLocation(program, 'u_strength'), strength);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let running = false;
    let visible = document.visibilityState === 'visible';
    let onscreen = true;
    let width = 1;
    let height = 1;
    const started = performance.now();

    const draw = (time: number) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uGrain, window.devicePixelRatio >= 2 ? 0.018 : 0.03);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const tick = () => {
      draw((performance.now() - started) / 1000 + 20);
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (motionQuery.matches) {
        if (running) {
          running = false;
          cancelAnimationFrame(raf);
        }
        draw(STILL_TIME);
        return;
      }
      const should = visible && onscreen;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (!r) return;
      width = Math.max(1, Math.round(Math.min(r.width, MAX_PX) * SCALE));
      height = Math.max(1, Math.round(Math.min(r.height, MAX_PX * 2) * SCALE));
      if (!running) draw(STILL_TIME);
    });
    ro.observe(host);
    const io = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(host);
    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', sync);
    const onLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(raf);
      setFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    sync();

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', onLost);
      cancelAnimationFrame(raf);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [strength]);

  if (failed) return null;

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        // Multiply is what lets it lie on the writing: white passes through,
        // only the colour lands.
        'pointer-events-none absolute inset-0 overflow-hidden [border-radius:inherit] [mix-blend-mode:multiply]',
        'transition-opacity duration-[700ms] ease-in-out motion-reduce:transition-none',
        active && entered ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}
