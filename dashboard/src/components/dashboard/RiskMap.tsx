import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
// maplibre-gl v6 exposes named exports only; there is no default export.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TIER_COLOR } from "../../theme";

interface Props {
  data: FeatureCollection | null;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}

/** Standard OSM raster is the only keyless basemap that reliably serves tiles —
 *  Stadia and CARTO both watermark or fail without a key, and a source whose
 *  tiles partly fail never reports itself loaded. It is a light style, so it is
 *  inverted in CSS to sit inside the dark palette instead of fighting it. */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "OpenStreetMap contributors",
    },
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
};

const BAND_MATCH: maplibregl.DataDrivenPropertyValueSpecification<string> = [
  "match", ["get", "tier"],
  "red", TIER_COLOR.red,
  "orange", TIER_COLOR.orange,
  "yellow", TIER_COLOR.yellow,
  TIER_COLOR.green,
];

export function RiskMap({ data, selectedId, hoveredId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || map.current) return;
    // MapLibre needs WebGL2 and throws without it. Uncaught that takes the whole
    // console down, including the watchlist and detail pane, neither of which
    // needs graphics. A control room should lose the map, not the service.
    try {
      map.current = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [88.55, 27.15],
        zoom: 8.6,
        attributionControl: { compact: true },
      });
      // "style.load" fires when the style document parses. "load" additionally
      // waits for every source to report loaded, which a basemap with any failing
      // tile never does — the map paints and the risk layer never appears.
      map.current.on("style.load", () => setReady(true));
      map.current.on("load", () => setReady(true));
      map.current.on("idle", () => setReady(true));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
      map.current = null;
      return;
    }
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !data || !ready) return;

    try {
      const source = instance.getSource("segments") as maplibregl.GeoJSONSource | undefined;
      if (source) { source.setData(data); return; }

      instance.addSource("segments", { type: "geojson", data });

      // A wide transparent line under the visible one: 4px of road is very hard
      // to hit with a pointer, and selecting is the primary interaction.
      instance.addLayer({
        id: "segments-hit", type: "line", source: "segments",
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 18 },
      });
      // Glow sits under the line and only for the bands that warrant attention.
      instance.addLayer({
        id: "segments-glow", type: "line", source: "segments",
        filter: ["in", ["get", "tier"], ["literal", ["orange", "red"]]],
        paint: {
          "line-color": BAND_MATCH, "line-width": 16, "line-blur": 12,
          "line-opacity": 0.5,
        },
      });
      instance.addLayer({
        id: "segments-casing", type: "line", source: "segments",
        paint: { "line-color": "#05070d", "line-width": 8, "line-opacity": 0.85 },
      });
      instance.addLayer({
        id: "segments", type: "line", source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BAND_MATCH, "line-width": 4.5 },
      });
      instance.addLayer({
        id: "segments-selected", type: "line", source: "segments",
        filter: ["==", ["get", "id"], "__none__"],
        paint: { "line-color": "#f8fafc", "line-width": 9, "line-opacity": 0.9 },
      });
      instance.moveLayer("segments-selected", "segments");

      instance.on("click", "segments-hit", (event: maplibregl.MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      instance.on("mouseenter", "segments-hit", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "segments-hit", () => {
        instance.getCanvas().style.cursor = "";
      });

      // Frame the corridor rather than trusting a hardcoded centre and zoom:
      // 110 km of road inside a 200 km view is a hairline nobody can read.
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        if (feature.geometry.type === "LineString") {
          for (const position of feature.geometry.coordinates) {
            bounds.extend([position[0], position[1]]);
          }
        }
      }
      if (!bounds.isEmpty()) {
        instance.fitBounds(bounds, { padding: 72, animate: false });
      }
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    }
  }, [data, ready]);

  /** Highlight by filtering on the id property: feature-state needs numeric ids
   *  and these are composite (highway:chainage). */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !instance.getLayer("segments-selected")) return;
    const focus = selectedId ?? hoveredId ?? "__none__";
    instance.setFilter("segments-selected", ["==", ["get", "id"], focus]);
  }, [selectedId, hoveredId, ready, data]);

  /** Fly to a selection so the operator does not have to find it themselves. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !data || !selectedId) return;
    const feature = data.features.find((f) => f.properties?.id === selectedId);
    if (!feature || feature.geometry.type !== "LineString") return;
    const coordinates = feature.geometry.coordinates;
    const middle = coordinates[Math.floor(coordinates.length / 2)];
    instance.flyTo({
      center: [middle[0], middle[1]], zoom: 12.4, duration: 800,
      essential: true,
    });
  }, [selectedId, ready, data]);

  if (failed) {
    return (
      <div className="map map-failed">
        <div>
          <strong>Map unavailable</strong>
          <p className="muted">{failed}</p>
          <p className="muted">The watchlist and segment details still work.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      <div className="map-controls glass">
        <button onClick={() => map.current?.zoomIn({ duration: 300 })} aria-label="Zoom in">+</button>
        <button onClick={() => map.current?.zoomOut({ duration: 300 })} aria-label="Zoom out">−</button>
        <button onClick={() => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 })}
                aria-label="Reset orientation">◎</button>
      </div>
    </div>
  );
}
