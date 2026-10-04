"""Regression coverage for distinct attractions, language and remote user starts."""

import json
import math

import httpx
import pytest

from models import PlanRequest
from planner import user_start_too_far
from spatial import EARTH_RADIUS_M, same_attraction
from tests import conftest


@pytest.mark.parametrize(
    "language,expected",
    [
        ("pl", "pl"),
        ("polish", "pl"),
        ("en", "en"),
        ("english", "en"),
    ],
)
def test_localized_plan_preserves_catalog_and_navigation(
    client_factory, poi_file, language, expected
):
    data = json.loads(poi_file.read_text())
    data["features"][0]["properties"].update(
        name="Muzeum", tags={"name:pl": "Muzeum Polskie", "name:en": "Polish Museum"}
    )
    poi_file.write_text(json.dumps(data), encoding="utf-8")
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": 15,
                "language": language,
                "randomize": False,
            },
        )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["language"] == expected
        assert result["start_poi"]["name"] == (
            "Polish Museum" if expected == "en" else "Muzeum Polskie"
        )
        assert result["warnings"][0] == (
            "Travel time does not include sightseeing!"
            if expected == "en"
            else "Czas podróży nie uwzględnia zwiedzania!"
        )
        pois = [result["start_poi"], *result["intermediate_pois"], result["end_poi"]]
        assert pois == [stop["poi"] for stop in result["stops"]]
        assert result["end_poi"]["name"].startswith("Museum ")  # No translation: original.
        assert client.get("/pois/p0").json()["name"] == "Muzeum"
        assert result["legs"][0]["steps"][0]["maneuver"]["type"] == "depart"


def test_language_cache_isolation_and_alias_normalization(client_factory):
    with client_factory() as client:
        body = {"duration_minutes": 15, "randomize": False}
        for language, source, expected in [
            ("pl", "osrm", "pl"),
            ("en", "osrm", "en"),
            ("english", "cache", "en"),
            ("polish", "cache", "pl"),
        ]:
            response = client.post("/routes/plan", json={**body, "language": language})
            assert response.status_code == 200, response.text
            assert response.json()["language"] == expected
            assert response.json()["source"] == source


@pytest.mark.parametrize("language", ["de", "", None, 1, ["pl"]])
def test_invalid_language_rejected(client_factory, language):
    with client_factory() as client:
        response = client.post("/routes/plan", json={"duration_minutes": 15, "language": language})
        assert response.status_code == 422


def test_english_domain_errors_and_cooldown(client_factory):
    with client_factory(lambda _: httpx.Response(429, headers={"Retry-After": "7"})) as client:
        body = {"duration_minutes": 15, "language": "english"}
        missing = client.post("/routes/plan", json={**body, "start_poi_id": "missing"})
        assert missing.status_code == 404
        assert missing.json()["detail"]["message"].startswith("The starting POI")
        limited = client.post("/routes/plan", json=body)
        assert limited.status_code == 503
        assert limited.json()["detail"]["code"] == "osrm_rate_limited"
        assert limited.json()["detail"]["message"].startswith("OSRM could not")
        assert limited.headers["Retry-After"] == "7"


@pytest.mark.parametrize("randomize", [False, True])
@pytest.mark.parametrize("identity", ["name", "wikidata", "wikipedia"])
def test_duplicate_osm_attractions_never_reach_routing(
    client_factory, poi_file, identity, randomize
):
    data = json.loads(poi_file.read_text())
    for index in (0, 1):
        original = data["features"][index]
        duplicate = json.loads(json.dumps(original))
        duplicate["id"] = f"duplicate-{index}"
        duplicate["geometry"]["coordinates"][0] += 0.0004  # ~29 m; beyond the 20 m filter.
        if identity == "name":
            duplicate["properties"]["name"] = f"  MUSEUM   {index}  "
        else:
            original["properties"]["tags"][identity] = f"entity-{index}"
            duplicate["properties"]["tags"][identity] = f"entity-{index}"
            duplicate["properties"]["name"] = f"Alternative name {index}"
        data["features"].append(duplicate)
    poi_file.write_text(json.dumps(data), encoding="utf-8")
    # The transport only accepts original coordinates: routing a duplicate fails this test.
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": 30,
                "randomize": randomize,
                "max_intermediate_stops": 10,
            },
        )
        assert response.status_code == 200, response.text
        result = response.json()
        ids = [stop["poi"]["id"] for stop in result["stops"]]
        assert len(ids) == len(set(ids)) == 4
        assert not any(identifier.startswith("duplicate") for identifier in ids)
        assert result["candidates_considered"] == 3
        assert [leg["to_poi_id"] for leg in result["legs"]] == ids[1:]


def test_dedup_keeps_distinct_nearby_places_and_distant_branches(client_factory):
    with client_factory() as client:
        original = client.app.state.poi_index.by_id["p0"]
        nearby = original.model_copy(update={"id": "other", "name": "Different attraction"})
        distant = original.model_copy(update={"id": "branch", "longitude": 19.95})
        assert not same_attraction(original, nearby)
        assert not same_attraction(original, distant)


@pytest.mark.parametrize("language", ["pl", "en"])
@pytest.mark.parametrize("location_field", ["user_location", "start_location"])
def test_tauron_start_falls_back_to_market(client_factory, language, location_field):
    origin = (19.9905833, 50.0668889)
    # Transport knows only central POIs: forwarding the remote origin would fail.
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": 15,
                "language": language,
                location_field: {"latitude": origin[1], "longitude": origin[0]},
            },
        )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["start"]["mode"] == "market"
        assert result["start"]["fallback_reason"] == "user_too_far_from_market"
        assert result["start"]["requested_location"] == {"latitude": 50.0617, "longitude": 19.9373}
        assert result["geometry"]["coordinates"][0] == [19.9373, 50.0617]
        assert list(origin) not in result["geometry"]["coordinates"]
        assert result["warnings"][1].startswith(
            "Jesteś za daleko" if language == "pl" else "You are too far"
        )
        assert result["duration_s"] == sum(leg["duration_s"] for leg in result["legs"])
        assert result["duration_s"] <= 900


@pytest.mark.parametrize("distance,fallback", [(1499.99, False), (1500, False), (1500.01, True)])
def test_user_start_radius_boundary(distance, fallback):
    latitude = 50.0617 + math.degrees(distance / EARTH_RADIUS_M)
    request = PlanRequest(
        duration_minutes=30,
        user_location={
            "latitude": latitude,
            "longitude": 19.9373,
        },
    )
    assert user_start_too_far(request) is fallback


def test_nearby_user_keeps_origin_and_approach(client_factory, monkeypatch):
    origin = (19.938, 50.0617)
    monkeypatch.setattr(conftest, "POINTS", [*conftest.POINTS, origin])
    times = [row + [60] for row in conftest.TIMES] + [[60] * 4 + [0]]
    monkeypatch.setattr(conftest, "TIMES", times)
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": 15,
                "start_mode": "user",
                "user_location": {"latitude": origin[1], "longitude": origin[0]},
            },
        )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["start"]["mode"] == "user"
        assert result["start"]["fallback_reason"] is None
        assert result["geometry"]["coordinates"][0] == list(origin)
        assert result["legs"][0]["kind"] == "approach"
        assert result["stops"][0]["arrival_duration_s"] == 60


def test_fallback_cache_does_not_leak_warning_to_market(client_factory):
    with client_factory() as client:
        body = {"duration_minutes": 15, "randomize": False, "language": "en"}
        far_body = {
            **body,
            "start_mode": "user",
            "user_location": {
                "latitude": 0,
                "longitude": 0,
            },
        }
        for payload, source, reason in [
            (far_body, "osrm", "user_too_far_from_market"),
            (far_body, "cache", "user_too_far_from_market"),
            (body, "osrm", None),
            (body, "cache", None),
        ]:
            response = client.post("/routes/plan", json=payload)
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["source"] == source
            assert result["start"]["fallback_reason"] == reason
            assert any("You are too far" in warning for warning in result["warnings"]) == bool(
                reason
            )


def test_fallback_preserves_routing_preferences(client_factory):
    with client_factory() as client:
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": 15,
                "user_location": {"latitude": 0, "longitude": 0},
                "wheelchair": True,
            },
        )
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "routing_profile_not_configured"


def test_explicit_poi_outside_radius_is_not_replaced(client_factory, poi_file, monkeypatch):
    data = json.loads(poi_file.read_text())
    origin = (19.9905833, 50.0668889)
    data["features"][0]["geometry"]["coordinates"] = origin
    poi_file.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(conftest, "POINTS", [origin, *conftest.POINTS[1:]])
    with client_factory() as client:
        response = client.post("/routes/plan", json={"duration_minutes": 60, "start_poi_id": "p0"})
        assert response.status_code == 200, response.text
        assert response.json()["start"]["mode"] == "poi"
        assert response.json()["start"]["fallback_reason"] is None
        assert response.json()["geometry"]["coordinates"][0] == list(origin)


@pytest.mark.parametrize("start", [{}, {"start_mode": "market"}])
def test_market_start_is_preserved(client_factory, start):
    with client_factory() as client:
        response = client.post("/routes/plan", json={"duration_minutes": 15, **start})
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["language"] == "pl"
        assert result["start"]["mode"] == "market"
        assert result["start"]["requested_location"] == {"latitude": 50.0617, "longitude": 19.9373}
        assert result["geometry"]["coordinates"][0] == [19.9373, 50.0617]
