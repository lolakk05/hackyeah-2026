import json

import httpx
import pytest
from fastapi.testclient import TestClient

from config import Settings
from main import create_app

POINTS = [(19.9373, 50.0617), (19.9433, 50.0617), (19.9493, 50.0617), (19.9553, 50.0617)]
TIMES = [[0, 200, 580, 700], [200, 0, 370, 500], [580, 370, 0, 300], [700, 500, 300, 0]]


def coordinates(request):
    return [
        tuple(map(float, part.split(","))) for part in request.url.path.rsplit("/", 1)[1].split(";")
    ]


def osrm_response(request, duration_override=None):
    points = coordinates(request)
    indices = [POINTS.index(p) for p in points]
    if "/table/" in request.url.path:
        return httpx.Response(
            200, json={"code": "Ok", "durations": [[TIMES[i][j] for j in indices] for i in indices]}
        )
    times = [TIMES[a][b] for a, b in zip(indices, indices[1:])]
    if duration_override is not None:
        times = [duration_override / len(times)] * len(times)
    return httpx.Response(
        200,
        json={
            "code": "Ok",
            "routes": [
                {
                    "duration": sum(times),
                    "distance": sum(times) * 1.4,
                    "geometry": {"type": "LineString", "coordinates": points},
                    "legs": [
                        {
                            "duration": t,
                            "distance": t * 1.4,
                            "steps": [
                                {
                                    "duration": t,
                                    "distance": t * 1.4,
                                    "name": "Test street",
                                    "mode": "walking",
                                    "geometry": {
                                        "type": "LineString",
                                        "coordinates": points[i : i + 2],
                                    },
                                    "maneuver": {
                                        "type": "depart",
                                        "location": points[i],
                                        "bearing_before": 0,
                                        "bearing_after": 90,
                                    },
                                },
                                {
                                    "duration": 0,
                                    "distance": 0,
                                    "name": "",
                                    "mode": "walking",
                                    "geometry": {
                                        "type": "LineString",
                                        "coordinates": [points[i + 1]],
                                    },
                                    "maneuver": {
                                        "type": "arrive",
                                        "location": points[i + 1],
                                        "bearing_before": 90,
                                        "bearing_after": 0,
                                    },
                                },
                            ],
                        }
                        for i, t in enumerate(times)
                    ],
                }
            ],
            "waypoints": [{"location": p, "distance": 0} for p in points],
        },
    )


@pytest.fixture
def poi_file(tmp_path):
    path = tmp_path / "pois.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "metadata": {"source": "test"},
                "features": [
                    {
                        "type": "Feature",
                        "id": f"p{i}",
                        "properties": {"name": f"Museum {i}", "category": "museum", "tags": {}},
                        "geometry": {"type": "Point", "coordinates": p},
                    }
                    for i, p in enumerate(POINTS)
                ],
            }
        ),
        encoding="utf-8",
    )
    return path


@pytest.fixture
def client_factory(poi_file):
    def make(handler=osrm_response, **settings):
        app = create_app(
            Settings(poi_file=poi_file, **settings), transport=httpx.MockTransport(handler)
        )
        return TestClient(app)

    return make
