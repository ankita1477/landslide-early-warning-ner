"""Road network from OpenStreetMap.

OSM is the only road source that needs no credentials and no manual export,
which matters because the GSI and Survey of India portals are not reachable
from outside India. Geometry quality on NH-10 is good; attribute quality
(lane counts, surface) is not, so we use OSM for centrelines only.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import osmnx as ox
from shapely.geometry import LineString, shape
from shapely.ops import linemerge, substring

from ingestion.aoi import AOI

log = logging.getLogger(__name__)

# The corridor's alerting unit. Everything downstream keys off these.
CHAINAGE_M = 1000.0

# 'trunk' is how NH-10 is tagged; 'primary' catches state highways feeding it.
HIGHWAY_CLASSES = ["motorway", "trunk", "primary", "secondary"]


def fetch_roads(aoi: AOI, out_path: Path | None = None) -> gpd.GeoDataFrame:
    """All significant roads in the AOI, in the AOI's metric CRS."""
    min_lon, min_lat, max_lon, max_lat = aoi.bbox
    gdf = ox.features_from_bbox(
        bbox=(min_lon, min_lat, max_lon, max_lat),
        tags={"highway": HIGHWAY_CLASSES},
    )
    gdf = gdf[gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])]

    keep = [c for c in ("highway", "name", "ref", "lanes", "surface", "geometry")
            if c in gdf.columns]
    gdf = gdf[keep].reset_index(drop=True).to_crs(aoi.utm_crs)

    # Overpass returns whole ways that merely intersect the bbox, so they run past the
    # study area. Chainage built on those would extend beyond the DEM and the segments
    # would carry terrain values we never computed.
    clip = gpd.GeoDataFrame(geometry=[shape(aoi.geojson)], crs="EPSG:4326").to_crs(aoi.utm_crs)
    km_before = gdf.geometry.length.sum() / 1000
    gdf = gdf.clip(clip).reset_index(drop=True)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

    # Clipping trims geometry rather than dropping rows, so length is the honest measure.
    log.info(
        "fetched %d road features in %d classes; %.1f km -> %.1f km after clipping to the AOI",
        len(gdf), gdf["highway"].nunique(), km_before, gdf.geometry.length.sum() / 1000
    )
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_parquet(out_path)
    return gdf


def _as_str(value) -> str:
    """OSM 'ref' is sometimes a list when a way carries several designations."""
    if isinstance(value, list):
        return ";".join(str(v) for v in value)
    return "" if value is None else str(value)


def select_highway(roads: gpd.GeoDataFrame, ref_contains: str = "NH10") -> gpd.GeoDataFrame:
    """Pick one designated highway out of the network by its `ref` tag."""
    if "ref" not in roads.columns:
        return roads.iloc[0:0]
    wanted = ref_contains.replace(" ", "").replace("-", "").upper()
    refs = roads["ref"].map(_as_str).str.replace(r"[\s-]", "", regex=True).str.upper()
    return roads[refs.str.contains(wanted, na=False)].copy()


def build_chainage(
    highway: gpd.GeoDataFrame, highway_code: str, spacing_m: float = CHAINAGE_M
) -> gpd.GeoDataFrame:
    """Cut a highway into fixed-length segments — the unit alerts are issued against.

    OSM splits a highway into many ways; they must be merged before cutting or
    chainage restarts at every junction and the segment ids are meaningless.
    """
    merged = linemerge([g for g in highway.geometry if isinstance(g, LineString)]
                       or list(highway.geometry))
    parts = [merged] if isinstance(merged, LineString) else list(merged.geoms)
    parts.sort(key=lambda p: p.length, reverse=True)

    rows, chainage = [], 0.0
    for part in parts:
        offset = 0.0
        while offset < part.length:
            end = min(offset + spacing_m, part.length)
            piece = substring(part, offset, end)
            if piece.length > 1.0:  # drop slivers left at the end of a part
                rows.append({
                    "highway_code": highway_code,
                    "chainage_km": round(chainage / 1000.0, 3),
                    "length_m": round(piece.length, 1),
                    "geometry": piece,
                })
                chainage += piece.length
            offset = end

    out = gpd.GeoDataFrame(rows, crs=highway.crs)
    log.info("built %d segments covering %.1f km", len(out), out["length_m"].sum() / 1000)
    return out
