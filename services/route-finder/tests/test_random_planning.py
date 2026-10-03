from unittest.mock import Mock

import httpx

from config import Settings
from models import POI, PlanRequest
from planner import Planner
from routing import OSRMRouter
from spatial import POIIndex
from tests.conftest import osrm_response


def test_random_candidates_keep_start_filters_and_candidate_limit(monkeypatch):
    start = POI(id="start", name="Start", category="historic", latitude=50.0617, longitude=19.9373)
    pois = [start]
    for i in range(30):
        pois.append(
            POI(
                id=f"museum-{i}",
                name=f"Museum {i}",
                category="museum",
                latitude=50.0617,
                longitude=19.9373 + (i + 1) * 0.0004,
            )
        )
    for identifier, category, tags in [
        ("park", "park", {}),
        ("private", "museum", {"access": "private"}),
        ("wheelchair-no", "museum", {"wheelchair": "no"}),
        ("steps", "museum", {"highway": "steps"}),
    ]:
        pois.append(
            POI(
                id=identifier,
                name=identifier,
                category=category,
                latitude=50.0627,
                longitude=19.9373,
                tags=tags,
            )
        )
    settings = Settings(candidate_limit=4)
    planner = Planner(POIIndex(pois), Mock(spec=OSRMRouter), settings)
    request = PlanRequest(duration_minutes=30, category="museum", wheelchair=True, randomize=True)
    monkeypatch.setattr("planner.random.sample", lambda population, k: population[:k])
    first = planner._candidates(start, request)
    monkeypatch.setattr("planner.random.sample", lambda population, k: population[-k:])
    second = planner._candidates(start, request)
    assert first[0] == second[0] == start
    assert len(first) == len(second) == 5
    assert {p.id for p in first[1:]} != {p.id for p in second[1:]}
    for selected in (first, second):
        assert all(p.id.startswith("museum-") for p in selected[1:])
        assert len({p.id for p in selected}) == len(selected)


def test_random_paths_preserve_budget_and_do_not_repeat_stops(monkeypatch):
    matrix = [[0 if a == b else 100 for b in range(4)] for a in range(4)]
    request = PlanRequest(duration_minutes=5, max_intermediate_stops=2, randomize=True)
    monkeypatch.setattr("planner.random.shuffle", lambda items: None)
    first = Planner._paths(matrix, request)
    monkeypatch.setattr("planner.random.shuffle", lambda items: items.reverse())
    second = Planner._paths(matrix, request)
    assert first[0] != second[0]
    for paths in (first, second):
        assert len(paths[0]) == 4
        for path in paths:
            assert path[0] == 0
            assert len(path) == len(set(path))
            assert sum(matrix[a][b] for a, b in zip(path, path[1:])) <= 300


def test_random_paths_keep_required_approach_and_skip_unreachable_legs(monkeypatch):
    matrix = [[0, 40, None, None], [None, 0, 100, 100], [None, 100, 0, None], [None, 100, None, 0]]
    request = PlanRequest(duration_minutes=5, randomize=True)
    monkeypatch.setattr("planner.random.shuffle", lambda items: items.reverse())
    paths = Planner._paths(matrix, request, prefix=(0, 1))
    assert paths
    for path in paths:
        assert path[:2] == (0, 1)
        assert len(path) == len(set(path))
        assert sum(matrix[a][b] for a, b in zip(path, path[1:])) <= 300


def test_randomized_request_plans_again_and_can_choose_other_pois(client_factory, monkeypatch):
    calls = []
    shuffles = []

    def shuffle(items):
        shuffles.append(len(items))
        if len(shuffles) == 2:
            items.reverse()

    def handler(request):
        calls.append(request)
        return osrm_response(request)

    monkeypatch.setattr("planner.random.sample", lambda population, k: population[:k])
    monkeypatch.setattr("planner.random.shuffle", shuffle)
    with client_factory(handler) as client:
        body = {"duration_minutes": 40}
        first_response = client.post("/routes/plan", json=body)
        second_response = client.post("/routes/plan", json=body)
        assert not client.app.state.planner._cache
    assert first_response.status_code == second_response.status_code == 200
    first, second = first_response.json(), second_response.json()
    assert first["source"] == second["source"] == "osrm"
    assert first["start_poi"]["id"] == second["start_poi"]["id"] == "p0"
    assert first["end_poi"]["id"] != second["end_poi"]["id"]
    assert len(calls) == 4
    for plan in (first, second):
        assert 0 < plan["duration_s"] <= 2400
        assert plan["legs"] and all(leg["steps"] for leg in plan["legs"])
        assert len({stop["poi"]["id"] for stop in plan["stops"]}) == len(plan["stops"])


def test_randomizing_does_not_return_cached_plan_on_rate_limit(client_factory):
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) > 2:
            return httpx.Response(429, headers={"Retry-After": "60"})
        return osrm_response(request)

    with client_factory(handler) as client:
        body = {"duration_minutes": 40, "randomize": False}
        assert client.post("/routes/plan", json=body).status_code == 200
        randomized = client.post("/routes/plan", json={"duration_minutes": 40, "randomize": True})
        retry = client.post("/routes/plan", json={"duration_minutes": 40, "randomize": True})
        cached = client.post("/routes/plan", json=body)
    assert randomized.status_code == retry.status_code == 503
    assert randomized.json()["detail"]["code"] == "osrm_rate_limited"
    assert randomized.headers["Retry-After"] == "60"
    assert cached.status_code == 200 and cached.json()["source"] == "cache"
    assert len(calls) == 3


def test_randomize_default_and_openapi(client_factory):
    assert PlanRequest(duration_minutes=30).randomize is True
    assert PlanRequest(duration_minutes=30, randomize=False).randomize is False
    with client_factory() as client:
        schema = client.get("/openapi.json").json()
    field = schema["components"]["schemas"]["PlanRequest"]["properties"]["randomize"]
    assert field["type"] == "boolean" and field["default"] is True
