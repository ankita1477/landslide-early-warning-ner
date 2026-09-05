/** Shared with the dashboard: same risk ramp, same dark ground.
 *  A citizen and an official must never see the same segment in different
 *  colours. */
export const COLORS = {
  bg: "#05070d",
  surface: "#0e131d",
  surfaceHi: "#161d2a",
  border: "rgba(255,255,255,0.09)",
  text1: "#f8fafc",
  text2: "#94a3b8",
  text3: "#64748b",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
} as const;

export type Tier = "green" | "yellow" | "orange" | "red";

export const TIER_COLOR: Record<Tier, string> = {
  green: COLORS.green,
  yellow: COLORS.yellow,
  orange: COLORS.orange,
  red: COLORS.red,
};

/** Plain words, not colour names. Someone reading this is deciding whether to
 *  travel, and "orange" alone does not tell them. */
export const TIER_ADVICE: Record<Tier, { title: string; advice: string }> = {
  green: { title: "Normal", advice: "No landslide warning for this stretch." },
  yellow: { title: "Watch", advice: "Drive with care. Check again before you set out." },
  orange: { title: "Alert", advice: "Avoid travelling at night. Expect delays and debris." },
  red: { title: "Warning", advice: "Avoid this road. Landslide risk is high right now." },
};

export const TIER_RANK: Record<Tier, number> = {
  green: 0, yellow: 1, orange: 2, red: 3,
};
