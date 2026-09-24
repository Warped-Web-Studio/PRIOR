"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";

/**
 * How liquid is photographed on black: a diffused panel *behind* it. The
 * water refracts the panel and glows, its edges go dark by total internal
 * reflection. The panel rises as the room goes quiet — light narrowing onto
 * the bottle — and is otherwise invisible.
 */
const fragment = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    // A diffused panel far behind, seen out of focus: a soft vertical glow
    // with no edge at all.
    vec2 q = (vUv - 0.5) * vec2(2.0, 2.0);
    float g = exp(-pow(q.x / 0.3, 2.0)) * exp(-pow(q.y / 0.95, 6.0)) * smoothstep(-0.42, 0.18, q.y);
    vec3 c = vec3(0.8, 0.9, 0.9) * g * 0.28;
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }
`;
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Shared with the floor, which mirrors the panel in its puddle. */
export const BACKLIGHT = {
  desktop: { pos: [-0.7, 0.55, -4.4] as const, scale: [6.2, 7.5] as const },
  mobile: { pos: [-0.3, 0.9, -4.2] as const, scale: [4.6, 8.5] as const },
};

export function Backlight({ mobile }: { mobile: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uIntensity: { value: 0 } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame(() => {
    const p = sceneState.pour;
    material.uniforms.uIntensity.value = p.quiet * (1 - p.swap);
  }, -1);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={mobile ? BACKLIGHT.mobile.pos : BACKLIGHT.desktop.pos}
      scale={[...(mobile ? BACKLIGHT.mobile.scale : BACKLIGHT.desktop.scale), 1]}
      renderOrder={-1}
    />
  );
}
