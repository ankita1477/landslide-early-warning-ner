import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WASH, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION } from "../lib/explain";

/** The whole point of the app in one card: what the risk is, and what to do.
 *  The band is spoken as a word — a colour alone is unreadable to a colour-blind
 *  user and meaningless to anyone who has not been briefed on the scale. */
export function RiskHero({ tier, place, subtitle }: {
  tier: Tier; place: string; subtitle?: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const action = ACTION[tier];

  useEffect(() => {
    if (!action.urgent) return;
    // A slow breath, not a flash. Urgency should register without alarming.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [action.urgent, pulse]);

  return (
    <View
      style={[styles.card, { backgroundColor: TIER_WASH[tier], borderColor: TIER_COLOR[tier] }]}
      accessibilityRole="summary"
      accessibilityLabel={`${TIER_WORD[tier]}. ${action.label}. ${action.action}`}
    >
      <View style={styles.row}>
        <Animated.View
          style={[styles.dot, { backgroundColor: TIER_COLOR[tier], opacity: pulse }]}
        />
        <Text style={[styles.word, { color: TIER_COLOR[tier] }]}>{TIER_WORD[tier]}</Text>
      </View>

      <Text style={styles.label}>{action.label}</Text>
      <Text style={styles.action}>{action.action}</Text>

      <View style={styles.footer}>
        <Text style={styles.place}>{place}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 2, padding: SPACE.lg, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  word: { ...TYPE.micro, fontSize: 13 },
  label: { ...TYPE.hero, color: C.text1, marginTop: 2 },
  action: { ...TYPE.body, color: C.text1, opacity: 0.92 },
  footer: { marginTop: SPACE.sm, gap: 2 },
  place: { ...TYPE.label, color: C.text2 },
  sub: { fontSize: 12.5, color: C.text3 },
});
