import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { useReducedMotion } from "../lib/motion";
import { C, RADIUS, SPACE } from "../lib/theme";

/** A shimmer placeholder in the shape of what is coming.
 *
 *  Better than a spinner because it says where the content will be, so the
 *  layout does not jump when it lands.
 */
export function Skeleton({ height = 16, width = "100%", style }: {
  height?: number; width?: number | string; style?: ViewStyle;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduced]);

  return (
    <View style={[styles.base, { height, width } as ViewStyle, style]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.sheen,
          { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}
      />
    </View>
  );
}

/** The Today screen's shape, so the page does not reflow when the reading lands. */
export function RiskSkeleton() {
  return (
    <View style={styles.block}>
      <Skeleton height={12} width={120} />
      <Skeleton height={190} style={{ marginTop: SPACE.md, borderRadius: RADIUS.card }} />
      <Skeleton height={34} width="78%" style={{ marginTop: SPACE.lg }} />
      <Skeleton height={34} width="50%" style={{ marginTop: SPACE.xs }} />
      <Skeleton height={16} width="60%" style={{ marginTop: SPACE.md }} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={62} style={{ borderRadius: RADIUS.control }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: C.paper2, borderRadius: 8, overflow: "hidden" },
  sheen: { backgroundColor: C.white },
  block: { padding: SPACE.lg },
});
