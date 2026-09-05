import { MD3LightTheme, type MD3Theme } from "react-native-paper";
import { C, FONT, RADIUS } from "./theme";

/** react-native-paper, told to speak the app's palette and faces.
 *
 *  Paper supplies the behaviours that are tedious to get right by hand —
 *  chips, accordions, ripples, focus handling — and this theme keeps them
 *  from looking like a Material demo dropped into the app.
 */
const fonts = Object.fromEntries(
  Object.entries(MD3LightTheme.fonts).map(([k, v]) => [
    k, { ...v, fontFamily: FONT.sans, fontWeight: undefined },
  ]),
) as MD3Theme["fonts"];

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: RADIUS.control / 4,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: C.ink,
    onPrimary: C.paper,
    primaryContainer: C.ink,
    onPrimaryContainer: C.paper,
    secondary: C.ink2,
    onSecondary: C.paper,
    secondaryContainer: C.paper2,
    onSecondaryContainer: C.ink,
    background: C.paper,
    onBackground: C.ink,
    surface: C.white,
    onSurface: C.ink,
    surfaceVariant: C.paper2,
    onSurfaceVariant: C.ink2,
    outline: C.lineHi,
    outlineVariant: C.line,
    error: C.red,
    elevation: {
      level0: "transparent", level1: C.white, level2: C.white,
      level3: C.white, level4: C.white, level5: C.white,
    },
  },
};
