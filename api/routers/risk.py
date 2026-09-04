"""Risk endpoints — the queries the dashboard and citizen app actually make."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.risk import (
    Components,
    PointRisk,
    SegmentDetail,
    SegmentList,
    SegmentSummary,
    TierThreshold,
)
from api.store import TIER_ORDER, RiskStore, get_store

router = APIRouter(prefix="/risk", tags=["risk"])

# Annotated rather than a Depends() default: the default form is FastAPI's own
# idiom but trips B008, and this reads the same at the call site.
Store = Annotated[RiskStore, Depends(get_store)]


def _summary(row) -> SegmentSummary:
    return SegmentSummary(
        id=row["id"], highway_code=row["highway_code"],
        chainage_km=float(row["chainage_km"]),
        risk=float(row["risk"]), tier=row["tier"],
    )


def _detail(row) -> SegmentDetail:
    return SegmentDetail(
        **_summary(row).model_dump(),
        computed_at=row["computed_at"], horizon_h=int(row["horizon_h"]),
        hazard=float(row["hazard"]), length_m=float(row["length_m"]),
        runout_reach_m=None if row.get("reach_m") is None else float(row["reach_m"]),
        components=Components(
            susceptibility=float(row["susceptibility"]),
            trigger_probability=float(row["trigger_prob"]),
            deformation_modifier=float(row["deform_mod"]),
            exposure=float(row["exposure"]),
        ),
    )


@router.get("/segments", response_model=SegmentList)
def list_segments(
    store: Store,
    highway: str | None = Query(None, description="e.g. NH-10"),
    tier: str | None = Query(None, description="comma-separated: orange,red"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> SegmentList:
    tiers = None
    if tier:
        tiers = {t.strip().lower() for t in tier.split(",") if t.strip()}
        unknown = tiers - set(TIER_ORDER)
        if unknown:
            raise HTTPException(422, f"unknown tier(s): {sorted(unknown)}")

    rows = store.list_segments(highway=highway, tiers=tiers, limit=limit, offset=offset)
    return SegmentList(
        count=len(rows), segments=[_summary(r) for _, r in rows.iterrows()]
    )


@router.get("/watchlist", response_model=SegmentList)
def watchlist(
    store: Store, limit: int = Query(50, ge=1, le=500)
) -> SegmentList:
    rows = store.watchlist(limit)
    return SegmentList(
        count=len(rows), segments=[_summary(r) for _, r in rows.iterrows()]
    )


@router.get("/point", response_model=PointRisk)
def risk_at_point(
    store: Store,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> PointRisk:
    row, distance = store.nearest(lat, lon)
    return PointRisk(
        lat=lat, lon=lon, distance_to_segment_m=round(distance, 1),
        segment=_summary(row),
    )


@router.get("/tiers", response_model=list[TierThreshold])
def tier_thresholds(store: Store) -> list[TierThreshold]:
    """Cut-points are calibrated per corridor, so clients must not hard-code them."""
    return [
        TierThreshold(tier=name, threshold=threshold)
        for threshold, name in store.thresholds
        if threshold != float("-inf")
    ]


# Registered last: a literal path must not be shadowed by the {segment_id} route.
@router.get("/segments/{segment_id}", response_model=SegmentDetail)
def get_segment(segment_id: str, store: Store) -> SegmentDetail:
    row = store.get_segment(segment_id)
    if row is None:
        raise HTTPException(404, f"no segment with id {segment_id!r}")
    return _detail(row)
