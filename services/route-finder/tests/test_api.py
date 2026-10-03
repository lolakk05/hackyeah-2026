import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

import httpx
import pytest

from config import Settings
from main import create_app
from tests.conftest import POINTS, osrm_response


def test_plan_with_randomization_disabled_and_cache(client_factory):
    calls = []

    def handle(request):
        calls.append(request)
        return osrm_response(request)

    with client_factory(handle) as client:
        body = {"duration_minutes": 10, "randomize": False}
        first = client.post("/routes/plan", json=body).json()
        second = client.post("/routes/plan", json=body).json()
    assert first["start_poi"]["id"] == "p0"
    assert first["end_poi"]["id"] == "p2"
    assert [p["id"] for p in first["intermediate_pois"]] == ["p1"]
    assert first["duration_s"] == 570
    assert first["unused_duration_s"] == 30
    assert first["matches_target"] is True
    assert first["source"] == "osrm"
    assert second["source"] == "cache"
    assert len(calls) == 2
    assert "/table/v1/foot/" in calls[0].url.path
    assert "/route/v1/foot/" in calls[1].url.path
    assert calls[1].url.params["geometries"] == "geojson"
    assert len(first["legs"]) == 2
    assert first["geometry"]["coordinates"][0] == list(POINTS[0])


def test_direct_route_uses_osrm_time_not_air_distance(client_factory):
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={"duration_minutes": 10, "start_poi_id": "p0", "max_intermediate_stops": 0},
        )
    assert response.status_code == 200
    assert response.json()["duration_s"] == 580
    assert response.json()["end_poi"]["id"] == "p2"
    assert response.json()["intermediate_pois"] == []


def test_shorter_route_is_explicit(client_factory):
    with client_factory() as client:
        data = client.post(
            "/routes/plan",
            json={"duration_minutes": 10, "tolerance_percent": 0, "max_intermediate_stops": 0},
        ).json()
    assert data["matches_target"] is False
    assert data["unused_duration_s"] == 20
    assert len(data["warnings"]) == 2


def test_final_route_cannot_exceed_budget(client_factory):
    with client_factory(lambda r: osrm_response(r, duration_override=601)) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "no_route_within_budget"


@pytest.mark.parametrize("minutes", [241, 360])
def test_extended_duration_budget_is_accepted(client_factory, minutes):
    with client_factory() as client:
        response = client.post("/routes/plan", json={"duration_minutes": minutes})
    assert response.status_code == 200
    assert response.json()["requested_duration_s"] == minutes * 60
    assert response.json()["duration_s"] <= minutes * 60


def test_planner_limits_are_published_in_capabilities_and_openapi(client_factory):
    with client_factory() as client:
        capabilities = client.get("/capabilities").json()
        schema = client.get("/openapi.json").json()
    assert capabilities["duration_minutes"] == {"min": 5, "max": 360}
    assert capabilities["default_intermediate_stops"] == 8
    assert capabilities["max_intermediate_stops"] == 10
    duration = schema["components"]["schemas"]["PlanRequest"]["properties"]["duration_minutes"]
    assert duration["minimum"] == 5
    assert duration["maximum"] == 360
    stops = schema["components"]["schemas"]["PlanRequest"]["properties"]["max_intermediate_stops"]
    assert stops["default"] == 8
    assert stops["maximum"] == 10


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"duration_minutes": 4},
        {"duration_minutes": 361},
        {"duration_minutes": 360.01},
        {"duration_minutes": 10, "max_intermediate_stops": 11},
        {"duration_minutes": 10, "tolerance_percent": -1},
        {"duration_minutes": 10, "start_location": {"latitude": 100, "longitude": 19}},
        {
            "duration_minutes": 10,
            "start_poi_id": "p0",
            "start_location": {"latitude": 50, "longitude": 19},
        },
        {"duration_minutes": 10, "unknown": True},
        {"duration_minutes": 10, "category": "   "},
    ],
)
def test_request_validation(client_factory, body):
    with client_factory() as client:
        assert client.post("/routes/plan", json=body).status_code == 422


@pytest.mark.parametrize(
    "body,code",
    [
        ({"duration_minutes": 10, "start_poi_id": "missing"}, "poi_not_found"),
        ({"duration_minutes": 10, "category": "zoo"}, "no_candidate_pois"),
        (
            {"duration_minutes": 10, "start_location": {"latitude": 0, "longitude": 0}},
            "no_start_poi",
        ),
    ],
)
def test_no_local_match_does_not_call_osrm(client_factory, body, code):
    def forbidden(request):
        pytest.fail("No upstream request expected")

    with client_factory(forbidden) as client:
        response = client.post("/routes/plan", json=body)
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == code


def test_429_cooldown_and_retry_after(client_factory):
    calls = []

    def limited(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "90"})

    with client_factory(limited) as client:
        first = client.post("/routes/plan", json={"duration_minutes": 10})
        second = client.post("/routes/plan", json={"duration_minutes": 11})
    assert first.status_code == second.status_code == 503
    assert first.headers["Retry-After"] == "90"
    assert second.json()["detail"]["code"] == "osrm_rate_limited"
    assert len(calls) == 1
    assert "geometry" not in first.json()


@pytest.mark.parametrize("header", ["invalid", "0", "nan", "-1"])
def test_invalid_retry_after_uses_default(client_factory, header):
    with client_factory(lambda r: httpx.Response(429, headers={"Retry-After": header})) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.headers["Retry-After"] == "60"


def test_retry_after_http_date(client_factory):
    header = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=120), usegmt=True)
    with client_factory(lambda r: httpx.Response(429, headers={"Retry-After": header})) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert 118 <= int(response.headers["Retry-After"]) <= 120


@pytest.mark.parametrize(
    "payload",
    [{}, [], {"code": "Ok", "durations": [[0]]}, {"code": "Ok", "durations": [[-1] * 4] * 4}],
)
def test_invalid_osrm_table(client_factory, payload):
    with client_factory(lambda r: httpx.Response(200, json=payload)) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "osrm_invalid_response"


def test_no_segment_table_falls_back_to_real_route(client_factory):
    def handler(request):
        if "/table/" in request.url.path:
            return httpx.Response(400, json={"code": "NoSegment"})
        return osrm_response(request)

    with client_factory(handler) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.status_code == 200
    assert response.json()["source"] == "osrm"
    assert response.json()["duration_s"] <= 600
    assert response.json()["intermediate_pois"] == []


def test_unreachable_matrix(client_factory):
    def handler(request):
        payload = osrm_response(request).json()
        payload["durations"] = [
            [0 if i == j else None for j in range(len(row))]
            for i, row in enumerate(payload["durations"])
        ]
        return httpx.Response(200, json=payload)

    with client_factory(handler) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.status_code == 404


def test_timeout_and_legacy_fallback(client_factory):
    def timeout(request):
        raise httpx.ReadTimeout("timeout", request=request)

    with client_factory(timeout) as client:
        planned = client.post("/routes/plan", json={"duration_minutes": 10})
        legacy = client.get(
            "/route", params={"latitude": 50.0617, "longitude": 19.9373, "category": "museum"}
        )
    assert planned.status_code == 503
    assert planned.json()["detail"]["code"] == "osrm_timeout"
    assert legacy.status_code == 200
    assert legacy.json()["source"] == "straight_line"
    assert legacy.json()["is_estimate"] is True


def test_catalog_and_documentation(client_factory, poi_file):
    with client_factory() as client:
        # Successful requests still work after deleting the input: POIs are held in RAM.
        poi_file.unlink()
        assert client.get("/health").json()["poi_count"] == 4
        assert client.get("/dataset").json()["metadata"]["source"] == "test"
        assert client.get("/categories").json() == ["museum"]
        page = client.get("/pois?category=MUSEUM&q=Museum&offset=1&limit=2").json()
        assert page["total"] == 4
        assert [p["id"] for p in page["items"]] == ["p1", "p2"]
        assert client.get("/pois?q=missing").json()["items"] == []
        assert client.get("/pois/p0").json()["id"] == "p0"
        assert client.get("/pois/missing").status_code == 404
        assert client.get("/docs").status_code == client.get("/redoc").status_code == 200
        schema = client.get("/openapi.json").json()
        for path in schema["paths"].values():
            for operation in path.values():
                assert operation["summary"] and operation["description"]
        assert schema["paths"]["/routes/plan"]["post"]["requestBody"]


def test_osrm_calls_are_spaced(client_factory):
    times = []

    def handler(request):
        times.append(time.monotonic())
        return osrm_response(request)

    with client_factory(handler) as client:
        assert client.post("/routes/plan", json={"duration_minutes": 10}).status_code == 200
    assert times[1] - times[0] >= 0.99


async def test_concurrent_plan_busy_and_health_remains_responsive(poi_file):
    entered, release = asyncio.Event(), asyncio.Event()

    async def handler(request):
        entered.set()
        await release.wait()
        return osrm_response(request)

    app = create_app(Settings(poi_file=poi_file), transport=httpx.MockTransport(handler))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://test"
        ) as client:
            first = asyncio.create_task(client.post("/routes/plan", json={"duration_minutes": 10}))
            await entered.wait()
            second = await client.post("/routes/plan", json={"duration_minutes": 11})
            assert second.status_code == 503
            assert second.json()["detail"]["code"] == "planner_busy"
            assert (await client.get("/health")).status_code == 200
            release.set()
            assert (await first).status_code == 200


def test_restricted_start_and_candidate_filtering(client_factory, poi_file):
    data = json.loads(poi_file.read_text())
    data["features"][1]["properties"]["tags"] = {"access": "private"}
    poi_file.write_text(json.dumps(data))
    with client_factory() as client:
        restricted = client.post(
            "/routes/plan", json={"duration_minutes": 10, "start_poi_id": "p1"}
        )
        assert restricted.status_code == 422
        assert restricted.json()["detail"]["code"] == "poi_access_restricted"
        allowed = client.post("/routes/plan", json={"duration_minutes": 10}).json()
    assert allowed["end_poi"]["id"] == "p2"
    assert allowed["intermediate_pois"] == []


def test_cache_expiry_and_rate_limited_fallback(client_factory):
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) > 2:
            return httpx.Response(429, headers={"Retry-After": "60"})
        return osrm_response(request)

    with client_factory(handler) as client:
        body = {"duration_minutes": 10, "randomize": False}
        assert client.post("/routes/plan", json=body).status_code == 200
        assert client.post("/routes/plan", json={**body, "duration_minutes": 11}).status_code == 503
        cached = client.post("/routes/plan", json=body)
        assert cached.json()["source"] == "cache"
        assert len(calls) == 3
        cache = client.app.state.planner._cache
        key = next(iter(cache))
        cache[key] = (time.monotonic() - 4000, cache[key][1])
        assert client.post("/routes/plan", json=body).status_code == 503
        assert len(calls) == 3


@pytest.mark.parametrize("fault", ["geometry", "waypoint", "legs"])
def test_malformed_route_is_not_returned(client_factory, fault):
    def handler(request):
        response = osrm_response(request)
        if "/route/" in request.url.path:
            data = response.json()
            if fault == "geometry":
                data["routes"][0]["geometry"]["coordinates"] = [[200, 100]]
            elif fault == "waypoint":
                data["waypoints"][0]["distance"] = 1000
            else:
                data["routes"][0]["legs"] = []
            return httpx.Response(200, json=data)
        return response

    with client_factory(handler) as client:
        response = client.post("/routes/plan", json={"duration_minutes": 10})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "osrm_invalid_response"


async def test_plan_deadline_releases_locks(poi_file):
    async def handler(request):
        await asyncio.sleep(1)
        return osrm_response(request)

    app = create_app(
        Settings(poi_file=poi_file, plan_timeout_s=0.05), transport=httpx.MockTransport(handler)
    )
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://test"
        ) as client:
            response = await client.post("/routes/plan", json={"duration_minutes": 10})
            assert response.status_code == 503
            assert response.json()["detail"]["code"] == "planning_timeout"
            assert not app.state.planner._lock.locked()
            assert not app.state.router._lock.locked()


def test_tourist_api_does_not_initialize_or_expose_demo(client_factory):
    with client_factory() as client:
        assert not hasattr(client.app.state, "smart_city_demo")
        assert "smart_city_demo" not in client.get("/").json()
        assert client.get("/demo").status_code == 404
        assert client.post("/demo/routes", json={}).status_code == 404
        assert not any(
            path.startswith("/demo") for path in client.get("/openapi.json").json()["paths"]
        )
