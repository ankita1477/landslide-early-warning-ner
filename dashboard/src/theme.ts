import type { Tier } from "./api/client";

/** Deliberately the IMD colour convention, so officials need no retraining. */
export const TIER_COLOR: Record<Tier, string> = {
  green: "#2e9e4f",
  yellow: "#e8c33a",
  orange: "#e8892a",
  red: "#cc2b1f",
};

export const TIER_ORDER: Tier[] = ["red", "orange", "yellow", "green"];
