import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { history, type WarningEntry } from "../lib/history";
import { useEffect } from "react";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WORD, TYPE, type Tier } from "../lib/theme";

/** Advice a person can follow without training, in the order they need it. */
const GUIDE = [
  {
    key: "before",
    title: "Before you travel",
    icon: "🎒",
    points: [
      "Check this app and the weather before setting out.",
      "Tell someone your route and when you expect to arrive.",
      "Carry water, a torch, a power bank and any medicines you need.",
      "Avoid starting a hill journey late in the evening during monsoon.",
      "Keep the fuel tank full — you may have to wait or turn back.",
    ],
  },
  {
    key: "during",
    title: "If a landslide happens",
    icon: "⚠️",
    points: [
      "Do not try to drive across fallen debris — more can follow.",
      "Move away from the slope, not along the road below it.",
      "Get out of the vehicle and move to higher, open ground if rocks are falling.",
      "Call 112 and tell them the road and the nearest kilometre marker.",
      "Warn drivers coming from behind if you can do so safely.",
    ],
  },
  {
    key: "after",
    title: "After a landslide",
    icon: "🚑",
    points: [
      "Stay clear of the slope — the ground stays unstable for days.",
      "Do not touch fallen electrical lines or poles.",
      "Wait for the road authority to declare the road open. A cleared road is not always a safe one.",
      "Report what you saw in this app so others are warned.",
      "Check on neighbours, especially elderly people living alone.",
    ],
  },
] as const;

/** Verified national and state numbers. A wrong emergency number in an app like
 *  this is worse than no app, so these are the standard published lines only. */
const CONTACTS = [
  { label: "Emergency (all services)", number: "112", note: "Police, fire, ambulance" },
  { label: "Ambulance", number: "108", note: "Free emergency ambulance" },
  { label: "State disaster helpline", number: "1070", note: "State control room" },
  { label: "District control room", number: "1077", note: "District disaster office" },
];

export function Safety() {
  const [open, setOpen] = useState<string | null>("before");
  const [past, setPast] = useState<WarningEntry[]>([]);
  useEffect(() => { void history().then(setPast); }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Safety</Text>

      {GUIDE.map((section) => {
        const expanded = open === section.key;
        return (
          <Pressable
            key={section.key}
            onPress={() => setOpen(expanded ? null : section.key)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <Card>
              <View style={styles.head}>
                <Text style={styles.icon}>{section.icon}</Text>
                <Text style={styles.title}>{section.title}</Text>
                <Text style={styles.chev}>{expanded ? "−" : "+"}</Text>
              </View>
              {expanded && (
                <View style={styles.points}>
                  {section.points.map((point) => (
                    <View key={point} style={styles.point}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Pressable>
        );
      })}

      <Text style={styles.h2}>Emergency numbers</Text>
      {CONTACTS.map((contact) => (
        <Pressable
          key={contact.number}
          onPress={() => Linking.openURL(`tel:${contact.number}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.label} on ${contact.number}`}
        >
          <Card style={styles.contact}>
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{contact.label}</Text>
              <Text style={styles.contactNote}>{contact.note}</Text>
            </View>
            <Text style={styles.number}>{contact.number}</Text>
          </Card>
        </Pressable>
      ))}

      <Text style={styles.h2}>Warnings you have seen</Text>
      {past.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            Nothing recorded yet. Each time the risk on your stretch changes, it
            is saved here so you can look back at it.
          </Text>
        </Card>
      ) : (
        past.slice(0, 12).map((entry) => (
          <Card key={entry.at} style={styles.historyRow}>
            <View style={[styles.hBar, { backgroundColor: TIER_COLOR[entry.tier as Tier] }]} />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>
                {TIER_WORD[entry.tier as Tier]} · km {entry.km.toFixed(0)}
              </Text>
              <Text style={styles.contactNote}>{entry.reason}</Text>
            </View>
            <Text style={styles.when}>
              {new Date(entry.at).toLocaleDateString()}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xl },
  h1: { ...TYPE.hero, fontSize: 28, color: C.text1, marginBottom: SPACE.xs },
  h2: { ...TYPE.title, color: C.text1, marginTop: SPACE.lg, marginBottom: SPACE.xs },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { fontSize: 24 },
  title: { ...TYPE.bodyStrong, fontSize: 17, color: C.text1, flex: 1 },
  chev: { fontSize: 22, color: C.text3, width: 22, textAlign: "center" },
  points: { marginTop: SPACE.md, gap: SPACE.sm },
  point: { flexDirection: "row", gap: 10 },
  bullet: { color: C.text3, fontSize: 16, lineHeight: 24 },
  pointText: { ...TYPE.body, color: C.text2, flex: 1 },
  contact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 68 },
  contactText: { flex: 1, gap: 2 },
  contactLabel: { ...TYPE.bodyStrong, color: C.text1 },
  contactNote: { fontSize: 12.5, color: C.text3 },
  number: {
    ...TYPE.title, color: C.accent, fontVariant: ["tabular-nums"],
    borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "rgba(76,141,255,0.14)", overflow: "hidden",
  },
  historyRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  hBar: { width: 5, height: 34, borderRadius: 3 },
  when: { fontSize: 12, color: C.text3 },
  empty: { ...TYPE.body, color: C.text2 },
});
