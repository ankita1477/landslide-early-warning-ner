/** Typed client for the risk API. */

import type { FeatureCollection } from "geojson";

export type Tier = "green" | "yellow" | "orange" | "red";

export interface SegmentSummary {
  id: string;
  highway_code: string;
  chainage_km: number;
  risk: number;
  tier: Tier;
}

export interface Components {
  susceptibility: number;
  trigger_probability: number;
  deformation_modifier: number;
  exposure: number;
}

export interface SegmentDetail extends SegmentSummary {
  computed_at: string;
  horizon_h: number;
  hazard: number;
  length_m: number;
  runout_reach_m: number | null;
  components: Components;
}

export interface TierThreshold {
  tier: Tier;
  threshold: number;
}

export interface Health {
  status: string;
  segments_loaded: number;
  tiers_calibrated: boolean;
}

const BASE = "/api/v1";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => get<Health>("/health"),
  segments: (limit = 500) =>
    get<{ count: number; segments: SegmentSummary[] }>(`/risk/segments?limit=${limit}`),
  watchlist: (limit = 50) =>
    get<{ count: number; segments: SegmentSummary[] }>(
      `/risk/watchlist?limit=${limit}`,
    ),
  segment: (id: string) => get<SegmentDetail>(`/risk/segments/${encodeURIComponent(id)}`),
  geojson: () => get<FeatureCollection>("/risk/geojson"),
  /** Cut-points are calibrated per corridor, so they are fetched, never assumed. */
  tiers: () => get<TierThreshold[]>("/risk/tiers"),
};
