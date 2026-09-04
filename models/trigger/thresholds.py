"""Intensity-duration rainfall threshold — the interpretable physical baseline.

A Guzzetti-style power law, I = alpha * D^-beta, where I is mean rainfall
intensity (mm/h) over a storm of duration D (h). It is kept for two reasons:
it is the standard in the landslide literature and so is directly comparable to
published work, and it is a sanity check on the learned model. A statistical
model that fires far below the fitted curve has almost certainly latched onto a
seasonal correlate rather than onto rainfall.

alpha and beta are fitted to this corridor's own events, never taken from a
paper about a different mountain range.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)


class UnphysicalThreshold(ValueError):
    """Raised when the fitted curve inverts the physics it is meant to encode."""

# A day contributing less than this is treated as dry, so a storm is not
# artificially lengthened by a trace of drizzle weeks earlier.
WET_DAY_MM = 1.0
HOURS_PER_DAY = 24.0


def storm_before(daily: pd.DataFrame, max_days: int = 30) -> tuple[float, float]:
    """Duration (h) and mean intensity (mm/h) of the storm ending at the event.

    Walks back from the failure day while days stay wet. `daily` must carry
    `lag_days` (0 on the event day) and `precip_mm`.
    """
    series = daily.sort_values("lag_days")
    total = 0.0
    days = 0
    for _, row in series.iterrows():
        if row["lag_days"] >= max_days:
            break
        if float(row["precip_mm"]) < WET_DAY_MM:
            break
        total += float(row["precip_mm"])
        days += 1

    if days == 0:
        return np.nan, np.nan
    duration_h = days * HOURS_PER_DAY
    return duration_h, total / duration_h


def storm_table(windows: pd.DataFrame) -> pd.DataFrame:
    """One (duration, intensity) pair per event."""
    rows = []
    for pid, group in windows.groupby("event_pid"):
        duration_h, intensity = storm_before(group)
        rows.append({
            "event_pid": pid,
            "duration_h": duration_h,
            "intensity_mm_h": intensity,
            "occurred_on": group["occurred_on"].iloc[0],
        })
    table = pd.DataFrame(rows).dropna(subset=["duration_h", "intensity_mm_h"])
    log.info("storm table: %d of %d events had a wet run before failure",
             len(table), windows["event_pid"].nunique())
    return table


def fit_threshold(storms: pd.DataFrame, quantile: float = 0.05) -> tuple[float, float]:
    """Fit I = alpha * D^-beta to the lower envelope of the observed storms.

    The threshold is a lower bound, not a central tendency: it should sit under
    almost all failures, so it is fitted at a low quantile of log-intensity
    rather than by least squares through the middle of the cloud.
    """
    usable = storms[(storms["duration_h"] > 0) & (storms["intensity_mm_h"] > 0)]
    if len(usable) < 5:
        raise ValueError(f"only {len(usable)} usable storms; too few to fit a threshold")

    log_d = np.log(usable["duration_h"].to_numpy())
    log_i = np.log(usable["intensity_mm_h"].to_numpy())

    # Quantile regression by iterative reweighting would be overkill here; fit the
    # slope by least squares, then drop the intercept to the chosen quantile.
    slope, intercept = np.polyfit(log_d, log_i, 1)
    residuals = log_i - (slope * log_d + intercept)
    intercept += float(np.quantile(residuals, quantile))

    alpha = float(np.exp(intercept))
    beta = float(-slope)

    # A threshold with beta <= 0 says longer storms need *more* intensity, which
    # inverts the physics the curve encodes. It happens when the inventory is
    # news-derived: only large events during long monsoon spells get reported, so
    # duration and intensity correlate positively and no valid envelope exists.
    # Returning such a fit would give an authoritative-looking curve that is
    # backwards, so refuse instead.
    if beta <= 0:
        raise UnphysicalThreshold(
            f"fitted beta = {beta:.3f} (must be > 0): intensity rises with duration in "
            f"these {len(usable)} storms, so no intensity-duration threshold describes "
            "them. Usually reporting bias in the inventory."
        )

    log.info("fitted I = %.3f * D^-%.3f from %d storms (q%.0f envelope)",
             alpha, beta, len(usable), quantile * 100)
    return alpha, beta


def guzzetti_threshold(duration_h, alpha: float, beta: float):
    """Critical mean intensity (mm/h) for a storm of the given duration."""
    return alpha * np.power(duration_h, -beta)


def exceeds_threshold(duration_h, intensity_mm_h, alpha: float, beta: float):
    """Whether a storm sits above the critical curve."""
    return np.asarray(intensity_mm_h) >= guzzetti_threshold(duration_h, alpha, beta)


# A half-hourly step below this rate is treated as dry.
WET_RATE_MM_H = 0.1
# Storms pause. A short lull does not end one; a long dry spell does.
MAX_GAP_H = 6.0


def storm_before_subdaily(
    subdaily: pd.DataFrame, event_time: pd.Timestamp,
    max_gap_h: float = MAX_GAP_H, max_lookback_h: float = 168.0,
) -> tuple[float, float]:
    """Duration (h) and mean intensity (mm/h) of the storm ending at the event.

    Walks back through half-hourly steps, tolerating dry gaps shorter than
    `max_gap_h`, so a storm that pauses overnight is still one storm. This is
    what daily data cannot do: it cannot see the gap, so every wet day merges
    into a single flat block.
    """
    series = subdaily[subdaily["ts"] <= event_time].sort_values("ts", ascending=False)
    if series.empty:
        return np.nan, np.nan

    total_mm = 0.0
    gap_h = 0.0
    last_wet: pd.Timestamp | None = None
    first_wet: pd.Timestamp | None = None

    for _, row in series.iterrows():
        if (event_time - row["ts"]).total_seconds() / 3600.0 > max_lookback_h:
            break
        rate = float(row["rate_mm_h"]) if pd.notna(row["rate_mm_h"]) else 0.0
        if rate >= WET_RATE_MM_H:
            total_mm += rate * 0.5
            first_wet = row["ts"]
            if last_wet is None:
                last_wet = row["ts"]
            gap_h = 0.0
        else:
            gap_h += 0.5
            if last_wet is not None and gap_h > max_gap_h:
                break

    if first_wet is None or last_wet is None or total_mm <= 0:
        return np.nan, np.nan

    # Add one step: the span between the first and last wet timestamps excludes
    # the final step's own half hour, which inflates intensity by n/(n-1) — a
    # 50% error on a three-step storm.
    span_h = (last_wet - first_wet).total_seconds() / 3600.0
    duration_h = span_h + 0.5
    return duration_h, total_mm / duration_h
