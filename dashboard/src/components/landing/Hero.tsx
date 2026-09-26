import { motion } from "framer-motion";
import type { SegmentSummary } from "../../api/client";
import { CorridorBlock } from "../visuals/CorridorBlock";
import { fadeUp } from "../../lib/motion";

function runLabel(iso: string | null) {
  if (!iso) return "connecting to the scoring run";
  const ist = new Date(new Date(iso + "Z").getTime() + 5.5 * 3600 * 1000);
  return `scored ${ist.toUTCString().slice(5, 16)} · ${ist.toISOString().slice(11, 16)} IST`;
}

export function Hero({ segments, computedAt }: { segments: SegmentSummary[]; computedAt: string | null }) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <motion.p className="eyebrow" variants={fadeUp} custom={0} initial="hidden" animate="visible">
          Landslide early warning · North Eastern Region
        </motion.p>
        <motion.h1 className="display" variants={fadeUp} custom={1} initial="hidden" animate="visible">
          Every stretch of the road, read before the rain arrives.
        </motion.h1>
        <motion.p className="lede" variants={fadeUp} custom={2} initial="hidden" animate="visible">
          NH-10 from Sevoke to Gangtok: <span className="mono">109.6</span> km of
          road, cut into 116 segments and scored every day from satellite
          rainfall, terrain and radar. No ground sensors. One number per
          segment, and the reason behind it.
        </motion.p>
        <motion.p className="hero-run mono" variants={fadeUp} custom={3} initial="hidden" animate="visible">
          {runLabel(computedAt)}
        </motion.p>
      </div>
      <motion.div className="hero-art" initial={{ y: 14 }} animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
        <CorridorBlock segments={segments} />
        <p className="hero-caption">The corridor today, drawn as ground. Each piece of the road is one segment, coloured by its band.</p>
      </motion.div>
    </header>
  );
}
