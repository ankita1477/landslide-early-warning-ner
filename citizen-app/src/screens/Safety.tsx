import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { List } from "react-native-paper";
import { Ambulance, Backpack, ChevronDown, ChevronUp, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { IconTile } from "../components/Icons";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { C, RADIUS, SPACE, TYPE } from "../lib/theme";

/** Advice a person can follow without training, in the order they need it. */
const GUIDE: { key: string; title: string; icon: LucideIcon; points: string[] }[] = [
  {
    key: "before", title: "Before you travel", icon: Backpack,
    points: [
      "Check this app and the weather before setting out.",
      "Tell someone your route and when you expect to arrive.",
      "Carry water, a torch, a power bank and any medicines you need.",
      "Avoid starting a hill journey late in the evening during monsoon.",
      "Keep the fuel tank full — you may have to wait or turn back.",
    ],
  },
  {
    key: "during", title: "If a landslide happens", icon: TriangleAlert,
    points: [
      "Do not try to drive across fallen debris — more can follow.",
      "Move away from the slope, not along the road below it.",
      "Get out of the vehicle and move to higher, open ground if rocks are falling.",
      "Call 112 and tell them the road and the nearest kilometre marker.",
      "Warn drivers coming from behind if you can do so safely.",
    ],
  },
  {
    key: "after", title: "After a landslide", icon: Ambulance,
    points: [
      "Stay clear of the slope — the ground stays unstable for days.",
      "Do not touch fallen electrical lines or poles.",
      "Wait for the road authority to declare the road open. A cleared road is not always a safe one.",
      "Report what you saw in this app so others are warned.",
      "Check on neighbours, especially elderly people living alone.",
    ],
  },
];

export function Safety() {
  const [open, setOpen] = useState<string | null>("before");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>Three short lists, in the order you will need them.</Text>
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
                  {isExpanded ? <ChevronUp color={C.ink2} size={20} /> : <ChevronDown color={C.ink3} size={20} />}
                </View>
              )}
              style={[styles.accordion, expanded && styles.accordionOpen]}
              titleStyle={styles.accordionTitle}
              rippleColor="rgba(23,25,29,0.06)"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: TABBAR_HEIGHT + SPACE.lg, gap: SPACE.md },
  sub: { ...TYPE.body, color: C.ink2 },
  section: { marginVertical: 0, gap: SPACE.sm },
  accordion: {
    backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1,
    borderColor: C.line, paddingLeft: SPACE.sm, paddingVertical: 4,
  },
  accordionOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  accordionTitle: { ...TYPE.bodyStrong, fontSize: 17, color: C.ink },
  chevron: { justifyContent: "center", paddingRight: SPACE.xs },
  points: {
    backgroundColor: C.white, borderBottomLeftRadius: RADIUS.card, borderBottomRightRadius: RADIUS.card,
    paddingTop: SPACE.xs, paddingBottom: SPACE.md, paddingHorizontal: SPACE.md, gap: SPACE.sm,
    borderWidth: 1, borderTopWidth: 0, borderColor: C.line,
  },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bullet: {
    ...TYPE.label, ...TYPE.num, fontSize: 12, color: C.ink2, width: 24, height: 24, lineHeight: 24, textAlign: "center",
    borderRadius: 12, backgroundColor: C.paper2, overflow: "hidden",
  },
  pointText: { ...TYPE.body, color: C.ink2, flex: 1 },
});
