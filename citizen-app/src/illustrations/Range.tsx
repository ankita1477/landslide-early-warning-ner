import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/** The hills behind the splash, in three planes.
 *
 *  Each ridge has a lit face and a shaded face, which is what makes it a range
 *  rather than a paper cut-out. Mist between the planes pushes the far ridges
 *  back. Nothing moves; the mark in front of it does the work.
 */
export function Range() {
  const { width, height } = useWindowDimensions();
  const top = height * 0.5;
  const h = height - top;
  const w = width;

  return (
    <View style={[StyleSheet.absoluteFill, { top }]} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id="far" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#DAD3C2" />
            <Stop offset="1" stopColor="#CBC3AE" />
          </LinearGradient>
          <LinearGradient id="mid" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C2B9A2" />
            <Stop offset="1" stopColor="#ADA389" />
          </LinearGradient>
          <LinearGradient id="near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#A2977D" />
            <Stop offset="1" stopColor="#8B8067" />
          </LinearGradient>
          <LinearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F4F1EA" stopOpacity="0" />
            <Stop offset="1" stopColor="#F4F1EA" stopOpacity="0.55" />
          </LinearGradient>
        </Defs>

        {/* Far ridge. */}
        <Path d={`M0 ${h * 0.42} L${w * 0.18} ${h * 0.2} L${w * 0.34} ${h * 0.34} L${w * 0.52} ${h * 0.1} L${w * 0.7} ${h * 0.3} L${w * 0.86} ${h * 0.18} L${w} ${h * 0.3} V${h} H0 Z`} fill="url(#far)" />
        <Path d={`M${w * 0.52} ${h * 0.1} L${w * 0.7} ${h * 0.3} L${w * 0.52} ${h * 0.36} Z M${w * 0.18} ${h * 0.2} L${w * 0.34} ${h * 0.34} L${w * 0.2} ${h * 0.42} Z`} fill="#17191D" fillOpacity="0.10" />
        <Path d={`M0 ${h * 0.34} H${w} V${h * 0.6} H0 Z`} fill="url(#mist)" />

        {/* Middle ridge. */}
        <Path d={`M0 ${h * 0.62} L${w * 0.14} ${h * 0.44} L${w * 0.3} ${h * 0.56} L${w * 0.46} ${h * 0.38} L${w * 0.62} ${h * 0.54} L${w * 0.8} ${h * 0.42} L${w} ${h * 0.58} V${h} H0 Z`} fill="url(#mid)" />
        <Path d={`M${w * 0.46} ${h * 0.38} L${w * 0.62} ${h * 0.54} L${w * 0.44} ${h * 0.6} Z M${w * 0.8} ${h * 0.42} L${w} ${h * 0.58} L${w * 0.82} ${h * 0.64} Z`} fill="#17191D" fillOpacity="0.12" />

        {/* Near ridge, with the road cut across it. */}
        <Path d={`M0 ${h * 0.84} L${w * 0.22} ${h * 0.66} L${w * 0.4} ${h * 0.76} L${w * 0.6} ${h * 0.62} L${w * 0.78} ${h * 0.74} L${w} ${h * 0.68} V${h} H0 Z`} fill="url(#near)" />
        <Path d={`M${w * 0.6} ${h * 0.62} L${w * 0.78} ${h * 0.74} L${w * 0.58} ${h * 0.82} Z`} fill="#17191D" fillOpacity="0.14" />
        <Path d={`M0 ${h * 0.9} C ${w * 0.3} ${h * 0.86}, ${w * 0.5} ${h * 0.78}, ${w} ${h * 0.8}`}
              fill="none" stroke="#17191D" strokeOpacity="0.35" strokeWidth={2} />
      </Svg>
    </View>
  );
}
