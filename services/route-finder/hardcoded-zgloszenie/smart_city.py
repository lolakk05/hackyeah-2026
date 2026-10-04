"""Presentation-only routing over two recorded OSRM variants and RAM reports."""

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat

from models import APIError, Coordinates, LineString, Location
from spatial import EARTH_RADIUS_M

Mobility = Literal["walking", "wheelchair"]
ReportKind = Literal["blocked_road", "stairs"]
Positive = Annotated[FiniteFloat, Field(gt=0)]


class DemoPlace(Location):
    name: str


class DemoObstacle(BaseModel):
    id: Literal["grodzka"]
    name: str
    location: Location
    radius_m: Annotated[FiniteFloat, Field(gt=0, le=100)]


class DemoVariant(BaseModel):
    id: Literal["direct", "planty"]
    name: str
    distance_m: Positive
    duration_s: Positive
    geometry: LineString
    via_coordinates: list[Coordinates] = Field(min_length=2)


class DemoSnapshot(BaseModel):
    scenario_id: Literal["rynek_wawel"]
    recorded_at: datetime
    osrm_base_url: str
    start: DemoPlace
    end: DemoPlace
    obstacle: DemoObstacle
    variants: list[DemoVariant] = Field(min_length=2, max_length=2)
    attribution: str


def intersects_obstacle(geometry: LineString, obstacle: DemoObstacle) -> bool:
    """Distance to complete polyline segments in a local metric projection, not just vertices."""
    scale_x = EARTH_RADIUS_M * math.cos(math.radians(obstacle.location.latitude))

    def project(point: Coordinates):
        lon, lat = point
        return (
            math.radians(lon - obstacle.location.longitude) * scale_x,
            math.radians(lat - obstacle.location.latitude) * EARTH_RADIUS_M,
        )

    for a, b in zip(geometry.coordinates, geometry.coordinates[1:]):
        ax, ay = project(a)
        bx, by = project(b)
        dx, dy = bx - ax, by - ay
        length_squared = dx * dx + dy * dy
        fraction = (
            max(0.0, min(1.0, -(ax * dx + ay * dy) / length_squared)) if length_squared else 0.0
        )
        if math.hypot(ax + fraction * dx, ay + fraction * dy) <= obstacle.radius_m:
            return True
    return False


def validate_snapshot(snapshot: DemoSnapshot):
    variants = {v.id: v for v in snapshot.variants}
    if set(variants) != {"direct", "planty"}:
        raise ValueError("Demo must contain exactly one direct and one Planty route")
    if not intersects_obstacle(variants["direct"].geometry, snapshot.obstacle):
        raise ValueError("The baseline route must intersect the simulated obstacle")
    if intersects_obstacle(variants["planty"].geometry, snapshot.obstacle):
        raise ValueError("The detour must avoid the simulated obstacle")
    for endpoint in (0, -1):
        if (
            math.dist(
                variants["direct"].geometry.coordinates[endpoint],
                variants["planty"].geometry.coordinates[endpoint],
            )
            > 0.0001
        ):
            raise ValueError("Demo variants must have matching start and end points")
    if variants["planty"].duration_s <= variants["direct"].duration_s:
        raise ValueError("Demo detour must take longer than the baseline")


class DemoReportRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {"kind": "blocked_road", "description": "Remont — przejście zamknięte"},
                {"kind": "stairs", "description": "Schody bez podjazdu (symulacja)"},
            ]
        },
    )
    kind: ReportKind = Field(
        description="blocked_road blokuje oba profile; stairs tylko wheelchair."
    )
    obstacle_id: Literal["grodzka"] = Field(
        default="grodzka", description="Zahardkodowany obszar demo."
    )
    description: str = Field(
        default="", max_length=500, description="Opis zgłoszenia; maks. 500 znaków."
    )


class DemoReport(BaseModel):
    id: str
    kind: ReportKind
    obstacle: DemoObstacle
    description: str
    created_at: datetime
    is_demo: Literal[True] = True


class DemoRouteRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {"mobility": "walking"},
                {"mobility": "wheelchair", "duration_minutes": 20},
            ]
        },
    )
    mobility: Mobility = Field(default="walking", description="Profil reguł demo; nie profil OSRM.")
    duration_minutes: Annotated[FiniteFloat, Field(ge=5, le=240)] | None = Field(
        default=None,
        description="Opcjonalny budżet marszu. Obejście ma pierwszeństwo; "
        "przekroczenie jest sygnalizowane przez within_budget=false, nie ukrywane.",
    )


class DemoRouteResponse(BaseModel):
    scenario_id: Literal["rynek_wawel"]
    is_demo: Literal[True] = True
    accessibility_verified: Literal[False] = False
    mobility: Mobility
    start: DemoPlace
    end: DemoPlace
    route_id: Literal["direct", "planty"]
    route_name: str
    rerouted: bool = Field(description="Czy wybrano wariant inny niż podstawowy przez Grodzką.")
    distance_m: Positive
    duration_s: Positive = Field(
        description="Zapisany czas profilu foot OSRM; nie czas profilu wózka."
    )
    additional_distance_m: FiniteFloat
    additional_duration_s: FiniteFloat
    geometry: LineString
    original_geometry: LineString = Field(description="Podstawowa trasa do porównania na mapie.")
    avoided_reports: list[DemoReport]
    ignored_reports: list[DemoReport]
    report_revision: int
    requested_duration_s: float | None
    within_budget: bool | None
    source: Literal["osrm_snapshot"] = "osrm_snapshot"
    snapshot_recorded_at: datetime
    warnings: list[str]
    attribution: str


class DemoScenarioResponse(BaseModel):
    snapshot: DemoSnapshot
    is_demo: Literal[True] = True
    supported_report_kinds: list[ReportKind] = ["blocked_road", "stairs"]
    active_reports: list[DemoReport]
    report_revision: int


class DemoResetResponse(BaseModel):
    removed_reports: int
    report_revision: int


class SmartCityDemo:
    def __init__(self, snapshot: DemoSnapshot):
        validate_snapshot(snapshot)
        self.snapshot = snapshot
        self.reports: dict[str, DemoReport] = {}
        self.revision = 0

    @classmethod
    def load(cls, path: Path) -> "SmartCityDemo":
        try:
            return cls(DemoSnapshot.model_validate_json(path.read_text(encoding="utf-8")))
        except (OSError, ValueError) as exc:
            raise RuntimeError(f"Cannot load smart-city demo snapshot: {path}") from exc

    def add(self, body: DemoReportRequest) -> DemoReport:
        if len(self.reports) >= 100:
            raise HTTPException(
                409,
                detail={
                    "code": "demo_report_limit",
                    "message": "Limit 100 zgłoszeń demo. Usuń zgłoszenia lub zresetuj scenariusz.",
                },
            )
        report = DemoReport(
            id=str(uuid4()),
            kind=body.kind,
            obstacle=self.snapshot.obstacle,
            description=body.description,
            created_at=datetime.now(timezone.utc),
        )
        self.reports[report.id] = report
        self.revision += 1
        return report

    def route(self, body: DemoRouteRequest) -> DemoRouteResponse:
        active = list(self.reports.values())
        relevant = [r for r in active if r.kind == "blocked_road" or body.mobility == "wheelchair"]
        ignored = [r for r in active if r not in relevant]
        variants = {v.id: v for v in self.snapshot.variants}
        baseline = variants["direct"]
        chosen = baseline
        avoided = []
        if any(intersects_obstacle(baseline.geometry, r.obstacle) for r in relevant):
            chosen = variants["planty"]
            if any(intersects_obstacle(chosen.geometry, r.obstacle) for r in relevant):
                raise HTTPException(
                    409,
                    detail={
                        "code": "no_demo_detour",
                        "message": "Żaden wariant demo nie omija zgłoszonych przeszkód.",
                    },
                )
            avoided = [r for r in relevant if intersects_obstacle(baseline.geometry, r.obstacle)]
        budget = body.duration_minutes * 60 if body.duration_minutes is not None else None
        within_budget = chosen.duration_s <= budget if budget is not None else None
        warnings = [
            "Scenariusz demonstracyjny: przeszkody są symulowane. "
            "Brak pełnej weryfikacji dostępności dla wózka, nachylenia i wejść. "
            "Czas pochodzi z profilu foot OSRM."
        ]
        if within_budget is False:
            warnings.append(
                "Wybrana trasa przekracza zadany budżet; podano rzeczywisty zapisany czas trasy."
            )
        return DemoRouteResponse(
            scenario_id=self.snapshot.scenario_id,
            mobility=body.mobility,
            start=self.snapshot.start,
            end=self.snapshot.end,
            route_id=chosen.id,
            route_name=chosen.name,
            rerouted=chosen.id != baseline.id,
            distance_m=chosen.distance_m,
            duration_s=chosen.duration_s,
            additional_distance_m=chosen.distance_m - baseline.distance_m,
            additional_duration_s=chosen.duration_s - baseline.duration_s,
            geometry=chosen.geometry,
            original_geometry=baseline.geometry,
            avoided_reports=avoided,
            ignored_reports=ignored,
            report_revision=self.revision,
            requested_duration_s=budget,
            within_budget=within_budget,
            snapshot_recorded_at=self.snapshot.recorded_at,
            warnings=warnings,
            attribution=self.snapshot.attribution,
        )


router = APIRouter(prefix="/demo", tags=["Smart-city demo"])


@router.get("/scenario", response_model=DemoScenarioResponse, summary="Scenariusz Rynek → Wawel")
async def scenario(request: Request):
    """Zwraca oba zapisane warianty OSRM, symulowany obszar Grodzkiej i bieżące zgłoszenia.
    Działa offline. Wszystkie lokalizacje są na stałe ustalone dla prezentacji.
    """
    demo = request.app.state.smart_city_demo
    return DemoScenarioResponse(
        snapshot=demo.snapshot,
        active_reports=list(demo.reports.values()),
        report_revision=demo.revision,
    )


@router.post(
    "/reports",
    response_model=DemoReport,
    status_code=201,
    summary="Zgłoś symulowaną blokadę lub schody",
    responses={409: {"model": APIError}},
)
async def add_report(request: Request, body: DemoReportRequest):
    """Dodaje aktywne zgłoszenie w RAM. blocked_road wymusza obejście dla wszystkich;
    stairs tylko dla wheelchair. Zgłoszenie dotyczy wyłącznie zahardkodowanej Grodzkiej.
    Limit 100 zgłoszeń; brak trwałego zapisu, moderacji i uwierzytelniania w tym demo.
    """
    return request.app.state.smart_city_demo.add(body)


@router.get("/reports", response_model=list[DemoReport], summary="Aktywne zgłoszenia demo")
async def list_reports(
    request: Request,
    kind: Annotated[
        ReportKind | None, Query(description="Opcjonalny filtr typu zgłoszenia.")
    ] = None,
):
    """Lista w kolejności dodania. Usunięte zgłoszenia nie są zwracane; pusty wynik to []."""
    return [
        r
        for r in request.app.state.smart_city_demo.reports.values()
        if kind is None or r.kind == kind
    ]


@router.delete(
    "/reports/{report_id}",
    status_code=204,
    summary="Usuń zgłoszenie demo",
    responses={404: {"model": APIError}},
)
async def remove_report(request: Request, report_id: str):
    """Usuwa zgłoszenie z RAM. Po usunięciu ostatniej istotnej przeszkody wraca trasa podstawowa.
    Sukces: 204 bez JSON. Nieznane ID: 404 demo_report_not_found.
    """
    demo = request.app.state.smart_city_demo
    if report_id not in demo.reports:
        raise HTTPException(
            404, detail={"code": "demo_report_not_found", "message": "Nieznane zgłoszenie."}
        )
    del demo.reports[report_id]
    demo.revision += 1
    return Response(status_code=204)


@router.post("/reset", response_model=DemoResetResponse, summary="Zresetuj prezentację")
async def reset_demo(request: Request):
    """Usuwa wszystkie aktywne zgłoszenia demo. Nie zmienia POI ani cache planera turystycznego."""
    demo = request.app.state.smart_city_demo
    removed = len(demo.reports)
    demo.reports.clear()
    demo.revision += 1
    return DemoResetResponse(removed_reports=removed, report_revision=demo.revision)


@router.post(
    "/routes",
    response_model=DemoRouteResponse,
    summary="Trasa uwzględniająca zgłoszenia demo",
    responses={409: {"model": APIError}},
)
async def demo_route(request: Request, body: DemoRouteRequest):
    """Stała para Rynek → okolice Wawelu. Bez przeszkód: Grodzka. Blokada drogi: Planty.
    Schody: Planty dla wheelchair, Grodzka dla walking. Testowane są całe odcinki geometrii
    względem obszaru zgłoszenia. Żądanie nie kontaktuje się z publicznym OSRM.
    is_demo=true i accessibility_verified=false: omijanie zgłoszenia nie jest certyfikacją
    dostępności całej trasy. Opcjonalny budżet jest informacyjny; within_budget=false
    sygnalizuje, że obejście wymaga więcej czasu. Zgłoszenia nie wpływają na /routes/plan.
    """
    return request.app.state.smart_city_demo.route(body)
