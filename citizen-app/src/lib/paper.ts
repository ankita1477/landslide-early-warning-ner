import { MD3DarkTheme, type MD3Theme } from "react-native-paper";
import { C, RADIUS } from "./theme";

/** react-native-paper, told to speak the app's palette.
 *
 *  Paper supplies the behaviours that are tedious to get right by hand —
 *  chips, accordions, snackbars, ripples, focus handling — and this theme
 *  keeps them from looking like a Material demo dropped into the app.
 */
export const paperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: RADIUS.control / 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: C.accent,
    onPrimary: C.bg,
    primaryContainer: "rgba(91,141,239,0.18)",
    onPrimaryContainer: C.text1,
    secondary: C.cream,
    onSecondary: C.bg,
    secondaryContainer: C.surfaceHi,
    onSecondaryContainer: C.text1,
    background: C.bg,
    onBackground: C.text1,
    surface: C.surface,
    onSurface: C.text1,
    surfaceVariant: C.surfaceHi,
    onSurfaceVariant: C.text2,
    outline: C.borderHi,
    outlineVariant: C.border,
    inverseSurface: C.text1,
    inverseOnSurface: C.bg,
    error: C.red,
    elevation: {
      level0: "transparent",
      level1: C.surface,
      level2: C.surface,
      level3: C.surfaceHi,
      level4: C.surfaceHi,
      level5: C.surfaceHi,
    },
  },
};
