"""Settlements and critical facilities from OpenStreetMap.

Exposure answers "who and what is in the way". Without it the risk formula has
a term that is always 1.0, which means a landslide above an empty gorge scores
the same as one above a school.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import osmnx as ox

from ingestion.aoi import AOI

log = logging.getLogger(__name__)

# Rough resident counts by OSM place class. These are order-of-magnitude
# weights, not a census: OSM rarely carries a population tag here, and the
# ranking between segments is what matters, not the absolute head count.
PLACE_WEIGHT = {"city": 100_000, "town": 20_000, "village": 2_000, "hamlet": 300}

# A hospital that becomes unreachable is worse than a school, which is worse
# than neither. Weighted in units of "people-equivalent" so one scale carries
# both population and facilities.
FACILITY_WEIGHT = {"hospital": 5_000, "clinic": 1_500, "school": 2_000}


def fetch_settlements(aoi: AOI, out_path: Path | None = None) -> gpd.GeoDataFrame:
    """Populated places, with an estimated resident count."""
    raw = ox.features_from_bbox(
        bbox=aoi.bbox, tags={"place": list(PLACE_WEIGHT)}
    )
    frame = raw[raw["place"].isin(PLACE_WEIGHT)].copy()
    frame["geometry"] = frame.geometry.representative_point()

    # Use the tagged population where OSM has one; fall back to the class weight.
    tagged = (
        frame["population"].astype(str).str.extract(r"(\d+)")[0].astype(float)
        if "population" in frame.columns
        else None
    )
    frame["people"] = frame["place"].map(PLACE_WEIGHT).astype(float)
    if tagged is not None:
        frame["people"] = tagged.fillna(frame["people"])

    out = frame[["place", "name", "people", "geometry"]].to_crs(aoi.utm_crs)
    log.info("settlements: %d (%s)", len(out), out["place"].value_counts().to_dict())
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out.to_parquet(out_path)
    return out


def fetch_facilities(aoi: AOI, out_path: Path | None = None) -> gpd.GeoDataFrame:
    """Schools, clinics and hospitals — the places whose isolation matters most."""
    raw = ox.features_from_bbox(
        bbox=aoi.bbox, tags={"amenity": list(FACILITY_WEIGHT)}
    )
    frame = raw[raw["amenity"].isin(FACILITY_WEIGHT)].copy()
    frame["geometry"] = frame.geometry.representative_point()
    frame["people"] = frame["amenity"].map(FACILITY_WEIGHT).astype(float)

    out = frame[["amenity", "name", "people", "geometry"]].to_crs(aoi.utm_crs)
    log.info("facilities: %d (%s)", len(out), out["amenity"].value_counts().to_dict())
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out.to_parquet(out_path)
    return out
