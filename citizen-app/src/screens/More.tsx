import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Bell, Camera, ChevronRight, LifeBuoy, LocateFixed, LocateOff, Phone, type LucideIcon } from "lucide-react-native";
import { IconTile } from "../components/Icons";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { history } from "../lib/history";
import { queued } from "../lib/reports";
import { C, RADIUS, SPACE, TYPE } from "../lib/theme";

/** Verified national and state numbers. A wrong emergency number in an app like
 *  this is worse than no app, so these are the standard published lines only. */
const CONTACTS = [
  { label: "Emergency", number: "112", note: "Police, fire, ambulance" },
  { label: "Ambulance", number: "108", note: "Free emergency ambulance" },
  { label: "State disaster helpline", number: "1070", note: "State control room" },
  { label: "District control room", number: "1077", note: "District disaster office" },
];

/** Everything that is not the road: what the app has told you, what to do in
 *  trouble, who to call, and what it is allowed to use. */
export function More({ onAlerts, onSafety, onReport }: {
  onAlerts: () => void; onSafety: () => void; onReport: () => void;
}) {
  const [alerts, setAlerts] = useState(0);
  const [pending, setPending] = useState(0);
  const [located, setLocated] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setAlerts((await history()).length);
    setPending((await queued()).length);
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      setLocated(permission.status === "granted");
    } catch {
      setLocated(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>More</Text>

      <Group>
        <Row icon={Bell} title="Alert history" note={alerts === 0 ? "Nothing recorded yet" : `${alerts} recorded on this phone`} onPress={onAlerts} />
        <Row icon={LifeBuoy} title="Safety guide" note="Before, during and after a landslide" onPress={onSafety} />
        <Row icon={Camera} title="Report a problem" note={pending > 0 ? `${pending} saved on this phone` : "Tell others what you can see"} onPress={onReport} last />
      </Group>

      <Text style={styles.eyebrow}>Emergency numbers</Text>
      <Group>
        {CONTACTS.map((c, i) => (
          <Pressable key={c.number} onPress={() => Linking.openURL(`tel:${c.number}`)}
                     style={[styles.row, i === CONTACTS.length - 1 && styles.rowLast]}
                     accessibilityRole="button" accessibilityLabel={`Call ${c.label} on ${c.number}`}>
            <IconTile icon={Phone} size={38} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{c.label}</Text>
              <Text style={styles.rowNote}>{c.note}</Text>
            </View>
            <Text style={styles.number}>{c.number}</Text>
          </Pressable>
        ))}
      </Group>

      <Text style={styles.eyebrow}>This phone</Text>
      <Group>
        <View style={[styles.row, styles.rowLast, { alignItems: "flex-start" }]}>
          <IconTile icon={located ? LocateFixed : LocateOff} size={38} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>
              {located === null ? "Checking location" : located ? "Location is on" : "Location is off"}
            </Text>
            <Text style={styles.rowNote}>
              {located
                ? "The app shows the risk for the stretch you are actually on."
                : "Without it the app shows Sevoke, the start of the road. Turn location on in your phone settings for your own position."}
            </Text>
          </View>
        </View>
      </Group>

      <Text style={styles.eyebrow}>Where the advice comes from</Text>
      <Text style={styles.about}>
        Every day the road is checked against rainfall measured from satellites
        and the shape and steepness of the hillsides above it. The road is split
        into short stretches, and each one is given a level from Safe to Danger.
      </Text>
      <Text style={styles.about}>
        This is guidance for travellers. Always follow the police, the highway
        authority and the district administration.
      </Text>
    </ScrollView>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Row({ icon, title, note, onPress, last }: {
  icon: LucideIcon; title: string; note: string; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, last && styles.rowLast]}
               accessibilityRole="button" accessibilityLabel={title}>
      <IconTile icon={icon} size={38} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
      <ChevronRight color={C.ink3} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: TABBAR_HEIGHT + SPACE.lg },
  h1: { ...TYPE.h1, color: C.ink, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.eyebrow, color: C.ink3, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  group: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingVertical: 13,
    paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 66,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...TYPE.bodyStrong, fontSize: 15.5, lineHeight: 21, color: C.ink },
  rowNote: { ...TYPE.small, color: C.ink3 },
  number: { ...TYPE.title, ...TYPE.num, color: C.ink },
  about: { ...TYPE.body, fontSize: 15, lineHeight: 23, color: C.ink2, marginBottom: SPACE.sm },
});
