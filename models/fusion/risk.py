"""Fuse the three layers into one risk score per road segment.

    HAZARD = susceptibility x trigger_probability x deformation_modifier
    RISK   = HAZARD x exposure

Two choices here matter more than the arithmetic:

* A segment is aggregated by a high **percentile** of the hazard around it, not
  a mean. A kilometre of road is only as safe as its worst slope, and averaging
  a single critical scar against 200 stable cells hides exactly the thing the
  system exists to find.
* Slopes are gathered by **runout reach**, not a fixed buffer. A failure 400 m
  upslope still reaches the carriageway; how far it travels scales with how far
  it falls.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import geometry_mask

log = logging.getLogger(__name__)

# Ordered high to low; the first threshold met wins.
TIERS: list[tuple[float, str]] = [
    (0.75, "red"), (0.50, "orange"), (0.25, "yellow"), (0.0, "green")
]

# Layer 3 creep state -> hazard amplifier. Deformation amplifies, never predicts
# alone: steady creep with no rain and weak susceptibility is watched, not alerted.
DEFORMATION_MODIFIER: dict[str, float] = {
    "stable": 1.00, "slow": 1.15, "accelerating": 1.35, "critical": 1.50,
    "unknown": 1.00,
}

DEFAULT_REACH_ANGLE_DEG = 30.0
DEFAULT_PERCENTILE = 90.0


@dataclass(frozen=True)
class RiskInput:
    susceptibility: float
    trigger_prob: float
    deform_modifier: float = 1.0
    exposure: float = 1.0


def tier_for(risk: float, tiers: list[tuple[float, str]] | None = None) -> str:
    return next(name for threshold, name in (tiers or TIERS) if risk >= threshold)


def calibrate_tiers(
    risk_history: pd.Series | np.ndarray,
    red: float = 0.01, orange: float = 0.05, yellow: float = 0.20,
) -> list[tuple[float, str]]:
    """Derive tier cut-points from this corridor's own risk distribution.

    The fixed 0.25/0.50/0.75 thresholds assume risk is a normalised hazard
    index. It is not: once the trigger model is calibrated to the true daily
    event rate, P_t peaks around 0.02, risk never exceeds ~0.03, and the system
    is permanently green — it would never raise an alert at all.

    So the tiers are set as frequencies instead: red on the worst `red`
    fraction of segment-days, orange on the next band, and so on. Those rates
    are an operational choice about how often officials are willing to be
    called out, and they are what the design means by calibrating thresholds
    per corridor against the historical inventory.
    """
    values = np.asarray(pd.Series(risk_history).dropna(), dtype=float)
    if values.size == 0:
        return list(TIERS)
    if not 0 < red < orange < yellow < 1:
        raise ValueError("rates must satisfy 0 < red < orange < yellow < 1")

    return [
        (float(np.quantile(values, 1 - red)), "red"),
        (float(np.quantile(values, 1 - orange)), "orange"),
        (float(np.quantile(values, 1 - yellow)), "yellow"),
        (float("-inf"), "green"),
    ]


def compute_risk(
    r: RiskInput, tiers: list[tuple[float, str]] | None = None
) -> dict[str, float | str]:
    hazard = r.susceptibility * r.trigger_prob * r.deform_modifier
    # D can push hazard above 1; clamp so the tier thresholds stay meaningful.
    risk = min(hazard * r.exposure, 1.0)
    return {"hazard": hazard, "risk": risk, "tier": tier_for(risk, tiers)}


def runout_distance(
    slope_height_m: float | np.ndarray,
    reach_angle_deg: float = DEFAULT_REACH_ANGLE_DEG,
):
    """Horizontal reach of a failure that starts `slope_height_m` above the target."""
    return slope_height_m / np.tan(np.deg2rad(reach_angle_deg))


def segment_hazard(
    segments: gpd.GeoDataFrame,
    susceptibility_path,
    dem_path,
    percentile: float = DEFAULT_PERCENTILE,
    reach_angle_deg: float = DEFAULT_REACH_ANGLE_DEG,
    max_reach_m: float = 2000.0,
) -> gpd.GeoDataFrame:
    """Susceptibility around each segment, summarised at a high percentile.

    The search distance per segment comes from the relief above it, so segments
    below tall slopes look further uphill than segments on gentle ground.
    """
    with rasterio.open(susceptibility_path) as src:
        susceptibility = src.read(1)
        transform, shape, crs = src.transform, src.shape, src.crs
    with rasterio.open(dem_path) as src:
        dem = src.read(1)
        dem = np.where(dem == src.nodata, np.nan, dem)

    if segments.crs != crs:
        segments = segments.to_crs(crs)

    rows = []
    for _, segment in segments.iterrows():
        # First pass at a nominal reach, to measure the relief that sets the real one.
        probe = segment.geometry.buffer(500.0)
        mask = ~geometry_mask([probe], out_shape=shape, transform=transform, invert=False)
        local_dem = dem[mask]
        local_dem = local_dem[np.isfinite(local_dem)]
        if local_dem.size == 0:
            rows.append({"hazard_raw": np.nan, "reach_m": np.nan, "n_cells": 0})
            continue

        relief = float(np.nanpercentile(local_dem, 95) - np.nanmin(local_dem))
        reach = float(np.clip(runout_distance(relief, reach_angle_deg), 100.0, max_reach_m))

        area = segment.geometry.buffer(reach)
        mask = ~geometry_mask([area], out_shape=shape, transform=transform, invert=False)
        values = susceptibility[mask]
        values = values[np.isfinite(values)]
        rows.append({
            "hazard_raw": float(np.percentile(values, percentile)) if values.size else np.nan,
            "reach_m": reach,
            "n_cells": int(values.size),
        })

    out = segments.copy().reset_index(drop=True)
    out = pd.concat([out, pd.DataFrame(rows)], axis=1)
    log.info(
        "hazard for %d segments at p%.0f, reach %.0f-%.0f m",
        len(out), percentile, np.nanmin(out["reach_m"]), np.nanmax(out["reach_m"]),
    )
    return gpd.GeoDataFrame(out, geometry="geometry", crs=segments.crs)


def normalise_exposure(segments: gpd.GeoDataFrame, column: str = "criticality") -> pd.Series:
    """Scale exposure to 0-1 across the corridor.

    Un-normalised exposure is the classic reason every segment comes out red.
    """
    if column not in segments.columns:
        return pd.Series(1.0, index=segments.index)
    values = segments[column].astype(float)
    span = values.max() - values.min()
    if span <= 0:
        return pd.Series(1.0, index=segments.index)
    return (values - values.min()) / span


def score_segments(
    segments: gpd.GeoDataFrame, trigger_prob: float | pd.Series,
    creep_state: str | pd.Series = "unknown", exposure: pd.Series | None = None,
    tiers: list[tuple[float, str]] | None = None,
) -> gpd.GeoDataFrame:
    """Apply the risk formula to segments that already carry `hazard_raw`."""
    if "hazard_raw" not in segments.columns:
        raise ValueError("run segment_hazard first; no 'hazard_raw' column")

    out = segments.copy()
    trigger = (
        trigger_prob if isinstance(trigger_prob, pd.Series)
        else pd.Series(float(trigger_prob), index=out.index)
    )
    states = (
        creep_state if isinstance(creep_state, pd.Series)
        else pd.Series(str(creep_state), index=out.index)
    )
    modifier = states.map(DEFORMATION_MODIFIER).fillna(1.0)
    exposure = normalise_exposure(out) if exposure is None else exposure

    scored = [
        compute_risk(RiskInput(s, t, d, e), tiers)
        for s, t, d, e in zip(
            out["hazard_raw"].fillna(0.0), trigger, modifier, exposure, strict=True
        )
    ]
    out["susceptibility"] = out["hazard_raw"]
    out["trigger_prob"] = trigger
    out["deform_mod"] = modifier
    out["exposure"] = exposure
    out["hazard"] = [s["hazard"] for s in scored]
    out["risk"] = [s["risk"] for s in scored]
    out["tier"] = [s["tier"] for s in scored]

    counts = out["tier"].value_counts().to_dict()
    log.info("tiers: %s", counts)
    return out
