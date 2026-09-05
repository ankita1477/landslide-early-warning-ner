import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WASH, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION, SITUATION } from "../lib/explain";
import { PULSE, useReducedMotion } from "../lib/motion";

/** The whole point of the app in one card: what the risk is, and what to do.
 *  The band is spoken as a word — a colour alone is unreadable to a colour-blind
 *  user and meaningless to anyone who has not been briefed on the scale. */
export function RiskHero({ tier, place, subtitle, updated, onRoute }: {
  tier: Tier; place: string; subtitle?: string; updated?: string;
  onRoute?: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const action = ACTION[tier];
  const situation = SITUATION[tier];
  const reduced = useReducedMotion();

  // The band sets how insistent the beat is: green barely moves, red is quick
  // but never flashes. A strobing emergency screen is harder to read, and
  // frightening rather than informative.
  useEffect(() => {
    const beat = PULSE[tier];
    if (!beat || reduced) {
      pulse.setValue(1);
      return;
    }
    const half = beat.duration / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: beat.to, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tier, pulse, reduced]);

  return (
    <View
      style={[styles.card, { backgroundColor: TIER_WASH[tier], borderColor: TIER_COLOR[tier] }]}
      accessibilityRole="summary"
      accessibilityLabel={`${TIER_WORD[tier]}. ${situation.headline}. ${situation.sub}. ${action.action}`}
    >
      <View style={styles.row}>
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.halo,
              {
                backgroundColor: TIER_COLOR[tier],
                opacity: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.42, 0] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [2.1, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            style={[styles.dot, { backgroundColor: TIER_COLOR[tier], opacity: pulse }]}
          />
        </View>
        <Text style={[styles.word, { color: TIER_COLOR[tier] }]}>{TIER_WORD[tier]}</Text>
      </View>

      <Text style={styles.label}>{situation.headline}</Text>
      <Text style={styles.action}>{situation.sub}</Text>

      <View style={styles.footer}>
        <Text style={styles.place}>{place}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        {updated ? <Text style={styles.sub}>Updated {updated}</Text> : null}
      </View>

      {onRoute && (
        <Pressable onPress={onRoute} style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaText}>Check my route</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 2, padding: SPACE.lg, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 14, height: 14, borderRadius: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  word: { ...TYPE.micro, fontSize: 13 },
  label: { ...TYPE.hero, color: C.text1, marginTop: 2 },
  action: { ...TYPE.body, color: C.text1, opacity: 0.92 },
  footer: { marginTop: SPACE.sm, gap: 2 },
  place: { ...TYPE.label, color: C.text2 },
  sub: { fontSize: 12.5, color: C.text3 },
  cta: {
    marginTop: SPACE.md, minHeight: 54, borderRadius: RADIUS.control,
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  ctaText: { ...TYPE.bodyStrong, color: C.text1 },
  ctaArrow: { ...TYPE.bodyStrong, color: C.text1, fontSize: 18 },
});
