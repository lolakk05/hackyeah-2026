"""Opt-in live smoke test: loads local POIs and calls the public walking OSRM backend."""

import argparse
import asyncio
import json
from pathlib import Path

import httpx

from main import create_app


async def run(minutes: float, output: Path | None):
    app = create_app()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://local"
        ) as client:
            response = await client.post("/routes/plan", json={"duration_minutes": minutes})
            if response.status_code != 200:
                raise RuntimeError(f"Planning failed: {response.status_code} {response.text}")
            data = response.json()
            assert data["source"] == "osrm"
            assert 0 < data["duration_s"] <= minutes * 60
            assert data["start_poi"]["id"] != data["end_poi"]["id"]
            if output:
                output.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
            print(
                json.dumps(
                    {
                        "status": response.status_code,
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
    args = parser.parse_args()
    asyncio.run(run(args.minutes, args.output))
