import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { C, RADIUS, SPACE } from "../lib/theme";

export function Card({ children, style, tint }: {
  children: ReactNode; style?: ViewStyle; tint?: string;
}) {
  return (
    <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACE.md,
  },
});
