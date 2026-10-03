"""Refresh the local Krakow OSM snapshot; never called by the running API."""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

QUERY = """[out:json][timeout:180];
area(3600449696)->.city;
(
  nwr(area.city)["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork)$"];
  nwr(area.city)["historic"]["historic"!="no"];
  nwr(area.city)["amenity"~"^(place_of_worship|theatre|arts_centre|planetarium)$"];
  nwr(area.city)["leisure"~"^(park|nature_reserve)$"];
  nwr(area.city)["leisure"="garden"]["name"];
  nwr(area.city)["leisure"="garden"]["garden:type"~"^(botanical|arboretum)$"];
  nwr(area.city)["natural"="cave_entrance"];
);
out center tags;"""


def category(tags: dict[str, str]) -> str:
    if tags.get("tourism") in {
        "attraction",
        "museum",
        "gallery",
        "viewpoint",
        "zoo",
        "theme_park",
        "aquarium",
        "artwork",
    }:
        return tags["tourism"]
    if tags.get("historic") not in {None, "no"}:
        return "historic"
    if tags.get("amenity") in {"place_of_worship", "theatre", "arts_centre", "planetarium"}:
        return tags["amenity"]
    if "leisure" in tags:
        return tags["leisure"]
    return "cave_entrance"


def convert(data: dict, endpoint: str) -> dict:
    if data.get("remark"):
        raise ValueError(f"Overpass returned an incomplete result: {data['remark']}")
    elements = data["elements"]
    if not elements:
        raise ValueError("Empty Overpass result; refusing to overwrite the dataset")
    features = {}
    for element in elements:
        location = element if element["type"] == "node" else element.get("center")
        if location is None:
            raise ValueError(f"Missing coordinates for {element['type']}/{element['id']}")
        tags = element.get("tags", {})
        key = f"{element['type']}-{element['id']}"
        features[key] = {
            "type": "Feature",
            "id": key,
            "properties": {
                "name": tags.get("name:pl") or tags.get("name") or f"{category(tags)} ({key})",
                "category": category(tags),
                "osm_url": f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
                "coordinate_source": "node" if element["type"] == "node" else "bounds_center",
                "tags": tags,
            },
            "geometry": {"type": "Point", "coordinates": [location["lon"], location["lat"]]},
        }
    ordered = sorted(features.values(), key=lambda f: f["id"])
    return {
        "type": "FeatureCollection",
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "source_url": endpoint,
            "license": "ODbL-1.0",
            "license_url": "https://www.openstreetmap.org/copyright",
            "attribution": "© OpenStreetMap contributors",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "osm_base_timestamp": data.get("osm3s", {}).get("timestamp_osm_base"),
            "boundary": "Kraków, administrative boundary, OSM relation 449696",
            "boundary_url": "https://www.openstreetmap.org/relation/449696",
            "query": QUERY,
            "feature_count": len(ordered),
            "category_counts": dict(
                sorted(Counter(feature["properties"]["category"] for feature in ordered).items())
            ),
            "completeness": "All objects returned by the recorded OSM query at export time; "
            "not a guarantee of all real-world tourist attractions. Separate OSM objects may "
            "describe the same attraction. Non-point objects use bounding-box centers, "
            "not verified entrances. Access and opening hours are not independently verified.",
        },
        "features": ordered,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default="https://overpass-api.de/api/interpreter")
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).resolve().parents[1] / "krakow_pois.geojson"
    )
    args = parser.parse_args()
    with httpx.Client(
        timeout=240, headers={"User-Agent": "KrakowRouteFinder/0.2 POI import"}
    ) as client:
        response = client.post(args.endpoint, data={"data": QUERY})
        response.raise_for_status()
        collection = convert(response.json(), args.endpoint)
    temporary = args.output.with_suffix(".geojson.tmp")
    temporary.write_text(
        json.dumps(collection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(args.output)
    print(json.dumps(collection["metadata"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
