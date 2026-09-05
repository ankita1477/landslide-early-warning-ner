import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "react-native-paper";
import { Check, Flag, MapPin } from "lucide-react-native";
import { api, type SegmentSummary } from "../lib/api";
import { Card } from "../components/Card";
import { TIER_ICON } from "../components/Icons";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_RANK, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION } from "../lib/explain";
import { D, EASE, useReducedMotion } from "../lib/motion";
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
  const [stage, setStage] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    setStage(0);
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

  // The checks are named as they run. They are not invented delays: the timer
  // only walks the labels forward while the request is genuinely outstanding,
  // and the screen moves on the moment the readings land.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setStage((n) => Math.min(n + 1, CHECKS.length - 1)),
      520,
    );
    return () => clearInterval(timer);
  }, [busy]);

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
  const Worst = TIER_ICON[worst];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Check my route</Text>

      {busy && <Checking stage={stage} />}

      <Card>
        <View style={styles.pickHead}>
          <MapPin color={C.text3} size={14} />
          <Text style={styles.pickLabel}>Starting from</Text>
        </View>
        <Picker stops={STOPS} value={from} onChange={setFrom} />
        <View style={styles.gap} />
        <View style={styles.pickHead}>
          <Flag color={C.text3} size={14} />
          <Text style={styles.pickLabel}>Going to</Text>
        </View>
        <Picker stops={STOPS} value={to} onChange={setTo} />
      </Card>

      {!busy && onRoute.length > 0 && (
        <Card tint={`${TIER_COLOR[worst]}1A`} style={{ borderColor: `${TIER_COLOR[worst]}55` }}>
          <View style={styles.verdictHead}>
            <Worst color={TIER_COLOR[worst]} size={18} strokeWidth={2.3} />
            <Text style={[styles.verdictWord, { color: TIER_COLOR[worst] }]}>{TIER_WORD[worst]}</Text>
          </View>
          <Text style={styles.verdict}>
            {risky.length === 0
              ? "No risky sections on this route today."
              : `${risky.length} section${risky.length > 1 ? "s" : ""} need care between ${from.name} and ${to.name}.`}
          </Text>
          <Text style={styles.verdictAction}>{ACTION[worst].action}</Text>

          {/* The journey as a strip: where on the road the colour changes. */}
          <View style={styles.strip} accessibilityLabel="Risk along the route, start to finish">
            {onRoute.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.stripSeg,
                  { backgroundColor: TIER_COLOR[s.tier as Tier], opacity: TIER_RANK[s.tier as Tier] >= 2 ? 1 : 0.55 },
                ]}
              />
            ))}
          </View>
          <View style={styles.stripEnds}>
            <Text style={styles.stripEnd}>{Math.min(from.km, to.km) === from.km ? from.name : to.name}</Text>
            <Text style={styles.stripEnd}>{Math.min(from.km, to.km) === from.km ? to.name : from.name}</Text>
          </View>
        </Card>
      )}

      {risky.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listHead}>Sections to watch</Text>
          {risky.map((s) => {
            const t = s.tier as Tier;
            const Glyph = TIER_ICON[t];
            return (
              <View key={s.id} style={styles.row}>
                <View style={[styles.bar, { backgroundColor: TIER_COLOR[t] }]} />
                <Text style={styles.rowKm}>km {s.chainage_km.toFixed(0)}</Text>
                <Glyph color={TIER_COLOR[t]} size={16} strokeWidth={2.3} />
                <Text style={[styles.rowWord, { color: TIER_COLOR[t] }]}>{TIER_WORD[t]}</Text>
              </View>
            );
          })}
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

const CHECKS = [
  "Checking rainfall",
  "Checking slope risk",
  "Checking road conditions",
] as const;

/** What the app is doing, in the order it does it.
 *
 *  A person waiting on a hill road with one bar of signal should be able to see
 *  that something is happening and what it is, rather than a spinner that could
 *  mean anything.
 */
function Checking({ stage }: { stage: number }) {
  return (
    <Card>
      {CHECKS.map((check, i) => (
        <CheckRow key={check} label={check} done={i < stage} active={i === stage} />
      ))}
    </Card>
  );
}

function CheckRow({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const fade = useRef(new Animated.Value(done || active ? 1 : 0.3)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(fade, {
      toValue: done || active ? 1 : 0.3,
      duration: reduced ? 0 : D.card,
      easing: EASE.out,
      useNativeDriver: true,
    }).start();
  }, [done, active, fade, reduced]);

  return (
    <Animated.View style={[styles.check, { opacity: fade }]}>
      <View style={styles.checkMark}>
        {done ? (
          <Check color={C.green} size={18} strokeWidth={2.6} />
        ) : active ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : (
          <View style={styles.pending} />
        )}
      </View>
      <Text style={[styles.checkText, done && styles.checkDone]}>
        {label}{done ? "" : "…"}
      </Text>
    </Animated.View>
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
          <Chip
            key={stop.name}
            mode="outlined"
            selected={on}
            showSelectedCheck={false}
            onPress={() => onChange(stop)}
            style={[styles.chip, on && styles.chipOn]}
            textStyle={[styles.chipText, on && styles.chipTextOn]}
            accessibilityState={{ selected: on }}
          >
            {stop.name}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  h1: { ...TYPE.hero, fontSize: 28, color: C.text1 },
  pickHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACE.sm },
  pickLabel: { ...TYPE.eyebrow, color: C.text3 },
  picker: { flexGrow: 0 },
  gap: { height: SPACE.md },
  chip: { marginRight: 8, backgroundColor: C.surfaceHi, borderColor: C.border, minHeight: 42, justifyContent: "center" },
  chipOn: { backgroundColor: C.text1, borderColor: C.text1 },
  chipText: { ...TYPE.bodyStrong, fontSize: 15, color: C.text2 },
  chipTextOn: { color: C.bg },
  verdictHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  verdictWord: { ...TYPE.eyebrow },
  verdict: { ...TYPE.title, color: C.text1, marginBottom: 6 },
  verdictAction: { ...TYPE.body, color: C.text2 },
  strip: {
    flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden",
    marginTop: SPACE.md, gap: 1, backgroundColor: C.surfaceHi,
  },
  stripSeg: { flex: 1 },
  stripEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  stripEnd: { fontSize: 12, color: C.text3, fontWeight: "600" },
  list: { gap: SPACE.xs },
  listHead: { ...TYPE.eyebrow, color: C.text3, marginBottom: SPACE.xs },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14,
    paddingHorizontal: SPACE.md, backgroundColor: C.surface,
    borderRadius: RADIUS.control, borderWidth: 1, borderColor: C.border,
  },
  bar: { width: 4, height: 28, borderRadius: 2, marginRight: 4 },
  rowKm: { ...TYPE.bodyStrong, ...TYPE.num, color: C.text1, flex: 1 },
  rowWord: { ...TYPE.eyebrow, fontSize: 10.5 },
  empty: { ...TYPE.body, color: C.text2 },
  check: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  checkMark: { width: 22, alignItems: "center" },
  pending: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: C.text3 },
  checkText: { ...TYPE.body, fontSize: 15.5, color: C.text2 },
  checkDone: { color: C.text1 },
});
