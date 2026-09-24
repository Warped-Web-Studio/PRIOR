"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import type { Tier } from "@/lib/store";
import { createBottleGeometries } from "./bottleGeometry";
import { createBackLabel, createCondensationNormalMap, createFrontLabel } from "./textures";
import { bottleRefs } from "./bottleRefs";

type Props = { tier: Tier; fontsReady: boolean };

const FRONT_ARC = 1.94; // radians — matches the label canvas aspect at r=0.5795
const BACK_ARC = 1.455;
const LABEL_R = 0.5795;
const LABEL_H = 1.52;
const LABEL_Y = -0.23;
// Transmission buffers see this instead of the (null) scene background.
const BUFFER_BG = new THREE.Color("#050607");

export function Bottle({ tier, fontsReady }: Props) {
  const high = tier === "high";

  const geo = useMemo(() => createBottleGeometries(tier), [tier]);
  const frontBand = useMemo(
    () => new THREE.CylinderGeometry(LABEL_R, LABEL_R, LABEL_H, high ? 96 : 56, 1, true, -FRONT_ARC / 2, FRONT_ARC),
    [high],
  );
  const backBand = useMemo(
    () =>
      new THREE.CylinderGeometry(LABEL_R, LABEL_R, LABEL_H, high ? 72 : 40, 1, true, Math.PI - BACK_ARC / 2, BACK_ARC),
    [high],
  );

  // The water line is a world-space clip plane so the surface stays level
  // however the bottle is tilted. The Director moves it every frame.
  const waterPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.6), []);
  const clipping = useMemo(() => [waterPlane], [waterPlane]);

  const [labels, setLabels] = useState<{ front: THREE.Texture; back: THREE.Texture } | null>(null);
  const condensation = useMemo(
    () => (high ? createCondensationNormalMap(geo.bodyV, 1024) : null),
    [high, geo.bodyV],
  );

  // Labels need the web font; draw them once it has loaded.
  useEffect(() => {
    if (!fontsReady) return;
    const scale = high ? 1 : 0.6;
    const front = createFrontLabel(scale);
    const back = createBackLabel(scale);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- textures must be built after fonts load, on the client
    setLabels({ front, back });
    return () => {
      front.dispose();
      back.dispose();
    };
  }, [fontsReady, high]);

  useEffect(
    () => () => {
      geo.glass.dispose();
      geo.water.dispose();
      geo.stopper.dispose();
      frontBand.dispose();
      backBand.dispose();
      condensation?.normal.dispose();
      condensation?.roughness.dispose();
    },
    [geo, frontBand, backBand, condensation],
  );

  const root = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const stopper = useRef<THREE.Mesh>(null);

  useEffect(() => {
    bottleRefs.root = root.current;
    bottleRefs.pivot = pivot.current;
    bottleRefs.turn = turn.current;
    bottleRefs.stopper = stopper.current;
    bottleRefs.waterPlane = waterPlane;
    return () => {
      bottleRefs.root = bottleRefs.pivot = bottleRefs.turn = bottleRefs.stopper = null;
    };
  }, [waterPlane]);

  const normalScale = useMemo(() => new THREE.Vector2(0.55, 0.55), []);

  // The front print sits *on* the glass, so the glass must not also refract
  // it (that doubles it). Hide it for the transmission passes (priority 0)
  // and restore it for the main render (priority 1).
  const frontLabel = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (frontLabel.current) frontLabel.current.visible = false;
  }, -0.5);
  useFrame(() => {
    if (frontLabel.current) frontLabel.current.visible = true;
  }, 0.5);

  return (
    <>
      <group ref={root}>
        <group ref={pivot}>
          <group ref={turn}>
            <mesh geometry={geo.glass} renderOrder={2}>
              <MeshTransmissionMaterial
                samples={high ? 8 : 4}
                resolution={high ? 1024 : 384}
                transmission={1}
                thickness={0.32}
                ior={1.5}
                chromaticAberration={high ? 0.045 : 0.02}
                anisotropicBlur={0.12}
                distortion={0.06}
                distortionScale={0.4}
                temporalDistortion={0}
                roughness={condensation ? 1 : 0.035}
                roughnessMap={condensation?.roughness ?? null}
                normalMap={condensation?.normal ?? null}
                normalScale={normalScale}
                clearcoat={1}
                clearcoatRoughness={0.04}
                color="#f5f8f8"
                attenuationColor="#dde9e7"
                attenuationDistance={4}
                envMapIntensity={1.15}
                specularIntensity={1}
                background={BUFFER_BG}
              />
            </mesh>

            <mesh geometry={geo.water} renderOrder={1}>
              {high ? (
                <MeshTransmissionMaterial
                  samples={4}
                  resolution={512}
                  transmission={1}
                  thickness={1.1}
                  ior={1.333}
                  chromaticAberration={0.02}
                  anisotropicBlur={0.05}
                  roughness={0}
                  color="#f1f6f5"
                  attenuationColor="#bcd3cf"
                  attenuationDistance={3.2}
                  envMapIntensity={0.4}
                  clippingPlanes={clipping}
                  background={BUFFER_BG}
                />
              ) : (
                <meshPhysicalMaterial
                  color="#6f8d8a"
                  roughness={0.05}
                  transparent
                  opacity={0.12}
                  envMapIntensity={0.9}
                  clippingPlanes={clipping}
                  depthWrite={false}
                />
              )}
            </mesh>

            {/* Back faces of the clipped water read as its surface — a free meniscus. */}
            <mesh geometry={geo.water} renderOrder={1}>
              <meshBasicMaterial color="#1c2f31" side={THREE.BackSide} clippingPlanes={clipping} />
            </mesh>

            {labels && (
              <>
                <mesh ref={frontLabel} geometry={frontBand} position-y={LABEL_Y} renderOrder={3}>
                  <meshStandardMaterial
                    color="#eef2f1"
                    roughness={0.4}
                    metalness={0}
                    alphaMap={labels.front}
                    transparent
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    envMapIntensity={0.7}
                  />
                </mesh>
                <mesh geometry={backBand} position-y={LABEL_Y} renderOrder={3}>
                  <meshStandardMaterial
                    color="#e7ecec"
                    roughness={0.45}
                    alphaMap={labels.back}
                    transparent
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    envMapIntensity={0.6}
                  />
                </mesh>
              </>
            )}
          </group>
        </group>
      </group>

      {/* The stopper lives at scene level so it can leave the bottle on its own path. */}
      <mesh ref={stopper} geometry={geo.stopper}>
        <meshStandardMaterial color="#141517" roughness={0.58} metalness={0.05} envMapIntensity={0.9} />
      </mesh>
    </>
  );
}
