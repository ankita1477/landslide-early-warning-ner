import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { Category } from "../lib/reports";

/** The four things a person can report, each drawn on the same small block of
 *  ground so the set reads as one family.
 *
 *  They are pictures of the hazard as seen from the road, not symbols of it —
 *  a barrier across the carriageway, boulders coming off a face, a slab split
 *  in two, water coming out of a cut. Someone who cannot read the label should
 *  still be able to pick the right one.
 */
export function Hazard({ kind, size = 64, active = false }: {
  kind: Category; size?: number; active?: boolean;
}) {
  const id = `hz-${kind}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={active ? "#FBF7EE" : "#E7E0CF"} />
          <Stop offset="1" stopColor={active ? "#E4DCC8" : "#D2C9B2"} />
        </LinearGradient>
        <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B7AC93" />
          <Stop offset="1" stopColor="#968B72" />
        </LinearGradient>
        <LinearGradient id={`${id}-rock`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8F8676" />
          <Stop offset="1" stopColor="#4E463A" />
        </LinearGradient>
        <LinearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5B8DEF" />
          <Stop offset="1" stopColor="#1F4FA8" />
        </LinearGradient>
      </Defs>

      {/* The block: a diamond top and two faces. */}
      <Path d="M32 14 L56 26 L32 38 L8 26 Z" fill={`url(#${id}-top)`} />
      <Path d="M8 26 L32 38 L32 50 L8 38 Z" fill={`url(#${id}-side)`} />
      <Path d="M32 38 L56 26 L56 38 L32 50 Z" fill={`url(#${id}-side)`} opacity={0.85} />
      <Path d="M8 26 L32 38 L56 26" fill="none" stroke="#17191D" strokeOpacity="0.25" strokeWidth={0.8} />

      {kind === "blocked" && (
        <>
          {/* The road across the block, and a barrier standing on it. */}
          <Path d="M14 29 L50 23" stroke="#2B2E36" strokeWidth={4} strokeLinecap="round" />
          <Path d="M14 29 L50 23" stroke="#F4F1EA" strokeOpacity="0.7" strokeWidth={0.8} strokeDasharray="2 3" />
          <Path d="M22 22 L42 12 L42 20 L22 30 Z" fill="#F4F1EA" stroke="#17191D" strokeWidth={0.8} />
          <Path d="M26 20 L30 18 L30 26 L26 28 Z M34 16 L38 14 L38 22 L34 24 Z" fill="#17191D" />
          <Path d="M24 29 L24 36 M40 21 L40 28" stroke="#4B4F57" strokeWidth={2} strokeLinecap="round" />
        </>
      )}

      {kind === "rocks" && (
        <>
          {/* A steeper face rising behind, and boulders coming off it. */}
          <Path d="M8 26 L20 6 L40 4 L56 26 Z" fill="#C4BAA1" />
          <Path d="M20 6 L40 4 L56 26 L32 20 Z" fill="#8F8570" opacity={0.7} />
          <Path d="M27 16 l6 -3 l5 4 l-2 6 l-7 1 l-3 -4 Z" fill={`url(#${id}-rock)`} />
          <Path d="M40 24 l4 -2 l3 3 l-1 4 l-5 0 l-2 -3 Z" fill={`url(#${id}-rock)`} />
          <Path d="M18 26 l3 -2 l3 2 l-1 3 l-4 0 Z" fill={`url(#${id}-rock)`} />
          <Path d="M30 8 l-3 -4 M37 9 l2 -5 M44 18 l4 -3" stroke="#4B4F57" strokeOpacity="0.6" strokeWidth={1.2} strokeLinecap="round" />
        </>
      )}

      {kind === "crack" && (
        <>
          {/* One half of the top face has dropped: the split runs across it. */}
          <Path d="M32 16 L56 28 L32 40 L30 38 L34 30 L28 26 L33 20 Z" fill="#17191D" opacity={0.22} />
          <Path d="M32 15 L34 19 L28 25 L34 31 L30 38"
                fill="none" stroke="#17191D" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M32 15 L34 19 L28 25 L34 31 L30 38"
                fill="none" stroke="#F4F1EA" strokeWidth={4} strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M32 15 L34 19 L28 25 L34 31 L30 38"
                fill="none" stroke="#17191D" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {kind === "water" && (
        <>
          {/* A cut face, and water arcing out of it onto the road. */}
          <Path d="M8 26 L14 8 L42 4 L56 26 Z" fill="#C4BAA1" />
          <Path d="M14 8 L42 4 L56 26 L34 22 Z" fill="#8F8570" opacity={0.7} />
          <Path d="M28 14 C 36 14, 42 22, 40 32" fill="none" stroke={`url(#${id}-water)`} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M28 14 C 34 16, 38 22, 37 30" fill="none" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth={1} strokeLinecap="round" />
          <Path d="M42 34 l-1.5 3 a1.5 1.5 0 1 0 3 0 Z M35 35 l-1.5 3 a1.5 1.5 0 1 0 3 0 Z" fill="#3D74D6" />
          <Path d="M20 30 C 28 36, 40 36, 50 30" fill="none" stroke="#1F4FA8" strokeOpacity="0.45" strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
