import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
// maplibre-gl v6 exposes named exports only; there is no default export.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Tier } from "../../api/client";
import { TIER_COLOR } from "../../theme";
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
  layers: [{ id: "base", type: "raster", source: "base" }],
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
  0, "#1e293b", max * 0.5, "#7c8da3", max, "#f8fafc",
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
        paint: { "line-color": bandColor, "line-width": 18, "line-blur": 14, "line-opacity": 0.45 } });
      m.addLayer({ id: "casing", type: "line", source: "segments",
        paint: { "line-color": "#05070d", "line-width": 13, "line-opacity": 0.8 } });
      m.addLayer({ id: "risk", type: "line", source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": bandColor, "line-width": bandWidth } });
      // Orange carries a dash so the two most consequential bands differ in more
      // than hue; red stays solid and keeps the glow.
      m.addLayer({ id: "risk-dash", type: "line", source: "segments",
        filter: ["==", ["get", "tier"], "orange"],
        layout: { "line-cap": "butt" },
        paint: { "line-color": "#05070d", "line-width": BAND_WIDTH.orange,
                 "line-dasharray": [3, 3], "line-opacity": 0.6 } });
      m.addLayer({ id: "selected", type: "line", source: "segments",
        filter: ["==", ["get", "id"], "__none__"],
        paint: { "line-color": "#f8fafc", "line-width": 2, "line-gap-width": 8 } });
      m.addLayer({ id: "labels", type: "symbol", source: "segments", minzoom: 11,
        filter: ["in", ["get", "tier"], ["literal", ["orange", "red"]]],
        layout: {
          "text-field": ["concat", "km ", ["to-string", ["get", "chainage_km"]]],
          "text-size": 11, "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": false, "symbol-placement": "line-center",
        },
        paint: { "text-color": "#f8fafc", "text-halo-color": "#05070d", "text-halo-width": 1.4 } });

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
          `${p.tier} · ${Number(p.risk).toFixed(4)}`,
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
          <p className="muted">The watchlist, corridor strip and inspector still work.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-pane">
      <div ref={container} className="map" />

      <div className="layer-switch glass" role="group" aria-label="Map layer">
        {([["risk", "Risk"], ...LAYER_SERIES.map((s) => [s.key, s.label] as const)] as const).map(
          ([key, label]) => (
            <button key={key} className={layer === key ? "on" : ""}
                    onClick={() => onLayer(key as LayerKey | "risk")}
                    aria-pressed={layer === key}>{label}</button>
          ),
        )}
      </div>

      {/* One compact row rather than a stacked panel: the legend explains the
          width encoding, it does not need to dominate the map. */}
      <div className="map-legend">
        {TIERS.map((tier) => (
          <span className="legend-row" key={tier}>
            <svg width="22" height="9" aria-hidden="true">
              <line x1="1" y1="4.5" x2="21" y2="4.5" stroke={TIER_COLOR[tier]}
                    strokeWidth={BAND_WIDTH[tier]}
                    strokeDasharray={tier === "orange" ? "5 3" : undefined} />
            </svg>
            <span>{tier}</span>
          </span>
        ))}
        <span className="legend-note">thicker = more severe</span>
      </div>

      <div className="map-controls glass">
        <button onClick={() => map.current?.zoomIn({ duration: 300 })} aria-label="Zoom in">+</button>
        <button onClick={() => map.current?.zoomOut({ duration: 300 })} aria-label="Zoom out">−</button>
        <button onClick={() => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 })}
                aria-label="Reset north">◎</button>
        <button onClick={() => bounds.current && map.current?.fitBounds(bounds.current,
                  { padding: 60, duration: 700 })} aria-label="Fit the whole corridor">⤢</button>
      </div>

      {tip && (
        <div className="map-tip mono" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {tip.text.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
