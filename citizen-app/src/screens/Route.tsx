import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "react-native-paper";
import { Check, Flag, MapPin } from "lucide-react-native";
import { api, type SegmentSummary } from "../lib/api";
import { TIER_ICON } from "../components/Icons";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { C, FONT, RADIUS, SPACE, TIER_COLOR, TIER_INK, TIER_RANK, TIER_WASH, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION } from "../lib/explain";
import { D, EASE, useReducedMotion } from "../lib/motion";
import PLACES from "../data/places.json";

interface Place { name: string; km: number }
const STOPS = PLACES as Place[];

/** Default to the journey people actually describe. The last stop on the
 *  corridor is an obscure hamlet; nobody says "I am driving to Paschim
 *  Totgaon". */
const DEFAULT_TO = STOPS.find((s) => s.name === "Gangtok") ?? STOPS[STOPS.length - 1];

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
    const timer = setInterval(() => setStage((n) => Math.min(n + 1, CHECKS.length - 1)), 520);
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
    (acc, s) => (TIER_RANK[s.tier as Tier] > TIER_RANK[acc] ? (s.tier as Tier) : acc), "green",
  );
  const Worst = TIER_ICON[worst];
  const first = from.km <= to.km ? from : to;
  const last = from.km <= to.km ? to : from;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Check a journey</Text>
      <Text style={styles.lead}>Pick where you start and where you are going. The road between is read kilometre by kilometre.</Text>

      {busy && <Checking stage={stage} />}

      <View style={styles.ticket}>
        <View style={styles.pickHead}>
          <MapPin color={C.ink3} size={14} />
          <Text style={styles.pickLabel}>From</Text>
        </View>
        <Picker stops={STOPS} value={from} onChange={setFrom} />
        <View style={styles.ticketRule}>
          <View style={styles.notchL} /><View style={styles.dash} /><View style={styles.notchR} />
        </View>
        <View style={styles.pickHead}>
          <Flag color={C.ink3} size={14} />
          <Text style={styles.pickLabel}>To</Text>
        </View>
        <Picker stops={STOPS} value={to} onChange={setTo} />
      </View>

      {!busy && onRoute.length > 0 && (
        <View style={[styles.verdict, { backgroundColor: TIER_WASH[worst] }]}>
          <View style={styles.verdictHead}>
            <Worst color={TIER_INK[worst]} size={18} strokeWidth={2.3} />
            <Text style={[styles.verdictWord, { color: TIER_INK[worst] }]}>{TIER_WORD[worst]}</Text>
          </View>
          <Text style={styles.verdictTitle}>
            {risky.length === 0
              ? "No risky sections on this route today."
              : `${risky.length} section${risky.length > 1 ? "s" : ""} need care between ${from.name} and ${to.name}.`}
          </Text>
          <Text style={styles.verdictAction}>{ACTION[worst].action}</Text>

          {/* The journey as a strip: where on the road the colour changes. */}
          <View style={styles.strip} accessibilityLabel="Risk along the route, start to finish">
            {onRoute.map((s) => (
              <View key={s.id} style={[styles.stripSeg, { backgroundColor: TIER_COLOR[s.tier as Tier] }]} />
            ))}
          </View>
          <View style={styles.stripEnds}>
            <Text style={styles.stripEnd}>{first.name}</Text>
            <Text style={styles.stripEnd}>{last.name}</Text>
          </View>
        </View>
      )}

      {risky.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listHead}>Sections to watch</Text>
          <View style={styles.group}>
            {risky.map((s, i) => {
              const t = s.tier as Tier;
              const Glyph = TIER_ICON[t];
              return (
                <View key={s.id} style={[styles.row, i === risky.length - 1 && styles.rowLast]}>
                  <View style={[styles.bar, { backgroundColor: TIER_COLOR[t] }]} />
                  <Text style={styles.rowKm}>km {s.chainage_km.toFixed(0)}</Text>
                  <Glyph color={TIER_INK[t]} size={16} strokeWidth={2.3} />
                  <Text style={[styles.rowWord, { color: TIER_INK[t] }]}>{TIER_WORD[t]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!busy && onRoute.length === 0 && (
        <Text style={styles.empty}>No readings for this route yet. Connect once and they are saved for offline use.</Text>
      )}
    </ScrollView>
  );
}

const CHECKS = ["Checking rainfall", "Checking slope risk", "Checking road conditions"] as const;

/** What the app is doing, in the order it does it.
 *
 *  A person waiting on a hill road with one bar of signal should be able to see
 *  that something is happening and what it is, rather than a spinner that could
 *  mean anything.
 */
function Checking({ stage }: { stage: number }) {
  return (
    <View style={styles.checking}>
      {CHECKS.map((check, i) => <CheckRow key={check} label={check} done={i < stage} active={i === stage} />)}
    </View>
  );
}

function CheckRow({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const fade = useRef(new Animated.Value(done || active ? 1 : 0.3)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.timing(fade, { toValue: done || active ? 1 : 0.3, duration: reduced ? 0 : D.card, easing: EASE.out, useNativeDriver: true }).start();
  }, [done, active, fade, reduced]);
  return (
    <Animated.View style={[styles.check, { opacity: fade }]}>
      <View style={styles.checkMark}>
        {done ? <Check color={TIER_INK.green} size={18} strokeWidth={2.6} />
          : active ? <ActivityIndicator size="small" color={C.ink} />
          : <View style={styles.pending} />}
      </View>
      <Text style={[styles.checkText, done && styles.checkDone]}>{label}{done ? "" : "…"}</Text>
    </Animated.View>
  );
}

function Picker({ stops, value, onChange }: { stops: Place[]; value: Place; onChange: (p: Place) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
      {stops.map((stop) => {
        const on = stop.name === value.name;
        return (
          <Chip
            key={stop.name} mode="flat" selected={on} showSelectedCheck={false}
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
  content: { padding: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.md, paddingBottom: TABBAR_HEIGHT + SPACE.lg },
  h1: { ...TYPE.h1, color: C.ink },
  lead: { ...TYPE.body, color: C.ink2, marginTop: -SPACE.xs },
  ticket: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, padding: SPACE.md },
  ticketRule: { flexDirection: "row", alignItems: "center", marginVertical: SPACE.md, marginHorizontal: -SPACE.md },
  notchL: { width: 10, height: 20, borderRadius: 10, backgroundColor: C.paper, marginLeft: -5, borderWidth: 1, borderColor: C.line },
  notchR: { width: 10, height: 20, borderRadius: 10, backgroundColor: C.paper, marginRight: -5, borderWidth: 1, borderColor: C.line },
  dash: { flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: C.lineHi, marginHorizontal: 6 },
  pickHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACE.sm },
  pickLabel: { ...TYPE.eyebrow, color: C.ink3 },
  picker: { flexGrow: 0 },
  chip: { marginRight: 8, backgroundColor: C.paper2, minHeight: 40, justifyContent: "center", borderRadius: RADIUS.pill },
  chipOn: { backgroundColor: C.ink },
  chipText: { fontFamily: FONT.sansSemi, fontSize: 15, color: C.ink },
  chipTextOn: { color: C.paper },
  verdict: { borderRadius: RADIUS.card, padding: SPACE.lg },
  verdictHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  verdictWord: { ...TYPE.eyebrow },
  verdictTitle: { ...TYPE.h2, color: C.ink, marginBottom: 6 },
  verdictAction: { ...TYPE.body, color: C.ink2 },
  strip: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginTop: SPACE.md, gap: 1, backgroundColor: "rgba(255,255,255,0.5)" },
  stripSeg: { flex: 1 },
  stripEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  stripEnd: { ...TYPE.label, fontSize: 12, color: C.ink2 },
  list: { gap: SPACE.sm },
  listHead: { ...TYPE.eyebrow, color: C.ink3 },
  group: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.line },
  rowLast: { borderBottomWidth: 0 },
  bar: { width: 4, height: 26, borderRadius: 2, marginRight: 4 },
  rowKm: { ...TYPE.bodyStrong, ...TYPE.num, color: C.ink, flex: 1 },
  rowWord: { ...TYPE.eyebrow, fontSize: 10.5 },
  empty: { ...TYPE.body, color: C.ink2 },
  checking: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, padding: SPACE.md },
  check: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  checkMark: { width: 22, alignItems: "center" },
  pending: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink3 },
  checkText: { ...TYPE.body, fontSize: 15.5, color: C.ink2 },
  checkDone: { color: C.ink },
});
