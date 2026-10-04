"""Record two real OSRM foot routes for an offline, explicitly simulated demo."""

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from config import Settings
from routing import OSRMRouter

from .smart_city import DemoSnapshot, validate_snapshot

START = (19.9375, 50.0614)
END = (19.9346, 50.0547)
OBSTACLE = (19.9380, 50.0584)
VARIANTS = [
    ("direct", "Przez Grodzką", [START, OBSTACLE, END]),
    (
        "planty",
        "Obejście przez zachodnie Planty",
        [START, (19.9328, 50.0590), (19.9322, 50.0550), END],
    ),
]


async def main():
    settings = Settings.from_env()
    output = Path(__file__).with_name("data") / "rynek_wawel_routes.json"
    variants = []
    async with httpx.AsyncClient(
        headers={"User-Agent": "KrakowRouteFinder/0.2 demo preparation"}
    ) as client:
        router = OSRMRouter(client, settings)
        for identifier, name, coordinates in VARIANTS:
            route, waypoints = await router.route_points(coordinates)
            variants.append(
                {
                    "id": identifier,
                    "name": name,
                    "distance_m": route.distance,
                    "duration_s": route.duration,
                    "geometry": route.geometry.model_dump(mode="json"),
                    "via_coordinates": coordinates,
                    "snapped_waypoints": [w.model_dump(mode="json") for w in waypoints],
                }
            )
    snapshot = {
        "scenario_id": "rynek_wawel",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "osrm_base_url": str(settings.osrm_base_url),
        "start": {
            "name": "Rynek Główny — południowa część",
            "longitude": START[0],
            "latitude": START[1],
        },
        "end": {
            "name": "Wawel — okolice Podzamcza, poza wnętrzem zamku",
            "longitude": END[0],
            "latitude": END[1],
        },
        "obstacle": {
            "id": "grodzka",
            "name": "Symulowana przeszkoda na Grodzkiej",
            "location": {"longitude": OBSTACLE[0], "latitude": OBSTACLE[1]},
            "radius_m": 35,
        },
        "variants": variants,
        "attribution": "© OpenStreetMap contributors; routing by OSRM / FOSSGIS",
    }
    # Keep the previous fixture if either route fails validation or avoids the wrong area.
    validate_snapshot(DemoSnapshot.model_validate(snapshot))
    output.parent.mkdir(exist_ok=True)
    temporary = output.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(output)
    print(
        json.dumps(
            {
                "output": str(output),
                "variants": [
                    {
                        "id": v["id"],
                        "distance_m": v["distance_m"],
                        "duration_s": v["duration_s"],
                        "geometry_points": len(v["geometry"]["coordinates"]),
                    }
                    for v in variants
                ],
            }
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
