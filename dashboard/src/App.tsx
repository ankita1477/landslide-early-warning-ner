import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import { Aurora } from "./components/Aurora";
import { Landing } from "./components/landing/Landing";
import { Console } from "./components/dashboard/Console";
import { api, type Health, type SegmentSummary } from "./api/client";
import { prefersReducedMotion, routeTransition } from "./lib/motion";
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
  const [error, setError] = useState<string | null>(null);
  const route = useHashRoute();
  const onDashboard = route === "#/dashboard";

  useEffect(() => {
    Promise.all([
      api.geojson(), api.watchlist(25), api.health(), api.segments(),
    ])
      .then(([g, w, h, s]) => {
        setGeojson(g);
        setWatchlist(w.segments);
        setHealth(h);
        setAll(s.segments);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // The worst segment carries the scoring timestamp for the whole run.
  useEffect(() => {
    if (!watchlist.length || computedAt) return;
    api.segment(watchlist[0].id)
      .then((d) => setComputedAt(d.computed_at))
      .catch(() => undefined);
  }, [watchlist, computedAt]);

  /** Smooth scroll drives the pinned section. It is skipped entirely when the
   *  visitor asks for reduced motion, and on the dashboard, where hijacking the
   *  scroll of an operations console would be actively unhelpful. */
  useEffect(() => {
    if (onDashboard || prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [onDashboard]);

  useEffect(() => {
    if (!onDashboard) window.scrollTo(0, 0);
  }, [onDashboard]);

  return (
    <>
      <Aurora />
      {error && (
        <div className="banner" role="alert">
          {error} — is the API running? <code className="mono">make api</code>
        </div>
      )}

      <AnimatePresence mode="wait">
        {onDashboard ? (
          <motion.div key="dashboard" variants={routeTransition}
                      initial="hidden" animate="visible" exit="exit">
            <Console geojson={geojson} watchlist={watchlist} allSegments={all}
                     health={health}
                     computedAt={computedAt}
                     onBack={() => { window.location.hash = "#/"; }} />
          </motion.div>
        ) : (
          <motion.div key="landing" variants={routeTransition}
                      initial="hidden" animate="visible" exit="exit">
            <Landing
              segments={all}
              segmentsLoaded={health?.segments_loaded ?? null}
              onEnter={() => { window.location.hash = "#/dashboard"; }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
