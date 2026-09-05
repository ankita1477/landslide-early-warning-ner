import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import * as Location from "expo-location";
import { api, ageLabel, type Cached, type PointRisk } from "../lib/api";
import { RiskCard } from "../components/RiskCard";
import { COLORS } from "../lib/theme";

// Sevoke, the southern end of the corridor. Used when location is refused, so
// the screen still shows something real rather than an error.
const FALLBACK = { lat: 26.9, lon: 88.47, label: "Sevoke (default)" };

export function NearMe() {
  const [state, setState] = useState<Cached<PointRisk> | null>(null);
  const [where, setWhere] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    let lat = FALLBACK.lat;
    let lon = FALLBACK.lon;
    let label = FALLBACK.label;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        label = "your location";
      }
    } catch {
      // Location denied or unavailable — the fallback still gives a real answer.
    }
    setWhere(label);
    try {
      setState(await api.nearby(lat, lon));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={COLORS.text2} />}
    >
      <Text style={styles.eyebrow}>Nearest stretch of NH-10</Text>

      {busy && !state && <ActivityIndicator color={COLORS.text2} style={styles.spinner} />}

      {state && (
        <>
          <RiskCard
            tier={state.data.segment.tier}
            km={state.data.segment.chainage_km}
            distanceM={state.data.distance_to_segment_m}
          />
          {state.stale ? (
            <View style={styles.offline}>
              <Text style={styles.offlineTitle}>Showing a saved reading</Text>
              <Text style={styles.offlineBody}>
                No connection. This is from {ageLabel(state.fetchedAt)} and conditions
                may have changed. Pull down to try again.
              </Text>
            </View>
          ) : (
            <Text style={styles.fresh}>Updated {ageLabel(state.fetchedAt)} · {where}</Text>
          )}
        </>
      )}

      {error && !state && (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Cannot reach the service</Text>
          <Text style={styles.offlineBody}>
            No saved reading is available either. Pull down to retry.
          </Text>
        </View>
      )}

      <Text style={styles.footnote}>
        Risk is scored daily from satellite data for every kilometre between
        Sevoke and Gangtok. It is advice, not an instruction — follow the police
        and district administration on the ground.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, gap: 14 },
  eyebrow: {
    color: COLORS.text3, fontSize: 11, letterSpacing: 1.3,
    textTransform: "uppercase", fontWeight: "700",
  },
  spinner: { marginTop: 40 },
  fresh: { color: COLORS.text3, fontSize: 12 },
  offline: {
    backgroundColor: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.35)",
    borderWidth: 1, borderRadius: 12, padding: 14, gap: 5,
  },
  offlineTitle: { color: COLORS.yellow, fontWeight: "700", fontSize: 13.5 },
  offlineBody: { color: COLORS.text2, fontSize: 12.5, lineHeight: 18 },
  error: {
    backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.35)",
    borderWidth: 1, borderRadius: 12, padding: 14, gap: 5,
  },
  errorTitle: { color: COLORS.red, fontWeight: "700", fontSize: 13.5 },
  footnote: {
    color: COLORS.text3, fontSize: 11.5, lineHeight: 17, marginTop: 8,
  },
});
