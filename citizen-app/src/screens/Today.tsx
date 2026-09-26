import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Location from "expo-location";
import { ArrowRight, ChevronRight, Clock3, LifeBuoy, MapPin, WifiOff } from "lucide-react-native";
import { api, ageLabel, type Cached, type PointRisk, type SegmentDetail, type SegmentSummary } from "../lib/api";
import { Button } from "../components/Button";
import { Reason, TIER_ICON } from "../components/Icons";
import { RiskSkeleton } from "../components/Skeleton";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { Hillside } from "../illustrations/Hillside";
import { record } from "../lib/history";
import { ACTION, NEAR_ROAD_M, SITUATION, SITUATION_THERE, distanceLabel, headline, reasons } from "../lib/explain";
import { PULSE, useReducedMotion } from "../lib/motion";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_INK, TIER_RANK, TIER_WASH, TIER_WORD, TYPE, type Tier } from "../lib/theme";

// The middle of the first segment, km 0, where NH-10 leaves Sevoke. Not the
// town's centre: that sits about 3 km along the road and would show km 3 under
// a line that says "where the road starts".
const SEVOKE = { lat: 26.8800, lon: 88.4719 };

/** The one screen most people will ever open: where they are, what the
 *  hillside above them is doing, and what to do about it. */
export function Today({ onRoute, onSafety, onEscalation }: {
  onRoute: () => void;
  onSafety: () => void;
  onEscalation: (w: { tier: Tier; km: number; reason: string }) => void;
}) {
  const [point, setPoint] = useState<Cached<PointRisk> | null>(null);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [corridor, setCorridor] = useState<SegmentSummary[]>([]);
  // "here": on the corridor. "far": location known, but nowhere near NH-10.
  // "off": no location. Only "here" may be spoken about as the person's own stretch.
  const [where, setWhere] = useState<"here" | "far" | "off">("off");
  const [farBy, setFarBy] = useState(0);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    let position: { lat: number; lon: number } | null = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const fix = await Location.getCurrentPositionAsync({});
        position = { lat: fix.coords.latitude, lon: fix.coords.longitude };
      }
    } catch {
      // Location refused or unavailable; the corridor start still gives a real answer.
    }
    try {
      let result = await api.nearby((position ?? SEVOKE).lat, (position ?? SEVOKE).lon);
      if (!position) {
        setWhere("off");
      } else if (result.data.distance_to_segment_m <= NEAR_ROAD_M) {
        setWhere("here");
      } else {
        // Nowhere near the road. The nearest segment to someone in another
        // state is an arbitrary one, so show where the road starts instead,
        // and say how far away they are.
        setFarBy(result.data.distance_to_segment_m);
        setWhere("far");
        result = await api.nearby(SEVOKE.lat, SEVOKE.lon);
      }
      setPoint(result);
      const full = await api.segment(result.data.segment.id);
      setDetail(full.data);
      // History and the banner are about the stretch the person is on. A
      // reading of Sevoke shown to someone in another state is context, not
      // their stretch, so it is neither recorded nor announced.
      if (position && result.data.distance_to_segment_m <= NEAR_ROAD_M) {
        const band = result.data.segment.tier as Tier;
        const km = result.data.segment.chainage_km;
        const reason = headline(full.data.components, band);
        const { escalated } = await record(band, km, reason);
        // The banner is for the moment conditions worsen. Anything else is
        // already on the screen below it and does not need to interrupt anyone.
        if (escalated) onEscalation({ tier: band, km, reason });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
    // The whole road, for the strip further down. Its failure is silent: the
    // strip is context, not the answer.
    try {
      const all = await api.corridor();
      setCorridor([...all.data.segments].sort((a, b) => a.chainage_km - b.chainage_km));
    } catch { /* strip stays empty */ }
  }, [onEscalation]);

  useEffect(() => { void load(); }, [load]);

  const tier = (point?.data.segment.tier ?? "green") as Tier;
  const Glyph = TIER_ICON[tier];
  const careful = corridor.filter((s) => TIER_RANK[s.tier as Tier] >= 2).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.ink2} />}
    >
      {busy && !point && <RiskSkeleton />}

      {point && (
        <View style={[styles.hero, { backgroundColor: TIER_WASH[tier] }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.eyebrow, { color: TIER_INK[tier] }]}>
              {where === "here"
                ? `Your stretch · NH-10 km ${point.data.segment.chainage_km.toFixed(0)}`
                : "Sevoke · start of NH-10"}
            </Text>
            <Badge tier={tier} />
          </View>

          <View style={styles.art}>
            <Hillside tier={tier} width={Math.min(width - SPACE.lg * 2, 400)} />
          </View>

          <Text style={styles.display}>{(where === "here" ? SITUATION : SITUATION_THERE)[tier].headline}</Text>
          <Text style={styles.sub}>{(where === "here" ? SITUATION : SITUATION_THERE)[tier].sub}</Text>

          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <MapPin color={C.ink2} size={14} />
              <Text style={styles.metaText}>
                {where === "here"
                  ? `${distanceLabel(point.data.distance_to_segment_m)} from you`
                  : where === "far"
                    ? `You are ${distanceLabel(farBy)} from NH-10 — showing Sevoke, where the road starts`
                    : "Showing Sevoke — turn on location for your own position"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Clock3 color={C.ink2} size={14} />
              <Text style={styles.metaText}>Updated {ageLabel(point.fetchedAt)}</Text>
            </View>
          </View>
        </View>
      )}

      {point?.stale && (
        <Notice icon={<WifiOff color={C.ink2} size={18} />}
                title="Saved reading"
                body={`You are offline. This is from ${ageLabel(point.fetchedAt)} and conditions may have changed. Pull down to refresh.`} />
      )}
      {failed && !point && (
        <Notice icon={<WifiOff color={TIER_INK.red} size={18} />}
                title="Cannot check right now"
                body="No connection and nothing saved yet. Pull down to try again." />
      )}

      {point && (
        <View style={styles.section}>
          <Text style={styles.h2}>{ACTION[tier].label}</Text>
          <Text style={styles.body}>{ACTION[tier].action}</Text>
        </View>
      )}

      {detail && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>{tier === "green" ? "Why it is safe" : "Why you are seeing this"}</Text>
          {reasons(detail.components, tier).map((r, i) => (
            <View key={r.text} style={[styles.row, i > 0 && styles.rowLine]}>
              <Reason icon={r.icon} color={TIER_INK[tier]} />
              <Text style={styles.rowText}>{r.text}</Text>
            </View>
          ))}
        </View>
      )}

      {corridor.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>The whole road today</Text>
          <View style={styles.strip} accessibilityLabel="Risk along NH-10, Sevoke to Gangtok">
            {corridor.map((s) => (
              <View key={s.id} style={[styles.stripSeg, { backgroundColor: TIER_COLOR[s.tier as Tier] }]} />
            ))}
          </View>
          <View style={styles.stripEnds}>
            <Text style={styles.stripEnd}>Sevoke</Text>
            <Text style={styles.stripEnd}>Gangtok</Text>
          </View>
          <Text style={styles.body}>
            {careful === 0
              ? "No section of the road needs special care today."
              : `${careful} of ${corridor.length} sections need care today.`}
          </Text>
        </View>
      )}

      {point && (
        <View style={styles.actions}>
          <Button label="Check my route" onPress={onRoute} icon={ArrowRight} />
          <Pressable onPress={onSafety} style={styles.link} accessibilityRole="button">
            <LifeBuoy color={C.ink} size={18} strokeWidth={1.9} />
            <Text style={styles.linkText}>What to do before, during and after a landslide</Text>
            <ChevronRight color={C.ink3} size={18} />
          </Pressable>
        </View>
      )}

      <Text style={styles.foot}>
        Risk is checked every day using satellite rainfall and terrain data.
        This is advice — always follow the police and local administration.
      </Text>
    </ScrollView>
  );
}

/** The band as a word with a beating dot. Green barely moves; red is quick
 *  but never flashes — a strobing screen is harder to read and frightening
 *  rather than informative. */
function Badge({ tier }: { tier: Tier }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const Glyph = TIER_ICON[tier];

  useEffect(() => {
    const beat = PULSE[tier];
    if (!beat || reduced) { pulse.setValue(1); return; }
    const half = beat.duration / 2;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: beat.to, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tier, pulse, reduced]);

  return (
    <View style={styles.badge}>
      <Animated.View style={[styles.dot, { backgroundColor: TIER_COLOR[tier], opacity: pulse }]} />
      <Glyph color={TIER_INK[tier]} size={14} strokeWidth={2.4} />
      <Text style={[styles.badgeWord, { color: TIER_INK[tier] }]}>{TIER_WORD[tier]}</Text>
    </View>
  );
}

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.notice}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.small}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: TABBAR_HEIGHT + SPACE.lg },
  hero: {
    marginHorizontal: SPACE.sm, borderRadius: 26, padding: SPACE.lg, paddingTop: SPACE.md,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  eyebrow: { ...TYPE.eyebrow, flex: 1 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.7)",
    paddingVertical: 6, paddingHorizontal: 11, borderRadius: RADIUS.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeWord: { ...TYPE.eyebrow, fontSize: 11 },
  art: { alignItems: "center", marginVertical: -4 },
  display: { ...TYPE.display, color: C.ink, marginTop: SPACE.xs },
  sub: { ...TYPE.body, fontSize: 17, lineHeight: 25, color: C.ink2, marginTop: SPACE.xs },
  meta: { marginTop: SPACE.md, gap: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  metaText: { ...TYPE.small, color: C.ink2 },
  notice: {
    flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start", marginHorizontal: SPACE.lg,
    marginTop: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.control, backgroundColor: C.paper2,
  },
  noticeTitle: { ...TYPE.bodyStrong, color: C.ink, marginBottom: 2 },
  section: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  sectionEyebrow: { ...TYPE.eyebrow, color: C.ink3, marginBottom: SPACE.xs },
  h2: { ...TYPE.h2, color: C.ink, marginBottom: SPACE.xs },
  body: { ...TYPE.body, color: C.ink2 },
  small: { ...TYPE.small, color: C.ink2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
  rowText: { ...TYPE.body, color: C.ink, flex: 1 },
  strip: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 1, backgroundColor: C.paper2, marginTop: SPACE.xs },
  stripSeg: { flex: 1 },
  stripEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: SPACE.sm },
  stripEnd: { ...TYPE.label, fontSize: 12, color: C.ink3 },
  actions: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: SPACE.sm },
  link: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: SPACE.md,
    backgroundColor: C.white, borderRadius: RADIUS.control, borderWidth: 1, borderColor: C.line,
  },
  linkText: { ...TYPE.bodyStrong, fontSize: 15, color: C.ink, flex: 1 },
  foot: { ...TYPE.small, color: C.ink3, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
});
