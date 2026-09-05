import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Camera, CloudOff, MapPin, MapPinOff, Send } from "lucide-react-native";
import { CATEGORIES, queued, submit, type Category, type Report as Saved } from "../lib/reports";
import { Button } from "../components/Button";
import { SuccessTick } from "../components/SuccessTick";
import { TABBAR_HEIGHT } from "../components/TabBar";
import { Hazard } from "../illustrations/Hazards";
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
    const picker = permission.granted ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
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

  const notice = (
    <View style={styles.notice}>
      <CloudOff color={C.ink2} size={18} />
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeTitle}>Reports are not being collected yet</Text>
        <Text style={styles.small}>
          The service cannot receive them at the moment, so your reports are kept
          safely on this phone instead of being lost.{pending.length > 0 ? ` ${pending.length} waiting.` : ""}
        </Text>
      </View>
    </View>
  );

  // The confirmation takes the whole screen rather than sitting under the
  // button. Appended to the form it lands below the fold, so the one person who
  // needs to see it — the one who just pressed send — never does.
  if (saved) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.success}>
          {/* "Submitted" would be a lie — nothing has left the phone yet. The
              thanks is still owed, so it is given for what actually happened. */}
          <SuccessTick title="Report saved" body="Thank you. Your report can help keep other travellers safe." />
        </View>
        {notice}
        <Button label="Report something else" onPress={() => setSaved(false)} kind="secondary" />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>What you see from the road helps warn the people behind you.</Text>

      <Text style={styles.eyebrow}>What is happening</Text>
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
              <Hazard kind={option.key} size={64} active={on} />
              <Text style={styles.tileLabel}>{option.label}</Text>
              <Text style={styles.tileHelp}>{option.help}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.eyebrow}>Photo</Text>
      <Pressable onPress={addPhoto} style={styles.photo} accessibilityRole="button" accessibilityLabel="Add a photo">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photoImage} />
        ) : (
          <>
            <View style={styles.photoGlyph}><Camera color={C.ink} size={22} strokeWidth={1.8} /></View>
            <Text style={styles.photoText}>Add a photo</Text>
            <Text style={styles.small}>Optional, but it helps a lot</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.eyebrow}>Anything else</Text>
      <TextInput
        style={styles.input}
        placeholder="For example: one lane open, rocks still falling"
        placeholderTextColor={C.ink3}
        value={note}
        onChangeText={(t) => { setNote(t); setSaved(false); }}
        multiline
      />

      <Button label="Send report" onPress={save} icon={Send} doneLabel="Saved" />

      {notice}

      {pending.length > 0 && (
        <View style={styles.group}>
          {pending.slice(0, 5).map((item, i) => (
            <View key={item.id} style={[styles.listRow, i === Math.min(pending.length, 5) - 1 && styles.rowLast]}>
              {item.photoUri
                ? <Image source={{ uri: item.photoUri }} style={styles.thumb} />
                : <View style={[styles.thumb, styles.thumbEmpty]}><Hazard kind={item.category} size={40} /></View>}
              <View style={styles.listText}>
                <Text style={styles.listCat}>{CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}</Text>
                <View style={styles.listMetaRow}>
                  {item.lat != null ? <MapPin color={C.ink3} size={12} /> : <MapPinOff color={C.ink3} size={12} />}
                  <Text style={styles.small}>
                    {new Date(item.createdAt).toLocaleDateString()}{item.lat != null ? " · location saved" : " · no location"}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: SPACE.xs, gap: SPACE.md, paddingBottom: TABBAR_HEIGHT + SPACE.lg },
  lead: { ...TYPE.body, color: C.ink2 },
  eyebrow: { ...TYPE.eyebrow, color: C.ink3, marginBottom: -SPACE.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  tile: {
    width: "48%", flexGrow: 1, backgroundColor: C.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: C.line, padding: SPACE.md, gap: 2, minHeight: 156,
  },
  tileOn: { borderColor: C.ink },
  tileLabel: { ...TYPE.bodyStrong, fontSize: 15.5, lineHeight: 20, color: C.ink, marginTop: SPACE.xs },
  tileHelp: { ...TYPE.small, fontSize: 12.5, lineHeight: 17, color: C.ink3 },
  photo: {
    minHeight: 130, borderRadius: RADIUS.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.lineHi,
    alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: C.white, overflow: "hidden",
  },
  photoGlyph: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.paper2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  photoImage: { width: "100%", height: 200 },
  photoText: { ...TYPE.bodyStrong, color: C.ink },
  small: { ...TYPE.small, color: C.ink3 },
  input: {
    backgroundColor: C.white, borderRadius: RADIUS.control, borderWidth: 1, borderColor: C.line,
    color: C.ink, padding: SPACE.md, minHeight: 92, ...TYPE.body, textAlignVertical: "top",
  },
  notice: { flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start", padding: SPACE.md, borderRadius: RADIUS.control, backgroundColor: C.paper2 },
  noticeTitle: { ...TYPE.bodyStrong, color: C.ink, marginBottom: 2 },
  success: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, paddingVertical: SPACE.md },
  group: { backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: SPACE.sm, paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.line },
  rowLast: { borderBottomWidth: 0 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbEmpty: { backgroundColor: C.paper2, alignItems: "center", justifyContent: "center" },
  listText: { flex: 1, gap: 2 },
  listCat: { ...TYPE.bodyStrong, fontSize: 15, lineHeight: 20, color: C.ink },
  listMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
});
