import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { SegmentSummary, Tier } from "../../api/client";
import { TIER_COLOR, TIER_INK, TIER_WORD } from "../../theme";
import { EASE_OUT_EXPO } from "../../lib/motion";

interface Props { segments: SegmentSummary[]; onEnter: () => void; ready: number | null }

const ORDER: Tier[] = ["red", "orange", "yellow", "green"];

/** The corridor as 116 ticks, in chainage order — the dashboard in one glance. */
export function Corridor({ segments, onEnter, ready }: Props) {
  const ordered = [...segments].sort((a, b) => a.chainage_km - b.chainage_km);
  const counts = ORDER.map((tier) => ({ tier, n: ordered.filter((s) => s.tier === tier).length }));

  return (
    <section className="corridor">
      <p className="eyebrow">The corridor today</p>
      <h2 className="h2">One tick per segment, Sevoke on the left.</h2>

      <div className="tick-strip" role="img"
           aria-label={`116 segments: ${counts.map((c) => `${c.n} ${TIER_WORD[c.tier]}`).join(", ")}`}>
        {ordered.map((segment, i) => (
          <motion.span key={segment.id} className="tick"
                       style={{ background: TIER_COLOR[segment.tier] }}
                       initial={{ scaleY: 0.15 }} whileInView={{ scaleY: 1 }}
                       viewport={{ once: true, amount: 0.2 }}
                       transition={{ duration: 0.4, delay: i * 0.005, ease: EASE_OUT_EXPO }} />
        ))}
      </div>
      <div className="tick-axis mono"><span>km 0 · Sevoke</span><span>km 109.6 · Gangtok</span></div>

      <div className="corridor-counts">
        {counts.map(({ tier, n }) => (
          <span className="count" key={tier} style={{ color: TIER_INK[tier] }}>
            <span className="count-dot" style={{ background: TIER_COLOR[tier] }} aria-hidden="true" />
            {TIER_WORD[tier]} <strong className="mono">{n}</strong>
          </span>
        ))}
      </div>

      <div className="cta">
        <button className="btn btn-ink btn-lg" onClick={onEnter}>
          Open the console <ArrowRight size={18} strokeWidth={2.2} />
        </button>
        <p className="cta-note mono">{ready === null ? "connecting…" : `${ready} segments scored`}</p>
      </div>

      <footer className="landing-foot">
        Copernicus GLO-30 · OpenStreetMap · CHIRPS &amp; GPM IMERG via Google Earth
        Engine · Sentinel-1 via COMET-LiCS · landslide inventory from the
        multi-temporal Sikkim catalogue (Zenodo, CC-BY)
      </footer>
    </section>
  );
}
