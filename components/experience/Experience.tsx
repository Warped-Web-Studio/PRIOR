"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { getState, setState, useExperience } from "@/lib/store";
import { sceneState } from "@/lib/sceneState";
import { detectTier, hasWebGL, isMobileLayout, prefersReducedMotion } from "@/lib/device";
import { Chapters } from "@/components/dom/Chapters";
import { Header } from "@/components/dom/Header";
import { SpecAnnotations } from "@/components/dom/SpecAnnotations";
import { InquiryExperience } from "@/components/inquiry/InquiryExperience";
import { FallbackStage } from "@/components/fallback/FallbackStage";
import { SceneBoundary } from "./SceneBoundary";
import { LoadingVeil } from "./LoadingVeil";
import { useReveal } from "./useReveal";
import { useScrollChoreography } from "./useScrollChoreography";
import { usePointer } from "./usePointer";
import {
  disposeTransitions,
  enterInquiryDirect,
  requestPour,
  requestReturn,
} from "@/components/transition/controller";

// Three.js and everything above it is client-only and split out of the
// initial bundle; the DOM (copy, CTA, form) renders and hydrates first.
const Scene = dynamic(() => import("@/components/scene/Scene"), { ssr: false });

/** Longest we'll hold the veil before showing whatever is ready. */
const READY_TIMEOUT = 9000;

export function Experience() {
  const phase = useExperience((s) => s.phase);
  const webgl = useExperience((s) => s.webgl);
  const [fontsReady, setFontsReady] = useState(false);

  // Probe the device once, on the client.
  useEffect(() => {
    const reduced = prefersReducedMotion();
    setState({
      webgl: hasWebGL() ? "ok" : "none",
      tier: detectTier(),
      mobile: isMobileLayout(),
      reducedMotion: reduced,
    });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setState({ reducedMotion: mq.matches });
    mq.addEventListener("change", onMotion);

    // Layout (and camera poses) follow orientation/resizes across the breakpoint.
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setState({ mobile: isMobileLayout() }), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
      disposeTransitions();
    };
  }, []);

  // Canvas textures are set in the brand fonts, so wait for them.
  useEffect(() => {
    let cancelled = false;
    const families = ["--font-display", "--font-mono-face"].map((v) =>
      getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    );
    Promise.all([
      document.fonts.load(`250 100px ${families[0]}`),
      document.fonts.load(`200 100px ${families[0]}`),
      document.fonts.load(`300 20px ${families[1]}`),
      document.fonts.load(`400 20px ${families[1]}`),
    ])
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => !cancelled && setFontsReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const markReady = useCallback(() => {
    if (sceneState.ready) return;
    sceneState.ready = true;
    if (getState().phase !== "loading") return;
    if (window.location.hash === "#request") enterInquiryDirect();
    else setState({ phase: "revealing" });
  }, []);

  // Fallback path is ready as soon as fonts are.
  useEffect(() => {
    if (webgl === "none" && fontsReady) markReady();
  }, [webgl, fontsReady, markReady]);

  // Never hold the veil forever.
  useEffect(() => {
    const t = window.setTimeout(markReady, READY_TIMEOUT);
    return () => window.clearTimeout(t);
  }, [markReady]);

  // History: Back from #request returns through the water.
  useEffect(() => {
    const onPop = () => {
      const s = getState();
      if (s.phase === "inquiry" && window.location.hash !== "#request") requestReturn(true);
      else if (s.phase === "exploring" && window.location.hash === "#request") requestPour();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useReveal();
  useScrollChoreography();
  usePointer();

  const inInquiry = phase === "inquiry" || phase === "returning";

  return (
    <div className="experience" data-phase={phase}>
      <a
        className="skip-link"
        href="#request"
        onClick={(e) => {
          e.preventDefault();
          requestPour();
        }}
      >
        Skip to request access
      </a>

      <div className="stage" aria-hidden="true">
        {webgl === "ok" && (
          <SceneBoundary onError={() => setState({ webgl: "none" })}>
            <Scene fontsReady={fontsReady} onReady={markReady} />
          </SceneBoundary>
        )}
        {webgl === "none" && <FallbackStage />}
      </div>

      <LoadingVeil />
      <Header inert={inInquiry || phase === "transitioning"} />
      <main id="main" className="chapters" inert={inInquiry || phase === "transitioning"}>
        <Chapters fallback={webgl === "none"} />
      </main>
      <SpecAnnotations />
      <InquiryExperience />
    </div>
  );
}
