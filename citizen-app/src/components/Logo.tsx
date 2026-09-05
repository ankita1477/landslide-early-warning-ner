import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/** LANDSAFE NER mark.
 *
 *  A shield holding a slope, with two signal arcs rising off the ridge: the
 *  ground being watched, and the warning going out. Built from four simple
 *  shapes so it stays legible at 24px on a launcher icon — detail that only
 *  reads at poster size is detail that hurts an app mark.
 */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7FB3FF" />
          <Stop offset="1" stopColor="#4C8DFF" />
        </LinearGradient>
        <LinearGradient id="slope" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#C9DBF5" />
        </LinearGradient>
      </Defs>

      {/* Shield: protection, and the boundary the system watches within. */}
      <Path
        d="M50 6 L86 20 V48 C86 70 70 86 50 94 C30 86 14 70 14 48 V20 Z"
        fill="url(#shield)"
        opacity={0.16}
      />
      <Path
        d="M50 6 L86 20 V48 C86 70 70 86 50 94 C30 86 14 70 14 48 V20 Z"
        fill="none"
        stroke="url(#shield)"
        strokeWidth={3.5}
        strokeLinejoin="round"
      />

      {/* The slope itself — a ridge and a shoulder, not a generic triangle. */}
      <Path
        d="M24 70 L42 44 L53 58 L63 45 L78 70 Z"
        fill="url(#slope)"
      />
      {/* The failure plane: the line this whole system exists to predict. */}
      <Path
        d="M42 44 L53 58 L63 45"
        fill="none"
        stroke="#4C8DFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Two arcs: the signal going out ahead of the slide. */}
      <Path
        d="M64 32 A 14 14 0 0 1 76 26"
        fill="none" stroke="#EAB308" strokeWidth={3.4} strokeLinecap="round"
      />
      <Path
        d="M62 24 A 23 23 0 0 1 83 16"
        fill="none" stroke="#EAB308" strokeWidth={3.4} strokeLinecap="round"
        opacity={0.62}
      />
    </Svg>
  );
}
