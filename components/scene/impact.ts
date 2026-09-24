import type * as THREE from "three";

/**
 * Impact is detected by the stream (which knows where its fall ends) and
 * consumed by the splash (which aims droplets from that point). A single
 * registered handler keeps the two decoupled.
 */
let handler: ((camera: THREE.PerspectiveCamera) => void) | null = null;

export function setImpactHandler(fn: typeof handler) {
  handler = fn;
}

export function onImpact(camera: THREE.PerspectiveCamera) {
  handler?.(camera);
}
