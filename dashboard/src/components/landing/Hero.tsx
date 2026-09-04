import { motion } from "framer-motion";
import { BandBars } from "../visuals/BandBars";
import { fadeUp, maskUp } from "../../lib/motion";

const LINES = ["Landslide", "Early Warning"];

export function Hero() {
  return (
    <header className="hero">
      <BandBars />
      <h1 className="display">
        {LINES.map((line, i) => (
          <span className="mask" key={line}>
            <motion.span custom={i} variants={maskUp} initial="hidden" animate="visible">
              {line}
            </motion.span>
          </span>
        ))}
      </h1>
      <motion.p className="lede" variants={fadeUp} initial="hidden" animate="visible">
        Rainfall-triggered landslide risk for the <strong>NH-10 corridor</strong>,
        Sevoke to Gangtok — <span className="mono">109.6 km</span> scored every
        kilometre, every day, from satellite data alone. No ground sensors.
      </motion.p>
    </header>
  );
}
