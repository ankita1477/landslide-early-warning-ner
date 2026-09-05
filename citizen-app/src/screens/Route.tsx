import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type SegmentSummary } from "../lib/api";
import { Card } from "../components/Card";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_RANK, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION } from "../lib/explain";
import PLACES from "../data/places.json";

interface Place { name: string; km: number }
const STOPS = PLACES as Place[];

/** Default to the journey people actually describe. The last stop on the
 *  corridor is an obscure hamlet; nobody says "I am driving to Paschim
 *  Totgaon". */
const DEFAULT_TO =
  STOPS.find((s) => s.name === "Gangtok") ?? STOPS[STOPS.length - 1];

/** Check a journey rather than a point. Someone about to drive Sevoke to Gangtok
 *  needs to know about the worst kilometre on the way, not the one they are
 *  standing on. */
export function Route() {
  const [from, setFrom] = useState<Place>(STOPS[0]);
  const [to, setTo] = useState<Place>(DEFAULT_TO);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.corridor();
      setSegments(result.data.segments);
    } catch {
      // The empty state below explains it.
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const onRoute = useMemo(() => {
    const low = Math.min(from.km, to.km);
    const high = Math.max(from.km, to.km);
    return segments
      .filter((s) => s.chainage_km >= low && s.chainage_km <= high)
      .sort((a, b) => a.chainage_km - b.chainage_km);
  }, [segments, from, to]);

  const risky = onRoute.filter((s) => TIER_RANK[s.tier as Tier] >= 2);
  const worst = onRoute.reduce<Tier>(
    (acc, s) => (TIER_RANK[s.tier as Tier] > TIER_RANK[acc] ? (s.tier as Tier) : acc),
    "green",
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Check my route</Text>

      <Card>
        <Text style={styles.pickLabel}>Starting from</Text>
        <Picker stops={STOPS} value={from} onChange={setFrom} />
        <View style={styles.gap} />
        <Text style={styles.pickLabel}>Going to</Text>
        <Picker stops={STOPS} value={to} onChange={setTo} />
      </Card>

      {!busy && onRoute.length > 0 && (
        <Card tint={worst === "green" ? "rgba(34,197,94,0.12)" : `${TIER_COLOR[worst]}22`}>
          <Text style={[styles.verdictWord, { color: TIER_COLOR[worst] }]}>
            {TIER_WORD[worst]}
          </Text>
          <Text style={styles.verdict}>
            {risky.length === 0
              ? "No risky sections on this route today."
              : `${risky.length} section${risky.length > 1 ? "s" : ""} need care between ${from.name} and ${to.name}.`}
          </Text>
          <Text style={styles.verdictAction}>{ACTION[worst].action}</Text>
        </Card>
      )}

      {risky.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listHead}>Sections to watch</Text>
          {risky.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={[styles.bar, { backgroundColor: TIER_COLOR[s.tier as Tier] }]} />
              <Text style={styles.rowKm}>km {s.chainage_km.toFixed(0)}</Text>
              <Text style={[styles.rowWord, { color: TIER_COLOR[s.tier as Tier] }]}>
                {TIER_WORD[s.tier as Tier]}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!busy && onRoute.length === 0 && (
        <Card>
          <Text style={styles.empty}>
            No readings for this route yet. Connect once and they are saved for
            offline use.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function Picker({ stops, value, onChange }: {
  stops: Place[]; value: Place; onChange: (p: Place) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
      {stops.map((stop) => {
        const on = stop.name === value.name;
        return (
          <Pressable
            key={stop.name}
            onPress={() => onChange(stop)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{stop.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  h1: { ...TYPE.hero, fontSize: 28, color: C.text1 },
  pickLabel: { ...TYPE.label, color: C.text3, marginBottom: SPACE.xs },
  picker: { flexGrow: 0 },
  gap: { height: SPACE.md },
  chip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.pill,
    backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.border, marginRight: 8,
    minHeight: 46, justifyContent: "center",
  },
  chipOn: { backgroundColor: C.text1, borderColor: C.text1 },
  chipText: { ...TYPE.bodyStrong, fontSize: 15, color: C.text2 },
  chipTextOn: { color: C.bg },
  verdictWord: { ...TYPE.micro, fontSize: 12, marginBottom: 6 },
  verdict: { ...TYPE.title, color: C.text1, marginBottom: 6 },
  verdictAction: { ...TYPE.body, color: C.text2 },
  list: { gap: SPACE.xs },
  listHead: { ...TYPE.label, color: C.text3, marginBottom: SPACE.xs },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14,
    paddingHorizontal: SPACE.md, backgroundColor: C.surface,
    borderRadius: RADIUS.control, borderWidth: 1, borderColor: C.border,
  },
  bar: { width: 5, height: 30, borderRadius: 3 },
  rowKm: { ...TYPE.bodyStrong, color: C.text1, flex: 1 },
  rowWord: { ...TYPE.micro, fontSize: 11 },
  empty: { ...TYPE.body, color: C.text2 },
});
