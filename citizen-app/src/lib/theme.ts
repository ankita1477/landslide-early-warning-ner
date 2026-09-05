/** One design system for the app: ink on paper.
 *
 *  A light ground, deliberately. This is read outdoors, in daylight, through a
 *  rain-spotted screen, and a dark interface loses to sun far sooner than a
 *  pale one does. It also leaves the four risk colours as the only saturated
 *  things on screen, so they read as signal rather than decoration.
 *
 *  The risk ramp itself matches the officials' dashboard exactly: a citizen and
 *  a control room must never see the same kilometre in two different colours.
 */

import type { TextStyle } from "react-native";

export const C = {
  paper: "#F4F1EA",
  paper2: "#EAE5D9",
  white: "#FFFFFF",
  ink: "#17191D",
  ink2: "#4B4F57",
  ink3: "#8A8E96",
  line: "rgba(23,25,29,0.10)",
  lineHi: "rgba(23,25,29,0.22)",
  green: "#3A8F5A",
  yellow: "#D9A21B",
  orange: "#E0662B",
  red: "#C8362B",
} as const;

export type Tier = "green" | "yellow" | "orange" | "red";

/** The marks: dots, strokes, the road itself. Four bands in the same order and
 *  the same words as the officials' dashboard; the hues are restated for paper
 *  — moss, amber, ember, brick — because the dashboard's screen colours were
 *  chosen for a dark ground and glare on a light one. */
export const TIER_COLOR: Record<Tier, string> = {
  green: C.green, yellow: C.yellow, orange: C.orange, red: C.red,
};

/** The same hues, dark enough to be read as text on paper. Yellow at #EAB308
 *  is a fine dot and an unreadable word. */
export const TIER_INK: Record<Tier, string> = {
  green: "#256B41", yellow: "#7F5A05", orange: "#A6420F", red: "#9C2419",
};

/** Large fields — the whole top of the Today screen — take a wash, never the
 *  full colour. A screen that is entirely bright red is unreadable and
 *  frightening rather than informative. */
export const TIER_WASH: Record<Tier, string> = {
  green: "#DFEBDC", yellow: "#F6E7BC", orange: "#F8D9C4", red: "#F3CFC9",
};

/** Never a colour alone: the word travels with it everywhere. */
export const TIER_WORD: Record<Tier, string> = {
  green: "SAFE", yellow: "CAUTION", orange: "WARNING", red: "DANGER",
};

export const TIER_RANK: Record<Tier, number> = {
  green: 0, yellow: 1, orange: 2, red: 3,
};

export const RADIUS = { card: 20, control: 14, pill: 999 } as const;

export const SPACE = { xs: 6, sm: 10, md: 16, lg: 24, xl: 36 } as const;

/** Two faces. Fraunces for the few lines that carry the message — a warm
 *  serif with some character, which is exactly what a template never has —
 *  and Instrument Sans for everything that has to be read fast. Weights are
 *  chosen by file, not by fontWeight, so the same face renders on every
 *  platform instead of being synthesised on some. */
export const FONT = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_500Medium_Italic",
  sans: "InstrumentSans_400Regular",
  sansMedium: "InstrumentSans_500Medium",
  sansSemi: "InstrumentSans_600SemiBold",
  sansBold: "InstrumentSans_700Bold",
} as const;

export const TYPE = {
  display: { fontFamily: FONT.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.6 },
  h1: { fontFamily: FONT.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontFamily: FONT.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.2 },
  title: { fontFamily: FONT.sansSemi, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: FONT.sans, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: FONT.sansSemi, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: FONT.sans, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: FONT.sansSemi, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: FONT.sansSemi, fontSize: 11.5, lineHeight: 15, letterSpacing: 1.2, textTransform: "uppercase" as const },
  num: { fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] },
} as const;
