/**
 * Mutable animation state shared between GSAP (writer) and the render loop
 * (reader). Deliberately not React state: these values change every frame
 * and must never trigger reconciliation.
 */

export const MAX_LENS_DROPS = 32;

export type PourState = {
  /** Linear timeline clock in seconds — drives time-based particle motion. */
  clock: number;
  quiet: number;
  frame: number; // camera easing into pour framing
  uncork: number;
  lift: number;
  tilt: number;
  drain: number;
  head: number;
  tail: number;
  /** Clock time the stream leaves the lip (differs for reduced motion). */
  streamAt: number;
  /** Absolute clock time of impact; particles are relative to it. */
  impactAt: number;
  push: number; // camera push toward the splash
  /** Height of the water sheet on the lens, -0.25 (clear) .. 1.3 (covered). */
  level: number;
  /** 0 while the sheet is rising as a splash, 1 while it drains down. */
  draining: number;
  surface: number; // tint: 0 ink (dark scene) .. 1 ice (inquiry)
  swap: number; // 0 renders the studio, 1 the inquiry environment
  lensFade: number; // residual lens drops evaporating
  active: number; // 1 while any water effect is live (lets idle frames skip work)
};

export const createPourState = (): PourState => ({
  clock: 0,
  quiet: 0,
  frame: 0,
  uncork: 0,
  lift: 0,
  tilt: 0,
  drain: 0,
  head: 0,
  tail: 0,
  streamAt: 999,
  impactAt: 999,
  push: 0,
  level: -0.3,
  draining: 0,
  surface: 0,
  swap: 0,
  lensFade: 0,
  active: 0,
});

export const sceneState = {
  /** 0..1 over the whole scroll track. */
  scroll: 0,
  /** Pointer in -1..1, already smoothed on the DOM side. */
  pointer: { x: 0, y: 0 },
  /** 0 = turned away, 1 = hero orientation reached. */
  reveal: 0,
  revealEnv: 0,
  /** Studio light coming up once the scene is ready (exposure multiplier). */
  light: 0,
  /** Hero typography opacity inside WebGL, tied to the reveal. */
  typeIn: 0,
  pour: createPourState(),
  /**
   * Lens drops: x, y (0..1 screen), hit time (clock seconds), radius (fraction
   * of viewport height). Filled at impact from the actual droplet trajectories.
   */
  lens: new Float32Array(MAX_LENS_DROPS * 4),
  lensCount: 0,
  /** DOM elements whose position is driven by projecting bottle points. */
  anchors: [] as { el: HTMLElement; y: number }[],
  anchorsVisible: 0,
  /** Set by the scene when it is visually ready. */
  ready: false,
};

export function resetPour() {
  Object.assign(sceneState.pour, createPourState());
  sceneState.lensCount = 0;
}
