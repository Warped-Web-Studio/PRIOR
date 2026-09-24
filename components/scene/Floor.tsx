"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { bottleDims } from "@/lib/motion";
import { rig } from "./rig";
import { floorWet } from "./fluid/FloorWetness";
import { BACKLIGHT } from "./Backlight";

const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Black basalt. A pool of light under the bottle grounds it, a contact
// shadow sits it on the surface. During the pour the simulated water that
// lands becomes a puddle: wet stone darkens, the film mirrors the backlight
// by Fresnel, and its edge carries a bright meniscus. Impact rings travel
// through the film. Fades into the background so there is no horizon.
const fragment = /* glsl */ `
  uniform vec3 uBottle;
  uniform float uBottleHeight;
  uniform vec3 uImpact;
  uniform float uSince;
  uniform float uReveal;
  uniform vec3 uBg;
  uniform sampler2D tWet;
  uniform float uWetOn;
  uniform vec2 uWetCenter;
  uniform float uWetExtent;
  uniform float uBack;
  uniform vec3 uBackPos;
  uniform vec2 uBackScale;
  varying vec3 vWorld;

  float wetAt(vec2 p) {
    vec2 uv = vec2((p.x - uWetCenter.x) / uWetExtent + 0.5, 0.5 - (p.y - uWetCenter.y) / uWetExtent);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    return texture2D(tWet, uv).r;
  }

  // The panel's base sits below the floor's far edge — hidden from the
  // camera, but a wet floor still mirrors it.
  float glow(vec2 q) {
    return exp(-pow(q.x / 0.3, 2.0)) * exp(-pow(q.y / 0.95, 6.0));
  }

  void main() {
    vec2 p = vWorld.xz;
    float dBottle = length((p - uBottle.xz) * vec2(1.0, 1.4));
    float pool = exp(-dBottle * dBottle * 0.55) * 0.07 * uReveal;
    float contact = smoothstep(0.9, 0.35, dBottle) * smoothstep(0.35, 0.0, uBottleHeight);
    vec3 col = vec3(0.0026, 0.0029, 0.0032) + vec3(0.72, 0.8, 0.82) * pool;
    col *= 1.0 - contact * 0.85;

    // Ripples from the impact, as a height field for the film's normal.
    float ringH = 0.0;
    float d = length(p - uImpact.xz);
    if (uSince > 0.0) {
      for (int k = 0; k < 4; k++) {
        float tk = uSince - float(k) * 0.13;
        if (tk <= 0.0) continue;
        float r = tk * 1.1 + 0.05;
        ringH += sin((d - r) * 38.0) * exp(-pow((d - r) / (0.05 + tk * 0.05), 2.0)) * exp(-tk * 1.4);
      }
    }

    if (uWetOn > 0.5) {
      float e = uWetExtent / 256.0;
      float w = wetAt(p);
      float wet = smoothstep(0.18, 0.55, w);
      if (wet > 0.001) {
        float gx = wetAt(p + vec2(e, 0.0)) - wetAt(p - vec2(e, 0.0));
        float gz = wetAt(p + vec2(0.0, e)) - wetAt(p - vec2(0.0, e));
        vec2 dir = d > 1e-3 ? (p - uImpact.xz) / d : vec2(0.0);
        vec3 n = normalize(vec3(-gx * 0.9 - dir.x * ringH * 0.12, 1.0, -gz * 0.9 - dir.y * ringH * 0.12));
        vec3 V = normalize(vWorld - cameraPosition);
        vec3 R = reflect(V, n);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(-V, n), 0.0), 5.0);
        // Mirror the backlight panel: intersect the reflected ray with it.
        vec3 mirror = vec3(0.0);
        if (R.z < -1e-3) {
          float t = (uBackPos.z - vWorld.z) / R.z;
          vec3 h = vWorld + R * t;
          vec2 q = (h.xy - uBackPos.xy) / (uBackScale * 0.5);
          mirror = vec3(0.8, 0.9, 0.9) * 0.28 * glow(q) * uBack;
        }
        // Wet stone is darker; the film reflects.
        vec3 wetCol = col * 0.45 + mirror * (0.35 + F * 2.4);
        // Meniscus: the film's edge catches light.
        float edge = smoothstep(0.1, 0.3, w) * (1.0 - smoothstep(0.3, 0.55, w));
        wetCol += vec3(0.5, 0.6, 0.62) * edge * (0.04 + mirror.g * 1.5);
        col = mix(col, wetCol, wet);
      }
    }

    float fade = smoothstep(9.0, 2.5, length(vWorld.xz - vec2(0.0, 0.5)));
    gl_FragColor = vec4(mix(uBg, col, fade), 1.0);
  }
`;

export function Floor({ mobile }: { mobile: boolean }) {
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
          tWet: { value: null },
          uWetOn: { value: 0 },
          uWetCenter: { value: floorWet.center },
          uWetExtent: { value: floorWet.extent },
          uBack: { value: 0 },
          uBackPos: { value: new THREE.Vector3() },
          uBackScale: { value: new THREE.Vector2() },
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
    u.tWet.value = floorWet.texture;
    u.uWetOn.value = floorWet.on && floorWet.texture ? 1 : 0;
    u.uBack.value = p.quiet * (1 - p.swap);
    const b = mobile ? BACKLIGHT.mobile : BACKLIGHT.desktop;
    u.uBackPos.value.set(b.pos[0], b.pos[1], b.pos[2]);
    u.uBackScale.value.set(b.scale[0], b.scale[1]);
  }, -1);

  return <mesh geometry={geometry} material={material} position-y={bottleDims.floorY} />;
}
