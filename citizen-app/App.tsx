import { useState } from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { NearMe } from "./src/screens/NearMe";
import { Corridor } from "./src/screens/Corridor";
import { Report } from "./src/screens/Report";
import { COLORS } from "./src/lib/theme";

const TABS = [
  { key: "near", label: "Near me" },
  { key: "road", label: "The road" },
  { key: "report", label: "Report" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function App() {
  const [tab, setTab] = useState<TabKey>("near");

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>NH-10 Landslide Alerts</Text>
        <Text style={styles.subtitle}>Sevoke – Gangtok</Text>
      </View>

      <View style={styles.body}>
        {tab === "near" && <NearMe />}
        {tab === "road" && <Corridor />}
        {tab === "report" && <Report />}
      </View>

      {/* Tabs sit at the bottom: this is a one-handed app used beside a road. */}
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
          >
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelOn]}>
              {item.label}
            </Text>
            {tab === item.key && <View style={styles.tabMark} />}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text1, fontSize: 18, fontWeight: "700" },
  subtitle: { color: COLORS.text3, fontSize: 12, marginTop: 2 },
  body: { flex: 1 },
  tabs: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13, gap: 5 },
  tabLabel: { color: COLORS.text3, fontSize: 13, fontWeight: "600" },
  tabLabelOn: { color: COLORS.text1 },
  tabMark: { width: 20, height: 2, borderRadius: 1, backgroundColor: COLORS.text1 },
});
