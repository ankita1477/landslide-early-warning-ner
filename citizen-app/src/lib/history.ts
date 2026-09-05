/** Warning history, recorded on the device.
 *
 *  The API serves the current scoring run and stores no past days, so history
 *  cannot be fetched. What the app can honestly do is remember what it has
 *  itself shown: each time the band for the user's stretch changes, that change
 *  is recorded. The list therefore starts empty and fills as the app is used,
 *  which is stated on the screen rather than hidden.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tier } from "./theme";

const KEY = "warning-history";
const LIMIT = 50;

export interface WarningEntry {
  at: string;
  tier: Tier;
  km: number;
  reason: string;
}

export async function history(): Promise<WarningEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WarningEntry[]) : [];
  } catch {
    return [];
  }
}

/** Records only a change of band. Writing every check would bury the moments
 *  that mattered under hundreds of identical rows. */
export async function record(tier: Tier, km: number, reason: string): Promise<void> {
  const all = await history();
  if (all[0]?.tier === tier && all[0]?.km === km) return;
  const entry: WarningEntry = { at: new Date().toISOString(), tier, km, reason };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...all].slice(0, LIMIT)));
  } catch {
    // History is a convenience; failing to write it must not break the screen.
  }
}
