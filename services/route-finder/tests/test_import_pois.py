import copy
import json
import math
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.import_pois import (
    CENTER_LATITUDE,
    CENTER_LONGITUDE,
    EARTH_RADIUS_M,
    MAX_RADIUS_M,
    convert,
    filter_snapshot,
)
from spatial import POIIndex

ROOT = Path(__file__).resolve().parents[1]


def element(identifier=1, *, distance=0, tags=None, kind="node"):
    location = {
        "lat": CENTER_LATITUDE + math.degrees(distance / EARTH_RADIUS_M),
        "lon": CENTER_LONGITUDE,
    }
    return {
        "type": kind,
        "id": identifier,
        **(location if kind == "node" else {"center": location}),
        "tags": tags
        if tags is not None
        else {"name": f"Museum {identifier}", "tourism": "museum", "wikidata": f"Q{identifier}"},
    }


def collection(*elements):
    return convert({"elements": list(elements)}, "https://example.test")


def test_radius_checks_representative_points_including_curated_exceptions():
    result = collection(
        element(1, distance=1499.99),
        element(2, distance=1500.01),
        element(3, distance=1501, kind="way"),
        element(
            23256528,
            distance=1501,
            kind="way",
            tags={"name": "Sukiennice", "tourism": "attraction"},
        ),
    )
    assert [f["id"] for f in result["features"]] == ["node-1"]
    assert result["metadata"]["rejected_counts"]["outside_radius"] == 3


@pytest.mark.parametrize(
    "tags",
    [
        {"name": "Park", "leisure": "park", "tourism": "museum", "wikidata": "Q2"},
        {"name": "Mural", "tourism": "artwork", "artwork_type": "mural", "wikidata": "Q2"},
        {"name": "Paint", "tourism": "artwork", "artwork_type": "graffiti"},
        {"name": "Plaque", "historic": "memorial", "memorial": "plaque", "wikidata": "Q348381"},
        {"name": "Small figure", "historic": "memorial", "memorial": "statue", "wikidata": "Q2"},
        {"name": "House", "historic": "building", "wikidata": "Q2"},
        {"name": "Random attraction", "tourism": "attraction", "wikidata": "Q2"},
        {"name": "Unreviewed museum", "tourism": "museum"},
        {"name": "Office worship", "amenity": "place_of_worship", "wikidata": "Q2"},
        {"tourism": "museum", "wikidata": "Q2"},
        {"name": "   ", "tourism": "museum", "wikidata": "Q2"},
    ],
)
def test_excludes_noise_even_with_a_name_or_knowledge_reference(tags):
    result = collection(element(), element(2, tags=tags))
    assert [f["id"] for f in result["features"]] == ["node-1"]


@pytest.mark.parametrize(
    "restriction",
    [
        {"access": "private"},
        {"access": "no"},
        {"foot": "no"},
        {"closed": "yes"},
        {"disused": "yes"},
        {"abandoned": "yes"},
    ],
)
def test_restrictions_override_editorial_exception(restriction):
    tags = {"name": "Muzeum Dominikanow", "tourism": "museum", **restriction}
    assert len(collection(element(), element(10573734931, tags=tags))["features"]) == 1


def test_keeps_recognizable_sculpture_but_not_arbitrary_art():
    tags = {"name": "Smok Wawelski", "tourism": "artwork", "artwork_type": "statue"}
    result = collection(element(278057698, tags=tags), element(2, tags=tags))
    assert [f["id"] for f in result["features"]] == ["node-278057698"]
    assert result["features"][0]["properties"]["category"] == "historic"


def test_deduplicates_same_nearby_entity_but_keeps_distant_branches():
    tags = {"name": "Museum", "tourism": "museum", "wikidata": "Q100"}
    result = collection(
        element(1, tags=tags),
        element(2, distance=10, kind="way", tags={**tags, "building": "museum"}),
        element(3, distance=500, tags=tags),
        element(4, distance=20, tags={**tags, "name": "Separate exhibition", "wikidata": "Q101"}),
    )
    assert {f["id"] for f in result["features"]} == {"way-2", "node-3", "node-4"}
    assert result["metadata"]["rejected_counts"]["duplicate_place"] == 1


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), 91])
def test_rejects_invalid_coordinates(invalid):
    bad = element(2)
    bad["lat"] = invalid
    with pytest.raises(ValueError, match="Invalid coordinates"):
        collection(element(), bad)


def test_rejects_missing_geometry_and_empty_selection():
    with pytest.raises(ValueError, match="Missing coordinates"):
        collection(element(), {"type": "way", "id": 2, "tags": {}})
    with pytest.raises(ValueError, match="Empty selection"):
        collection(element(distance=2000))


def test_offline_filter_preserves_provenance_and_is_repeatable():
    original = collection(element())
    original["metadata"].update({"fetched_at": "2020-01-01", "boundary": "old city boundary"})
    original["features"].append(
        {
            "type": "Feature",
            "id": "node-2",
            "properties": {"name": "Park", "category": "park", "tags": {"leisure": "park"}},
            "geometry": {"type": "Point", "coordinates": [CENTER_LONGITUDE, CENTER_LATITUDE]},
        }
    )
    result = filter_snapshot(copy.deepcopy(original))
    assert len(result["features"]) == 1
    assert result["metadata"]["fetched_at"] == "2020-01-01"
    assert result["metadata"]["source_query"] == original["metadata"]["query"]
    assert "boundary" not in result["metadata"]
    assert result["metadata"]["source_boundary"] == "old city boundary"
    assert filter_snapshot(copy.deepcopy(result))["features"] == result["features"]


def test_cli_preserves_destination_when_filter_leaves_nothing(tmp_path):
    source = tmp_path / "source.geojson"
    output = tmp_path / "kept.geojson"
    source.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
    output.write_text("existing data", encoding="utf-8")
    process = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/import_pois.py"),
            "--input",
            str(source),
            "--output",
            str(output),
        ],
        capture_output=True,
        text=True,
    )
    assert process.returncode != 0
    assert "Empty selection" in process.stderr
    assert output.read_text(encoding="utf-8") == "existing data"


def test_bundled_points_obey_radius_and_keep_landmarks():
    index = POIIndex.load(ROOT / "krakow_pois.geojson")
    assert index.count > 30
    # Independent distance check using the spatial index used by the API.
    assert len(index.within(CENTER_LATITUDE, CENTER_LONGITUDE, MAX_RADIUS_M)) == index.count
    assert not {"park", "garden", "artwork", "gallery"}.intersection(index.categories)
    assert {
        "way-23256528",
        "relation-2270819",
        "node-278057698",
        "way-26195267",
        "way-39357538",
        "relation-13562708",
    } <= set(index.by_id)
    assert "way-785550415" not in index.by_id  # duplicate Wawel marker
    data = json.loads((ROOT / "krakow_pois.geojson").read_text(encoding="utf-8"))
    assert filter_snapshot(data)["features"] == data["features"]
