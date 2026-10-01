import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Landing } from "./components/landing/Landing";
import { Console } from "./components/dashboard/Console";
import { api, type Health, type SegmentSummary, type TierThreshold } from "./api/client";
import { useThemeMode } from "./lib/themeMode";
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
  const theme = useThemeMode();

  // The hosted API sleeps when idle and takes up to a minute to answer the
  // first request; until then the proxy in front of it returns 502s. So a
  // failure is retried with growing gaps for about two minutes before it is
  // reported, and the error clears itself if a later attempt succeeds.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const attempt = (delay: number) => {
      Promise.all([api.geojson(), api.watchlist(25), api.health(), api.segments(), api.tiers()])
        .then(([g, w, h, s, t]) => {
          if (cancelled) return;
          setGeojson(g); setWatchlist(w.segments); setHealth(h); setAll(s.segments); setThresholds(t);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          if (Date.now() - started > 120_000) setError(String(e));
          timer = setTimeout(() => attempt(Math.min(delay * 2, 15_000)), delay);
        });
    };
    attempt(2_000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
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
          Can't reach the data server yet. Still retrying — please wait.
          <span className="mono tiny"> ({error})</span>
        </div>
      )}
      {onDashboard ? (
        <Console geojson={geojson} allSegments={all} health={health} thresholds={thresholds}
                 computedAt={computedAt} loadError={error} theme={theme}
                 onBack={() => { window.location.hash = "#/"; }} />
      ) : (
        <Landing segments={all} segmentsLoaded={health?.segments_loaded ?? null}
                 computedAt={computedAt} theme={theme}
                 onEnter={() => { window.location.hash = "#/dashboard"; }} />
      )}
    </>
  );
}
