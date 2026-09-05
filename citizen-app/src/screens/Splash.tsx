import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { Range } from "../illustrations/Range";
import { Button } from "../components/Button";
import { C, SPACE, TYPE } from "../lib/theme";

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
      Animated.timing(mark, {
        toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [mark, rise]);

  // Scale, not opacity — same reasoning as the text below. A splash whose mark
  // never appears is a broken first impression, and this screen is mostly the
  // mark. Settling into size degrades to simply being the right size.
  const markStyle = {
    transform: [
      { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
    ],
  };
  // Movement only, never opacity, for anything the user needs.
  //
  // If the entrance animation does not run — a dropped frame loop, a paused
  // timeline, a device that never schedules it — the only way into the app must
  // still be visible. Sliding into place degrades to simply being in place.
  const textStyle = {
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
    ],
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#111A30", "#0A0D14", "#0A0D14"]}
        style={StyleSheet.absoluteFill}
      />
      <Range />

      <View style={styles.centre}>
        <Animated.View style={markStyle}>
          <Logo size={116} />
        </Animated.View>

        <Animated.View style={[styles.words, textStyle]}>
          <Text style={styles.brand}>LANDSAFE<Text style={styles.brandThin}> NER</Text></Text>
          <Text style={styles.tagline}>Early warning. Safer journeys.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, textStyle]}>
        <Button label="Check safety" onPress={onEnter} icon={ArrowRight} />
        <Text style={styles.footnote}>
          Landslide early warning for the North Eastern Region
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.lg, paddingBottom: 40 },
  words: { alignItems: "center", gap: SPACE.xs },
  brand: {
    ...TYPE.hero, fontSize: 33, color: C.cream, letterSpacing: 2.5, fontWeight: "800",
  },
  brandThin: { color: C.accent, fontWeight: "300" },
  tagline: { ...TYPE.body, fontSize: 15.5, color: C.text2, letterSpacing: 0.3 },
  bottom: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xl, gap: SPACE.md },
  footnote: {
    fontSize: 12, color: C.text3, textAlign: "center", lineHeight: 18,
  },
});
