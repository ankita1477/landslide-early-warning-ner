import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import proof from "../../data/proof.json";

/** The 2016-07-21 replay, scrubbed by scroll.
 *
 *  Every value here is the real hindcast output: rainfall that actually fell,
 *  the score the model actually produced, and the day it actually crossed Red.
 */
const W = 1000;
const H = 300;
const PAD = { left: 54, right: 24, top: 24, bottom: 46 };

export function Proof() {
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "end start"],
  });
  const progress = useTransform(scrollYProgress, [0.15, 0.75], [0, 1], {
    clamp: true,
  });

  const series = proof.series;
  const maxRain = Math.max(...series.map((d) => d.rain7));
  const maxRisk = Math.max(...series.map((d) => d.risk)) * 1.12;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * plotW;
  const yRisk = (v: number) => PAD.top + plotH - (v / maxRisk) * plotH;
  const yRain = (v: number) => PAD.top + plotH - (v / maxRain) * plotH;

  const eventIndex = series.findIndex((d) => d.day === proof.event_date);
  const firstRedIndex = series.findIndex((d) => d.tier === "red");
  const leadDays = eventIndex - firstRedIndex;

  const riskPath = series
    .map((d, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${yRisk(d.risk).toFixed(1)}`)
    .join(" ");
  const rainPath = series
    .map((d, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${yRain(d.rain7).toFixed(1)}`)
    .join(" ");

  const clip = useTransform(progress, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`);
  const markerOpacity = useTransform(progress, [0.82, 0.95], [0, 1]);
  const alertOpacity = useTransform(progress, [0.5, 0.62], [0, 1]);

  return (
    <section className="proof" ref={section}>
      <div className="proof-head">
        <h2 className="eyebrow">The evidence</h2>
        <p className="proof-claim">
          Replayed on a real landslide, the system went{" "}
          <span className="band-red">Red</span>{" "}
          <span className="mono">{leadDays}</span> days early.
        </p>
        <p className="proof-meta mono">
          21 Jul 2016 · 11 m from NH-10 · km {proof.segment_km.toFixed(1)}
        </p>
      </div>

      <div className="glass proof-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={`Risk crossed the red threshold on 13 July 2016, ${leadDays} days before the landslide of 21 July`}>
          {(["yellow", "orange", "red"] as const).map((tier) => (
            <g key={tier}>
              <line
                x1={PAD.left} x2={W - PAD.right}
                y1={yRisk(proof.thresholds[tier])} y2={yRisk(proof.thresholds[tier])}
                stroke={`var(--${tier})`} strokeOpacity={0.32}
                strokeWidth={1} strokeDasharray="3 5"
              />
              <text
                x={PAD.left - 8} y={yRisk(proof.thresholds[tier]) + 3}
                textAnchor="end" className="proof-axis" fill={`var(--${tier})`}
              >
                {tier}
              </text>
            </g>
          ))}

          <motion.g style={{ clipPath: clip }}>
            <path d={rainPath} fill="none" stroke="var(--text-3)" strokeWidth={1.5}
                  strokeOpacity={0.55} />
            <path d={riskPath} fill="none" stroke="var(--text-1)" strokeWidth={2.4}
                  strokeLinecap="round" strokeLinejoin="round" />
            {series.map((d, i) =>
              d.tier === "red" || d.tier === "orange" ? (
                <circle key={i} cx={x(i)} cy={yRisk(d.risk)} r={3.5}
                        fill={`var(--${d.tier})`} />
              ) : null,
            )}
          </motion.g>

          <motion.g style={{ opacity: alertOpacity }}>
            <line x1={x(firstRedIndex)} x2={x(firstRedIndex)} y1={PAD.top}
                  y2={PAD.top + plotH} stroke="var(--red)" strokeOpacity={0.6}
                  strokeWidth={1.5} />
            <text x={x(firstRedIndex) + 8} y={PAD.top + 14} className="proof-note"
                  fill="var(--red)">
              first RED · {series[firstRedIndex].day.slice(5)}
            </text>
          </motion.g>

          <motion.g style={{ opacity: markerOpacity }}>
            <line x1={x(eventIndex)} x2={x(eventIndex)} y1={PAD.top} y2={PAD.top + plotH}
                  stroke="var(--text-1)" strokeWidth={2} />
            <circle cx={x(eventIndex)} cy={yRisk(series[eventIndex].risk)} r={7}
                    fill="none" stroke="var(--text-1)" strokeWidth={2} />
            <text x={x(eventIndex) - 8} y={PAD.top + 14} textAnchor="end"
                  className="proof-note" fill="var(--text-1)">
              landslide
            </text>
          </motion.g>

          <text x={PAD.left} y={H - 14} className="proof-axis" fill="var(--text-3)">
            {series[0].day}
          </text>
          <text x={W - PAD.right} y={H - 14} textAnchor="end" className="proof-axis"
                fill="var(--text-3)">
            {series[series.length - 1].day}
          </text>
        </svg>

        <div className="proof-legend mono">
          <span><i className="swatch-line" /> risk score</span>
          <span><i className="swatch-line dim" /> 7-day antecedent rainfall</span>
          <span>peak {maxRain.toFixed(0)} mm</span>
        </div>
      </div>
    </section>
  );
}
