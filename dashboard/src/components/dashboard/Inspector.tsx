import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Crosshair, Download, X } from "lucide-react";
import { api, type SegmentDetail, type Tier } from "../../api/client";
import { TIER_COLOR, TIER_INK, TIER_WORD } from "../../theme";
import { LayerStack } from "../visuals/LayerStack";
import { LAYER_SERIES } from "../../lib/bands";
import { EASE_OUT_EXPO } from "../../lib/motion";
import facts from "../../data/segments.json";
import rainfall from "../../data/rainfall.json";

type Facts = Record<string, Record<string, number | string | null>>;
const FACTS = facts as Facts;

/** The empty state carries the corridor summary rather than sitting blank —
 *  420px of nothing is the largest wasted area on the screen, and this is what
 *  an operator wants before they have picked anything. */
function EmptyState({ summary }: { summary: Summary | null }) {
  return (
    <div className="inspector">
      <p className="empty-title">The corridor now</p>
      <p className="empty-help">
        Pick a segment on the map, the list, or the strip to see what drives it.
      </p>

      {summary && (
        <>
          <section className="panel peak" style={{ background: `var(--${summary.worst.tier}-wash)` }}>
            <h3 className="micro" style={{ color: TIER_INK[summary.worst.tier] }}>Highest risk now</h3>
            <div className="peak-km">km {summary.worst.chainage_km.toFixed(1)}</div>
            <div className="peak-meta mono" style={{ color: TIER_INK[summary.worst.tier] }}>
              {TIER_WORD[summary.worst.tier]} · {summary.worst.risk.toFixed(4)}
            </div>
          </section>

          <section className="panel">
            <h3 className="micro">Across {summary.counts.reduce((n, c) => n + c.n, 0)} segments</h3>
            <ul className="summary-bands">
              {summary.counts.map((c) => (
                <li key={c.tier}>
                  <span className="swatch" style={{ background: TIER_COLOR[c.tier] }} aria-hidden="true" />
                  <span className="legend-label">{TIER_WORD[c.tier]}</span>
                  <span className="count-bar" aria-hidden="true">
                    <span style={{ width: `${(c.n / Math.max(1, summary.counts.reduce((n, x) => n + x.n, 0))) * 100}%`, background: TIER_COLOR[c.tier] }} />
                  </span>
                  <span className="legend-value mono">{c.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3 className="micro">Alert thresholds</h3>
            <dl className="facts one-col">
              {summary.thresholds.map((t) => (
                <div key={t.tier}>
                  <dt>{TIER_WORD[t.tier as Tier]} at or above</dt>
                  <dd className="mono">{t.threshold.toFixed(4)}</dd>
                </div>
              ))}
            </dl>
            <p className="panel-note">
              Calibrated for this corridor from its own risk distribution, not
              fixed constants.
            </p>
          </section>

          <section className="panel">
            <h3 className="micro">How a score is built</h3>
            <div className="insp-stack"><LayerStack /></div>
          </section>
        </>
      )}
    </div>
  );
}

/** A meter rather than a chart: the fill carries severity, and the band
 *  thresholds sit on it so the reader can see how close this segment is to
 *  escalating. */
function ScoreMeter({ risk, tier, thresholds }: {
  risk: number; tier: string; thresholds: { tier: string; threshold: number }[];
}) {
  const scale = Math.max(risk, ...thresholds.map((t) => t.threshold)) * 1.25;
  return (
    <div className="meter">
      <div className="meter-track">
        <div className="meter-fill"
             style={{
               background: TIER_COLOR[tier as keyof typeof TIER_COLOR],
               width: `${(risk / scale) * 100}%`,
             }} />
        {thresholds.map((t) => (
          <span key={t.tier} className="meter-tick"
                style={{ left: `${(t.threshold / scale) * 100}%` }}
                title={`${t.tier} threshold`} />
        ))}
      </div>
      <div className="meter-legend mono">
        {thresholds.map((t) => (
          <span key={t.tier}>{t.tier} {t.threshold.toFixed(4)}</span>
        ))}
      </div>
    </div>
  );
}

/** Categorical palette, fixed order. Bar length already encodes magnitude, so
 *  colour here is identity — reusing the risk ramp would re-encode severity and
 *  make a blue "susceptibility" segment read as a band. */
function Contributions({ detail }: { detail: SegmentDetail }) {
  const values = [
    detail.components.susceptibility,
    detail.components.trigger_probability,
    detail.components.deformation_modifier - 1,
    detail.components.exposure,
  ];
  // Each factor is normalised to its own plausible range: the model multiplies
  // these, so a share-of-sum would be arithmetic the score never performs.
  const maxima = [1, 0.03, 0.5, 1];
  const shares = values.map((v, i) => Math.max(v / maxima[i], 0));
  const total = shares.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="contrib">
      <div className="contrib-bar" role="img"
           aria-label={LAYER_SERIES.map((s, i) => `${s.label} ${values[i].toFixed(3)}`).join(", ")}>
        {LAYER_SERIES.map((series, i) => (
          <span key={series.key} className="contrib-seg"
                style={{
                  background: series.color,
                  flexGrow: shares[i] / total,
                  transitionDelay: `${i * 60}ms`,
                }} />
        ))}
      </div>
      <ul className="contrib-legend">
        {LAYER_SERIES.map((series, i) => (
          <li key={series.key}>
            <span className="swatch" style={{ background: series.color }} aria-hidden="true" />
            <span className="legend-label">{series.label}</span>
            <span className="legend-value mono">{values[i].toFixed(3)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RainfallChart({ chainage }: { chainage: number }) {
  const series = (rainfall.rain7_mm as Record<string, number[]>)[String(chainage)];
  if (!series?.length) return null;
  const w = 380, h = 92, pad = 6;
  const max = Math.max(...series, 1);
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = series.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${line} L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;

  return (
    <section className="panel">
      <h3 className="micro">Antecedent rainfall</h3>
      <p className="panel-note">
        7-day accumulation over the 2016 replay window — the only per-segment
        rainfall the pipeline stores.
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="rain-chart" role="img"
           aria-label={`7-day antecedent rainfall, peak ${max.toFixed(0)} millimetres`}>
        <path d={area} fill="var(--layer-trigger)" fillOpacity={0.1} />
        <path d={line} fill="none" stroke="var(--layer-trigger)" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r={4}
                fill="var(--layer-trigger)" stroke="var(--panel)" strokeWidth={2} />
      </svg>
      <div className="chart-foot mono">
        <span>{rainfall.days[0]}</span>
        <span>{series[series.length - 1].toFixed(0)} mm</span>
      </div>
    </section>
  );
}

const FEATURE_ROWS = [
  ["slope_deg", "Slope", "°"], ["aspect_deg", "Aspect", "°"],
  ["plan_curv", "Plan curvature", ""], ["prof_curv", "Profile curvature", ""],
  ["twi", "Wetness index", ""], ["spi", "Stream power", ""],
  ["dist_to_road_m", "Distance to road", " m"], ["elevation_m", "Elevation", " m"],
] as const;

export interface Summary {
  worst: { chainage_km: number; risk: number; tier: Tier };
  counts: { tier: Tier; n: number }[];
  thresholds: { tier: string; threshold: number }[];
}

export function Inspector({ segmentId, thresholds, summary, onZoom, onClose }: {
  segmentId: string | null;
  thresholds: { tier: string; threshold: number }[];
  summary: Summary | null;
  onZoom: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!segmentId) { setDetail(null); return; }
    let cancelled = false;
    setError(null); setDetail(null);
    api.segment(segmentId)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [segmentId]);

  if (!segmentId) return <EmptyState summary={summary} />;
  if (error) {
    return (
      <div className="inspector">
        <div className="pane-error">
          <p>Could not load this segment.</p>
          <p className="mono tiny">{error}</p>
          <button className="btn btn-ghost" onClick={() => setDetail(null)}>Retry</button>
        </div>
      </div>
    );
  }
  if (!detail) return <div className="inspector"><div className="skeleton-stack" /></div>;

  const f = FACTS[String(detail.chainage_km)] ?? {};
  const rows = showAll ? FEATURE_ROWS : FEATURE_ROWS.slice(0, 4);

  return (
    // Entrance animates position only. Starting from opacity 0 means that if the
    // animation never runs — a stalled frame loop, a remount mid-fetch — the
    // whole panel stays invisible while its data sits in the DOM.
    <motion.div className="inspector" key={detail.id}
                initial={{ y: 10 }} animate={{ y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}>
      <div className="insp-head">
        <div>
          <div className="insp-km">km {detail.chainage_km.toFixed(1)}</div>
          <div className="insp-coords mono">
            {f.lat != null ? `${Number(f.lat).toFixed(4)}, ${Number(f.lon).toFixed(4)}` : "—"}
            {f.elevation_m != null && ` · ${Number(f.elevation_m).toFixed(0)} m`}
          </div>
        </div>
        <span className="band-tag" style={{ background: `var(--${detail.tier}-wash)`, color: TIER_INK[detail.tier] }}>
          <span className="band-dot" style={{ background: TIER_COLOR[detail.tier] }} aria-hidden="true" />
          {TIER_WORD[detail.tier]}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>

      <section className="panel">
        <h3 className="micro">Composite score</h3>
        <div className="insp-score mono">{detail.risk.toFixed(4)}</div>
        <ScoreMeter risk={detail.risk} tier={detail.tier} thresholds={thresholds} />
      </section>

      <section className="panel">
        <h3 className="micro">What drives it</h3>
        <Contributions detail={detail} />
      </section>

      <RainfallChart chainage={detail.chainage_km} />

      <section className="panel">
        <h3 className="micro">Terrain</h3>
        <dl className="facts">
          {rows.map(([key, label, unit]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd className="mono">
                {f[key] == null ? "—" : `${Number(f[key]).toFixed(key === "elevation_m" || key === "dist_to_road_m" ? 0 : 2)}${unit}`}
              </dd>
            </div>
          ))}
        </dl>
        <button className="btn btn-ghost btn-xs" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer features" : "Show all features"}
        </button>
        <p className="panel-note">
          The model uses these terrain features only. Lithology, land cover and
          distance to fault were never built, so they are absent rather than blank.
        </p>
      </section>

      <section className="panel">
        <h3 className="micro">Nearby history</h3>
        <p className="fact-line">
          {Number(f.scars_within_500m) > 0
            ? `${f.scars_within_500m} mapped scar${Number(f.scars_within_500m) > 1 ? "s" : ""} within 500 m · nearest ${f.nearest_scar_m} m`
            : "No mapped scars within 500 m"}
        </p>
        <p className="panel-note">
          The Sikkim inventory records extents, not dates, so these carry no date.
        </p>
        <p className="fact-line">
          InSAR: {f.insar_coverage === "none"
            ? "no coherent pixels — this slope is not observable"
            : `${f.creep_state} · coverage ${f.insar_coverage}`}
        </p>
      </section>

      <div className="insp-actions">
        <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(detail.id)}>
          <Copy size={14} /> Copy ID
        </button>
        <button className="btn btn-ghost" onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify({ ...detail, terrain: f }, null, 2)],
                     { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url; a.download = `${detail.id.replace(":", "_")}.json`; a.click();
          URL.revokeObjectURL(url);
        }}><Download size={14} /> JSON</button>
        <button className="btn btn-ghost" onClick={onZoom}><Crosshair size={14} /> Open in map</button>
      </div>
    </motion.div>
  );
}
