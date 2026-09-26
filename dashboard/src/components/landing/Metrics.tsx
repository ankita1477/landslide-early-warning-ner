import { useCountUp } from "../../lib/useCountUp";
import { CORRIDOR } from "../../lib/corridor";

const METRICS = [
  { value: 0.866, decimals: 3, suffix: "", label: "Susceptibility AUC", note: "spatially blocked, 59 blocks" },
  { value: 8, decimals: 0, suffix: " days", label: "Warning before a real landslide", note: "21 Jul 2016 · 11 m from NH-10" },
  { value: 31.7, decimals: 1, suffix: "×", label: "Trigger lift over base rate", note: "calibrated daily probability" },
  { value: CORRIDOR.segments, decimals: 0, suffix: "", label: "Road segments scored", note: `${CORRIDOR.lengthKm} km, Sevoke to Gangtok` },
] as const;

function Metric({ metric }: { metric: (typeof METRICS)[number] }) {
  // Counts on mount rather than waiting on an observer — a figure that never
  // reveals would show 0, which is a wrong number rather than a missing animation.
  const shown = useCountUp(metric.value, metric.decimals, true);
  return (
    <div className="metric">
      <div className="metric-value mono">{shown}<span className="metric-suffix">{metric.suffix}</span></div>
      <div className="metric-label">{metric.label}</div>
      <div className="metric-note mono">{metric.note}</div>
    </div>
  );
}

export function Metrics() {
  return (
    <section className="metrics" aria-label="Headline figures">
      {METRICS.map((m) => <Metric key={m.label} metric={m} />)}
    </section>
  );
}
