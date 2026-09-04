import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "../../lib/motion";

const TERMS = [
  { text: "susceptibility", color: "var(--green)" },
  { text: "trigger probability", color: "var(--yellow)" },
  { text: "deformation", color: "var(--orange)" },
  { text: "exposure", color: "var(--red)" },
] as const;

/** The spine of the whole system: four terms, each illuminating in its own band
 *  colour in sequence, then settling. */
export function Formula() {
  return (
    <motion.section className="formula-section" initial="rest" whileInView="lit" viewport={{ once: true, amount: 0.4 }}>
      <h2 className="eyebrow">How a score is built</h2>
      <div className="glass formula-strip">
        <p className="formula">
          <span className="formula-lhs">RISK</span>
          <span className="formula-eq"> = </span>
          {TERMS.map((term, i) => (
            <span key={term.text}>
              <motion.span
                className="formula-term"
                variants={{
                  rest: { color: "#64748b" },
                  lit: {
                    color: [term.color, term.color, "#cbd5e1"],
                    transition: {
                      duration: 1.6,
                      times: [0, 0.35, 1],
                      delay: 0.3 + i * 0.4,
                      ease: EASE_OUT_EXPO,
                    },
                  },
                }}
              >
                {term.text}
              </motion.span>
              {i < TERMS.length - 1 && <span className="formula-op"> × </span>}
            </span>
          ))}
        </p>
      </div>
    </motion.section>
  );
}
