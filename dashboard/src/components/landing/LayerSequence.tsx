import { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import {
  ExposureNodes,
  FringePattern,
  RainfallStreaks,
  TerrainField,
} from "../visuals/LayerVisuals";

interface Layer {
  n: number;
  name: string;
  question: string;
  body: string;
  status: "working" | "in progress";
  visual: (props: { active: boolean }) => React.ReactElement;
}

const LAYERS: Layer[] = [
  {
    n: 1,
    name: "Susceptibility",
    question: "Where are slopes intrinsically weak?",
    body:
      "XGBoost over 9 terrain features, trained on 175 mapped landslide polygons. " +
      "Blocked AUC 0.866; the top 5% of the corridor holds 40% of all mapped scar area.",
    status: "working",
    visual: TerrainField,
  },
  {
    n: 2,
    name: "Rainfall trigger",
    question: "When will rain set it off?",
    body:
      "Antecedent rainfall from CHIRPS and IMERG, calibrated to the true daily event " +
      "rate. AUC 0.60 within the monsoon, and 31.7× lift over base rate.",
    status: "working",
    visual: RainfallStreaks,
  },
  {
    n: 3,
    name: "Deformation",
    question: "Is the slope already moving?",
    body:
      "Sentinel-1 InSAR. Coherence over this corridor is 0.095 median against a 0.30 " +
      "threshold — vegetated Himalayan slopes are invisible to C-band radar. " +
      "37 of 116 segments observable, all stable, so deformation amplifies nothing.",
    status: "in progress",
    visual: FringePattern,
  },
  {
    n: 4,
    name: "Exposure",
    question: "Who and what is in the way?",
    body:
      "Each segment aggregates hazard at the 90th percentile within its runout reach " +
      "— 100 to 815 m, scaled to the relief above it. A kilometre of road is only as " +
      "safe as its worst slope, so a mean would hide the thing worth finding.",
    status: "working",
    visual: ExposureNodes,
  },
];

export function LayerSequence() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });

  useEffect(
    () =>
      scrollYProgress.on("change", (progress) => {
        const index = Math.min(
          LAYERS.length - 1,
          Math.floor(progress * LAYERS.length),
        );
        setActive(index);
      }),
    [scrollYProgress],
  );

  const layer = LAYERS[active];
  const Visual = layer.visual;

  return (
    <section className="layer-sequence" ref={section}>
      <div className="layer-sticky">
        <ol className="layer-rail" aria-label="Model layers">
          {LAYERS.map((item, i) => (
            <li key={item.n}>
              <button
                className={i === active ? "rail-dot active" : "rail-dot"}
                onClick={() =>
                  document
                    .getElementById(`layer-step-${i}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                aria-current={i === active}
                aria-label={`Layer ${item.n}, ${item.name}`}
              >
                <span className="rail-num mono">{item.n}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="layer-panes">
          <motion.div
            className="layer-copy"
            key={layer.n}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="layer-index mono">Layer {layer.n} / 4</div>
            <h3>{layer.name}</h3>
            <p className="question">{layer.question}</p>
            <p className="body">{layer.body}</p>
            <span
              className={
                layer.status === "working" ? "pill pill-ok" : "pill pill-warn"
              }
            >
              <span className="pill-dot" aria-hidden="true" />
              {layer.status}
            </span>
          </motion.div>

          <div className="layer-figure">
            <Visual active key={`v-${layer.n}`} />
          </div>
        </div>
      </div>

      {/* Scroll steps that drive the pin. Below 768px these become the layout. */}
      {LAYERS.map((item, i) => (
        <div className="layer-step" id={`layer-step-${i}`} key={item.n} aria-hidden="true" />
      ))}
    </section>
  );
}
