import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Camera, LifeBuoy, Map, Route as RouteIcon, WifiOff, type LucideIcon } from "lucide-react-native";
import { api, ageLabel, type Cached, type PointRisk, type SegmentDetail } from "../lib/api";
import { RiskHero } from "../components/RiskHero";
import { WhyCard } from "../components/WhyCard";
import { Card } from "../components/Card";
import { RiskSkeleton } from "../components/Skeleton";
import { record } from "../lib/history";
import { headline } from "../lib/explain";
import { C, RADIUS, SPACE, TYPE, type Tier } from "../lib/theme";

const SEVOKE = { lat: 26.9, lon: 88.47 };

export function Home({ onRoute, onMap, onReport, onSafety, onEscalation }: {
  onRoute: () => void;
  onMap: () => void;
  onReport: () => void;
  onSafety: () => void;
  onEscalation: (w: { tier: Tier; km: number; reason: string }) => void;
}) {
  const [point, setPoint] = useState<Cached<PointRisk> | null>(null);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [located, setLocated] = useState(false);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    let { lat, lon } = SEVOKE;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        setLocated(true);
      }
    } catch {
      // Location refused or unavailable; the corridor start still gives a real answer.
    }
    try {
      const result = await api.nearby(lat, lon);
      setPoint(result);
      const full = await api.segment(result.data.segment.id);
      setDetail(full.data);
      const band = result.data.segment.tier as Tier;
      const km = result.data.segment.chainage_km;
      const reason = headline(full.data.components, band);
      const { escalated } = await record(band, km, reason);
      // The banner is for the moment conditions worsen. Anything else is
      // already on the card below it and does not need to interrupt anyone.
      if (escalated) onEscalation({ tier: band, km, reason });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [onEscalation]);

  useEffect(() => { void load(); }, [load]);

  const tier = (point?.data.segment.tier ?? "green") as Tier;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.text2} />}
    >
      {busy && !point && <RiskSkeleton />}

      {point && (
        <>
          <RiskHero
            tier={tier}
            place={`NH-10, km ${point.data.segment.chainage_km.toFixed(0)}`}
            subtitle={
              located
                ? `${Math.round(point.data.distance_to_segment_m)} m from you`
                : "Showing Sevoke — turn on location for your own position"
            }
            updated={ageLabel(point.fetchedAt)}
            onRoute={onRoute}
          />

          {point.stale && (
            <Card tint="rgba(234,179,8,0.10)" style={styles.notice}>
              <WifiOff color={C.yellow} size={20} />
              <View style={styles.noticeText}>
                <Text style={styles.staleTitle}>Saved reading</Text>
                <Text style={styles.staleBody}>
                  You are offline. This is from {ageLabel(point.fetchedAt)} and conditions
                  may have changed. Pull down to refresh.
                </Text>
              </View>
            </Card>
          )}

          {detail && <WhyCard factors={detail.components} tier={tier} />}
        </>
      )}

      {failed && !point && (
        <Card tint="rgba(239,68,68,0.10)" style={styles.notice}>
          <WifiOff color={C.red} size={20} />
          <View style={styles.noticeText}>
            <Text style={styles.staleTitle}>Cannot check right now</Text>
            <Text style={styles.staleBody}>
              No connection and nothing saved yet. Pull down to try again.
            </Text>
          </View>
        </Card>
      )}

      <Text style={styles.eyebrow}>Quick actions</Text>
      <View style={styles.grid}>
        <Action icon={RouteIcon} label="Check a route" note="Sevoke to Gangtok and beyond" onPress={onRoute} />
        <Action icon={Map} label="See the road" note="Every kilometre, coloured" onPress={onMap} />
        <Action icon={Camera} label="Report a problem" note="Warn the people behind you" onPress={onReport} />
        <Action icon={LifeBuoy} label="Safety guide" note="Before, during and after" onPress={onSafety} />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Risk is checked every day using satellite rainfall and terrain data.
          This is advice — always follow the police and local administration.
        </Text>
      </View>
    </ScrollView>
  );
}

function Action({ icon: Glyph, label, note, onPress }: {
  icon: LucideIcon; label: string; note: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionGlyph}>
        <Glyph color={C.text1} size={22} strokeWidth={1.9} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionNote}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  notice: { flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" },
  noticeText: { flex: 1 },
  staleTitle: { ...TYPE.bodyStrong, color: C.text1, marginBottom: 2 },
  staleBody: { ...TYPE.body, fontSize: 14.5, lineHeight: 21, color: C.text2 },
  eyebrow: { ...TYPE.eyebrow, color: C.text3, marginTop: SPACE.xs, marginBottom: -SPACE.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  action: {
    width: "48%", flexGrow: 1, backgroundColor: C.surface, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.border, padding: SPACE.md, gap: 3, minHeight: 124,
  },
  actionPressed: { backgroundColor: C.surfaceHi, borderColor: C.borderHi },
  actionGlyph: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.surfaceHi,
    alignItems: "center", justifyContent: "center", marginBottom: SPACE.sm,
  },
  actionLabel: { ...TYPE.bodyStrong, fontSize: 15.5, lineHeight: 20, color: C.text1 },
  actionNote: { fontSize: 12.5, lineHeight: 17, color: C.text3 },
  note: { marginTop: SPACE.sm },
  noteText: { fontSize: 12.5, lineHeight: 19, color: C.text3 },
});
