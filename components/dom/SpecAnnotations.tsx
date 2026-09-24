"use client";

import { useEffect, useRef } from "react";
import { composition } from "@/lib/brand";
import { sceneState } from "@/lib/sceneState";
import { useExperience } from "@/lib/store";

/**
 * Technical-drawing callouts pinned to the bottle's silhouette. Their
 * positions are written every frame by the scene (projecting points on the
 * glass), so they stay attached through scroll, resize and easing. The
 * readable version of this data lives in the chapter's <dl>.
 */
export function SpecAnnotations() {
  const root = useRef<HTMLDivElement>(null);
  const webgl = useExperience((s) => s.webgl);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-anchor]"));
    sceneState.anchors = rows.map((row, i) => ({ el: row, y: composition.minerals[i].at }));
    return () => {
      sceneState.anchors = [];
    };
  }, []);

  if (webgl === "none") return null;

  return (
    <div ref={root} className="annotations" aria-hidden="true" data-annotations>
      {composition.minerals.map((m) => (
        <div key={m.key} className="annotation" data-anchor>
          <span className="annotation__tick" />
          <span className="annotation__rule" />
          <span className="annotation__text">
            <span className="annotation__key mono">{m.key}</span>
            <span className="annotation__value">
              {m.value}
              {m.unit && <small className="mono"> {m.unit}</small>}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
