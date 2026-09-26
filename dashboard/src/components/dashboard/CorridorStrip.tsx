import { useRef, useState } from "react";
import type { SegmentSummary } from "../../lib/useDashboardState";
import { TIER_COLOR, TIER_WORD } from "../../theme";
import type { Tier } from "../../api/client";

interface Props {
  segments: SegmentSummary[];
  visibleIds: Set<string>;
  selectedId: string | null;
  brush: [number, number] | null;
  onBrush: (range: [number, number] | null) => void;
  onSelect: (id: string) => void;
  thresholds: { tier: string; threshold: number }[];
}

const W = 1200, H = 120;
const PAD = { left: 44, right: 16, top: 14, bottom: 26 };
const CELL_H = 24;

/** A linear profile of the whole corridor.
 *
 *  This is the thing the map genuinely cannot show: a road folded into
 *  a mountain valley hides most of itself at any zoom, so chainage order only
 *  exists here.
 */
export function CorridorStrip({
  segments, visibleIds, selectedId, brush, onBrush, onSelect, thresholds,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [hover, setHover] = useState<SegmentSummary | null>(null);

  const ordered = [...segments].sort((a, b) => a.chainage_km - b.chainage_km);
  // Where the last segment ends: its start plus the kilometre it covers.
  const maxKm = Math.max(...ordered.map((s) => s.chainage_km), 0) + 1;
  const maxRisk = Math.max(...ordered.map((s) => s.risk), 0.001) * 1.15;

  const plotW = W - PAD.left - PAD.right;
  const lineH = H - PAD.top - PAD.bottom - CELL_H - 6;
  const x = (km: number) => PAD.left + (km / maxKm) * plotW;
  const y = (risk: number) => PAD.top + lineH - (risk / maxRisk) * lineH;

  const kmFromEvent = (event: React.MouseEvent) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(maxKm, ((ratio * W) - PAD.left) / plotW * maxKm));
  };

  const riskPath = ordered
    .map((s, i) => `${i ? "L" : "M"} ${x(s.chainage_km).toFixed(1)} ${y(s.risk).toFixed(1)}`)
    .join(" ");

  return (
    <div className="strip">
      <div className="strip-head">
        <h2 className="micro">Along the corridor</h2>
        <span className="strip-hint">drag to narrow the list to a range</span>
        {brush && (
          <button className="btn btn-ghost btn-xs" onClick={() => onBrush(null)}>
            clear <span className="mono">{brush[0].toFixed(0)}–{brush[1].toFixed(0)} km</span>
          </button>
        )}
      </div>

      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="strip-svg"
           onMouseDown={(e) => setDrag({ from: kmFromEvent(e), to: kmFromEvent(e) })}
           onMouseMove={(e) => drag && setDrag({ ...drag, to: kmFromEvent(e) })}
           onMouseUp={() => {
             if (drag && Math.abs(drag.to - drag.from) > 1.5) {
               onBrush([Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)]);
             }
             setDrag(null);
           }}
           onMouseLeave={() => { setDrag(null); setHover(null); }}
           role="img"
           aria-label={`Risk score across ${maxKm} kilometres of NH-10`}>
        {/* Band boundaries as hairline rules — solid, recessive, never dashed. */}
        {thresholds.map((t) => (
          <line key={t.tier} x1={PAD.left} x2={W - PAD.right}
                y1={y(t.threshold)} y2={y(t.threshold)}
                stroke="var(--chart-grid)" strokeWidth={1} />
        ))}

        <path d={riskPath} fill="none" stroke="var(--ink)" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" />

        {ordered.map((s) => {
          const cellW = Math.max(2, plotW / Math.max(1, ordered.length) - 2);
          const dim = !visibleIds.has(s.id);
          return (
            <rect key={s.id} x={x(s.chainage_km)} y={H - PAD.bottom - CELL_H}
                  width={cellW} height={CELL_H} rx={2}
                  fill={TIER_COLOR[s.tier]} fillOpacity={dim ? 0.14 : 1}
                  onMouseEnter={() => setHover(s)}
                  onClick={() => onSelect(s.id)} style={{ cursor: "pointer" }} />
          );
        })}

        {brush && (
          <rect x={x(brush[0])} width={x(brush[1]) - x(brush[0])} y={PAD.top}
                height={H - PAD.top - PAD.bottom} fill="rgba(20,28,38,.06)"
                stroke="rgba(20,28,38,.3)" />
        )}
        {drag && Math.abs(drag.to - drag.from) > 0.5 && (
          <rect x={x(Math.min(drag.from, drag.to))}
                width={Math.abs(x(drag.to) - x(drag.from))} y={PAD.top}
                height={H - PAD.top - PAD.bottom} fill="rgba(20,28,38,.08)" />
        )}

        {selectedId && ordered.find((s) => s.id === selectedId) && (
          <line x1={x(ordered.find((s) => s.id === selectedId)!.chainage_km)}
                x2={x(ordered.find((s) => s.id === selectedId)!.chainage_km)}
                y1={PAD.top} y2={H - PAD.bottom} stroke="var(--ink)" strokeWidth={1.5} />
        )}

        {[0, 20, 40, 60, 80, 100].filter((km) => km <= maxKm).map((km) => (
          <text key={km} x={x(km)} y={H - 8} className="strip-tick mono"
                textAnchor="middle" fill="var(--ink-3)">{km}</text>
        ))}
        <text x={PAD.left - 8} y={PAD.top + 8} textAnchor="end" className="strip-tick mono"
              fill="var(--ink-3)">risk</text>
      </svg>

      {hover && (
        <div className="strip-tip mono">
          km {hover.chainage_km.toFixed(1)} · {hover.risk.toFixed(4)} · {TIER_WORD[hover.tier as Tier]}
        </div>
      )}
    </div>
  );
}
