import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WORD, TYPE, type Tier } from "../lib/theme";

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

  useEffect(() => {
    Animated.timing(drop, {
      toValue: 1, duration: reduced ? 0 : D.banner, easing: EASE.out, useNativeDriver: true,
    }).start();
  }, [drop, reduced]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) },
          ],
        },
      ]}
      accessibilityLiveRegion="assertive"
    >
      <View style={[styles.banner, { borderColor: TIER_COLOR[tier] }]}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: TIER_COLOR[tier] }]} />
          <Text style={[styles.word, { color: TIER_COLOR[tier] }]}>
            {TIER_WORD[tier]} ALERT
          </Text>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.place}>NH-10 · KM {km.toFixed(0)}</Text>
        <Text style={styles.reason}>{reason}</Text>
        <Pressable onPress={onView} style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaText}>View details  →</Text>
        </Pressable>
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
    backgroundColor: "#0E1424", borderRadius: RADIUS.card,
    borderWidth: 1.5, padding: SPACE.md, gap: 4,
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  word: { ...TYPE.micro, flex: 1 },
  close: { color: C.text3, fontSize: 15 },
  place: { ...TYPE.bodyStrong, color: C.text1, marginTop: 2 },
  reason: { ...TYPE.body, fontSize: 14.5, color: C.text2 },
  cta: { marginTop: SPACE.sm, alignSelf: "flex-start" },
  ctaText: { ...TYPE.bodyStrong, fontSize: 15, color: C.accent },
});
