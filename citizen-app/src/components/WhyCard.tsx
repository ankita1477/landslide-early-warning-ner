import { StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { Reason } from "./Icons";
import { C, SPACE, TIER_COLOR, TYPE } from "../lib/theme";
import { reasons, type Factors } from "../lib/explain";
import type { Tier } from "../lib/theme";

/** "Why am I getting this alert?" — the question every warning should answer.
 *  A warning without a reason is one people learn to dismiss. */
export function WhyCard({ factors, tier }: { factors: Factors; tier?: Tier }) {
  const items = reasons(factors, tier);
  const ink = tier ? TIER_COLOR[tier] : C.text2;
  return (
    <Card>
      <Text style={styles.eyebrow}>{tier === "green" ? "Why it is safe" : "Why you are seeing this"}</Text>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View key={item.text} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.glyph}>
              <Reason icon={item.icon} color={ink} />
            </View>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...TYPE.eyebrow, color: C.text3, marginBottom: SPACE.xs },
  list: {},
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  glyph: { width: 24, alignItems: "center" },
  text: { ...TYPE.body, color: C.text1, flex: 1 },
});
