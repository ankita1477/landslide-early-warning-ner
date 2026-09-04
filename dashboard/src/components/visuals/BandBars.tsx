import { motion } from "framer-motion";
import { drawBar } from "../../lib/motion";

const BANDS = [
  { name: "green", color: "var(--green)" },
  { name: "yellow", color: "var(--yellow)" },
  { name: "orange", color: "var(--orange)" },
  { name: "red", color: "var(--red)" },
] as const;

/** The risk ramp, drawn left to right. The brand, stated before anything else. */
export function BandBars() {
  return (
    <div className="band-bars" role="img" aria-label="Risk bands: green, yellow, orange, red">
      {BANDS.map((band, i) => (
        <motion.span
          key={band.name}
          custom={i}
          variants={drawBar}
          initial="hidden"
          animate="visible"
          style={{ background: band.color, transformOrigin: "left center" }}
        />
      ))}
    </div>
  );
}
