import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Check, type LucideIcon } from "lucide-react-native";
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
  label, onPress, kind = "primary", style, disabled, doneLabel = "Done", icon: Glyph,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  kind?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
  disabled?: boolean;
  doneLabel?: string;
  icon?: LucideIcon;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const [state, setState] = useState<State>("idle");
  const reduced = useReducedMotion();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const to = (value: number) =>
    Animated.timing(press, { toValue: value, duration: D.fast, easing: EASE.out, useNativeDriver: true }).start();

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
  const ink = kind === "secondary" ? C.ink : C.paper;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={run} onPressIn={() => to(1)} onPressOut={() => to(0)}
        disabled={disabled || busy}
        style={[styles.base, styles[kind], (disabled || busy) && styles.off]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy }}
        accessibilityLabel={label}
      >
        {busy ? (
          <ActivityIndicator color={ink} />
        ) : (
          <View style={styles.row}>
            <Text style={[styles.label, { color: ink }]}>{state === "done" ? doneLabel : label}</Text>
            {state === "done" ? <Check color={ink} size={18} strokeWidth={2.6} />
              : Glyph ? <Glyph color={ink} size={18} strokeWidth={2.2} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: RADIUS.control, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  primary: { backgroundColor: C.ink },
  secondary: { backgroundColor: C.paper2 },
  danger: { backgroundColor: C.red },
  off: { opacity: 0.45 },
  label: { ...TYPE.bodyStrong, fontSize: 16.5 },
});
