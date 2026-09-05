/** The score as an exploded stack: four slabs, one per model layer, held apart
 *  so each can be read on its own, and multiplied down into one number.
 *
 *  Bottom to top follows the order the pipeline runs them: the ground first,
 *  then the rain that loads it, then the radar that watches it move, then the
 *  people in the way. Each slab wears its own layer colour on one edge only —
 *  identity, never severity. */
const SLABS = [
  { key: "susceptibility", label: "Terrain", sub: "susceptibility", color: "var(--layer-susceptibility)" },
  { key: "trigger", label: "Rainfall", sub: "trigger probability", color: "var(--layer-trigger)" },
  { key: "deformation", label: "Radar", sub: "deformation", color: "var(--layer-deformation)" },
  { key: "exposure", label: "People", sub: "exposure", color: "var(--layer-exposure)" },
];

export function LayerStack() {
  const cx = 170, w = 140, h = 70, depth = 14, gap = 84;
  const baseY = 330;

  return (
    <svg viewBox="0 0 470 400" className="layer-stack" role="img"
         aria-label="Four model layers stacked: terrain, rainfall, radar and people, multiplied into one risk score">
      <defs>
        <linearGradient id="ls-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--slab-top-1)" }} /><stop offset="1" style={{ stopColor: "var(--slab-top-2)" }} />
        </linearGradient>
        <linearGradient id="ls-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--slab-left-1)" }} /><stop offset="1" style={{ stopColor: "var(--slab-left-2)" }} />
        </linearGradient>
        <linearGradient id="ls-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--slab-right-1)" }} /><stop offset="1" style={{ stopColor: "var(--slab-right-2)" }} />
        </linearGradient>
      </defs>

      {/* The axis the slabs hang on. */}
      <line x1={cx} y1={baseY + depth + 6} x2={cx} y2={28} stroke="var(--figure-ink)" strokeOpacity="0.25" strokeDasharray="3 5" />

      {SLABS.map((slab, i) => {
        const y = baseY - i * gap;
        const top = `M${cx} ${y - h} L${cx + w} ${y} L${cx} ${y + h} L${cx - w} ${y} Z`;
        const left = `M${cx - w} ${y} L${cx} ${y + h} L${cx} ${y + h + depth} L${cx - w} ${y + depth} Z`;
        const right = `M${cx} ${y + h} L${cx + w} ${y} L${cx + w} ${y + depth} L${cx} ${y + h + depth} Z`;
        return (
          <g key={slab.key}>
            <path d={top} fill="url(#ls-top)" />
            <path d={left} fill="url(#ls-left)" />
            <path d={right} fill="url(#ls-right)" />
            {/* The layer's own colour along the near-left edge. */}
            <path d={`M${cx - w} ${y} L${cx} ${y + h} L${cx} ${y + h + 4} L${cx - w} ${y + 4} Z`} fill={slab.color} />

            {slab.key === "susceptibility" && (
              <>
                <path d={`M${cx - 90} ${y + 6} C ${cx - 50} ${y - 30}, ${cx + 30} ${y - 26}, ${cx + 84} ${y + 10}`} fill="none" stroke="var(--figure-ink)" strokeOpacity="0.28" />
                <path d={`M${cx - 66} ${y + 10} C ${cx - 36} ${y - 14}, ${cx + 20} ${y - 12}, ${cx + 60} ${y + 12}`} fill="none" stroke="var(--figure-ink)" strokeOpacity="0.28" />
                <path d={`M${cx - 40} ${y + 12} C ${cx - 20} ${y}, ${cx + 10} ${y}, ${cx + 34} ${y + 14}`} fill="none" stroke="var(--figure-ink)" strokeOpacity="0.28" />
              </>
            )}
            {slab.key === "trigger" && [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
              <path key={k} d={`M${cx - 70 + k * 20} ${y - 20 + (k % 2) * 10} l-5 14`}
                    stroke={slab.color} strokeOpacity="0.8" strokeWidth={1.6} strokeLinecap="round" />
            ))}
            {slab.key === "deformation" && [0, 1, 2, 3, 4, 5].map((k) => (
              <path key={k} d={`M${cx - 96 + k * 12} ${y} L${cx - 20 + k * 12} ${y - 40 + k * 8}`}
                    stroke={slab.color} strokeOpacity={0.15 + k * 0.12} strokeWidth={4} />
            ))}
            {slab.key === "exposure" && [[cx - 40, y - 14], [cx - 18, y - 4], [cx + 6, y - 14], [cx + 30, y - 4]].map(([x, yy], k) => (
              <path key={k}
                    d={`M${x} ${yy} l9 -4.5 l9 4.5 l0 9 l-9 4.5 l-9 -4.5 Z M${x} ${yy} l9 4.5 l0 9 M${x + 9} ${yy + 4.5} l9 -4.5`}
                    fill={slab.color} fillOpacity="0.85" stroke="var(--figure-ink)" strokeOpacity="0.4" strokeWidth={0.8} />
            ))}

            <text x={cx + w + 12} y={y + 4} className="ls-label">{slab.label}</text>
            <text x={cx + w + 12} y={y + 20} className="ls-sub">{slab.sub}</text>
            {i < SLABS.length - 1 && (
              <text x={cx - 6} y={y - h - 16} className="ls-op">×</text>
            )}
          </g>
        );
      })}

      <text x={cx} y={20} className="ls-result" textAnchor="middle">= risk, per kilometre, per day</text>
    </svg>
  );
}
