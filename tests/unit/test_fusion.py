"""The fusion step decides what officials actually see."""

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
from shapely.geometry import LineString

from models.fusion.risk import (
    DEFORMATION_MODIFIER,
    RiskInput,
    compute_risk,
    normalise_exposure,
    runout_distance,
    score_segments,
    tier_for,
)


@pytest.mark.parametrize(
    "risk,expected",
    [(0.0, "green"), (0.24, "green"), (0.25, "yellow"), (0.49, "yellow"),
     (0.50, "orange"), (0.74, "orange"), (0.75, "red"), (1.0, "red")],
)
def test_tier_boundaries(risk, expected):
    assert tier_for(risk) == expected


def test_risk_is_clamped_to_one():
    """D goes to 1.5, so hazard can exceed 1 and would fall out of every tier."""
    out = compute_risk(RiskInput(1.0, 1.0, 1.5, 1.0))
    assert out["risk"] == 1.0
    assert out["hazard"] == pytest.approx(1.5)
    assert out["tier"] == "red"


def test_deformation_amplifies_but_never_predicts_alone():
    """Creep on a stable, dry slope must not raise an alert by itself."""
    creeping_but_calm = compute_risk(RiskInput(0.05, 0.02, 1.5, 1.0))
    assert creeping_but_calm["tier"] == "green"

    with_rain = compute_risk(RiskInput(0.8, 0.8, 1.5, 1.0))
    without = compute_risk(RiskInput(0.8, 0.8, 1.0, 1.0))
    assert with_rain["risk"] > without["risk"]


def test_modifier_table_is_ordered_and_starts_at_one():
    assert DEFORMATION_MODIFIER["stable"] == 1.0
    assert DEFORMATION_MODIFIER["unknown"] == 1.0, "unknown must not invent hazard"
    ordered = [DEFORMATION_MODIFIER[k] for k in ("stable", "slow", "accelerating", "critical")]
    assert ordered == sorted(ordered)
    assert max(ordered) <= 1.5


def test_runout_reaches_further_from_taller_slopes():
    assert runout_distance(400, 30) > runout_distance(100, 30)
    # 30 degrees of reach angle means horizontal travel of height / tan(30)
    assert runout_distance(100, 30) == pytest.approx(173.2, abs=0.5)


def test_shallower_reach_angle_travels_further():
    assert runout_distance(200, 20) > runout_distance(200, 40)


def _segments(hazard_values, criticality=None):
    geoms = [LineString([(i * 1000, 0), (i * 1000 + 1000, 0)]) for i in range(len(hazard_values))]
    data = {"hazard_raw": hazard_values}
    if criticality is not None:
        data["criticality"] = criticality
    return gpd.GeoDataFrame(data, geometry=geoms, crs="EPSG:32645")


def test_exposure_is_normalised_across_the_corridor():
    """Un-normalised exposure is the classic reason every segment comes out red."""
    seg = _segments([0.5] * 4, criticality=[10.0, 20.0, 30.0, 40.0])
    exposure = normalise_exposure(seg)
    assert exposure.min() == 0.0 and exposure.max() == 1.0


def test_constant_exposure_does_not_collapse_to_zero():
    """A corridor where every segment is equally critical must not become risk-free."""
    seg = _segments([0.9] * 3, criticality=[5.0, 5.0, 5.0])
    assert (normalise_exposure(seg) == 1.0).all()


def test_dry_conditions_produce_no_alerts():
    scored = score_segments(_segments([0.9, 0.8, 0.95]), trigger_prob=0.02)
    assert set(scored["tier"]) == {"green"}


def test_missing_hazard_is_treated_as_zero_not_nan():
    scored = score_segments(_segments([np.nan, 0.9]), trigger_prob=0.9)
    assert scored["risk"].notna().all()
    assert scored["tier"].iloc[0] == "green"


def test_per_segment_trigger_series_is_respected():
    scored = score_segments(
        _segments([0.9, 0.9]), trigger_prob=pd.Series([0.05, 0.95])
    )
    assert scored["risk"].iloc[1] > scored["risk"].iloc[0]


def test_requires_hazard_column():
    seg = gpd.GeoDataFrame(geometry=[LineString([(0, 0), (1, 1)])], crs="EPSG:32645")
    with pytest.raises(ValueError, match="segment_hazard first"):
        score_segments(seg, trigger_prob=0.5)
