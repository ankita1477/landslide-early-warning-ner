import { useState } from "react";
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Home } from "./src/screens/Home";
import { Route } from "./src/screens/Route";
import { MapScreen } from "./src/screens/MapScreen";
import { Report } from "./src/screens/Report";
import { Safety } from "./src/screens/Safety";
import { C, SPACE, TYPE } from "./src/lib/theme";

const TABS = [
  { key: "home", label: "Risk", icon: "⚠️" },
  { key: "route", label: "Route", icon: "🧭" },
  { key: "map", label: "Map", icon: "🗺️" },
  { key: "report", label: "Report", icon: "📷" },
  { key: "safety", label: "Safety", icon: "🛟" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function App() {
  const [tab, setTab] = useState<TabKey>("home");

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <Text style={styles.brand}>Landsafe NER</Text>
        <Text style={styles.corridor}>NH-10 · Sevoke to Gangtok</Text>
      </View>

      <View style={styles.body}>
        {tab === "home" && (
          <Home onRoute={() => setTab("route")} onMap={() => setTab("map")} />
        )}
        {tab === "route" && <Route />}
        {tab === "map" && <MapScreen />}
        {tab === "report" && <Report />}
        {tab === "safety" && <Safety />}
      </View>

      {/* Bottom bar: reachable one-handed, which is how this gets used. */}
      <View style={styles.tabs}>
        {TABS.map((item) => {
          const on = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.label}
            >
              <Text style={[styles.tabIcon, !on && styles.tabIconOff]}>{item.icon}</Text>
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1, backgroundColor: C.bg,
    // Android has no safe-area inset, so the header needs its own breathing room.
    paddingTop: Platform.OS === "android" ? 28 : 0,
  },
  header: {
    paddingHorizontal: SPACE.md, paddingTop: SPACE.sm, paddingBottom: SPACE.sm,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  brand: { ...TYPE.title, fontSize: 20, color: C.text1, letterSpacing: -0.3 },
  corridor: { fontSize: 12.5, color: C.text3, marginTop: 2 },
  body: { flex: 1 },
  tabs: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface, paddingBottom: Platform.OS === "ios" ? 6 : 0,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, gap: 3, minHeight: 60 },
  tabIcon: { fontSize: 21 },
  tabIconOff: { opacity: 0.45 },
  tabLabel: { ...TYPE.label, fontSize: 11.5, color: C.text3 },
  tabLabelOn: { color: C.text1 },
});
