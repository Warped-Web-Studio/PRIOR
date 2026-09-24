"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * A procedural studio, rendered once into a cube map. Glass is lit almost
 * entirely by reflection, so these panels *are* the lighting design: one
 * tall key softbox, two hard rim strips that draw the silhouette, and a
 * faint top light for the shoulder. Everything else stays black.
 */
export function StudioEnvironment({ resolution }: { resolution: number }) {
  return (
    <Environment resolution={resolution} frames={1} background={false}>
      <color attach="background" args={["#000000"]} />
      {/* Key: tall softbox, front-left. */}
      <Lightformer form="rect" intensity={2.6} color="#f4f7f7" position={[-4.2, 0.8, 3.2]} scale={[2.4, 8, 1]} target={[0, 0, 0]} />
      {/* Rim right: hard strip behind the bottle's right edge. */}
      <Lightformer form="rect" intensity={6} color="#ffffff" position={[4.6, 0.4, -2.4]} scale={[0.35, 11, 1]} target={[0, 0, 0]} />
      {/* Rim left: weaker, cooler, gives the glass its second edge. */}
      <Lightformer form="rect" intensity={2.4} color="#dbe9ec" position={[-4.8, 0.2, -2.8]} scale={[0.28, 11, 1]} target={[0, 0, 0]} />
      {/* Top: soft disc, catches the shoulder and stopper. */}
      <Lightformer form="circle" intensity={0.9} color="#eef3f3" position={[0, 6, 0.5]} scale={[3, 3, 1]} target={[0, 0, 0]} />
      {/* A low glacial bounce so the water carries a trace of colour. */}
      <Lightformer form="rect" intensity={0.35} color="#9ccbc5" position={[0, -5, 2]} scale={[8, 2, 1]} target={[0, 0, 0]} />
    </Environment>
  );
}
