"use client";

import { useExperience } from "@/lib/store";

/**
 * Nothing is shown until the bottle is ready to be seen. The veil is a
 * single core-sample line drawing down, echoing the brand mark.
 */
export function LoadingVeil() {
  const loading = useExperience((s) => s.phase === "loading");
  return (
    <div className="veil" data-done={!loading} aria-hidden={!loading} role="status">
      <span className="veil__line" />
      <span className="sr-only">{loading ? "Preparing the bottle" : ""}</span>
    </div>
  );
}
