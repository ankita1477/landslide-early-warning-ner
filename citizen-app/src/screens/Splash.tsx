import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { Range } from "../illustrations/Range";
import { Button } from "../components/Button";
import { C, FONT, SPACE, TYPE } from "../lib/theme";

/** The first thing anyone sees.
 *
 *  It has one job: make it obvious within a second that this app tells you
 *  whether your journey is safe. No score, no method, no institution — a mark,
 *  a promise, and a way in.
 */
export function Splash({ onEnter }: { onEnter: () => void }) {
  const rise = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(mark, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [mark, rise]);

  // Scale and movement only, never opacity, for anything the user needs. If
  // the entrance animation does not run, the mark is simply the right size and
  // the button is simply in place — the correct failure.
  const markStyle = { transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] };
  const textStyle = { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#EDE7D8", "#F4F1EA"]} style={StyleSheet.absoluteFill} />
      <Range />
      {/* The hills fade into the paper behind the button, so the way in and
          the line under it never sit on a dark ridge. */}
      <LinearGradient colors={["rgba(244,241,234,0)", "#F4F1EA"]} style={styles.fade} pointerEvents="none" />

      <View style={styles.centre}>
        <Animated.View style={markStyle}>
          <Logo size={108} />
        </Animated.View>
        <Animated.View style={[styles.words, textStyle]}>
          <Text style={styles.brand}>Landsafe</Text>
          <Text style={styles.region}>North Eastern Region</Text>
          <Text style={styles.tagline}>Know the road before you take it.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, textStyle]}>
        <Button label="Check today's road" onPress={onEnter} icon={ArrowRight} />
        <Text style={styles.footnote}>Landslide early warning for NH-10 and the hills beyond</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.lg, paddingBottom: 60 },
  words: { alignItems: "center", gap: 4 },
  brand: { ...TYPE.display, fontSize: 44, lineHeight: 50, color: C.ink },
  region: { ...TYPE.eyebrow, fontSize: 12, letterSpacing: 2.2, color: C.ink2, marginTop: 2 },
  tagline: { fontFamily: FONT.displayItalic, fontSize: 18, lineHeight: 26, color: C.ink2, marginTop: SPACE.sm },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 260 },
  bottom: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xl, gap: SPACE.md },
  footnote: { ...TYPE.small, color: C.ink2, textAlign: "center" },
});
