"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import { bottleDims, pour as timing } from "@/lib/motion";
import { getState, type Tier } from "@/lib/store";
import { compositorFragment, compositorVertex } from "./shaders/compositor";
import { FluidSim, SIM_CONFIG, type SimContext } from "./fluid/sim";
import { FluidRenderer } from "./fluid/FluidRenderer";
import { LensWater } from "./fluid/LensWater";
import { FloorWetness, floorWet } from "./fluid/FloorWetness";
import { rig } from "./rig";

type Props = { tier: Tier; onFirstFrames: () => void; fontsReady: boolean };

/**
 * Owns rendering (priority 1). Per frame:
 *   studio scene → HDR target
 *   (pour live) particle sim → screen-space fluid over the studio → mip-mapped target
 *   (water on the lens) lens-film simulation step
 *   final pass: tone map, inquiry environment, lens water, grain
 * When nothing is pouring, only the first and last run.
 */
export function Compositor({ tier, onFirstFrames, fontsReady }: Props) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const viewportDpr = useThree((s) => s.viewport.dpr);
  const high = tier === "high";

  const targets = useMemo(() => {
    const sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: high ? 4 : 0,
      depthBuffer: true,
      stencilBuffer: false,
    });
    // Studio + fluid, with a mip chain so thick lens water can blur it.
    const finalRT = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    return { sceneRT, finalRT };
  }, [high]);

  const water = useMemo(() => {
    const cfg = SIM_CONFIG[tier];
    const sim = new FluidSim(cfg);
    const fluid = new FluidRenderer(sim, high ? 0.75 : 0.5, cfg.streamRadius);
    const lens = new LensWater(high ? 400 : 260);
    const wetness = new FloorWetness(sim, high ? 256 : 160);
    return { sim, fluid, lens, wetness };
  }, [tier, high]);

  // Quad, material and scene are built together: Strict Mode runs memos
  // twice, and re-parenting a shared quad would leave one scene empty.
  const { material, quadScene, quad } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: compositorVertex,
      fragmentShader: compositorFragment,
      uniforms: {
        tStudio: { value: null },
        uStudioLod: { value: 0 },
        tLens: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uSurface: { value: 0 },
        uSwap: { value: 0 },
        uQuiet: { value: 0 },
        uWater: { value: 0 },
        uInquiryTime: { value: 0 },
        uCoverFloor: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    return { material, quadScene, quad };
  }, []);
  const quadCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * viewportDpr));
    const h = Math.max(1, Math.floor(size.height * viewportDpr));
    targets.sceneRT.setSize(w, h);
    targets.finalRT.setSize(w, h);
    water.fluid.setSize(w, h);
    water.lens.setAspect(w / h);
    material.uniforms.uRes.value.set(w, h);
  }, [size, viewportDpr, targets, water, material]);

  useEffect(
    () => () => {
      targets.sceneRT.dispose();
      targets.finalRT.dispose();
      water.fluid.dispose();
      water.lens.dispose();
      water.wetness.dispose();
    },
    [targets, water],
  );
  useEffect(
    () => () => {
      material.dispose();
      quad.geometry.dispose();
    },
    [material, quad],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && !window.location.search.includes("debug")) return;
    (window as unknown as { __compositor?: unknown }).__compositor = { ...targets, ...water, quadScene };
  }, [targets, water, quadScene]);

  const frames = useRef(0);
  const inquiryClock = useRef(0);
  const lastClock = useRef(0);
  const ctx = useMemo<SimContext>(
    () => ({
      mouth: rig.mouth,
      mouthDir: rig.mouthDir,
      streamAt: 999,
      camera: null as unknown as THREE.PerspectiveCamera,
      floorY: bottleDims.floorY,
      gravity: timing.gravity,
      drain: 0,
      reduced: false,
    }),
    [],
  );

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    const p = sceneState.pour;
    const u = material.uniforms;
    const camera = state.camera as THREE.PerspectiveCamera;
    const renderStudio = p.swap < 0.999;
    const { sim, fluid, lens } = water;

    // A new pour (or a return) restarts the clock: clear the glass.
    if (p.clock < lastClock.current - 0.25) lens.markDirty();
    lastClock.current = p.clock;

    if (renderStudio) {
      gl.setRenderTarget(targets.sceneRT);
      gl.render(state.scene, camera);
      gl.setRenderTarget(null);
    }

    // The floor reads last frame's wetness map; that one-frame lag is invisible.
    let studioTex = targets.sceneRT.texture;
    let lod = 0;
    if (p.active > 0 && renderStudio) {
      ctx.camera = camera;
      ctx.streamAt = p.streamAt;
      ctx.drain = p.drain;
      ctx.reduced = getState().reducedMotion;
      sim.advanceTo(p.clock, ctx);
      rig.impactReady = sim.impactAt !== Infinity;
      if (rig.impactReady) {
        rig.impact.copy(sim.impact);
        p.impactAt = sim.impactAt;
      }
      water.wetness.render(gl);
      floorWet.on = 1;
      fluid.backlight = p.quiet * (1 - p.swap);
      fluid.render(gl, state.scene, camera, targets.sceneRT.texture, targets.finalRT);
      studioTex = targets.finalRT.texture;
      lod = 1;
    }

    // The lens film runs whenever water could be on the glass.
    if (p.active === 0) floorWet.on = 0;
    const wet = p.active > 0 || p.level > -0.25;
    if (wet) {
      const reduced = getState().reducedMotion;
      lens.step(
        gl,
        {
          dt,
          time: state.clock.elapsedTime,
          flood: p.draining > 0.5 ? 0 : p.level > -0.2 ? 1 : 0,
          level: p.level,
          draining: p.draining,
          boost: reduced ? 1.4 : 1.1,
          pin: 0.24 * (1 - p.lensFade),
          evap: p.lensFade * 2.2,
        },
        sim.splats,
      );
    }
    sim.splats.length = 0;

    u.tStudio.value = studioTex;
    u.uStudioLod.value = lod;
    u.tLens.value = lens.texture;
    u.uWater.value = wet ? 1 : 0;
    u.uTime.value = state.clock.elapsedTime;
    u.uSurface.value = p.surface;
    u.uSwap.value = p.swap;
    u.uQuiet.value = p.quiet;
    // Once the splash wall is over the whole frame, nothing may show through.
    u.uCoverFloor.value = THREE.MathUtils.smoothstep(p.level, 1.02, 1.3) * 0.45;
    inquiryClock.current += p.swap > 0 ? dt : 0;
    u.uInquiryTime.value = inquiryClock.current;

    gl.render(quadScene, quadCamera);

    if (fontsReady && frames.current < 4) {
      frames.current++;
      if (frames.current === 4) onFirstFrames();
    }
  }, 1);

  return null;
}
