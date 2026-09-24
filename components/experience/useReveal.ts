"use client";

import { useEffect, useRef } from "react";
import { ease, gsap } from "@/lib/gsap";
import { getState, setState, useExperience } from "@/lib/store";
import { sceneState } from "@/lib/sceneState";
import { reveal } from "@/lib/motion";

/**
 * The product reveal. The bottle starts turned away (label reversed, seen
 * through the water), holds, then turns on a heavy curve while the light
 * travels further than the bottle does. Hero copy lands as the label does.
 */
export function useReveal() {
  const phase = useExperience((s) => s.phase);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  // The reveal flips the phase to "exploring" part-way through, so the
  // timeline must outlive phase changes — it is only killed on unmount.
  useEffect(() => () => void timeline.current?.kill(), []);

  useEffect(() => {
    if (phase !== "revealing" || timeline.current) return;
    const reduced = getState().reducedMotion;
    const tl = gsap.timeline();
    timeline.current = tl;
    const heroItems = "[data-hero-reveal]";

    if (reduced) {
      sceneState.reveal = 1;
      tl.to(sceneState, { light: 1, duration: 1.2, ease: ease.calm }, 0);
      tl.to(sceneState, { revealEnv: 1, duration: reveal.reducedDuration, ease: ease.calm }, 0);
      tl.to(sceneState, { typeIn: 1, duration: 1.2, ease: ease.calm }, 0.2);
      tl.fromTo(heroItems, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.06, ease: ease.calm }, 0.4);
      tl.call(() => setState({ phase: "exploring" }), undefined, 0.6);
      return;
    }

    const start = reveal.hold;
    tl.to(sceneState, { light: 1, duration: 2.6, ease: ease.calm }, 0);
    tl.to(sceneState, { revealEnv: 1, duration: reveal.duration + 0.8, ease: ease.calm }, start - 0.25);
    tl.to(sceneState, { reveal: 1, duration: reveal.duration, ease: ease.heavyTurn }, start);
    tl.to(sceneState, { typeIn: 1, duration: 2.4, ease: ease.calm }, start + 0.8);
    tl.fromTo(
      heroItems,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 1.5, ease: ease.settle, stagger: 0.12 },
      start + reveal.duration * 0.52,
    );
    // Interactive before the settle finishes — nobody should wait on polish.
    tl.call(() => setState({ phase: "exploring" }), undefined, start + reveal.duration * 0.7);
  }, [phase]);
}
