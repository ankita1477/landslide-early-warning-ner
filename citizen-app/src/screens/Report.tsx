import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { CATEGORIES, queued, submit, type Category, type Report as Saved } from "../lib/reports";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { SuccessTick } from "../components/SuccessTick";
import { C, RADIUS, SPACE, TYPE } from "../lib/theme";

/** Reporting is not decoration. Precisely mapped landslides are the scarcest
 *  input the whole system has, and what people see from the road is exactly
 *  what satellites miss. */
export function Report() {
  const [category, setCategory] = useState<Category>("blocked");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [pending, setPending] = useState<Saved[]>([]);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => setPending(await queued()), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const addPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const picker = permission.granted
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const result = await picker({ quality: 0.5, mediaTypes: ["images"] });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const save = async () => {
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
    await submit(category, note, lat, lon, photo);
    setNote(""); setPhoto(null); setSaved(true);
    await refresh();
  };

  // The confirmation takes the whole screen rather than sitting under the
  // button. Appended to the form it lands below the fold, so the one person who
  // needs to see it — the one who just pressed send — never does.
  if (saved) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card tint="rgba(34,197,94,0.12)">
          {/* "Submitted" would be a lie — nothing has left the phone yet. The
              thanks is still owed, so it is given for what actually happened. */}
          <SuccessTick
            title="Report saved"
            body="Thank you. Your report can help keep other travellers safe."
          />
        </Card>

        <Card tint="rgba(249,115,22,0.10)">
          <Text style={styles.noticeTitle}>Reports are not being collected yet</Text>
          <Text style={styles.body}>
            The service cannot receive them at the moment, so your reports are
            kept safely on this phone instead of being lost.
            {pending.length > 0 ? ` ${pending.length} waiting.` : ""}
          </Text>
        </Card>

        <Button label="Report something else" onPress={() => setSaved(false)} kind="secondary" />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>
        What you see from the road helps warn the people behind you.
      </Text>

      <View style={styles.grid}>
        {CATEGORIES.map((option) => {
          const on = option.key === category;
          return (
            <Pressable
              key={option.key}
              onPress={() => { setCategory(option.key); setSaved(false); }}
              style={[styles.tile, on && styles.tileOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${option.label}. ${option.help}`}
            >
              <Text style={styles.tileIcon}>{option.icon}</Text>
              <Text style={[styles.tileLabel, on && styles.tileLabelOn]}>{option.label}</Text>
              <Text style={styles.tileHelp}>{option.help}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={addPhoto} style={styles.photo} accessibilityRole="button"
                 accessibilityLabel="Add a photo">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photoImage} />
        ) : (
          <>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoText}>Add a photo (optional)</Text>
          </>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Anything else worth knowing?"
        placeholderTextColor={C.text3}
        value={note}
        onChangeText={(t) => { setNote(t); setSaved(false); }}
        multiline
      />

      <Button label="Send report" onPress={save} />

      <Card tint="rgba(249,115,22,0.10)">
        <Text style={styles.noticeTitle}>Reports are not being collected yet</Text>
        <Text style={styles.body}>
          The service cannot receive them at the moment, so your reports are kept
          safely on this phone instead of being lost.
          {pending.length > 0 ? ` ${pending.length} waiting.` : ""}
        </Text>
      </Card>

      {pending.length > 0 && (
        <View style={styles.list}>
          {pending.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.listRow}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.listText}>
                <Text style={styles.listCat}>
                  {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                </Text>
                <Text style={styles.listMeta}>
                  {new Date(item.createdAt).toLocaleDateString()}
                  {item.lat != null ? " · location saved" : " · no location"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  sub: { ...TYPE.body, color: C.text2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  tile: {
    width: "48%", flexGrow: 1, backgroundColor: C.surface, borderRadius: RADIUS.card,
    borderWidth: 2, borderColor: C.border, padding: SPACE.md, gap: 4, minHeight: 116,
  },
  tileOn: { borderColor: C.accent, backgroundColor: C.surfaceHi },
  tileIcon: { fontSize: 28 },
  tileLabel: { ...TYPE.bodyStrong, color: C.text2 },
  tileLabelOn: { color: C.text1 },
  tileHelp: { fontSize: 12.5, color: C.text3, lineHeight: 17 },
  photo: {
    minHeight: 120, borderRadius: RADIUS.card, borderWidth: 2, borderStyle: "dashed",
    borderColor: C.border, alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.surface, overflow: "hidden",
  },
  photoImage: { width: "100%", height: 190 },
  photoIcon: { fontSize: 30 },
  photoText: { ...TYPE.body, color: C.text3 },
  input: {
    backgroundColor: C.surface, borderRadius: RADIUS.control, borderWidth: 1,
    borderColor: C.border, color: C.text1, padding: SPACE.md, minHeight: 90,
    fontSize: 16, textAlignVertical: "top",
  },
  noticeTitle: { ...TYPE.bodyStrong, color: C.orange, marginBottom: 4 },
  body: { ...TYPE.body, fontSize: 14.5, color: C.text2 },
  list: { gap: SPACE.sm },
  listRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: SPACE.sm,
    backgroundColor: C.surface, borderRadius: RADIUS.control,
    borderWidth: 1, borderColor: C.border,
  },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  thumbEmpty: { backgroundColor: C.surfaceHi },
  listText: { flex: 1, gap: 2 },
  listCat: { ...TYPE.bodyStrong, fontSize: 15, color: C.text1 },
  listMeta: { fontSize: 12.5, color: C.text3 },
});
