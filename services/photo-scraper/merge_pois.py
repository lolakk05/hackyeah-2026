#!/usr/bin/env python3

import argparse
import json
import uuid
from pathlib import Path


# Stały namespace dla naszego projektu.
# Dzięki temu UUID dla tego samego POI będzie zawsze taki sam.
NAMESPACE = uuid.uuid5(
    uuid.NAMESPACE_URL,
    "https://github.com/lolakk05/hackyeah-2026/pois",
)


def generate_uuid(poi_id: str) -> str:
    """
    Generuje deterministyczny UUID v5.

    Ten sam id -> zawsze ten sam UUID.
    """
    return str(uuid.uuid5(NAMESPACE, poi_id))


def main():
    parser = argparse.ArgumentParser(
        description="Łączy geocoded POIs ze zdjęciami Wikimedia."
    )

    parser.add_argument(
        "--input",
        default="krakow_pois_geocoded.json",
        help="Geocoded JSON z POI",
    )

    parser.add_argument(
        "--photos",
        default="output/photos.json",
        help="Wynik scraper.py",
    )

    parser.add_argument(
        "--out",
        default="output/pois.json",
        help="Finalny plik",
    )

    args = parser.parse_args()

    # ----------------------------------------
    # POI
    # ----------------------------------------

    pois = json.loads(
        Path(args.input).read_text(
            encoding="utf-8"
        )
    )

    if not isinstance(pois, list):
        raise ValueError(
            "Input POI musi być tablicą JSON."
        )

    # ----------------------------------------
    # Photos
    # ----------------------------------------

    photos_data = json.loads(
        Path(args.photos).read_text(
            encoding="utf-8"
        )
    )

    photo_places = photos_data.get(
        "places",
        []
    )

    photos_by_id = {
        str(place["id"]): place.get(
            "photos",
            []
        )
        for place in photo_places
    }

    # ----------------------------------------
    # Merge
    # ----------------------------------------

    result = []

    for poi in pois:
        poi_id = str(poi["id"])

        photos = photos_by_id.get(
            poi_id,
            []
        )

        # Możemy ograniczyć rekord zdjęcia
        # do rzeczy potrzebnych frontendowi/API.
        simplified_photos = [
            {
                "url": photo.get("url"),
                "page": photo.get("page"),
                "title": photo.get("title"),
                "author": photo.get("author"),
                "license": photo.get("license"),
                "licenseUrl": photo.get(
                    "licenseUrl"
                ),
                "attribution": photo.get(
                    "attribution"
                ),
            }
            for photo in photos
        ]

        result.append(
            {
                "uuid": generate_uuid(
                    poi_id
                ),
                "id": poi_id,
                "name": poi["name"],
                "category": poi.get(
                    "category"
                ),
                "aliases": poi.get(
                    "aliases",
                    []
                ),
                "latitude": poi.get(
                    "latitude"
                ),
                "longitude": poi.get(
                    "longitude"
                ),
                "photos": simplified_photos,
            }
        )

    # ----------------------------------------
    # Save
    # ----------------------------------------

    output = Path(args.out)

    output.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print(
        f"Gotowe: {output}"
    )

    print(
        f"POI: {len(result)}"
    )

    with_photos = sum(
        1
        for poi in result
        if poi["photos"]
    )

    print(
        f"POI ze zdjęciami: {with_photos}"
    )


if __name__ == "__main__":
    main()