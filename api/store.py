"""File-backed store for the API.

The design targets PostGIS, which needs Docker. Nothing in the API actually
requires it: the pipeline already writes GeoParquet and COGs, and reading those
gives a working service today. Access goes through `RiskStore` so swapping in a
database later means writing one class, not rewriting the routers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

log = logging.getLogger(__name__)

DATA_DIR = Path("data/processed")
SEGMENT_RISK = DATA_DIR / "segment_risk.parquet"
TIER_THRESHOLDS = DATA_DIR / "tier_thresholds.parquet"

TIER_ORDER = {"green": 0, "yellow": 1, "orange": 2, "red": 3}


class StoreUnavailable(RuntimeError):
    """Raised when the pipeline outputs the API serves have not been produced."""


@dataclass
class RiskStore:
    segments: gpd.GeoDataFrame
    thresholds: list[tuple[float, str]]

    @classmethod
    def load(cls, path: Path = SEGMENT_RISK) -> RiskStore:
        if not path.exists():
            raise StoreUnavailable(
                f"{path} not found. Run the pipeline first: segment_hazard then "
                "score_segments, and write the result there."
            )
        segments = gpd.read_parquet(path)
        # Chainage alone is not unique: NH-10 km 0.0 and NH-717 km 0.0 collide.
        # The schema keys segments on (highway_code, chainage_km), so the id does too.
        segments["id"] = (
            segments["highway_code"].astype(str) + ":" + segments["chainage_km"].astype(str)
        )
        duplicates = segments["id"].duplicated()
        if duplicates.any():
            raise StoreUnavailable(
                f"{int(duplicates.sum())} duplicate segment ids in {path}; "
                "(highway_code, chainage_km) must be unique"
            )

        thresholds: list[tuple[float, str]] = []
        if TIER_THRESHOLDS.exists():
            frame = pd.read_parquet(TIER_THRESHOLDS)
            thresholds = list(zip(frame["threshold"], frame["tier"], strict=True))

        log.info("loaded %d segments from %s", len(segments), path)
        return cls(segments=segments, thresholds=thresholds)

    def list_segments(
        self, highway: str | None = None, tiers: set[str] | None = None,
        limit: int = 500, offset: int = 0,
    ) -> gpd.GeoDataFrame:
        rows = self.segments
        if highway:
            rows = rows[rows["highway_code"].str.upper() == highway.upper()]
        if tiers:
            rows = rows[rows["tier"].isin(tiers)]
        return rows.iloc[offset : offset + limit]

    def get_segment(self, segment_id: str) -> gpd.GeoSeries | None:
        match = self.segments[self.segments["id"] == segment_id]
        return match.iloc[0] if len(match) else None

    def watchlist(self, limit: int = 50) -> gpd.GeoDataFrame:
        """Ranked worst-first — the dashboard's landing query."""
        return self.segments.nlargest(limit, "risk")

    def nearest(self, lat: float, lon: float) -> tuple[gpd.GeoSeries, float]:
        """Nearest segment to a coordinate, with its distance in metres."""
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"coordinate out of range: lat={lat}, lon={lon}")
        point = (
            gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326")
            .to_crs(self.segments.crs).iloc[0]
        )
        distances = self.segments.geometry.distance(point)
        index = distances.idxmin()
        return self.segments.loc[index], float(distances.loc[index])


@lru_cache(maxsize=1)
def get_store() -> RiskStore:
    """Cached so each request does not re-read the parquet from disk."""
    return RiskStore.load()


def get_store_optional() -> RiskStore | None:
    """The store if it loads, otherwise None.

    Health has to go through the same dependency the routers use, or it reports
    on a different store than the one actually being served — and test overrides
    silently do not apply to it.
    """
    try:
        return get_store()
    except StoreUnavailable:
        return None
