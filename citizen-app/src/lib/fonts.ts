import { useFonts } from "expo-font";
import {
  Fraunces_500Medium_Italic, Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  InstrumentSans_400Regular, InstrumentSans_500Medium,
  InstrumentSans_600SemiBold, InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";

/** Loads the two faces. Returns true once they are ready or have failed —
 *  a font that will not load must never keep the app from opening. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  return loaded || !!error;
}
