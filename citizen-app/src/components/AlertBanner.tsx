import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, X } from "lucide-react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { TIER_ICON } from "./Icons";

/** Slides in from the top when the band on the user's stretch worsens.
 *
 *  Only on escalation, never on every reading — the same reasoning as the SMS
 *  dispatcher. A banner that appears each time the app refreshes is one people
 *  swipe away without reading.
 */
export function AlertBanner({ tier, km, reason, onView, onDismiss }: {
  tier: Tier; km: number; reason: string;
  onView: () => void; onDismiss: () => void;
}) {
  const drop = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const Glyph = TIER_ICON[tier];

  useEffect(() => {
    Animated.timing(drop, {
      toValue: 1, duration: reduced ? 0 : D.banner, easing: EASE.out, useNativeDriver: true,
    }).start();
  }, [drop, reduced]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }] },
      ]}
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.banner}>
        <View style={[styles.rail, { backgroundColor: TIER_COLOR[tier] }]} />
        <View style={styles.body}>
          <View style={styles.head}>
            <Glyph color={TIER_COLOR[tier]} size={18} strokeWidth={2.2} />
            <Text style={[styles.word, { color: TIER_COLOR[tier] }]}>{TIER_WORD[tier]}</Text>
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss" style={styles.close}>
              <X color={C.text3} size={18} />
            </Pressable>
          </View>
          <Text style={styles.place}>NH-10 · km {km.toFixed(0)}</Text>
          <Text style={styles.reason}>{reason}</Text>
          <Pressable onPress={onView} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>View details</Text>
            <ArrowRight color={C.accent} size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
    paddingHorizontal: SPACE.md, paddingTop: SPACE.md,
  },
  banner: {
    flexDirection: "row", backgroundColor: "#151B27", borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.borderHi, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  rail: { width: 5 },
  body: { flex: 1, padding: SPACE.md, gap: 3 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { ...TYPE.eyebrow, flex: 1 },
  close: { padding: 2 },
  place: { ...TYPE.bodyStrong, color: C.text1, marginTop: 2 },
  reason: { ...TYPE.body, fontSize: 14.5, color: C.text2 },
  cta: { marginTop: SPACE.sm, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  ctaText: { ...TYPE.bodyStrong, fontSize: 15, color: C.accent },
});
