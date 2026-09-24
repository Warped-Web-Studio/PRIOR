"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { getState, setState, useExperience } from "@/lib/store";
import { sceneState } from "@/lib/sceneState";
import { FOV } from "@/lib/motion";
import { Bottle } from "./Bottle";
import { Director } from "./Director";
import { StudioEnvironment } from "./StudioEnvironment";
import { Floor } from "./Floor";
import { BackdropType } from "./BackdropType";
import { PourStream } from "./PourStream";
import { Splash } from "./Splash";
import { Compositor } from "./Compositor";
import { bottleRefs } from "./bottleRefs";
import { AnchorProjector } from "./AnchorProjector";

type Props = { fontsReady: boolean; onReady: () => void };

const BACKGROUND = new THREE.Color("#050607");

/**
 * Renders on demand. The driver requests frames at full rate while anything
 * moves, halves the rate in the calm inquiry environment, and stops
 * entirely for reduced-motion users once that environment is static.
 */
function FrameDriver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let tick = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = getState();
      tick++;
      const idleInquiry = s.phase === "inquiry" && sceneState.pour.active === 0;
      if (idleInquiry && s.reducedMotion && tick % 30 !== 0) return;
      if (idleInquiry && tick % 2 !== 0) return;
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);
  return null;
}

/**
 * Transmission materials render the scene into their own buffers every frame
 * unless their material is invisible. Once we're through to the inquiry side
 * the studio is never seen, so turn it off completely.
 */
function StudioSleep() {
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const asleep = sceneState.pour.swap >= 0.999;
    const root = bottleRefs.root;
    if (!root || root.userData.asleep === asleep) return;
    root.userData.asleep = asleep;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && o.type === "Mesh") m.visible = !asleep;
    });
  }, -2);
  return null;
}

/** Inspection handle for automated visual QA (dev, or ?debug). */
function DebugHandle() {
  const state = useThree();
  useEffect(() => {
    const allowed = process.env.NODE_ENV !== "production" || window.location.search.includes("debug");
    if (!allowed) return;
    const w = window as unknown as { __three?: unknown };
    w.__three = { state, sceneState };
    return () => {
      delete w.__three;
    };
  }, [state]);
  return null;
}

function ContextGuard() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      // The idea must survive the GPU: fall back to the static stage.
      setState({ webgl: "none" });
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  return null;
}

export default function Scene({ fontsReady, onReady }: Props) {
  const tier = useExperience((s) => s.tier);
  const mobile = useExperience((s) => s.mobile);
  const reducedMotion = useExperience((s) => s.reducedMotion);
  const maxDpr = tier === "high" ? 1.75 : 1.5;
  const [dpr, setDpr] = useState(maxDpr);

  return (
    <Canvas
      className="stage-canvas"
      frameloop="demand"
      dpr={[1, dpr]}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: mobile ? FOV.mobile : FOV.desktop, near: 0.1, far: 60, position: [0, 0.1, 9.4] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.3;
        // The water line is a world-space clip plane (see Bottle).
        gl.localClippingEnabled = true;
        scene.background = BACKGROUND;
      }}
      aria-hidden
      tabIndex={-1}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <FrameDriver />
      <ContextGuard />
      <DebugHandle />
      <StudioSleep />
      <Director mobile={mobile} reducedMotion={reducedMotion} />
      <StudioEnvironment resolution={tier === "high" ? 256 : 128} />
      <BackdropType mobile={mobile} fontsReady={fontsReady} />
      <Bottle tier={tier} fontsReady={fontsReady} />
      <Floor />
      <PourStream tier={tier} />
      <Splash tier={tier} />
      <Compositor tier={tier} fontsReady={fontsReady} onFirstFrames={onReady} />
      <AnchorProjector />
    </Canvas>
  );
}
