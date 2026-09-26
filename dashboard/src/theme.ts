import type { Tier } from "./api/client";

/** Moss, amber, ember, brick — the same four hex values the citizen app uses,
 *  so a person and a control room never see one segment in two colours.
 *  Read by MapLibre, which cannot see CSS variables. */
export const TIER_COLOR: Record<Tier, string> = {
  green: "#3a8f5a", yellow: "#d9a21b", orange: "#e0662b", red: "#c8362b",
};

/** The same hues dark enough to be read as text on a light ground. */
export const TIER_INK: Record<Tier, string> = {
  green: "#256b41", yellow: "#7f5a05", orange: "#a6420f", red: "#9c2419",
};

export const TIER_WORD: Record<Tier, string> = {
  green: "Safe", yellow: "Caution", orange: "Warning", red: "Danger",
};

export const TIER_ORDER: Tier[] = ["red", "orange", "yellow", "green"];
