import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { prefersReducedMotion } from "./motion";

/** Count a metric up from zero once it enters view.
 *
 *  Keeps the caller's decimal precision, so 0.866 does not arrive as 0.9 and
 *  31.7 does not arrive as 32.
 */
export function useCountUp(target: number, decimals: number, start: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [target, start]);

  return value.toFixed(decimals);
}
