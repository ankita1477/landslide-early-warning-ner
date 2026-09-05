import Svg, { Circle, Path } from "react-native-svg";
import { C } from "../lib/theme";

/** Nothing to report: rings with nothing in them and the sweep at rest. */
export function Quiet({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {[52, 38, 24].map((r, i) => (
        <Circle key={r} cx={60} cy={60} r={r} fill="none" stroke={C.ink}
                strokeOpacity={0.10 + i * 0.06} strokeWidth={1} />
      ))}
      <Path d="M60 60 L60 10" stroke={C.ink} strokeOpacity="0.4" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={60} cy={60} r={4} fill={C.ink} />
      <Path d="M49 62 l7 7 l15 -16" fill="none" stroke={C.green} strokeWidth={3}
            strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-2)" />
    </Svg>
  );
}
