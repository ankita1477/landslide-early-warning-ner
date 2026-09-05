import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, TYPE } from "../lib/theme";

type State = "idle" | "loading" | "done";

/** Every press is acknowledged.
 *
 *  A button that looks identical before and after a tap leaves the person
 *  wondering whether it registered, and on a slow connection they tap again.
 *  Press dips the scale, work shows a spinner, completion shows a tick.
 */
export function Button({
  label, onPress, kind = "primary", style, disabled, doneLabel = "Done",
}: {
  label: string;
  onPress: () => void | Promise<void>;
  kind?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
  disabled?: boolean;
  doneLabel?: string;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const [state, setState] = useState<State>("idle");
  const reduced = useReducedMotion();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const to = (value: number) =>
    Animated.timing(press, {
      toValue: value, duration: D.fast, easing: EASE.out, useNativeDriver: true,
    }).start();

  const run = async () => {
    if (disabled || state !== "idle") return;
    const result = onPress();
    if (result instanceof Promise) {
      setState("loading");
      try { await result; } finally {
        if (!alive.current) return;
        setState("done");
        setTimeout(() => alive.current && setState("idle"), 1400);
      }
    }
  };

  const scale = reduced ? 1 : press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] });
  const busy = state === "loading";

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={run}
        onPressIn={() => to(1)}
        onPressOut={() => to(0)}
        disabled={disabled || busy}
        style={[styles.base, styles[kind], (disabled || busy) && styles.off]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy }}
        accessibilityLabel={label}
      >
        {busy ? (
          <ActivityIndicator color={kind === "primary" ? C.bg : C.text1} />
        ) : (
          <Text style={[styles.label, kind === "primary" && styles.labelDark]}>
            {state === "done" ? `✓  ${doneLabel}` : label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56, borderRadius: RADIUS.control, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 20, borderWidth: 1,
  },
  primary: { backgroundColor: C.text1, borderColor: C.text1 },
  secondary: { backgroundColor: C.surfaceHi, borderColor: C.border },
  danger: { backgroundColor: C.red, borderColor: C.red },
  off: { opacity: 0.45 },
  label: { ...TYPE.bodyStrong, color: C.text1 },
  labelDark: { color: C.bg },
});
