import type { Health, SegmentSummary, Tier } from "../../api/client";
import { TIER_COLOR } from "../../theme";

const ORDER: Tier[] = ["red", "orange", "yellow", "green"];

export function Header({ allSegments, health, computedAt, onBack }: {
  /** Every segment, not the watchlist: these counts describe the whole corridor. */
  allSegments: SegmentSummary[];
  health: Health | null;
  computedAt: string | null;
  onBack: () => void;
}) {
  const counts = ORDER.map((tier) => ({
    tier,
    n: allSegments.filter((s) => s.tier === tier).length,
  }));

  return (
    <header className="console-head">
      <button className="back" onClick={onBack} aria-label="Back to the overview">
        ←
      </button>
      <div className="console-title">
        <h1>NH-10 Landslide Risk</h1>
        <p className="console-sub mono">Sevoke – Gangtok · 109.6 km · 116 segments</p>
      </div>

      <div className="band-pills">
        {counts.map(({ tier, n }) => (
          <span className="pill count-pill" key={tier}>
            <span className="pill-dot" style={{ background: TIER_COLOR[tier] }}
                  aria-hidden="true" />
            {tier} <strong className="mono">{n}</strong>
          </span>
        ))}
      </div>

      <div className="console-status">
        {health && (
          <span className={health.status === "ok" ? "pill live" : "pill live degraded"}>
            <span className="live-dot" aria-hidden="true" />
            {health.status} · <span className="mono">{health.segments_loaded}</span> segments
          </span>
        )}
        {computedAt && (
          <span className="scored-at mono" title="Last scored">
            scored {new Date(computedAt).toISOString().slice(0, 16).replace("T", " ")}Z
          </span>
        )}
      </div>
    </header>
  );
}
