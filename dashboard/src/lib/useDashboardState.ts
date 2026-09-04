import { useCallback, useMemo, useReducer } from "react";
import type { SegmentSummary, Tier } from "../api/client";

export type { SegmentSummary };
import { BAND_RANK, TIERS } from "./bands";
import type { LayerKey } from "./bands";

export type SortKey = "risk" | "km";
export type Pane = "map" | "list" | "detail";

export interface DashboardState {
  selectedId: string | null;
  hoveredId: string | null;
  bands: Tier[];
  brush: [number, number] | null;
  sort: SortKey;
  mapLayer: LayerKey | "risk";
  highContrastBands: boolean;
  pane: Pane;
  showTable: boolean;
  showShortcuts: boolean;
}

type Action =
  | { type: "select"; id: string | null }
  | { type: "hover"; id: string | null }
  | { type: "toggleBand"; band: Tier }
  | { type: "clearFilters" }
  | { type: "brush"; range: [number, number] | null }
  | { type: "sort"; key: SortKey }
  | { type: "mapLayer"; layer: LayerKey | "risk" }
  | { type: "toggleContrast" }
  | { type: "pane"; pane: Pane }
  | { type: "toggleTable" }
  | { type: "toggleShortcuts" };

const initial: DashboardState = {
  selectedId: null,
  hoveredId: null,
  bands: [...TIERS],
  brush: null,
  sort: "risk",
  mapLayer: "risk",
  highContrastBands: false,
  pane: "map",
  showTable: false,
  showShortcuts: false,
};

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "hover":
      return { ...state, hoveredId: action.id };
    case "toggleBand": {
      const on = state.bands.includes(action.band);
      const bands = on
        ? state.bands.filter((b) => b !== action.band)
        : [...state.bands, action.band];
      return { ...state, bands };
    }
    case "clearFilters":
      return { ...state, bands: [...TIERS], brush: null };
    case "brush":
      return { ...state, brush: action.range };
    case "sort":
      return { ...state, sort: action.key };
    case "mapLayer":
      return { ...state, mapLayer: action.layer };
    case "toggleContrast":
      return { ...state, highContrastBands: !state.highContrastBands };
    case "pane":
      return { ...state, pane: action.pane };
    case "toggleTable":
      return { ...state, showTable: !state.showTable };
    case "toggleShortcuts":
      return { ...state, showShortcuts: !state.showShortcuts };
    default:
      return state;
  }
}

/** One reducer for the whole console, so the map, the watchlist and the strip
 *  can never disagree about what is selected or filtered. */
export function useDashboardState(allSegments: SegmentSummary[]) {
  const [state, dispatch] = useReducer(reducer, initial);

  /** Filtering happens once, here. Every region reads the same derived list. */
  const visible = useMemo(() => {
    const inBands = allSegments.filter((s) => state.bands.includes(s.tier));
    const inBrush = state.brush
      ? inBands.filter(
          (s) =>
            s.chainage_km >= state.brush![0] && s.chainage_km <= state.brush![1],
        )
      : inBands;
    return [...inBrush].sort((a, b) =>
      state.sort === "km"
        ? a.chainage_km - b.chainage_km
        : b.risk - a.risk || BAND_RANK[b.tier] - BAND_RANK[a.tier],
    );
  }, [allSegments, state.bands, state.brush, state.sort]);

  const counts = useMemo(
    () =>
      TIERS.map((tier) => ({
        tier,
        n: allSegments.filter((s) => s.tier === tier).length,
      })),
    [allSegments],
  );

  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), []);
  const hover = useCallback((id: string | null) => dispatch({ type: "hover", id }), []);

  return { state, dispatch, visible, counts, select, hover };
}
