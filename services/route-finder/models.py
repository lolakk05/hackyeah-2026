from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    StringConstraints,
    field_validator,
    model_validator,
)

Latitude = Annotated[FiniteFloat, Field(ge=-90, le=90)]
Longitude = Annotated[FiniteFloat, Field(ge=-180, le=180)]
Coordinates = tuple[Longitude, Latitude]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Language = Literal["pl", "en"]


class POI(BaseModel):
    id: str
    name: str
    category: Category
    latitude: Latitude
    longitude: Longitude
    osm_url: str | None = None
    coordinate_source: str = "node"
    tags: dict[str, str] = Field(default_factory=dict)

    @property
    def route_eligible(self) -> bool:
        return self.tags.get("access") not in {"private", "no"} and self.tags.get("foot") != "no"


class LineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[Coordinates] = Field(min_length=2)


class RouteResponse(BaseModel):
    poi: POI
    poi_distance_m: Annotated[FiniteFloat, Field(ge=0)]
    distance_m: Annotated[FiniteFloat, Field(ge=0)]
    duration_s: Annotated[FiniteFloat, Field(ge=0)]
    geometry: LineString
    source: Literal["osrm", "straight_line"]
    is_estimate: bool
    fallback_reason: str | None = None
    warning: str | None = None
    attribution: str = "© OpenStreetMap contributors; routing by OSRM / FOSSGIS"


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude: Latitude = Field(description="Szerokość geograficzna WGS84.")
    longitude: Longitude = Field(description="Długość geograficzna WGS84.")


class PlanRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "duration_minutes": 30,
                    "start_mode": "user",
                    "user_location": {"latitude": 50.0617, "longitude": 19.9373},
                    "wheelchair": True,
                    "avoid_stairs": False,
                    "max_intermediate_stops": 8,
                    "randomize": True,
                    "language": "pl",
                },
            ]
        },
    )
    duration_minutes: Annotated[FiniteFloat, Field(ge=5, le=360)] = Field(
        description="Maksymalny czas marszu w minutach (5–360); "
        "obejmuje dojście od punktu startowego do pierwszego POI, bez zwiedzania."
    )
    language: Language = Field(
        default="pl",
        description="Język nazw POI i komunikatów: pl/en; akceptuje też polish/english. "
        "Brak tłumaczenia nazwy w OSM oznacza użycie nazwy oryginalnej.",
    )

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()
            return {"polish": "pl", "english": "en"}.get(value, value)
        return value

    start_mode: Literal["market", "user", "poi"] | None = Field(
        default=None, description="Domyślnie market; user wymaga user_location, poi start_poi_id."
    )
    user_location: Location | None = Field(
        default=None,
        description="Pozycja użytkownika. Ponad 1500 m w linii prostej od Rynku "
        "(50.0617, 19.9373) jest pomijana; trasa zaczyna się wtedy na Rynku z ostrzeżeniem.",
    )
    wheelchair: bool = Field(
        default=False, description="Wymaga backendu wheelchair; implikuje brak schodów."
    )
    avoid_stairs: bool = Field(
        default=False, description="Wymaga backendu step_free lub wheelchair."
    )
    start_poi_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="ID startowego POI z GET /pois. Wyklucza lokalizację użytkownika.",
    )
    start_location: Location | None = Field(
        default=None,
        description="Zgodny wstecznie alias user_location; odcinek dojścia jest wliczany do trasy.",
    )
    category: Category | None = Field(
        default=None,
        description="Kategoria wszystkich wybieranych celów i przystanków; "
        "nie ogranicza punktu startowego. Brak oznacza dowolną kategorię.",
    )
    max_intermediate_stops: int = Field(
        default=8,
        ge=0,
        le=10,
        description="Maksymalnie 0–10 dodatkowych POI między pierwszym a ostatnim POI.",
    )
    tolerance_percent: Annotated[FiniteFloat, Field(ge=0, le=50)] = Field(
        default=15,
        description="Akceptowany niedobór czasu w procentach budżetu. "
        "Nigdy nie zezwala na przekroczenie budżetu.",
    )
    randomize: bool = Field(
        default=True,
        description="Losuj kandydatów i podobnie ocenione warianty, pomijając cache. "
        "Nie gwarantuje innego wyniku, jeśli dostępnych tras jest niewiele.",
    )

    @model_validator(mode="after")
    def exclusive_start(self):
        if self.user_location is not None and self.start_location is not None:
            raise ValueError("Provide user_location or its alias start_location, not both")
        location = self.user_location or self.start_location
        if self.start_poi_id is not None and location is not None:
            raise ValueError("Provide either start_poi_id or user_location, not both")
        mode = self.start_mode or ("poi" if self.start_poi_id else "user" if location else "market")
        if mode == "user" and location is None:
            raise ValueError("start_mode=user requires user_location")
        if mode == "poi" and self.start_poi_id is None:
            raise ValueError("start_mode=poi requires start_poi_id")
        if mode == "market" and (location is not None or self.start_poi_id is not None):
            raise ValueError("start_mode=market does not accept a location or POI id")
        if mode == "user" and self.start_poi_id is not None:
            raise ValueError("start_mode=user does not accept start_poi_id")
        if mode == "poi" and location is not None:
            raise ValueError("start_mode=poi does not accept user_location")
        self.start_mode, self.user_location, self.start_location = mode, location, None
        return self

    @property
    def routing_profile(self) -> Literal["walking", "step_free", "wheelchair"]:
        return "wheelchair" if self.wheelchair else "step_free" if self.avoid_stairs else "walking"


class StepGeometry(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[Coordinates] = Field(min_length=1)


class Maneuver(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    modifier: str | None = None
    location: Coordinates
    bearing_before: Annotated[FiniteFloat, Field(ge=0, le=360)]
    bearing_after: Annotated[FiniteFloat, Field(ge=0, le=360)]
    exit: int | None = None


class NavigationStep(BaseModel):
    model_config = ConfigDict(extra="allow")
    distance: Annotated[FiniteFloat, Field(ge=0)]
    duration: Annotated[FiniteFloat, Field(ge=0)]
    name: str
    mode: str
    geometry: StepGeometry
    maneuver: Maneuver
    intersections: list[dict] = Field(default_factory=list)


class RouteLeg(BaseModel):
    from_poi_id: str | None
    to_poi_id: str
    from_waypoint_index: int
    to_waypoint_index: int
    kind: Literal["approach", "between_pois"]
    distance_m: Annotated[FiniteFloat, Field(ge=0)]
    duration_s: Annotated[FiniteFloat, Field(ge=0)]
    geometry: LineString
    steps: list[NavigationStep]


class SnappedWaypoint(BaseModel):
    poi_id: str | None
    location: Coordinates = Field(description="Punkt na sieci pieszej: [longitude, latitude].")
    distance_from_poi_m: Annotated[FiniteFloat, Field(ge=0, le=100.01)] = Field(
        description="Odległość od wejściowej lokalizacji; dla origin poi_id=null."
    )


class RouteStart(BaseModel):
    mode: Literal["market", "user", "poi"]
    requested_location: Location
    snapped_location: Coordinates
    distance_to_network_m: float
    approach_included: bool
    fallback_reason: Literal["user_too_far_from_market"] | None = Field(
        default=None, description="Powód zmiany początku na Rynek; null bez zmiany."
    )


class RouteStop(BaseModel):
    sequence: int
    waypoint_index: int
    role: Literal["start", "intermediate", "end"]
    poi: POI
    snapped_location: Coordinates
    arrival_distance_m: float
    arrival_duration_s: float


class Accessibility(BaseModel):
    wheelchair: bool
    avoid_stairs: bool
    effective_avoid_stairs: bool
    routing_profile: Literal["walking", "step_free", "wheelchair"]
    constraints_applied: bool
    accessibility_verified: Literal[False] = False


class PlanResponse(BaseModel):
    language: Language
    start: RouteStart
    start_poi: POI
    end_poi: POI
    intermediate_pois: list[POI]
    stops: list[RouteStop]
    accessibility: Accessibility
    bbox: tuple[float, float, float, float] = Field(description="[west, south, east, north].")
    requested_duration_s: float = Field(description="Budżet marszu w sekundach.")
    duration_s: float = Field(description="Szacowany czas marszu według pieszego profilu OSRM.")
    distance_m: float = Field(description="Długość trasy po sieci pieszej w metrach.")
    unused_duration_s: float = Field(description="Budżet minus czas OSRM; zawsze >= 0.")
    matches_target: bool = Field(description="Czy niedobór czasu mieści się w tolerance_percent.")
    geometry: LineString = Field(description="Pełna geometria GeoJSON; nie FeatureCollection.")
    legs: list[RouteLeg]
    snapped_waypoints: list[SnappedWaypoint]
    source: Literal["osrm", "cache"]
    warnings: list[str] = Field(default_factory=list)
    candidates_considered: int
    attribution: str = "© OpenStreetMap contributors; routing by OSRM / FOSSGIS"


class POIPage(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[POI]


class ErrorDetail(BaseModel):
    code: str
    message: str
    retry_after_s: int | None = None


class APIError(BaseModel):
    detail: ErrorDetail
