"""Layer 2 outputs a probability that gets multiplied against absolute thresholds,
so it has to mean what it says."""

import numpy as np
import pandas as pd
import pytest

from models.trigger.model import (
    RAIN_FEATURES,
    TriggerReport,
    evaluate,
    fit,
    reliability,
    temporal_split,
    train_and_report,
)


def _frame(n=4000, seed=0, base_rate=0.01):
    """Rainfall features where heavier antecedent rain genuinely raises the odds."""
    rng = np.random.default_rng(seed)
    days = pd.date_range("2007-06-01", periods=n, freq="D")
    rain7 = rng.gamma(2.0, 40.0, n)
    logit = -6.0 + 0.012 * rain7
    event = rng.random(n) < (1 / (1 + np.exp(-logit)))
    frame = pd.DataFrame({
        "day": days, "event": event.astype(int),
        "rain_1d": rain7 / 7 + rng.normal(0, 2, n),
        "rain_3d": rain7 / 2 + rng.normal(0, 5, n),
        "rain_7d": rain7,
        "rain_15d": rain7 * 1.8 + rng.normal(0, 20, n),
        "rain_30d": rain7 * 3.1 + rng.normal(0, 40, n),
    })
    return frame


def test_split_is_temporal_not_random():
    """A random split puts one day of a storm in train and the next in test."""
    frame = _frame()
    train, test = temporal_split(frame, test_from_year=2014)
    assert pd.to_datetime(train["day"]).dt.year.max() < 2014
    assert pd.to_datetime(test["day"]).dt.year.min() >= 2014


def test_split_refuses_a_test_period_with_no_events():
    with pytest.raises(ValueError, match="no events"):
        temporal_split(_frame(), test_from_year=2099)


def test_calibrated_probabilities_match_the_true_base_rate():
    """Balanced class weights fit a balanced prior: raw outputs read ~0.5 when the
    real frequency is ~0.005, which would send every segment orange."""
    frame = _frame()
    train, test = temporal_split(frame, test_from_year=2014)

    calibrated, _ = evaluate(fit(train, calibrate=True), test, n_train=len(train))
    raw, _ = evaluate(fit(train, calibrate=False), test, n_train=len(train))

    assert calibrated.brier < raw.brier / 5
    assert calibrated.auc_roc > 0.7, "calibration must not destroy ranking"


def test_calibrated_probabilities_stay_near_the_observed_frequency():
    frame = _frame()
    train, test = temporal_split(frame, test_from_year=2014)
    _, probabilities = evaluate(fit(train), test, n_train=len(train))
    assert probabilities.mean() == pytest.approx(test["event"].mean(), abs=0.02)


def test_lift_is_reported_against_the_base_rate():
    """Under 1% positives, a bare AUC-PR is unreadable without the base rate."""
    report = TriggerReport(0.7, 0.10, 0.005, 0.004, 100, 50, 3)
    assert report.lift == pytest.approx(20.0)
    assert "lift" in str(report) and "base" in str(report)


def test_reliability_bins_are_ordered():
    rng = np.random.default_rng(1)
    probabilities = rng.random(2000)
    truth = (rng.random(2000) < probabilities).astype(int)
    table = reliability(truth, probabilities, n_bins=5)
    assert list(table["predicted"]) == sorted(table["predicted"])


def test_recovers_the_signal_it_was_given():
    result = train_and_report(_frame(), test_from_year=2014)
    assert result["report"].auc_roc > 0.7
    assert result["report"].lift > 2.0


def test_rain_features_are_the_documented_set():
    assert RAIN_FEATURES == ["rain_1d", "rain_3d", "rain_7d", "rain_15d", "rain_30d"]
