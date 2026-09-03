/**
 * The recording ribbon — one fragment shader, one full-screen triangle.
 *
 * The whole look is one idea: the SAME sine wave is drawn four times in four
 * spectral colours, each copy phase-shifted by a different amount. Where the
 * wave is flat the four copies sit on top of each other and sum to neutral;
 * where it bends hard the phase offset pushes them apart and the edge splits
 * into a rainbow, the way a prism separates light passing through it at an
 * angle.
 *
 * Each copy is a Lorentzian line — k / (sqrt(d² + soft²) + thickness) — not a
 * stroke. That 1/d falloff gives a tight bright core and a tail that never
 * quite reaches zero, which is what reads as emitted light; a gaussian falls
 * off too fast and looks airbrushed, a hard line has no glow at all.
 */

export const VERT = `#version 300 es
void main(){
  vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uLevel;
uniform float uPresence;
uniform float uWake;
uniform float uWakeLag;
/** 1 for the app mark: a round, evenly-lit figure with no water surface. */
uniform float uMark;

uniform vec3  uPaper;
uniform float uDark;
/** 1: emit a premultiplied transparent layer that composites like the
 *  subtractive light-mode ink on any backdrop, instead of an opaque paper. */
uniform float uTransparent;

out vec4 outColor;

const float PI = 3.14159265359;

vec3 spectral4(int s){

  vec3 c0 = vec3(0.26, 0.18, 1.00);
  vec3 c1 = vec3(0.74, 0.17, 0.96);
  vec3 c2 = vec3(1.00, 0.22, 0.52);
  vec3 c3 = vec3(1.00, 0.66, 0.22);
  return s == 0 ? c0 : s == 1 ? c1 : s == 2 ? c2 : c3;
}

float waveY(float x, float amp, float env, float drift, float harm, float mark){
  // The mark shows several periods rather than half of one. Half a period is
  // a crest that sits to one side and slides across; a few periods travel
  // INSIDE a fixed, symmetric envelope, which is what lets a moving figure
  // still read as a balanced one.
  float f = mix(1.1, 2.9, mark);
  float fundamental = sin(x * f + drift);

  float partial = sin(x * f * 2.3 + drift * 1.6 + 1.7);

  // The travelling tilt is what makes the ribbon lean; a mark must not lean.
  float tilt = 1.0 + 0.14 * (1.0 - mark) * sin(x * 0.42 - drift * 0.6);

  return amp * env * tilt * (fundamental + harm * partial);
}

float thicknessAt(float xN, float uMid){
  float taper = 1.0 - 0.55 * clamp(abs(xN) * 0.75, 0.0, 1.0);
  return (0.012 + 0.010 * taper) * (1.0 + 0.35 * uMid);
}

vec3 ribbon(vec2 p, float aspect, float amp, float spread, float drift,
            float harm, float uMid, float uLevel, float soften, float mark){
  float xN  = p.x / max(aspect, 1.0);
  float env = cos(PI * 0.5 * min(abs(0.92 * xN), 1.0));
  env *= env;

  // A 40px mark cannot carry a hairline, but it must still read as drawn
  // lines: fatter and softer than the instrument, well short of a haze.
  float thick = thicknessAt(xN, uMid) * soften * mix(1.0, 1.45, mark);
  float soft  = (0.013 + 0.010 * uMid) * soften * mix(1.0, 1.35, mark);
  float inten = 0.030 * (1.0 + 0.7 * uLevel) * mix(1.0, 1.5, mark);

  float yMain = waveY(p.x, amp, env, drift, harm, mark);

  vec3 num = vec3(0.0), den = vec3(0.0);
  for (int s = 0; s < 4; s++){
    vec3 hue = spectral4(s);
    den += hue;

    float ab = mix(-spread, spread, float(s) / 3.0);
    float yL = waveY(p.x, amp + 0.03 * uMid, env, drift + ab, harm, mark);

    float d    = abs(p.y - yL);

    float line = inten / (sqrt(d * d + soft * soft) + thick);
    line *= exp(-d * d * mix(1.0, 0.8, mark));

    float lo = min(yMain, yL), hi = max(yMain, yL);
    float dB = max(0.0, max(p.y - hi, lo - p.y));

    float band = 2.2 * inten * exp(-dB / (mix(0.065, 0.080, mark) * soften));

    num += hue * (line + band);
  }

  float denS = (den.r + den.g + den.b) / 3.0;
  vec3 col = num / max(denS, 1e-5);

  float dM = abs(p.y - yMain);
  col += 0.42 * inten / (sqrt(dM * dM + soft * soft) + thick);

  return col;
}

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  vec2 R = uRes;
  float aspect = R.x / R.y;

  vec2 p = (gl_FragCoord.xy + 0.5) * 2.0 / R - 1.0;
  p.x *= aspect;
  float yScreen = p.y;
  p /= 0.62;

  float t = uTime;

  float wake = clamp(uWake, 0.0, 1.0);
  float rest = 1.0 - wake;

  float idleBreath = 0.030 + 0.016 * sin(t * 0.38) * sin(t * 0.17 + 1.0);
  float amp    = mix(idleBreath, 0.20 + 0.34 * uLow, wake) * uPresence;
  // Taller figure inside a narrower one: roundness is the ratio of the two.
  amp = mix(amp, amp * 1.22, uMark);

  float lag    = clamp(uWakeLag, 0.0, 1.0);
  float spread = mix(0.55, 2.2 + 1.6 * uHigh + 0.6 * uMid, lag) * uPresence;
  float harm   = mix(0.10, 0.34 + 0.22 * uHigh, wake);

  float xN    = p.x / max(aspect, 1.0);
  float drift = t * mix(0.30, 0.72, wake);
  // Tighter horizontal falloff on the mark: the ribbon's tails run off the
  // sides of a wide panel, but a mark must close inside its own box, which is
  // also what makes it read round rather than long.
  float ends  = exp(-pow(xN * mix(1.55, 2.15, uMark), 2.0));

  vec3 col = ribbon(p, aspect, amp, spread, drift, harm, uMid, uLevel, 1.0, uMark);

  // The water surface belongs to the recording ribbon. On the mark it read as
  // a stray gleam across the top, and it is the one thing breaking the
  // figure's symmetry.
  if (uMark < 0.5) {
    const float SURFACE = 0.50;
    vec2 rp = vec2(p.x, 2.0 * SURFACE - p.y);
    vec3 refl = ribbon(rp, aspect, amp * 0.86, spread, drift, harm, uMid, uLevel, 2.1, 0.0);

    float underSurface = smoothstep(0.0, 0.16, p.y - SURFACE);

    // The sheen has to die out like light, not stop at a depth.
    //
    // It used to be clamped to zero a fixed distance in — and since the
    // mirrored ribbon is still bright there, that clamp sliced its own glow
    // off flat and drew a horizontal edge across the top of the panel, a line
    // between the ribbon and the white above it. A gaussian tail keeps the
    // same weight where the sheen actually reads and then simply stops being
    // there, with no boundary to see.
    float depth = max(0.0, p.y - SURFACE);
    col += refl * 0.188 * underSurface * exp(-depth * depth * 5.0);
  }

  col = pow(max(col, 0.0), vec3(mix(1.45, 1.15, uMark)));

  float above = smoothstep(1.0, 0.34, -yScreen);
  // Reaches zero AT the top edge, not past it: ending at 1.06 left about 3%
  // of the glow alive in the last row, which the panel edge then cut square.
  float below = smoothstep(1.0, 0.52, yScreen);
  float edge  = yScreen < 0.0 ? above : below;
  // Top and bottom fade identically on the mark — the asymmetric pair above
  // is what made it sit higher on one side.
  edge = mix(edge, smoothstep(1.08, 0.30, abs(yScreen)), uMark);
  col *= edge * ends * uPresence;

  vec3 outc;
  if (uDark > 0.5) {
    outc = col;
  } else {
    float dens = 1.0 - exp(-max(max(col.r, col.g), col.b) * 5.6);

    vec3 hue = col / max(max(max(col.r, col.g), col.b), 1e-6);

    outc = uPaper * (1.0 - dens * (1.0 - hue * 0.55));
    outc = clamp(outc, 0.0, 1.0);
  }

  float g = hash21(gl_FragCoord.xy * 0.75 + fract(uTime) * 91.7);

  vec3 sl = outc * (1.0 - 2.0 * (g - 0.5) * outc) + (2.0 * (g - 0.5)) * sqrt(max(outc, 0.0));
  // Film grain belongs to the instrument. On the mark it speckles the paper,
  // and a speckled patch on a flat white sidebar reads as a different white.
  outc = mix(outc, clamp(sl, 0.0, 1.0), 0.055 * (1.0 - uMark));

  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outc += (n - 0.5) / 255.0 * (1.0 - uMark);

  if (uTransparent > 0.5 && uDark < 0.5) {
    // Light mode paints paper * f. As a layer: keep the chroma of f above a
    // darkness alpha, so on white it composites to exactly f and on a tinted
    // backdrop to very nearly backdrop * f. No opaque ground, no box.
    vec3 f = clamp(outc / max(uPaper, vec3(1e-3)), 0.0, 1.0);
    float m = min(min(f.r, f.g), f.b);
    outColor = vec4(f - vec3(m), 1.0 - m);
  } else if (uTransparent > 0.5) {
    // Dark mode paints light on black. As a layer: the light itself, with an
    // alpha of its brightest channel, so black stays black and the strands
    // glow on whatever dark surface is behind them.
    vec3 l = clamp(outc, 0.0, 1.0);
    outColor = vec4(l, max(max(l.r, l.g), l.b));
  } else {
    outColor = vec4(outc, 1.0);
  }
}`;
