import { useCallback, useEffect, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import * as Location from "expo-location";
import { CATEGORIES, queued, submit, type Category, type Report as Queued } from "../lib/reports";
import { COLORS } from "../lib/theme";

/** Reporting is not decoration. A sparse landslide inventory is the binding
 *  constraint on the whole system — only 175 mapped scars train the model — and
 *  moderated citizen reports are how that inventory grows. */
export function Report() {
  const [category, setCategory] = useState<Category>("crack");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Queued[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async () => setPending(await queued()), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const send = async () => {
    let lat: number | null = null;
    let lon: number | null = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      }
    } catch {
      // A report without coordinates is still worth keeping.
    }
    await submit(category, note, lat, lon);
    setNote("");
    setJustSaved(true);
    await refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Report what you can see</Text>
      <Text style={styles.lede}>
        Cracks, seeping water and small slips are what comes before a landslide.
        Reporting them helps warn the people behind you.
      </Text>

      <View style={styles.options}>
        {CATEGORIES.map((option) => {
          const on = option.key === category;
          return (
            <Pressable
              key={option.key}
              onPress={() => setCategory(option.key)}
              style={[styles.option, on && styles.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                {option.label}
              </Text>
              <Text style={styles.optionHelp}>{option.help}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Anything else worth knowing (optional)"
        placeholderTextColor={COLORS.text3}
        value={note}
        onChangeText={(text) => { setNote(text); setJustSaved(false); }}
        multiline
      />

      <Pressable style={styles.submit} onPress={send} accessibilityRole="button">
        <Text style={styles.submitText}>Save report</Text>
      </Pressable>

      {justSaved && (
        <View style={styles.saved}>
          <Text style={styles.savedTitle}>Saved on this phone</Text>
          <Text style={styles.savedBody}>
            It will be sent when reporting opens. Nothing has been transmitted yet.
          </Text>
        </View>
      )}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Reports are not being received yet</Text>
        <Text style={styles.savedBody}>
          The service has no endpoint to accept them, so reports are kept on this
          phone rather than discarded or pretended to be sent.
          {pending.length > 0 ? ` ${pending.length} waiting.` : ""}
        </Text>
      </View>

      {pending.length > 0 && (
        <View style={styles.list}>
          {pending.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.listCat}>{item.category}</Text>
              <Text style={styles.listMeta}>
                {item.lat != null ? `${item.lat.toFixed(3)}, ${item.lon?.toFixed(3)}` : "no location"}
                {" · "}
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  lede: { color: COLORS.text2, fontSize: 14, lineHeight: 21 },
  options: { gap: 8 },
  option: {
    backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, padding: 13, gap: 3,
  },
  optionOn: { borderColor: COLORS.text2, backgroundColor: COLORS.surfaceHi },
  optionLabel: { color: COLORS.text2, fontSize: 15, fontWeight: "600" },
  optionLabelOn: { color: COLORS.text1 },
  optionHelp: { color: COLORS.text3, fontSize: 12 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, color: COLORS.text1, padding: 13,
    minHeight: 76, fontSize: 14, textAlignVertical: "top",
  },
  submit: {
    backgroundColor: COLORS.text1, borderRadius: 12, paddingVertical: 15,
    alignItems: "center",
  },
  submitText: { color: COLORS.bg, fontSize: 15.5, fontWeight: "700" },
  saved: {
    backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.35)",
    borderWidth: 1, borderRadius: 12, padding: 13, gap: 4,
  },
  savedTitle: { color: COLORS.green, fontWeight: "700", fontSize: 13.5 },
  savedBody: { color: COLORS.text2, fontSize: 12.5, lineHeight: 18 },
  notice: {
    backgroundColor: "rgba(249,115,22,0.09)", borderColor: "rgba(249,115,22,0.3)",
    borderWidth: 1, borderRadius: 12, padding: 13, gap: 4,
  },
  noticeTitle: { color: COLORS.orange, fontWeight: "700", fontSize: 13.5 },
  list: { gap: 8, marginTop: 4 },
  listRow: {
    borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 8, gap: 2,
  },
  listCat: { color: COLORS.text1, fontSize: 13.5, textTransform: "capitalize" },
  listMeta: { color: COLORS.text3, fontSize: 11.5 },
});
