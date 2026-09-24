import * as THREE from "three";
import type { Splat } from "./sim";

/**
 * Water on the camera glass as a heightfield simulation (ping-pong float
 * texture), not shapes. Each texel holds film thickness, split into:
 *   - a pinned part, held by surface tension at bead sites, and
 *   - a mobile part, which runs downward faster the thicker it is (thin-film
 *     flow), meandering slightly.
 * Splats from particles that reach the lens add water; the splash wall
 * floods from below; when flooding stops the film drains under its own
 * weight, gathering beads on the way and leaving some behind — the
 * behaviour of real water on vertical glass, from a few simple rules.
 */

export const MAX_SPLATS = 64;

const vertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const stepFragment = /* glsl */ `
  uniform sampler2D tPrev;
  uniform float uDt;
  uniform float uTime;
  uniform float uAspect;
  uniform float uFlood;      // 1 while the splash wall is on the glass
  uniform float uLevel;      // flood height (screen fraction from bottom)
  uniform float uDraining;
  uniform float uBoost;      // extra flow above uLevel while draining
  uniform float uPin;        // bead holding capacity (falls as beads let go)
  uniform float uEvap;
  uniform vec4 uSplats[${MAX_SPLATS}];
  uniform int uSplatCount;
  in vec2 vUv;
  out vec4 outColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  // Bead sites: sparse domes on a jittered grid, varied in size. Where the
  // film thins, water can only stay here — which is why drops form.
  float capacity(vec2 uv) {
    vec2 p = uv * vec2(uAspect, 1.0) * 22.0;
    vec2 cell = floor(p);
    float best = 0.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 c = cell + vec2(x, y);
        vec2 h = hash2(c);
        float present = step(0.7, hash(c + 7.3));
        float r = mix(0.12, 0.62, pow(hash(c + 3.1), 3.0));
        float d = length(p - (c + 0.2 + 0.6 * h)) / r;
        best = max(best, present * max(0.0, 1.0 - d * d) * mix(0.35, 1.0, hash(c + 1.9)));
      }
    return best * uPin;
  }

  float mobile(vec2 uv) {
    if (uv.y > 1.0) return 0.0;
    uv.x = clamp(uv.x, 0.0, 1.0);
    float h = texture(tPrev, uv).r;
    return max(h - min(h, capacity(uv)), 0.0);
  }

  void main() {
    vec2 texel = 1.0 / vec2(textureSize(tPrev, 0));
    float h = texture(tPrev, vUv).r;
    float cap = capacity(vUv);
    float pinned = min(h, cap);

    // Thin-film flow: speed rises steeply with thickness; draining gets a
    // push above the (timeline) water line so the glass clears on cue.
    float mHere = h - pinned;
    float mAbove = mobile(vUv + vec2(0.0, 2.0 * texel.y));
    float m = max(mHere, mAbove);
    // The drain line is irregular — water lets go of the glass unevenly.
    float line = uLevel + 0.09 * (noise(vec2(vUv.x * uAspect * 2.5, uTime * 0.4)) - 0.5) + 0.05 * (noise(vec2(vUv.x * uAspect * 9.0, 3.0)) - 0.5);
    float speed = 1.35 * pow(clamp(m, 0.0, 1.5), 1.5) + uBoost * uDraining * (0.55 + 0.45 * smoothstep(line - 0.15, line + 0.15, vUv.y)) * step(0.002, m);
    float wander = (noise(vec2(vUv.x * 30.0, vUv.y * 7.0 + uTime * 0.9)) - 0.5) * 6.0 * texel.x * step(0.002, m);
    vec2 src = vUv + vec2(wander, speed * uDt);
    // Films spread sideways and smooth themselves (surface tension); a
    // little diffusion of the moving water stops vertical flow from carving
    // straight-sided columns and row-to-row banding.
    float mc = mobile(src);
    float ml = mobile(src - vec2(texel.x, 0.0));
    float mr = mobile(src + vec2(texel.x, 0.0));
    float mu = mobile(src + vec2(0.0, texel.y));
    float md = mobile(src - vec2(0.0, texel.y));
    float mSmooth = mix(mc, (ml + mr) * 0.32 + (mu + md) * 0.18, 0.5);
    float next = pinned + mSmooth * (1.0 - 0.02 * uDt);

    // Splash wall: floods from below with a torn, heaving front.
    if (uFlood > 0.0) {
      float x = vUv.x * uAspect;
      float front = uLevel
        + 0.14 * (noise(vec2(x * 2.6, uTime * 1.3)) - 0.5)
        + 0.12 * pow(noise(vec2(x * 8.0, uTime * 2.1)), 3.0)
        + 0.05 * (noise(vec2(x * 21.0, uTime * 3.0)) - 0.5);
      float body = smoothstep(front, front - 0.05, vUv.y);
      // A splash on glass is never an even sheet: ropes and thin windows,
      // all sliding down. That unevenness is what the eye reads as water.
      vec2 q = vec2(x * 4.0, vUv.y * 2.2 + uTime * 0.9);
      float ropes = noise(q) * 0.6 + noise(q * 2.3 + 5.1) * 0.3 + noise(q * 5.1 + 2.7) * 0.1;
      float target = body * (0.22 + 0.7 * ropes) * uFlood;
      next = max(next, target);
    }

    // Drops arriving from the scene.
    for (int i = 0; i < ${MAX_SPLATS}; i++) {
      if (i >= uSplatCount) break;
      vec4 s = uSplats[i];
      vec2 d = (vUv - s.xy) * vec2(uAspect, 1.0);
      next += s.w * exp(-dot(d, d) / (s.z * s.z));
    }

    next *= 1.0 - uEvap * uDt;
    outColor = vec4(clamp(next, 0.0, 1.1), 0.0, 0.0, 1.0);
  }
`;

export class LensWater {
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private mat: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private splatUniform: THREE.Vector4[];
  private dirty = true;
  active = false;

  constructor(private baseWidth: number) {
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.splatUniform = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: stepFragment,
      uniforms: {
        tPrev: { value: null },
        uDt: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uFlood: { value: 0 },
        uLevel: { value: -0.3 },
        uDraining: { value: 0 },
        uBoost: { value: 0 },
        uPin: { value: 0.22 },
        uEvap: { value: 0 },
        uSplats: { value: this.splatUniform },
        uSplatCount: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  get texture() {
    return this.a.texture;
  }

  setAspect(aspect: number) {
    const w = this.baseWidth;
    const h = Math.round(Math.min(Math.max(w / aspect, 140), 900));
    if (this.a.width !== w || this.a.height !== h) {
      this.a.setSize(w, h);
      this.b.setSize(w, h);
      this.dirty = true;
    }
    this.mat.uniforms.uAspect.value = aspect;
  }

  clear(gl: THREE.WebGLRenderer) {
    const prev = gl.getRenderTarget();
    for (const t of [this.a, this.b]) {
      gl.setRenderTarget(t);
      gl.clear(true, false, false);
    }
    gl.setRenderTarget(prev);
    this.dirty = false;
  }

  step(
    gl: THREE.WebGLRenderer,
    p: { dt: number; time: number; flood: number; level: number; draining: number; boost: number; pin: number; evap: number },
    splats: Splat[],
  ) {
    if (this.dirty) this.clear(gl);
    const u = this.mat.uniforms;
    // Sub-step so fast films never skip more than ~2 texels per step.
    const steps = Math.min(4, Math.max(1, Math.ceil(p.dt / (1 / 90))));
    const dt = p.dt / steps;
    const count = Math.min(splats.length, MAX_SPLATS);
    for (let i = 0; i < count; i++) {
      const s = splats[i];
      this.splatUniform[i].set(s.u, s.v, s.r, s.amount);
    }
    for (let k = 0; k < steps; k++) {
      u.tPrev.value = this.a.texture;
      u.uDt.value = dt;
      u.uTime.value = p.time + dt * k;
      u.uFlood.value = p.flood;
      u.uLevel.value = p.level;
      u.uDraining.value = p.draining;
      u.uBoost.value = p.boost;
      u.uPin.value = p.pin;
      u.uEvap.value = p.evap;
      u.uSplatCount.value = k === 0 ? count : 0;
      gl.setRenderTarget(this.b);
      gl.render(this.scene, this.cam);
      const t = this.a;
      this.a = this.b;
      this.b = t;
    }
    gl.setRenderTarget(null);
  }

  markDirty() {
    this.dirty = true;
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
