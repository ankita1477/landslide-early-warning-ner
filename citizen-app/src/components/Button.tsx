import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { C, RADIUS, TYPE } from "../lib/theme";

/** Large hit areas throughout: this is used one-handed, outdoors, often in rain.
 *  Nothing is below 52px tall. */
export function Button({ label, onPress, kind = "primary", style }: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base, styles[kind], pressed && styles.pressed, style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, kind === "primary" ? styles.labelDark : null]}>
        {label}
      </Text>
    </Pressable>
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
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  label: { ...TYPE.bodyStrong, color: C.text1 },
  labelDark: { color: C.bg },
});
