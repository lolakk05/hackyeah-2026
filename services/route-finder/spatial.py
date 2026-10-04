"""Category-specific KD-trees over points on the unit sphere (not raw degrees)."""

import math
from collections import defaultdict
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from scipy.spatial import KDTree

from models import POI, Category, Coordinates

EARTH_RADIUS_M = 6_371_008.8


def unit_vector(latitude: float, longitude: float) -> tuple[float, float, float]:
    lat, lon = math.radians(latitude), math.radians(longitude)
    return math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)


def chord_to_meters(chord: float) -> float:
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, max(0.0, chord / 2)))


def same_attraction(first: POI, second: POI) -> bool:
    """Recognize nearby OSM representations of the same attraction."""
    if first.id == second.id:
        return True
    distance = chord_to_meters(
        math.dist(
            unit_vector(first.latitude, first.longitude),
            unit_vector(second.latitude, second.longitude),
        )
    )
    if distance <= 100 and any(
        first.tags.get(key) and first.tags[key] == second.tags.get(key)
        for key in ("wikidata", "wikipedia")
    ):
        return True
    first_name = " ".join(first.name.casefold().split())
    second_name = " ".join(second.name.casefold().split())
    return distance <= 50 and bool(first_name) and first_name == second_name


class PointGeometry(BaseModel):
    type: Literal["Point"]
    coordinates: Coordinates


class Properties(BaseModel):
    category: Category
    name: str = "Unnamed POI"
    id: str | int | None = None
    osm_url: str | None = None
    coordinate_source: str = "node"
    tags: dict[str, str] = Field(default_factory=dict)


class Feature(BaseModel):
    type: Literal["Feature"]
    id: str | int | None = None
    geometry: PointGeometry
    properties: Properties


class FeatureCollection(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[Feature]
    metadata: dict = Field(default_factory=dict)


class POIIndex:
    def __init__(self, pois: list[POI], metadata: dict | None = None):
        self.count = len(pois)
        self.metadata = metadata or {}
        self.all = sorted(pois, key=lambda p: p.id)
        self.by_id = {poi.id: poi for poi in pois}
        if len(self.by_id) != self.count:
            raise RuntimeError("Duplicate POI IDs in dataset")
        self._all_tree = (
            KDTree([unit_vector(p.latitude, p.longitude) for p in self.all]) if pois else None
        )
        self._pois: dict[str, list[POI]] = defaultdict(list)
        for poi in pois:
            self._pois[poi.category.casefold()].append(poi)
        self._trees = {
            category: KDTree([unit_vector(p.latitude, p.longitude) for p in points])
            for category, points in self._pois.items()
        }

    @property
    def categories(self) -> list[str]:
        return sorted(self._pois)

    @classmethod
    def load(cls, path: Path) -> "POIIndex":
        try:
            collection = FeatureCollection.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError) as exc:
            raise RuntimeError(f"Cannot load POI GeoJSON from {path}: {exc}") from exc
        pois = []
        for i, feature in enumerate(collection.features):
            lon, lat = feature.geometry.coordinates
            identifier = feature.id if feature.id is not None else feature.properties.id
            pois.append(
                POI(
                    id=str(identifier if identifier is not None else i),
                    name=feature.properties.name,
                    category=feature.properties.category.casefold(),
                    latitude=lat,
                    longitude=lon,
                    osm_url=feature.properties.osm_url,
                    coordinate_source=feature.properties.coordinate_source,
                    tags=feature.properties.tags,
                )
            )
        return cls(pois, collection.metadata)

    def within(
        self, latitude: float, longitude: float, radius_m: float, category: str | None = None
    ) -> list[tuple[POI, float]]:
        if self._all_tree is None:
            return []
        origin = unit_vector(latitude, longitude)
        chord = 2 * math.sin(min(math.pi, radius_m / EARTH_RADIUS_M) / 2)
        indices = self._all_tree.query_ball_point(origin, chord)
        key = category.strip().casefold() if category else None
        points = [
            (
                self.all[i],
                chord_to_meters(
                    math.dist(origin, unit_vector(self.all[i].latitude, self.all[i].longitude))
                ),
            )
            for i in indices
            if key is None or self.all[i].category.casefold() == key
        ]
        return sorted(points, key=lambda entry: (entry[1], entry[0].id))

    def nearest(self, latitude: float, longitude: float, category: str) -> tuple[POI, float] | None:
        key = category.strip().casefold()
        tree = self._trees.get(key)
        if tree is None:
            return None
        chord, index = tree.query(unit_vector(latitude, longitude), k=1)
        return self._pois[key][int(index)], chord_to_meters(float(chord))
