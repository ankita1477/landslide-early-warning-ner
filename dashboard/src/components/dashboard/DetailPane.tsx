import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type SegmentDetail } from "../../api/client";
import { TIER_COLOR } from "../../theme";
import { EASE_OUT_EXPO } from "../../lib/motion";
import rainfall from "../../data/rainfall.json";

/** Each factor scaled to its own plausible range, because the model multiplies
 *  them rather than adding them — a share of a sum would be arithmetic that the
 *  score does not actually do. The bar shows relative strength, and the number
 *  beside it is the real value. */
const FACTORS = [
  { key: "susceptibility", label: "Susceptibility", max: 1, color: "var(--green)" },
  { key: "trigger_probability", label: "Trigger", max: 0.03, color: "var(--yellow)" },
  { key: "deformation_modifier", label: "Deformation", max: 1.5, color: "var(--orange)" },
  { key: "exposure", label: "Exposure", max: 1, color: "var(--red)" },
] as const;

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const w = 240, h = 44, max = Math.max(...values, 1);
  const d = values
    .map((v, i) => `${i ? "L" : "M"} ${(i / (values.length - 1)) * w} ${h - (v / max) * h}`)
    .join(" ");
  return (
    <div className="sparkline">
      <div className="spark-head mono">
        <span>7-day antecedent rainfall</span>
        <span>{max.toFixed(0)} mm peak</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
           aria-label={`Antecedent rainfall, peak ${max.toFixed(0)} millimetres`}>
        <motion.path d={d} fill="none" stroke="var(--yellow)" strokeWidth={1.6}
                     strokeOpacity={0.85} initial={{ pathLength: 0 }}
                     animate={{ pathLength: 1 }}
                     transition={{ duration: 0.8, ease: EASE_OUT_EXPO }} />
      </svg>
      <div className="spark-foot mono">
        {rainfall.days[0]} → {rainfall.days[rainfall.days.length - 1]}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="detail empty">
      <svg viewBox="0 0 200 120" className="empty-art" aria-hidden="true">
        <path d="M 16 104 C 62 88, 48 58, 88 46 S 148 26, 186 14"
              fill="none" stroke="var(--text-3)" strokeOpacity={0.35}
              strokeWidth={2} strokeLinecap="round" />
        {[[42, 88], [86, 47], [140, 28]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3} fill="var(--text-3)" fillOpacity={0.5} />
        ))}
      </svg>
      <p>Pick a kilometre from the watchlist or the map to see what drives its score.</p>
    </div>
  );
}

export function DetailPane({ segmentId }: { segmentId: string | null }) {
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!segmentId) { setDetail(null); return; }
    let cancelled = false;
    setError(null);
    setDetail(null);
    api.segment(segmentId)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [segmentId]);

  if (!segmentId) return <EmptyState />;
  if (error) return <div className="detail"><p className="error">{error}</p></div>;
  if (!detail) return <div className="detail"><p className="muted mono">loading…</p></div>;

  const series = (rainfall.rain7_mm as Record<string, number[]>)[
    String(detail.chainage_km)
  ] ?? [];

  return (
    <motion.div className="detail" key={detail.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}>
      <div className="detail-head">
        <div>
          <div className="detail-km mono">km {detail.chainage_km.toFixed(3)}</div>
          <div className="detail-highway mono">{detail.highway_code}</div>
        </div>
        <span className="band-chip" style={{ background: TIER_COLOR[detail.tier] }}>
          <span className="pill-dot dark" aria-hidden="true" />
          {detail.tier}
        </span>
      </div>

      <div className="detail-risk">
        <span className="detail-risk-value mono">{detail.risk.toFixed(4)}</span>
        <span className="detail-risk-label">risk score · {detail.horizon_h} h horizon</span>
      </div>

      <h3 className="eyebrow">What drives it</h3>
      <div className="factors">
        {FACTORS.map((factor, i) => {
          const value = detail.components[factor.key];
          const share = Math.min(value / factor.max, 1);
          return (
            <div className="factor" key={factor.key}>
              <div className="factor-head">
                <span>{factor.label}</span>
                <span className="mono">{value.toFixed(3)}</span>
              </div>
              <div className="factor-track">
                <motion.div className="factor-fill"
                            style={{ background: factor.color, transformOrigin: "left" }}
                            initial={{ scaleX: 0 }} animate={{ scaleX: share }}
                            transition={{ duration: 0.7, delay: 0.1 + i * 0.09,
                                          ease: EASE_OUT_EXPO }} />
              </div>
            </div>
          );
        })}
      </div>

      <Sparkline values={series} />

      <dl className="facts mono">
        <div><dt>Hazard S×P×D</dt><dd>{detail.hazard.toFixed(4)}</dd></div>
        <div><dt>Length</dt><dd>{detail.length_m.toFixed(0)} m</dd></div>
        <div>
          <dt>Runout reach</dt>
          <dd>{detail.runout_reach_m ? `${detail.runout_reach_m.toFixed(0)} m` : "—"}</dd>
        </div>
      </dl>
    </motion.div>
  );
}
