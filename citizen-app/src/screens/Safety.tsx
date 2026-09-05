import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { List } from "react-native-paper";
import { Ambulance, Backpack, ChevronDown, ChevronUp, Phone, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { Card } from "../components/Card";
import { IconTile } from "../components/Icons";
import { C, RADIUS, SPACE, TYPE } from "../lib/theme";

/** Advice a person can follow without training, in the order they need it. */
const GUIDE: { key: string; title: string; icon: LucideIcon; points: string[] }[] = [
  {
    key: "before",
    title: "Before you travel",
    icon: Backpack,
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
    icon: TriangleAlert,
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
    icon: Ambulance,
    points: [
      "Stay clear of the slope — the ground stays unstable for days.",
      "Do not touch fallen electrical lines or poles.",
      "Wait for the road authority to declare the road open. A cleared road is not always a safe one.",
      "Report what you saw in this app so others are warned.",
      "Check on neighbours, especially elderly people living alone.",
    ],
  },
];

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <List.Section style={styles.section}>
        {GUIDE.map((section) => {
          const expanded = open === section.key;
          return (
            <List.Accordion
              key={section.key}
              title={section.title}
              expanded={expanded}
              onPress={() => setOpen(expanded ? null : section.key)}
              left={() => <IconTile icon={section.icon} size={40} />}
              right={({ isExpanded }) => (
                <View style={styles.chevron}>
                  {isExpanded
                    ? <ChevronUp color={C.text2} size={20} />
                    : <ChevronDown color={C.text3} size={20} />}
                </View>
              )}
              style={[styles.accordion, expanded && styles.accordionOpen]}
              titleStyle={styles.accordionTitle}
              rippleColor="rgba(255,255,255,0.06)"
            >
              <View style={styles.points}>
                {section.points.map((point, i) => (
                  <View key={point} style={styles.point}>
                    <Text style={styles.bullet}>{i + 1}</Text>
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
            </List.Accordion>
          );
        })}
      </List.Section>

      <Text style={styles.h2}>Emergency numbers</Text>
      {CONTACTS.map((contact) => (
        <Pressable
          key={contact.number}
          onPress={() => Linking.openURL(`tel:${contact.number}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.label} on ${contact.number}`}
        >
          <Card style={styles.contact}>
            <IconTile icon={Phone} color={C.accent} size={40} />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{contact.label}</Text>
              <Text style={styles.contactNote}>{contact.note}</Text>
            </View>
            <Text style={styles.number}>{contact.number}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xl },
  section: { marginVertical: 0, gap: SPACE.sm },
  accordion: {
    backgroundColor: C.surface, borderRadius: RADIUS.card, borderWidth: 1,
    borderColor: C.border, paddingLeft: SPACE.sm, paddingVertical: 4,
  },
  accordionOpen: { borderColor: C.borderHi },
  chevron: { justifyContent: "center", paddingRight: SPACE.xs },
  accordionTitle: { ...TYPE.bodyStrong, fontSize: 17, color: C.text1 },
  points: {
    backgroundColor: C.surface, borderBottomLeftRadius: RADIUS.card, borderBottomRightRadius: RADIUS.card,
    marginTop: -RADIUS.card, paddingTop: RADIUS.card + SPACE.xs, paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.md, gap: SPACE.sm, borderWidth: 1, borderTopWidth: 0, borderColor: C.border,
  },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bullet: {
    ...TYPE.micro, ...TYPE.num, color: C.text3, width: 22, height: 22, lineHeight: 22, textAlign: "center",
    borderRadius: 11, backgroundColor: C.surfaceHi, overflow: "hidden", marginTop: 1,
  },
  pointText: { ...TYPE.body, color: C.text2, flex: 1 },
  h2: { ...TYPE.eyebrow, color: C.text3, marginTop: SPACE.lg, marginBottom: SPACE.xs },
  contact: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 68 },
  contactText: { flex: 1, gap: 2 },
  contactLabel: { ...TYPE.bodyStrong, color: C.text1 },
  contactNote: { fontSize: 12.5, color: C.text3 },
  number: {
    ...TYPE.title, ...TYPE.num, color: C.accent,
    borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "rgba(91,141,239,0.14)", overflow: "hidden",
  },
});
