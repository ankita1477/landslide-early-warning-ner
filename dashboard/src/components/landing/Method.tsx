import { CheckCircle2, CircleDashed } from "lucide-react";
import { LayerStack } from "../visuals/LayerStack";

const LAYERS = [
  {
    n: 1, name: "Terrain", ask: "Where are slopes intrinsically weak?",
    body: "Gradient-boosted trees over nine terrain features, trained on 175 mapped landslide polygons. Blocked AUC 0.866; the top 5% of the corridor holds 40% of all mapped scar area.",
    status: "working", color: "var(--layer-susceptibility)",
  },
  {
    n: 2, name: "Rainfall", ask: "When will rain set it off?",
    body: "Antecedent rainfall from CHIRPS and IMERG, calibrated to the true daily event rate. AUC 0.60 within the monsoon and 31.7× lift over base rate.",
    status: "working", color: "var(--layer-trigger)",
  },
  {
    n: 3, name: "Radar", ask: "Is the slope already moving?",
    body: "Sentinel-1 InSAR. Coherence over this corridor is 0.095 median against a 0.30 threshold — vegetated Himalayan slopes are invisible to C-band radar. 37 of 116 segments observable, all stable, so this layer amplifies nothing yet.",
    status: "in progress", color: "var(--layer-deformation)",
  },
  {
    n: 4, name: "People", ask: "Who and what is in the way?",
    body: "Each segment aggregates hazard at the 90th percentile within its runout reach — 100 to 815 m, scaled to the relief above it. A kilometre of road is only as safe as its worst slope.",
    status: "working", color: "var(--layer-exposure)",
  },
] as const;

/** How a score is built: the stack on the left, one row per slab on the right. */
export function Method() {
  return (
    <section className="method">
      <div className="inner method-inner">
        <div className="method-art"><LayerStack /></div>
        <div className="method-copy">
          <p className="eyebrow">How a score is built</p>
          <h2 className="h2">Four readings of the same kilometre, multiplied.</h2>
          <p className="method-lede">
            A weak slope with no rain is quiet. Heavy rain on solid rock is a
            wet day. The score only climbs when the readings agree — which is
            why it is a product, not a sum.
          </p>
          <ol className="layers">
            {LAYERS.map((l) => (
              <li key={l.n} className="layer" style={{ ["--layer" as string]: l.color }}>
                <span className="layer-rail" aria-hidden="true" />
                <div>
                  <div className="layer-head">
                    <span className="layer-n mono">{String(l.n).padStart(2, "0")}</span>
                    <h3>{l.name}</h3>
                    <span className={l.status === "working" ? "pill pill-ok" : "pill pill-warn"}>
                      {l.status === "working" ? <CheckCircle2 size={12} strokeWidth={2.4} /> : <CircleDashed size={12} strokeWidth={2.4} />}
                      {l.status}
                    </span>
                  </div>
                  <p className="layer-ask">{l.ask}</p>
                  <p className="layer-body">{l.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
