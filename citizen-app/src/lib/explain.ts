/** Turn the model's four factors into a sentence a traveller can act on.
 *
 *  Nothing here exposes a score, a probability or a model name. A person
 *  deciding whether to drive needs a reason and an instruction, not a number
 *  they cannot calibrate — "0.0097" tells them nothing, and a percentage would
 *  imply a precision the system does not have.
 */

import type { Tier } from "./theme";

export interface Factors {
  susceptibility: number;
  trigger_probability: number;
  deformation_modifier: number;
  exposure: number;
}

export interface Reason {
  icon: string;
  text: string;
}

/** Thresholds are read off the corridor's own spread rather than invented, so a
 *  reason only appears when that factor is genuinely elevated here. */
const SLOPE_WEAK = 0.6;
const RAIN_HIGH = 0.012;
const RAIN_SOME = 0.008;
const PEOPLE_MANY = 0.7;

export function reasons(factors: Factors, tier?: Tier): Reason[] {
  // On a green stretch the reasons must explain the all-clear, not list hazards.
  // Showing "heavy rain on a weak slope" beneath a SAFE banner reads as a
  // contradiction, and a warning people cannot square with what they are told
  // is one they stop believing.
  if (tier === "green") {
    return [
      { icon: "✅", text: "Rainfall here is normal for the season" },
      { icon: "🛰️", text: "This stretch is checked again every day" },
    ];
  }

  const out: Reason[] = [];

  if (factors.trigger_probability >= RAIN_HIGH) {
    out.push({ icon: "🌧️", text: "Heavy rain has fallen here recently" });
  } else if (factors.trigger_probability >= RAIN_SOME) {
    out.push({ icon: "🌦️", text: "Steady rain over the past week" });
  }

  if (factors.susceptibility >= SLOPE_WEAK) {
    out.push({ icon: "⛰️", text: "The hillside here is naturally weak" });
  }

  if (factors.deformation_modifier > 1.0) {
    out.push({ icon: "📡", text: "Satellites show this slope is already moving" });
  }

  if (factors.exposure >= PEOPLE_MANY) {
    out.push({ icon: "🏘️", text: "Homes and villages sit close to this stretch" });
  }

  if (out.length === 0) {
    out.push({ icon: "✅", text: "Nothing unusual is affecting this stretch" });
  }
  return out;
}

/** The single strongest reason, for a headline. */
export function headline(factors: Factors, tier: Tier): string {
  const rain = factors.trigger_probability >= RAIN_SOME;
  const weak = factors.susceptibility >= SLOPE_WEAK;
  if (tier === "green") return "No landslide warning here right now";
  if (rain && weak) return "Heavy rainfall on a naturally weak slope";
  if (rain) return "Heavy rainfall on this stretch";
  if (weak) return "A naturally weak slope";
  return "Raised risk on this stretch";
}

export const ACTION: Record<Tier, { label: string; action: string; urgent: boolean }> = {
  green: {
    label: "Safe to travel",
    action: "No special precautions needed. Travel as normal.",
    urgent: false,
  },
  yellow: {
    label: "Stay alert",
    action: "Travel is fine, but check the weather before you leave and drive carefully.",
    urgent: false,
  },
  orange: {
    label: "Avoid if you can",
    action: "Avoid unnecessary travel through this section. Do not travel after dark.",
    urgent: true,
  },
  red: {
    label: "Do not travel",
    action: "Do not use this road. Landslides are likely here. Wait for the all-clear.",
    urgent: true,
  },
};
