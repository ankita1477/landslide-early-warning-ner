"""Daily rainfall at points, from Earth Engine.

Two sources, because they cost very different amounts to query:

* **CHIRPS** (default) — already daily, one image per day at ~5 km. A decade of
  history is a few thousand images.
* **IMERG V07** — half-hourly at ~11 km, so a day costs 48 images and a decade
  costs roughly 190,000. It is the better product for operational nowcasting
  where sub-daily intensity matters, and the wrong tool for a long backfill.

The imprecise landslide locations that make the inventory unusable for terrain
modelling are not a problem here: both products are coarser than the ~5 km
positional error, so the pixel is the same either way. What matters for a
trigger model is the event *date*, and the dates are reliable.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import geopandas as gpd
import pandas as pd

from ingestion.clients.earthengine import initialize

log = logging.getLogger(__name__)

SOURCES = {
    # collection id, band, scale (m), whether it needs summing to daily
    "chirps": ("UCSB-CHG/CHIRPS/DAILY", "precipitation", 5566, False),
    "imerg": ("NASA/GPM_L3/IMERG_V07", "precipitation", 11132, True),
}


def _daily_collection(source: str, start: str, end: str, region):
    """One image per day of total precipitation in mm."""
    import ee

    collection_id, band, _, needs_sum = SOURCES[source]
    collection = ee.ImageCollection(collection_id).select(band).filterDate(start, end)
    if region is not None:
        collection = collection.filterBounds(region)
    if not needs_sum:
        return collection

    # IMERG bands are rates in mm/hr on 30-minute steps: sum then halve to get mm.
    n_days = ee.Date(end).difference(ee.Date(start), "day").toInt()

    def one_day(offset):
        day_start = ee.Date(start).advance(ee.Number(offset), "day")
        day = collection.filterDate(day_start, day_start.advance(1, "day"))
        total = day.sum().multiply(0.5).rename(band)
        return total.set("system:time_start", day_start.millis())

    return ee.ImageCollection(ee.List.sequence(0, n_days.subtract(1)).map(one_day))


# getInfo returns a bounded payload; past roughly this many rows it errors or
# truncates, so requests are split to stay under it.
MAX_ROWS_PER_REQUEST = 4500


def daily_at_points(
    points: gpd.GeoDataFrame, start: str, end: str, source: str = "chirps",
    id_field: str | None = None,
) -> pd.DataFrame:
    """Daily rainfall (mm) at each point, as long-format rows of (point, day, mm).

    Splits the date range so no single request exceeds what getInfo will return.
    """
    n_days = (pd.Timestamp(end) - pd.Timestamp(start)).days
    rows_per_day = max(len(points), 1)
    max_days = max(1, MAX_ROWS_PER_REQUEST // rows_per_day)
    if n_days > max_days:
        edges = pd.date_range(start, end, freq=f"{max_days}D").tolist()
        if pd.Timestamp(end) not in edges:
            edges.append(pd.Timestamp(end))
        log.info("splitting %d days into %d requests", n_days, len(edges) - 1)
        parts = [
            _daily_at_points_once(
                points, a.date().isoformat(), b.date().isoformat(), source, id_field
            )
            for a, b in zip(edges[:-1], edges[1:], strict=True)
        ]
        parts = [p for p in parts if not p.empty]
        if not parts:
            return pd.DataFrame(columns=["pid", "day", "precip_mm"])
        return (
            pd.concat(parts, ignore_index=True)
            .drop_duplicates(subset=["pid", "day"])
            .sort_values(["pid", "day"])
            .reset_index(drop=True)
        )
    return _daily_at_points_once(points, start, end, source, id_field)


def _daily_at_points_once(
    points: gpd.GeoDataFrame, start: str, end: str, source: str = "chirps",
    id_field: str | None = None,
) -> pd.DataFrame:
    import ee

    if source not in SOURCES:
        raise ValueError(f"unknown source {source!r}; expected one of {sorted(SOURCES)}")
    initialize()

    wgs = points.to_crs("EPSG:4326")
    features = [
        ee.Feature(
            ee.Geometry.Point([geom.x, geom.y]),
            {"pid": str(row[id_field]) if id_field else str(i)},
        )
        for i, (geom, row) in enumerate(
            zip(wgs.geometry, wgs.to_dict("records"), strict=True)
        )
    ]
    fc = ee.FeatureCollection(features)

    _, band, scale, _ = SOURCES[source]
    collection = _daily_collection(source, start, end, fc.geometry().bounds())

    def sample(image):
        day = image.date().format("YYYY-MM-dd")
        return image.reduceRegions(
            collection=fc, reducer=ee.Reducer.first(), scale=scale
        ).map(lambda f: f.set("day", day))

    rows = collection.map(sample).flatten().getInfo()["features"]
    frame = pd.DataFrame(
        [
            {
                "pid": r["properties"].get("pid"),
                "day": r["properties"].get("day"),
                "precip_mm": r["properties"].get("first"),
            }
            for r in rows
        ]
    )
    if frame.empty:
        return frame
    frame["day"] = pd.to_datetime(frame["day"]).dt.date
    frame["precip_mm"] = pd.to_numeric(frame["precip_mm"], errors="coerce")
    log.info(
        "%s: %d point-days over %s..%s (%d points)",
        source, len(frame), start, end, frame["pid"].nunique(),
    )
    return frame.sort_values(["pid", "day"]).reset_index(drop=True)


def antecedent_windows(
    events: gpd.GeoDataFrame, days_before: int = 30, source: str = "chirps",
    pad_after: int = 1, max_span_days: int = 120,
) -> pd.DataFrame:
    """Daily rainfall for the window preceding each event.

    Events are grouped into clusters whose windows are close in time, and each
    cluster is fetched in one request. Querying one continuous span across the
    whole inventory would be far worse than it looks: an 11-year span at 69
    points is ~276,000 point-days, nearly all of them discarded, and large
    enough to exceed what `getInfo` will return. Grouping keeps each request to
    the days actually needed.
    """
    dated = events[events["occurred_on"].notna()].copy().reset_index(drop=True)
    if dated.empty:
        raise ValueError("no events carry a date; a trigger model needs dates")
    dated["pid"] = dated.index.astype(str)
    dated = dated.sort_values("occurred_on")

    # Greedily group events whose windows fall inside one bounded span.
    groups: list[list[int]] = []
    current: list[int] = []
    anchor: date | None = None
    for idx, event in dated.iterrows():
        occurred = event["occurred_on"]
        if anchor is None or (occurred - anchor).days > max_span_days - days_before:
            if current:
                groups.append(current)
            current, anchor = [], occurred
        current.append(idx)
    if current:
        groups.append(current)

    windows = []
    for group in groups:
        chunk = dated.loc[group]
        start = min(chunk["occurred_on"]) - timedelta(days=days_before)
        end = max(chunk["occurred_on"]) + timedelta(days=pad_after)
        daily = daily_at_points(
            chunk, start.isoformat(), end.isoformat(), source=source, id_field="pid"
        )
        if daily.empty:
            continue
        for _, event in chunk.iterrows():
            occurred = event["occurred_on"]
            series = daily[daily["pid"] == event["pid"]]
            window = series[
                (series["day"] > occurred - timedelta(days=days_before))
                & (series["day"] <= occurred)
            ].copy()
            window["event_pid"] = event["pid"]
            window["occurred_on"] = occurred
            window["lag_days"] = [(occurred - d).days for d in window["day"]]
            windows.append(window)

    out = pd.concat(windows, ignore_index=True) if windows else pd.DataFrame()
    log.info(
        "built %d antecedent windows of %d days from %d request(s)",
        dated["pid"].nunique(), days_before, len(groups),
    )
    return out


def summarise_antecedent(windows: pd.DataFrame, spans=(1, 3, 7, 15, 30)) -> pd.DataFrame:
    """Cumulative rainfall over each lookback span — the trigger model's features."""
    rows = []
    for pid, group in windows.groupby("event_pid"):
        row = {"event_pid": pid, "occurred_on": group["occurred_on"].iloc[0]}
        for span in spans:
            recent = group[group["lag_days"] < span]
            row[f"rain_{span}d_mm"] = float(recent["precip_mm"].sum())
        rows.append(row)
    return pd.DataFrame(rows).sort_values("occurred_on").reset_index(drop=True)
