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
    seg = seg.rename(columns={"criticality": "exposure"})
    exposure = normalise_exposure(seg)
    assert exposure.min() == 0.0 and exposure.max() == 1.0


def test_constant_exposure_does_not_collapse_to_zero():
    """A corridor where every segment is equally critical must not become risk-free."""
    seg = _segments([0.9] * 3, criticality=[5.0, 5.0, 5.0])
    seg = seg.rename(columns={"criticality": "exposure"})
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


def test_calibrated_tiers_come_from_the_corridor_distribution():
    """Fixed 0.25/0.50/0.75 thresholds assume risk is a normalised index. Once the
    trigger model is calibrated to the true daily event rate, risk never exceeds
    ~0.03 and the system is permanently green."""
    from models.fusion.risk import calibrate_tiers

    history = np.linspace(0.0, 0.03, 10_000)
    tiers = calibrate_tiers(history, red=0.01, orange=0.05, yellow=0.20)
    thresholds = [t for t, _ in tiers]

    assert thresholds == sorted(thresholds, reverse=True)
    assert thresholds[-1] == float("-inf"), "green must always be reachable"
    assert 0 < thresholds[0] < 0.03


def test_calibrated_tiers_fire_at_the_requested_rates():
    from models.fusion.risk import calibrate_tiers, tier_for

    rng = np.random.default_rng(0)
    history = rng.gamma(2.0, 0.005, 20_000)
    tiers = calibrate_tiers(history, red=0.01, orange=0.05, yellow=0.20)

    labels = pd.Series([tier_for(v, tiers) for v in history])
    assert labels.value_counts(normalize=True)["red"] == pytest.approx(0.01, abs=0.005)
    assert (labels == "green").mean() == pytest.approx(0.80, abs=0.02)


def test_calibration_rejects_incoherent_rates():
    from models.fusion.risk import calibrate_tiers

    with pytest.raises(ValueError, match="rates must satisfy"):
        calibrate_tiers(np.linspace(0, 1, 100), red=0.2, orange=0.1, yellow=0.3)


def test_empty_history_falls_back_to_the_default_tiers():
    from models.fusion.risk import TIERS, calibrate_tiers

    assert calibrate_tiers(pd.Series([], dtype=float)) == list(TIERS)


# ── Exposure ────────────────────────────────────────────────────────────

def _places(coords_people):
    from shapely.geometry import Point
    return gpd.GeoDataFrame(
        {"people": [p for _, p in coords_people]},
        geometry=[Point(*c) for c, _ in coords_people], crs="EPSG:32645",
    )


def _line_segments(n=3, spacing=4000):
    return gpd.GeoDataFrame(
        {"chainage_km": [float(i) for i in range(n)]},
        geometry=[
            LineString([(i * spacing, 0), (i * spacing + 1000, 0)]) for i in range(n)
        ],
        crs="EPSG:32645",
    )


def test_exposure_is_higher_where_more_people_are():
    from models.fusion.risk import compute_exposure

    segments = _line_segments(3)
    # A town beside segment 0, nothing near segment 2.
    people = _places([((500, 200), 20_000.0)])
    exposure = compute_exposure(segments, people)
    assert exposure.iloc[0] > exposure.iloc[2]


def test_exposure_never_reaches_zero():
    """NH-10 is the sole road into Sikkim: a blocked kilometre with nobody beside
    it still cuts the state off."""
    from models.fusion.risk import compute_exposure

    exposure = compute_exposure(_line_segments(2), _places([((500_000, 0), 10.0)]))
    assert (exposure >= 0.15).all()
    assert (exposure <= 1.0).all()


def test_influence_decays_rather_than_stopping_at_a_boundary():
    """A hard cutoff put three quarters of the corridor on the floor. A village
    two kilometres along is still cut off when the road in front of it goes."""
    from models.fusion.risk import compute_exposure

    segments = _line_segments(4, spacing=2000)
    exposure = compute_exposure(segments, _places([((500, 0), 20_000.0)]))
    values = list(exposure)
    assert values == sorted(values, reverse=True), "influence must fall off smoothly"
    assert values[1] > 0.15, "the neighbouring segment is not unaffected"


def test_population_is_log_compressed():
    """A city fifty times a hamlet must not drive every other segment to zero."""
    from models.fusion.risk import compute_exposure

    segments = _line_segments(3, spacing=3000)
    exposure = compute_exposure(
        segments, _places([((500, 0), 100_000.0), ((3_500, 0), 2_000.0)])
    )
    # The hamlet holds 2% of the city's population. Linearly scaled it would sit
    # near the floor; log-compressed it stays a distinguishable middle value.
    assert 0.3 < exposure.iloc[1] < exposure.iloc[0]


def test_a_hospital_raises_a_segment_above_its_neighbour():
    """A cut-off hospital matters more than a cut-off empty slope."""
    from models.fusion.risk import compute_exposure

    segments = _line_segments(3, spacing=4000)
    villages = _places([((500, 0), 2_000.0), ((4_500, 0), 2_000.0)])
    hospital = _places([((4_520, 0), 5_000.0)])

    without = compute_exposure(segments, villages)
    with_hospital = compute_exposure(segments, villages, hospital)

    # Exposure is min-max scaled, so the effect shows as a change in ranking
    # rather than an absolute rise: the segment that gains the hospital stays at
    # the top and pushes its equally-populated neighbour down.
    assert without.iloc[0] == pytest.approx(without.iloc[1])
    assert with_hospital.iloc[1] > with_hospital.iloc[0]


def test_exposure_changes_the_ranking():
    """The point of the term: a weaker slope above many people can outrank a
    stronger slope above nobody."""
    from models.fusion.risk import compute_exposure, score_segments

    segments = _line_segments(2, spacing=6000)
    segments["hazard_raw"] = [0.95, 0.70]
    exposure = compute_exposure(segments, _places([((6_500, 0), 50_000.0)]))
    scored = score_segments(segments, trigger_prob=0.01, exposure=exposure)
    assert scored["risk"].iloc[1] > scored["risk"].iloc[0]
