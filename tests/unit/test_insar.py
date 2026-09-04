"""InSAR feeds a risk multiplier, so an unobserved slope must never look measured."""

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
from rasterio.transform import from_origin
from shapely.geometry import LineString

from ingestion.clients.insar import (
    COHERENCE_MIN,
    MM_PER_RADIAN,
    WAVELENGTH_MM,
    Frame,
    reference_epochs,
)
from processing.insar.aggregate import segment_series


def test_frame_encodes_its_track():
    frame = Frame("048D_06252_131313")
    assert frame.track == 48
    url = frame.url("20250309", "20250321", "unw")
    assert url.endswith("20250309_20250321.geo.unw.tif")
    assert "/48/048D_06252_131313/" in url


def test_phase_to_millimetres_uses_half_the_wavelength():
    """Radar range change is two-way: one fringe is half a wavelength of motion."""
    assert MM_PER_RADIAN == pytest.approx(WAVELENGTH_MM / (4 * np.pi))
    assert 2 * np.pi * MM_PER_RADIAN == pytest.approx(WAVELENGTH_MM / 2)


def test_coherence_threshold_matches_the_detector():
    from models.deformation.changepoint import COHERENCE_MIN as detector_threshold

    assert COHERENCE_MIN == detector_threshold


def test_referencing_removes_a_common_shift():
    """Water vapour moves a whole scene at once; that is not ground motion."""
    truth = np.zeros((4, 10, 10), dtype="float32")
    truth[:, 5, 5] = [0, 2, 4, 6]  # one pixel genuinely moving
    atmosphere = np.array([0.0, 30.0, -20.0, 45.0])[:, None, None]

    referenced = reference_epochs(truth + atmosphere)
    assert referenced[:, 5, 5] == pytest.approx([0, 2, 4, 6], abs=0.2)
    assert abs(referenced[:, 0, 0]).max() < 0.2


def test_referencing_ignores_nan_pixels():
    stack = np.full((3, 4, 4), np.nan, dtype="float32")
    stack[:, 0, 0] = [0.0, 10.0, 20.0]
    stack[:, 1, 1] = [0.0, 10.0, 20.0]
    referenced = reference_epochs(stack)
    assert np.isfinite(referenced[:, 0, 0]).all()


def _segments(n=3):
    return gpd.GeoDataFrame(
        {"chainage_km": [float(i) for i in range(n)]},
        geometry=[LineString([(88.5 + i * 0.01, 27.0), (88.5 + i * 0.01, 27.005)])
                  for i in range(n)],
        crs="EPSG:4326",
    )


def _stack(n_epochs=10, size=60, moving=None):
    stack = np.full((n_epochs, size, size), np.nan, dtype="float32")
    if moving is not None:
        rows, cols = moving
        stack[:, rows, cols] = np.arange(n_epochs, dtype="float32")[:, None, None]
    return stack


def test_segments_without_coherent_pixels_are_omitted():
    """Omitted becomes 'unknown' downstream. Filling them in would mark an
    unwatched slope as stable."""
    transform = from_origin(88.49, 27.02, 0.001, 0.001)
    stack = _stack()  # all NaN: nothing coherent anywhere
    out = segment_series(_segments(), stack, pd.date_range("2025-03-01", periods=10, freq="12D"),
                         transform, np.zeros((60, 60)))
    assert out.empty
    assert list(out.columns) == ["segment", "date", "displacement_mm", "coherence", "n_pixels"]


def test_only_pixels_surviving_the_whole_chain_are_used():
    transform = from_origin(88.49, 27.02, 0.001, 0.001)
    stack = _stack(moving=(slice(10, 30), slice(5, 25)))
    # a pixel coherent early but lost later must not contribute
    stack[-1, 12, 7] = np.nan
    dates = pd.date_range("2025-03-01", periods=10, freq="12D")
    out = segment_series(_segments(), stack, dates, transform, np.full((60, 60), 0.6))
    assert not out.empty
    assert (out["n_pixels"] > 0).all()


def test_series_has_one_row_per_epoch_per_segment():
    transform = from_origin(88.49, 27.02, 0.001, 0.001)
    stack = _stack(n_epochs=8, moving=(slice(0, 60), slice(0, 60)))
    dates = pd.date_range("2025-03-01", periods=8, freq="12D")
    out = segment_series(_segments(2), stack, dates, transform, np.full((60, 60), 0.7))
    assert len(out) == out["segment"].nunique() * 8
