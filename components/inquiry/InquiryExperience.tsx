"use client";

import { inquiry } from "@/lib/brand";
import { useExperience } from "@/lib/store";
import { requestReturn } from "@/components/transition/controller";
import { CoreMark } from "@/components/dom/BrandMark";
import { InquiryForm } from "./InquiryForm";

/**
 * The far side of the water. Always mounted (so the transition can reveal
 * it without a render hitch) but hidden and inert until the water covers
 * the switch. The pale environment itself is drawn by the compositor.
 */
export function InquiryExperience() {
  const phase = useExperience((s) => s.phase);
  const open = phase === "inquiry" || phase === "transitioning" || phase === "returning";
  const interactive = phase === "inquiry";

  return (
    <section
      id="request"
      className="inquiry"
      data-inquiry-root
      aria-labelledby="inquiry-title"
      aria-hidden={!open}
      inert={!interactive}
    >
      <div className="inquiry__inner">
        <button type="button" className="inquiry__back mono" onClick={() => requestReturn()} data-inquiry-reveal>
          <span aria-hidden="true" className="inquiry__back-arrow">↑</span> {inquiry.back}
        </button>

        <div className="inquiry__intro">
          <p className="kicker mono" data-inquiry-reveal>
            <CoreMark className="inquiry__mark" /> {inquiry.kicker}
          </p>
          <h2 id="inquiry-title" className="inquiry__title display" tabIndex={-1} data-inquiry-reveal>
            {inquiry.title}
          </h2>
          <p className="body inquiry__lede" data-inquiry-reveal>
            {inquiry.lede}
          </p>
        </div>

        <InquiryForm />
      </div>
    </section>
  );
}
