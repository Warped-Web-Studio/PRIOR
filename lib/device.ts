import type { Tier } from "./store";

/** Probe WebGL2 without keeping the context alive. */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("nowebgl")) return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function isMobileLayout(): boolean {
  return window.matchMedia("(max-width: 767px), (max-aspect-ratio: 4/5)").matches;
}

/**
 * Quality tier. Touch devices, small screens and low core counts get the
 * cheaper render path; the sequence itself is identical.
 */
export function detectTier(): Tier {
  const params = new URLSearchParams(window.location.search);
  if (params.has("low")) return "low";
  if (params.has("high")) return "high";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (coarse || isMobileLayout() || cores <= 4) return "low";
  return "high";
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
