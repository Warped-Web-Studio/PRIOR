"use client";

import { useEffect } from "react";
import { ease, gsap, ScrollTrigger } from "@/lib/gsap";
import { getState } from "@/lib/store";
import { sceneState } from "@/lib/sceneState";

/**
 * Scroll is read once, as a single 0..1 progress over the chapter track.
 * The 3D side interprets it (poses, type planes) with its own smoothing;
 * the DOM side reveals each chapter's copy as the composition arrives.
 */
export function useScrollChoreography() {
  useEffect(() => {
    const track = document.querySelector<HTMLElement>("[data-track]");
    if (!track) return;

    const progress = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        sceneState.scroll = self.progress;
      },
    });

    const chapters = gsap.utils.toArray<HTMLElement>("[data-chapter]");
    const triggers = chapters.map((chapter) => {
      const items = chapter.querySelectorAll<HTMLElement>("[data-reveal]");
      gsap.set(items, { autoAlpha: 0, y: 22 });
      return ScrollTrigger.create({
        trigger: chapter,
        start: "top 62%",
        end: "bottom 38%",
        onToggle: (self) => {
          const reduced = getState().reducedMotion;
          gsap.to(items, {
            autoAlpha: self.isActive ? 1 : 0,
            y: self.isActive || reduced ? 0 : self.direction > 0 ? -16 : 16,
            duration: self.isActive ? (reduced ? 0.5 : 1.3) : 0.6,
            ease: self.isActive ? ease.settle : ease.calm,
            stagger: self.isActive ? 0.09 : 0.03,
            overwrite: true,
          });
        },
      });
    });

    return () => {
      progress.kill();
      triggers.forEach((t) => t.kill());
    };
  }, []);
}
