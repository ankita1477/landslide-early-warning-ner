import { memo, useEffect, useRef } from "react";
import { ToggleGroup } from "radix-ui";
import { Download, Search, X } from "lucide-react";
import type { SegmentSummary, SortKey } from "../../lib/useDashboardState";
import type { Tier } from "../../api/client";
import { TIER_COLOR, TIER_INK, TIER_WORD } from "../../theme";

interface RowProps {
  segment: { id: string; chainage_km: number; risk: number; tier: Tier };
  rank: number;
  selected: boolean;
  maxRisk: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const Row = memo(function Row({ segment, rank, selected, maxRisk, onSelect, onHover }: RowProps) {
  const ref = useRef<HTMLLIElement>(null);
  // Selection can arrive from the map, so the row has to bring itself into view.
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: "nearest" }); }, [selected]);

  return (
    <li ref={ref}>
      <button
        className={selected ? "wl-row selected" : "wl-row"}
        style={{ ["--band" as string]: TIER_COLOR[segment.tier], ["--band-ink" as string]: TIER_INK[segment.tier] }}
        onClick={() => onSelect(segment.id)}
        onMouseEnter={() => onHover(segment.id)} onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(segment.id)} onBlur={() => onHover(null)}
        aria-current={selected}
      >
        <span className="wl-rank mono">{String(rank + 1).padStart(2, "0")}</span>
        <span className="wl-km mono">km {segment.chainage_km.toFixed(1)}</span>
        {/* A bar for the score, so the list reads as a chart at a glance. */}
        <span className="wl-bar" aria-hidden="true">
          <span className="wl-bar-fill" style={{ width: `${(segment.risk / maxRisk) * 100}%` }} />
        </span>
        <span className="wl-risk mono">{segment.risk.toFixed(4)}</span>
        {/* Band is never signalled by colour alone. */}
        <span className="wl-band">{TIER_WORD[segment.tier]}</span>
      </button>
    </li>
  );
});

interface Props {
  segments: SegmentSummary[];
  total: number;
  selectedId: string | null;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onClearFilters: () => void;
}

export function Watchlist({
  segments, total, selectedId, sort, onSort, query, onQuery, onSelect, onHover, onClearFilters,
}: Props) {
  const maxRisk = Math.max(...segments.map((s) => s.risk), 0.0001);

  const exportCsv = () => {
    const header = "rank,segment_id,chainage_km,risk,band\n";
    const body = segments.map((s, i) => `${i + 1},${s.id},${s.chainage_km},${s.risk},${s.tier}`).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = "nh10-watchlist.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="watchlist">
      <div className="wl-head">
        <div className="wl-title-row">
          <h2 className="micro">Segments</h2>
          <p className="wl-count mono">{segments.length} / {total}</p>
        </div>
        <label className="search">
          <Search size={14} />
          <input value={query} onChange={(e) => onQuery(e.target.value)} inputMode="decimal"
                 placeholder="Jump to km…" aria-label="Filter by kilometre" />
          {query && <button className="search-clear" onClick={() => onQuery("")} aria-label="Clear"><X size={13} /></button>}
        </label>
        <ToggleGroup.Root type="single" value={sort} className="seg-group" aria-label="Sort"
                          onValueChange={(v) => v && onSort(v as SortKey)}>
          <ToggleGroup.Item value="risk" className="seg">By risk</ToggleGroup.Item>
          <ToggleGroup.Item value="km" className="seg">By km</ToggleGroup.Item>
          <ToggleGroup.Item value="change" className="seg" disabled
                            title="Sorting by change needs a previous scored run; the API stores only the latest">
            By change
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      {total === 0 ? (
        <div className="wl-empty">
          <p>Loading the corridor…</p>
          <p className="wl-empty-note">The first visit can take up to a minute while the server wakes.</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="wl-empty">
          <p>No segments match.</p>
          <button className="btn btn-ghost" onClick={onClearFilters}>Clear filters</button>
        </div>
      ) : (
        <ol className="wl-rows">
          {segments.map((segment, i) => (
            <Row key={segment.id} segment={segment} rank={i} maxRisk={maxRisk}
                 selected={segment.id === selectedId} onSelect={onSelect} onHover={onHover} />
          ))}
        </ol>
      )}

      <footer className="wl-foot">
        <button className="btn btn-ghost" onClick={exportCsv}><Download size={14} /> Export CSV</button>
      </footer>
    </div>
  );
}
