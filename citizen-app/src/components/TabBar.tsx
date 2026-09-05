import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, TYPE } from "../lib/theme";

export interface Tab { key: string; label: string; icon: LucideIcon }

/** Bottom bar with a sliding indicator.
 *
 *  The indicator moves rather than reappearing, so the eye follows the change
 *  instead of re-reading the bar. The active glyph is drawn heavier as well as
 *  brighter, and the label is always shown, because an icon alone is a guess.
 */
export function TabBar({ tabs, active, onChange }: {
  tabs: Tab[]; active: string; onChange: (key: string) => void;
}) {
  // -1 when a pushed screen is covering the tabs: none of them is current, so
  // the indicator is withdrawn rather than left pointing at a screen the person
  // is not on.
  const index = tabs.findIndex((t) => t.key === active);
  const slide = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const reduced = useReducedMotion();
  const tabWidth = barWidth / tabs.length;

  // Translating by measured pixels rather than a percentage: the native driver
  // cannot animate percentage transforms, and a percentage indicator silently
  // stops moving on device while still working on web.
  useEffect(() => {
    if (index < 0) return;
    Animated.timing(slide, {
      toValue: index * tabWidth,
      duration: reduced ? 0 : D.page,
      easing: EASE.out,
      useNativeDriver: true,
    }).start();
  }, [index, tabWidth, slide, reduced]);

  return (
    <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {barWidth > 0 && index >= 0 && (
        <Animated.View
          style={[styles.indicator, { width: tabWidth, transform: [{ translateX: slide }] }]}
        >
          <View style={styles.indicatorBar} />
        </Animated.View>
      )}
      {tabs.map((tab) => (
        <TabButton key={tab.key} tab={tab} active={tab.key === active} onPress={() => onChange(tab.key)} />
      ))}
    </View>
  );
}

function TabButton({ tab, active, onPress }: { tab: Tab; active: boolean; onPress: () => void }) {
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const Glyph = tab.icon;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: active ? 1 : 0, duration: reduced ? 0 : D.card,
      easing: EASE.out, useNativeDriver: true,
    }).start();
  }, [active, lift, reduced]);

  const scale = Animated.add(
    lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [0, -0.08] }),
  );
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(press, { toValue: 0, duration: 160, useNativeDriver: true }).start()}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        <Glyph color={active ? C.text1 : C.text3} size={23} strokeWidth={active ? 2.3 : 1.8} />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelOn]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface, paddingBottom: Platform.OS === "ios" ? 6 : 0,
  },
  indicator: { position: "absolute", top: 0, left: 0, height: 3, alignItems: "center" },
  indicatorBar: { width: 28, height: 3, backgroundColor: C.accent, borderBottomLeftRadius: RADIUS.pill, borderBottomRightRadius: RADIUS.pill },
  tab: { flex: 1, alignItems: "center", paddingTop: 12, paddingBottom: 10, gap: 5, minHeight: 60 },
  label: { ...TYPE.label, fontSize: 11, color: C.text3 },
  labelOn: { color: C.text1 },
});
