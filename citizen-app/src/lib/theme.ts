/** One design system for the app.
 *
 *  The risk ramp matches the officials' dashboard exactly: a citizen and a
 *  control room must never see the same kilometre in two different colours.
 */

export const C = {
  bg: "#0B1020",
  surface: "#141A2B",
  surfaceHi: "#1C2438",
  border: "rgba(255,255,255,0.10)",
  text1: "#F7F9FC",
  text2: "#A8B4C6",
  text3: "#6B7A90",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  accent: "#4C8DFF",
} as const;

export type Tier = "green" | "yellow" | "orange" | "red";

export const TIER_COLOR: Record<Tier, string> = {
  green: C.green, yellow: C.yellow, orange: C.orange, red: C.red,
};

/** Tinted backgrounds for the hero card, kept dark enough that white text on
 *  them stays comfortably readable. */
export const TIER_WASH: Record<Tier, string> = {
  green: "rgba(34,197,94,0.13)",
  yellow: "rgba(234,179,8,0.13)",
  orange: "rgba(249,115,22,0.15)",
  red: "rgba(239,68,68,0.17)",
};

/** Never a colour alone: the word travels with it everywhere. */
export const TIER_WORD: Record<Tier, string> = {
  green: "SAFE", yellow: "CAUTION", orange: "WARNING", red: "DANGER",
};

export const TIER_RANK: Record<Tier, number> = {
  green: 0, yellow: 1, orange: 2, red: 3,
};

export const RADIUS = { card: 20, control: 14, pill: 999 } as const;

export const SPACE = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 } as const;

/** Type scale. Large by default — this is read one-handed, outdoors, in a
 *  hurry, often by someone older than the person who built it. */
export const TYPE = {
  hero: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 21, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyStrong: { fontSize: 16.5, fontWeight: "600" as const, lineHeight: 24 },
  label: { fontSize: 13, fontWeight: "600" as const },
  micro: { fontSize: 11.5, fontWeight: "700" as const, letterSpacing: 1.1 },
} as const;
