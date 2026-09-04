"""Spatial blocking must actually prevent leakage, not just look like it does."""

import geopandas as gpd
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from scipy.ndimage import gaussian_filter
from shapely.geometry import Point
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import KFold

from models.susceptibility.spatial_cv import (
    assign_blocks,
    estimate_range_m,
    recommend_block_size,
    spatial_cv,
)

CELL = 30.0


def _autocorrelated_points(n=2500, extent_m=60_000, seed=0):
    """Points whose label comes from a smooth field — the real problem's structure."""
    rng = np.random.default_rng(seed)
    xy = rng.uniform(0, extent_m, size=(n, 2))

    grid = gaussian_filter(rng.normal(size=(200, 200)), sigma=9)
    ix = np.clip((xy[:, 0] / extent_m * 199).astype(int), 0, 199)
    iy = np.clip((xy[:, 1] / extent_m * 199).astype(int), 0, 199)
    latent = grid[iy, ix]
    y = (latent > np.median(latent)).astype(int)

    gdf = gpd.GeoDataFrame(
        {"y": y}, geometry=[Point(*p) for p in xy], crs="EPSG:32645"
    )
    # Coordinates as features: the model can memorise location if the split lets it.
    X = np.column_stack([xy, rng.normal(size=n)])
    return gdf, X, y


def _mean_auc(splits, X, y):
    scores = []
    for train, test in splits:
        if len(np.unique(y[train])) < 2 or len(np.unique(y[test])) < 2:
            continue
        m = RandomForestClassifier(n_estimators=40, random_state=0, n_jobs=1)
        m.fit(X[train], y[train])
        scores.append(roc_auc_score(y[test], m.predict_proba(X[test])[:, 1]))
    return float(np.mean(scores))


def test_random_split_leaks_and_blocking_stops_it():
    """The whole reason this module exists: the two numbers must differ."""
    gdf, X, y = _autocorrelated_points()
    groups = assign_blocks(gdf, block_size_m=8000)

    random_auc = _mean_auc(KFold(5, shuffle=True, random_state=0).split(X), X, y)
    blocked_auc = _mean_auc(spatial_cv(X, y, groups, n_splits=5), X, y)

    assert random_auc > 0.9, f"random split should look inflated, got {random_auc:.3f}"
    assert blocked_auc < random_auc - 0.1, (
        f"blocking changed nothing: random {random_auc:.3f} vs blocked {blocked_auc:.3f}"
    )


def test_no_block_spans_train_and_test():
    gdf, X, y = _autocorrelated_points()
    groups = assign_blocks(gdf, block_size_m=8000)
    for train, test in spatial_cv(X, y, groups, n_splits=5):
        assert not set(groups[train]) & set(groups[test])


def test_geographic_crs_is_rejected():
    """Dividing degrees by a metre block size silently produces one block."""
    gdf = gpd.GeoDataFrame(geometry=[Point(88.5, 27.0)], crs="EPSG:4326")
    with pytest.raises(ValueError, match="projected CRS"):
        assign_blocks(gdf)


def test_too_few_blocks_is_an_error_not_a_silent_bad_split():
    gdf, X, y = _autocorrelated_points(n=100, extent_m=6000)
    groups = assign_blocks(gdf, block_size_m=50_000)
    with pytest.raises(ValueError, match="blocks cannot make"):
        list(spatial_cv(X, y, groups, n_splits=5))


@pytest.fixture
def smooth_raster(tmp_path):
    """A field smoothed at a known length scale, so the fitted range is checkable."""
    rng = np.random.default_rng(1)
    sigma_px = 20
    field = gaussian_filter(rng.normal(size=(600, 600)), sigma=sigma_px).astype("float32")
    path = tmp_path / "smooth.tif"
    with rasterio.open(
        path, "w", driver="GTiff", height=600, width=600, count=1, dtype="float32",
        crs="EPSG:32645", transform=from_origin(500_000, 3_000_000, CELL, CELL),
    ) as dst:
        dst.write(field, 1)
    return path, sigma_px * CELL


def test_variogram_recovers_a_known_correlation_length(smooth_raster):
    path, sigma_m = smooth_raster
    fitted = estimate_range_m(path, max_lag_m=sigma_m * 6, n_samples=4000)
    assert sigma_m < fitted < sigma_m * 6, f"fitted {fitted:.0f} m against sigma {sigma_m:.0f} m"


def test_block_size_ignores_trend_dominated_layers(tmp_path, smooth_raster):
    """A monotonic ramp has no finite range; it must not drive the block size."""
    path, _ = smooth_raster
    ramp = (np.arange(600, dtype="float32")[None, :].repeat(600, 0)) * 10.0
    ramp_path = tmp_path / "ramp.tif"
    with rasterio.open(
        ramp_path, "w", driver="GTiff", height=600, width=600, count=1, dtype="float32",
        crs="EPSG:32645", transform=from_origin(500_000, 3_000_000, CELL, CELL),
    ) as dst:
        dst.write(ramp, 1)

    with_ramp = recommend_block_size([path, ramp_path])
    without = recommend_block_size([path])
    assert with_ramp == without, "the trend layer changed the answer; it should be excluded"
