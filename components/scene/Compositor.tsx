"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MAX_LENS_DROPS, sceneState } from "@/lib/sceneState";
import type { Tier } from "@/lib/store";
import { compositorFragment, compositorVertex } from "./shaders/compositor";

type Props = { tier: Tier; onFirstFrames: () => void; fontsReady: boolean };

/**
 * Takes over rendering (priority 1): scene → HDR target → one fullscreen
 * pass. Keeping the whole finish in a single pass avoids a post-processing
 * dependency and means the transition mask costs nothing when idle.
 */
export function Compositor({ tier, onFirstFrames, fontsReady }: Props) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const viewportDpr = useThree((s) => s.viewport.dpr);
  const lensCount = tier === "high" ? MAX_LENS_DROPS : 12;

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: tier === "high" ? 4 : 0,
        depthBuffer: true,
        stencilBuffer: false,
      }),
    [tier],
  );

  // Quad, material and scene are built together: Strict Mode runs memos
  // twice, and re-parenting a shared quad would leave one scene empty.
  const { quad, material, quadScene } = useMemo(() => {
    const lens = Array.from({ length: lensCount }, () => new THREE.Vector4());
    const material = new THREE.ShaderMaterial({
      vertexShader: compositorVertex,
      fragmentShader: compositorFragment,
      defines: { LENS_COUNT: lensCount, FBM_OCTAVES: tier === "high" ? 4 : 3 },
      uniforms: {
        tScene: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uClock: { value: 0 },
        uLevel: { value: -0.3 },
        uDraining: { value: 0 },
        uSurface: { value: 0 },
        uSwap: { value: 0 },
        uQuiet: { value: 0 },
        uLight: { value: 0 },
        uWater: { value: 0 },
        uLens: { value: lens },
        uLensCount: { value: 0 },
        uLensFade: { value: 0 },
        uInquiryTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    return { quad, material, quadScene };
  }, [lensCount, tier]);
  const quadCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * viewportDpr));
    const h = Math.max(1, Math.floor(size.height * viewportDpr));
    target.setSize(w, h);
    material.uniforms.uRes.value.set(w, h);
  }, [size, viewportDpr, target, material]);

  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
    [target, material, quad],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && !window.location.search.includes("debug")) return;
    (window as unknown as { __compositor?: unknown }).__compositor = { quad, material, target, quadScene, quadCamera };
  }, [quad, material, target, quadScene, quadCamera]);

  const frames = useRef(0);
  const inquiryClock = useRef(0);

  useFrame((state, dt) => {
    const p = sceneState.pour;
    const u = material.uniforms;
    const renderStudio = p.swap < 0.999;

    if (renderStudio) {
      gl.setRenderTarget(target);
      gl.render(state.scene, state.camera);
      gl.setRenderTarget(null);
    }

    u.tScene.value = target.texture;
    u.uTime.value = state.clock.elapsedTime;
    u.uClock.value = p.clock;
    u.uLevel.value = p.level;
    u.uDraining.value = p.draining;
    u.uSurface.value = p.surface;
    u.uSwap.value = p.swap;
    u.uQuiet.value = p.quiet;
    u.uLight.value = sceneState.light;
    u.uLensFade.value = p.lensFade;
    inquiryClock.current += p.swap > 0 ? Math.min(dt, 0.1) : 0;
    u.uInquiryTime.value = inquiryClock.current;

    const n = Math.min(sceneState.lensCount, lensCount);
    u.uLensCount.value = n;
    const lens = u.uLens.value as THREE.Vector4[];
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      lens[i].set(sceneState.lens[o], sceneState.lens[o + 1], sceneState.lens[o + 2], sceneState.lens[o + 3]);
    }
    // Skip the SDF entirely unless water is actually on the lens.
    u.uWater.value = p.level > -0.25 || (n > 0 && p.lensFade < 0.999) ? 1 : 0;

    gl.render(quadScene, quadCamera);

    if (fontsReady && frames.current < 4) {
      frames.current++;
      if (frames.current === 4) onFirstFrames();
    }
  }, 1);

  return null;
}
