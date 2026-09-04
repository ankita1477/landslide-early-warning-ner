"""Build the susceptibility training table.

Inventories record only where landslides happened, never where they did not, so
negatives are constructed — and that construction decides whether the model is
real. Three rules, each guarding a specific way of accidentally cheating:

* Negatives come only from slopes steep enough to fail. A floodplain pixel is a
  free correct answer that inflates every metric without adding skill.
* Negatives keep a buffer from every recorded event, so the ground immediately
  around a real failure is not labelled stable.
* Negatives are drawn to match the positives' elevation distribution, or the
  classifier separates the classes on altitude rather than on process.
"""

from __future__ import annotations

import logging

import geopandas as gpd
import numpy as np
import pandas as pd
import xarray as xr
from shapely.geometry import Point

log = logging.getLogger(__name__)

MIN_SLOPE_DEG = 10.0
BUFFER_M = 500.0
NEGATIVE_RATIO = 2


def sample_at(stack: xr.Dataset, points: gpd.GeoDataFrame) -> pd.DataFrame:
    """Feature values at each point, by nearest cell."""
    if points.crs != stack.rio.crs:
        points = points.to_crs(stack.rio.crs)
    xs = xr.DataArray(points.geometry.x.to_numpy(), dims="p")
    ys = xr.DataArray(points.geometry.y.to_numpy(), dims="p")
    sampled = stack.sel(x=xs, y=ys, method="nearest")
    return pd.DataFrame({name: sampled[name].to_numpy() for name in stack.data_vars})


def sample_negatives(
    events: gpd.GeoDataFrame, stack: xr.Dataset, n: int,
    min_slope: float = MIN_SLOPE_DEG, buffer_m: float = BUFFER_M,
    match_elevation: bool = True, seed: int = 42, max_attempts: int = 200,
) -> gpd.GeoDataFrame:
    """Candidate stable points: steep, far from any event, elevation-matched."""
    if "slope" not in stack.data_vars:
        raise ValueError("stack has no 'slope' layer; negatives cannot be constrained")

    rng = np.random.default_rng(seed)
    events_m = events.to_crs(stack.rio.crs)
    exclusion = events_m.geometry.buffer(buffer_m).union_all()

    elevation_bounds = None
    if match_elevation and "elevation" in stack.data_vars:
        positives = sample_at(stack, events_m)["elevation"].dropna()
        if len(positives):
            # Match the positives' range rather than their exact histogram: with a
            # handful of events a histogram match would just memorise them.
            elevation_bounds = (positives.min(), positives.max())

    x_min, x_max = float(stack.x.min()), float(stack.x.max())
    y_min, y_max = float(stack.y.min()), float(stack.y.max())

    picked: list[Point] = []
    attempts = 0
    while len(picked) < n and attempts < n * max_attempts:
        batch = max(n - len(picked), 64)
        attempts += batch
        xs = rng.uniform(x_min, x_max, batch)
        ys = rng.uniform(y_min, y_max, batch)
        candidates = gpd.GeoDataFrame(
            geometry=[Point(x, y) for x, y in zip(xs, ys, strict=True)],
            crs=stack.rio.crs,
        )
        values = sample_at(stack, candidates)

        keep = values["slope"].to_numpy() >= min_slope
        keep &= np.isfinite(values["slope"].to_numpy())
        if elevation_bounds is not None:
            elevation = values["elevation"].to_numpy()
            keep &= (elevation >= elevation_bounds[0]) & (elevation <= elevation_bounds[1])
        for i in np.flatnonzero(keep):
            point = candidates.geometry.iloc[i]
            if not exclusion.contains(point):
                picked.append(point)
                if len(picked) == n:
                    break

    if len(picked) < n:
        raise RuntimeError(
            f"only found {len(picked)} of {n} negatives after {attempts} draws — "
            "the constraints may be too tight for this AOI"
        )
    log.info("sampled %d negatives (slope >= %.0f deg, %.0f m from events)",
             n, min_slope, buffer_m)
    return gpd.GeoDataFrame(geometry=picked, crs=stack.rio.crs)


def build_dataset(
    events: gpd.GeoDataFrame, stack: xr.Dataset, negative_ratio: int = NEGATIVE_RATIO,
    **kwargs,
) -> gpd.GeoDataFrame:
    """Positives and constructed negatives with their features, ready for training."""
    events_m = events.to_crs(stack.rio.crs)
    negatives = sample_negatives(events_m, stack, len(events_m) * negative_ratio, **kwargs)

    positive_features = sample_at(stack, events_m)
    positive_features["label"] = 1
    negative_features = sample_at(stack, negatives)
    negative_features["label"] = 0

    table = pd.concat([positive_features, negative_features], ignore_index=True)
    geometry = list(events_m.geometry) + list(negatives.geometry)
    out = gpd.GeoDataFrame(table, geometry=geometry, crs=stack.rio.crs)

    before = len(out)
    out = out.dropna(subset=[c for c in stack.data_vars]).reset_index(drop=True)
    if len(out) < before:
        log.warning("dropped %d rows with missing features", before - len(out))

    log.info("dataset: %d positives, %d negatives, %d features",
             int(out["label"].sum()), int((out["label"] == 0).sum()), len(stack.data_vars))
    return out
