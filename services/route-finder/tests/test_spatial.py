import json
import math
from collections import Counter
from pathlib import Path

import pytest

from models import POI, PlanRequest
from planner import Planner
from scripts.import_pois import convert
from spatial import EARTH_RADIUS_M, POIIndex


def test_spherical_distance_and_category():
    points = [
        POI(id="east", name="East", category="museum", latitude=60, longitude=1),
        POI(id="north", name="North", category="museum", latitude=60.6, longitude=0),
        POI(id="other", name="Other", category="park", latitude=60, longitude=0),
    ]
    index = POIIndex(points)
    poi, distance = index.nearest(60, 0, " MUSEUM ")
    assert poi.id == "east"
    assert 55_000 < distance < 56_000
    assert index.within(60, 0, distance - 0.01, "museum") == []
    assert index.within(60, 0, distance + 0.01, "museum")[0][0].id == "east"


def test_antimeridian():
    poi = POI(id="p", name="p", category="museum", latitude=0, longitude=-179.9)
    _, distance = POIIndex([poi]).nearest(0, 179.9, "museum")
    assert distance == pytest.approx(EARTH_RADIUS_M * math.radians(0.2))


def test_invalid_and_missing_dataset(tmp_path):
    path = tmp_path / "missing.json"
    with pytest.raises(RuntimeError, match="Cannot load"):
        POIIndex.load(path)
    path.write_text('{"type":"FeatureCollection"}', encoding="utf-8")
    with pytest.raises(RuntimeError, match="Cannot load"):
        POIIndex.load(path)
    path.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
    assert POIIndex.load(path).count == 0


def test_duplicate_ids_rejected(poi_file):
    data = json.loads(poi_file.read_text())
    data["features"][1]["id"] = "p0"
    poi_file.write_text(json.dumps(data))
    with pytest.raises(RuntimeError, match="Duplicate"):
        POIIndex.load(poi_file)


def test_paths_never_repeat_poi_or_exceed_budget():
    matrix = [[0, 100, 200, 300], [100, 0, 100, 200], [200, 100, 0, 100], [300, 200, 100, 0]]
    paths = Planner._paths(matrix, PlanRequest(duration_minutes=5, max_intermediate_stops=2))
    assert paths
    assert len(paths[0]) == 4
    for path in paths:
        assert len(path) == len(set(path))
        assert sum(matrix[a][b] for a, b in zip(path, path[1:])) <= 300


def test_import_metadata_categories_and_partial_results():
    element = {
        "type": "way",
        "id": 123,
        "center": {"lat": 50, "lon": 19},
        "tags": {"leisure": "garden", "amenity": "bench", "name": "Garden"},
    }
    result = convert({"elements": [element, element]}, "https://example.test")
    assert len(result["features"]) == 1
    feature = result["features"][0]
    assert feature["properties"]["category"] == "garden"
    assert feature["properties"]["coordinate_source"] == "bounds_center"
    assert result["metadata"]["license"] == "ODbL-1.0"
    with pytest.raises(ValueError, match="incomplete"):
        convert({"remark": "runtime error", "elements": [element]}, "test")


def test_bundled_snapshot_matches_metadata():
    index = POIIndex.load(Path(__file__).resolve().parents[1] / "krakow_pois.geojson")
    assert index.count == index.metadata["feature_count"]
    assert Counter(p.category for p in index.all) == index.metadata["category_counts"]
    assert index.metadata["license"] == "ODbL-1.0"
    assert all(p.osm_url for p in index.all)
