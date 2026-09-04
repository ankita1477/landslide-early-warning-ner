import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "../../lib/motion";

const VIEW = { width: 420, height: 320 };

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="layer-visual"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

/** Layer 1 — terrain as stacked contour lines, steeper where susceptibility is high. */
export function TerrainField({ active }: { active: boolean }) {
  const lines = Array.from({ length: 14 }, (_, row) => {
    const y = 40 + row * 19;
    const amplitude = 10 + row * 2.4;
    const points = Array.from({ length: 29 }, (_, i) => {
      const x = (i / 28) * VIEW.width;
      const ridge =
        Math.sin(i * 0.55 + row * 0.35) * amplitude +
        Math.sin(i * 0.21 + row * 0.9) * amplitude * 0.5;
      return `${x.toFixed(1)},${(y - ridge).toFixed(1)}`;
    }).join(" ");
    return { row, points };
  });

  return (
    <Frame label="Terrain contour field">
      {lines.map(({ row, points }) => (
        <motion.polyline
          key={row}
          points={points}
          fill="none"
          stroke={row > 9 ? "var(--orange)" : "var(--green)"}
          strokeOpacity={row > 9 ? 0.5 : 0.28}
          strokeWidth={1.1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.1, delay: row * 0.04, ease: EASE_OUT_EXPO }}
        />
      ))}
    </Frame>
  );
}

/** Layer 2 — rain falling and accumulating into a bar, which is exactly what an
 *  antecedent-rainfall feature is. */
export function RainfallStreaks({ active }: { active: boolean }) {
  const streaks = Array.from({ length: 26 }, (_, i) => ({
    x: 12 + (i * 397) / 26 + ((i * 37) % 11),
    delay: (i % 9) * 0.16,
    length: 26 + ((i * 53) % 34),
  }));

  return (
    <Frame label="Rainfall accumulating into a bar">
      {streaks.map((streak, i) => (
        <motion.line
          key={i}
          x1={streak.x}
          x2={streak.x - 7}
          y1={0}
          y2={streak.length}
          stroke="var(--yellow)"
          strokeOpacity={0.55}
          strokeWidth={1.4}
          strokeLinecap="round"
          initial={{ y: -60, opacity: 0 }}
          animate={
            active
              ? { y: [-60, 250], opacity: [0, 0.8, 0] }
              : { y: -60, opacity: 0 }
          }
          transition={{
            duration: 1.5,
            delay: streak.delay,
            repeat: active ? Infinity : 0,
            repeatDelay: 0.2,
            ease: "linear",
          }}
        />
      ))}
      <motion.rect
        x={0}
        width={VIEW.width}
        rx={3}
        fill="var(--yellow)"
        fillOpacity={0.22}
        initial={{ height: 0, y: VIEW.height }}
        animate={active ? { height: 74, y: VIEW.height - 74 } : { height: 0, y: VIEW.height }}
        transition={{ duration: 2.2, ease: EASE_OUT_EXPO }}
      />
      <motion.rect
        x={0}
        width={VIEW.width}
        height={2}
        fill="var(--yellow)"
        initial={{ y: VIEW.height }}
        animate={active ? { y: VIEW.height - 74 } : { y: VIEW.height }}
        transition={{ duration: 2.2, ease: EASE_OUT_EXPO }}
      />
    </Frame>
  );
}

/** Layer 3 — interferometric fringes, fading where coherence is lost. Most of
 *  this corridor is in the faded part. */
export function FringePattern({ active }: { active: boolean }) {
  const fringes = Array.from({ length: 22 }, (_, i) => i);
  return (
    <Frame label="Interferometric fringe pattern, mostly decorrelated">
      <defs>
        <radialGradient id="coherence" cx="42%" cy="46%" r="46%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.03" />
        </radialGradient>
        <mask id="coherence-mask">
          <rect width={VIEW.width} height={VIEW.height} fill="url(#coherence)" />
        </mask>
      </defs>
      <g mask="url(#coherence-mask)">
        {fringes.map((i) => (
          <motion.ellipse
            key={i}
            cx={176}
            cy={148}
            rx={14 + i * 13}
            ry={10 + i * 9}
            fill="none"
            stroke={i % 2 ? "var(--orange)" : "var(--red)"}
            strokeWidth={1.3}
            strokeOpacity={0.65}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.9, delay: i * 0.045, ease: EASE_OUT_EXPO }}
          />
        ))}
      </g>
    </Frame>
  );
}

/** Layer 4 — the road, with exposure nodes lighting along it. */
export function ExposureNodes({ active }: { active: boolean }) {
  const path =
    "M 24 292 C 96 250, 70 196, 140 168 S 232 130, 250 92 S 328 52, 396 30";
  const nodes = [
    { x: 62, y: 268 }, { x: 128, y: 176 }, { x: 196, y: 146 },
    { x: 252, y: 92 }, { x: 322, y: 54 }, { x: 386, y: 32 },
  ];

  return (
    <Frame label="Road corridor with exposure nodes">
      <motion.path
        d={path}
        fill="none"
        stroke="var(--text-3)"
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={active ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.3, ease: EASE_OUT_EXPO }}
      />
      {nodes.map((node, i) => (
        <motion.g key={i}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r={13}
            fill="var(--red)"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={active ? { opacity: [0, 0.28, 0.12], scale: 1 } : { opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.2, delay: 0.7 + i * 0.12, ease: EASE_OUT_EXPO }}
          />
          <motion.circle
            cx={node.x}
            cy={node.y}
            r={4.5}
            fill="var(--red)"
            initial={{ opacity: 0, scale: 0 }}
            animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
            transition={{ duration: 0.5, delay: 0.7 + i * 0.12, ease: EASE_OUT_EXPO }}
          />
        </motion.g>
      ))}
    </Frame>
  );
}
