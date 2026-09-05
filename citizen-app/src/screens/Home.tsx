import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { api, ageLabel, type Cached, type PointRisk, type SegmentDetail } from "../lib/api";
import { RiskHero } from "../components/RiskHero";
import { WhyCard } from "../components/WhyCard";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { RiskSkeleton } from "../components/Skeleton";
import { record } from "../lib/history";
import { headline } from "../lib/explain";
import { C, SPACE, TYPE, type Tier } from "../lib/theme";

const SEVOKE = { lat: 26.9, lon: 88.47 };

export function Home({ onRoute, onMap, onReport, onEscalation }: {
  onRoute: () => void;
  onMap: () => void;
  onReport: () => void;
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
            <Card tint="rgba(234,179,8,0.12)">
              <Text style={styles.staleTitle}>Saved reading</Text>
              <Text style={styles.staleBody}>
                You are offline. This is from {ageLabel(point.fetchedAt)} and conditions
                may have changed. Pull down to refresh.
              </Text>
            </Card>
          )}

          {detail && <WhyCard factors={detail.components} tier={tier} />}

          <Button label="See the map" onPress={onMap} kind="secondary" />
          <Button label="Report a problem" onPress={onReport} kind="secondary" />
        </>
      )}

      {failed && !point && (
        <Card tint="rgba(239,68,68,0.12)">
          <Text style={styles.staleTitle}>Cannot check right now</Text>
          <Text style={styles.staleBody}>
            No connection and nothing saved yet. Pull down to try again.
          </Text>
        </Card>
      )}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Risk is checked every day using satellite rainfall and terrain data.
          This is advice — always follow the police and local administration.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  staleTitle: { ...TYPE.bodyStrong, color: C.text1, marginBottom: 4 },
  staleBody: { ...TYPE.body, fontSize: 14.5, color: C.text2 },
  note: { marginTop: SPACE.sm },
  noteText: { fontSize: 12.5, lineHeight: 19, color: C.text3 },
});
