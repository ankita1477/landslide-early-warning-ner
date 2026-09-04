import { motion } from "framer-motion";
import type { SegmentSummary } from "../../api/client";
import { TIER_COLOR } from "../../theme";
import { EASE_OUT_EXPO } from "../../lib/motion";

export function Watchlist({ segments, selectedId, onSelect, onHover }: {
  segments: SegmentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <div className="watchlist">
      <h2 className="eyebrow">Watchlist</h2>
      <p className="watchlist-sub">25 highest-risk kilometres</p>

      <ol>
        {segments.map((segment, i) => (
          <motion.li
            key={segment.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.025, ease: EASE_OUT_EXPO }}
          >
            <button
              className={segment.id === selectedId ? "wl-row selected" : "wl-row"}
              style={{ ["--band" as string]: TIER_COLOR[segment.tier] }}
              onClick={() => onSelect(segment.id)}
              onMouseEnter={() => onHover(segment.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(segment.id)}
              onBlur={() => onHover(null)}
              aria-current={segment.id === selectedId}
            >
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="pill-dot" style={{ background: TIER_COLOR[segment.tier] }}
                    aria-hidden="true" />
              <span className="km">km {segment.chainage_km.toFixed(1)}</span>
              <span className="wl-band">{segment.tier}</span>
            </button>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
