import { useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, SPACE } from "../lib/theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  tint?: string;
  onPress?: () => void;
  selected?: boolean;
}

/** A raised sheet of white on the paper ground. Static when it does nothing,
 *  responsive when it does — the difference is how a person learns what is
 *  tappable. */
export function Card({ children, style, tint, onPress, selected }: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const to = (value: number) =>
    Animated.timing(press, {
      toValue: value, duration: D.card, easing: EASE.out, useNativeDriver: true,
    }).start();

  const body = (
    <View style={[styles.card, tint ? { backgroundColor: tint } : null, selected && styles.selected, style]}>
      {children}
    </View>
  );

  if (!onPress) return body;

  const scale = reduced ? 1 : press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(0)} accessibilityRole="button">
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: RADIUS.card, padding: SPACE.md,
    borderWidth: 1, borderColor: C.line,
  },
  selected: { borderColor: C.ink },
});
