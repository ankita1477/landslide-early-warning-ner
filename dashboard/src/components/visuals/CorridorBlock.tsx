import type { SegmentSummary } from "../../api/client";
import { TIER_COLOR } from "../../theme";

/** The corridor as a block of valley, with today's road laid along it.
 *
 *  An isometric slab of ground with a gorge cut through it, a hillside on each
 *  bank, and the road as a ribbon along the near flank. The ribbon is not
 *  decoration: it is the real corridor, in chainage order, coloured by today's
 *  reading — the dashboard's headline drawn as terrain. */
export function CorridorBlock({ segments }: { segments: SegmentSummary[] }) {
  const ordered = [...segments].sort((a, b) => a.chainage_km - b.chainage_km);
  const n = Math.max(ordered.length, 1);

  // The ribbon's spine: a gentle curve along the near flank of the slab.
  const spine = (t: number) => {
    const x = 60 + t * 400;
    const y = 232 + Math.sin(t * Math.PI * 1.6) * 10 - t * 44;
    return [x, y] as const;
  };

  return (
    <svg viewBox="0 0 520 340" className="corridor-block" role="img"
         aria-label="The NH-10 corridor drawn as a block of valley, the road coloured by today's risk band">
      <defs>
        <linearGradient id="cb-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E4E9EE" /><stop offset="1" stopColor="#CBD3DB" />
        </linearGradient>
        <linearGradient id="cb-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B3BDC7" /><stop offset="1" stopColor="#8F9BA7" />
        </linearGradient>
        <linearGradient id="cb-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C6CED6" /><stop offset="1" stopColor="#A4AEB9" />
        </linearGradient>
        <linearGradient id="cb-hill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4F6F8" /><stop offset="0.6" stopColor="#D2DAE1" /><stop offset="1" stopColor="#AEB9C4" />
        </linearGradient>
        <linearGradient id="cb-shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#141C26" stopOpacity="0" /><stop offset="1" stopColor="#141C26" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="cb-river" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7FA6C9" /><stop offset="1" stopColor="#5F87AC" />
        </linearGradient>
      </defs>

      {/* The slab. */}
      <path d="M260 40 L500 160 L260 280 L20 160 Z" fill="url(#cb-top)" />
      <path d="M20 160 L260 280 L260 318 L20 198 Z" fill="url(#cb-left)" />
      <path d="M260 280 L500 160 L500 198 L260 318 Z" fill="url(#cb-right)" />
      <path d="M20 160 L260 280 L500 160" fill="none" stroke="#141C26" strokeOpacity="0.18" />

      {/* The gorge: a dark cut with the river at the bottom. */}
      <path d="M120 95 C 190 120, 240 150, 300 168 C 350 182, 400 190, 440 214 L 400 230 C 350 210, 300 196, 250 182 C 200 168, 150 140, 96 110 Z"
            fill="#141C26" fillOpacity="0.16" />
      <path d="M108 102 C 180 130, 240 158, 296 174 C 348 190, 396 200, 420 222"
            fill="none" stroke="url(#cb-river)" strokeWidth={3} strokeLinecap="round" />

      {/* The far bank: a long ridge lit from the left. */}
      <path d="M150 72 C 210 40, 300 46, 360 78 C 400 100, 440 128, 470 150 C 420 160, 350 146, 290 128 C 230 110, 180 100, 150 72 Z" fill="url(#cb-hill)" />
      <path d="M280 62 C 330 60, 400 96, 470 150 C 420 160, 350 146, 290 128 C 300 108, 290 84, 280 62 Z" fill="url(#cb-shade)" />
      <path d="M200 84 C 250 76, 320 92, 380 120" fill="none" stroke="#141C26" strokeOpacity="0.10" />
      <path d="M220 70 C 270 66, 330 82, 370 104" fill="none" stroke="#141C26" strokeOpacity="0.10" />

      {/* The near bank, the one the road is cut into. */}
      <path d="M44 172 C 90 130, 160 132, 230 160 C 290 184, 340 200, 400 232 C 340 250, 250 254, 170 236 C 110 222, 60 200, 44 172 Z" fill="url(#cb-hill)" />
      <path d="M230 160 C 290 184, 340 200, 400 232 C 340 250, 250 254, 170 236 C 220 220, 240 190, 230 160 Z" fill="url(#cb-shade)" />
      <path d="M80 178 C 140 160, 220 176, 300 210" fill="none" stroke="#141C26" strokeOpacity="0.10" />
      <path d="M100 166 C 160 150, 230 164, 320 198" fill="none" stroke="#141C26" strokeOpacity="0.10" />

      {/* The road: casing, then one piece per kilometre in band colour. */}
      <path d={ordered.length ? Array.from({ length: 41 }, (_, i) => {
        const [x, y] = spine(i / 40); return `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ") : ""} fill="none" stroke="#141C26" strokeOpacity="0.35" strokeWidth={11} strokeLinecap="round" />
      {ordered.map((s, i) => {
        const [x1, y1] = spine(i / n);
        const [x2, y2] = spine((i + 1) / n);
        return <line key={s.id} x1={x1} y1={y1} x2={x2} y2={y2}
                     stroke={TIER_COLOR[s.tier]} strokeWidth={7} strokeLinecap="butt" />;
      })}
      {ordered.length === 0 && (
        <path d={Array.from({ length: 41 }, (_, i) => {
          const [x, y] = spine(i / 40); return `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(" ")} fill="none" stroke="#8F9BA7" strokeWidth={7} strokeLinecap="round" />
      )}

      {/* Sevoke and Gangtok: where the ribbon starts and ends. */}
      <circle cx={spine(0)[0]} cy={spine(0)[1]} r={5} fill="#fff" stroke="#141C26" strokeWidth={1.5} />
      <circle cx={spine(1)[0]} cy={spine(1)[1]} r={5} fill="#fff" stroke="#141C26" strokeWidth={1.5} />
      <text x={spine(0)[0] - 8} y={spine(0)[1] + 22} className="cb-label" textAnchor="start">Sevoke</text>
      <text x={spine(1)[0] + 8} y={spine(1)[1] - 10} className="cb-label" textAnchor="start">Gangtok</text>

      {/* Settlements below the road. */}
      {[[330, 250], [348, 259], [368, 250], [150, 250]].map(([x, y], i) => (
        <path key={i}
              d={`M${x} ${y} l9 -4.5 l9 4.5 l0 8 l-9 4.5 l-9 -4.5 Z M${x} ${y} l9 4.5 l0 8 M${x + 9} ${y + 4.5} l9 -4.5`}
              fill="#8F9BA7" stroke="#141C26" strokeOpacity="0.45" strokeWidth={0.8} />
      ))}

      {/* Rain on the far ridge. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${330 + i * 18} ${18 + (i % 2) * 8} l-5 12`}
              stroke="#4E5A68" strokeOpacity="0.5" strokeWidth={1.4} strokeLinecap="round" />
      ))}

      <ellipse cx={260} cy={322} rx={230} ry={8} fill="#141C26" fillOpacity="0.10" />
    </svg>
  );
}
