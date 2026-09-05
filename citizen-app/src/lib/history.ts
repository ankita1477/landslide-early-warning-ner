/** Warning history, recorded on the device.
 *
 *  The API serves the current scoring run and stores no past days, so history
 *  cannot be fetched. What the app can honestly do is remember what it has
 *  itself shown: each time the band for the user's stretch changes, that change
 *  is recorded. The list therefore starts empty and fills as the app is used,
 *  which is stated on the screen rather than hidden.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { TIER_RANK, type Tier } from "./theme";

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
 *  that mattered under hundreds of identical rows.
 *
 *  Returns whether this reading was an escalation, which is what decides if the
 *  banner drops. Only a worsening band interrupts the person: the same rule the
 *  SMS dispatcher uses, and for the same reason — a banner that appears on every
 *  refresh is one people learn to dismiss without reading.
 */
export async function record(
  tier: Tier, km: number, reason: string,
): Promise<{ escalated: boolean }> {
  const all = await history();
  const previous = all[0];
  if (previous?.tier === tier && previous?.km === km) return { escalated: false };
  const entry: WarningEntry = { at: new Date().toISOString(), tier, km, reason };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...all].slice(0, LIMIT)));
  } catch {
    // History is a convenience; failing to write it must not break the screen.
  }
  // A first-ever reading is not an escalation: nothing got worse, the app simply
  // has not looked before. Announcing it would cry wolf on a green stretch.
  const escalated =
    previous != null && TIER_RANK[tier] > TIER_RANK[previous.tier as Tier];
  return { escalated };
}
