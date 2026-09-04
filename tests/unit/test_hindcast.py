"""A hindcast answers one question: would this have warned anyone in time?"""

from datetime import date

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
from shapely.geometry import LineString, Point

from models.hindcast import TIER_ORDER, Hindcast, _antecedent, _segment_points, replay


def _timeline(tiers_by_day, segment="3.0"):
    days = pd.date_range("2016-07-01", periods=len(tiers_by_day), freq="D")
    return pd.DataFrame({
        "day": days, "segment": segment, "tier": tiers_by_day,
        "tier_rank": [TIER_ORDER[t] for t in tiers_by_day],
    })


def test_lead_time_measured_to_the_first_crossing():
    tiers = ["green"] * 5 + ["orange"] * 3 + ["green"] * 2 + ["red"]
    hc = Hindcast(date(2016, 7, 11), _timeline(tiers), "3.0", [])
    assert hc.lead_time_days("orange") == 5
    assert hc.first_reaching("orange").date() == date(2016, 7, 6)


def test_a_worse_tier_counts_as_reaching_a_lower_one():
    """A red day satisfies 'reached orange'; otherwise a jump straight to red
    would report that orange never fired."""
    hc = Hindcast(date(2016, 7, 5), _timeline(["green"] * 3 + ["red", "red"]), "3.0", [])
    assert hc.lead_time_days("orange") == 1
    assert hc.lead_time_days("yellow") == 1


def test_alerts_after_the_failure_do_not_count():
    """Warning someone the day after is not a warning."""
    tiers = ["green"] * 4 + ["red"] * 3
    hc = Hindcast(date(2016, 7, 3), _timeline(tiers), "3.0", [])
    assert hc.first_reaching("red") is None
    assert hc.lead_time_days("red") is None


def test_no_alert_returns_none_not_zero():
    hc = Hindcast(date(2016, 7, 5), _timeline(["green"] * 6), "3.0", [])
    assert hc.lead_time_days("red") is None


def test_rainfall_is_sampled_at_segment_midpoints():
    segments = gpd.GeoDataFrame(
        {"chainage_km": [0.0, 1.0], "hazard_raw": [0.5, 0.6]},
        geometry=[LineString([(0, 0), (1000, 0)]), LineString([(1000, 0), (2000, 0)])],
        crs="EPSG:32645",
    )
    points = _segment_points(segments)
    assert list(points.geometry.x) == [500.0, 1500.0]
    assert list(points["segment"]) == ["0.0", "1.0"]


def test_antecedent_uses_only_past_days():
    """A 7-day sum on day 3 would peek forward; those rows must be dropped."""
    daily = pd.DataFrame({
        "pid": "a",
        "day": pd.date_range("2016-07-01", periods=40, freq="D"),
        "precip_mm": np.arange(40, dtype=float),
    })
    out = _antecedent(daily)
    assert len(out) == 40 - 29, "first 29 days cannot have a 30-day sum"
    assert out["day"].min() == pd.Timestamp("2016-07-30")
    row = out[out["day"] == pd.Timestamp("2016-07-30")].iloc[0]
    assert row["rain_1d"] == 29.0
    assert row["rain_3d"] == 27.0 + 28.0 + 29.0


def test_replay_refuses_tiers_derived_from_the_replay_window():
    """Calibrating on the window makes 'red' mean 'worst 1% of these few weeks',
    which some day is guaranteed to hit whether or not anything happened."""
    segments = gpd.GeoDataFrame(
        {"chainage_km": [0.0], "hazard_raw": [0.9]},
        geometry=[LineString([(0, 0), (1000, 0)])], crs="EPSG:32645",
    )
    point = gpd.GeoSeries([Point(500, 0)], crs="EPSG:32645")
    with pytest.raises(ValueError, match="self-fulfilling"):
        replay(date(2016, 7, 21), point, segments, trigger_model=None, tiers=None)


def test_replay_requires_hazard():
    segments = gpd.GeoDataFrame(
        {"chainage_km": [0.0]}, geometry=[LineString([(0, 0), (1000, 0)])], crs="EPSG:32645"
    )
    point = gpd.GeoSeries([Point(500, 0)], crs="EPSG:32645")
    with pytest.raises(ValueError, match="hazard_raw"):
        replay(date(2016, 7, 21), point, segments, trigger_model=None, tiers=[(0.5, "red")])


def test_tier_order_is_monotonic():
    assert TIER_ORDER == {"green": 0, "yellow": 1, "orange": 2, "red": 3}
