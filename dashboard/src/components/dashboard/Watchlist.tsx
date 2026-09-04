import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { SegmentSummary, SortKey } from "../../lib/useDashboardState";
import type { Tier } from "../../api/client";
import { TIER_COLOR } from "../../theme";
import { EASE_OUT_EXPO } from "../../lib/motion";

interface RowProps {
  segment: { id: string; chainage_km: number; risk: number; tier: Tier };
  rank: number;
  selected: boolean;
  firstMount: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const Row = memo(function Row({
  segment, rank, selected, firstMount, onSelect, onHover,
}: RowProps) {
  const ref = useRef<HTMLLIElement>(null);

  // Selection can arrive from the map, so the row has to bring itself into view.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <motion.li
      ref={ref}
      layout
      initial={firstMount ? { x: -10 } : false}
      animate={{ x: 0 }}
      transition={{ duration: 0.35, delay: firstMount ? rank * 0.025 : 0, ease: EASE_OUT_EXPO }}
    >
      <button
        className={selected ? "wl-row selected" : "wl-row"}
        style={{ ["--band" as string]: TIER_COLOR[segment.tier] }}
        onClick={() => onSelect(segment.id)}
        onMouseEnter={() => onHover(segment.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(segment.id)}
        onBlur={() => onHover(null)}
        aria-current={selected}
      >
        <span className="wl-rank mono">{String(rank + 1).padStart(2, "0")}</span>
        <span className="wl-dot" aria-hidden="true" />
        <span className="wl-km mono">km {segment.chainage_km.toFixed(1)}</span>
        {/* Band is never signalled by the dot alone. */}
        <span className="wl-band">{segment.tier}</span>
      </button>
    </motion.li>
  );
});

interface Props {
  segments: SegmentSummary[];
  total: number;
  selectedId: string | null;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onClearFilters: () => void;
  onTable: () => void;
}

export function Watchlist({
  segments, total, selectedId, sort, onSort, onSelect, onHover, onClearFilters, onTable,
}: Props) {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const firstMount = !mounted.current;

  const exportCsv = () => {
    const header = "rank,segment_id,chainage_km,risk,band\n";
    const body = segments
      .map((s, i) => `${i + 1},${s.id},${s.chainage_km},${s.risk},${s.tier}`)
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nh10-watchlist.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="watchlist">
      <div className="wl-head">
        <h2 className="micro">Watchlist</h2>
        <p className="wl-count">
          <span className="mono">{segments.length}</span> of{" "}
          <span className="mono">{total}</span> kilometres
        </p>
        <div className="sorts" role="group" aria-label="Sort watchlist">
          {(["risk", "km"] as const).map((key) => (
            <button key={key} className={sort === key ? "sort on" : "sort"}
                    onClick={() => onSort(key)} aria-pressed={sort === key}>
              {key}
            </button>
          ))}
          <button className="sort disabled" disabled
                  title="Sorting by change needs a previous scored run; the API stores only the latest">
            change
          </button>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="wl-empty">
          <p>No segments match these filters.</p>
          <button className="ghost" onClick={onClearFilters}>Clear filters</button>
        </div>
      ) : (
        <ol className="wl-rows">
          {segments.map((segment, i) => (
            <Row key={segment.id} segment={segment} rank={i}
                 selected={segment.id === selectedId} firstMount={firstMount}
                 onSelect={onSelect} onHover={onHover} />
          ))}
        </ol>
      )}

      <footer className="wl-foot">
        <button className="ghost" onClick={exportCsv}>Export CSV</button>
        <button className="ghost" onClick={onTable}>View as table</button>
      </footer>
    </div>
  );
}
