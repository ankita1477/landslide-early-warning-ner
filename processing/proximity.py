"""Distance-to-feature rasters.

The build guide calls `gdal_proximity.py`, a GDAL CLI script we do not have —
rasterio bundles the GDAL library but none of its command-line tools. SciPy's
exact Euclidean distance transform gives the same answer, stays in-process, and
is faster than shelling out.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import rasterio
from rasterio.features import rasterize
from scipy.ndimage import distance_transform_edt

log = logging.getLogger(__name__)

NODATA = -9999.0


def distance_to(
    features: gpd.GeoDataFrame, reference: Path, dest: Path, all_touched: bool = True
) -> Path:
    """Metres from every cell to the nearest feature, on the reference grid."""
    with rasterio.open(reference) as ref:
        if features.crs != ref.crs:
            features = features.to_crs(ref.crs)
        shape, transform = (ref.height, ref.width), ref.transform
        profile = ref.profile | {"dtype": "float32", "nodata": NODATA, "count": 1}
        # Cells are square after the UTM warp, so one scalar spacing is exact.
        pixel_m = abs(transform.a)

    burned = rasterize(
        ((geom, 1) for geom in features.geometry if geom is not None and not geom.is_empty),
        out_shape=shape, transform=transform, fill=0, dtype="uint8",
        all_touched=all_touched,
    )
    if not burned.any():
        raise ValueError("no features fell inside the reference grid — check the CRS")

    # EDT measures distance to the nearest zero, so invert: features become zero.
    dist = distance_transform_edt(burned == 0) * pixel_m

    dest.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(dest, "w", **profile) as dst:
        dst.write(dist.astype("float32"), 1)

    log.info("%s: %.0f m max, %d cells on feature", dest.name, dist.max(), int(burned.sum()))
    return dest
