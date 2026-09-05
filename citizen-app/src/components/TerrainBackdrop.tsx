import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { C } from "../lib/theme";

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

/** A slow radar sweep over layered ridgelines.
 *
 *  Deliberately understated: one rotation every twelve seconds and ridges that
 *  do not move at all. This is a safety app, and motion that draws the eye
 *  competes with the one number the screen exists to deliver.
 */
export function TerrainBackdrop() {
  const { width, height } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    sweep.start(); pulse.start();
    return () => { sweep.stop(); pulse.stop(); };
  }, [spin, breathe]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  const ridgeTop = height * 0.62;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Radar rings, centred behind the mark. */}
      <View style={[styles.radarWrap, { top: height * 0.16 }]}>
        <Animated.View style={{ opacity }}>
          <Svg width={340} height={340} viewBox="0 0 340 340">
            {[60, 105, 150].map((r) => (
              <Circle key={r} cx={170} cy={170} r={r} fill="none"
                      stroke={C.accent} strokeOpacity={0.18} strokeWidth={1} />
            ))}
          </Svg>
        </Animated.View>
        <AnimatedSvg
          width={340} height={340} viewBox="0 0 340 340"
          style={[styles.sweep, { transform: [{ rotate }] }]}
        >
          <Defs>
            <LinearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.accent} stopOpacity="0.28" />
              <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d="M170 170 L170 20 A150 150 0 0 1 275 62 Z" fill="url(#beam)" />
        </AnimatedSvg>
      </View>

      {/* Static ridgelines: the terrain the system is watching. */}
      <Svg width={width} height={height - ridgeTop} style={[styles.ridges, { top: ridgeTop }]}>
        <Path
          d={`M0 ${height * 0.16} L${width * 0.22} ${height * 0.05} L${width * 0.38} ${height * 0.13}
              L${width * 0.58} ${height * 0.02} L${width * 0.78} ${height * 0.12}
              L${width} ${height * 0.04} V${height} H0 Z`}
          fill={C.surface} fillOpacity={0.55}
        />
        <Path
          d={`M0 ${height * 0.24} L${width * 0.3} ${height * 0.13} L${width * 0.52} ${height * 0.22}
              L${width * 0.74} ${height * 0.1} L${width} ${height * 0.2} V${height} H0 Z`}
          fill={C.surfaceHi} fillOpacity={0.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  radarWrap: { position: "absolute", alignSelf: "center", alignItems: "center" },
  sweep: { position: "absolute" },
  ridges: { position: "absolute", left: 0 },
});
