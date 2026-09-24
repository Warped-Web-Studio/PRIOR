"use client";

import { brand } from "@/lib/brand";
import { requestPour } from "@/components/transition/controller";
import { Wordmark } from "./BrandMark";

export function Header({ inert }: { inert: boolean }) {
  return (
    <header className="masthead" data-quiet data-hero-reveal inert={inert}>
      <a className="masthead__brand" href="#top" aria-label="PRIOR — back to the top">
        <Wordmark />
      </a>
      <p className="masthead__meta mono">
        <span>{brand.draw} draw</span>
        <span aria-hidden="true">·</span>
        <span>{brand.bottles} bottles</span>
      </p>
      <button type="button" className="masthead__cta" onClick={() => requestPour()}>
        Request access
      </button>
    </header>
  );
}
