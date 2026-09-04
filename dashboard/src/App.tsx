import { useEffect, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { RiskMap } from "./components/RiskMap";
import { Watchlist } from "./components/Watchlist";
import { SegmentPanel } from "./components/SegmentPanel";
import { Landing } from "./components/Landing";
import { api, type Health, type SegmentSummary, type TierThreshold } from "./api/client";
import { TIER_COLOR, TIER_ORDER } from "./theme";
import "./App.css";

/** Hash routing rather than a router dependency: two pages do not justify one,
 *  and the hash keeps the dashboard linkable with a working back button. */
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [watchlist, setWatchlist] = useState<SegmentSummary[]>([]);
  const [tiers, setTiers] = useState<TierThreshold[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useHashRoute();

  useEffect(() => {
    Promise.all([api.geojson(), api.watchlist(25), api.tiers(), api.health()])
      .then(([g, w, t, h]) => {
        setGeojson(g);
        setWatchlist(w.segments);
        setTiers(t);
        setHealth(h);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const counts = TIER_ORDER.map((tier) => ({
    tier,
    n: (geojson?.features ?? []).filter((f: Feature) => f.properties?.tier === tier).length,
  }));

  if (route !== "#/dashboard") {
    return (
      <Landing
        onEnter={() => {
          window.location.hash = "#/dashboard";
        }}
        segmentsLoaded={health?.segments_loaded ?? null}
      />
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <a className="back" href="#/" title="Back to the overview">
            ←
          </a>
          <div>
            <h1>NH-10 Landslide Risk</h1>
            <p className="muted">Sevoke – Gangtok corridor</p>
          </div>
        </div>
        <div className="legend">
          {counts.map(({ tier, n }) => (
            <span key={tier} className="legend-item">
              <span className="dot" style={{ background: TIER_COLOR[tier] }} />
              {tier} <strong>{n}</strong>
            </span>
          ))}
        </div>
        <div className="status">
          {health ? (
            <span className={health.status === "ok" ? "ok" : "degraded"}>
              {health.status} · {health.segments_loaded} segments
            </span>
          ) : (
            <span className="muted">…</span>
          )}
        </div>
      </header>

      {error && (
        <div className="banner">
          {error} — is the API running? <code>make api</code>
        </div>
      )}

      <main>
        <aside className="left">
          <Watchlist
            segments={watchlist}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {tiers.length > 0 && (
            <div className="thresholds">
              <h3>Tier thresholds</h3>
              <p className="muted">
                Calibrated for this corridor, not the design defaults.
              </p>
              <ul>
                {tiers.map((t) => (
                  <li key={t.tier}>
                    <span className="dot" style={{ background: TIER_COLOR[t.tier] }} />
                    {t.tier} ≥ {t.threshold.toFixed(5)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <RiskMap data={geojson} selectedId={selectedId} onSelect={setSelectedId} />

        <aside className="right">
          <SegmentPanel segmentId={selectedId} />
        </aside>
      </main>
    </div>
  );
}
