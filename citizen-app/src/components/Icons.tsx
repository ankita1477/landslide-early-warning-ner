import {
  Building2, CheckCircle2, CloudDrizzle, CloudRain, Eye, Mountain, OctagonAlert,
  Radar, Satellite, ShieldCheck, TriangleAlert, type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import type { ReasonIcon } from "../lib/explain";
import { C, RADIUS, TIER_COLOR, type Tier } from "../lib/theme";

/** One glyph per band, so a colour-blind reader has a shape as well as a word. */
export const TIER_ICON: Record<Tier, LucideIcon> = {
  green: ShieldCheck, yellow: Eye, orange: TriangleAlert, red: OctagonAlert,
};

const REASON: Record<ReasonIcon, LucideIcon> = {
  ok: CheckCircle2, watched: Satellite, rain: CloudRain, drizzle: CloudDrizzle,
  slope: Mountain, moving: Radar, homes: Building2,
};

export function Reason({ icon, color = C.text2, size = 20 }: {
  icon: ReasonIcon; color?: string; size?: number;
}) {
  const Glyph = REASON[icon];
  return <Glyph color={color} size={size} strokeWidth={1.9} />;
}

/** A glyph on a soft square: the unit every list row in the app is built from. */
export function IconTile({ icon: Glyph, tier, color, size = 44 }: {
  icon: LucideIcon; tier?: Tier; color?: string; size?: number;
}) {
  const ink = color ?? (tier ? TIER_COLOR[tier] : C.text1);
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: tier ? `${TIER_COLOR[tier]}1F` : C.surfaceHi },
      ]}
    >
      <Glyph color={ink} size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: RADIUS.control, alignItems: "center", justifyContent: "center" },
});
