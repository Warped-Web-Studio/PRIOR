"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, CustomEase);

/**
 * Named curves. Generic power eases read as UI; these are shaped to read as
 * mass: a slow, reluctant start, a long glide and a soft landing.
 */
export const ease = {
  // The reveal turn: heavy onset, most travel mid-way, very long deceleration.
  heavyTurn: CustomEase.create("heavyTurn", "M0,0 C0.18,0 0.28,0.08 0.4,0.32 0.52,0.58 0.62,0.86 0.76,0.96 0.86,1.01 0.94,1 1,1"),
  // Lifting a full bottle: hesitation, then commitment.
  lift: CustomEase.create("lift", "M0,0 C0.3,0 0.34,0.18 0.46,0.48 0.6,0.84 0.78,1 1,1"),
  // Tilt that slows as water reaches the lip — hands are careful at that point.
  tilt: CustomEase.create("tilt", "M0,0 C0.22,0 0.3,0.24 0.44,0.52 0.58,0.8 0.72,0.93 1,1"),
  // Falling under gravity (quadratic), so the stream visibly accelerates.
  fall: "power2.in",
  // A splash approaching the lens — accelerates toward the viewer.
  approach: CustomEase.create("approach", "M0,0 C0.28,0.02 0.5,0.18 0.66,0.44 0.8,0.68 0.9,0.9 1,1"),
  // Water sliding off glass: sticks, then lets go.
  release: CustomEase.create("release", "M0,0 C0.24,0 0.34,0.1 0.48,0.34 0.62,0.6 0.76,0.88 1,1"),
  settle: "expo.out",
  calm: "sine.inOut",
};

export { gsap, ScrollTrigger };
