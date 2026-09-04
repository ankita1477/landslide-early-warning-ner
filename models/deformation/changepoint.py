"""Layer 3 — creep state from an InSAR displacement time series.

The output is a *modifier*, never a prediction. A slope creeping steadily in dry
weather with weak susceptibility is watched, not alerted; the same creep under
heavy rain on a weak slope is what turns an orange into a red.

Two rules keep this honest:

* Deformation is only read where the radar actually sees the ground. Himalayan
  slopes are vegetated and steep, so coherence collapses over much of the
  corridor. Incoherent pixels report `unknown` with a modifier of 1.0 — they
  never borrow a neighbour's value.
* A change point is not by itself acceleration. The velocity after the break has
  to be both significant against the earlier noise and materially larger than
  the earlier velocity, or a quiet slope with one noisy epoch gets promoted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

COHERENCE_MIN = 0.30
MIN_EPOCHS = 8

# Must match models.fusion.risk.DEFORMATION_MODIFIER.
MODIFIER = {"stable": 1.00, "slow": 1.15, "accelerating": 1.35, "critical": 1.50,
            "unknown": 1.00}

COVERAGE = {"full": "full", "partial": "partial", "none": "none"}


@dataclass
class CreepState:
    state: str
    modifier: float
    coverage: str
    velocity_mm_yr: float | None = None
    changepoint: pd.Timestamp | None = None
    n_epochs: int = 0
    coherence: float | None = None

    def as_dict(self) -> dict:
        return {
            "creep_state": self.state, "deform_modifier": self.modifier,
            "insar_coverage": self.coverage, "los_velocity_mm_yr": self.velocity_mm_yr,
            "last_changepoint": None if self.changepoint is None else self.changepoint.date(),
            "n_epochs": self.n_epochs, "coherence": self.coherence,
        }


def _unknown(reason: str, coherence: float | None = None, n: int = 0) -> CreepState:
    log.debug("creep unknown: %s", reason)
    return CreepState("unknown", MODIFIER["unknown"], "none", n_epochs=n, coherence=coherence)


def linear_velocity(dates: pd.Series, displacement_mm: np.ndarray) -> float:
    """Least-squares LOS velocity in mm/yr."""
    days = (pd.to_datetime(dates) - pd.to_datetime(dates).min()).dt.days.to_numpy(float)
    if len(days) < 2 or np.ptp(days) == 0:
        return 0.0
    slope, _ = np.polyfit(days, displacement_mm, 1)
    return float(slope * 365.25)


def detect_creep(
    dates: pd.Series, displacement_mm: np.ndarray, coherence: float | None = None,
    penalty: float = 10.0, min_size: int = 3,
    acceleration_factor: float = 2.0, noise_sigmas: float = 3.0,
) -> CreepState:
    """Classify a slope's creep state from its displacement history."""
    if coherence is not None and coherence < COHERENCE_MIN:
        return _unknown(f"coherence {coherence:.2f} below {COHERENCE_MIN}", coherence)

    displacement_mm = np.asarray(displacement_mm, dtype=float)
    finite = np.isfinite(displacement_mm)
    if finite.sum() < MIN_EPOCHS:
        return _unknown(f"only {int(finite.sum())} finite epochs", coherence, int(finite.sum()))

    dates = pd.to_datetime(pd.Series(dates)[finite]).reset_index(drop=True)
    displacement_mm = displacement_mm[finite]
    n = len(displacement_mm)
    velocity_mm_yr = linear_velocity(dates, displacement_mm)

    import ruptures as rpt

    days = (dates - dates.min()).dt.days.to_numpy(float)
    velocity = np.gradient(displacement_mm, np.where(np.diff(days, prepend=days[0]) == 0, 1, days))

    try:
        breaks = rpt.Pelt(model="rbf", min_size=min_size, jump=1).fit(velocity).predict(pen=penalty)
    except Exception as error:  # ruptures raises on degenerate input
        log.warning("change-point detection failed: %s", error)
        breaks = [n]

    coverage = "full" if coherence is None or coherence >= 0.5 else "partial"
    if len(breaks) < 2:
        return CreepState("stable", MODIFIER["stable"], coverage, velocity_mm_yr,
                          None, n, coherence)

    last = breaks[-2]
    before, after = velocity[:last], velocity[last:]
    if len(before) < 2 or len(after) < 1:
        return CreepState("stable", MODIFIER["stable"], coverage, velocity_mm_yr,
                          None, n, coherence)

    noise = float(np.std(before))
    # A break is only meaningful if the new rate stands clear of prior scatter.
    if noise > 0 and abs(after.mean()) < noise_sigmas * noise:
        return CreepState("stable", MODIFIER["stable"], coverage, velocity_mm_yr,
                          None, n, coherence)

    changepoint = dates.iloc[min(last, n - 1)]
    if abs(after.mean()) > acceleration_factor * max(abs(before.mean()), 1e-9):
        return CreepState("accelerating", MODIFIER["accelerating"], coverage,
                          velocity_mm_yr, changepoint, n, coherence)
    return CreepState("slow", MODIFIER["slow"], coverage, velocity_mm_yr,
                      changepoint, n, coherence)


def creep_for_segments(
    timeseries: pd.DataFrame, id_field: str = "segment", **kwargs
) -> pd.DataFrame:
    """Creep state per segment from long-format (segment, date, displacement) rows."""
    rows = []
    for identifier, group in timeseries.groupby(id_field):
        group = group.sort_values("date")
        coherence = float(group["coherence"].mean()) if "coherence" in group else None
        state = detect_creep(group["date"], group["displacement_mm"].to_numpy(),
                             coherence=coherence, **kwargs)
        rows.append({id_field: identifier, **state.as_dict()})

    out = pd.DataFrame(rows)
    if len(out):
        counts = out["creep_state"].value_counts().to_dict()
        observed = (out["insar_coverage"] != "none").mean()
        log.info("creep states %s; %.0f%% of units observable", counts, observed * 100)
    return out
