import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { IconButton } from "react-native-paper";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { api, type GeoFeature } from "../lib/api";
import { Reason, TIER_ICON } from "../components/Icons";
import { Skeleton } from "../components/Skeleton";
import { D, EASE, useReducedMotion } from "../lib/motion";
import { headline, reasons, ACTION } from "../lib/explain";
import { C, FONT, RADIUS, SPACE, TIER_COLOR, TIER_INK, TIER_WORD, TYPE, type Tier } from "../lib/theme";
import { TABBAR_HEIGHT } from "../components/TabBar";
import PLACES from "../data/places.json";

const PAD = 40;
const STOPS = PLACES as { name: string; km: number }[];

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
  const { width, height } = useWindowDimensions();
  const W = width;
  const H = Math.max(420, Math.round(height * 0.66));

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
  }, [features, W, H]);

  // Place names pinned to the nearest kilometre the road actually has. Two
  // names landing on the same spot would be unreadable, so the second is
  // dropped rather than drawn over the first.
  const labels = useMemo(() => {
    if (!projected) return [];
    const placed: { name: string; x: number; y: number }[] = [];
    for (const stop of STOPS) {
      const nearest = projected.reduce((best, p) =>
        Math.abs(p.feature.properties.chainage_km - stop.km) <
        Math.abs(best.feature.properties.chainage_km - stop.km) ? p : best);
      if (Math.abs(nearest.feature.properties.chainage_km - stop.km) > 2) continue;
      const [x, y] = nearest.mid;
      if (placed.some((l) => Math.abs(l.x - x) < 60 && Math.abs(l.y - y) < 16)) continue;
      placed.push({ name: stop.name, x, y });
    }
    return placed;
  }, [projected]);

  const tier = (selected?.properties.tier ?? "green") as Tier;
  const Glyph = TIER_ICON[tier];

  const spot = useMemo(
    () => projected?.find((p) => p.feature.properties.id === selected?.properties.id) ?? null,
    [projected, selected],
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, selected && styles.contentWithSheet]}>
        <View style={styles.intro}>
          <Text style={styles.h1}>The road</Text>
          <Text style={styles.lead}>Every kilometre of NH-10, coloured by today's reading. Tap a section.</Text>
        </View>

        <View style={styles.mapWrap}>
          {busy && <Skeleton height={H} width={W} style={{ borderRadius: 0 }} />}
          {projected && (
            <Svg width={W} height={H}>
              <Defs>
                <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#EDE8DC" />
                  <Stop offset="1" stopColor="#E3DDCD" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={W} height={H} fill="url(#ground)" />
              <G opacity={0.5}>
                {Array.from({ length: 7 }, (_, i) => (
                  <Line key={`v${i}`} x1={(i + 1) * (W / 8)} y1={0} x2={(i + 1) * (W / 8)} y2={H} stroke={C.line} strokeWidth={1} />
                ))}
                {Array.from({ length: 10 }, (_, i) => (
                  <Line key={`h${i}`} x1={0} y1={(i + 1) * (H / 11)} x2={W} y2={(i + 1) * (H / 11)} stroke={C.line} strokeWidth={1} />
                ))}
              </G>

              {/* Casing first, so the coloured road reads as raised off the paper. */}
              {projected.map(({ feature, d }) => (
                <Path key={`c${feature.properties.id}`} d={d} stroke={C.white} strokeWidth={12} strokeLinecap="round" fill="none" />
              ))}
              {projected.map(({ feature, d }) => (
                <Path
                  key={feature.properties.id}
                  d={d}
                  stroke={TIER_COLOR[feature.properties.tier as Tier]}
                  strokeWidth={selected?.properties.id === feature.properties.id ? 12 : 7}
                  strokeLinecap="round"
                  fill="none"
                  onPress={() => setSelected(feature)}
                />
              ))}

              {labels.map((l) => (
                <G key={l.name}>
                  <Circle cx={l.x} cy={l.y} r={4} fill={C.white} stroke={C.ink} strokeWidth={1.5} />
                  <SvgText x={l.x + 10} y={l.y + 4} fill={C.ink} fontSize={12}
                           fontFamily={Platform.select({ web: "InstrumentSans_600SemiBold, -apple-system, Helvetica, sans-serif", default: FONT.sansSemi })}>
                    {l.name}
                  </SvgText>
                </G>
              ))}

              {spot && <Marker x={spot.mid[0]} y={spot.mid[1]} color={TIER_INK[tier]} />}
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
        </View>

        {!selected && !busy && (
          <Text style={styles.hint}>Tap the road above to check a section.</Text>
        )}
      </ScrollView>

      {selected && (
        <Sheet key={selected.properties.id} onClose={() => setSelected(null)}>
          <View style={styles.pickHead}>
            <Glyph color={TIER_INK[tier]} size={18} strokeWidth={2.3} />
            <Text style={[styles.pickWord, { color: TIER_INK[tier] }]}>{TIER_WORD[tier]}</Text>
          </View>
          <Text style={styles.pickKm}>NH-10, km {selected.properties.chainage_km.toFixed(0)}</Text>
          <Text style={styles.pickWhy}>{headline(factorsOf(selected), tier)}</Text>
          <View style={styles.reasons}>
            {reasons(factorsOf(selected), tier).map((r) => (
              <View key={r.text} style={styles.reasonRow}>
                <Reason icon={r.icon} color={TIER_INK[tier]} size={18} />
                <Text style={styles.reason}>{r.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.pickAction}>{ACTION[tier].action}</Text>
        </Sheet>
      )}
    </View>
  );
}

/** The four factors, named the way the explainer expects them. */
function factorsOf(feature: GeoFeature) {
  return {
    susceptibility: feature.properties.susceptibility,
    trigger_probability: feature.properties.trigger_prob,
    deformation_modifier: feature.properties.deform_mod,
    exposure: feature.properties.exposure,
  };
}

/** A ring that breathes around the chosen kilometre.
 *
 *  On a road drawn at this scale a thicker stroke alone is easy to lose. The
 *  ring says "this one" without moving the map or hiding what is under it.
 */
function Marker({ x, y, color }: { x: number; y: number; color: string }) {
  const beat = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(beat, {
        toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, reduced]);

  return (
    <>
      <AnimatedCircle
        cx={x} cy={y} fill="none" stroke={color} strokeWidth={2}
        r={beat.interpolate({ inputRange: [0, 1], outputRange: [9, 26] })}
        opacity={beat.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] })}
      />
      <Circle cx={x} cy={y} r={9} fill="none" stroke={C.ink} strokeWidth={2.5} />
    </>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The detail card, held at the bottom of the screen where a thumb is.
 *
 *  It slides rather than fades: if the animation never runs — a slow device, a
 *  dropped frame — a card at full opacity in the wrong position is still
 *  readable, whereas one stuck at zero opacity is simply gone.
 */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const rise = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1, duration: reduced ? 0 : D.page, easing: EASE.out, useNativeDriver: true,
    }).start();
  }, [rise, reduced]);

  return (
    <Animated.View
      style={[
        styles.sheet,
        { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
      ]}
    >
      <View style={styles.grip} />
      <IconButton
        icon="close"
        size={18}
        iconColor={C.ink3}
        onPress={onClose}
        style={styles.close}
        accessibilityLabel="Close"
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: TABBAR_HEIGHT + SPACE.lg },
  intro: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.md, gap: 4 },
  h1: { ...TYPE.h1, color: C.ink },
  lead: { ...TYPE.body, color: C.ink2 },
  mapWrap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, backgroundColor: "#EDE8DC" },
  legend: {
    position: "absolute", top: SPACE.sm, left: SPACE.sm, gap: 6, backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: RADIUS.control, padding: SPACE.sm, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { ...TYPE.eyebrow, fontSize: 10, color: C.ink2 },
  pickHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  pickWord: { ...TYPE.eyebrow },
  pickKm: { ...TYPE.h2, color: C.ink },
  pickWhy: { ...TYPE.bodyStrong, color: C.ink, marginTop: 6 },
  reasons: { gap: 10, marginTop: SPACE.sm },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reason: { ...TYPE.body, fontSize: 15, color: C.ink2, flex: 1 },
  pickAction: { ...TYPE.body, color: C.ink, marginTop: SPACE.md, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: C.line },
  hint: { ...TYPE.small, color: C.ink3, textAlign: "center", paddingTop: SPACE.md },
  contentWithSheet: { paddingBottom: 380 },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.white,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: C.line,
    padding: SPACE.lg, paddingTop: SPACE.md, paddingBottom: TABBAR_HEIGHT,
    shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 26, shadowOffset: { width: 0, height: -8 }, elevation: 16,
  },
  grip: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: C.lineHi, marginBottom: SPACE.md },
  close: { position: "absolute", right: SPACE.xs, top: SPACE.xs, margin: 0 },
});
