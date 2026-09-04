"""The API is what officials and the citizen app actually talk to."""

import geopandas as gpd
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import LineString

from api.store import RiskStore, StoreUnavailable, get_store


@pytest.fixture
def store(tmp_path):
    segments = gpd.GeoDataFrame(
        {
            "highway_code": ["NH-10"] * 3 + ["NH-717"],
            "chainage_km": [0.0, 1.0, 2.0, 0.0],
            "length_m": [1000.0] * 4,
            "hazard_raw": [0.2, 0.9, 0.6, 0.5],
            "reach_m": [200.0, 800.0, 400.0, 300.0],
            "susceptibility": [0.2, 0.9, 0.6, 0.5],
            "trigger_prob": [0.01] * 4,
            "deform_mod": [1.0] * 4,
            "exposure": [1.0] * 4,
            "hazard": [0.002, 0.009, 0.006, 0.005],
            "risk": [0.002, 0.009, 0.006, 0.005],
            "tier": ["green", "red", "orange", "yellow"],
            "computed_at": [pd.Timestamp("2016-07-21T09:00:00")] * 4,
            "horizon_h": [24] * 4,
        },
        geometry=[
            LineString([(500_000, 3_000_000), (501_000, 3_000_000)]),
            LineString([(501_000, 3_000_000), (502_000, 3_000_000)]),
            LineString([(502_000, 3_000_000), (503_000, 3_000_000)]),
            LineString([(600_000, 3_000_000), (601_000, 3_000_000)]),
        ],
        crs="EPSG:32645",
    )
    path = tmp_path / "segment_risk.parquet"
    segments.to_parquet(path)

    thresholds = pd.DataFrame(
        {"threshold": [0.008, 0.006, 0.004, float("-inf")],
         "tier": ["red", "orange", "yellow", "green"]}
    )
    import api.store as store_module

    original = store_module.TIER_THRESHOLDS
    store_module.TIER_THRESHOLDS = tmp_path / "tiers.parquet"
    thresholds.to_parquet(store_module.TIER_THRESHOLDS)
    yield RiskStore.load(path)
    store_module.TIER_THRESHOLDS = original


@pytest.fixture
def client(store):
    from api.main import app
    from api.store import get_store_optional

    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_store_optional] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_reports_what_is_loaded(client):
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["segments_loaded"] == 4
    assert body["tiers_calibrated"] is True


def test_health_is_degraded_when_the_pipeline_has_not_run():
    """A 200 that never touches the data keeps saying 'fine' after scoring stops."""
    from api.main import app
    from api.store import get_store_optional

    app.dependency_overrides[get_store_optional] = lambda: None
    try:
        body = TestClient(app).get("/api/v1/health").json()
    finally:
        app.dependency_overrides.clear()
    assert body["status"] == "degraded"
    assert body["segments_loaded"] == 0


def test_watchlist_is_ordered_worst_first(client):
    segments = client.get("/api/v1/risk/watchlist?limit=10").json()["segments"]
    risks = [s["risk"] for s in segments]
    assert risks == sorted(risks, reverse=True)


def test_tier_filter_accepts_several_tiers(client):
    body = client.get("/api/v1/risk/segments?tier=orange,red").json()
    assert {s["tier"] for s in body["segments"]} == {"orange", "red"}


def test_unknown_tier_is_rejected(client):
    response = client.get("/api/v1/risk/segments?tier=purple")
    assert response.status_code == 422
    assert "purple" in response.text


def test_highway_filter(client):
    body = client.get("/api/v1/risk/segments?highway=NH-717").json()
    assert body["count"] == 1
    assert body["segments"][0]["highway_code"] == "NH-717"


def test_segment_detail_exposes_the_components(client):
    """An official who cannot see why a segment is red has no basis to act."""
    body = client.get("/api/v1/risk/segments/NH-10:1.0").json()
    assert body["tier"] == "red"
    assert body["components"]["susceptibility"] == pytest.approx(0.9)
    assert body["components"]["deformation_modifier"] == 1.0


def test_missing_segment_is_404(client):
    assert client.get("/api/v1/risk/segments/NH-10:999.0").status_code == 404


def test_literal_route_is_not_shadowed_by_the_id_route(client):
    """/risk/watchlist must not be parsed as a segment whose id is 'watchlist'."""
    assert client.get("/api/v1/risk/watchlist").status_code == 200
    assert client.get("/api/v1/risk/tiers").status_code == 200


def test_point_query_returns_the_nearest_segment_and_its_distance(client):
    body = client.get("/api/v1/risk/point?lat=27.10&lon=88.50").json()
    assert body["distance_to_segment_m"] >= 0
    assert body["segment"]["id"] in {
        "NH-10:0.0", "NH-10:1.0", "NH-10:2.0", "NH-717:0.0"
    }


def test_out_of_range_coordinates_are_rejected(client):
    assert client.get("/api/v1/risk/point?lat=95&lon=88.5").status_code == 422


def test_tiers_endpoint_serves_calibrated_cut_points(client):
    """Clients must not hard-code 0.25/0.50/0.75; the tiers are per corridor."""
    tiers = {t["tier"]: t["threshold"] for t in client.get("/api/v1/risk/tiers").json()}
    assert tiers["red"] > tiers["orange"] > tiers["yellow"]
    assert tiers["red"] < 0.25, "calibrated thresholds are far below the design defaults"


def test_segment_ids_are_unique_across_highways(store):
    """NH-10 km 0.0 and NH-717 km 0.0 are different places, and the fixture has both."""
    ids = list(store.segments["id"])
    assert len(ids) == len(set(ids))
    assert "NH-10:0.0" in ids and "NH-717:0.0" in ids


def test_duplicate_ids_are_refused(tmp_path):
    """Serving two segments under one id silently hides one of them."""
    duplicated = gpd.GeoDataFrame(
        {"highway_code": ["NH-10", "NH-10"], "chainage_km": [1.0, 1.0]},
        geometry=[LineString([(0, 0), (1, 1)])] * 2, crs="EPSG:32645",
    )
    path = tmp_path / "dupes.parquet"
    duplicated.to_parquet(path)
    with pytest.raises(StoreUnavailable, match="duplicate segment ids"):
        RiskStore.load(path)


def test_pagination(client):
    first = client.get("/api/v1/risk/segments?limit=2&offset=0").json()
    second = client.get("/api/v1/risk/segments?limit=2&offset=2").json()
    assert first["count"] == 2 and second["count"] == 2
    assert {s["id"] for s in first["segments"]} & {s["id"] for s in second["segments"]} == set()


def test_missing_store_raises_with_a_usable_message(tmp_path):
    with pytest.raises(StoreUnavailable, match="Run the pipeline first"):
        RiskStore.load(tmp_path / "nope.parquet")
