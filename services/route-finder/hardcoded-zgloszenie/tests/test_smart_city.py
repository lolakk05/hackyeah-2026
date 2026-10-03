import json
from pathlib import Path

import pytest
from demo_app import create_app
from fastapi.testclient import TestClient
from smart_city import (
    DemoObstacle,
    DemoSnapshot,
    SmartCityDemo,
    intersects_obstacle,
    validate_snapshot,
)

from models import LineString, Location


def test_road_report_reroutes_and_deletion_restores_baseline():
    with TestClient(create_app()) as client:
        baseline = client.post("/demo/routes", json={}).json()
        assert baseline["route_id"] == "direct"
        assert baseline["rerouted"] is False
        report = client.post(
            "/demo/reports", json={"kind": "blocked_road", "description": "Remont drogi"}
        )
        assert report.status_code == 201
        report = report.json()
        for mobility in ("walking", "wheelchair"):
            detour = client.post("/demo/routes", json={"mobility": mobility}).json()
            assert detour["route_id"] == "planty"
            assert detour["rerouted"] is True
            assert detour["geometry"] != baseline["geometry"]
            assert detour["original_geometry"] == baseline["geometry"]
            assert detour["additional_duration_s"] > 0
            assert detour["additional_distance_m"] > 0
            assert detour["avoided_reports"][0]["id"] == report["id"]
            assert detour["is_demo"] is True
            assert detour["accessibility_verified"] is False
            assert detour["source"] == "osrm_snapshot"
        removed = client.delete(f"/demo/reports/{report['id']}")
        assert removed.status_code == 204
        assert removed.content == b""
        restored = client.post("/demo/routes", json={}).json()
        assert restored["route_id"] == "direct"
        assert restored["geometry"] == baseline["geometry"]
        assert restored["report_revision"] > detour["report_revision"]


def test_stairs_only_affect_wheelchair_and_reset():
    with TestClient(create_app()) as client:
        report = client.post("/demo/reports", json={"kind": "stairs"}).json()
        walking = client.post("/demo/routes", json={"mobility": "walking"}).json()
        wheelchair = client.post("/demo/routes", json={"mobility": "wheelchair"}).json()
        assert walking["route_id"] == "direct"
        assert walking["ignored_reports"][0]["id"] == report["id"]
        assert walking["avoided_reports"] == []
        assert wheelchair["route_id"] == "planty"
        assert wheelchair["ignored_reports"] == []
        reset = client.post("/demo/reset").json()
        assert reset["removed_reports"] == 1
        assert client.get("/demo/reports").json() == []
        assert (
            client.post("/demo/routes", json={"mobility": "wheelchair"}).json()["route_id"]
            == "direct"
        )


def test_multiple_reports_only_clear_after_last_blockage():
    with TestClient(create_app()) as client:
        first = client.post("/demo/reports", json={"kind": "blocked_road"}).json()
        second = client.post("/demo/reports", json={"kind": "blocked_road"}).json()
        client.delete(f"/demo/reports/{first['id']}")
        assert client.post("/demo/routes", json={}).json()["rerouted"] is True
        client.delete(f"/demo/reports/{second['id']}")
        assert client.post("/demo/routes", json={}).json()["rerouted"] is False


def test_scenario_catalog_filters_and_missing_report():
    with TestClient(create_app()) as client:
        scenario = client.get("/demo/scenario").json()
        assert scenario["snapshot"]["scenario_id"] == "rynek_wawel"
        assert len(scenario["snapshot"]["variants"]) == 2
        assert scenario["active_reports"] == []
        client.post("/demo/reports", json={"kind": "stairs"})
        client.post("/demo/reports", json={"kind": "blocked_road"})
        assert len(client.get("/demo/reports").json()) == 2
        assert client.get("/demo/reports?kind=stairs").json()[0]["kind"] == "stairs"
        assert client.delete("/demo/reports/missing").status_code == 404
        assert client.get("/health").status_code == 200


@pytest.mark.parametrize(
    "path,body",
    [
        ("/demo/reports", {}),
        ("/demo/reports", {"kind": "unknown"}),
        ("/demo/reports", {"kind": "stairs", "obstacle_id": "elsewhere"}),
        ("/demo/reports", {"kind": "stairs", "location": {"latitude": 0, "longitude": 0}}),
        ("/demo/reports", {"kind": "stairs", "description": "a" * 501}),
        ("/demo/routes", {"mobility": "car"}),
        ("/demo/routes", {"duration_minutes": 0}),
        ("/demo/routes", {"scenario": "other"}),
    ],
)
def test_demo_validation(path, body):
    with TestClient(create_app()) as client:
        assert client.post(path, json=body).status_code == 422


def test_detour_keeps_obstacles_even_if_time_budget_is_too_short():
    with TestClient(create_app()) as client:
        client.post("/demo/reports", json={"kind": "blocked_road"})
        response = client.post("/demo/routes", json={"duration_minutes": 15}).json()
    assert response["route_id"] == "planty"
    assert response["requested_duration_s"] == 900
    assert response["within_budget"] is False
    assert response["duration_s"] > 900
    assert len(response["warnings"]) == 2


def test_intersection_checks_segments_not_only_vertices():
    obstacle = DemoObstacle(
        id="grodzka", name="test", location=Location(latitude=50, longitude=19), radius_m=20
    )
    crosses = LineString(coordinates=[(18.999, 50), (19.001, 50)])
    misses = LineString(coordinates=[(18.999, 50.001), (19.001, 50.001)])
    assert intersects_obstacle(crosses, obstacle)
    assert not intersects_obstacle(misses, obstacle)
    assert intersects_obstacle(LineString(coordinates=[(19, 50), (19, 50)]), obstacle)


def test_recorded_routes_really_avoid_demo_area():
    path = Path(__file__).resolve().parents[1] / "data" / "rynek_wawel_routes.json"
    demo = SmartCityDemo.load(path)
    variants = {v.id: v for v in demo.snapshot.variants}
    assert intersects_obstacle(variants["direct"].geometry, demo.snapshot.obstacle)
    assert not intersects_obstacle(variants["planty"].geometry, demo.snapshot.obstacle)
    for endpoint in (0, -1):
        assert (
            variants["direct"].geometry.coordinates[endpoint]
            == variants["planty"].geometry.coordinates[endpoint]
        )


def test_corrupt_detour_snapshot_fails_startup(tmp_path):
    path = Path(__file__).resolve().parents[1] / "data" / "rynek_wawel_routes.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["variants"][1]["geometry"] = data["variants"][0]["geometry"]
    invalid = tmp_path / "invalid.json"
    invalid.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(RuntimeError, match="Cannot load"):
        SmartCityDemo.load(invalid)
    with pytest.raises(ValueError, match="avoid"):
        validate_snapshot(DemoSnapshot.model_validate(data))


def test_report_capacity_limit():
    with TestClient(create_app()) as client:
        for _ in range(100):
            assert client.post("/demo/reports", json={"kind": "stairs"}).status_code == 201
        response = client.post("/demo/reports", json={"kind": "stairs"})
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "demo_report_limit"


def test_demo_runs_without_poi_loading_or_network(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("The isolated demo must not load POIs or initialize a network client")

    monkeypatch.setattr("spatial.POIIndex.load", forbidden)
    monkeypatch.setattr("httpx.AsyncClient", forbidden)
    with TestClient(create_app()) as client:
        assert client.get("/health").json() == {"status": "ok", "is_demo": True}
        assert client.get("/").json()["service"] == "hardcoded-zgloszenie"
        assert client.get("/demo").status_code == 404
        assert client.post("/demo/routes", json={}).status_code == 200
        assert client.post("/routes/plan", json={"duration_minutes": 30}).status_code == 404
        assert client.get("/pois").status_code == 404
        assert not hasattr(client.app.state, "poi_index")
        for methods in client.get("/openapi.json").json()["paths"].values():
            for operation in methods.values():
                assert operation["description"]
                assert operation["summary"]
