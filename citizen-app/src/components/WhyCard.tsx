import { StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { C, SPACE, TYPE } from "../lib/theme";
import { reasons, type Factors } from "../lib/explain";
import type { Tier } from "../lib/theme";

/** "Why am I getting this alert?" — the question every warning should answer.
 *  A warning without a reason is one people learn to dismiss. */
export function WhyCard({ factors, tier }: { factors: Factors; tier?: Tier }) {
  const items = reasons(factors, tier);
  return (
    <Card>
      <Text style={styles.heading}>
        {tier === "green" ? "Why is it safe?" : "Why am I seeing this?"}
      </Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.text} style={styles.row}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...TYPE.title, color: C.text1, marginBottom: SPACE.sm },
  list: { gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { fontSize: 20, width: 26 },
  text: { ...TYPE.body, color: C.text2, flex: 1 },
});
