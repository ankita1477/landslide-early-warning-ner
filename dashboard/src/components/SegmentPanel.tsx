import { useEffect, useState } from "react";
import { api, type SegmentDetail } from "../api/client";
import { TIER_COLOR } from "../theme";

/** Each bar is one term of RISK = S x P_t x D x E. An official who cannot see
 *  why a segment is red has no basis to act on it. */
function ComponentBar({ label, value, max, note }: {
  label: string; value: number; max: number; note?: string;
}) {
  return (
    <div className="component">
      <div className="component-head">
        <span>{label}</span>
        <strong>{value.toFixed(3)}</strong>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function SegmentPanel({ segmentId }: { segmentId: string | null }) {
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!segmentId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setError(null);
    api
      .segment(segmentId)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [segmentId]);

  if (!segmentId) {
    return (
      <div className="panel empty">
        <p className="muted">Select a segment on the map or in the watchlist.</p>
      </div>
    );
  }
  if (error) return <div className="panel"><p className="error">{error}</p></div>;
  if (!detail) return <div className="panel"><p className="muted">Loading…</p></div>;

  const c = detail.components;
  return (
    <div className="panel">
      <div className="panel-head" style={{ borderColor: TIER_COLOR[detail.tier] }}>
        <div>
          <h2>{detail.highway_code} · km {detail.chainage_km.toFixed(3)}</h2>
          <p className="muted">
            {detail.horizon_h} h horizon · scored{" "}
            {new Date(detail.computed_at).toLocaleString()}
          </p>
        </div>
        <div className="tier-badge" style={{ background: TIER_COLOR[detail.tier] }}>
          {detail.tier}
        </div>
      </div>

      <div className="risk-figure">
        <span className="risk-value">{detail.risk.toFixed(4)}</span>
        <span className="muted">risk score</span>
      </div>

      <h3>Why</h3>
      <ComponentBar label="Susceptibility (S)" value={c.susceptibility} max={1}
        note="p90 of susceptibility within the runout reach" />
      <ComponentBar label="Trigger probability (P)" value={c.trigger_probability} max={0.03}
        note="calibrated daily probability, so it is small by construction" />
      <ComponentBar label="Deformation modifier (D)" value={c.deformation_modifier} max={1.5}
        note={c.deformation_modifier === 1 ? "no InSAR coverage — amplifies nothing" : "creep detected"} />
      <ComponentBar label="Exposure (E)" value={c.exposure} max={1} />

      <dl className="facts">
        <div><dt>Hazard (S×P×D)</dt><dd>{detail.hazard.toFixed(4)}</dd></div>
        <div><dt>Segment length</dt><dd>{detail.length_m.toFixed(0)} m</dd></div>
        <div>
          <dt>Runout reach</dt>
          <dd>{detail.runout_reach_m ? `${detail.runout_reach_m.toFixed(0)} m` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
