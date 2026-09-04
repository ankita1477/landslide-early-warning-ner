import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
// maplibre-gl v6 exposes named exports only; there is no default export.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TIER_COLOR } from "../theme";

interface Props {
  data: FeatureCollection | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Standard OSM tiles: the only provider here that genuinely needs no API key.
 *  Stadia-hosted Stamen and CARTO both watermark or fail without one, and a
 *  basemap whose tiles partly fail never lets the raster source report itself
 *  loaded — the map paints but "load" never fires, so the risk layer silently
 *  never appears. The overlay is drawn with a dark casing to stay legible
 *  against OSM's own road colours. */
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

export function RiskMap({ data, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || map.current) return;
    // MapLibre needs WebGL2 and throws if it is unavailable — an older machine,
    // a locked-down browser, a remote session. Left uncaught that takes the whole
    // dashboard down, including the watchlist and detail panel, which need no
    // graphics at all. A control room should lose the map, not the service.
    try {
      map.current = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [88.55, 27.15],
        zoom: 9,
      });
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      // "style.load" fires when the style document is parsed, which is all that
      // is needed before adding a source. "load" additionally waits for every
      // source to report loaded, and a basemap whose tiles partly fail never
      // gets there — the map paints, "load" never fires, and the risk layer is
      // silently missing. "idle" is kept as a belt-and-braces fallback.
      const markReady = () => setReady(true);
      map.current.on("style.load", markReady);
      map.current.on("load", markReady);
      map.current.on("idle", markReady);
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

    const draw = () => {
      const source = instance.getSource("segments") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      instance.addSource("segments", { type: "geojson", data });

      // A wide transparent line under the visible one: 3px of road is very hard
      // to hit with a mouse, and this is the primary interaction.
      instance.addLayer({
        id: "segments-hit",
        type: "line",
        source: "segments",
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 16 },
      });
      instance.addLayer({
        id: "segments-casing",
        type: "line",
        source: "segments",
        paint: { "line-color": "#05070a", "line-width": 8, "line-opacity": 0.9 },
      });
      instance.addLayer({
        id: "segments",
        type: "line",
        source: "segments",
        paint: {
          "line-width": 5,
          "line-color": [
            "match",
            ["get", "tier"],
            "red", TIER_COLOR.red,
            "orange", TIER_COLOR.orange,
            "yellow", TIER_COLOR.yellow,
            TIER_COLOR.green,
          ],
        },
      });

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
      // 116 km of road inside a 200 km view is a hairline nobody can read.
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        const geometry = feature.geometry;
        if (geometry.type === "LineString") {
          for (const position of geometry.coordinates) {
            bounds.extend([position[0], position[1]]);
          }
        }
      }
      if (!bounds.isEmpty()) {
        instance.fitBounds(bounds, { padding: 60, animate: false });
      }
    };

    try {
      draw();
    } catch (error) {
      // Same reasoning as map construction: losing the overlay must not take
      // the watchlist and detail panel down with it.
      setFailed(error instanceof Error ? error.message : String(error));
    }
  }, [data, ready]);

  // Feature state needs numeric ids, so highlight by filtering on the id property.
  // Highlight by filtering on the id property: feature-state needs numeric ids,
  // and these are composite (highway:chainage).
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !instance.getSource("segments")) return;

    const filter: maplibregl.FilterSpecification = [
      "==", ["get", "id"], selectedId ?? "__none__",
    ];
    if (instance.getLayer("segments-selected")) {
      instance.setFilter("segments-selected", filter);
      return;
    }
    instance.addLayer({
      id: "segments-selected",
      type: "line",
      source: "segments",
      filter,
      paint: { "line-color": "#111", "line-width": 9, "line-opacity": 0.85 },
    });
    instance.moveLayer("segments-selected", "segments");
  }, [selectedId, data, ready]);

  if (failed) {
    return (
      <div className="map map-failed">
        <div>
          <strong>Map unavailable</strong>
          <p className="muted">{failed}</p>
          <p className="muted">
            The watchlist and segment details on either side still work.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={container} className="map" />;
}
