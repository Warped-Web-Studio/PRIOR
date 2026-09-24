"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MAX_LENS_DROPS, sceneState } from "@/lib/sceneState";
import { bottleDims, pour as timing } from "@/lib/motion";
import { getState, type Tier } from "@/lib/store";
import { rig } from "./rig";
import { createWaterSurfaceMaterial } from "./waterMaterial";
import { setImpactHandler } from "./impact";
import { mulberry32 } from "./textures";

/**
 * The splash in three parts, all driven by time-since-impact on the GPU:
 *  1. Crown — an open cylinder whose radius, height and spiked rim evolve.
 *  2. Spray — ballistic droplets thrown from the crown rim.
 *  3. Lens drops — droplets *aimed at the camera*. Each is solved at impact
 *     to pass through a chosen screen point at a chosen time, so when it
 *     reaches the lens the compositor's water blob appears exactly where the
 *     3D drop was. That's the causal link between splash and transition.
 */

const LENS_DEPTH = 0.62; // view-space distance where a drop "lands" on the lens

type Counts = { spray: number; lens: number };
const COUNTS: Record<Tier, Counts> = {
  high: { spray: 160, lens: 28 },
  low: { spray: 56, lens: 12 },
};

function createDropletGeometry(total: number, detail: number) {
  const base = new THREE.IcosahedronGeometry(1, detail);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  g.instanceCount = total;
  g.setAttribute("aVel", new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));
  g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));
  // x: launch delay, y: lifetime (lens: hit time), z: radius, w: kind (0 spray, 1 lens)
  g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(new Float32Array(total * 4), 4));
  return g;
}

export function Splash({ tier }: { tier: Tier }) {
  const counts = COUNTS[tier];
  const total = counts.spray + counts.lens;

  const dropGeo = useMemo(() => createDropletGeometry(total, tier === "high" ? 2 : 1), [total, tier]);
  const crownGeo = useMemo(
    () => new THREE.CylinderGeometry(1, 1, 1, tier === "high" ? 96 : 56, 14, true).translate(0, 0.5, 0),
    [tier],
  );

  const shared = useMemo(
    () => ({
      uImpact: { value: new THREE.Vector3() },
      uSince: { value: -1 },
      uG: { value: timing.gravity },
      uFloor: { value: bottleDims.floorY },
      uCamDelta: { value: new THREE.Vector3() },
    }),
    [],
  );

  const drops = useMemo(
    () =>
      createWaterSurfaceMaterial({
        uniforms: shared,
        opacity: 0.78,
        rim: 1.6,
        declarations: /* glsl */ `
          attribute vec3 aVel; attribute vec3 aOrigin; attribute vec4 aInfo;
          uniform vec3 uImpact; uniform float uSince, uG, uFloor; uniform vec3 uCamDelta;
          vec3 dropPos;
        `,
        normalCode: /* glsl */ `
          float tau = uSince - aInfo.x;
          vec3 vel = aVel + vec3(0.0, -uG * tau, 0.0);
          dropPos = uImpact + aOrigin + aVel * tau + vec3(0.0, -0.5 * uG * tau * tau, 0.0);
          float alive = step(0.0, tau) * step(tau, aInfo.y);
          if (aInfo.w > 0.5) {
            // Keep aim true if the camera dollies after impact (translation only).
            float k = clamp(tau / aInfo.y, 0.0, 1.0);
            dropPos += uCamDelta * k * k * k;
          } else {
            alive *= step(uFloor, dropPos.y);
          }
          float grow = smoothstep(0.0, 0.07, tau);
          float radius = aInfo.z * alive * grow;
          // Motion elongation along velocity, as a short exposure would record.
          vec3 dir = normalize(vel + vec3(1e-4));
          float stretch = 1.0 + min(length(vel) * 0.07, 0.9);
          vec3 local = position * radius;
          local += dir * dot(local, dir) * (stretch - 1.0);
          dropPos += local;
          objectNormal = normal;
        `,
        positionCode: /* glsl */ `transformed = dropPos;`,
      }),
    [shared],
  );

  const crown = useMemo(
    () =>
      createWaterSurfaceMaterial({
        uniforms: shared,
        opacity: 0.7,
        rim: 1.8,
        side: THREE.DoubleSide,
        declarations: /* glsl */ `
          uniform vec3 uImpact; uniform float uSince;
          vec3 crownPos;
        `,
        normalCode: /* glsl */ `
          float tau = max(uSince, 0.0);
          float a = atan(position.z, position.x);
          float h = position.y;
          float R = 0.05 + 0.7 * (1.0 - exp(-tau * 3.2));
          float life = clamp(tau / 1.05, 0.0, 1.0);
          float H = 0.46 * pow(sin(life * 3.14159), 0.75) * step(0.0, uSince);
          // Rayleigh–Plateau fingers on the rim.
          float spikes = pow(abs(sin(a * 6.5 + 1.3)), 6.0) * 0.5 + pow(abs(sin(a * 11.0 + 0.4)), 10.0) * 0.3;
          float edge = 1.0 + spikes * smoothstep(0.55, 1.0, h);
          // Collapsed to a point outside its life so it never draws a flat ring.
          float r = R * (1.0 + 0.42 * h * h) * step(0.0, uSince) * step(uSince, 1.1);
          crownPos = uImpact + vec3(cos(a) * r, h * H * edge, sin(a) * r);
          objectNormal = normalize(vec3(cos(a), -0.35 - h * 0.4, sin(a)));
        `,
        positionCode: /* glsl */ `transformed = crownPos;`,
      }),
    [shared],
  );

  // Register the impact handler: aims the lens drops and publishes their
  // hit points to the compositor.
  useEffect(() => {
    const vec = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const target = new THREE.Vector3();
    setImpactHandler((camera) => {
      const rand = mulberry32(2400);
      const vel = dropGeo.getAttribute("aVel") as THREE.InstancedBufferAttribute;
      const origin = dropGeo.getAttribute("aOrigin") as THREE.InstancedBufferAttribute;
      const info = dropGeo.getAttribute("aInfo") as THREE.InstancedBufferAttribute;
      const g = timing.gravity;
      const impactAt = sceneState.pour.impactAt;

      // Spray from the crown rim.
      for (let i = 0; i < counts.spray; i++) {
        const a = rand() * Math.PI * 2;
        const delay = Math.pow(rand(), 1.6) * 0.5;
        const rimR = 0.05 + 0.7 * (1 - Math.exp(-delay * 3.2));
        const speedOut = 0.6 + rand() * 1.6;
        const up = 1.4 + rand() * 2.2;
        // Bias toward the camera so the splash reads as coming at you.
        const toward = rand() * 1.4;
        origin.setXYZ(i, Math.cos(a) * rimR, 0.05 + rand() * 0.15, Math.sin(a) * rimR);
        vel.setXYZ(i, Math.cos(a) * speedOut, up, Math.sin(a) * speedOut + toward);
        info.setXYZW(i, delay, 2.4, 0.008 + Math.pow(rand(), 3) * 0.028, 0);
      }

      // Lens drops: jittered grid over the viewport so coverage is even,
      // timed roughly bottom-first (they come from the floor).
      // Reduced motion keeps the splash but nothing flies at the viewer.
      const lensN = getState().reducedMotion ? 0 : counts.lens;
      for (let k = lensN; k < counts.lens; k++) info.setXYZW(counts.spray + k, 0, 0, 0, 1);
      camera.getWorldDirection(forward);
      const cols = tier === "high" ? 7 : 4;
      const rows = Math.ceil(counts.lens / cols);
      const heightAt = 2 * LENS_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (let k = 0; k < lensN; k++) {
        const i = counts.spray + k;
        const cx = k % cols;
        const cy = Math.floor(k / cols);
        const u = (cx + 0.15 + rand() * 0.7) / cols;
        const v = (cy + 0.15 + rand() * 0.7) / rows;
        const big = rand() < 0.3;
        const rFrac = big ? 0.075 + rand() * 0.07 : 0.022 + rand() * 0.04;
        const delay = rand() * 0.12;
        const flight = timing.lensLead + v * 0.5 + rand() * 0.28;

        vec.set(u * 2 - 1, v * 2 - 1, 0.5).unproject(camera).sub(camera.position).normalize();
        target.copy(camera.position).addScaledVector(vec, LENS_DEPTH / Math.max(vec.dot(forward), 0.2));
        const ox = (rand() - 0.5) * 0.3;
        const oz = (rand() - 0.5) * 0.3;
        origin.setXYZ(i, ox, 0.08, oz);
        vel.setXYZ(
          i,
          (target.x - (rig.impact.x + ox)) / flight,
          (target.y - (rig.impact.y + 0.08) + 0.5 * g * flight * flight) / flight,
          (target.z - (rig.impact.z + oz)) / flight,
        );
        info.setXYZW(i, delay, flight, rFrac * heightAt * 0.5, 1);

        const o = k * 4;
        sceneState.lens[o] = u;
        sceneState.lens[o + 1] = v;
        sceneState.lens[o + 2] = impactAt + delay + flight;
        sceneState.lens[o + 3] = rFrac;
      }
      sceneState.lensCount = Math.min(lensN, MAX_LENS_DROPS);
      vel.needsUpdate = true;
      origin.needsUpdate = true;
      info.needsUpdate = true;
    });
    return () => setImpactHandler(null);
  }, [dropGeo, counts, tier]);

  useEffect(
    () => () => {
      dropGeo.dispose();
      crownGeo.dispose();
      drops.material.dispose();
      crown.material.dispose();
    },
    [dropGeo, crownGeo, drops, crown],
  );

  useFrame(() => {
    const p = sceneState.pour;
    shared.uImpact.value.copy(rig.impact);
    shared.uSince.value = rig.impactReady ? p.clock - p.impactAt : -1;
    shared.uCamDelta.value.copy(rig.camDelta);
  }, -1);

  return (
    <>
      <mesh geometry={crownGeo} material={crown.material} frustumCulled={false} renderOrder={4} />
      <mesh geometry={dropGeo} material={drops.material} frustumCulled={false} renderOrder={5} />
    </>
  );
}
