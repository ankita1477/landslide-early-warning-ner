"""Label quality is the binding constraint, so the filtering must be exact."""

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import Point, Polygon

from ingestion.aoi import AOI
from ingestion.clients.inventory import ACCURACY_M, SCHEMA, combine, load_glc, load_local

AOI_TEST = AOI(
    name="test", bbox=(88.0, 27.0, 89.0, 28.0), utm_crs="EPSG:32645", description="test"
)


@pytest.fixture
def glc_shapefile(tmp_path):
    """Mimics the GLC's columns, including its coarse accuracy classes."""
    rows = [
        ("exact", 88.5, 27.5, "2015-07-04"),
        ("1km", 88.6, 27.6, "2016-10-15"),
        ("5km", 88.4, 27.4, "2014-01-01"),
        ("25km", 88.3, 27.3, "2013-06-27"),
        ("unknown", 88.2, 27.2, "2012-01-01"),
        ("exact", 95.0, 20.0, "2011-01-01"),  # outside the AOI
    ]
    gdf = gpd.GeoDataFrame(
        {
            "location_a": [r[0] for r in rows],
            "event_date": [r[3] for r in rows],
            "fatality_c": [1] * len(rows),
            "landslid_3": ["downpour"] * len(rows),
            "geometry": [Point(r[1], r[2]) for r in rows],
        },
        crs="EPSG:4326",
    )
    path = tmp_path / "glc.shp"
    gdf.to_file(path)
    return path


def test_only_precise_events_survive(glc_shapefile):
    out = load_glc(glc_shapefile, AOI_TEST, max_accuracy_m=1000.0)
    assert len(out) == 2, "expected only the exact and 1km events inside the AOI"
    assert set(out["confidence"]) == {"exact", "1km"}


def test_unknown_accuracy_is_dropped_not_treated_as_precise(glc_shapefile):
    """An unmapped accuracy class must never pass the filter by default."""
    out = load_glc(glc_shapefile, AOI_TEST, max_accuracy_m=250_000.0)
    assert "unknown" not in set(out["confidence"])


def test_aoi_clipping(glc_shapefile):
    out = load_glc(glc_shapefile, AOI_TEST, max_accuracy_m=250_000.0)
    minx, miny, maxx, maxy = out.total_bounds
    assert AOI_TEST.bbox[0] <= minx and maxx <= AOI_TEST.bbox[2]


def test_schema_is_stable(glc_shapefile):
    assert list(load_glc(glc_shapefile, AOI_TEST).columns) == SCHEMA


def test_accuracy_classes_are_ordered():
    values = [ACCURACY_M[k] for k in ("exact", "1km", "5km", "10km", "25km", "50km")]
    assert values == sorted(values)


def test_polygons_become_points_inside_the_polygon(tmp_path):
    """A centroid can land outside a concave scar; a representative point cannot."""
    concave = Polygon([(88.0, 27.0), (88.9, 27.0), (88.9, 27.9),
                       (88.5, 27.1), (88.0, 27.9)])
    path = tmp_path / "mapped.gpkg"
    gpd.GeoDataFrame({"date": ["2023-10-04"], "geometry": [concave]},
                     crs="EPSG:4326").to_file(path)

    out = load_local(path, source="GSI")
    assert out.geometry.iloc[0].within(concave)
    assert bool(out["verified"].iloc[0])


def test_combine_keeps_the_better_located_duplicate():
    date = pd.Timestamp("2015-07-04").date()
    coarse = gpd.GeoDataFrame(
        {"occurred_on": [date], "geometry": [Point(88.5, 27.5)], "source": ["GLC"],
         "fatalities": [1], "trigger_type": ["rain"], "confidence": ["25km"],
         "accuracy_m": [25_000.0], "verified": [False]}, crs="EPSG:4326")[SCHEMA]
    precise = coarse.copy()
    precise["source"], precise["accuracy_m"], precise["confidence"] = "GSI", 50.0, "mapped"

    out = combine(coarse, precise)
    assert len(out) == 1
    assert out["source"].iloc[0] == "GSI"


def test_combine_of_nothing_still_has_the_schema():
    empty = combine()
    assert list(empty.columns) == SCHEMA


def _event(lon, lat, date, accuracy_m, source):
    return gpd.GeoDataFrame(
        {"occurred_on": [pd.Timestamp(date).date()], "geometry": [Point(lon, lat)],
         "source": [source], "fatalities": [1], "trigger_type": ["rain"],
         "confidence": ["x"], "accuracy_m": [accuracy_m], "verified": [False]},
        crs="EPSG:4326")[SCHEMA]


def test_near_duplicates_across_catalogues_collapse():
    """HMA is derived from GLC: the same slide appears in both, slightly shifted.
    Exact matching keeps both, duplicating a positive across train and test."""
    glc = _event(88.500, 27.500, "2015-07-04", 25_000.0, "GLC")
    hma = _event(88.503, 27.501, "2015-07-05", 1_000.0, "HMA")  # ~300 m, 1 day apart

    out = combine(glc, hma)
    assert len(out) == 1, "the same event was counted twice"
    assert out["source"].iloc[0] == "HMA", "should keep the better-located copy"


def test_genuinely_distinct_events_are_kept():
    a = _event(88.50, 27.50, "2015-07-04", 1000.0, "GLC")
    b = _event(88.70, 27.70, "2015-07-04", 1000.0, "GLC")   # ~28 km away
    c = _event(88.50, 27.50, "2016-09-01", 1000.0, "GLC")   # same place, a year later
    assert len(combine(a, b, c)) == 3


def test_duplicate_collapse_is_not_transitive_across_far_events():
    """A chain of near-neighbours must not collapse into one."""
    events = [_event(88.50 + 0.05 * i, 27.50, "2015-07-04", 1000.0, "GLC") for i in range(3)]
    assert len(combine(*events)) == 3
