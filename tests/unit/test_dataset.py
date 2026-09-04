"""Negative construction decides whether the susceptibility model is real."""

import geopandas as gpd
import numpy as np
import pytest
import rioxarray  # noqa: F401 — registers the .rio accessor
import xarray as xr
from shapely.geometry import Point

from models.susceptibility.dataset import build_dataset, sample_at, sample_negatives

CELL = 30.0
N = 200


@pytest.fixture
def stack():
    """Left half flat and low, right half steep and high."""
    x = 500_000 + np.arange(N) * CELL
    y = 3_000_000 - np.arange(N) * CELL
    slope = np.where(np.arange(N)[None, :] < N // 2, 2.0, 35.0)
    slope = np.repeat(slope, N, axis=0).astype("float32")
    elevation = np.where(np.arange(N)[None, :] < N // 2, 200.0, 2500.0)
    elevation = np.repeat(elevation, N, axis=0).astype("float32")

    ds = xr.Dataset(
        {
            "slope": (("y", "x"), slope),
            "elevation": (("y", "x"), elevation),
        },
        coords={"x": x, "y": y},
    )
    ds.rio.write_crs("EPSG:32645", inplace=True)
    return ds


@pytest.fixture
def events(stack):
    """Four events on the steep side."""
    xs = stack.x.to_numpy()[[120, 140, 160, 180]]
    ys = stack.y.to_numpy()[[50, 80, 110, 140]]
    return gpd.GeoDataFrame(
        geometry=[Point(x, y) for x, y in zip(xs, ys, strict=True)], crs="EPSG:32645"
    )


def test_negatives_are_never_on_flat_ground(stack, events):
    """A floodplain pixel is a free correct answer that inflates every metric."""
    neg = sample_negatives(events, stack, n=40, min_slope=10.0, match_elevation=False)
    assert (sample_at(stack, neg)["slope"] >= 10.0).all()


def test_negatives_keep_their_distance_from_events(stack, events):
    buffer_m = 500.0
    neg = sample_negatives(events, stack, n=40, buffer_m=buffer_m, match_elevation=False)
    nearest = neg.geometry.apply(lambda p: events.distance(p).min())
    assert (nearest >= buffer_m).all(), f"closest negative was {nearest.min():.0f} m away"


def test_elevation_matching_prevents_separation_on_altitude(stack, events):
    """Without matching, every negative could sit at 200 m and every event at 2500 m,
    and the model would 'work' by reading altitude alone."""
    neg = sample_negatives(events, stack, n=40, match_elevation=True)
    positive_elevation = sample_at(stack, events)["elevation"]
    negative_elevation = sample_at(stack, neg)["elevation"]
    assert negative_elevation.min() >= positive_elevation.min()
    assert negative_elevation.max() <= positive_elevation.max()


def test_impossible_constraints_raise_rather_than_return_too_few(stack, events):
    with pytest.raises(RuntimeError, match="only found"):
        sample_negatives(events, stack, n=50, min_slope=89.0, match_elevation=False)


def test_dataset_ratio_and_labels(stack, events):
    ds = build_dataset(events, stack, negative_ratio=2, match_elevation=False)
    assert int(ds["label"].sum()) == len(events)
    assert int((ds["label"] == 0).sum()) == len(events) * 2
    assert set(ds.columns) >= {"slope", "elevation", "label", "geometry"}


def test_dataset_carries_geometry_for_spatial_blocking(stack, events):
    """build_dataset feeds assign_blocks, which needs real projected geometry."""
    ds = build_dataset(events, stack, negative_ratio=1, match_elevation=False)
    assert ds.crs is not None and not ds.crs.is_geographic
    assert ds.geometry.notna().all()


def test_sampling_is_reproducible(stack, events):
    a = sample_negatives(events, stack, n=20, seed=7, match_elevation=False)
    b = sample_negatives(events, stack, n=20, seed=7, match_elevation=False)
    assert list(a.geometry.x) == list(b.geometry.x)
