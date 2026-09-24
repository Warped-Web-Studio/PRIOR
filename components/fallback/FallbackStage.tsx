"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/lib/store";

/**
 * Without WebGL the concept still holds: a drawn bottle, and a water surface
 * built from SVG turbulence + displacement that rises over the viewport and
 * drains away. Driven by the same controller timeline structure.
 */
export function FallbackStage() {
  const reduced = useExperience((s) => s.reducedMotion);
  const turb = useRef<SVGFETurbulenceElement>(null);

  // Slowly evolve the turbulence so the surface moves like water.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = (now - start) / 1000;
      turb.current?.setAttribute("baseFrequency", `${0.009 + Math.sin(t * 0.4) * 0.002} ${0.03 + Math.cos(t * 0.3) * 0.006}`);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className="fallback">
      <svg className="fallback__bottle" viewBox="0 0 200 520" data-fb-bottle aria-hidden="true">
        <defs>
          <linearGradient id="fb-glass" x1="0" x2="1">
            <stop offset="0" stopColor="#dfe8e8" stopOpacity="0.5" />
            <stop offset="0.08" stopColor="#dfe8e8" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#dfe8e8" stopOpacity="0.02" />
            <stop offset="0.9" stopColor="#dfe8e8" stopOpacity="0.1" />
            <stop offset="0.97" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#dfe8e8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="fb-water" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9fcac5" stopOpacity="0.16" />
            <stop offset="1" stopColor="#9fcac5" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <path
          d="M72 20 h56 v34 h-6 v30 c0 16 60 30 60 70 v340 c0 12 -6 16 -18 16 h-128 c-12 0 -18 -4 -18 -16 v-340 c0 -40 60 -54 60 -70 v-30 h-6 z"
          fill="url(#fb-glass)"
          stroke="#cfd9d9"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <path d="M24 150 h152 v300 c0 8 -4 12 -12 12 h-128 c-8 0 -12 -4 -12 -12 z" fill="url(#fb-water)" />
        <rect x="70" y="4" width="60" height="44" rx="4" fill="#141517" />
        <g fill="#eef2f1" fontFamily="var(--font-display)" textAnchor="middle">
          <text x="100" y="300" fontSize="30" fontWeight="250" letterSpacing="3">PRIOR</text>
          <text x="100" y="324" fontSize="7" fontFamily="var(--font-mono-face)" letterSpacing="2">GLACIAL AQUIFER WATER</text>
        </g>
      </svg>

      {/* Screen-space stream: from where the tipped mouth ends up, down past the fold. */}
      <svg className="fallback__stream" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M43 43 C 40 55, 39 75, 38.5 110"
          data-fb-stream
          fill="none"
          stroke="#cfe9e5"
          strokeOpacity="0.75"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 5, visibility: "hidden" }}
        />
      </svg>

      <svg className="fallback__water" data-fb-water aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <filter id="fb-wave" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.009 0.03" numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
          <linearGradient id="fb-sheet" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#dbe6e4" />
            <stop offset="0.12" stopColor="#b9d3d0" />
            <stop offset="1" stopColor="#dfe8e6" />
          </linearGradient>
        </defs>
        <g data-fb-surface filter="url(#fb-wave)">
          <rect x="-10" y="0" width="120" height="130" fill="url(#fb-sheet)" />
        </g>
      </svg>
    </div>
  );
}
