import { useEffect, useState } from "react";
import { AccessibilityInfo, Easing } from "react-native";

/** Timings kept in one place so the whole app moves at one speed.
 *  250-400ms: fast enough not to be waited on, slow enough to be followed. */
export const D = {
  fast: 160,
  page: 300,
  card: 220,
  banner: 380,
  pulse: 2200,
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.inOut(Easing.quad),
} as const;

/** Honours the system setting. When motion is reduced, transitions collapse to
 *  something near-instant rather than being removed — a change with no
 *  transition at all can be harder to follow, not easier. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; sub?.remove(); };
  }, []);
  return reduced;
}

/** Risk decides how insistent the pulse is. Green barely moves; red is
 *  noticeable but never flashes — a strobing emergency screen is harder to read
 *  and frightening rather than informative. */
export const PULSE: Record<string, { to: number; duration: number } | null> = {
  green: { to: 0.82, duration: 3400 },
  yellow: { to: 0.66, duration: 2600 },
  orange: { to: 0.5, duration: 1900 },
  red: { to: 0.34, duration: 1300 },
};
