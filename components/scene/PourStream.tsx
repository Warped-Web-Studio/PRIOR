"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { bottleDims, pour as timing } from "@/lib/motion";
import type { Tier } from "@/lib/store";
import { rig } from "./rig";
import { createWaterSurfaceMaterial } from "./waterMaterial";
import { onImpact } from "./impact";

/**
 * The pour stream is a tube parameterised by *time of flight*, not length:
 * vertex `s` sits where water that left the mouth s·T seconds ago is now.
 * That gives physics for free — the head accelerates, the column thins as
 * it speeds up (continuity: r ∝ 1/√v), and head/tail reveal is just a
 * clamp on s. Evaluated entirely in the vertex shader.
 */

const POUR_SPEED = 0.62; // exit speed along the neck, units/s

function createStreamGeometry(rings: number, sides: number) {
  const count = (rings + 1) * (sides + 1);
  const aS = new Float32Array(count);
  const aA = new Float32Array(count);
  const position = new Float32Array(count * 3);
  let k = 0;
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j <= sides; j++) {
      aS[k] = i / rings;
      aA[k] = (j / sides) * Math.PI * 2;
      k++;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
  g.setAttribute("aA", new THREE.BufferAttribute(aA, 1));
  g.setIndex(index);
  return g;
}

export function PourStream({ tier }: { tier: Tier }) {
  const camera = useThree((s) => s.camera);
  const geometry = useMemo(
    () => (tier === "high" ? createStreamGeometry(140, 18) : createStreamGeometry(80, 12)),
    [tier],
  );

  const { material, uniforms } = useMemo(() => {
    const uniforms = {
      uP0: { value: new THREE.Vector3() },
      uV0: { value: new THREE.Vector3() },
      uG: { value: timing.gravity },
      uT: { value: 0.6 },
      uHead: { value: 0 },
      uTail: { value: 0 },
      uR0: { value: 0 },
      uMouthR: { value: bottleDims.mouthRadius * 0.92 },
      uTime: { value: 0 },
    };
    const { material } = createWaterSurfaceMaterial({
      uniforms,
      opacity: 0.82,
      rim: 1.5,
      declarations: /* glsl */ `
        attribute float aS;
        attribute float aA;
        uniform vec3 uP0; uniform vec3 uV0;
        uniform float uG, uT, uHead, uTail, uR0, uMouthR, uTime;
        vec3 streamCenter; vec3 streamN; float streamR;
      `,
      normalCode: /* glsl */ `
        float s = aS;
        float tt = s * uT;
        streamCenter = uP0 + uV0 * tt + vec3(0.0, -0.5 * uG * tt * tt, 0.0);
        vec3 vel = uV0 + vec3(0.0, -uG * tt, 0.0);
        vec3 tangent = normalize(vel);
        vec3 refAxis = abs(tangent.z) < 0.92 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 side = normalize(cross(tangent, refAxis));
        vec3 up = cross(side, tangent);
        // Continuity: a faster column is a thinner column.
        float r = uR0 * sqrt(length(uV0) / max(length(vel), 1e-3));
        // The column leaves the lip as wide as the mouth and necks down.
        r = mix(uMouthR * min(1.0, uR0 * 14.0), r, smoothstep(0.0, 0.09, s));
        // Surface tension ripples travelling down the column.
        float wob = sin(s * 42.0 - uTime * 24.0 + aA * 2.0) * 0.14 * s
                  + sin(aA * 3.0 + s * 18.0 - uTime * 9.0) * 0.07;
        r *= 1.0 + wob;
        // Leading bead: the first water arrives as a heavier drop.
        float toHead = uHead - s;
        r *= mix(1.0, 1.45, smoothstep(0.06, 0.0, toHead)) * smoothstep(-0.004, 0.018, toHead);
        r *= smoothstep(0.0, 0.05, s - uTail);
        streamR = max(r, 0.0);
        streamN = cos(aA) * side + sin(aA) * up;
        objectNormal = streamN;
      `,
      positionCode: /* glsl */ `transformed = streamCenter + streamN * streamR;`,
    });
    return { material, uniforms };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const p = sceneState.pour;
    const u = uniforms;
    u.uTime.value = state.clock.elapsedTime;

    const since = p.clock - p.streamAt;
    const live = since > 0 && p.active > 0 && p.swap < 0.999;

    // Launch conditions from the bottle as it is right now.
    u.uV0.value.copy(rig.mouthDir).multiplyScalar(POUR_SPEED);
    u.uP0.value.copy(rig.mouth).addScaledVector(rig.mouthDir, 0.01);
    const vy = u.uV0.value.y;
    const drop = u.uP0.value.y - bottleDims.floorY;
    const T = (vy + Math.sqrt(vy * vy + 2 * timing.gravity * Math.max(drop, 0.01))) / timing.gravity;
    u.uT.value = T;

    const head = live ? Math.min(since / T, 1) : 0;
    u.uHead.value = head;
    u.uTail.value = p.tail;
    // The first glug: flow ramps up over ~0.18 s.
    u.uR0.value = live ? 0.052 * Math.min(1, since / 0.18) * (1 - p.drain * 0.35) : 0;

    // Impact is detected here, where the geometry of the fall is known.
    if (live && head >= 1 && !rig.impactReady) {
      const t = T;
      rig.impact.set(
        u.uP0.value.x + u.uV0.value.x * t,
        bottleDims.floorY,
        u.uP0.value.z + u.uV0.value.z * t,
      );
      p.impactAt = p.streamAt + T;
      rig.camAtImpact.copy(camera.position);
      rig.camDelta.set(0, 0, 0);
      rig.impactReady = true;
      onImpact(camera as THREE.PerspectiveCamera);
    } else if (rig.impactReady && p.clock < p.impactAt - 1e-3) {
      // Timeline sought backwards (or reset): forget the impact.
      rig.impactReady = false;
      sceneState.lensCount = 0;
    }
  }, -1);

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}
