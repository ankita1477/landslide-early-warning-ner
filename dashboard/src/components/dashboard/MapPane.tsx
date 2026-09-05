import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
// maplibre-gl v6 exposes named exports only; there is no default export.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ToggleGroup, Tooltip } from "radix-ui";
import { Compass, Maximize2, Minus, Plus } from "lucide-react";
import type { Tier } from "../../api/client";
import { TIER_COLOR, TIER_WORD } from "../../theme";
import { BAND_WIDTH, LAYER_SERIES, TIERS, type LayerKey } from "../../lib/bands";

interface Props {
  data: FeatureCollection | null;
  selectedId: string | null;
  hoveredId: string | null;
  bands: Tier[];
  brush: [number, number] | null;
  layer: LayerKey | "risk";
  onLayer: (layer: LayerKey | "risk") => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  zoomNonce: number;
}

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256, maxzoom: 19,
      attribution: "OpenStreetMap contributors",
    },
  },
  // Desaturated in the raster layer, not with a CSS filter on the canvas: the
  // road is drawn on the same canvas, and a canvas filter greys the road too.
  layers: [{ id: "base", type: "raster", source: "base",
    paint: { "raster-saturation": -1, "raster-contrast": -0.12, "raster-brightness-min": 0.06 } }],
};

const bandColor: maplibregl.DataDrivenPropertyValueSpecification<string> = [
  "match", ["get", "tier"],
  "red", TIER_COLOR.red, "orange", TIER_COLOR.orange,
  "yellow", TIER_COLOR.yellow, TIER_COLOR.green,
];

/** Severity is encoded in width as well as hue, so it survives greyscale and
 *  colour-vision deficiency. */
const bandWidth: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  "match", ["get", "tier"],
  "red", BAND_WIDTH.red, "orange", BAND_WIDTH.orange,
  "yellow", BAND_WIDTH.yellow, BAND_WIDTH.green,
];

/** Single-layer views are a continuous quantity, not a status, so they get a
 *  neutral lightness ramp rather than the traffic-light hues. */
const layerRamp = (property: string, max: number):
  maplibregl.DataDrivenPropertyValueSpecification<string> => [
  "interpolate", ["linear"], ["to-number", ["get", property], 0],
  0, "#D7DDE3", max * 0.5, "#6F7C8A", max, "#141C26",
];

const LAYER_PROPERTY: Record<LayerKey, { property: string; max: number }> = {
  susceptibility: { property: "susceptibility", max: 1 },
  trigger: { property: "trigger_prob", max: 0.03 },
  deformation: { property: "deform_mod", max: 1.5 },
  exposure: { property: "exposure", max: 1 },
};

export function MapPane({
  data, selectedId, hoveredId, bands, brush, layer, onLayer, onSelect, onHover, zoomNonce,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; text: string[] } | null>(null);
  const bounds = useRef<maplibregl.LngLatBounds | null>(null);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const onHoverRef = useRef(onHover); onHoverRef.current = onHover;

  useEffect(() => {
    if (!container.current || map.current) return;
    // MapLibre throws without WebGL2. Uncaught that takes the whole console
    // down, including panes that need no graphics at all.
    try {
      map.current = new maplibregl.Map({
        container: container.current, style: STYLE,
        center: [88.55, 27.15], zoom: 8.6,
        attributionControl: { compact: true },
      });
      // "style.load" fires when the style parses; "load" additionally waits for
      // every source, which a basemap with any failing tile never satisfies.
      // Exposed for inspection from the console; the map is otherwise reachable
      // only through this ref.
      (window as unknown as { __map: maplibregl.Map }).__map = map.current;
      map.current.on("style.load", () => setReady(true));
      map.current.on("idle", () => setReady(true));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
      map.current = null;
    }
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !data || !ready || m.getSource("segments")) return;
    try {
      m.addSource("segments", { type: "geojson", data });

      m.addLayer({ id: "hit", type: "line", source: "segments",
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 24 } });
      m.addLayer({ id: "glow", type: "line", source: "segments",
        filter: ["in", ["get", "tier"], ["literal", ["orange", "red"]]],
        paint: { "line-color": bandColor, "line-width": 20, "line-blur": 16, "line-opacity": 0.28 } });
      m.addLayer({ id: "casing", type: "line", source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 14, "line-opacity": 0.95 } });
      m.addLayer({ id: "risk", type: "line", source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": bandColor, "line-width": bandWidth } });
      // Orange carries a dash so the two most consequential bands differ in more
      // than hue; red stays solid and keeps the glow.
      m.addLayer({ id: "risk-dash", type: "line", source: "segments",
        filter: ["==", ["get", "tier"], "orange"],
        layout: { "line-cap": "butt" },
        paint: { "line-color": "#ffffff", "line-width": BAND_WIDTH.orange,
                 "line-dasharray": [3, 3], "line-opacity": 0.75 } });
      m.addLayer({ id: "selected", type: "line", source: "segments",
        filter: ["==", ["get", "id"], "__none__"],
        paint: { "line-color": "#141C26", "line-width": 2, "line-gap-width": 9 } });
      m.addLayer({ id: "labels", type: "symbol", source: "segments", minzoom: 11,
        filter: ["in", ["get", "tier"], ["literal", ["orange", "red"]]],
        layout: {
          "text-field": ["concat", "km ", ["to-string", ["get", "chainage_km"]]],
          "text-size": 11, "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false, "symbol-placement": "line-center",
        },
        paint: { "text-color": "#141C26", "text-halo-color": "#ffffff", "text-halo-width": 1.6 } });

      m.on("click", "hit", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      m.on("mousemove", "hit", (e: maplibregl.MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        m.getCanvas().style.cursor = "pointer";
        onHoverRef.current(String(p.id));
        const top = LAYER_SERIES
          .map((s) => ({ label: s.label, v: Number(p[LAYER_PROPERTY[s.key].property] ?? 0) /
                        LAYER_PROPERTY[s.key].max }))
          .sort((a, b) => b.v - a.v)[0];
        setTip({ x: e.point.x, y: e.point.y, text: [
          `km ${Number(p.chainage_km).toFixed(1)}`,
          `${TIER_WORD[p.tier as Tier]} · ${Number(p.risk).toFixed(4)}`,
          `top factor: ${top.label}`,
        ] });
      });
      m.on("mouseleave", "hit", () => {
        m.getCanvas().style.cursor = ""; onHoverRef.current(null); setTip(null);
      });

      const b = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        if (feature.geometry.type === "LineString") {
          for (const c of feature.geometry.coordinates) b.extend([c[0], c[1]]);
        }
      }
      bounds.current = b;
      if (!b.isEmpty()) m.fitBounds(b, { padding: 60, animate: false });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    }
  }, [data, ready]);

  /** Filters and selection are pushed straight at MapLibre. Keeping this out of
   *  the React render path is what stops inspector state from re-rendering the
   *  map on every click. */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("risk")) return;
    const bandFilter: maplibregl.FilterSpecification =
      ["in", ["get", "tier"], ["literal", bands]];
    const kmFilter: maplibregl.FilterSpecification = brush
      ? ["all", [">=", ["get", "chainage_km"], brush[0]],
                ["<=", ["get", "chainage_km"], brush[1]]]
      : ["literal", true];
    const combined: maplibregl.FilterSpecification = ["all", bandFilter, kmFilter];

    for (const id of ["risk", "casing", "hit", "labels"]) m.setFilter(id, combined);
    m.setFilter("glow", ["all", combined,
      ["in", ["get", "tier"], ["literal", ["orange", "red"]]]]);
    m.setFilter("risk-dash", ["all", combined, ["==", ["get", "tier"], "orange"]]);
  }, [bands, brush, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("risk")) return;
    if (layer === "risk") {
      m.setPaintProperty("risk", "line-color", bandColor);
      m.setPaintProperty("risk", "line-width", bandWidth);
      m.setLayoutProperty("glow", "visibility", "visible");
      m.setLayoutProperty("risk-dash", "visibility", "visible");
    } else {
      const { property, max } = LAYER_PROPERTY[layer];
      m.setPaintProperty("risk", "line-color", layerRamp(property, max));
      m.setPaintProperty("risk", "line-width", 4);
      m.setLayoutProperty("glow", "visibility", "none");
      m.setLayoutProperty("risk-dash", "visibility", "none");
    }
  }, [layer, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer("selected")) return;
    m.setFilter("selected", ["==", ["get", "id"], selectedId ?? hoveredId ?? "__none__"]);
  }, [selectedId, hoveredId, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !data || !selectedId) return;
    const f = data.features.find((x) => x.properties?.id === selectedId);
    if (!f || f.geometry.type !== "LineString") return;
    const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
    m.flyTo({ center: [mid[0], mid[1]], zoom: 12.6, duration: 800, essential: true });
  }, [selectedId, ready, data, zoomNonce]);

  if (failed) {
    return (
      <div className="map-pane map-failed">
        <div>
          <strong>Map unavailable</strong>
          <p className="muted">{failed}</p>
          <p className="muted">The list, the corridor strip and the inspector still work.</p>
        </div>
      </div>
    );
  }

  const control = (label: string, onClick: () => void, icon: React.ReactNode) => (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button onClick={onClick} aria-label={label}>{icon}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side="left" sideOffset={6}>{label}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );

  return (
    <div className="map-pane">
      <div ref={container} className="map" />

      <ToggleGroup.Root type="single" value={layer} className="layer-switch seg-group float"
                        aria-label="Map layer"
                        onValueChange={(v) => v && onLayer(v as LayerKey | "risk")}>
        <ToggleGroup.Item value="risk" className="seg">Risk</ToggleGroup.Item>
        {LAYER_SERIES.map((s) => (
          <ToggleGroup.Item key={s.key} value={s.key} className="seg"
                            style={{ ["--layer" as string]: s.color }}>
            <span className="seg-swatch" aria-hidden="true" />{s.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      {/* One compact row: the legend explains the width encoding, it does not
          need to dominate the map. */}
      <div className="map-legend float">
        {TIERS.map((tier) => (
          <span className="legend-row" key={tier}>
            <svg width="24" height="10" aria-hidden="true">
              <line x1="1" y1="5" x2="23" y2="5" stroke={TIER_COLOR[tier]}
                    strokeWidth={BAND_WIDTH[tier]}
                    strokeDasharray={tier === "orange" ? "5 3" : undefined} />
            </svg>
            <span>{TIER_WORD[tier]}</span>
          </span>
        ))}
        <span className="legend-note">thicker = more severe</span>
      </div>

      <div className="map-controls float">
        {control("Zoom in", () => map.current?.zoomIn({ duration: 300 }), <Plus size={15} />)}
        {control("Zoom out", () => map.current?.zoomOut({ duration: 300 }), <Minus size={15} />)}
        {control("Reset north", () => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 }), <Compass size={15} />)}
        {control("Fit the whole corridor", () => bounds.current && map.current?.fitBounds(bounds.current, { padding: 60, duration: 700 }), <Maximize2 size={15} />)}
      </div>

      {tip && (
        <div className="map-tip mono" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {tip.text.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
