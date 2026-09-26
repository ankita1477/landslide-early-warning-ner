import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { IconTile, TIER_ICON } from "../components/Icons";
import { ListSkeleton } from "../components/Skeleton";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { Quiet } from "../illustrations/Quiet";
import { history, type WarningEntry } from "../lib/history";
import { C, RADIUS, SPACE, TIER_INK, TIER_WORD, TYPE, type Tier } from "../lib/theme";

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
      <Text style={styles.sub}>Every time the risk on your stretch changes, it is saved here.</Text>

      {past === null && <ListSkeleton rows={4} />}

      {past?.length === 0 && (
        <View style={styles.empty}>
          <Quiet size={120} />
          <Text style={styles.emptyTitle}>All quiet</Text>
          <Text style={styles.emptyBody}>
            No alerts yet. Changes are recorded while you are on NH-10, for the
            stretch you are travelling on.
          </Text>
        </View>
      )}

      {past && past.length > 0 && (
        <View style={styles.group}>
          {past.map((entry, i) => {
            const t = entry.tier as Tier;
            return (
              <View key={entry.at} style={[styles.row, i === past.length - 1 && styles.rowLast]}>
                <IconTile icon={TIER_ICON[t]} tier={t} size={40} />
                <View style={styles.text}>
                  <Text style={[styles.word, { color: TIER_INK[t] }]}>{TIER_WORD[t]}</Text>
                  <Text style={styles.place}>NH-10 · km {entry.km.toFixed(0)}</Text>
                  <Text style={styles.reason}>{entry.reason}</Text>
                </View>
                <Text style={styles.when}>{when(entry.at)}</Text>
              </View>
            );
          })}
        </View>
      )}
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
  screen: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: TABBAR_HEIGHT + SPACE.lg, gap: SPACE.md },
  sub: { ...TYPE.body, color: C.ink2 },
  group: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.line },
  rowLast: { borderBottomWidth: 0 },
  text: { flex: 1, gap: 1 },
  word: { ...TYPE.eyebrow, fontSize: 10.5 },
  place: { ...TYPE.bodyStrong, fontSize: 15.5, lineHeight: 21, color: C.ink },
  reason: { ...TYPE.small, color: C.ink3 },
  when: { ...TYPE.small, ...TYPE.num, color: C.ink3 },
  empty: { alignItems: "center", paddingVertical: SPACE.xl, gap: SPACE.xs },
  emptyTitle: { ...TYPE.h2, color: C.ink, marginTop: SPACE.sm },
  emptyBody: { ...TYPE.body, fontSize: 15, color: C.ink2, textAlign: "center", maxWidth: 300 },
});
