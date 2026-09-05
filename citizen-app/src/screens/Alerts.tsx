import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { ListSkeleton } from "../components/Skeleton";
import { history, type WarningEntry } from "../lib/history";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WORD, TYPE, type Tier } from "../lib/theme";

/** Every warning this phone has shown, newest first.
 *
 *  The service keeps only the current run, so a history cannot be fetched — what
 *  the app can honestly show is what it has itself displayed. The empty state
 *  says so rather than pretending the list is a complete record.
 */
export function Alerts() {
  const [past, setPast] = useState<WarningEntry[] | null>(null);

  const load = useCallback(async () => setPast(await history()), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Alerts</Text>
      <Text style={styles.sub}>
        Every time the risk on your stretch changes, it is saved here.
      </Text>

      {past === null && <ListSkeleton rows={4} />}

      {past?.length === 0 && (
        <Card>
          <Text style={styles.empty}>
            No alerts yet. Keep the app installed and it will record each change
            for the road you travel on.
          </Text>
        </Card>
      )}

      {past?.map((entry) => (
        <Card key={entry.at} style={styles.row}>
          <View style={[styles.bar, { backgroundColor: TIER_COLOR[entry.tier as Tier] }]} />
          <View style={styles.text}>
            <Text style={[styles.word, { color: TIER_COLOR[entry.tier as Tier] }]}>
              {TIER_WORD[entry.tier as Tier]}
            </Text>
            <Text style={styles.place}>NH-10 · km {entry.km.toFixed(0)}</Text>
            <Text style={styles.reason}>{entry.reason}</Text>
          </View>
          <Text style={styles.when}>{when(entry.at)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

/** Relative for anything recent, a date once it stops being "today". */
function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xl },
  h1: { ...TYPE.hero, fontSize: 28, color: C.text1 },
  sub: { ...TYPE.body, color: C.text2, marginBottom: SPACE.xs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  bar: { width: 5, height: 46, borderRadius: 3 },
  text: { flex: 1, gap: 1 },
  word: { ...TYPE.micro, fontSize: 10.5 },
  place: { ...TYPE.bodyStrong, fontSize: 15.5, color: C.text1 },
  reason: { fontSize: 13, lineHeight: 18, color: C.text3 },
  when: { fontSize: 12, color: C.text3 },
  empty: { ...TYPE.body, color: C.text2 },
});
