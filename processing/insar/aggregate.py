"""Turn a displacement stack into per-segment time series.

Sampling is restricted to pixels that stayed coherent through the whole chain.
Everything else is left out rather than filled: a segment with no coherent pixel
reports no observation, which the fusion step reads as `unknown` and a modifier
of 1.0. Reporting `stable` there would mark an unwatched slope as safe.
"""

from __future__ import annotations

import logging

import geopandas as gpd
import numpy as np
import pandas as pd
from rasterio.transform import rowcol

log = logging.getLogger(__name__)

DEFAULT_BUFFER_M = 500.0


def segment_series(
    segments: gpd.GeoDataFrame,
    displacement_mm: np.ndarray,
    dates: pd.DatetimeIndex,
    transform,
    coherence: np.ndarray,
    raster_crs: str = "EPSG:4326",
    buffer_m: float = DEFAULT_BUFFER_M,
    id_field: str = "chainage_km",
) -> pd.DataFrame:
    """Median displacement history of the coherent pixels around each segment."""
    wgs = segments.to_crs(raster_crs)
    metric = segments.to_crs(segments.estimate_utm_crs())

    n_epochs, height, width = displacement_mm.shape
    # A pixel is usable only if it survived every link.
    usable = np.isfinite(displacement_mm[-1])

    rows = []
    for (_, wgs_row), (_, metric_row) in zip(wgs.iterrows(), metric.iterrows(), strict=True):
        # Buffer in metres, then convert to the raster's degrees for indexing.
        area = metric_row.geometry.buffer(buffer_m)
        area_wgs = (
            gpd.GeoSeries([area], crs=metric.crs).to_crs(raster_crs).iloc[0]
        )
        min_lon, min_lat, max_lon, max_lat = area_wgs.bounds
        row_max, col_min = rowcol(transform, min_lon, min_lat)
        row_min, col_max = rowcol(transform, max_lon, max_lat)
        row_min, row_max = max(0, min(row_min, row_max)), min(height, max(row_min, row_max) + 1)
        col_min, col_max = max(0, min(col_min, col_max)), min(width, max(col_min, col_max) + 1)
        if row_min >= row_max or col_min >= col_max:
            continue

        patch = usable[row_min:row_max, col_min:col_max]
        if not patch.any():
            continue

        series = displacement_mm[:, row_min:row_max, col_min:col_max][:, patch]
        rows.append(
            pd.DataFrame({
                "segment": str(wgs_row[id_field]),
                "date": dates,
                "displacement_mm": np.nanmedian(series, axis=1),
                "coherence": float(np.nanmean(coherence[row_min:row_max, col_min:col_max][patch])),
                "n_pixels": int(patch.sum()),
            })
        )

    if not rows:
        log.warning("no segment had a coherent pixel; the corridor is unobservable")
        return pd.DataFrame(
            columns=["segment", "date", "displacement_mm", "coherence", "n_pixels"]
        )

    out = pd.concat(rows, ignore_index=True)
    observed = out["segment"].nunique()
    log.info(
        "%d of %d segments have coherent pixels (%.0f%%), %d epochs each",
        observed, len(segments), 100 * observed / len(segments), n_epochs,
    )
    return out
