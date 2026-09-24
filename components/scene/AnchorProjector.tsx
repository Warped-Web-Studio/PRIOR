"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { bottleDims } from "@/lib/motion";
import { rig } from "./rig";

const window01 = (x: number, a: number, b: number, c: number, d: number) =>
  x <= a || x >= d ? 0 : x < b ? (x - a) / (b - a) : x > c ? 1 - (x - c) / (d - c) : 1;

/**
 * Projects points on the bottle's right silhouette to screen space and moves
 * the DOM annotations there. Writes styles directly — no React renders.
 */
export function AnchorProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  const overlay = useMemo(
    () => (typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-annotations]") : null),
    [],
  );

  useFrame(() => {
    const el = overlay ?? document.querySelector<HTMLElement>("[data-annotations]");
    if (!el) return;
    const show = window01(sceneState.scroll, 0.4, 0.47, 0.53, 0.6) * (1 - sceneState.pour.quiet);
    const eased = show * show * (3 - 2 * show);
    if (Math.abs(sceneState.anchorsVisible - eased) > 1e-4 || eased > 0) {
      el.style.opacity = eased.toFixed(3);
      el.style.visibility = eased > 0.001 ? "visible" : "hidden";
      el.style.setProperty("--draw", eased.toFixed(3));
      sceneState.anchorsVisible = eased;
    }
    if (eased <= 0.001) return;
    for (const a of sceneState.anchors) {
      v.set(rig.bottleCenter.x + bottleDims.bodyRadius + 0.02, rig.bottleCenter.y + a.y, rig.bottleCenter.z).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }, 2);

  return null;
}
