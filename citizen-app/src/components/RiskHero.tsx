import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ArrowRight, Clock3, MapPin } from "lucide-react-native";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WASH, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION, SITUATION } from "../lib/explain";
import { PULSE, useReducedMotion } from "../lib/motion";
import { Hillside } from "../illustrations/Hillside";
import { TIER_ICON } from "./Icons";

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
  const { width } = useWindowDimensions();
  const Glyph = TIER_ICON[tier];

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
      style={[styles.card, { backgroundColor: TIER_WASH[tier], borderColor: `${TIER_COLOR[tier]}66` }]}
      accessibilityRole="summary"
      accessibilityLabel={`${TIER_WORD[tier]}. ${situation.headline}. ${situation.sub}. ${action.action}`}
    >
      <View style={styles.art}>
        <Hillside tier={tier} width={Math.min(width - SPACE.md * 2 - 2, 420)} />
        <View style={styles.badge}>
          <View style={styles.dotWrap}>
            <Animated.View
              style={[
                styles.halo,
                {
                  backgroundColor: TIER_COLOR[tier],
                  opacity: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.42, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [2.2, 1] }) }],
                },
              ]}
            />
            <Animated.View style={[styles.dot, { backgroundColor: TIER_COLOR[tier], opacity: pulse }]} />
          </View>
          <Glyph color={TIER_COLOR[tier]} size={15} strokeWidth={2.4} />
          <Text style={[styles.word, { color: TIER_COLOR[tier] }]}>{TIER_WORD[tier]}</Text>
        </View>
      </View>

      <View style={styles.text}>
        <Text style={styles.label}>{situation.headline}</Text>
        <Text style={styles.action}>{situation.sub}</Text>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <MapPin color={C.text3} size={14} />
            <Text style={styles.place}>{place}</Text>
          </View>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          {updated ? (
            <View style={styles.metaRow}>
              <Clock3 color={C.text3} size={13} />
              <Text style={styles.sub}>Updated {updated}</Text>
            </View>
          ) : null}
        </View>

        {onRoute && (
          <Pressable onPress={onRoute} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>Check my route</Text>
            <ArrowRight color={C.bg} size={19} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 1, overflow: "hidden" },
  art: { alignItems: "center", marginTop: -6 },
  badge: {
    position: "absolute", top: SPACE.md, left: SPACE.md,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(10,13,20,0.72)", borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border,
  },
  dotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  word: { ...TYPE.eyebrow },
  text: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, marginTop: -SPACE.sm, gap: SPACE.xs },
  label: { ...TYPE.hero, color: C.text1 },
  action: { ...TYPE.body, color: C.text2 },
  meta: { marginTop: SPACE.sm, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  place: { ...TYPE.label, color: C.text2 },
  sub: { fontSize: 12.5, color: C.text3 },
  cta: {
    marginTop: SPACE.md, minHeight: 54, borderRadius: RADIUS.control,
    backgroundColor: C.text1, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10,
  },
  ctaText: { ...TYPE.bodyStrong, color: C.bg },
});
