/** Animation variants shared by both routes.
 *
 *  Everything animates transform and opacity only — those are the two properties
 *  the compositor can handle without laying out or painting again, which is what
 *  keeps the pinned section smooth while the map is mounted.
 */

import type { Transition, Variants } from "framer-motion";

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const reveal: Transition = {
  duration: 0.7,
  ease: EASE_OUT_EXPO,
};

/** Headline lines mask upward from behind a clip edge. */
export const maskUp: Variants = {
  hidden: { y: "110%" },
  visible: (i: number = 0) => ({
    y: "0%",
    transition: { ...reveal, delay: i * 0.08 },
  }),
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.2 + i * 0.06 },
  }),
};

/** The four band bars draw left-to-right; the first thing that happens on load. */
export const drawBar: Variants = {
  hidden: { scaleX: 0 },
  visible: (i: number = 0) => ({
    scaleX: 1,
    transition: { duration: 0.8, ease: EASE_OUT_EXPO, delay: i * 0.08 },
  }),
};

/** Route change: content settles back rather than cutting. */
export const routeTransition: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.35, ease: "easeIn" } },
};
