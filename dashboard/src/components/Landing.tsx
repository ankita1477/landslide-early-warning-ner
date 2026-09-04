import { TIER_COLOR } from "../theme";

interface Props {
  onEnter: () => void;
  segmentsLoaded: number | null;
}

const HEADLINE = [
  { value: "0.866", label: "susceptibility AUC", note: "spatially blocked, 59 blocks" },
  { value: "8 days", label: "warning before a real landslide", note: "21 Jul 2016, 11 m from NH-10" },
  { value: "31.7×", label: "trigger lift over base rate", note: "calibrated daily probability" },
  { value: "116", label: "one-km segments scored", note: "Sevoke to Gangtok, 109.6 km" },
];

const LAYERS = [
  {
    name: "Layer 1 — Susceptibility",
    question: "Where are slopes intrinsically weak?",
    detail:
      "XGBoost over 9 terrain features, trained on 175 mapped landslide polygons. " +
      "Blocked AUC 0.866; the top 5% of the corridor holds 40% of all mapped scar area.",
    status: "working",
  },
  {
    name: "Layer 2 — Rainfall trigger",
    question: "When will rain set it off?",
    detail:
      "Antecedent rainfall from CHIRPS and IMERG, calibrated to the true daily event rate. " +
      "Modest skill — AUC 0.60 within the monsoon — but 31.7× lift for prioritisation.",
    status: "working",
  },
  {
    name: "Layer 3 — Slope creep",
    question: "Is the slope already moving?",
    detail:
      "Sentinel-1 InSAR. Coherence over this corridor is 0.095 median against a 0.30 " +
      "threshold: vegetated Himalayan slopes are invisible to C-band radar. 37 of 116 " +
      "segments observable, all stable, so deformation currently amplifies nothing.",
    status: "not observable",
  },
];

const LIMITS = [
  "Replayed against 42 documented events, the system raised Red before 17% of them — median lead 9 days. Detection, not lead time, is the weak link.",
  "Detection rises to 28% for events within 1 km of the corridor, so inventory location error of 5–25 km is a large part of the gap.",
  "No InSAR exists before March 2025, so Layer 3 cannot improve any historical result.",
];

export function Landing({ onEnter, segmentsLoaded }: Props) {
  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="landing-head">
          <div className="tier-strip">
            {(["green", "yellow", "orange", "red"] as const).map((tier) => (
              <span key={tier} style={{ background: TIER_COLOR[tier] }} />
            ))}
          </div>
          <h1>Landslide Early Warning</h1>
          <p className="lede">
            Rainfall-triggered landslide risk for the <strong>NH-10 corridor</strong>,
            Sevoke to Gangtok — scored every kilometre, every day, from satellite data
            alone. No ground sensors.
          </p>
        </header>

        <section className="stats">
          {HEADLINE.map((stat) => (
            <div key={stat.label} className="stat">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-note">{stat.note}</div>
            </div>
          ))}
        </section>

        <section>
          <h2>How it works</h2>
          <p className="formula">
            RISK = susceptibility × trigger probability × deformation × exposure
          </p>
          <div className="layers">
            {LAYERS.map((layer) => (
              <article key={layer.name} className="layer">
                <div className="layer-head">
                  <h3>{layer.name}</h3>
                  <span
                    className={
                      layer.status === "working" ? "pill pill-ok" : "pill pill-warn"
                    }
                  >
                    {layer.status}
                  </span>
                </div>
                <p className="question">{layer.question}</p>
                <p className="detail">{layer.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>What it does not do</h2>
          <ul className="limits">
            {LIMITS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </section>

        <div className="cta">
          <button onClick={onEnter}>Open the dashboard →</button>
          <p className="muted">
            {segmentsLoaded === null
              ? "connecting to the API…"
              : `${segmentsLoaded} segments scored and ready`}
          </p>
        </div>

        <footer className="landing-foot">
          Copernicus GLO-30 · OpenStreetMap · CHIRPS &amp; GPM IMERG via Google Earth
          Engine · Sentinel-1 via COMET-LiCS · landslide inventory from the
          multi-temporal Sikkim catalogue (Zenodo, CC-BY)
        </footer>
      </div>
    </div>
  );
}
