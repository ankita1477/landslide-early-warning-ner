"""Response shapes for the risk endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Components(BaseModel):
    """The multiplicative terms behind the score, always shown alongside it.

    An official who cannot see why a segment is red has no basis to act on it,
    and the design makes explainability a requirement rather than a nicety.
    """

    susceptibility: float = Field(..., ge=0, le=1)
    trigger_probability: float = Field(..., ge=0, le=1)
    deformation_modifier: float = Field(..., ge=1.0, le=1.5)
    exposure: float = Field(..., ge=0, le=1)


class SegmentSummary(BaseModel):
    id: str
    highway_code: str
    chainage_km: float
    risk: float = Field(..., ge=0, le=1)
    tier: str


class SegmentDetail(SegmentSummary):
    computed_at: datetime
    horizon_h: int
    hazard: float
    length_m: float
    runout_reach_m: float | None = None
    components: Components


class SegmentList(BaseModel):
    count: int
    segments: list[SegmentSummary]


class PointRisk(BaseModel):
    lat: float
    lon: float
    distance_to_segment_m: float
    segment: SegmentSummary


class TierThreshold(BaseModel):
    tier: str
    threshold: float


class Health(BaseModel):
    status: str
    segments_loaded: int
    tiers_calibrated: bool
