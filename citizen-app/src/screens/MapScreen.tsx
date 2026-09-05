import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api, type GeoFeature } from "../lib/api";
import { Card } from "../components/Card";
import { headline, reasons } from "../lib/explain";
import { C, RADIUS, SPACE, TIER_COLOR, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { ACTION } from "../lib/explain";

const W = 320;
const H = 420;
const PAD = 22;

/** The corridor drawn from its real geometry.
 *
 *  A tile map would be heavier, need a key, and be useless offline — which is
 *  when this app matters most. Drawing the road itself from coordinates already
 *  cached keeps the map working with no signal, and every kilometre is a tap
 *  target rather than a pixel on someone else's raster.
 */
export function MapScreen() {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [selected, setSelected] = useState<GeoFeature | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await api.geojson();
      setFeatures(result.data.features);
    } catch {
      // Empty state handles it.
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const projected = useMemo(() => {
    const points = features.flatMap((f) => f.geometry.coordinates);
    if (points.length === 0) return null;
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    // Keep the corridor's shape: one scale for both axes, centred.
    const scale = Math.min((W - PAD * 2) / (maxLon - minLon), (H - PAD * 2) / (maxLat - minLat));
    const offsetX = (W - (maxLon - minLon) * scale) / 2;
    const offsetY = (H - (maxLat - minLat) * scale) / 2;
    const project = ([lon, lat]: [number, number]) => [
      offsetX + (lon - minLon) * scale,
      H - (offsetY + (lat - minLat) * scale),
    ];
    return features.map((f) => ({
      feature: f,
      d: f.geometry.coordinates
        .map((c, i) => `${i ? "L" : "M"} ${project(c)[0].toFixed(1)} ${project(c)[1].toFixed(1)}`)
        .join(" "),
      mid: project(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]),
    }));
  }, [features]);

  const tier = (selected?.properties.tier ?? "green") as Tier;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>The road</Text>
      <Text style={styles.sub}>Tap any part of the highway to see what is happening there.</Text>

      <Card style={styles.mapCard}>
        {busy && <ActivityIndicator color={C.text2} size="large" />}
        {projected && (
          <Svg width={W} height={H}>
            {projected.map(({ feature, d }) => (
              <Path
                key={feature.properties.id}
                d={d}
                stroke={TIER_COLOR[feature.properties.tier as Tier]}
                strokeWidth={selected?.properties.id === feature.properties.id ? 11 : 6}
                strokeLinecap="round"
                fill="none"
                onPress={() => setSelected(feature)}
              />
            ))}
            {selected && (
              <Circle
                cx={projected.find((p) => p.feature.properties.id === selected.properties.id)?.mid[0]}
                cy={projected.find((p) => p.feature.properties.id === selected.properties.id)?.mid[1]}
                r={9} fill="none" stroke={C.text1} strokeWidth={2.5}
              />
            )}
          </Svg>
        )}
        <View style={styles.legend}>
          {(["green", "yellow", "orange", "red"] as Tier[]).map((t) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TIER_COLOR[t] }]} />
              <Text style={styles.legendText}>{TIER_WORD[t]}</Text>
            </View>
          ))}
        </View>
      </Card>

      {selected ? (
        <Card tint={`${TIER_COLOR[tier]}1F`}>
          <Text style={[styles.pickWord, { color: TIER_COLOR[tier] }]}>{TIER_WORD[tier]}</Text>
          <Text style={styles.pickKm}>
            NH-10, km {selected.properties.chainage_km.toFixed(0)}
          </Text>
          <Text style={styles.pickWhy}>
            {headline(
              {
                susceptibility: selected.properties.susceptibility,
                trigger_probability: selected.properties.trigger_prob,
                deformation_modifier: selected.properties.deform_mod,
                exposure: selected.properties.exposure,
              },
              tier,
            )}
          </Text>
          <View style={styles.reasons}>
            {reasons(
              {
                susceptibility: selected.properties.susceptibility,
                trigger_probability: selected.properties.trigger_prob,
                deformation_modifier: selected.properties.deform_mod,
                exposure: selected.properties.exposure,
              },
              tier,
            ).map((r) => (
              <Text key={r.text} style={styles.reason}>{r.icon}  {r.text}</Text>
            ))}
          </View>
          <Text style={styles.pickAction}>{ACTION[tier].action}</Text>
        </Card>
      ) : (
        !busy && (
          <Card>
            <Text style={styles.hint}>Tap the road above to check a section.</Text>
          </Card>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xl },
  h1: { ...TYPE.hero, fontSize: 28, color: C.text1 },
  sub: { ...TYPE.body, color: C.text2, marginTop: -6 },
  mapCard: { alignItems: "center", gap: SPACE.sm, backgroundColor: "#0E1424" },
  legend: { flexDirection: "row", gap: SPACE.md, flexWrap: "wrap", justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: "700", color: C.text3, letterSpacing: 0.6 },
  pickWord: { ...TYPE.micro, fontSize: 12, marginBottom: 4 },
  pickKm: { ...TYPE.title, color: C.text1 },
  pickWhy: { ...TYPE.bodyStrong, color: C.text1, marginTop: 6 },
  reasons: { gap: 8, marginTop: SPACE.sm },
  reason: { ...TYPE.body, fontSize: 15, color: C.text2 },
  pickAction: {
    ...TYPE.body, color: C.text1, marginTop: SPACE.md, paddingTop: SPACE.sm,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  hint: { ...TYPE.body, color: C.text2, textAlign: "center" },
});
