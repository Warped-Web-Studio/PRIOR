import type * as THREE from "three";

/** Object handles the Director animates. Registered by <Bottle/>. */
export const bottleRefs = {
  root: null as THREE.Group | null,
  pivot: null as THREE.Group | null,
  turn: null as THREE.Group | null,
  stopper: null as THREE.Mesh | null,
  waterPlane: null as THREE.Plane | null,
};
