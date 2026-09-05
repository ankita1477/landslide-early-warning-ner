import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, type LucideIcon } from "lucide-react-native";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, TYPE } from "../lib/theme";

export interface Tab { key: string; label: string; icon: LucideIcon }

const CENTRE = 66;

/** A floating bar with the one action that is not a place in the middle.
 *
 *  Four destinations sit in a pill lifted off the page; reporting is a raised
 *  ink button between them because it is a thing you do, not somewhere you go,
 *  and because a person on a roadside should find it without looking.
 */
export function TabBar({ tabs, active, onChange, onReport }: {
  tabs: Tab[]; active: string; onChange: (key: string) => void; onReport: () => void;
}) {
  const index = tabs.findIndex((t) => t.key === active);
  const slide = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const reduced = useReducedMotion();
  const slot = (barWidth - CENTRE) / tabs.length;
  const half = tabs.length / 2;

  // The two right-hand tabs sit past the centre button, so their slots start
  // one button-width later. Measured pixels, not percentages: the native
  // driver cannot animate a percentage transform.
  const offsetFor = (i: number) => i * slot + (i >= half ? CENTRE : 0);

  useEffect(() => {
    if (index < 0 || barWidth === 0) return;
    Animated.timing(slide, {
      toValue: offsetFor(index), duration: reduced ? 0 : D.page, easing: EASE.out, useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, barWidth, slide, reduced]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {barWidth > 0 && index >= 0 && (
          <Animated.View style={[styles.pill, { width: slot, transform: [{ translateX: slide }] }]}>
            <View style={styles.pillFill} />
          </Animated.View>
        )}
        {tabs.slice(0, half).map((tab) => (
          <TabButton key={tab.key} tab={tab} active={tab.key === active} onPress={() => onChange(tab.key)} />
        ))}
        <View style={{ width: CENTRE }} />
        {tabs.slice(half).map((tab) => (
          <TabButton key={tab.key} tab={tab} active={tab.key === active} onPress={() => onChange(tab.key)} />
        ))}
      </View>
      <Pressable
        onPress={onReport}
        style={({ pressed }) => [styles.centre, pressed && styles.centrePressed]}
        accessibilityRole="button"
        accessibilityLabel="Report a problem"
      >
        <Camera color={C.paper} size={24} strokeWidth={2.1} />
      </Pressable>
    </View>
  );
}

function TabButton({ tab, active, onPress }: { tab: Tab; active: boolean; onPress: () => void }) {
  const Glyph = tab.icon;
  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Glyph color={active ? C.ink : C.ink3} size={22} strokeWidth={active ? 2.3 : 1.8} />
      <Text style={[styles.label, active && styles.labelOn]}>{tab.label}</Text>
    </Pressable>
  );
}

export const TABBAR_HEIGHT = 96;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center",
    paddingHorizontal: 18, paddingBottom: Platform.OS === "ios" ? 22 : 14,
  },
  bar: {
    flexDirection: "row", alignItems: "center", width: "100%", height: 66,
    backgroundColor: C.white, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.line,
    shadowColor: "#1A1A1A", shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
    elevation: 10, paddingHorizontal: 6,
  },
  pill: { position: "absolute", top: 6, bottom: 6, left: 6, padding: 3 },
  pillFill: { flex: 1, borderRadius: RADIUS.pill, backgroundColor: C.paper2 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 54 },
  label: { ...TYPE.label, fontSize: 11, color: C.ink3 },
  labelOn: { color: C.ink },
  centre: {
    position: "absolute", top: -14, width: 62, height: 62, borderRadius: 31,
    backgroundColor: C.ink, alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: C.paper,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  centrePressed: { transform: [{ scale: 0.94 }] },
});
