import pytest

from ingestion.aoi import DEFAULT, NH10_SEVOKE_GANGTOK


def test_default_is_pilot_corridor():
    assert DEFAULT is NH10_SEVOKE_GANGTOK


def test_bbox_is_ordered_correctly():
    min_lon, min_lat, max_lon, max_lat = DEFAULT.bbox
    assert min_lon < max_lon
    assert min_lat < max_lat


def test_wkt_polygon_closes():
    wkt = DEFAULT.wkt
    coords = wkt.removeprefix("POLYGON((").removesuffix("))").split(", ")
    assert coords[0] == coords[-1], "polygon ring must close"


def test_geojson_ring_closes():
    ring = DEFAULT.geojson["coordinates"][0]
    assert ring[0] == ring[-1]


def test_earthengine_missing_project_is_a_clear_error(monkeypatch):
    """A missing project must not surface as a stack trace from inside ee."""
    from ingestion.clients.earthengine import EarthEngineNotConfigured, initialize

    monkeypatch.setenv("GEE_PROJECT_ID", "")
    with pytest.raises(EarthEngineNotConfigured, match="GEE_PROJECT_ID"):
        initialize()
