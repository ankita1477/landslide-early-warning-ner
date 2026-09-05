import { useCallback, useState } from "react";
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Home } from "./src/screens/Home";
import { Route } from "./src/screens/Route";
import { MapScreen } from "./src/screens/MapScreen";
import { Report } from "./src/screens/Report";
import { Safety } from "./src/screens/Safety";
import { Alerts } from "./src/screens/Alerts";
import { Profile } from "./src/screens/Profile";
import { Splash } from "./src/screens/Splash";
import { AlertBanner } from "./src/components/AlertBanner";
import { ContourBackdrop } from "./src/components/ContourBackdrop";
import { Screen } from "./src/components/Screen";
import { TabBar, type Tab } from "./src/components/TabBar";
import { C, SPACE, TYPE, type Tier } from "./src/lib/theme";

const TABS: Tab[] = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "map", label: "Map", icon: "🗺️" },
  { key: "route", label: "Route", icon: "🧭" },
  { key: "alerts", label: "Alerts", icon: "🔔" },
  { key: "profile", label: "Profile", icon: "👤" },
];

/** Report and Safety are pushed over the tabs rather than living in them.
 *  Both are things a person goes to deliberately, and neither is worth a
 *  permanent fifth of the bottom bar next to the road they are driving. */
type Sub = "report" | "safety" | null;

interface Warning { tier: Tier; km: number; reason: string }

export default function App() {
  const [tab, setTab] = useState("home");
  const [sub, setSub] = useState<Sub>(null);
  const [entered, setEntered] = useState(false);
  const [warning, setWarning] = useState<Warning | null>(null);

  // Only an escalation reaches here — Home decides that from the band it last
  // recorded, so the banner marks a change rather than every refresh.
  const onEscalation = useCallback((next: Warning) => setWarning(next), []);

  // The splash is shown once per launch, not stored: someone opening the app
  // during a storm should see the mark and the way in, not a remembered state.
  if (!entered) return <Splash onEnter={() => setEntered(true)} />;

  const title = sub === "report" ? "Report a problem" : sub === "safety" ? "Safety" : null;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ContourBackdrop />

      <View style={styles.header}>
        {title ? (
          <Pressable
            onPress={() => setSub(null)}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>{title}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.brand}>Landsafe NER</Text>
            <Text style={styles.corridor}>NH-10 · Sevoke to Gangtok</Text>
          </>
        )}
      </View>

      <View style={styles.body}>
        {sub === null && tab === "home" && (
          <Screen id="home">
            <Home
              onRoute={() => setTab("route")}
              onMap={() => setTab("map")}
              onReport={() => setSub("report")}
              onEscalation={onEscalation}
            />
          </Screen>
        )}
        {sub === null && tab === "map" && <Screen id="map"><MapScreen /></Screen>}
        {sub === null && tab === "route" && <Screen id="route"><Route /></Screen>}
        {sub === null && tab === "alerts" && <Screen id="alerts"><Alerts /></Screen>}
        {sub === null && tab === "profile" && (
          <Screen id="profile">
            <Profile onReport={() => setSub("report")} onSafety={() => setSub("safety")} />
          </Screen>
        )}
        {sub === "report" && <Screen id="report"><Report /></Screen>}
        {sub === "safety" && <Screen id="safety"><Safety /></Screen>}
      </View>

      {/* Bottom bar: reachable one-handed, which is how this gets used. */}
      <TabBar
        tabs={TABS}
        active={sub === null ? tab : ""}
        onChange={(key) => { setSub(null); setTab(key); }}
      />

      {warning && (
        <AlertBanner
          tier={warning.tier}
          km={warning.km}
          reason={warning.reason}
          onView={() => { setWarning(null); setSub(null); setTab("home"); }}
          onDismiss={() => setWarning(null)}
        />
      )}
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
    borderBottomWidth: 1, borderBottomColor: C.border, minHeight: 56,
    justifyContent: "center",
  },
  brand: { ...TYPE.title, fontSize: 20, color: C.text1, letterSpacing: -0.3 },
  corridor: { fontSize: 12.5, color: C.text3, marginTop: 2 },
  back: { flexDirection: "row", alignItems: "center", gap: 12 },
  backArrow: { fontSize: 24, color: C.text1 },
  backText: { ...TYPE.title, fontSize: 19, color: C.text1 },
  body: { flex: 1 },
});
