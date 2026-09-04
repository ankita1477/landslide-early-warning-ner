import { useState } from "react";
import type { FeatureCollection } from "geojson";
import type { Health, SegmentSummary } from "../../api/client";
import { Header } from "./Header";
import { Watchlist } from "./Watchlist";
import { RiskMap } from "./RiskMap";
import { DetailPane } from "./DetailPane";

type Pane = "map" | "list";

export function Console({ geojson, watchlist, allSegments, health, computedAt, onBack }: {
  geojson: FeatureCollection | null;
  watchlist: SegmentSummary[];
  allSegments: SegmentSummary[];
  health: Health | null;
  computedAt: string | null;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Below 768px the three panes cannot coexist, so they become tabs.
  const [pane, setPane] = useState<Pane>("map");

  return (
    <div className="console" data-pane={pane}>
      <Header allSegments={allSegments} health={health} computedAt={computedAt}
              onBack={onBack} />

      <nav className="pane-tabs" aria-label="View">
        {(["map", "list"] as const).map((option) => (
          <button key={option} className={pane === option ? "active" : ""}
                  onClick={() => setPane(option)} aria-pressed={pane === option}>
            {option === "map" ? "Map" : "Watchlist"}
          </button>
        ))}
      </nav>

      <main className="console-body">
        <aside className="pane pane-left">
          <Watchlist segments={watchlist} selectedId={selectedId}
                     onSelect={setSelectedId} onHover={setHoveredId} />
        </aside>

        <section className="pane pane-map">
          <RiskMap data={geojson} selectedId={selectedId} hoveredId={hoveredId}
                   onSelect={setSelectedId} />
        </section>

        <aside className="pane pane-right">
          <DetailPane segmentId={selectedId} />
        </aside>
      </main>
    </div>
  );
}
