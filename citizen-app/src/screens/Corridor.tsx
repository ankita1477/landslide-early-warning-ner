import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, ageLabel, type Cached, type SegmentSummary } from "../lib/api";
import { COLORS, TIER_ADVICE, TIER_COLOR, TIER_RANK, type Tier } from "../lib/theme";

/** The whole road, worst first — for someone deciding whether to travel at all,
 *  rather than where they happen to be standing. */
export function Corridor() {
  const [state, setState] = useState<Cached<{ segments: SegmentSummary[] }> | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setState(await api.corridor());
    } catch {
      // Nothing cached and nothing reachable; the empty state below covers it.
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const segments = [...(state?.data.segments ?? [])].sort(
    (a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.risk - a.risk,
  );
  const worst = segments.filter((s) => s.tier === "orange" || s.tier === "red");

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={segments}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={COLORS.text2} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Sevoke to Gangtok</Text>
          <Text style={styles.summary}>
            {worst.length > 0
              ? `${worst.length} of ${segments.length} kilometres need care today`
              : segments.length > 0
                ? "No stretch is above watch level today"
                : "No readings available"}
          </Text>
          {state?.stale && (
            <Text style={styles.stale}>
              Saved copy from {ageLabel(state.fetchedAt)} — no connection
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.bar, { backgroundColor: TIER_COLOR[item.tier] }]} />
          <View style={styles.rowText}>
            <Text style={styles.km}>km {item.chainage_km.toFixed(1)}</Text>
            <Text style={styles.advice} numberOfLines={1}>
              {TIER_ADVICE[item.tier as Tier].advice}
            </Text>
          </View>
          {/* Written, never the dot alone. */}
          <Text style={[styles.band, { color: TIER_COLOR[item.tier] }]}>
            {TIER_ADVICE[item.tier as Tier].title}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        !busy ? (
          <Text style={styles.empty}>
            No readings yet. Connect once and the last set is kept for offline use.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingTop: 6 },
  header: { paddingVertical: 12, gap: 6 },
  eyebrow: {
    color: COLORS.text3, fontSize: 11, letterSpacing: 1.3,
    textTransform: "uppercase", fontWeight: "700",
  },
  summary: { color: COLORS.text1, fontSize: 18, fontWeight: "600", lineHeight: 25 },
  stale: { color: COLORS.yellow, fontSize: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  bar: { width: 4, height: 34, borderRadius: 2 },
  rowText: { flex: 1, gap: 2 },
  km: { color: COLORS.text1, fontSize: 15, fontWeight: "600" },
  advice: { color: COLORS.text3, fontSize: 11.5 },
  band: { fontSize: 12, fontWeight: "700" },
  empty: { color: COLORS.text3, fontSize: 13, lineHeight: 20, paddingTop: 30 },
});
