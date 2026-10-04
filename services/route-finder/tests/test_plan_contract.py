"""Regression coverage for distinct attractions, language and remote user starts."""

import json

import httpx
import pytest

from spatial import same_attraction
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


@pytest.mark.parametrize("minutes,status", [(90, 200), (30, 404)])
def test_tauron_start_includes_approach_and_respects_budget(
    client_factory, monkeypatch, minutes, status
):
    origin = (19.9905833, 50.0668889)
    monkeypatch.setattr(conftest, "POINTS", [*conftest.POINTS, origin])
    times = [row + [2400] for row in conftest.TIMES] + [[2400] * 4 + [0]]
    monkeypatch.setattr(conftest, "TIMES", times)
    with client_factory() as client:
        assert client.app.state.poi_index.within(origin[1], origin[0], 2000) == []
        response = client.post(
            "/routes/plan",
            json={
                "duration_minutes": minutes,
                "start_mode": "user",
                "language": "en",
                "user_location": {"latitude": origin[1], "longitude": origin[0]},
            },
        )
        assert response.status_code == status, response.text
        result = response.json()
        if status == 404:
            assert result["detail"]["code"] == "no_route_within_budget"
            return
        assert result["start"]["mode"] == "user"
        assert result["start"]["approach_included"] is True
        assert result["geometry"]["coordinates"][0] == list(origin)
        assert result["snapped_waypoints"][0]["poi_id"] is None
        assert result["legs"][0]["kind"] == "approach"
        assert result["legs"][0]["duration_s"] == 2400
        assert result["stops"][0]["arrival_duration_s"] == 2400
        assert result["duration_s"] == sum(leg["duration_s"] for leg in result["legs"])
        assert result["duration_s"] <= minutes * 60


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
