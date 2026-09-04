import { motion } from "framer-motion";
import { useCountUp } from "../../lib/useCountUp";
import { fadeUp } from "../../lib/motion";

const METRICS = [
  { value: 0.866, decimals: 3, suffix: "", label: "susceptibility AUC",
    note: "spatially blocked, 59 blocks" },
  { value: 8, decimals: 0, suffix: " days", label: "warning before a real landslide",
    note: "21 Jul 2016 · 11 m from NH-10" },
  { value: 31.7, decimals: 1, suffix: "×", label: "trigger lift over base rate",
    note: "calibrated daily probability" },
  { value: 116, decimals: 0, suffix: "", label: "one-km segments scored",
    note: "Sevoke to Gangtok" },
] as const;

function Metric({ metric, index }: {
  metric: (typeof METRICS)[number]; index: number;
}) {
  // The metric row sits in the first viewport, so it counts on mount rather than
  // waiting on an observer — a card that never reveals would show 0, which is a
  // wrong number rather than a missing animation.
  const shown = useCountUp(metric.value, metric.decimals, true);

  /** A sheen that follows the pointer inside the card, written as CSS variables
   *  so the effect costs a custom-property update rather than a re-render. */
  const trackSheen = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - bounds.top}px`);
  };

  return (
    <motion.div
      className="glass metric"
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onMouseMove={trackSheen}
    >
      <div className="metric-value">
        {shown}
        <span className="metric-suffix">{metric.suffix}</span>
      </div>
      <div className="metric-label">{metric.label}</div>
      <div className="metric-note mono">{metric.note}</div>
    </motion.div>
  );
}

export function Metrics() {
  return (
    <section className="metrics">
      {METRICS.map((metric, i) => (
        <Metric key={metric.label} metric={metric} index={i} />
      ))}
    </section>
  );
}
