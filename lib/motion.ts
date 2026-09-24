/**
 * Centralised motion values. Every timing and pose that shapes the feel of
 * the piece is here so it can be tuned in one place after watching it run.
 */

export type Vec3 = readonly [number, number, number];

export type Pose = {
  bottle: Vec3; // world position of the bottle's centre
  rotY: number; // turn about the vertical axis (0 = label to camera)
  rotZ: number; // lean
  cam: Vec3;
  look: Vec3;
  env: number; // environment rotation (moves highlights across the glass)
  exposure: number;
};

/**
 * One pose per chapter. Scroll interpolates between neighbours with a
 * plateau around each pose so the composition "holds" while copy is read.
 */
export const desktopPoses: Pose[] = [
  // Hero — confident, frontal, slightly below centre.
  { bottle: [0, 0, 0], rotY: 0, rotZ: 0, cam: [0, 0.12, 9.4], look: [0, 0.02, 0], env: 0, exposure: 1 },
  // Age — bottle steps right and turns so the numerals pass behind thick glass.
  { bottle: [1.35, 0, 0], rotY: 0.78, rotZ: 0, cam: [0.35, 0.3, 7.9], look: [0.55, 0.08, 0], env: 0.9, exposure: 1.02 },
  // Composition — full profile, pushed left for the annotation column.
  { bottle: [-1.15, 0, 0], rotY: 1.62, rotZ: 0, cam: [-0.45, 0.05, 8.3], look: [-0.55, 0, 0], env: 1.7, exposure: 0.95 },
  // Ritual — low camera looking up, raking light, the numbered back of the bottle.
  { bottle: [1.0, 0, 0], rotY: 2.55, rotZ: 0, cam: [0.25, -0.95, 8.4], look: [0.35, 0.12, 0], env: -0.85, exposure: 0.9 },
  // Allocation — returns to face the viewer, floor revealed, ready to pour.
  { bottle: [0, 0, 0], rotY: 0, rotZ: 0, cam: [0, 0.55, 10.2], look: [0, -0.1, 0], env: 0.35, exposure: 1 },
];

/**
 * Mobile is recomposed rather than scaled: the camera stays further back
 * and aims *below* the bottle, which sits high in the tall frame (still on
 * the floor) and leaves the lower half for copy. Lateral moves are smaller.
 */
export const mobilePoses: Pose[] = [
  { bottle: [0, 0, 0], rotY: 0, rotZ: 0, cam: [0, 0.2, 12.4], look: [0, -1.05, 0], env: 0, exposure: 1 },
  { bottle: [0.25, 0, 0], rotY: 0.78, rotZ: 0, cam: [0.2, 0.35, 11.2], look: [0.15, -0.95, 0], env: 0.9, exposure: 1.02 },
  { bottle: [-0.55, 0, 0], rotY: 1.62, rotZ: 0, cam: [0, 0.3, 11.6], look: [0, -1.0, 0], env: 1.7, exposure: 0.95 },
  { bottle: [0.2, 0, 0], rotY: 2.55, rotZ: 0, cam: [0.1, -0.7, 11.8], look: [0.1, -0.6, 0], env: -0.85, exposure: 0.9 },
  { bottle: [0, 0, 0], rotY: 0, rotZ: 0, cam: [0, 0.75, 13.2], look: [0, -1.15, 0], env: 0.35, exposure: 1 },
];

/** Fraction of each chapter spent holding its pose on either side. */
export const POSE_HOLD = 0.18;

/** Spring stiffness for following scroll poses (higher = tighter). */
export const FOLLOW = {
  position: 3.2,
  rotation: 2.6,
  camera: 2.4,
};

export const reveal = {
  /** Beat of stillness once the scene is ready, before anything moves. */
  hold: 0.55,
  /** The bottle's turn toward the viewer. */
  duration: 3.6,
  /** Starting turn — the label faces away, seen reversed through the glass. */
  fromRotY: -2.75,
  /** Highlights travel further than the bottle so light visibly moves. */
  envFrom: -1.6,
  /** Reduced motion replaces the turn with a light sweep. */
  reducedDuration: 1.6,
};

/**
 * The pour. Times are seconds from CTA activation. These are the values the
 * timeline is built from; everything else is derived.
 */
export const pour = {
  quiet: 0.45, // DOM falls silent, light narrows
  uncorkAt: 0.28,
  uncork: 0.85,
  liftAt: 0.38,
  lift: 1.25,
  tiltAt: 0.62,
  tilt: 1.35,
  /** Water reaches the lip and the stream head leaves the bottle. */
  streamAt: 1.18,
  /** Seconds for the stream head to fall to the floor (slow-motion gravity). */
  fall: 0.62,
  /** Lens drops begin landing this long after impact. */
  lensLead: 0.38,
  /** Splash wall rises over the lens, after the first drops have landed. */
  sheetAt: 2.62,
  sheet: 0.8,
  /** Environment swaps while the viewport is fully covered. */
  swapAt: 3.46,
  swap: 0.3,
  /** Water slides off the lens, revealing the inquiry. */
  recedeAt: 3.62,
  recede: 1.35,
  /** Inquiry typography starts as the water passes. */
  inquiryAt: 3.8,
  total: 5.4,
  /** Cinematic gravity — deliberately slower than real, like a high-speed camera. */
  gravity: 6.2,
} as const;

/**
 * Reduced motion keeps the causal chain (open, tilt, pour, water) but drops
 * the camera push and the drops flung at the viewer, and compresses time.
 */
export const pourReduced = {
  quiet: 0.35,
  uncorkAt: 0.05,
  uncork: 0.55,
  liftAt: 0.1,
  lift: 0.8,
  tiltAt: 0.3,
  tilt: 0.8,
  streamAt: 0.82,
  sheetAt: 1.3,
  sheet: 0.7,
  swapAt: 2.05,
  swap: 0.25,
  recedeAt: 2.2,
  recede: 0.85,
  inquiryAt: 2.35,
  total: 3.2,
} as const;

export const returnSeq = {
  sheet: 0.85,
  swapAt: 0.85,
  recedeAt: 1.0,
  recede: 1.1,
  total: 2.2,
} as const;

/** Local-space constants for the bottle, shared by geometry and effects. */
export const bottleDims = {
  base: -1.3,
  mouthY: 1.26,
  mouthRadius: 0.13,
  bodyRadius: 0.57,
  restLevel: 0.62, // local height of the water line when full
  floorY: -1.3,
} as const;

/**
 * Absolute framing for the pour, blended in from wherever the viewer was
 * (so activating from the header at the top of the page still works).
 * `push` is a camera dolly applied during the splash; it translates camera
 * and target together so lens-drop aim (computed at impact) stays valid.
 */
export type PourPose = {
  bottle: Vec3; // bottle centre when lifted
  tilt: number; // radians about Z; positive tips the mouth to screen-left
  cam: Vec3;
  look: Vec3;
  push: Vec3;
  fov: number;
};

export const desktopPourPose: PourPose = {
  bottle: [0.85, 0.72, 0.2],
  tilt: 2.02,
  cam: [0.12, 0.05, 10.6],
  look: [0.08, -0.2, 0],
  push: [-0.3, -0.6, -3.1],
  fov: 28,
};

export const mobilePourPose: PourPose = {
  bottle: [0.55, 1.1, 0.2],
  tilt: 2.12,
  cam: [0.05, 0.05, 15.4],
  look: [0.0, 0.05, 0],
  push: [-0.2, -0.9, -4.4],
  fov: 30,
};

export const FOV = { desktop: 28, mobile: 30 } as const;
