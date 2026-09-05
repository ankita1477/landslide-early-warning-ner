import { useCallback, useState } from "react";
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ChevronDown, ChevronUp, CloudSun, Map, Menu, Route as RouteIcon, X, type LucideIcon } from "lucide-react-native";
import { Today } from "./src/screens/Today";
import { Route } from "./src/screens/Route";
import { MapScreen } from "./src/screens/MapScreen";
import { Report } from "./src/screens/Report";
import { Safety } from "./src/screens/Safety";
import { Alerts } from "./src/screens/Alerts";
import { More } from "./src/screens/More";
import { Splash } from "./src/screens/Splash";
import { AlertBanner } from "./src/components/AlertBanner";
import { Logo } from "./src/components/Logo";
import { Screen } from "./src/components/Screen";
import { TabBar, type Tab } from "./src/components/TabBar";
import { useAppFonts } from "./src/lib/fonts";
import { paperTheme } from "./src/lib/paper";
import { C, SPACE, TYPE, type Tier } from "./src/lib/theme";

const TABS: Tab[] = [
  { key: "today", label: "Today", icon: CloudSun },
  { key: "road", label: "Road", icon: Map },
  { key: "route", label: "Route", icon: RouteIcon },
  { key: "more", label: "More", icon: Menu },
];

/** Paper asks for icons by Material name; these are the only ones it needs
 *  here, drawn from the same set as the rest of the app so nothing looks
 *  borrowed. */
const PAPER_ICONS: Record<string, LucideIcon> = {
  "chevron-up": ChevronUp, "chevron-down": ChevronDown, close: X,
};
const paperIcon = ({ name, color, size }: { name: string; color?: string; size: number }) => {
  const Glyph = PAPER_ICONS[name] ?? X;
  return <Glyph color={color ?? C.ink2} size={size} strokeWidth={2} />;
};

/** Pushed pages sit over the tabs. Report is the raised button in the bar;
 *  Alerts and Safety are reached from More. None of them deserves a permanent
 *  slot next to the road a person is driving. */
type Sub = "report" | "safety" | "alerts" | null;
const SUB_TITLE: Record<Exclude<Sub, null>, string> = {
  report: "Report a problem", safety: "Safety guide", alerts: "Alert history",
};

interface Warning { tier: Tier; km: number; reason: string }

export default function App() {
  const ready = useAppFonts();
  // Nothing renders in the fallback face: a flash of the wrong type on the
  // first screen would be the first thing anyone saw of the app.
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={{ icon: paperIcon }}>
        <Shell />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState("today");
  const [sub, setSub] = useState<Sub>(null);
  const [entered, setEntered] = useState(false);
  const [warning, setWarning] = useState<Warning | null>(null);

  // Only an escalation reaches here — Today decides that from the band it
  // last recorded, so the banner marks a change rather than every refresh.
  const onEscalation = useCallback((next: Warning) => setWarning(next), []);

  // The splash is shown once per launch, not stored: someone opening the app
  // during a storm should see the mark and the way in, not a remembered state.
  if (!entered) return <Splash onEnter={() => setEntered(true)} />;

  return (
    <SafeAreaView style={styles.app} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />

      <View style={styles.header}>
        {sub ? (
          <Pressable onPress={() => setSub(null)} style={styles.back}
                     accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <ArrowLeft color={C.ink} size={22} />
            <Text style={styles.backText}>{SUB_TITLE[sub]}</Text>
          </Pressable>
        ) : (
          <View style={styles.brandRow}>
            <Logo size={26} />
            <Text style={styles.brand}>Landsafe <Text style={styles.brandLight}>NER</Text></Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.corridor}>NH-10 · Sevoke–Gangtok</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {sub === null && tab === "today" && (
          <Screen id="today">
            <Today onRoute={() => setTab("route")} onSafety={() => setSub("safety")} onEscalation={onEscalation} />
          </Screen>
        )}
        {sub === null && tab === "road" && <Screen id="road"><MapScreen /></Screen>}
        {sub === null && tab === "route" && <Screen id="route"><Route /></Screen>}
        {sub === null && tab === "more" && (
          <Screen id="more">
            <More onAlerts={() => setSub("alerts")} onSafety={() => setSub("safety")} onReport={() => setSub("report")} />
          </Screen>
        )}
        {sub === "report" && <Screen id="report"><Report /></Screen>}
        {sub === "safety" && <Screen id="safety"><Safety /></Screen>}
        {sub === "alerts" && <Screen id="alerts"><Alerts /></Screen>}
      </View>

      <TabBar
        tabs={TABS}
        active={sub === null ? tab : ""}
        onChange={(key) => { setSub(null); setTab(key); }}
        onReport={() => setSub("report")}
      />

      {warning && (
        <AlertBanner
          tier={warning.tier} km={warning.km} reason={warning.reason}
          onView={() => { setWarning(null); setSub(null); setTab("today"); }}
          onDismiss={() => setWarning(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.paper, paddingTop: Platform.OS === "android" ? 6 : 0 },
  header: {
    paddingHorizontal: SPACE.md, height: 52, justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: { ...TYPE.h2, fontSize: 19, lineHeight: 24, color: C.ink },
  brandLight: { fontFamily: "Fraunces_500Medium_Italic", color: C.ink2 },
  corridor: { ...TYPE.label, fontSize: 12, color: C.ink3 },
  back: { flexDirection: "row", alignItems: "center", gap: 12 },
  backText: { ...TYPE.h2, fontSize: 20, lineHeight: 26, color: C.ink },
  body: { flex: 1 },
});
