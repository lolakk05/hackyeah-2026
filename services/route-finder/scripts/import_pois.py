"""Import selected central Krakow attractions, always within 1500 m of Rynek."""

import argparse
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

CENTER_LATITUDE = 50.0617
CENTER_LONGITUDE = 19.9373
MAX_RADIUS_M = 1500
EARTH_RADIUS_M = 6_371_008.8
SELECTION_VERSION = "central-attractions-v1"

# Editorial exceptions supplement the tag rules, never the radius/access exclusions.
# Museums lacking a knowledge-base reference and distinctive individual landmarks.
CURATED_POIS = {
    "way-23256528": ("historic", "Sukiennice"),
    "node-278057698": ("historic", "Smok Wawelski"),
    "node-2508026681": ("historic", "Eros spętany"),
    "node-278057695": ("cave_entrance", "Smocza Jama"),
    "way-153942974": ("theatre", "Teatr im. Juliusza Słowackiego"),
    "way-39357571": ("theatre", "Narodowy Stary Teatr"),
    "node-10573734931": ("museum", "Muzeum Dominikanów"),
    "node-1516840253": ("museum", "Pałac Biskupa Erazma Ciołka"),
    "node-5199949834": ("museum", "Żywe Muzeum Obwarzanka"),
    "node-471557838": ("museum", "Pałac Krzysztofory"),
    "node-471635664": ("museum", "Kamienica Szołayskich"),
    "node-2616212673": ("museum", "Muzeum Stanisława Wyspiańskiego"),
}

# Avoid admitting every plaque, small religious figure or arbitrary artwork.
MONUMENT_WIKIDATA = {
    "Q348381",  # Adam Mickiewicz
    "Q11823211",  # Pomnik Grunwaldzki
    "Q7674490",  # Tadeusz Kościuszko
    "Q2480782",  # Pies Dżok
    "Q7029919",  # Mikołaj Kopernik
    "Q15622244",  # Jan Matejko
    "Q11823273",  # Józef Dietl
    "Q11823397",  # Piotr Skrzynecki
    "Q11823279",  # Józef Piłsudski i Legioniści
    "Q11823456",  # Stanisław Wyspiański
    "Q11823225",  # Ignacy Jan Paderewski
    "Q11823396",  # Piotr Skarga
}

QUERY = f"""[out:json][timeout:180];
(
  nwr(around:{MAX_RADIUS_M},{CENTER_LATITUDE},{CENTER_LONGITUDE})["tourism"="museum"];
  nwr(around:{MAX_RADIUS_M},{CENTER_LATITUDE},{CENTER_LONGITUDE})["tourism"="attraction"];
  nwr(around:{MAX_RADIUS_M},{CENTER_LATITUDE},{CENTER_LONGITUDE})["historic"~"^(castle|city_gate|tower|ruins|archaeological_site|monument|memorial)$"];
  nwr(around:{MAX_RADIUS_M},{CENTER_LATITUDE},{CENTER_LONGITUDE})["amenity"="place_of_worship"];
  {"".join(f"{key.split('-')[0]}({key.split('-')[1]});" for key in CURATED_POIS)}
);
out center tags;"""


def distance_m(
    lon: float,
    lat: float,
    other_lon: float = CENTER_LONGITUDE,
    other_lat: float = CENTER_LATITUDE,
) -> float:
    """Great-circle distance; independent of OSRM and safe at the antimeridian."""
    a, b = math.radians(lat), math.radians(other_lat)
    h = (
        math.sin((a - b) / 2) ** 2
        + math.cos(a) * math.cos(b) * math.sin(math.radians(lon - other_lon) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, max(0.0, h))))


def category(tags: dict[str, str], identifier: str = "") -> str | None:
    """Conservative selection, not a claim of objective tourist importance."""
    if not (tags.get("name:pl", "").strip() or tags.get("name", "").strip()):
        return None
    if (
        tags.get("access") in {"private", "no"}
        or tags.get("foot") == "no"
        or any(tags.get(key) == "yes" for key in ("closed", "disused", "abandoned", "demolished"))
        or tags.get("leisure") in {"park", "garden", "nature_reserve"}
        or tags.get("artwork_type") in {"mural", "graffiti", "painting"}
        or tags.get("memorial") in {"plaque", "pavement_plaque", "stolperstein"}
    ):
        return None
    if identifier in CURATED_POIS:
        selected, _ = CURATED_POIS[identifier]
        # Do not keep an exception if the source object changes its purpose.
        expected = {
            "museum": tags.get("tourism") == "museum",
            "theatre": tags.get("amenity") == "theatre",
            "cave_entrance": tags.get("natural") == "cave_entrance",
            "historic": tags.get("tourism") == "attraction"
            or tags.get("artwork_type") in {"statue", "sculpture"},
        }
        if expected[selected]:
            return selected
    notable = bool(tags.get("wikidata") or tags.get("wikipedia"))
    if tags.get("tourism") == "museum" and notable:
        return "museum"
    historic = tags.get("historic")
    if (
        tags.get("amenity") == "place_of_worship"
        and notable
        and (
            historic == "church"
            or tags.get("heritage") not in {None, "no"}
            or tags.get("ref:nid")
            or tags.get("tourism") == "attraction"
            or tags.get("building") in {"cathedral", "synagogue"}
        )
    ):
        return "place_of_worship"
    if historic in {"castle", "city_gate", "tower", "ruins", "archaeological_site"} and notable:
        return "historic"
    if historic in {"monument", "memorial"} and tags.get("wikidata") in MONUMENT_WIKIDATA:
        return "historic"
    if (
        tags.get("tourism") == "attraction"
        and historic == "building"
        and tags.get("heritage") not in {None, "no"}
        and notable
    ):
        return "historic"
    return None


def select_features(features: list[dict]) -> tuple[list[dict], dict]:
    accepted = {}
    rejected = Counter()
    for feature in features:
        lon, lat = feature["geometry"]["coordinates"]
        if not (
            math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90
        ):
            raise ValueError(f"Invalid coordinates for {feature['id']}")
        if distance_m(lon, lat) > MAX_RADIUS_M:
            rejected["outside_radius"] += 1
            continue
        props = feature["properties"]
        selected = category(props.get("tags", {}), feature["id"])
        if selected is None:
            rejected["not_selected"] += 1
            continue
        if feature["id"] in accepted:
            rejected["duplicate_id"] += 1
            continue
        props["category"] = selected
        accepted[feature["id"]] = feature

    # Prefer a mapped building/complex over a second marker of the same attraction.
    ordered = sorted(
        accepted.values(),
        key=lambda f: (
            not bool(f["properties"]["tags"].get("building")),
            not f["id"].startswith("relation-"),
            f["id"],
        ),
    )
    unique = []
    for feature in ordered:
        tags = feature["properties"]["tags"]
        name = feature["properties"]["name"].strip().casefold()
        for other in unique:
            other_tags = other["properties"]["tags"]
            same_entity = any(
                tags.get(key) and tags[key] == other_tags.get(key)
                for key in ("wikidata", "wikipedia")
            )
            same_name = name == other["properties"]["name"].strip().casefold()
            separation = distance_m(
                *feature["geometry"]["coordinates"], *other["geometry"]["coordinates"]
            )
            if (same_entity and separation <= 100) or (same_name and separation <= 50):
                rejected["duplicate_place"] += 1
                break
        else:
            unique.append(feature)
    if not unique:
        raise ValueError("Empty selection; refusing to overwrite the dataset")
    return sorted(unique, key=lambda f: f["id"]), dict(rejected)


def selection_metadata(features: list[dict], rejected: dict) -> dict:
    return {
        "selection_version": SELECTION_VERSION,
        "filtered_at": datetime.now(timezone.utc).isoformat(),
        "center": {
            "name": "Rynek Główny",
            "latitude": CENTER_LATITUDE,
            "longitude": CENTER_LONGITUDE,
        },
        "max_radius_m": MAX_RADIUS_M,
        "max_selected_distance_m": max(distance_m(*f["geometry"]["coordinates"]) for f in features),
        "feature_count": len(features),
        "category_counts": dict(
            sorted(Counter(f["properties"]["category"] for f in features).items())
        ),
        "rejected_counts": rejected,
        "completeness": "Selected central Krakow attractions, not an exhaustive inventory. "
        "Every representative point is within 1500 m of Rynek Glowny. "
        "Tag rules and editorial exceptions do not verify opening hours or accessibility. "
        "Non-point objects use bounding-box centers, not verified entrances.",
    }


def convert(data: dict, endpoint: str) -> dict:
    if data.get("remark"):
        raise ValueError(f"Overpass returned an incomplete result: {data['remark']}")
    if not data["elements"]:
        raise ValueError("Empty Overpass result; refusing to overwrite the dataset")
    features = []
    for element in data["elements"]:
        location = element if element["type"] == "node" else element.get("center")
        if location is None or "lat" not in location or "lon" not in location:
            raise ValueError(f"Missing coordinates for {element['type']}/{element['id']}")
        tags = element.get("tags", {})
        features.append(
            {
                "type": "Feature",
                "id": f"{element['type']}-{element['id']}",
                "properties": {
                    "name": (tags.get("name:pl") or tags.get("name") or "").strip(),
                    "osm_url": f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
                    "coordinate_source": "node" if element["type"] == "node" else "bounds_center",
                    "tags": tags,
                },
                "geometry": {"type": "Point", "coordinates": [location["lon"], location["lat"]]},
            }
        )
    selected, rejected = select_features(features)
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
            "query": QUERY,
            **selection_metadata(selected, rejected),
        },
        "features": selected,
    }


def filter_snapshot(collection: dict) -> dict:
    """Reapply the same rules offline, preserving the original OSM fetch provenance."""
    if collection.get("type") != "FeatureCollection":
        raise ValueError("Expected a GeoJSON FeatureCollection")
    for feature in collection["features"]:
        if feature.get("type") != "Feature" or feature["geometry"].get("type") != "Point":
            raise ValueError("Snapshot must contain Point features")
    selected, rejected = select_features(collection["features"])
    metadata = dict(collection.get("metadata", {}))
    # The original query/boundary describe the downloaded source, not the filtered output.
    for key in ("query", "boundary", "boundary_url"):
        if key in metadata:
            metadata[f"source_{key}"] = metadata.pop(key)
    metadata.update(selection_metadata(selected, rejected))
    return {"type": "FeatureCollection", "metadata": metadata, "features": selected}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default="https://overpass-api.de/api/interpreter")
    parser.add_argument(
        "--input", type=Path, help="Filter an existing GeoJSON without network access"
    )
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).resolve().parents[1] / "krakow_pois.geojson"
    )
    args = parser.parse_args()
    if args.input:
        collection = filter_snapshot(json.loads(args.input.read_text(encoding="utf-8")))
    else:
        with httpx.Client(
            timeout=240, headers={"User-Agent": "KrakowRouteFinder/0.3 POI import"}
        ) as client:
            response = client.post(args.endpoint, data={"data": QUERY})
            response.raise_for_status()
            collection = convert(response.json(), args.endpoint)
    temporary = args.output.with_suffix(".geojson.tmp")
    temporary.write_text(
        json.dumps(collection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(args.output)
    print(json.dumps(collection["metadata"], ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
