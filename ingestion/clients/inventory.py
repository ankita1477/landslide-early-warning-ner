"""Landslide inventory — the training labels.

Two sources, because no single one is sufficient:

* **NASA Global Landslide Catalog** (`load_glc`) — open, no credentials, but
  most events are geocoded to a settlement rather than the scarp. The
  `location_accuracy` field records that, and it is the difference between a
  usable label and noise: a point accurate to 25 km is 833 pixels of error on a
  30 m grid and will teach the model the terrain of the wrong hillside.
* **GSI Bhukosh** (`load_local`) — properly mapped Indian inventory, but the
  portal is not reachable outside India, so it has to be exported by hand.

Always report how many labels survived filtering. The count, not the model, is
what limits what can honestly be claimed.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import pandas as pd

from ingestion.aoi import AOI

log = logging.getLogger(__name__)

# Metres of positional error implied by each GLC accuracy class.
ACCURACY_M: dict[str, float] = {
    "exact": 50.0,
    "1km": 1_000.0,
    "5km": 5_000.0,
    "10km": 10_000.0,
    "25km": 25_000.0,
    "50km": 50_000.0,
    "100km": 100_000.0,
    "250km": 250_000.0,
}

# Beyond a few hundred metres a point no longer identifies a slope. 1 km is
# already 33 pixels at 30 m; anything looser is a region, not a location.
DEFAULT_MAX_ACCURACY_M = 1_000.0

SCHEMA = ["occurred_on", "geometry", "source", "fatalities", "trigger_type",
          "confidence", "accuracy_m", "verified"]


def _parse_dates(values: pd.Series) -> pd.Series:
    """Inventory dates arrive in mixed formats; parse per-element rather than
    letting pandas infer one format and silently coerce the rest to NaT."""
    return pd.to_datetime(values, errors="coerce", format="mixed").dt.date


def load_glc(
    shapefile: Path, aoi: AOI | None = None, max_accuracy_m: float = DEFAULT_MAX_ACCURACY_M
) -> gpd.GeoDataFrame:
    """Load the NASA catalog, clip to the AOI, and drop imprecisely located events."""
    raw = gpd.read_file(shapefile)
    if aoi is not None:
        min_lon, min_lat, max_lon, max_lat = aoi.bbox
        raw = raw.cx[min_lon:max_lon, min_lat:max_lat]
    n_in_aoi = len(raw)

    accuracy = raw["location_a"].map(ACCURACY_M)
    kept = raw[accuracy.notna() & (accuracy <= max_accuracy_m)].copy()
    kept["accuracy_m"] = accuracy.loc[kept.index]

    out = gpd.GeoDataFrame(
        {
            "occurred_on": _parse_dates(kept["event_date"]),
            "geometry": kept.geometry,
            "source": "GLC",
            "fatalities": pd.to_numeric(kept.get("fatality_c"), errors="coerce"),
            "trigger_type": kept.get("landslid_3"),
            "confidence": kept["location_a"],
            "accuracy_m": kept["accuracy_m"],
            "verified": False,
        },
        crs=raw.crs,
    )[SCHEMA]

    log.info(
        "GLC: %d events in AOI, %d within %.0f m accuracy (%.0f%% discarded as too "
        "imprecise to locate a slope)",
        n_in_aoi, len(out), max_accuracy_m,
        100 * (1 - len(out) / n_in_aoi) if n_in_aoi else 0,
    )
    if len(out) < 50:
        log.warning(
            "only %d usable labels — too few to fit a multi-feature susceptibility "
            "model. Widen the AOI or add a properly mapped inventory before training.",
            len(out),
        )
    return out


def load_local(path: Path, source: str = "GSI", aoi: AOI | None = None) -> gpd.GeoDataFrame:
    """Load a hand-exported inventory (GSI Bhukosh shapefile/GeoPackage/GeoJSON).

    Polygons are reduced to representative points, which stay inside concave
    shapes where a centroid can fall outside them.
    """
    raw = gpd.read_file(path)
    if raw.crs is None:
        raise ValueError(f"{path} has no CRS; set one before loading")
    raw = raw.to_crs("EPSG:4326")

    if aoi is not None:
        min_lon, min_lat, max_lon, max_lat = aoi.bbox
        raw = raw.cx[min_lon:max_lon, min_lat:max_lat]

    geometry = raw.geometry
    if not geometry.geom_type.isin(["Point"]).all():
        geometry = geometry.representative_point()

    date_col = next(
        (c for c in raw.columns if c.lower() in {"date", "event_date", "occurred_on", "year"}),
        None,
    )
    out = gpd.GeoDataFrame(
        {
            "occurred_on": _parse_dates(raw[date_col]) if date_col else pd.NaT,
            "geometry": geometry,
            "source": source,
            "fatalities": pd.NA,
            "trigger_type": pd.NA,
            "confidence": "mapped",
            "accuracy_m": 50.0,
            "verified": True,
        },
        crs="EPSG:4326",
    )[SCHEMA]
    log.info("%s: loaded %d mapped events from %s", source, len(out), path.name)
    return out


def combine(*frames: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Stack inventories, preferring the better-located duplicate of the same event."""
    frames = [f for f in frames if len(f)]
    if not frames:
        return gpd.GeoDataFrame(columns=SCHEMA, geometry="geometry", crs="EPSG:4326")
    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("accuracy_m").drop_duplicates(
        subset=["occurred_on", "geometry"], keep="first"
    )
    return gpd.GeoDataFrame(combined, geometry="geometry", crs=frames[0].crs)
