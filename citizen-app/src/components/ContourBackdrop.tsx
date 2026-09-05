import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useReducedMotion } from "../lib/motion";
import { C } from "../lib/theme";

/** Contour lines drifting slowly behind every screen.
 *
 *  Ninety seconds for one pass and under 5% opacity — it should register as
 *  texture rather than as movement. It ties the screens to the terrain the app
 *  is actually about, without ever competing with the risk card in front of it.
 */
export function ContourBackdrop() {
  const { width, height } = useWindowDimensions();
  const drift = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1, duration: 90000, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduced]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -140] });

  // Nested ridgelines, each a little tighter than the last.
  const lines = Array.from({ length: 9 }, (_, i) => {
    const base = height * 0.18 + i * 74;
    const amp = 26 + i * 3;
    const points = Array.from({ length: 11 }, (_, k) => {
      const x = (k / 10) * width;
      const y = base - Math.sin(k * 0.9 + i * 0.55) * amp - Math.sin(k * 0.4) * amp * 0.4;
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    });
    return `M ${points.join(" L ")}`;
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Svg width={width} height={height + 200}>
          {lines.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke={C.accent}
                  strokeOpacity={0.045} strokeWidth={1} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
