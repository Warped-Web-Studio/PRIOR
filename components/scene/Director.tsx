"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { sceneState } from "@/lib/sceneState";
import {
  FOLLOW,
  FOV,
  bottleDims,
  desktopPoses,
  desktopPourPose,
  mobilePoses,
  mobilePourPose,
  reveal as revealTiming,
} from "@/lib/motion";
import { createPose, damp, dampVec, poseAt, rig, Spring } from "./rig";
import { bottleRefs } from "./bottleRefs";

type Props = { mobile: boolean; reducedMotion: boolean };

const MOUTH_LOCAL = new THREE.Vector3(0, bottleDims.mouthY, 0);
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The Director owns every transform that depends on scroll, reveal, pour or
 * pointer: camera, bottle, stopper and the water line. Running it first
 * (priority -3) means every effect and transmission pass this frame sees
 * the same, final object positions.
 */
export function Director({ mobile, reducedMotion }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);

  const state = useMemo(() => {
    const poses = mobile ? mobilePoses : desktopPoses;
    const target = createPose();
    const current = poseAt(0, poses, createPose());
    return {
      poses,
      target,
      current,
      turn: new Spring(reducedMotion ? 0 : revealTiming.fromRotY, 3.4, 0.82),
      parallax: new THREE.Vector2(),
      camPos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      bottle: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      stopperRelease: new THREE.Vector3(),
      stopperReleaseQuat: new THREE.Quaternion(),
      stopperReleased: false,
      tmp: new THREE.Vector3(),
      euler: new THREE.Euler(),
      spin: new THREE.Quaternion(),
    };
  }, [mobile, reducedMotion]);

  useFrame((frame, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    const t = frame.clock.elapsedTime;
    const p = sceneState.pour;
    const pp = mobile ? mobilePourPose : desktopPourPose;
    const { current, target } = state;

    // ---- Scroll pose, spring-followed so scrubbing never looks mechanical.
    poseAt(sceneState.scroll, state.poses, target);
    dampVec(current.bottle, target.bottle, FOLLOW.position, dt);
    dampVec(current.cam, target.cam, FOLLOW.camera, dt);
    dampVec(current.look, target.look, FOLLOW.camera, dt);
    current.rotY = damp(current.rotY, target.rotY, FOLLOW.rotation, dt);
    current.rotZ = damp(current.rotZ, target.rotZ, FOLLOW.rotation, dt);
    current.env = damp(current.env, target.env, FOLLOW.rotation, dt);
    current.exposure = damp(current.exposure, target.exposure, 2, dt);

    // ---- Reveal: GSAP shapes the target, the spring adds mass and settle.
    const revealTarget = reducedMotion ? 0 : (1 - sceneState.reveal) * revealTiming.fromRotY;
    const revealTurn = state.turn.step(revealTarget, dt);

    // ---- Life after the reveal: a breath, not a wobble.
    const alive = reducedMotion ? 0 : (1 - p.frame) * sceneState.reveal;
    const swayY = Math.sin(t * 0.31) * 0.035 * alive;
    const lean = Math.sin(t * 0.23 + 1.2) * 0.006 * alive;

    if (!mobile && !reducedMotion) {
      state.parallax.x = damp(state.parallax.x, sceneState.pointer.x, 2.2, dt);
      state.parallax.y = damp(state.parallax.y, sceneState.pointer.y, 2.2, dt);
    }

    // ---- Bottle.
    const root = bottleRefs.root;
    const pivot = bottleRefs.pivot;
    const turn = bottleRefs.turn;
    if (root && pivot && turn) {
      // Lift arcs: vertical leads, lateral follows, so it never slides on the floor.
      const liftV = Math.pow(p.lift, 0.72);
      state.bottle.set(
        mix(current.bottle.x, pp.bottle[0], p.lift),
        mix(current.bottle.y, pp.bottle[1], liftV),
        mix(current.bottle.z, pp.bottle[2], p.lift),
      );
      root.position.copy(state.bottle);

      // Weight shift: a slight lean back while lifting, before committing to the tilt.
      const weight = -0.07 * Math.sin(Math.PI * p.lift) * (1 - p.tilt);
      pivot.rotation.z = mix(current.rotZ + lean, 0, p.lift) + p.tilt * pp.tilt + weight;

      const scrollTurn = current.rotY + revealTurn + swayY;
      // Turn the label toward camera for the pour, taking the short way round.
      const wrapped = Math.atan2(Math.sin(scrollTurn), Math.cos(scrollTurn));
      turn.rotation.y = mix(scrollTurn, mix(wrapped, -0.22, 1), p.lift);

      root.updateMatrixWorld(true);
      rig.bottleCenter.setFromMatrixPosition(turn.matrixWorld);
      rig.mouth.copy(MOUTH_LOCAL).applyMatrix4(turn.matrixWorld);
      turn.getWorldQuaternion(state.quat);
      rig.mouthDir.copy(UP).applyQuaternion(state.quat);

      // ---- Water line (world space). An art-directed volume approximation:
      // level falls with tilt as a full bottle's would, then is capped at the
      // lip once pouring so the surface meets the stream.
      const theta = pivot.rotation.z;
      const c = Math.cos(theta);
      const s = Math.abs(Math.sin(theta));
      const staticLevel = rig.bottleCenter.y + bottleDims.restLevel * c + 0.25 * s - p.drain * 0.34;
      const pouring = p.clock >= p.streamAt ? 1 : 0;
      const lip = rig.mouth.y + (pouring ? 0.035 : -0.012);
      const level = p.tilt > 0.001 ? Math.min(staticLevel, lip) : staticLevel;
      rig.waterLevel = level;
      if (bottleRefs.waterPlane) bottleRefs.waterPlane.constant = level;

      // ---- Stopper: eased out of the neck, then released on its own path.
      const stopper = bottleRefs.stopper;
      if (stopper) {
        const draw = clamp01(p.uncork / 0.3);
        if (p.uncork < 0.3) {
          state.stopperReleased = false;
          stopper.position.set(0, draw * draw * (3 - 2 * draw) * 0.2, 0);
          stopper.quaternion.identity();
          stopper.position.applyMatrix4(turn.matrixWorld);
          stopper.quaternion.copy(state.quat);
        } else {
          if (!state.stopperReleased) {
            state.tmp.set(0, 0.2, 0).applyMatrix4(turn.matrixWorld);
            state.stopperRelease.copy(state.tmp);
            state.stopperReleaseQuat.copy(state.quat);
            state.stopperReleased = true;
          }
          const f = (p.uncork - 0.3) / 0.7;
          stopper.position.copy(state.stopperRelease);
          stopper.position.y += f * f * 6.5 + f * 0.25;
          stopper.position.x += f * f * 0.6;
          state.euler.set(f * 0.5, 0, -f * 0.35);
          stopper.quaternion.copy(state.stopperReleaseQuat).multiply(state.spin.setFromEuler(state.euler));
        }
        stopper.visible = p.uncork < 0.999;
      }
    }

    // ---- Camera.
    const px = state.parallax.x * 0.14 * (1 - p.frame);
    const py = state.parallax.y * 0.08 * (1 - p.frame);
    state.camPos.set(
      mix(current.cam.x + px, pp.cam[0], p.frame) + pp.push[0] * p.push,
      mix(current.cam.y + py, pp.cam[1], p.frame) + pp.push[1] * p.push,
      mix(current.cam.z, pp.cam[2], p.frame) + pp.push[2] * p.push,
    );
    state.look.set(
      mix(current.look.x, pp.look[0], p.frame) + pp.push[0] * p.push,
      mix(current.look.y, pp.look[1], p.frame) + pp.push[1] * p.push,
      mix(current.look.z, pp.look[2], p.frame) + pp.push[2] * p.push,
    );
    camera.position.copy(state.camPos);
    camera.lookAt(state.look);
    const fov = mix(mobile ? FOV.mobile : FOV.desktop, pp.fov, p.frame);
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    if (rig.impactReady) rig.camDelta.copy(camera.position).sub(rig.camAtImpact);

    // ---- Light: rotating the environment moves highlights across the glass.
    const revealEnv = reducedMotion
      ? (1 - sceneState.revealEnv) * -0.9
      : (1 - sceneState.revealEnv) * revealTiming.envFrom;
    scene.environmentRotation.y = mix(current.env + revealEnv + state.parallax.x * 0.06, 0.42, p.frame);
    frame.gl.toneMappingExposure = current.exposure * (0.3 + 0.7 * sceneState.light) * (1 - 0.12 * p.quiet);

    rig.isMobile = mobile;
  }, -3);

  return null;
}
