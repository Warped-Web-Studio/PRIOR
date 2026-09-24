"use client";

import { useSyncExternalStore } from "react";

/**
 * Experience lifecycle. React only re-renders on these coarse transitions —
 * frame-level values live in `sceneState`.
 */
export type Phase =
  | "loading"
  | "revealing"
  | "exploring"
  | "transitioning"
  | "inquiry"
  | "returning";

export type Tier = "high" | "low";

export type ExperienceState = {
  phase: Phase;
  tier: Tier;
  reducedMotion: boolean;
  /** "pending" until probed; "none" routes to the static fallback. */
  webgl: "pending" | "ok" | "none";
  mobile: boolean;
};

let state: ExperienceState = {
  phase: "loading",
  tier: "high",
  reducedMotion: false,
  webgl: "pending",
  mobile: false,
};

const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<ExperienceState>) {
  let changed = false;
  for (const key in patch) {
    const k = key as keyof ExperienceState;
    if (state[k] !== patch[k]) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState = state;

export function useExperience<T>(selector: (s: ExperienceState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(serverState),
  );
}
