/** One design system for the app.
 *
 *  The risk ramp matches the officials' dashboard exactly: a citizen and a
 *  control room must never see the same kilometre in two different colours.
 *  Everything else is ink and paper — a dark ground with warm, slightly
 *  off-white type, so the four risk colours are the only saturated things on
 *  the screen and read as signal rather than decoration.
 */

import type { TextStyle } from "react-native";

export const C = {
  bg: "#0A0D14",
  surface: "#12161F",
  surfaceHi: "#1A1F2B",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",
  text1: "#F2EFE8",
  text2: "#A7ADB8",
  text3: "#6B7280",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  accent: "#5B8DEF",
  cream: "#E8DFC8",
} as const;

export type Tier = "green" | "yellow" | "orange" | "red";

export const TIER_COLOR: Record<Tier, string> = {
  green: C.green, yellow: C.yellow, orange: C.orange, red: C.red,
};

/** Tinted backgrounds for the hero card, kept dark enough that white text on
 *  them stays comfortably readable. */
export const TIER_WASH: Record<Tier, string> = {
  green: "rgba(34,197,94,0.10)",
  yellow: "rgba(234,179,8,0.10)",
  orange: "rgba(249,115,22,0.12)",
  red: "rgba(239,68,68,0.14)",
};

/** Never a colour alone: the word travels with it everywhere. */
export const TIER_WORD: Record<Tier, string> = {
  green: "SAFE", yellow: "CAUTION", orange: "WARNING", red: "DANGER",
};

export const TIER_RANK: Record<Tier, number> = {
  green: 0, yellow: 1, orange: 2, red: 3,
};

export const RADIUS = { card: 18, control: 13, pill: 999 } as const;

export const SPACE = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 } as const;

/** Type scale. Large by default — this is read one-handed, outdoors, in a
 *  hurry, often by someone older than the person who built it. */
export const TYPE = {
  hero: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.8, lineHeight: 37 },
  title: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyStrong: { fontSize: 16.5, fontWeight: "600" as const, lineHeight: 24 },
  label: { fontSize: 13, fontWeight: "600" as const },
  micro: { fontSize: 11.5, fontWeight: "700" as const, letterSpacing: 1.1 },
  eyebrow: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.6, textTransform: "uppercase" as const },
  num: { fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] },
} as const;
