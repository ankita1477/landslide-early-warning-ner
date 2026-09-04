import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { Health, SegmentSummary, TierThreshold } from "../../api/client";
import { useDashboardState } from "../../lib/useDashboardState";
import { TIERS } from "../../lib/bands";
import { CommandBar } from "./CommandBar";
import { DateScrubber } from "./DateScrubber";
import { Watchlist } from "./Watchlist";
import { MapPane } from "./MapPane";
import { CorridorStrip } from "./CorridorStrip";
import { Inspector } from "./Inspector";
import { TableView } from "./TableView";
import { Shortcuts } from "./Shortcuts";

interface Props {
  geojson: FeatureCollection | null;
  allSegments: SegmentSummary[];
  health: Health | null;
  thresholds: TierThreshold[];
  computedAt: string | null;
  loadError: string | null;
  onBack: () => void;
}

export function Console({
  geojson, allSegments, health, thresholds, computedAt, loadError, onBack,
}: Props) {
  const { state, dispatch, visible, counts, select, hover } = useDashboardState(allSegments);
  const [zoomNonce, setZoomNonce] = useState(0);

  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible]);
  const sortedThresholds = useMemo(
    () => [...thresholds].sort((a, b) => a.threshold - b.threshold),
    [thresholds],
  );

  const onKey = useCallback(
    (event: KeyboardEvent) => {
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
        const index = visible.findIndex((s) => s.id === state.selectedId);
        const next = event.key === "ArrowDown"
          ? Math.min(visible.length - 1, index + 1)
          : Math.max(0, index - 1);
        if (visible[next]) select(visible[next].id);
      }
    },
    [state.selectedId, state.showTable, state.showShortcuts, visible, dispatch, select],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="console" data-pane={state.pane}
         data-bands={state.highContrastBands ? "mono" : "ramp"}>
      <CommandBar
        counts={counts} activeBands={state.bands}
        onToggleBand={(band) => dispatch({ type: "toggleBand", band })}
        health={health} computedAt={computedAt} stale={Boolean(loadError)}
        onBack={onBack} highContrast={state.highContrastBands}
        onToggleContrast={() => dispatch({ type: "toggleContrast" })}
        onShortcuts={() => dispatch({ type: "toggleShortcuts" })}
      />
      <DateScrubber />

      <nav className="pane-tabs" aria-label="View">
        {(["map", "list", "detail"] as const).map((pane) => (
          <button key={pane} className={state.pane === pane ? "on" : ""}
                  onClick={() => dispatch({ type: "pane", pane })}
                  aria-pressed={state.pane === pane}>
            {pane === "map" ? "Map" : pane === "list" ? "List" : "Detail"}
          </button>
        ))}
      </nav>

      <div className="console-grid">
        <aside className="region region-list">
          <Watchlist
            segments={visible} total={allSegments.length} selectedId={state.selectedId}
            sort={state.sort} onSort={(key) => dispatch({ type: "sort", key })}
            onSelect={select} onHover={hover}
            onClearFilters={() => dispatch({ type: "clearFilters" })}
            onTable={() => dispatch({ type: "toggleTable" })}
          />
        </aside>

        <section className="region region-map">
          <MapPane
            data={geojson} selectedId={state.selectedId} hoveredId={state.hoveredId}
            bands={state.bands} brush={state.brush} layer={state.mapLayer}
            onLayer={(layer) => dispatch({ type: "mapLayer", layer })}
            onSelect={select} onHover={hover} zoomNonce={zoomNonce}
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
                     onZoom={() => setZoomNonce((n) => n + 1)} />
        </aside>
      </div>

      {state.showTable && (
        <TableView segments={allSegments}
                   onClose={() => dispatch({ type: "toggleTable" })} />
      )}
      {state.showShortcuts && (
        <Shortcuts onClose={() => dispatch({ type: "toggleShortcuts" })} />
      )}
    </div>
  );
}
