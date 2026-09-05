import { StyleSheet, Text, View } from "react-native";
import { COLORS, TIER_ADVICE, TIER_COLOR, type Tier } from "../lib/theme";

/** The one thing a traveller needs: how bad is it here, and what should I do.
 *  The band is always spelled out — a colour alone is unreadable to a
 *  colour-blind reader and meaningless to anyone not briefed on the scale. */
export function RiskCard({ tier, km, distanceM }: {
  tier: Tier; km: number; distanceM: number;
}) {
  const advice = TIER_ADVICE[tier];
  return (
    <View style={[styles.card, { borderColor: TIER_COLOR[tier] }]}>
      <View style={styles.headRow}>
        <View style={[styles.dot, { backgroundColor: TIER_COLOR[tier] }]} />
        <Text style={[styles.tier, { color: TIER_COLOR[tier] }]}>
          {advice.title.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.advice}>{advice.advice}</Text>
      <Text style={styles.meta}>
        NH-10 km {km.toFixed(1)} · {Math.round(distanceM)} m from you
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, borderLeftWidth: 5,
    borderWidth: 1, borderTopColor: COLORS.border, borderRightColor: COLORS.border,
    borderBottomColor: COLORS.border, padding: 18, gap: 8,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tier: { fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  advice: { color: COLORS.text1, fontSize: 19, lineHeight: 27, fontWeight: "600" },
  meta: { color: COLORS.text3, fontSize: 12.5 },
});
