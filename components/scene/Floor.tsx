"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { bottleDims } from "@/lib/motion";
import { rig } from "./rig";

const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Black basalt. A pool of light under the bottle grounds it, a contact
// shadow sits it on the surface, and the impact writes rings and a spreading
// film into the stone. Fades into the background so there is no horizon.
const fragment = /* glsl */ `
  uniform vec3 uBottle;
  uniform float uBottleHeight;
  uniform vec3 uImpact;
  uniform float uSince;
  uniform float uReveal;
  uniform vec3 uBg;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;
    float dBottle = length((p - uBottle.xz) * vec2(1.0, 1.4));
    float pool = exp(-dBottle * dBottle * 0.55) * 0.07 * uReveal;
    float contact = smoothstep(0.9, 0.35, dBottle) * smoothstep(0.35, 0.0, uBottleHeight);
    vec3 col = vec3(0.0026, 0.0029, 0.0032) + vec3(0.72, 0.8, 0.82) * pool;
    col *= 1.0 - contact * 0.85;

    if (uSince > 0.0) {
      float d = length(p - uImpact.xz);
      float rings = 0.0;
      for (int k = 0; k < 3; k++) {
        float tk = uSince - float(k) * 0.16;
        if (tk <= 0.0) continue;
        float r = tk * 1.25 + 0.08;
        float w = 0.015 + tk * 0.02;
        rings += exp(-pow((d - r) / w, 2.0)) * exp(-tk * 1.6) * (1.0 - float(k) * 0.28);
      }
      float film = smoothstep(uSince * 0.9 + 0.2, uSince * 0.9 - 0.1, d) * (1.0 - exp(-uSince * 4.0));
      col += vec3(0.55, 0.66, 0.68) * rings * 0.9;
      col = mix(col, col * 0.6 + vec3(0.012, 0.016, 0.017), film * 0.6);
    }

    float fade = smoothstep(9.0, 2.5, length(vWorld.xz - vec2(0.0, 0.5)));
    gl_FragColor = vec4(mix(uBg, col, fade), 1.0);
  }
`;

export function Floor() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uBottle: { value: new THREE.Vector3() },
          uBottleHeight: { value: 0 },
          uImpact: { value: new THREE.Vector3() },
          uSince: { value: -1 },
          uReveal: { value: 0 },
          uBg: { value: new THREE.Color("#050607").convertSRGBToLinear() },
        },
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), []);

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame(() => {
    const u = material.uniforms;
    const p = sceneState.pour;
    u.uBottle.value.copy(rig.bottleCenter);
    u.uBottleHeight.value = rig.bottleCenter.y - (bottleDims.floorY - bottleDims.base);
    u.uImpact.value.copy(rig.impact);
    u.uSince.value = rig.impactReady ? p.clock - p.impactAt : -1;
    u.uReveal.value = sceneState.light;
  }, -1);

  return <mesh geometry={geometry} material={material} position-y={bottleDims.floorY} />;
}
