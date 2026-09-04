"""The ID threshold is the physical sanity check on the learned model."""

import numpy as np
import pandas as pd
import pytest

from models.trigger.thresholds import (
    exceeds_threshold,
    fit_threshold,
    guzzetti_threshold,
    storm_before,
    storm_before_subdaily,
    storm_table,
)


def _window(pid, occurred, daily_mm):
    return pd.DataFrame({
        "event_pid": pid,
        "occurred_on": occurred,
        "lag_days": range(len(daily_mm)),
        "precip_mm": daily_mm,
    })


def test_storm_stops_at_the_first_dry_day():
    """Otherwise a trace of drizzle weeks earlier lengthens the storm."""
    duration, intensity = storm_before(_window("0", "2015-07-04", [20.0, 10.0, 0.0, 30.0]))
    assert duration == 48.0
    assert intensity == pytest.approx(30.0 / 48.0)


def test_dry_event_day_yields_no_storm():
    duration, intensity = storm_before(_window("0", "2015-07-04", [0.0, 50.0]))
    assert np.isnan(duration) and np.isnan(intensity)


def test_threshold_curve_falls_with_duration():
    """Longer storms trigger at lower intensity; that is the whole point."""
    assert guzzetti_threshold(24, 2.2, 0.44) > guzzetti_threshold(72, 2.2, 0.44)


def test_exceedance_is_relative_to_the_curve():
    alpha, beta = 2.2, 0.44
    critical = guzzetti_threshold(48, alpha, beta)
    assert exceeds_threshold(48, critical * 1.1, alpha, beta)
    assert not exceeds_threshold(48, critical * 0.9, alpha, beta)


def test_fit_recovers_known_parameters():
    alpha, beta = 3.0, 0.5
    durations = np.geomspace(2, 200, 60)
    rng = np.random.default_rng(0)
    intensities = guzzetti_threshold(durations, alpha, beta) * np.exp(rng.normal(0, 0.15, 60))
    storms = pd.DataFrame({"duration_h": durations, "intensity_mm_h": intensities})

    fitted_alpha, fitted_beta = fit_threshold(storms, quantile=0.5)
    assert fitted_beta == pytest.approx(beta, abs=0.08)
    assert fitted_alpha == pytest.approx(alpha, rel=0.25)


def test_envelope_sits_below_most_events():
    """A threshold is a lower bound, not a line through the middle."""
    rng = np.random.default_rng(1)
    durations = np.geomspace(2, 200, 200)
    intensities = guzzetti_threshold(durations, 3.0, 0.5) * np.exp(rng.normal(0, 0.3, 200))
    storms = pd.DataFrame({"duration_h": durations, "intensity_mm_h": intensities})

    alpha, beta = fit_threshold(storms, quantile=0.05)
    above = exceeds_threshold(durations, intensities, alpha, beta)
    assert above.mean() > 0.9


def test_too_few_storms_refuses_to_fit():
    storms = pd.DataFrame({"duration_h": [24.0, 48.0], "intensity_mm_h": [1.0, 0.8]})
    with pytest.raises(ValueError, match="too few"):
        fit_threshold(storms)


def _subdaily(rates, start="2015-07-01 00:00"):
    ts = pd.date_range(start, periods=len(rates), freq="30min")
    return pd.DataFrame({"ts": ts, "rate_mm_h": rates})


def test_subdaily_storm_tolerates_a_short_lull():
    """A storm that pauses for two hours is still one storm."""
    rates = [5.0] * 4 + [0.0] * 4 + [5.0] * 4  # 2h wet, 2h dry, 2h wet
    frame = _subdaily(rates)
    duration, _ = storm_before_subdaily(frame, frame["ts"].iloc[-1], max_gap_h=6.0)
    assert duration == pytest.approx(6.0)


def test_subdaily_storm_ends_at_a_long_gap():
    rates = [5.0] * 4 + [0.0] * 20 + [5.0] * 4  # 10h dry gap
    frame = _subdaily(rates)
    duration, _ = storm_before_subdaily(frame, frame["ts"].iloc[-1], max_gap_h=6.0)
    assert duration == pytest.approx(2.0)


def test_subdaily_resolves_shorter_durations_than_daily():
    """Daily data cannot express a 90-minute storm; this is why IMERG is used."""
    frame = _subdaily([8.0] * 3)
    duration, intensity = storm_before_subdaily(frame, frame["ts"].iloc[-1])
    assert duration == pytest.approx(1.5), "three 30-minute steps cover 1.5 hours"
    assert intensity == pytest.approx(8.0, rel=0.01), "mean intensity is the true rate"


def test_storm_table_one_row_per_event():
    windows = pd.concat([
        _window("0", "2015-07-04", [20.0, 10.0]),
        _window("1", "2016-08-01", [30.0, 0.0]),
    ], ignore_index=True)
    assert len(storm_table(windows)) == 2


def test_refuses_a_backwards_threshold():
    """beta <= 0 says longer storms need more intensity, which inverts the physics.
    Returning it would give an authoritative-looking curve that is simply wrong."""
    from models.trigger.thresholds import UnphysicalThreshold

    durations = np.geomspace(1, 100, 40)
    rising = 0.1 * durations**0.4  # intensity increasing with duration
    storms = pd.DataFrame({"duration_h": durations, "intensity_mm_h": rising})

    with pytest.raises(UnphysicalThreshold, match="beta"):
        fit_threshold(storms)
