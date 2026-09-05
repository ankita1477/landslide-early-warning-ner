/** Talks to the same API as the dashboard, and remembers the last good answer.
 *
 *  Offline is the normal case, not the edge case. The network fails during
 *  exactly the storm the warning is about, so every response is cached and the
 *  screen states plainly when it is showing a remembered value and how old it is.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { Tier } from "./theme";

const API_PORT = 8000;
const API_PATH = "/api/v1";

/** Where the API lives.
 *
 *  `localhost` is wrong on a phone: it resolves to the handset, not the laptop
 *  running `make api`, so a device build silently fails every request. Expo
 *  already knows the development machine's LAN address — it is how the bundle
 *  reached the phone — so that host is reused and the API is found without
 *  anyone editing a config file.
 *
 *  EXPO_PUBLIC_API_URL overrides everything, which is what a real deployment
 *  would set.
 */
function resolveBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  // e.g. "192.168.1.14:8081" while developing on a device.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(":")[0];

  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${API_PORT}${API_PATH}`;
  }
  return `http://localhost:${API_PORT}${API_PATH}`;
}

export const BASE = resolveBase();

export interface SegmentSummary {
  id: string;
  highway_code: string;
  chainage_km: number;
  risk: number;
  tier: Tier;
}

export interface PointRisk {
  lat: number;
  lon: number;
  distance_to_segment_m: number;
  segment: SegmentSummary;
}

export interface Cached<T> {
  data: T;
  fetchedAt: string;
  stale: boolean;
}

async function remember<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(
      key, JSON.stringify({ data: value, fetchedAt: new Date().toISOString() }),
    );
  } catch {
    // A cache write failing must never break the screen that just loaded fine.
  }
}

async function recall<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; fetchedAt: string };
    return { ...parsed, stale: true };
  } catch {
    return null;
  }
}

async function fetchOrRecall<T>(path: string, key: string): Promise<Cached<T>> {
  try {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) throw new Error(`${response.status}`);
    const data = (await response.json()) as T;
    await remember(key, data);
    return { data, fetchedAt: new Date().toISOString(), stale: false };
  } catch (error) {
    const cached = await recall<T>(key);
    if (cached) return cached;
    throw error;
  }
}

export const api = {
  nearby: (lat: number, lon: number) =>
    fetchOrRecall<PointRisk>(
      `/risk/point?lat=${lat}&lon=${lon}`, `point:${lat.toFixed(2)},${lon.toFixed(2)}`,
    ),
  corridor: () =>
    fetchOrRecall<{ count: number; segments: SegmentSummary[] }>(
      "/risk/segments?limit=500", "corridor",
    ),
  watchlist: () =>
    fetchOrRecall<{ count: number; segments: SegmentSummary[] }>(
      "/risk/watchlist?limit=25", "watchlist",
    ),
};

export function ageLabel(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
