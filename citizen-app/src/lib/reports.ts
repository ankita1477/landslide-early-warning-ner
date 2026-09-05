/** Citizen hazard reports, queued on the device.
 *
 *  The API has no endpoint to receive these yet — §14.4 specifies POST /reports
 *  but it is not implemented. Rather than drop a report or pretend it was sent,
 *  each one is stored locally and shown as queued, with a count the person can
 *  see. When the endpoint exists, `flush` is the only function that changes.
 *
 *  This matters more than it looks: the README notes that a sparse inventory is
 *  the binding constraint on the whole system, and moderated citizen reports are
 *  how that inventory grows.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "queued-reports";

export type Category = "blocked" | "rocks" | "crack" | "water";

export const CATEGORIES: { key: Category; label: string; help: string }[] = [
  { key: "blocked", label: "Road blocked", help: "Nothing can pass right now" },
  { key: "rocks", label: "Falling rocks", help: "Rocks or debris coming down" },
  { key: "crack", label: "Cracks", help: "New cracks in the road or the slope" },
  { key: "water", label: "Water flowing", help: "Water coming out of the hillside" },
];

export interface Report {
  id: string;
  category: Category;
  note: string;
  lat: number | null;
  lon: number | null;
  photoUri: string | null;
  createdAt: string;
  sent: boolean;
}

export async function queued(): Promise<Report[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

export async function submit(
  category: Category, note: string, lat: number | null, lon: number | null,
  photoUri: string | null = null,
): Promise<Report> {
  const report: Report = {
    id: `${Date.now()}`,
    category,
    note: note.trim(),
    lat,
    lon,
    photoUri,
    createdAt: new Date().toISOString(),
    sent: false,
  };
  const all = await queued();
  await AsyncStorage.setItem(KEY, JSON.stringify([report, ...all]));
  return report;
}

export async function clear(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
