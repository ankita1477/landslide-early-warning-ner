"""Copernicus GLO-30 DEM download.

Chosen over SRTM because the tiles sit in a public AWS bucket with no
credentials, so this step does not block on Earthdata or GEE approval.
Resolution is 30 m, void-filled, and vertically referenced to EGM2008.

Tiles are 1x1 degree COGs named by their south-west corner.
"""

from __future__ import annotations

import logging
from pathlib import Path

import httpx
import rasterio
from rasterio.merge import merge

from ingestion.aoi import AOI

log = logging.getLogger(__name__)

BASE_URL = "https://copernicus-dem-30m.s3.amazonaws.com"


def _tile_name(lat: int, lon: int) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00"


def tiles_for(aoi: AOI) -> list[str]:
    """Every 1-degree tile whose footprint intersects the AOI bbox."""
    min_lon, min_lat, max_lon, max_lat = aoi.bbox
    import math

    return [
        _tile_name(lat, lon)
        for lat in range(math.floor(min_lat), math.ceil(max_lat))
        for lon in range(math.floor(min_lon), math.ceil(max_lon))
    ]


def download_tile(tile: str, out_dir: Path) -> Path:
    stem = f"Copernicus_DSM_COG_10_{tile}_DEM"
    dest = out_dir / f"{stem}.tif"
    if dest.exists():
        log.info("tile %s already present, skipping", tile)
        return dest

    url = f"{BASE_URL}/{stem}/{stem}.tif"
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tif.part")
    with httpx.stream("GET", url, timeout=120.0, follow_redirects=True) as r:
        r.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in r.iter_bytes(1 << 20):
                fh.write(chunk)
    tmp.rename(dest)  # atomic, so a killed download never looks complete
    log.info("downloaded %s (%.1f MB)", tile, dest.stat().st_size / 1e6)
    return dest


def fetch_dem(aoi: AOI, out_dir: Path, cropped_name: str = "dem_aoi.tif") -> Path:
    """Download every tile covering the AOI and mosaic them, cropped to the bbox."""
    paths = [download_tile(t, out_dir) for t in tiles_for(aoi)]

    srcs = [rasterio.open(p) for p in paths]
    try:
        mosaic, transform = merge(srcs, bounds=aoi.bbox)
        profile = srcs[0].profile
    finally:
        for s in srcs:
            s.close()

    profile.update(
        height=mosaic.shape[1], width=mosaic.shape[2],
        transform=transform, compress="deflate", predictor=3, tiled=True,
    )
    dest = out_dir / cropped_name
    with rasterio.open(dest, "w", **profile) as dst:
        dst.write(mosaic)
    log.info("mosaic written to %s (%d x %d)", dest, mosaic.shape[2], mosaic.shape[1])
    return dest
