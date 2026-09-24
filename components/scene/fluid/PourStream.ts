import * as THREE from "three";
import { SLICE_CAP, type FluidSim } from "./sim";
import { opticsChunk } from "./optics";

/**
 * The falling column, as one continuous surface.
 *
 * Each slice of water the sim released follows an exact ballistic path, so
 * at any instant the column is the curve through every slice's current
 * position. A tube is swept along that curve every frame, and its shape
 * comes from the physics of a real pour rather than from noise:
 *
 *  - Continuity: flow is constant along the column, so as water accelerates
 *    its cross-section shrinks (r ∝ √(Q/|v|)). Thick at the lip, a thread by
 *    the floor.
 *  - The bottle gulps air, so flow pulses — and each pulse travels down the
 *    column as a swelling, stretching as it falls.
 *  - A jet from a non-circular lip oscillates between ellipses at right
 *    angles, decaying as it falls; highlights visibly twist.
 *  - Rayleigh–Plateau: small varicose ripples ride on the surface and grow
 *    with age, most visible where the column is thinnest.
 *  - The leading edge is a rounded, slightly swollen head.
 *
 * Ripples use the slice's *emission time* as a material coordinate, so
 * surface detail is carried by the water and stretches with it.
 */

const RINGS = { high: 220, low: 120 } as const;
const RADIAL = { high: 20, low: 12 } as const;
const CAP = 6;

/** Radius at the lip at full flow (world units; ≈ 1 cm for a 750 ml bottle). */
const R_LIP = 0.084;
const V_REF = 0.78;
const R_MAX = 0.11;

const vertex = /* glsl */ `
  in vec3 aCenter;
  in vec3 aAxis;
  in vec4 aInfo; // radius, tau, age, theta
  out vec3 vWorld;
  out vec3 vNormal;
  out vec3 vCenter;
  out vec3 vAxis;
  out vec4 vInfo;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vCenter = aCenter;
    vAxis = aAxis;
    vInfo = aInfo;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform mat4 uViewProj;
  in vec3 vWorld;
  in vec3 vNormal;
  in vec3 vCenter;
  in vec3 vAxis;
  in vec4 vInfo;
  out vec4 outColor;

  ${opticsChunk}

  // Where the world behind is found for a ray that crossed the column:
  // refract in at the front surface, cross the circular section, refract
  // out at the back (or reflect, past the critical angle). A cylinder
  // of water is a lens — the background is flipped and squeezed into it,
  // which is why a backlit pour shows a bright core and dark edges.
  vec3 throughColumn(vec3 P, vec3 V, vec3 N, float eta, out float chord) {
    vec3 d1 = refract(-V, N, 1.0 / eta);
    vec3 T = vAxis;
    vec3 w = P - vCenter; w -= T * dot(w, T);
    vec3 dp = d1 - T * dot(d1, T);
    float a = max(dot(dp, dp), 1e-6);
    // A ray nearly parallel to the axis would travel "forever"; the
    // longest chord through a circle is its diameter.
    chord = clamp(-2.0 * dot(w, dp) / a, 0.0, 2.0 * length(w));
    vec3 Q = P + d1 * chord;
    vec3 n2 = Q - vCenter; n2 -= T * dot(n2, T);
    n2 = normalize(n2 + 1e-6);
    vec3 d2 = refract(d1, -n2, eta);
    if (dot(d2, d2) < 1e-4) d2 = reflect(d1, -n2);
    // The set behind is ~4.5 units back; project the exit ray there.
    vec4 c = uViewProj * vec4(Q + d2 * 4.5, 1.0);
    vec2 uv = c.xy / max(c.w, 1e-3) * 0.5 + 0.5;
    return texture(tScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
  }

  void main() {
    float radius = vInfo.x;
    float tau = vInfo.y;
    float age = vInfo.z;
    float theta = vInfo.w;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormal);
    if (dot(N, V) < 0.0) N = -N;

    // Surface detail carried by the water. Ripples are stretched along the
    // flow as the column accelerates, so detail varies quickly *around* the
    // column and slowly along it: highlights become long glassy strands.
    // Water leaving the lip is still smooth; texture grows as it falls.
    vec2 q = vec2(theta * 1.6 + tau * 3.0, tau * 22.0);
    float s1 = sin(q.x * 3.0 + sin(q.y) * 1.7 + tau * 9.0);
    float s2 = sin(q.x * 5.0 - q.y * 0.6 + 2.1);
    vec3 side = normalize(cross(vAxis, N) + 1e-6);
    float grow = smoothstep(0.05, 0.7, age);
    N = normalize(N + side * (s1 * 0.12 + s2 * 0.05) * grow);

    float NdV = clamp(dot(N, V), 0.0, 1.0);
    float F = fresnelWater(NdV);

    // Dispersion: each channel takes its own path through the column.
    float chord;
    vec3 trans;
    trans.r = throughColumn(vWorld, V, N, 1.326, chord).r;
    trans.g = throughColumn(vWorld, V, N, 1.333, chord).g;
    trans.b = throughColumn(vWorld, V, N, 1.344, chord).b;
    // A glacial trace: the long path through the core loses a little red.
    trans *= exp(-chord * vec3(1.6, 0.45, 0.35));

    // The studio in the surface. Softboxes are far brighter than the set
    // behind, which is what makes water on black read as a line of light.
    vec3 R = reflect(-V, N);
    vec3 refl = studio(R) * 2.4;

    // The second highlight of a glass rod: light reflected once inside the
    // column, leaving near the opposite edge.
    vec3 d1 = refract(-V, N, 1.0 / 1.333);
    vec3 w = vWorld - vCenter; w -= vAxis * dot(w, vAxis);
    vec3 dp = d1 - vAxis * dot(d1, vAxis);
    float t = clamp(-2.0 * dot(w, dp) / max(dot(dp, dp), 1e-6), 0.0, 2.0 * length(w));
    vec3 Qe = vWorld + d1 * t;
    vec3 ne = Qe - vCenter; ne -= vAxis * dot(ne, vAxis); ne = normalize(ne + 1e-6);
    float Fi = fresnelWater(abs(dot(d1, ne)));
    vec3 inner = studio(reflect(d1, -ne)) * Fi * (1.0 - F) * 1.6;

    vec3 col = trans * (1.0 - F) + refl * F + inner;

    // Analytic coverage at the silhouette: the surface turns edge-on over
    // less than a pixel, so fade by how fast N·V changes on screen.
    float nv = abs(dot(normalize(vNormal), V));
    float cov = clamp(nv / max(fwidth(nv) * 1.2, 1e-4), 0.0, 1.0);
    outColor = vec4(max(col, vec3(0.0)), cov);
  }
`;

const copyVertex = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const copyFragment = /* glsl */ `
  uniform sampler2D tScene;
  in vec2 vUv;
  out vec4 outColor;
  void main() { outColor = texture(tScene, vUv); }
`;

type Tier = "high" | "low";

export class PourStream {
  readonly mesh: THREE.Mesh;
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private copy: THREE.Mesh;
  private copyMat: THREE.ShaderMaterial;
  readonly target: THREE.WebGLRenderTarget;

  private rings: number;
  private radial: number;
  private total: number;

  private pos: Float32Array;
  private nrm: Float32Array;
  private center: Float32Array;
  private axis: Float32Array;
  private info: Float32Array;
  private attrs: THREE.BufferAttribute[];

  // Spine, newest (lip) first.
  private sp = new Float32Array(SLICE_CAP * 3);
  private sv = new Float32Array(SLICE_CAP);
  private sq = new Float32Array(SLICE_CAP);
  private st = new Float32Array(SLICE_CAP);
  private sa = new Float32Array(SLICE_CAP);
  private ss = new Float32Array(SLICE_CAP);

  // Resampled rings.
  private rc: Float32Array;
  private rt: Float32Array;
  private rr: Float32Array;
  private rtau: Float32Array;
  private rage: Float32Array;
  private rn: Float32Array;
  private rb: Float32Array;
  /** Per cap ring: axial component of the hemisphere normal (±x). */
  private capSlope: Float32Array;

  private viewProj = new THREE.Matrix4();
  visible = false;

  constructor(tier: Tier) {
    this.rings = RINGS[tier];
    this.radial = RADIAL[tier];
    this.total = this.rings + CAP * 2;
    const nv = this.total * (this.radial + 1);
    this.pos = new Float32Array(nv * 3);
    this.nrm = new Float32Array(nv * 3);
    this.center = new Float32Array(nv * 3);
    this.axis = new Float32Array(nv * 3);
    this.info = new Float32Array(nv * 4);
    const R = this.total;
    this.rc = new Float32Array(R * 3);
    this.rt = new Float32Array(R * 3);
    this.rn = new Float32Array(R * 3);
    this.rb = new Float32Array(R * 3);
    this.rr = new Float32Array(R);
    this.rtau = new Float32Array(R);
    this.rage = new Float32Array(R);
    this.capSlope = new Float32Array(R);

    const geo = new THREE.BufferGeometry();
    const mk = (arr: Float32Array, size: number) => {
      const a = new THREE.BufferAttribute(arr, size);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.attrs = [mk(this.pos, 3), mk(this.nrm, 3), mk(this.center, 3), mk(this.axis, 3), mk(this.info, 4)];
    geo.setAttribute("position", this.attrs[0]);
    geo.setAttribute("normal", this.attrs[1]);
    geo.setAttribute("aCenter", this.attrs[2]);
    geo.setAttribute("aAxis", this.attrs[3]);
    geo.setAttribute("aInfo", this.attrs[4]);
    const index: number[] = [];
    const row = this.radial + 1;
    for (let i = 0; i < R - 1; i++) {
      for (let j = 0; j < this.radial; j++) {
        const a = i * row + j;
        const b = a + row;
        // Counter-clockwise seen from outside: (N, B, T) is right-handed.
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    geo.setIndex(index);

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        tScene: { value: null },
        uViewProj: { value: this.viewProj },
        uEnvRot: { value: 0 },
        uBacklight: { value: 0 },
      },
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;

    this.copyMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: copyVertex,
      fragmentShader: copyFragment,
      uniforms: { tScene: { value: null } },
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    this.copy.frustumCulled = false;
    this.copy.renderOrder = -10;
    this.scene.add(this.copy, this.mesh);

    // The column is thin on screen; MSAA is what keeps it from shimmering.
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: tier === "high" ? 4 : 0,
      depthBuffer: true,
      stencilBuffer: false,
    });
  }

  setSize(w: number, h: number) {
    this.target.setSize(w, h);
  }

  /** Rebuild the column from the sim's slices at time `now`. */
  update(sim: FluidSim, now: number, floorY: number, gravity: number) {
    const n = sim.sliceCount;
    let m = 0;
    let grounded = false;
    let hx = 0;
    let hy = 0;
    let hz = 0;
    for (let k = 0; k < n; k++) {
      const idx = (sim.sliceHead - 1 - k + SLICE_CAP) % SLICE_CAP;
      const t0 = sim.sliceT[idx];
      const age = now - t0;
      if (age < 0) continue;
      const o = idx * 3;
      const vx = sim.sliceV[o];
      const vy0 = sim.sliceV[o + 1];
      const vz = sim.sliceV[o + 2];
      const x = sim.sliceP[o] + vx * age;
      const y = sim.sliceP[o + 1] + vy0 * age - 0.5 * gravity * age * age;
      const z = sim.sliceP[o + 2] + vz * age;
      const vy = vy0 - gravity * age;
      if (y <= floorY) {
        // Land the column exactly on the floor between this slice and the last.
        if (m > 0) {
          const f = (hy - floorY) / Math.max(hy - y, 1e-6);
          const w = m * 3;
          this.sp[w] = hx + (x - hx) * f;
          this.sp[w + 1] = floorY;
          this.sp[w + 2] = hz + (z - hz) * f;
          this.sv[m] = this.sv[m - 1];
          this.sq[m] = sim.sliceQ[idx];
          this.st[m] = t0;
          this.sa[m] = age;
          m++;
        }
        grounded = true;
        break;
      }
      const w = m * 3;
      this.sp[w] = x;
      this.sp[w + 1] = y;
      this.sp[w + 2] = z;
      this.sv[m] = Math.hypot(vx, vy, vz);
      this.sq[m] = sim.sliceQ[idx];
      this.st[m] = t0;
      this.sa[m] = age;
      hx = x;
      hy = y;
      hz = z;
      m++;
    }
    // Still connected to the bottle if the newest slice is fresh.
    const attached = n > 0 && now - sim.sliceT[(sim.sliceHead - 1 + SLICE_CAP) % SLICE_CAP] < 0.02;
    if (m < 2) {
      this.visible = false;
      return;
    }

    // Arc length.
    this.ss[0] = 0;
    for (let i = 1; i < m; i++) {
      const a = (i - 1) * 3;
      const b = i * 3;
      this.ss[i] = this.ss[i - 1] + Math.hypot(this.sp[b] - this.sp[a], this.sp[b + 1] - this.sp[a + 1], this.sp[b + 2] - this.sp[a + 2]);
    }
    const L = this.ss[m - 1];
    if (L < 1e-3) {
      this.visible = false;
      return;
    }
    this.visible = true;

    // Resample the body evenly by arc length into rings CAP .. CAP+RINGS-1.
    const body = this.rings;
    let seg = 0;
    for (let r = 0; r < body; r++) {
      const s = (r / (body - 1)) * L;
      while (seg < m - 2 && this.ss[seg + 1] < s) seg++;
      const s0 = this.ss[seg];
      const s1 = this.ss[seg + 1];
      const f = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
      const a = seg * 3;
      const b = a + 3;
      const ri = CAP + r;
      const c = ri * 3;
      this.rc[c] = this.sp[a] + (this.sp[b] - this.sp[a]) * f;
      this.rc[c + 1] = this.sp[a + 1] + (this.sp[b + 1] - this.sp[a + 1]) * f;
      this.rc[c + 2] = this.sp[a + 2] + (this.sp[b + 2] - this.sp[a + 2]) * f;
      const speed = this.sv[seg] + (this.sv[seg + 1] - this.sv[seg]) * f;
      const q = this.sq[seg] + (this.sq[seg + 1] - this.sq[seg]) * f;
      const tau = this.st[seg] + (this.st[seg + 1] - this.st[seg]) * f;
      const age = this.sa[seg] + (this.sa[seg + 1] - this.sa[seg]) * f;
      this.rtau[ri] = tau;
      this.rage[ri] = age;

      // Continuity: A·|v| = Q.
      let rad = Math.min(R_LIP * Math.sqrt(Math.max(q, 0) * (V_REF / Math.max(speed, 0.2))), R_MAX);
      // Rayleigh–Plateau: a column is unstable to swellings about nine radii
      // long, which at the lip's speed is a few per second of flow. They
      // start invisible and grow as the water falls.
      const grow = 0.015 + 0.1 * Math.min(age / 0.8, 1) ** 1.5;
      rad *= 1 + grow * (0.6 * Math.sin(tau * 2 * Math.PI * 6.3) + 0.4 * Math.sin(tau * 2 * Math.PI * 10.7 + 1.3));
      // The head: a rounded, swollen leading drop.
      if (!grounded) {
        const dh = (L - s) / Math.max(rad * 3, 1e-4);
        rad *= 1 + 0.38 * Math.exp(-dh * dh);
      }
      this.rr[ri] = Math.max(rad, 0);
    }

    // Tangents (central differences) and a parallel-transported frame, so
    // the surface never twists on its own.
    const first = CAP;
    const last = CAP + body - 1;
    for (let i = first; i <= last; i++) {
      const a = Math.max(i - 1, first) * 3;
      const b = Math.min(i + 1, last) * 3;
      let tx = this.rc[b] - this.rc[a];
      let ty = this.rc[b + 1] - this.rc[a + 1];
      let tz = this.rc[b + 2] - this.rc[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const c = i * 3;
      this.rt[c] = tx;
      this.rt[c + 1] = ty;
      this.rt[c + 2] = tz;
      let nx: number, ny: number, nz: number;
      if (i === first) {
        // Start with the normal in the vertical plane of the pour.
        nx = -ty * tx;
        ny = 1 - ty * ty;
        nz = -ty * tz;
        if (nx * nx + ny * ny + nz * nz < 1e-6) {
          nx = 1;
          ny = 0;
          nz = 0;
        }
      } else {
        const p = c - 3;
        nx = this.rn[p];
        ny = this.rn[p + 1];
        nz = this.rn[p + 2];
        const d = nx * tx + ny * ty + nz * tz;
        nx -= d * tx;
        ny -= d * ty;
        nz -= d * tz;
      }
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      this.rn[c] = nx;
      this.rn[c + 1] = ny;
      this.rn[c + 2] = nz;
      this.rb[c] = ty * nz - tz * ny;
      this.rb[c + 1] = tz * nx - tx * nz;
      this.rb[c + 2] = tx * ny - ty * nx;
    }

    // End caps: hemispheres continuing the frame beyond each end. At the lip
    // the column is still attached, so the cap folds back inside the neck.
    for (let k = 0; k < CAP; k++) {
      const x = 1 - k / CAP; // 1 at the pole
      this.cap(k, first, -1, x, attached ? 0.35 : 1);
      this.cap(CAP + body + (CAP - 1 - k), last, 1, x, 1);
    }

    this.writeVertices();
  }

  private cap(ri: number, from: number, dir: number, x: number, reach: number) {
    const c = ri * 3;
    const f = from * 3;
    const r0 = this.rr[from];
    for (let e = 0; e < 3; e++) {
      this.rc[c + e] = this.rc[f + e] + this.rt[f + e] * dir * r0 * x * reach;
      this.rt[c + e] = this.rt[f + e];
      this.rn[c + e] = this.rn[f + e];
      this.rb[c + e] = this.rb[f + e];
    }
    this.rr[ri] = r0 * Math.sqrt(Math.max(1 - x * x, 0));
    this.rtau[ri] = this.rtau[from];
    this.rage[ri] = this.rage[from];
    this.capSlope[ri] = dir * x;
  }

  private writeVertices() {
    const row = this.radial + 1;
    const R = this.total;
    const TWO_PI = Math.PI * 2;
    const bodyFirst = CAP;
    const bodyLast = CAP + this.rings - 1;
    for (let i = 0; i < R; i++) {
      const c = i * 3;
      const inBody = i >= bodyFirst && i <= bodyLast;
      const r = this.rr[i];
      const age = this.rage[i];
      const tau = this.rtau[i];
      // Oscillating jet: an ellipse that swaps axes as it falls and decays.
      const ecc = 0.12 * Math.exp(-age * 2.4) * Math.cos(age * 17);
      // Axial slope of the surface (dr/ds) tilts normals along the axis.
      let slope: number;
      if (inBody) {
        const a = Math.max(i - 1, bodyFirst);
        const b = Math.min(i + 1, bodyLast);
        const ds = Math.hypot(this.rc[b * 3] - this.rc[a * 3], this.rc[b * 3 + 1] - this.rc[a * 3 + 1], this.rc[b * 3 + 2] - this.rc[a * 3 + 2]) || 1;
        slope = -(this.rr[b] - this.rr[a]) / ds;
      } else {
        const x = this.capSlope[i];
        const sx = Math.sqrt(Math.max(1 - x * x, 0));
        slope = sx > 1e-3 ? x / sx : x * 1e3;
      }
      // A gentle meander, as a real column never falls perfectly straight.
      const wob = r * 0.12 * Math.sin(tau * TWO_PI * 7) * Math.min(age / 0.4, 1);
      const cx = this.rc[c] + this.rn[c] * wob;
      const cy = this.rc[c + 1] + this.rn[c + 1] * wob;
      const cz = this.rc[c + 2] + this.rn[c + 2] * wob;
      for (let j = 0; j <= this.radial; j++) {
        const th = (j / this.radial) * TWO_PI;
        const ct = Math.cos(th);
        const st = Math.sin(th);
        const k = 1 + ecc * Math.cos(2 * th);
        const dk = (-2 * ecc * Math.sin(2 * th)) / k; // (dR/dθ)/R
        const R0 = r * k;
        // Radial and tangential directions in the ring plane.
        const rx = this.rn[c] * ct + this.rb[c] * st;
        const ry = this.rn[c + 1] * ct + this.rb[c + 1] * st;
        const rz = this.rn[c + 2] * ct + this.rb[c + 2] * st;
        const ux = -this.rn[c] * st + this.rb[c] * ct;
        const uy = -this.rn[c + 1] * st + this.rb[c + 1] * ct;
        const uz = -this.rn[c + 2] * st + this.rb[c + 2] * ct;
        const v = i * row + j;
        const o = v * 3;
        this.pos[o] = cx + rx * R0;
        this.pos[o + 1] = cy + ry * R0;
        this.pos[o + 2] = cz + rz * R0;
        let nx = rx - ux * dk + this.rt[c] * slope;
        let ny = ry - uy * dk + this.rt[c + 1] * slope;
        let nz = rz - uz * dk + this.rt[c + 2] * slope;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        this.nrm[o] = nx;
        this.nrm[o + 1] = ny;
        this.nrm[o + 2] = nz;
        this.center[o] = cx;
        this.center[o + 1] = cy;
        this.center[o + 2] = cz;
        this.axis[o] = this.rt[c];
        this.axis[o + 1] = this.rt[c + 1];
        this.axis[o + 2] = this.rt[c + 2];
        const w = v * 4;
        this.info[w] = r;
        this.info[w + 1] = tau;
        this.info[w + 2] = age;
        this.info[w + 3] = th;
      }
    }
    for (const a of this.attrs) a.needsUpdate = true;
  }

  /**
   * Draw the studio plus the column into `target`: one pass that copies the
   * resolved studio and draws the column over it, reading the studio behind
   * for refraction. (Three invalidates an MSAA buffer after resolving it, so
   * the column can't be added to the studio target after the fact.)
   */
  render(gl: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, sceneTex: THREE.Texture, envRot: number, backlight: number) {
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const u = this.material.uniforms;
    u.tScene.value = sceneTex;
    u.uEnvRot.value = envRot;
    u.uBacklight.value = backlight;
    this.copyMat.uniforms.tScene.value = sceneTex;
    const prev = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(this.target);
    gl.clear(true, true, false);
    gl.render(this.scene, camera);
    gl.setRenderTarget(prev);
    gl.autoClear = autoClear;
  }

  /**
   * Compile programs ahead of the first pour, against the target they'll
   * draw into (the program key depends on it), so the pour never hitches.
   */
  warm(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.compile(this.scene, camera);
    gl.setRenderTarget(prev);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.copy.geometry.dispose();
    this.copyMat.dispose();
    this.target.dispose();
  }
}
