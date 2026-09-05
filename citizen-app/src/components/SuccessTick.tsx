import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useReducedMotion } from "../lib/motion";
import { C, SPACE, TYPE } from "../lib/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The confirmation after a report is sent.
 *
 *  The tick draws itself rather than appearing: a stroke completing reads as
 *  "this finished", which is exactly the reassurance someone needs after
 *  reporting a hazard from the roadside.
 */
export function SuccessTick({ title, body }: { title: string; body: string }) {
  const draw = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(draw, {
      toValue: 1, duration: reduced ? 0 : 520, easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [draw, reduced]);

  const LENGTH = 48;

  return (
    <View style={styles.wrap}>
      <Svg width={72} height={72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={31} fill="rgba(34,197,94,0.14)" stroke={C.green} strokeWidth={2} />
        <AnimatedPath
          d="M22 37 L32 47 L51 26"
          fill="none" stroke={C.green} strokeWidth={4.5}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [LENGTH, 0] })}
        />
      </Svg>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.lg },
  title: { ...TYPE.title, color: C.text1, marginTop: SPACE.xs },
  body: { ...TYPE.body, color: C.text2, textAlign: "center", maxWidth: 34 * 8 },
});
