import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Landing } from "./components/landing/Landing";
import { Console } from "./components/dashboard/Console";
import { api, type Health, type SegmentSummary, type TierThreshold } from "./api/client";
import "./styles/tokens.css";
import "./App.css";

/** Hash routing rather than a router dependency: two routes do not justify one,
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
  const [all, setAll] = useState<SegmentSummary[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<TierThreshold[]>([]);
  const [error, setError] = useState<string | null>(null);
  const route = useHashRoute();
  const onDashboard = route === "#/dashboard";

  useEffect(() => {
    Promise.all([api.geojson(), api.watchlist(25), api.health(), api.segments(), api.tiers()])
      .then(([g, w, h, s, t]) => {
        setGeojson(g); setWatchlist(w.segments); setHealth(h); setAll(s.segments); setThresholds(t);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // The worst segment carries the scoring timestamp for the whole run.
  useEffect(() => {
    if (!watchlist.length || computedAt) return;
    api.segment(watchlist[0].id).then((d) => setComputedAt(d.computed_at)).catch(() => undefined);
  }, [watchlist, computedAt]);

  useEffect(() => { window.scrollTo(0, 0); }, [onDashboard]);

  return (
    <>
      {error && (
        <div className="banner" role="alert">
          {error} — is the API running? <code className="mono">make api</code>
        </div>
      )}
      {onDashboard ? (
        <Console geojson={geojson} allSegments={all} health={health} thresholds={thresholds}
                 computedAt={computedAt} loadError={error}
                 onBack={() => { window.location.hash = "#/"; }} />
      ) : (
        <Landing segments={all} segmentsLoaded={health?.segments_loaded ?? null}
                 computedAt={computedAt}
                 onEnter={() => { window.location.hash = "#/dashboard"; }} />
      )}
    </>
  );
}
