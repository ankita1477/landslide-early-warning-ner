import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Card } from "../components/Card";
import { Logo } from "../components/Logo";
import { queued } from "../lib/reports";
import { C, RADIUS, SPACE, TYPE } from "../lib/theme";

/** The things that belong to the person rather than to the road: what they have
 *  reported, what the app is allowed to use, and where the advice comes from. */
export function Profile({ onReport, onSafety }: {
  onReport: () => void; onSafety: () => void;
}) {
  const [pending, setPending] = useState(0);
  const [located, setLocated] = useState<boolean | null>(null);

  const load = useCallback(async () => {
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
      <View style={styles.crest}>
        <Logo size={56} />
        <View style={styles.crestText}>
          <Text style={styles.name}>Landsafe NER</Text>
          <Text style={styles.sub}>Travelling NH-10, Sevoke to Gangtok</Text>
        </View>
      </View>

      <Row
        icon="📷"
        title="Report a problem"
        note={pending > 0 ? `${pending} saved on this phone` : "Tell others what you can see"}
        onPress={onReport}
      />
      <Row
        icon="🛟"
        title="Safety guide"
        note="What to do before, during and after"
        onPress={onSafety}
      />

      <Text style={styles.h2}>Location</Text>
      <Card>
        <Text style={styles.cardTitle}>
          {located === null
            ? "Checking"
            : located
              ? "Location is on"
              : "Location is off"}
        </Text>
        <Text style={styles.body}>
          {located
            ? "The app shows the risk for the stretch you are actually on."
            : "Without it the app shows Sevoke, the start of the road. Turn location on in your phone settings for your own position."}
        </Text>
      </Card>

      <Text style={styles.h2}>Where the advice comes from</Text>
      <Card>
        <Text style={styles.body}>
          Every day the road is checked against rainfall measured from satellites
          and the shape and steepness of the hillsides above it. The road is split
          into short stretches, and each one is given a level from Safe to Danger.
        </Text>
        <Text style={[styles.body, styles.spaced]}>
          This is guidance for travellers. Always follow the police, the highway
          authority and the district administration.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Row({ icon, title, note, onPress }: {
  icon: string; title: string; note: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <Card style={styles.row}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <View style={styles.rowText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.rowNote}>{note}</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xl },
  crest: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.sm },
  crestText: { flex: 1, gap: 2 },
  name: { ...TYPE.title, color: C.text1 },
  sub: { fontSize: 13, color: C.text3 },
  h2: { ...TYPE.title, fontSize: 18, color: C.text1, marginTop: SPACE.lg, marginBottom: SPACE.xs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 72 },
  rowIcon: {
    fontSize: 22, width: 44, height: 44, borderRadius: RADIUS.control,
    backgroundColor: C.surfaceHi, textAlign: "center", lineHeight: 44, overflow: "hidden",
  },
  rowText: { flex: 1, gap: 2 },
  rowNote: { fontSize: 12.5, color: C.text3 },
  chev: { fontSize: 26, color: C.text3 },
  cardTitle: { ...TYPE.bodyStrong, color: C.text1 },
  body: { ...TYPE.body, fontSize: 14.5, color: C.text2 },
  spaced: { marginTop: SPACE.sm },
});
