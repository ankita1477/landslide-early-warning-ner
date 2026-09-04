"""Deformation amplifies risk, so a false 'accelerating' is expensive."""

import numpy as np
import pandas as pd
import pytest

from models.deformation.changepoint import (
    COHERENCE_MIN,
    MIN_EPOCHS,
    MODIFIER,
    creep_for_segments,
    detect_creep,
    linear_velocity,
)


def _series(n=40, start="2016-01-01", step_days=12):
    return pd.Series(pd.date_range(start, periods=n, freq=f"{step_days}D"))


def test_incoherent_pixels_report_unknown_not_stable():
    """'Stable' is a measurement. Over vegetation there is no measurement, and
    calling that stable would silently mark unobserved slopes as safe."""
    dates = _series()
    state = detect_creep(dates, np.zeros(len(dates)), coherence=COHERENCE_MIN - 0.01)
    assert state.state == "unknown"
    assert state.modifier == 1.0
    assert state.coverage == "none"


def test_a_steady_slope_is_stable():
    dates = _series()
    rng = np.random.default_rng(0)
    state = detect_creep(dates, rng.normal(0, 0.5, len(dates)), coherence=0.7)
    assert state.state == "stable"
    assert state.modifier == 1.0


def test_acceleration_is_detected():
    dates = _series(n=48)
    slow = np.arange(24) * 0.5
    fast = slow[-1] + np.arange(24) * 4.0
    state = detect_creep(dates, np.concatenate([slow, fast]), coherence=0.7)
    assert state.state in {"accelerating", "slow"}
    assert state.modifier > 1.0
    assert state.changepoint is not None


def test_one_noisy_epoch_does_not_promote_a_quiet_slope():
    """A single outlier must not turn a stable slope into an alert."""
    dates = _series(n=40)
    displacement = np.zeros(40)
    displacement[20] = 3.0
    state = detect_creep(dates, displacement, coherence=0.8)
    assert state.state == "stable"


def test_too_few_epochs_is_unknown():
    dates = _series(n=MIN_EPOCHS - 2)
    state = detect_creep(dates, np.arange(MIN_EPOCHS - 2, dtype=float), coherence=0.9)
    assert state.state == "unknown"


def test_gaps_do_not_count_as_epochs():
    """A chain broken by a missing link leaves NaNs; those are not observations."""
    dates = _series(n=30)
    displacement = np.full(30, np.nan)
    displacement[:5] = np.arange(5)
    state = detect_creep(dates, displacement, coherence=0.9)
    assert state.state == "unknown"
    assert state.n_epochs == 5


def test_velocity_is_reported_in_mm_per_year():
    dates = pd.Series(pd.date_range("2016-01-01", periods=2, freq="365D"))
    assert linear_velocity(dates, np.array([0.0, 10.0])) == pytest.approx(10.0, rel=0.01)


def test_velocity_sign_is_preserved():
    dates = _series(n=20)
    downhill = -np.arange(20) * 2.0
    assert linear_velocity(dates, downhill) < 0


def test_modifiers_match_the_fusion_table():
    """Two copies of this table drifting apart would silently change every score."""
    from models.fusion.risk import DEFORMATION_MODIFIER

    assert MODIFIER == DEFORMATION_MODIFIER


def test_modifier_never_reduces_risk():
    assert min(MODIFIER.values()) == 1.0


def test_per_segment_table_has_one_row_each():
    frame = pd.concat([
        pd.DataFrame({
            "segment": name,
            "date": _series(n=30),
            "displacement_mm": np.arange(30, dtype=float) * factor,
            "coherence": 0.7,
        })
        for name, factor in [("a", 0.1), ("b", 3.0)]
    ])
    out = creep_for_segments(frame)
    assert len(out) == 2
    assert set(out.columns) >= {"segment", "creep_state", "deform_modifier", "insar_coverage"}
