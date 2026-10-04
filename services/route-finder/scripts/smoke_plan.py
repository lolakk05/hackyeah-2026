"""Opt-in live smoke test: loads local POIs and calls the public walking OSRM backend."""

import argparse
import asyncio
import json
from pathlib import Path

import httpx

from main import create_app
from models import PlanRequest


async def run(
    minutes: float,
    output: Path | None,
    latitude: float | None = None,
    longitude: float | None = None,
    language: str = "pl",
):
    body = {"duration_minutes": minutes, "language": language}
    if latitude is not None and longitude is not None:
        body.update(start_mode="user", user_location={"latitude": latitude, "longitude": longitude})
    request = PlanRequest.model_validate(body)
    app = create_app()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://local"
        ) as client:
            response = await client.post("/routes/plan", json=request.model_dump(mode="json"))
            if response.status_code != 200:
                raise RuntimeError(f"Planning failed: {response.status_code} {response.text}")
            data = response.json()
            assert data["source"] == "osrm"
            assert 0 < data["duration_s"] <= minutes * 60
            assert data["start_poi"]["id"] != data["end_poi"]["id"]
            ids = [stop["poi"]["id"] for stop in data["stops"]]
            assert len(ids) == len(set(ids))
            assert data["language"] == request.language
            assert abs(data["duration_s"] - sum(leg["duration_s"] for leg in data["legs"])) < 1
            assert data["geometry"]["coordinates"][0] == data["start"]["snapped_location"]
            assert data["geometry"]["coordinates"][-1] == data["stops"][-1]["snapped_location"]
            if data["start"]["fallback_reason"] == "user_too_far_from_market":
                assert data["start"]["mode"] == "market"
                assert data["start"]["requested_location"] == {
                    "latitude": 50.0617,
                    "longitude": 19.9373,
                }
            elif request.user_location:
                assert data["start"]["requested_location"] == request.user_location.model_dump()
                assert data["start"]["mode"] == "user"
            if output:
                output.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
            print(
                json.dumps(
                    {
                        "status": response.status_code,
                        "language": data["language"],
                        "origin": data["start"],
                        "loaded_pois": app.state.poi_index.count,
                        "start": data["start_poi"]["name"],
                        "end": data["end_poi"]["name"],
                        "stops": [p["name"] for p in data["intermediate_pois"]],
                        "duration_s": data["duration_s"],
                        "distance_m": data["distance_m"],
                        "matches_target": data["matches_target"],
                        "geometry_points": len(data["geometry"]["coordinates"]),
                        "warnings": data["warnings"],
                    },
                    ensure_ascii=False,
                )
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minutes", type=float, default=30)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--latitude", type=float)
    parser.add_argument("--longitude", type=float)
    parser.add_argument("--language", choices=["pl", "en", "polish", "english"], default="pl")
    args = parser.parse_args()
    if (args.latitude is None) != (args.longitude is None):
        parser.error("--latitude and --longitude must be provided together")
    asyncio.run(run(args.minutes, args.output, args.latitude, args.longitude, args.language))
