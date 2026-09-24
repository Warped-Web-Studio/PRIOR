"use client";

import { ease, gsap } from "@/lib/gsap";
import { getState, setState } from "@/lib/store";
import { resetPour, sceneState } from "@/lib/sceneState";
import { pour, pourReduced, returnSeq } from "@/lib/motion";

/**
 * The signature transition as one deterministic GSAP timeline. Every visual
 * system reads from `sceneState.pour`; this is the only writer. There is at
 * most one live timeline — the phase guard rejects re-entry, and any
 * previous timeline is killed before a new one is built.
 */

let active: gsap.core.Timeline | null = null;
let pushedHistory = false;
/** Whatever started the pour gets focus back on return. */
let trigger: HTMLElement | null = null;

const Q = {
  quiet: "[data-quiet]",
  inquiryRoot: "[data-inquiry-root]",
  inquiryItem: "[data-inquiry-reveal]",
  fallbackBottle: "[data-fb-bottle]",
  fallbackStream: "[data-fb-stream]",
  fallbackWater: "[data-fb-water]",
  fallbackSurface: "[data-fb-surface]",
};

function kill() {
  active?.kill();
  active = null;
}

function lockScroll(lock: boolean) {
  document.documentElement.classList.toggle("is-locked", lock);
}

const focusable = (el: HTMLElement | null) =>
  !!el && el.isConnected && !el.closest("[inert]") && getComputedStyle(el).visibility !== "hidden";

/** Focus after React has committed the phase change (and lifted `inert`). */
function focusSoon(selector: string, tries = 10) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (focusable(el)) el!.focus({ preventScroll: true });
    else if (tries > 0) focusSoon(selector, tries - 1);
  });
}

function restoreFocus(tries = 10) {
  requestAnimationFrame(() => {
    const target = focusable(trigger) ? trigger : document.querySelector<HTMLElement>(".masthead__cta");
    if (focusable(target)) target!.focus({ preventScroll: true });
    else if (tries > 0) restoreFocus(tries - 1);
  });
}

function enterInquiry() {
  setState({ phase: "inquiry" });
  if (window.location.hash !== "#request") {
    window.history.pushState({ prior: "request" }, "", "#request");
    pushedHistory = true;
  }
  focusSoon("#inquiry-title");
}

/** Called from the CTA, the header link and the skip link. */
export function requestPour(): boolean {
  const s = getState();
  if (s.phase !== "exploring" && s.phase !== "revealing") return false;
  kill();
  trigger = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  // Cut a running reveal short; the bottle's spring carries it home smoothly.
  gsap.killTweensOf(sceneState);
  gsap.killTweensOf("[data-hero-reveal]");
  sceneState.reveal = 1;
  sceneState.revealEnv = 1;
  sceneState.light = 1;
  sceneState.typeIn = 1;
  gsap.set("[data-hero-reveal]", { autoAlpha: 1, y: 0 });

  setState({ phase: "transitioning" });
  lockScroll(true);
  active = s.webgl === "ok" ? buildPour(s.reducedMotion) : buildFallbackPour(s.reducedMotion);
  exposeDebug();
  return true;
}

function buildPour(reduced: boolean) {
  // resetPour() moves impactAt to 999; the stream sees clock < impactAt and
  // clears its impact on the next frame. (No scene import here — that would
  // pull Three.js into the initial bundle.)
  resetPour();
  const p = sceneState.pour;
  const T = reduced ? pourReduced : pour;
  p.active = 1;
  p.streamAt = T.streamAt;

  const tl = gsap.timeline({
    onComplete: () => {
      p.active = 0;
      active = null;
      enterInquiry();
    },
  });

  // The clock drives everything time-based (stream, splash, lens drops).
  tl.to(p, { clock: T.total, duration: T.total, ease: "none" }, 0);

  // 1 — The room goes quiet; light narrows onto the bottle.
  tl.to(Q.quiet, { autoAlpha: 0, duration: T.quiet, ease: ease.calm }, 0);
  tl.to(p, { quiet: 1, duration: T.quiet + 0.5, ease: ease.calm }, 0);
  tl.to(p, { frame: 1, duration: reduced ? 1.0 : 1.75, ease: "power2.inOut" }, reduced ? 0 : 0.12);

  // 2 — Stopper drawn, bottle lifted, weight shifts, tilt toward the lip.
  tl.to(p, { uncork: 1, duration: T.uncork, ease: "power1.in" }, T.uncorkAt);
  tl.to(p, { lift: 1, duration: T.lift, ease: ease.lift }, T.liftAt);
  tl.to(p, { tilt: 1, duration: T.tilt, ease: ease.tilt }, T.tiltAt);

  // 3 — Water leaves the bottle. Head/impact are physical (see PourStream).
  tl.to(p, { drain: 1, duration: 2.4, ease: "sine.in" }, T.streamAt);
  if (!reduced) tl.to(p, { push: 1, duration: 1.7, ease: ease.calm }, 1.7);

  // 4 — The splash wall reaches the lens and covers it.
  tl.to(p, { level: 1.35, duration: T.sheet, ease: reduced ? ease.calm : ease.approach }, T.sheetAt);

  // 5 — Submerged: light turns from ink to ice, the world changes behind.
  tl.to(p, { surface: 1, duration: 0.5, ease: ease.calm }, T.swapAt - 0.14);
  tl.to(p, { swap: 1, duration: T.swap, ease: ease.calm }, T.swapAt);
  // Items are hidden (reversibly, so seeking is safe) before the root shows.
  tl.set(Q.inquiryItem, { autoAlpha: 0, y: reduced ? 0 : 26 }, T.swapAt - 0.02);
  tl.set(Q.inquiryRoot, { autoAlpha: 1 }, T.swapAt);

  // 6 — The water lets go of the lens and drains; the inquiry rises through.
  tl.set(p, { draining: 1 }, T.recedeAt);
  tl.to(p, { lensFade: 1, duration: 1.25, ease: "sine.in" }, T.recedeAt + 0.2);

  if (reduced) {
    tl.to(p, { level: -0.32, duration: T.recede, ease: ease.release }, T.recedeAt);
    tl.fromTo(Q.inquiryItem, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: ease.calm, stagger: 0.04 }, T.inquiryAt);
    return tl;
  }

  // The water reveals the inquiry: each element surfaces as the draining
  // edge passes its height on screen, instead of on an unrelated stagger.
  const items = gsap.utils.toArray<HTMLElement>(Q.inquiryItem);
  let heights: number[] | null = null;
  const measure = () =>
    items.map((el) => {
      const r = el.getBoundingClientRect();
      return 1 - (r.top + r.height * 0.35) / window.innerHeight;
    });
  tl.to(
    p,
    {
      level: -0.32,
      duration: T.recede,
      ease: ease.release,
      onStart: () => {
        heights = measure();
      },
      onUpdate: () => {
        heights ??= measure();
        for (let i = 0; i < items.length; i++) {
          const k = Math.min(Math.max((heights[i] + 0.04 - p.level) / 0.22, 0), 1);
          const e = 1 - Math.pow(1 - k, 3);
          gsap.set(items[i], { autoAlpha: e, y: (1 - e) * 26 });
        }
      },
    },
    T.recedeAt,
  );
  // Anything below the fold (small screens) is settled once the water is gone.
  tl.to(Q.inquiryItem, { autoAlpha: 1, y: 0, duration: 0.6, ease: ease.settle, overwrite: "auto" }, T.recedeAt + T.recede);
  return tl;
}

/** Back through the water to the studio. */
export function requestReturn(fromHistory = false): boolean {
  const s = getState();
  if (s.phase !== "inquiry") return false;
  if (!fromHistory && pushedHistory) {
    // Let the browser own the entry; popstate brings us back here.
    window.history.back();
    return true;
  }
  if (!fromHistory && window.location.hash === "#request") {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  pushedHistory = false;
  kill();
  setState({ phase: "returning" });
  active = s.webgl === "ok" ? buildReturn(s.reducedMotion) : buildFallbackReturn();
  exposeDebug();
  return true;
}

function buildReturn(reduced: boolean) {
  const p = sceneState.pour;
  const R = returnSeq;
  p.active = 1;
  p.draining = 0;
  p.level = -0.32;
  p.lensFade = 1;

  const tl = gsap.timeline({
    onComplete: () => {
      resetPour();
      active = null;
      lockScroll(false);
      setState({ phase: "exploring" });
      restoreFocus();
    },
  });
  tl.to(Q.inquiryItem, { autoAlpha: 0, y: reduced ? 0 : -10, duration: 0.4, ease: ease.calm, stagger: 0.02 }, 0);
  tl.to(p, { level: 1.35, duration: R.sheet, ease: reduced ? ease.calm : "power2.in" }, 0.05);
  tl.to(p, { surface: 0, duration: 0.45, ease: ease.calm }, R.swapAt - 0.2);
  tl.to(p, { swap: 0, duration: 0.25, ease: ease.calm }, R.swapAt);
  tl.set(Q.inquiryRoot, { autoAlpha: 0 }, R.swapAt);
  // While covered, put the bottle back: upright, full, stoppered.
  tl.set(
    p,
    { clock: 0, uncork: 0, lift: 0, tilt: 0, drain: 0, frame: 0, push: 0, head: 0, streamAt: 999, impactAt: 999 },
    R.swapAt,
  );
  tl.set(p, { draining: 1 }, R.recedeAt);
  tl.to(p, { level: -0.32, duration: R.recede, ease: ease.release }, R.recedeAt);
  tl.to(p, { quiet: 0, duration: 0.9, ease: ease.calm }, R.recedeAt + 0.2);
  tl.to(Q.quiet, { autoAlpha: 1, duration: 0.8, ease: ease.calm }, R.recedeAt + 0.45);
  return tl;
}

// ---------------------------------------------------------------------------
// Fallback (no WebGL): the same causal chain in SVG. The bottle tips, a
// stream draws down, and a displaced water surface rises over the viewport.

function buildFallbackPour(reduced: boolean) {
  const tl = gsap.timeline({
    onComplete: () => {
      active = null;
      enterInquiry();
    },
  });
  const k = reduced ? 0.6 : 1;
  tl.to(Q.quiet, { autoAlpha: 0, duration: 0.45, ease: ease.calm }, 0);
  tl.to(Q.fallbackBottle, { rotate: -112, x: "12%", y: "-14%", duration: 1.5 * k, ease: ease.tilt, transformOrigin: "50% 50%" }, 0.3);
  // The stream grows from the mouth downward, accelerating as it falls.
  tl.fromTo(
    Q.fallbackStream,
    { autoAlpha: 1, scaleY: 0, transformOrigin: "50% 0%" },
    { scaleY: 1, duration: 0.8 * k, ease: ease.fall },
    1.2 * k,
  );
  tl.set(Q.fallbackWater, { autoAlpha: 1 }, 1.6 * k);
  tl.fromTo(Q.fallbackSurface, { yPercent: 100 }, { yPercent: -8, duration: 1.1 * k, ease: ease.approach }, 1.7 * k);
  tl.call(() => document.documentElement.setAttribute("data-env", "inquiry"), undefined, 2.85 * k);
  tl.set(Q.inquiryRoot, { autoAlpha: 1 }, 2.85 * k);
  tl.to(Q.fallbackSurface, { yPercent: 108, duration: 1.1 * k, ease: ease.release }, 3.0 * k);
  tl.fromTo(Q.inquiryItem, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, ease: ease.settle, stagger: 0.07 }, 3.2 * k);
  tl.set(Q.fallbackWater, { autoAlpha: 0 }, 4.1 * k);
  tl.set(Q.fallbackBottle, { rotate: 0, x: 0, y: 0 }, 4.1 * k);
  tl.set(Q.fallbackStream, { autoAlpha: 0 }, 2.85 * k);
  return tl;
}

function buildFallbackReturn() {
  const tl = gsap.timeline({
    onComplete: () => {
      active = null;
      lockScroll(false);
      setState({ phase: "exploring" });
      restoreFocus();
    },
  });
  tl.to(Q.inquiryItem, { autoAlpha: 0, duration: 0.35, stagger: 0.02 }, 0);
  tl.set(Q.fallbackWater, { autoAlpha: 1 }, 0);
  tl.fromTo(Q.fallbackSurface, { yPercent: 100 }, { yPercent: -8, duration: 0.8, ease: "power2.in" }, 0.05);
  tl.call(() => document.documentElement.removeAttribute("data-env"), undefined, 0.9);
  tl.set(Q.inquiryRoot, { autoAlpha: 0 }, 0.9);
  tl.to(Q.fallbackSurface, { yPercent: 108, duration: 1, ease: ease.release }, 1.0);
  tl.to(Q.quiet, { autoAlpha: 1, duration: 0.8 }, 1.3);
  tl.set(Q.fallbackWater, { autoAlpha: 0 }, 2.1);
  return tl;
}

/**
 * Deep link (#request): arrive already on the far side of the water, with
 * the studio intact underneath for the return trip.
 */
export function enterInquiryDirect() {
  kill();
  resetPour();
  const p = sceneState.pour;
  p.swap = 1;
  p.surface = 1;
  p.quiet = 1;
  p.level = -0.32;
  p.lensFade = 1;
  sceneState.reveal = 1;
  sceneState.revealEnv = 1;
  sceneState.light = 1;
  sceneState.typeIn = 1;
  if (getState().webgl !== "ok") document.documentElement.setAttribute("data-env", "inquiry");
  gsap.set(Q.quiet, { autoAlpha: 0 });
  gsap.set("[data-hero-reveal]", { autoAlpha: 1, y: 0 });
  gsap.set(Q.inquiryRoot, { autoAlpha: 1 });
  gsap.fromTo(Q.inquiryItem, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1, ease: ease.settle, stagger: 0.06 });
  lockScroll(true);
  setState({ phase: "inquiry" });
  focusSoon("#inquiry-title");
}

export function disposeTransitions() {
  kill();
  lockScroll(false);
}

/** Frame-exact inspection hook (dev, or ?debug in production). */
function exposeDebug() {
  if (typeof window === "undefined") return;
  const allowed = process.env.NODE_ENV !== "production" || window.location.search.includes("debug");
  if (!allowed) return;
  (window as unknown as { __prior: unknown }).__prior = {
    timeline: active,
    seek: (t: number) => void active?.pause().seek(t, false),
    play: () => active?.play(),
    state: sceneState,
  };
}
