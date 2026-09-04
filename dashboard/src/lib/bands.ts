import type { Tier } from "../api/client";

export const TIERS: Tier[] = ["red", "orange", "yellow", "green"];

/** Severity is encoded in width as well as hue.
 *
 *  No four-step green-to-red ramp separates cleanly for every reader — yellow
 *  and green collapse under protanopia, and orange and red are close even with
 *  full colour vision. That is inherent to the traffic-light metaphor rather
 *  than a bad choice of hex, so the ramp keeps its conventional meaning and the
 *  encoding is doubled: width steps make severity readable in greyscale, and a
 *  dash pattern separates the two bands that matter most.
 */
export const BAND_WIDTH: Record<Tier, number> = {
  // Widened from the 2/3/5/7 first cut. Greyscaling the render showed yellow
  // and green separated by a single pixel, which does not survive being read
  // against map clutter — the whole point of the width channel is that it works
  // when hue does not. Even 2px steps keep green thin, which is right: it is
  // the majority band and should recede.
  green: 2,
  yellow: 4,
  orange: 6,
  red: 8,
};

export const BAND_DASH: Record<Tier, number[] | null> = {
  green: null,
  yellow: null,
  orange: [8, 4],
  red: null,
};

export const BAND_RANK: Record<Tier, number> = {
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};

/** Model layers carry identity, never severity. Fixed order, never cycled. */
export const LAYER_SERIES = [
  { key: "susceptibility", label: "Susceptibility", color: "var(--layer-susceptibility)" },
  { key: "trigger", label: "Trigger", color: "var(--layer-trigger)" },
  { key: "deformation", label: "Deformation", color: "var(--layer-deformation)" },
  { key: "exposure", label: "Exposure", color: "var(--layer-exposure)" },
] as const;

export type LayerKey = (typeof LAYER_SERIES)[number]["key"];
