import * as THREE from "three";
import { POSE_HOLD, type Pose } from "@/lib/motion";

/**
 * World-space facts one system computes and others consume each frame
 * (the bottle's mouth feeds the stream, the stream's impact feeds the
 * splash). Plain mutable vectors — no allocation per frame.
 */
export const rig = {
  bottleCenter: new THREE.Vector3(),
  mouth: new THREE.Vector3(),
  mouthDir: new THREE.Vector3(0, 1, 0),
  /** World-space water line (clip plane height). */
  waterLevel: 0,
  impact: new THREE.Vector3(0, -1.3, 0),
  impactReady: false,
  camAtImpact: new THREE.Vector3(),
  camDelta: new THREE.Vector3(),
  isMobile: false,
};

export type MutablePose = {
  bottle: THREE.Vector3;
  rotY: number;
  rotZ: number;
  cam: THREE.Vector3;
  look: THREE.Vector3;
  env: number;
  exposure: number;
};

export const createPose = (): MutablePose => ({
  bottle: new THREE.Vector3(),
  rotY: 0,
  rotZ: 0,
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  env: 0,
  exposure: 1,
});

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * Chapter pose at a scroll position. Each chapter holds its pose for
 * POSE_HOLD on either side, and travels between poses on a smootherstep so
 * motion begins and ends at zero velocity even before spring smoothing.
 */
export function poseAt(scroll: number, poses: Pose[], out: MutablePose) {
  const n = poses.length - 1;
  const x = Math.min(Math.max(scroll, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const t = smootherstep(Math.min(Math.max((f - POSE_HOLD) / (1 - POSE_HOLD * 2), 0), 1));
  const a = poses[i];
  const b = poses[i + 1];
  const lerp = (p: number, q: number) => p + (q - p) * t;
  out.bottle.set(lerp(a.bottle[0], b.bottle[0]), lerp(a.bottle[1], b.bottle[1]), lerp(a.bottle[2], b.bottle[2]));
  out.cam.set(lerp(a.cam[0], b.cam[0]), lerp(a.cam[1], b.cam[1]), lerp(a.cam[2], b.cam[2]));
  out.look.set(lerp(a.look[0], b.look[0]), lerp(a.look[1], b.look[1]), lerp(a.look[2], b.look[2]));
  out.rotY = lerp(a.rotY, b.rotY);
  out.rotZ = lerp(a.rotZ, b.rotZ);
  out.env = lerp(a.env, b.env);
  out.exposure = lerp(a.exposure, b.exposure);
  return out;
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function dampVec(current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) {
  const k = 1 - Math.exp(-lambda * dt);
  current.x += (target.x - current.x) * k;
  current.y += (target.y - current.y) * k;
  current.z += (target.z - current.z) * k;
}

/**
 * Damped spring (semi-implicit Euler). Slightly under-damped so a heavy
 * object carries a hair past its mark and settles — the difference between
 * a turn that has mass and one that simply stops.
 */
export class Spring {
  value: number;
  velocity = 0;
  constructor(
    initial: number,
    public omega = 5,
    public zeta = 0.86,
  ) {
    this.value = initial;
  }
  step(target: number, dt: number) {
    const h = Math.min(dt, 1 / 30);
    const accel = this.omega * this.omega * (target - this.value) - 2 * this.zeta * this.omega * this.velocity;
    this.velocity += accel * h;
    this.value += this.velocity * h;
    return this.value;
  }
  snap(v: number) {
    this.value = v;
    this.velocity = 0;
  }
}
