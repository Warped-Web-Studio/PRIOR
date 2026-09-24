"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { brand } from "@/lib/brand";
import { createWordTexture } from "./textures";

type Word = {
  text: string;
  weight: number;
  width: number;
  z: number;
  color: string;
  /** Returns opacity and writes position for a scroll value. */
  place: (scroll: number, out: THREE.Vector3) => number;
};

const window01 = (x: number, a: number, b: number, c: number, d: number) => {
  if (x <= a || x >= d) return 0;
  if (x < b) return (x - a) / (b - a);
  if (x > c) return 1 - (x - c) / (d - c);
  return 1;
};
const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Type set *inside* the scene, behind the bottle. Because it is real
 * geometry, the glass refracts, magnifies and chromatically splits it — the
 * DOM can't do that. Purely decorative (the readable copy is in the DOM).
 */
function useWords(mobile: boolean): Word[] {
  return useMemo(() => {
    const k = mobile ? 0.55 : 1;
    return [
      {
        text: brand.name,
        weight: 200,
        width: 10.6 * k,
        z: -2.8,
        color: "#2f3739",
        place: (s, out) => {
          out.set(0, (mobile ? 0.75 : 0.18) + s * 2.2, -2.8);
          return smooth(window01(s, -1, 0, 0.03, 0.14));
        },
      },
      {
        text: brand.age,
        weight: 200,
        width: 7.0 * k,
        z: -2.2,
        color: "#222a2c",
        place: (s, out) => {
          // Slides right→left, crossing directly behind the glass mid-chapter.
          const f = (s - 0.1) / 0.32;
          out.set((mobile ? 3.2 : 6.2) - f * (mobile ? 6.4 : 11), mobile ? 0.9 : 0.12, -2.2);
          return smooth(window01(s, 0.1, 0.18, 0.34, 0.42));
        },
      },
      {
        text: "2400",
        weight: 200,
        width: 5.4 * k,
        z: -2.4,
        color: "#222a2c",
        place: (s, out) => {
          const f = (s - 0.62) / 0.26;
          out.set(mobile ? 0 : 0.95, -2.2 + f * 4.2 + (mobile ? 0.6 : 0), -2.4);
          return smooth(window01(s, 0.62, 0.7, 0.82, 0.88));
        },
      },
    ];
  }, [mobile]);
}

export function BackdropType({ mobile, fontsReady }: { mobile: boolean; fontsReady: boolean }) {
  const words = useWords(mobile);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const built = useMemo(() => {
    if (!fontsReady) return null;
    return words.map((w) => {
      const { texture, aspect } = createWordTexture(w.text, w.weight);
      const geometry = new THREE.PlaneGeometry(w.width, w.width / aspect);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: w.color,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      return { texture, geometry, material };
    });
  }, [words, fontsReady]);

  useEffect(
    () => () => {
      built?.forEach((b) => {
        b.texture.dispose();
        b.geometry.dispose();
        b.material.dispose();
      });
    },
    [built],
  );

  useFrame(() => {
    if (!built) return;
    const quiet = 1 - sceneState.pour.quiet;
    words.forEach((w, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const o = w.place(sceneState.scroll, mesh.position) * sceneState.typeIn * quiet;
      built[i].material.opacity = o;
      mesh.visible = o > 0.002;
    });
  }, -1);

  if (!built) return null;
  return (
    <>
      {built.map((b, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={b.geometry}
          material={b.material}
          renderOrder={0}
        />
      ))}
    </>
  );
}
