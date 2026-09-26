import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Tooltip } from "radix-ui";
import type { Health, SegmentSummary, TierThreshold } from "../../api/client";
import { useDashboardState } from "../../lib/useDashboardState";
import { TIERS } from "../../lib/bands";
import { CommandBar } from "./CommandBar";
import { Watchlist } from "./Watchlist";
import { MapPane } from "./MapPane";
import { CorridorStrip } from "./CorridorStrip";
import { Inspector } from "./Inspector";
import { TableView } from "./TableView";
import { Shortcuts } from "./Shortcuts";
import { PaneTabs } from "./PaneTabs";
import type { ThemeMode } from "../../lib/themeMode";

interface Props {
  geojson: FeatureCollection | null;
  allSegments: SegmentSummary[];
  health: Health | null;
  thresholds: TierThreshold[];
  computedAt: string | null;
  loadError: string | null;
  onBack: () => void;
  theme: { mode: ThemeMode; resolved: "light" | "dark"; setMode: (m: ThemeMode) => void };
}

export function Console({ geojson, allSegments, health, thresholds, computedAt, loadError, onBack, theme }: Props) {
  const { state, dispatch, visible, counts, select, hover } = useDashboardState(allSegments);
  const [zoomNonce, setZoomNonce] = useState(0);
  const [query, setQuery] = useState("");

  // A kilometre typed into the search narrows the list without touching the
  // shared filters, so the map and strip keep showing the whole road.
  const listed = useMemo(() => {
    const q = query.trim();
    if (!q) return visible;
    const km = Number(q);
    if (Number.isNaN(km)) return visible;
    return visible.filter((s) => Math.abs(s.chainage_km - km) < 2.5);
  }, [visible, query]);

  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible]);
  const summary = useMemo(() => {
    if (!allSegments.length) return null;
    const worst = [...allSegments].sort((a, b) => b.risk - a.risk)[0];
    return { worst, counts, thresholds: [...thresholds].sort((a, b) => b.threshold - a.threshold) };
  }, [allSegments, counts, thresholds]);

  const sortedThresholds = useMemo(
    () => [...thresholds].sort((a, b) => a.threshold - b.threshold), [thresholds],
  );

  const onKey = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (event.key === "Escape") {
      if (state.showTable) return dispatch({ type: "toggleTable" });
      if (state.showShortcuts) return dispatch({ type: "toggleShortcuts" });
      return select(null);
    }
    if (event.key === "?") return dispatch({ type: "toggleShortcuts" });
    if (event.key === "t") return dispatch({ type: "toggleTable" });
    if (event.key === "c") return dispatch({ type: "clearFilters" });
    if (["1", "2", "3", "4"].includes(event.key)) {
      return dispatch({ type: "toggleBand", band: TIERS[Number(event.key) - 1] });
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = listed.findIndex((s) => s.id === state.selectedId);
      const next = event.key === "ArrowDown"
        ? Math.min(listed.length - 1, index + 1) : Math.max(0, index - 1);
      if (listed[next]) select(listed[next].id);
    }
  }, [state.selectedId, state.showTable, state.showShortcuts, listed, dispatch, select]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="console" data-pane={state.pane} data-bands={state.highContrastBands ? "mono" : "ramp"}>
        <CommandBar
          counts={counts} activeBands={state.bands}
          onBands={(bands) => dispatch({ type: "setBands", bands })}
          health={health} computedAt={computedAt} stale={Boolean(loadError)}
          onBack={onBack} highContrast={state.highContrastBands}
          onToggleContrast={() => dispatch({ type: "toggleContrast" })}
          onShortcuts={() => dispatch({ type: "toggleShortcuts" })}
          onTable={() => dispatch({ type: "toggleTable" })}
          themeMode={theme.mode} onThemeMode={theme.setMode}
        />

        <PaneTabs pane={state.pane} onPane={(pane) => dispatch({ type: "pane", pane })} />

        <div className="console-grid">
          <aside className="region region-list">
            <Watchlist
              segments={listed} total={allSegments.length} selectedId={state.selectedId}
              sort={state.sort} onSort={(key) => dispatch({ type: "sort", key })}
              query={query} onQuery={setQuery}
              onSelect={select} onHover={hover}
              onClearFilters={() => { dispatch({ type: "clearFilters" }); setQuery(""); }}
            />
          </aside>

          <section className="region region-map">
            <MapPane
              data={geojson} selectedId={state.selectedId} hoveredId={state.hoveredId}
              bands={state.bands} brush={state.brush} layer={state.mapLayer}
              onLayer={(layer) => dispatch({ type: "mapLayer", layer })}
              onSelect={select} onHover={hover} zoomNonce={zoomNonce}
              dark={theme.resolved === "dark"}
            />
          </section>

          <section className="region region-strip">
            <CorridorStrip
              segments={allSegments} visibleIds={visibleIds} selectedId={state.selectedId}
              brush={state.brush} onBrush={(range) => dispatch({ type: "brush", range })}
              onSelect={select} thresholds={sortedThresholds}
            />
          </section>

          <aside className="region region-inspector">
            <Inspector segmentId={state.selectedId} thresholds={sortedThresholds}
                       summary={summary} onZoom={() => { setZoomNonce((n) => n + 1); dispatch({ type: "pane", pane: "map" }); }}
                       onClose={() => select(null)} />
          </aside>
        </div>

        <TableView segments={allSegments} open={state.showTable}
                   onOpenChange={() => dispatch({ type: "toggleTable" })} />
        <Shortcuts open={state.showShortcuts}
                   onOpenChange={() => dispatch({ type: "toggleShortcuts" })} />
      </div>
    </Tooltip.Provider>
  );
}
