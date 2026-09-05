import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { C, TIER_COLOR, TIER_RANK, type Tier } from "../lib/theme";

/** The hillside above the road, drawn as a lit block of ground.
 *
 *  An isometric tile with a mound on it, two shaded faces underneath so it
 *  reads as solid, the road as a pale ribbon across the flank, and a small
 *  settlement below. The band tints only two things: the glow in the sky and
 *  the patch of slope above the road. On a green day the hill is simply a hill.
 */
export function Hillside({ tier, width = 320 }: { tier: Tier; width?: number }) {
  const tint = TIER_COLOR[tier];
  const rank = TIER_RANK[tier];
  const height = (width * 210) / 320;

  return (
    <Svg width={width} height={height} viewBox="0 0 320 210">
      <Defs>
        <RadialGradient id="sky" cx="0.5" cy="0.35" r="0.55">
          <Stop offset="0" stopColor={tint} stopOpacity={rank === 0 ? 0.18 : 0.14 + rank * 0.07} />
          <Stop offset="1" stopColor={tint} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="top" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2B3446" />
          <Stop offset="1" stopColor="#1B2230" />
        </LinearGradient>
        <LinearGradient id="left" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#151B27" />
          <Stop offset="1" stopColor="#0C1018" />
        </LinearGradient>
        <LinearGradient id="right" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A2130" />
          <Stop offset="1" stopColor="#0E121B" />
        </LinearGradient>
        <LinearGradient id="mound" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#4A5670" />
          <Stop offset="0.55" stopColor="#2F3A4E" />
          <Stop offset="1" stopColor="#1E2635" />
        </LinearGradient>
        <LinearGradient id="moundShade" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </LinearGradient>
        <LinearGradient id="slip" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity="0.55" />
          <Stop offset="1" stopColor={tint} stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="road" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#D9D2C2" />
          <Stop offset="1" stopColor="#B9B2A3" />
        </LinearGradient>
      </Defs>

      {/* Sky glow, the only large tinted area. */}
      <Circle cx={160} cy={80} r={150} fill="url(#sky)" />

      {/* The block of ground: top face, then the two faces that give it depth. */}
      <Path d="M160 40 L300 110 L160 180 L20 110 Z" fill="url(#top)" />
      <Path d="M20 110 L160 180 L160 204 L20 134 Z" fill="url(#left)" />
      <Path d="M160 180 L300 110 L300 134 L160 204 Z" fill="url(#right)" />
      <Path d="M20 110 L160 180 L300 110" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth={1} />

      {/* The hill, lit from the upper left. */}
      <Path
        d="M56 104 C 84 62, 146 46, 200 70 C 236 86, 256 100, 246 118 C 214 142, 122 146, 56 104 Z"
        fill="url(#mound)"
      />
      <Path
        d="M150 60 C 200 66, 246 96, 246 118 C 214 142, 122 146, 56 104 C 120 118, 180 108, 150 60 Z"
        fill="url(#moundShade)"
      />
      {/* Contour lines so the mound reads as terrain, not a blob. */}
      <Path d="M92 96 C 120 78, 170 74, 210 90" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth={1} />
      <Path d="M112 84 C 136 72, 168 70, 196 80" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth={1} />

      {/* The patch of slope the band is about. */}
      {rank > 0 && (
        <Path
          d="M132 78 C 150 68, 186 72, 200 86 C 196 102, 168 110, 142 104 C 130 98, 126 88, 132 78 Z"
          fill="url(#slip)"
        />
      )}
      {rank >= 2 && (
        <>
          <Path d="M150 106 L146 118" stroke={tint} strokeOpacity="0.8" strokeWidth={2} strokeLinecap="round" />
          <Path d="M166 108 L170 122" stroke={tint} strokeOpacity="0.8" strokeWidth={2} strokeLinecap="round" />
          <Path d="M182 104 L192 116" stroke={tint} strokeOpacity="0.8" strokeWidth={2} strokeLinecap="round" />
        </>
      )}

      {/* The road: a pale ribbon along the foot of the hill. */}
      <Path
        d="M34 120 C 80 128, 110 112, 160 116 C 206 120, 236 108, 288 118"
        fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth={9} strokeLinecap="round"
      />
      <Path
        d="M34 118 C 80 126, 110 110, 160 114 C 206 118, 236 106, 288 116"
        fill="none" stroke="url(#road)" strokeWidth={6} strokeLinecap="round"
      />
      <Path
        d="M34 118 C 80 126, 110 110, 160 114 C 206 118, 236 106, 288 116"
        fill="none" stroke="#0A0D14" strokeOpacity="0.5" strokeWidth={1} strokeDasharray="5 5"
      />

      {/* A settlement below the road: three small extruded boxes. */}
      {[[212, 138], [228, 146], [246, 138]].map(([x, y], i) => (
        <Path
          key={i}
          d={`M${x} ${y} l9 -4.5 l9 4.5 l0 8 l-9 4.5 l-9 -4.5 Z M${x} ${y} l9 4.5 l0 8 M${x + 9} ${y + 4.5} l9 -4.5`}
          fill="#3A465C" stroke="#0A0D14" strokeOpacity="0.6" strokeWidth={0.8}
        />
      ))}

      {/* Rain, only when it is part of the story. */}
      {rank > 0 &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <Path
            key={i}
            d={`M${196 + i * 16} ${18 + (i % 2) * 8} l-6 14`}
            stroke={C.text2} strokeOpacity={0.18 + rank * 0.08} strokeWidth={1.5} strokeLinecap="round"
          />
        ))}

      {/* Ground shadow so the block sits on something. */}
      <Ellipse cx={160} cy={206} rx={128} ry={6} fill="#000" fillOpacity="0.35" />
    </Svg>
  );
}
