"""Chainage must follow the road: increasing, contiguous, and never counted twice."""

import geopandas as gpd
import pytest
from shapely.geometry import LineString

from ingestion.clients.roads import build_chainage, corridor_path

CRS = "EPSG:32645"


def _ways(*lines):
    return gpd.GeoDataFrame(geometry=[LineString(c) for c in lines], crs=CRS)


def test_ways_given_out_of_order_become_one_path():
    # Three ways of one road along x, listed middle-first and one reversed.
    road = _ways([(1000, 0), (2000, 0)], [(3000, 0), (2000, 0)], [(0, 0), (1000, 0)])
    path = corridor_path(road)
    assert path.length == pytest.approx(3000)


def test_a_duplicated_way_is_not_counted_twice():
    road = _ways([(0, 0), (1500, 0)], [(1500, 0), (3000, 0)], [(1500, 0), (3000, 0)])
    segments = build_chainage(road, "T-1")
    assert segments["length_m"].sum() == pytest.approx(3000)


def test_a_spur_is_left_out_of_the_corridor():
    # A 500 m side road leaving the middle of a 3 km highway.
    road = _ways([(0, 0), (1500, 0)], [(1500, 0), (3000, 0)], [(1500, 0), (1500, 500)])
    assert corridor_path(road).length == pytest.approx(3000)


def test_chainage_increases_and_segments_are_contiguous():
    road = _ways([(2000, 0), (3500, 0)], [(0, 0), (2000, 0)])
    segments = build_chainage(road, "T-1")
    km = segments["chainage_km"].tolist()
    assert km == sorted(km) and km[0] == 0.0
    for a, b in zip(segments.geometry, segments.geometry[1:], strict=False):
        assert a.coords[-1] == pytest.approx(b.coords[0])


def test_start_pins_km_zero_to_the_chosen_end():
    road = _ways([(0, 0), (3000, 0)])
    start = gpd.GeoSeries.from_xy([3000], [0], crs=CRS).to_crs(4326).iloc[0]
    segments = build_chainage(road, "T-1", start_lonlat=(start.x, start.y))
    assert segments.geometry.iloc[0].coords[0][0] == pytest.approx(3000, abs=1)


def test_a_road_in_two_pieces_is_refused_rather_than_guessed():
    road = _ways([(0, 0), (1000, 0)], [(5000, 0), (6000, 0)])
    with pytest.raises(ValueError, match="not one connected road"):
        corridor_path(road)
