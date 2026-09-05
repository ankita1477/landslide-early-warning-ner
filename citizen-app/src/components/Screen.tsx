import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet } from "react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";

/** Page transition wrapper.
 *
 *  Entering pages slide up a little and settle out of a slight scale, so moving
 *  between tabs reads as one application rather than a set of separate screens.
 *  Opacity is animated too here — unlike the splash — because a screen that
 *  fails to fade in still scrolls, is readable and is navigable; nothing is
 *  gated behind it.
 */
export function Screen({ children, id }: { children: ReactNode; id: string }) {
  const enter = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    enter.setValue(reduced ? 1 : 0);
    if (reduced) return;
    Animated.timing(enter, {
      toValue: 1, duration: D.page, easing: EASE.out, useNativeDriver: true,
    }).start();
  }, [id, enter, reduced]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
