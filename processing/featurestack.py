"""Assemble predictor rasters into one aligned stack.

Every layer must share a grid — CRS, resolution, extent, transform. Layers that
merely overlap will stack without error and the model will learn from cells
that do not correspond to the same ground, which is invisible in the metrics.
"""

from __future__ import annotations

import logging
from pathlib import Path

import rioxarray  # noqa: F401  — registers the .rio accessor
import xarray as xr

log = logging.getLogger(__name__)


def build_stack(paths: dict[str, Path], reference: Path) -> xr.Dataset:
    """Reproject every layer onto the reference grid and return them as one dataset."""
    ref = rioxarray.open_rasterio(reference, masked=True).squeeze("band", drop=True)

    layers = {}
    for name, path in paths.items():
        da = rioxarray.open_rasterio(path, masked=True).squeeze("band", drop=True)
        layers[name] = da.rio.reproject_match(ref)

    ds = xr.Dataset(layers)
    ds.rio.write_crs(ref.rio.crs, inplace=True)
    log.info("stacked %d layers at %s", len(layers), dict(ds.sizes))
    return ds


def assert_aligned(ds: xr.Dataset) -> None:
    """Fail loudly rather than train on a silently misaligned stack."""
    shapes = {n: ds[n].shape for n in ds.data_vars}
    if len(set(shapes.values())) > 1:
        raise ValueError(f"layers have different shapes: {shapes}")
    transforms = {n: ds[n].rio.transform() for n in ds.data_vars}
    reference = next(iter(transforms.values()))
    mismatched = {n: t for n, t in transforms.items() if t != reference}
    if mismatched:
        raise ValueError(f"layers have different transforms: {list(mismatched)}")
