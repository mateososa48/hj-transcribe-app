import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The hero's atmosphere: a fragment shader, not a picture of one.
 *
 * Domain-warped noise lays the ribbon's four spectral hues onto the page's
 * white like ink under light, densest in a band behind the running demo and
 * dissolving to clean white above the headline and below the section. A
 * film grain keeps it from reading as a smooth digital gradient. The field
 * listens to the demo's voice: speech widens the warp and lifts the colour.
 *
 * Rendered at half resolution (the field is soft by nature, so nothing is
 * lost) into a canvas the browser upscales. Paused offscreen and on hidden
 * tabs, one still frame under reduced motion, a CSS field without WebGL2.
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
uniform float u_voice;
uniform float u_grain;

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
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.0 + vec2(0.7, 0.3);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.05;
  float v = u_voice;

  // Warp the space with two slow fields, then read colour from the warped space.
  vec2 q = vec2(fbm(p * 1.2 + vec2(t, -t * 0.6)), fbm(p * 1.2 + vec2(-t * 0.8, t * 0.5) + 3.1));
  vec2 w = p + (1.4 + 0.9 * v) * (q - 0.5);
  float n1 = fbm(w * 1.0 + vec2(t * 0.4, 0.0));
  float n2 = fbm(w * 2.2 + vec2(0.0, -t * 0.3) + 5.0);

  // The ribbon's four hues, in the ribbon's order.
  vec3 c1 = vec3(0.259, 0.188, 1.000);
  vec3 c2 = vec3(0.647, 0.169, 0.847);
  vec3 c3 = vec3(0.851, 0.165, 0.408);
  vec3 c4 = vec3(0.706, 0.439, 0.059);
  vec3 col = mix(c1, c2, smoothstep(0.25, 0.65, n1));
  col = mix(col, c3, smoothstep(0.45, 0.85, n2));
  col = mix(col, c4, smoothstep(0.55, 0.95, n1 * n2 * 2.2));
  // Pull the hues a step toward grey: printed light, not candy.
  col = mix(col, vec3(dot(col, vec3(0.30, 0.59, 0.11))), 0.14);

  // Where the field is lit, and where on the page it is allowed to be.
  float d = smoothstep(0.30, 0.85, n1 * 0.55 + n2 * 0.55);
  float band = exp(-pow((uv.y - 0.36) / 0.30, 2.0));
  float top = 1.0 - smoothstep(0.70, 0.97, uv.y);
  float bottom = smoothstep(0.0, 0.22, uv.y);
  float alpha = d * band * top * bottom * (0.54 + 0.30 * v);

  // Ink on white, lifted so it glows instead of muddying.
  vec3 ink = col * 0.85 + 0.15;
  vec3 outc = mix(vec3(1.0), ink, alpha);
  // Grain lives in the colour and dissolves with it, so the canvas has no edge
  // against the page's white.
  outc += (hash(gl_FragCoord.xy + fract(u_time * 0.37) * 100.0) - 0.5) * u_grain * clamp(alpha * 3.0, 0.0, 1.0);
  outColor = vec4(outc, 1.0);
}`;

const STILL_TIME = 31.7;
const SCALE = 0.5;

export function ShaderField({ className, voice }: { className?: string; voice?: () => number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);

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
      setFallback(true);
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
      setFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.remove();
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uVoice = gl.getUniformLocation(program, 'u_voice');
    const uGrain = gl.getUniformLocation(program, 'u_grain');

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let running = false;
    let visible = document.visibilityState === 'visible';
    let onscreen = true;
    let level = 0;
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
      gl.uniform1f(uVoice, level);
      gl.uniform1f(uGrain, 0.045);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const tick = () => {
      const target = voice ? voice() : 0;
      level += (target - level) * 0.12;
      draw((performance.now() - started) / 1000 + 20);
      raf = requestAnimationFrame(tick);
    };
    const still = () => {
      level = 0;
      draw(STILL_TIME);
    };
    const sync = () => {
      if (motionQuery.matches) {
        if (running) {
          running = false;
          cancelAnimationFrame(raf);
        }
        still();
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
      width = Math.max(1, Math.round(Math.min(r.width, 1800) * SCALE));
      height = Math.max(1, Math.round(r.height * SCALE));
      if (!running) still();
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
      setFallback(true);
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
  }, [voice]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        // A CSS mask dissolves the canvas itself at both ends, so no shader
        // value can ever leave a straight edge against the page.
        'pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_76%,transparent)]',
        className,
      )}
    >
      {fallback ? (
        /* No WebGL2: the same four hues as a quiet CSS field. */
        <div className="absolute inset-0">
          <div className="absolute top-[38%] left-[6%] size-[40rem] rounded-full bg-[#4230ff] opacity-[0.10] blur-[140px]" />
          <div className="absolute top-[42%] right-[4%] size-[36rem] rounded-full bg-[#a52bd8] opacity-[0.09] blur-[140px]" />
          <div className="absolute top-[55%] left-[28%] size-[38rem] rounded-full bg-[#d92a68] opacity-[0.08] blur-[150px]" />
          <div className="absolute top-[60%] right-[24%] size-[30rem] rounded-full bg-[#b4700f] opacity-[0.07] blur-[140px]" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>
      ) : null}
    </div>
  );
}
