"""Phase 6 checkpoint: derivatives are correct and the stack is aligned."""

from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from processing.dem.derivatives import compute_derivatives

CELL = 30.0


@pytest.fixture(scope="module")
def ramp_derivatives(tmp_path_factory) -> dict[str, Path]:
    """A plane rising exactly one cell-width per cell: a true 45 degree slope."""
    d = tmp_path_factory.mktemp("ramp")
    rows, cols = 60, 60
    elev = (np.arange(cols, dtype="float32") * CELL)[None, :].repeat(rows, axis=0)

    dem = d / "ramp.tif"
    with rasterio.open(
        dem, "w", driver="GTiff", height=rows, width=cols, count=1, dtype="float32",
        crs="EPSG:32645", transform=from_origin(500_000, 3_000_000, CELL, CELL),
    ) as dst:
        dst.write(elev, 1)

    return compute_derivatives(dem, d / "out")


def test_slope_on_45_degree_ramp(ramp_derivatives):
    with rasterio.open(ramp_derivatives["slope"]) as s:
        slope = s.read(1)
    interior = slope[2:-2, 2:-2]  # edges use a truncated kernel
    assert np.allclose(interior, 45.0, atol=0.1), f"got {interior.mean():.3f} deg, want 45"


def test_aspect_encoding_is_a_unit_vector(ramp_derivatives):
    with rasterio.open(ramp_derivatives["aspect_sin"]) as s:
        sin = s.read(1)[2:-2, 2:-2]
    with rasterio.open(ramp_derivatives["aspect_cos"]) as s:
        cos = s.read(1)[2:-2, 2:-2]
    assert np.allclose(sin**2 + cos**2, 1.0, atol=1e-4)


def test_every_band_shares_one_grid(ramp_derivatives):
    """Misaligned bands stack without error and teach the model nonsense."""
    grids = {}
    for name, path in ramp_derivatives.items():
        with rasterio.open(path) as s:
            grids[name] = (s.shape, s.transform, s.crs)
    reference = next(iter(grids.values()))
    for name, g in grids.items():
        assert g == reference, f"{name} is on a different grid than the reference"


def test_twi_is_finite_on_flat_ground(tmp_path):
    """tan(0) divides to infinity; the slope clip must prevent that."""
    rows = cols = 40
    dem = tmp_path / "flat.tif"
    with rasterio.open(
        dem, "w", driver="GTiff", height=rows, width=cols, count=1, dtype="float32",
        crs="EPSG:32645", transform=from_origin(500_000, 3_000_000, CELL, CELL),
    ) as dst:
        dst.write(np.full((rows, cols), 100.0, dtype="float32"), 1)

    out = compute_derivatives(dem, tmp_path / "out")
    with rasterio.open(out["twi"]) as s:
        twi = s.read(1)
    assert np.isfinite(twi).all()
