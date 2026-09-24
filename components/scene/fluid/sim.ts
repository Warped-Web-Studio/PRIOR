import * as THREE from "three";
import { mulberry32 } from "../textures";

/**
 * The pour as a particle simulation. Particles are emitted from the bottle's
 * mouth with the pulsing flow of a bottle venting air ("glug"), fall under
 * gravity and, on hitting the floor, break into three regimes seen in real
 * high-speed footage of a pour onto stone: a low fanning sheet, a spreading
 * film, and fine spray. A small share of the splash is thrown at the camera
 * and — when a particle actually reaches the lens — it is deposited into the
 * lens-water simulation at its projected position. The splash on the glass
 * is caused by the splash in the scene, particle for particle.
 *
 * No neighbour search: the screen-space renderer merges overlapping spheres
 * into one liquid surface, which is what makes this cheap enough for a
 * browser (a few thousand particles, one loop per step).
 */

export const enum Kind {
  Dead = 0,
  Stream = 1,
  Sheet = 2,
  Spray = 3,
  Film = 4,
  Lens = 5,
}

export type SimContext = {
  mouth: THREE.Vector3;
  mouthDir: THREE.Vector3;
  streamAt: number;
  camera: THREE.PerspectiveCamera;
  floorY: number;
  gravity: number;
  drain: number;
  reduced: boolean;
};

export type Splat = { u: number; v: number; r: number; amount: number };

export type SimConfig = {
  capacity: number;
  rate: number; // particles per second at full flow
  streamRadius: number;
  lensFraction: number;
};

export const SIM_CONFIG: Record<"high" | "low", SimConfig> = {
  high: { capacity: 9000, rate: 3600, streamRadius: 0.03, lensFraction: 0.1 },
  low: { capacity: 3600, rate: 1500, streamRadius: 0.04, lensFraction: 0.11 },
};

const STEP = 1 / 120;
const LENS_DEPTH = 0.42; // view-space distance at which a particle "lands" on the lens
const POUR_SPEED = 0.78;
const EMIT_RADIUS = 0.04;
const POUR_LENGTH = 2.7; // seconds of flow after the lip is reached

export class FluidSim {
  readonly cap: number;
  readonly pos: Float32Array;
  readonly radius: Float32Array;
  /** Film particles don't render as spheres; they paint the floor's wetness map. */
  readonly wet: Float32Array;
  private vel: Float32Array;
  private kind: Uint8Array;
  private bounce: Uint8Array;
  // Lens-bound particles follow an analytic path solved at launch.
  private launchP: Float32Array;
  private launchV: Float32Array;
  private launchCam: Float32Array;
  private launchT: Float32Array;
  private flight: Float32Array;
  private baseR: Float32Array;

  time = 0;
  impactAt = Infinity;
  readonly impact = new THREE.Vector3(0, -1.3, 0);
  splats: Splat[] = [];

  private cursor = 0;
  private emitCarry = 0;
  private rand = mulberry32(417);
  private tmp = new THREE.Vector3();
  private side = new THREE.Vector3();
  private up = new THREE.Vector3();
  private fwd = new THREE.Vector3();

  constructor(private cfg: SimConfig) {
    const n = cfg.capacity;
    this.cap = n;
    this.pos = new Float32Array(n * 3);
    this.radius = new Float32Array(n);
    this.wet = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.kind = new Uint8Array(n);
    this.bounce = new Uint8Array(n);
    this.launchP = new Float32Array(n * 3);
    this.launchV = new Float32Array(n * 3);
    this.launchCam = new Float32Array(n * 3);
    this.launchT = new Float32Array(n);
    this.flight = new Float32Array(n);
    this.baseR = new Float32Array(n);
  }

  reset() {
    this.kind.fill(0);
    this.radius.fill(0);
    this.wet.fill(0);
    this.time = 0;
    this.impactAt = Infinity;
    this.cursor = 0;
    this.emitCarry = 0;
    this.rand = mulberry32(417);
    this.splats.length = 0;
  }

  /** Advance to `clock` in fixed steps. Seeking backwards re-simulates. */
  advanceTo(clock: number, ctx: SimContext) {
    if (clock < this.time - 1e-4) this.reset();
    // Never try to catch up more than half a second in one frame.
    if (clock - this.time > 0.5) this.time = clock - 0.5;
    while (this.time + STEP <= clock) this.step(STEP, ctx);
  }

  private alloc() {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    return i;
  }

  /** Flow at the lip: a ramp, then the uneven pulse of a bottle gulping air. */
  private flowRate(t: number, drain: number) {
    const s = t;
    if (s < 0 || s > POUR_LENGTH) return 0;
    const ramp = Math.min(1, 0.55 + s / 0.08);
    const glug = 0.84 + 0.1 * Math.sin(s * 26.4) + 0.06 * Math.sin(s * 11.3 + 1.7);
    const tail = Math.min(1, (POUR_LENGTH - s) / 0.4);
    return this.cfg.rate * ramp * glug * tail * (1 - drain * 0.25);
  }

  private emit(dt: number, ctx: SimContext) {
    const since = this.time - ctx.streamAt;
    const rate = this.flowRate(since, ctx.drain);
    if (rate <= 0) return;
    this.emitCarry += rate * dt;
    const n = Math.floor(this.emitCarry);
    this.emitCarry -= n;
    if (n === 0) return;

    const d = ctx.mouthDir;
    this.side.set(0, 0, 1).cross(d);
    if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0);
    this.side.normalize();
    this.up.copy(d).cross(this.side).normalize();
    const r = this.rand;
    for (let k = 0; k < n; k++) {
      const i = this.alloc();
      const a = r() * Math.PI * 2;
      // Water leaves on the lower lip first: bias the disc toward gravity.
      const rr = Math.sqrt(r()) * EMIT_RADIUS;
      const ox = Math.cos(a) * rr;
      const oy = Math.sin(a) * rr;
      const o = i * 3;
      this.pos[o] = ctx.mouth.x + this.side.x * ox + this.up.x * oy;
      this.pos[o + 1] = ctx.mouth.y + this.side.y * ox + this.up.y * oy - 0.01;
      this.pos[o + 2] = ctx.mouth.z + this.side.z * ox + this.up.z * oy;
      const sp = POUR_SPEED * (0.9 + r() * 0.2);
      this.vel[o] = d.x * sp + (r() - 0.5) * 0.018;
      this.vel[o + 1] = d.y * sp + (r() - 0.5) * 0.018;
      this.vel[o + 2] = d.z * sp + (r() - 0.5) * 0.018;
      this.kind[i] = Kind.Stream;
      this.wet[i] = 0;
      this.bounce[i] = 0;
      this.radius[i] = this.cfg.streamRadius * (0.85 + r() * 0.3);
    }
  }

  private step(dt: number, ctx: SimContext) {
    this.time += dt;
    this.emit(dt, ctx);

    const cam = ctx.camera;
    const view = cam.matrixWorldInverse.elements;
    const g = ctx.gravity;
    const floor = ctx.floorY;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = cam.aspect;

    for (let i = 0; i < this.cap; i++) {
      const kind = this.kind[i];
      if (kind === Kind.Dead) continue;
      const o = i * 3;
      let x = this.pos[o];
      let y = this.pos[o + 1];
      let z = this.pos[o + 2];
      const rad = this.radius[i];

      if (kind === Kind.Lens) {
        // Ballistic path to an aim point on the lens, corrected for the
        // camera's dolly since launch so the aim stays true.
        const tau = this.time - this.launchT[i];
        const T = this.flight[i];
        const k = Math.min(tau / T, 1.2);
        const kk = k * k * k;
        x = this.launchP[o] + this.launchV[o] * tau + (cam.position.x - this.launchCam[o]) * kk;
        y = this.launchP[o + 1] + this.launchV[o + 1] * tau - 0.5 * g * tau * tau + (cam.position.y - this.launchCam[o + 1]) * kk;
        z = this.launchP[o + 2] + this.launchV[o + 2] * tau + (cam.position.z - this.launchCam[o + 2]) * kk;
      } else if (kind === Kind.Film) {
        // A thin film spreading on stone: friction, then rest.
        const damp = Math.exp(-3.2 * dt);
        this.vel[o] *= damp;
        this.vel[o + 2] *= damp;
        x += this.vel[o] * dt;
        z += this.vel[o + 2] * dt;
        y = floor + 0.004;
      } else {
        this.vel[o + 1] -= g * dt;
        const drag = 1 - 0.04 * dt;
        this.vel[o] *= drag;
        this.vel[o + 1] *= drag;
        this.vel[o + 2] *= drag;
        x += this.vel[o] * dt;
        y += this.vel[o + 1] * dt;
        z += this.vel[o + 2] * dt;

        if (y - rad * 0.5 < floor) {
          y = floor + rad * 0.5;
          if (kind === Kind.Stream) this.splash(i, x, z, ctx);
          else if (kind === Kind.Spray && this.bounce[i] < 1 && Math.abs(this.vel[o + 1]) > 0.9) {
            this.vel[o + 1] = Math.abs(this.vel[o + 1]) * 0.22;
            this.vel[o] *= 0.72;
            this.vel[o + 2] *= 0.72;
            this.radius[i] *= 0.85;
            this.bounce[i]++;
          } else {
            this.kind[i] = Kind.Film;
            this.vel[o + 1] = 0;
            this.wet[i] = 0.12 + this.rand() * 0.06;
            this.radius[i] = 0;
          }
          if (this.kind[i] === Kind.Lens) {
            this.pos[o] = x;
            this.pos[o + 1] = y;
            this.pos[o + 2] = z;
            continue;
          }
        }
      }

      // Reaching the lens: view-space depth from the camera.
      const vz = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
      // Drops racing at the camera thin out of the fluid render just before
      // they land; the lens film takes over the moment they arrive.
      if (kind === Kind.Lens) this.radius[i] = this.baseR[i] * Math.min(Math.max((vz - LENS_DEPTH) / 1.4, 0.15), 1);
      if (kind !== Kind.Film && vz < LENS_DEPTH) {
        if (vz > 0.02) {
          const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
          const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
          const u = 0.5 + (vx / (vz * tanHalf * aspect)) * 0.5;
          const v = 0.5 + (vy / (vz * tanHalf)) * 0.5;
          if (u > -0.1 && u < 1.1 && v > -0.1 && v < 1.1 && this.splats.length < 96) {
            // Screen radius of the droplet as it arrives, as a fraction of height.
            const rs = (kind === Kind.Lens ? 0.028 : rad) / (2 * vz * tanHalf);
            this.splats.push({ u, v, r: Math.min(0.12, rs * 1.3 + 0.01), amount: 0.45 + Math.min(rs * 4, 0.9) });
          }
        }
        this.kind[i] = Kind.Dead;
        this.radius[i] = 0;
        this.wet[i] = 0;
        continue;
      }
      if (y < floor - 0.5 || Math.abs(x) > 12 || Math.abs(z) > 14) {
        this.kind[i] = Kind.Dead;
        this.radius[i] = 0;
        this.wet[i] = 0;
        continue;
      }
      this.pos[o] = x;
      this.pos[o + 1] = y;
      this.pos[o + 2] = z;
    }

  }

  /** A stream particle meets the floor. */
  private splash(i: number, x: number, z: number, ctx: SimContext) {
    const r = this.rand;
    const o = i * 3;
    if (this.impactAt === Infinity) {
      this.impactAt = this.time;
      this.impact.set(x, ctx.floorY, z);
    } else {
      this.impact.x += (x - this.impact.x) * 0.02;
      this.impact.z += (z - this.impact.z) * 0.02;
    }
    const vx = this.vel[o];
    const vy = this.vel[o + 1];
    const vz = this.vel[o + 2];
    const s = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Outward from the column, fanned toward the camera.
    let dx = x - this.impact.x + (r() - 0.5) * 0.06;
    let dz = z - this.impact.z + (r() - 0.5) * 0.06;
    const a = r() * Math.PI * 2;
    dx += Math.cos(a) * 0.05;
    dz += Math.sin(a) * 0.05 + 0.035;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    const since = this.time - this.impactAt;
    const u = r();
    const lensWindow = !ctx.reduced && since > 0.1 && since < 0.95;
    if (lensWindow && u < this.cfg.lensFraction) {
      this.launchAtLens(i, x, z, ctx);
      return;
    }
    if (u < 0.25) {
      // Sheet: neighbours leave at similar speeds so the fan stays coherent
      // and only frays at its rim, as a real splash sheet does.
      const h = s * (0.3 + r() * 0.12);
      this.vel[o] = dx * h;
      this.vel[o + 1] = s * (0.14 + r() * 0.1);
      this.vel[o + 2] = dz * h;
      this.kind[i] = Kind.Sheet;
      this.radius[i] *= 0.7;
    } else if (u < 0.88) {
      // Film: the spreading puddle — fat, flat particles that merge.
      const h = s * (0.24 + r() * 0.12);
      this.vel[o] = dx * h;
      this.vel[o + 1] = 0;
      this.vel[o + 2] = dz * h;
      this.kind[i] = Kind.Film;
      this.wet[i] = 0.14 + r() * 0.06;
      this.radius[i] = 0;
    } else {
      const h = s * (0.25 + r() * 0.45);
      this.vel[o] = dx * h;
      this.vel[o + 1] = s * (0.4 + r() * 0.5);
      this.vel[o + 2] = dz * h + s * 0.15 * r();
      this.kind[i] = Kind.Spray;
      this.radius[i] = 0.006 + r() * 0.008;
    }
  }

  /**
   * Art direction inside physics: solve a ballistic launch that passes
   * through a chosen point just in front of the lens after `T` seconds.
   */
  private launchAtLens(i: number, x: number, z: number, ctx: SimContext) {
    const r = this.rand;
    const cam = ctx.camera;
    const o = i * 3;
    const since = this.time - this.impactAt;
    // Early hits land low (nearest the splash), later ones reach the top.
    const reach = Math.min(1, 0.35 + since * 0.9);
    const u = 0.03 + r() * 0.94;
    const v = 0.03 + Math.pow(r(), 1.4 - reach * 0.8) * 0.94 * reach + (1 - reach) * 0.02;
    const T = 0.34 + r() * 0.42;
    this.tmp.set(u * 2 - 1, v * 2 - 1, 0.5).unproject(cam).sub(cam.position).normalize();
    cam.getWorldDirection(this.fwd);
    const dist = (LENS_DEPTH * 0.7) / Math.max(this.tmp.dot(this.fwd), 0.2);
    const tx = cam.position.x + this.tmp.x * dist;
    const ty = cam.position.y + this.tmp.y * dist;
    const tz = cam.position.z + this.tmp.z * dist;
    const y0 = ctx.floorY + 0.02;
    this.launchP[o] = x;
    this.launchP[o + 1] = y0;
    this.launchP[o + 2] = z;
    this.launchV[o] = (tx - x) / T;
    this.launchV[o + 1] = (ty - y0 + 0.5 * ctx.gravity * T * T) / T;
    this.launchV[o + 2] = (tz - z) / T;
    this.launchCam[o] = cam.position.x;
    this.launchCam[o + 1] = cam.position.y;
    this.launchCam[o + 2] = cam.position.z;
    this.launchT[i] = this.time;
    this.flight[i] = T;
    this.kind[i] = Kind.Lens;
    // Small in flight (fast drops read as specks); they land as full drops.
    this.baseR[i] = 0.006 + r() * 0.008;
    this.radius[i] = this.baseR[i];
  }
}
