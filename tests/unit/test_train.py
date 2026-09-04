"""Training must report the honest score and never quietly hide leakage."""

import geopandas as gpd
import numpy as np
import pytest
from shapely.geometry import Point

from models.susceptibility.train import CVResult, feature_columns, train_and_evaluate


def _dataset(n=400, seed=0, informative=True):
    """Points across a 60 km area whose label depends on a 'slope' feature."""
    rng = np.random.default_rng(seed)
    xy = rng.uniform(500_000, 560_000, size=(n, 2))
    slope = rng.uniform(0, 60, n)
    noise = rng.normal(size=n)
    label = ((slope > 30) if informative else (rng.random(n) > 0.5)).astype(int)
    return gpd.GeoDataFrame(
        {"slope": slope, "noise": noise, "label": label},
        geometry=[Point(*p) for p in xy], crs="EPSG:32645",
    )


def test_feature_columns_excludes_label_and_geometry():
    assert set(feature_columns(_dataset())) == {"slope", "noise"}


def test_reports_both_blocked_and_random_scores():
    result = train_and_evaluate(_dataset(), block_size_m=8000)
    assert isinstance(result["blocked"], CVResult)
    assert isinstance(result["random"], CVResult)
    assert result["n_blocks"] > 5


def test_recovers_a_real_signal():
    result = train_and_evaluate(_dataset(informative=True), block_size_m=8000)
    assert result["blocked"].auc_roc > 0.9


def test_reports_chance_on_noise():
    """A model with nothing to learn must not score well under blocking."""
    result = train_and_evaluate(_dataset(informative=False, seed=3), block_size_m=8000)
    assert result["blocked"].auc_roc < 0.65


def test_importance_covers_every_feature():
    result = train_and_evaluate(_dataset(), block_size_m=8000)
    assert set(result["importance"].index) == set(result["features"])
    assert result["importance"].iloc[0] >= result["importance"].iloc[-1]


def test_blocked_folds_are_reported_individually():
    """A good mean can hide one fold at chance; the spread has to be visible."""
    result = train_and_evaluate(_dataset(), block_size_m=8000)
    assert len(result["blocked"].fold_auc) == result["blocked"].n_folds > 1


def test_cvresult_string_shows_both_metrics():
    text = str(CVResult(auc_roc=0.866, auc_pr=0.752, fold_auc=[0.8, 0.9], n_folds=2))
    assert "0.866" in text and "0.752" in text and "0.800-0.900" in text


def test_too_few_blocks_is_rejected():
    small = _dataset(n=60)
    with pytest.raises(ValueError, match="blocks cannot make"):
        train_and_evaluate(small, block_size_m=500_000, n_splits=5)
