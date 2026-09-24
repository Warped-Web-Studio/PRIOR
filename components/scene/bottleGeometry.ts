import * as THREE from "three";

/**
 * The bottle is a lathe of a hand-drawn half-profile. A closed profile (outer
 * wall up, inner wall down) gives the glass real thickness: a heavy 0.3-unit
 * base, 5 mm walls and a rolled lip — the details that stop a transparent
 * mesh from reading as plastic.
 *
 * Units: 1 ≈ 11.5 cm. Height 2.56 ≈ a tall 750 ml bottle.
 */

type P = [number, number]; // [radius, y]

const OUTER: P[] = [
  [0.0, -1.3],
  [0.42, -1.3],
  [0.535, -1.292],
  [0.566, -1.262],
  [0.575, -1.2],
  [0.575, -0.6],
  [0.575, 0.46],
  [0.566, 0.6],
  [0.52, 0.73],
  [0.41, 0.85],
  [0.27, 0.94],
  [0.19, 1.0],
  [0.172, 1.06],
  [0.17, 1.165],
  [0.184, 1.186],
  [0.19, 1.222],
  [0.178, 1.252],
  [0.152, 1.262],
];

const INNER: P[] = [
  [0.131, 1.248],
  [0.128, 1.18],
  [0.13, 1.03],
  [0.175, 0.965],
  [0.32, 0.87],
  [0.46, 0.76],
  [0.518, 0.63],
  [0.526, 0.47],
  [0.526, -0.6],
  [0.524, -0.965],
  [0.5, -0.998],
  [0.36, -1.018],
  [0.14, -0.985],
  [0.0, -0.965],
];

function sampleProfile(points: P[], count: number) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    "centripetal",
  );
  return curve.getSpacedPoints(count).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
}

export type BottleGeometries = {
  glass: THREE.LatheGeometry;
  water: THREE.LatheGeometry;
  stopper: THREE.LatheGeometry;
  /** v-range of the outer body on the glass UVs (for the condensation map). */
  bodyV: [number, number];
};

export function createBottleGeometries(quality: "high" | "low"): BottleGeometries {
  const radial = quality === "high" ? 128 : 72;
  const outer = sampleProfile(OUTER, quality === "high" ? 120 : 70);
  const inner = sampleProfile(INNER, quality === "high" ? 90 : 52);
  const profile = [...outer, ...inner];

  const glass = new THREE.LatheGeometry(profile, radial);

  // Body starts ~5 % into the outer run and ends before the shoulder.
  const total = profile.length - 1;
  const bodyStart = outer.findIndex((p) => p.y > -1.15) / total;
  const bodyEnd = outer.findIndex((p) => p.y > 0.5) / total;

  // Water hugs the inner wall with a hair of clearance so it never z-fights.
  const waterProfile = [...INNER]
    .reverse()
    .map(([r, y]) => [r * 0.985, y + 0.004] as P);
  waterProfile.push([0, 1.2]);
  const water = new THREE.LatheGeometry(
    sampleProfile(waterProfile, quality === "high" ? 90 : 52),
    radial,
  );

  // Basalt stopper: a plug inside the neck under a turned cap.
  const stopper = new THREE.LatheGeometry(
    sampleProfile(
      [
        [0.0, 1.13],
        [0.122, 1.132],
        [0.124, 1.25],
        [0.19, 1.262],
        [0.212, 1.29],
        [0.214, 1.49],
        [0.2, 1.53],
        [0.12, 1.548],
        [0.0, 1.552],
      ],
      quality === "high" ? 60 : 36,
    ),
    quality === "high" ? 64 : 40,
  );

  return { glass, water, stopper, bodyV: [bodyStart, bodyEnd] };
}
