"""Replay a past event through the whole pipeline.

The point is not to score the model again — it is to answer the only question
an official actually asks: *would this system have told me in time?*

So the replay runs forward day by day using only rainfall that had already
fallen, scores every segment, and records when each one first crossed a tier.
Lead time is measured against the documented failure date. A correct warning
issued twenty minutes ahead is worthless, so the distribution of lead times
matters more than whether an alert fired at all.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

import geopandas as gpd
import numpy as np
import pandas as pd

from ingestion.clients.rainfall import daily_at_points
from models.fusion.risk import DEFORMATION_MODIFIER, tier_for
from models.trigger.model import RAIN_FEATURES

log = logging.getLogger(__name__)

TIER_ORDER = {"green": 0, "yellow": 1, "orange": 2, "red": 3}
LOOKBACK_DAYS = 30


@dataclass
class Hindcast:
    event_date: date
    timeline: pd.DataFrame          # one row per segment-day
    nearest_segment: str
    tiers: list[tuple[float, str]]

    def first_reaching(self, tier: str, segment: str | None = None) -> pd.Timestamp | None:
        """The first day a segment reached `tier` or worse, before the failure."""
        rows = self.timeline
        if segment is not None:
            rows = rows[rows["segment"] == segment]
        threshold = TIER_ORDER[tier]
        hit = rows[
            (rows["tier_rank"] >= threshold) & (rows["day"] <= pd.Timestamp(self.event_date))
        ]
        return hit["day"].min() if len(hit) else None

    def lead_time_days(self, tier: str = "orange", segment: str | None = None) -> float | None:
        first = self.first_reaching(tier, segment if segment else self.nearest_segment)
        if first is None:
            return None
        return (pd.Timestamp(self.event_date) - first).days


def _segment_points(segments: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Rainfall is sampled at each segment's midpoint."""
    points = segments.copy()
    points["segment"] = points.get(
        "chainage_km", pd.Series(range(len(points)))
    ).astype(str)
    points["geometry"] = points.geometry.interpolate(0.5, normalized=True)
    return points


def _antecedent(daily: pd.DataFrame) -> pd.DataFrame:
    """Rolling rainfall sums per segment, using only days already past."""
    out = []
    for pid, group in daily.groupby("pid"):
        group = group.sort_values("day").set_index("day")
        rain = group["precip_mm"].astype(float)
        frame = pd.DataFrame(
            {f"rain_{n}d": rain.rolling(n, min_periods=n).sum() for n in (1, 3, 7, 15, 30)}
        )
        frame["pid"] = pid
        out.append(frame.reset_index())
    return pd.concat(out, ignore_index=True).dropna(subset=RAIN_FEATURES)


def replay(
    event_date: date,
    event_point: gpd.GeoSeries,
    segments: gpd.GeoDataFrame,
    trigger_model,
    days_before: int = 21,
    days_after: int = 3,
    creep_state: str = "unknown",
    tiers: list[tuple[float, str]] | None = None,
    source: str = "chirps",
) -> Hindcast:
    """Score every segment on every day around a documented failure."""
    # Validate before the rainfall fetch: these are argument errors, and paying
    # for a multi-thousand-row Earth Engine query to discover one is wasteful.
    if "hazard_raw" not in segments.columns:
        raise ValueError("segments need 'hazard_raw'; run segment_hazard first")
    if tiers is None:
        # Calibrating on the replay window would be circular: "red" would mean
        # "worst 1% of these few weeks", which some day in the window is
        # guaranteed to hit whether or not anything unusual happened. Thresholds
        # must come from a period the replay is not being scored against.
        raise ValueError(
            "pass tiers calibrated on the historical record; deriving them from "
            "the replay window makes the alert self-fulfilling"
        )

    points = _segment_points(segments)
    start = event_date - timedelta(days=days_before + LOOKBACK_DAYS)
    end = event_date + timedelta(days=days_after)

    daily = daily_at_points(points, start.isoformat(), end.isoformat(),
                            source=source, id_field="segment")
    if daily.empty:
        raise RuntimeError("no rainfall returned for the replay window")

    features = _antecedent(daily)
    features["day"] = pd.to_datetime(features["day"])
    window_start = pd.Timestamp(event_date - timedelta(days=days_before))
    features = features[features["day"] >= window_start]

    probability = trigger_model.predict_proba(features[RAIN_FEATURES].to_numpy())[:, 1]
    features["trigger_prob"] = probability

    hazard = points.set_index("segment")["hazard_raw"].astype(float)
    features["susceptibility"] = features["pid"].map(hazard).fillna(0.0)
    features["deform_mod"] = DEFORMATION_MODIFIER.get(creep_state, 1.0)
    features["risk"] = np.minimum(
        features["susceptibility"] * features["trigger_prob"] * features["deform_mod"], 1.0
    )

    features["tier"] = [tier_for(v, tiers) for v in features["risk"]]
    features["tier_rank"] = features["tier"].map(TIER_ORDER)
    features = features.rename(columns={"pid": "segment"})

    # The segment the failure actually happened on.
    metric = points.to_crs(segments.crs)
    event_metric = event_point.to_crs(segments.crs)
    distances = metric.geometry.distance(event_metric.iloc[0])
    nearest = str(metric.loc[distances.idxmin(), "segment"])

    log.info(
        "replayed %d segment-days over %s..%s; failure segment %s",
        len(features), window_start.date(), end, nearest,
    )
    return Hindcast(
        event_date=event_date,
        timeline=features.sort_values(["day", "segment"]).reset_index(drop=True),
        nearest_segment=nearest,
        tiers=tiers,
    )
