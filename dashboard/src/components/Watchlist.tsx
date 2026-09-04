import type { SegmentSummary } from "../api/client";
import { TIER_COLOR } from "../theme";

interface Props {
  segments: SegmentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Ranked worst-first — the landing query for a control room. */
export function Watchlist({ segments, selectedId, onSelect }: Props) {
  return (
    <div className="watchlist">
      <h2>Watchlist</h2>
      <p className="muted">{segments.length} highest-risk kilometres</p>
      <ol>
        {segments.map((segment, index) => (
          <li key={segment.id}>
            <button
              className={segment.id === selectedId ? "row selected" : "row"}
              onClick={() => onSelect(segment.id)}
            >
              <span className="rank">{index + 1}</span>
              <span className="dot" style={{ background: TIER_COLOR[segment.tier] }} />
              <span className="chainage">km {segment.chainage_km.toFixed(1)}</span>
              <span className="tier">{segment.tier}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
