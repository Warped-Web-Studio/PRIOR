"use client";

import { allocation } from "@/lib/brand";
import { useExperience } from "@/lib/store";
import { requestPour } from "@/components/transition/controller";

/**
 * The primary CTA. Not a pill: a line of type with a hairline that runs to
 * a single drop — the gesture that is about to happen, in miniature.
 */
export function AllocationCTA() {
  const busy = useExperience((s) => s.phase === "transitioning" || s.phase === "loading");
  return (
    <div className="cta" data-reveal>
      <button
        type="button"
        className="cta__button"
        data-cta
        aria-disabled={busy}
        aria-describedby="cta-hint"
        onClick={() => {
          if (!busy) requestPour();
        }}
      >
        <span className="cta__label display">{allocation.cta}</span>
        <span className="cta__rule" aria-hidden="true">
          <span className="cta__drop" />
        </span>
      </button>
      <p id="cta-hint" className="cta__hint mono">
        {allocation.hint}
      </p>
    </div>
  );
}
