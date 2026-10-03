import asyncio
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import FastAPI, HTTPException, Path, Query, Request

from config import Settings
from models import (
    POI,
    APIError,
    Category,
    Latitude,
    Longitude,
    PlanRequest,
    PlanResponse,
    POIPage,
    RouteResponse,
)
from planner import Planner
from routing import OSRMRouter
from spatial import POIIndex


def create_app(
    settings: Settings | None = None, *, transport: httpx.AsyncBaseTransport | None = None
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        config = settings if settings is not None else Settings.from_env()
        app.state.settings = config
        # File IO and tree construction happen once, outside the event loop.
        app.state.poi_index = await asyncio.to_thread(POIIndex.load, config.poi_file)
        async with httpx.AsyncClient(
            transport=transport, headers={"User-Agent": "KrakowRouteFinder/0.1"}
        ) as client:
            app.state.router = OSRMRouter(client, config)
            app.state.planner = Planner(app.state.poi_index, app.state.router, config)
            yield

    application = FastAPI(
        title="Krakow Walking Route Finder",
        version="0.3.0",
        description="Planowanie spacerów między POI Krakowa według budżetu czasu. "
        "Dane POI są w RAM; OSRM wyznacza czasy i geometrię po sieci pieszej. "
        "Zacznij od POST /routes/plan. Trasa obejmuje dojście od startu do pierwszego POI, "
        "a odpowiedź zawiera manewry nawigacyjne. Czas nie obejmuje zwiedzania. "
        "Dane © OpenStreetMap contributors (ODbL).",
        lifespan=lifespan,
    )

    @application.get(
        "/", tags=["Serwis"], summary="Informacje o serwisie", response_model=dict[str, str]
    )
    async def root():
        """Zwraca nazwę serwisu i adresy dokumentacji oraz głównego endpointu planowania."""
        return {
            "service": "route-finder",
            "docs": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json",
            "planner": "/routes/plan",
        }

    @application.get(
        "/capabilities",
        tags=["Serwis"],
        summary="Profile routingu i limity formularza",
    )
    async def capabilities(request: Request):
        """Zwraca konfigurację profili i limity. configured nie jest testem dostępności sieci.
        Nieujawnione są adresy backendów. Wybrany niekonfigurowany profil daje 503.
        """
        config = request.app.state.settings
        return {
            "max_intermediate_stops": 10,
            "default_intermediate_stops": 5,
            "duration_minutes": {"min": 5, "max": 360},
            "origin_snap_radius_m": config.origin_snap_radius_m,
            "navigation_steps": True,
            "profiles": {
                "walking": {"configured": True},
                "step_free": {"configured": config.osrm_step_free_base_url is not None},
                "wheelchair": {"configured": config.osrm_wheelchair_base_url is not None},
            },
        }

    @application.get(
        "/health",
        tags=["Serwis"],
        summary="Gotowość procesu i liczba POI",
        response_model=dict[str, str | int],
    )
    async def health(request: Request):
        """Sprawdza proces po załadowaniu zbioru do RAM. Nie wykonuje zapytania do OSRM.

        Niepoprawny lub brakujący plik POI blokuje uruchomienie aplikacji. Pusty, poprawny
        FeatureCollection jest dozwolony i zwraca poi_count=0.
        """
        return {"status": "ok", "poi_count": request.app.state.poi_index.count}

    @application.get(
        "/categories",
        response_model=list[str],
        tags=["POI"],
        summary="Kategorie obecne w lokalnym zbiorze",
    )
    async def categories(request: Request):
        """Zwraca posortowane, unikalne kategorie do filtrów category. Bez wywołań sieciowych."""
        return request.app.state.poi_index.categories

    @application.get(
        "/dataset",
        tags=["POI"],
        summary="Pochodzenie i zakres lokalnego zbioru",
        response_model=dict,
    )
    async def dataset(request: Request):
        """Zwraca metadane zapisane w GeoJSON: źródło, datę eksportu, licencję, zapytanie
        Overpass, zakres i ograniczenia kompletności. loaded_count to faktyczna liczba POI w RAM.
        Metadane mogą być puste dla pliku dostarczonego przez użytkownika.
        """
        index = request.app.state.poi_index
        return {"loaded_count": index.count, "metadata": index.metadata}

    @application.get(
        "/pois",
        response_model=POIPage,
        tags=["POI"],
        summary="Przeglądaj POI z paginacją i filtrowaniem",
    )
    async def list_pois(
        request: Request,
        category: Annotated[
            str | None,
            Query(
                min_length=1,
                max_length=100,
                description="Dokładna kategoria; ignoruje wielkość liter i skrajne spacje.",
            ),
        ] = None,
        q: Annotated[
            str | None,
            Query(
                min_length=1,
                max_length=200,
                description="Fragment nazwy; ignoruje wielkość liter, zachowuje polskie znaki.",
            ),
        ] = None,
        limit: Annotated[int, Query(ge=1, le=200, description="Rozmiar strony.")] = 50,
        offset: Annotated[int, Query(ge=0, description="Liczba pomijanych wyników.")] = 0,
    ):
        """Wyniki są uporządkowane po id. total dotyczy całego przefiltrowanego zbioru.
        Brak wyników daje 200 z pustym items. Zbiór obejmuje także obiekty z ograniczonym
        dostępem; planer pomija access=private/no i foot=no.
        """

        def search():
            points = [
                p
                for p in request.app.state.poi_index.all
                if (category is None or p.category.casefold() == category.strip().casefold())
                and (q is None or q.strip().casefold() in p.name.casefold())
            ]
            return POIPage(
                total=len(points), offset=offset, limit=limit, items=points[offset : offset + limit]
            )

        return await asyncio.to_thread(search)

    @application.get(
        "/pois/{poi_id}",
        response_model=POI,
        tags=["POI"],
        summary="Szczegóły pojedynczego POI",
        responses={404: {"model": APIError}},
    )
    async def get_poi(
        request: Request,
        poi_id: Annotated[
            str,
            Path(
                min_length=1,
                max_length=100,
                description="ID z GET /pois, np. node-123 lub way-456.",
            ),
        ],
    ):
        """Zwraca współrzędne WGS84, kategorię, link do OSM, źródło współrzędnych i tagi.
        ID należy pobrać z lokalnego katalogu; nie ma zdalnego wyszukiwania w OSM.
        """
        poi = request.app.state.poi_index.by_id.get(poi_id)
        if poi is None:
            raise HTTPException(
                404, detail={"code": "poi_not_found", "message": "POI nie istnieje."}
            )
        return poi

    @application.post(
        "/routes/plan",
        response_model=PlanResponse,
        tags=["Trasy"],
        summary="Zaplanuj spacer między POI według budżetu czasu",
        responses={
            404: {"model": APIError, "description": "Brak POI lub trasy w budżecie"},
            503: {"model": APIError, "description": "OSRM lub planer niedostępny"},
        },
    )
    async def plan_route(request: Request, body: PlanRequest):
        """Wystarczy `{"duration_minutes": 45}`. start_mode=market zaczyna na Rynku
        (50.0617, 19.9373), user wymaga user_location; poi wymaga start_poi_id.
        start_location pozostaje aliasem user_location. Dojście do pierwszego POI
        (wybranego do 2 km od startu) jest częścią czasu, geometrii i legs.
        wheelchair implikuje unikanie schodów; profile wymagają konfiguracji osobnego
        grafu OSRM. GET /capabilities podaje konfigurację. Brak profilu to 503
        routing_profile_not_configured; nie jest zastępowany zwykłym profilem pieszym.

        Planer wybiera do 24 kandydatów z RAM, pobiera macierz czasów OSRM i sprawdza
        warianty z 0–10 punktami pośrednimi (domyślnie 5) przez ograniczone beam search.
        Preferuje trasy w tolerancji, potem więcej POI,
        następnie dłuższy marsz. Finalną geometrię i czas potwierdza /route/v1/foot/.
        steps=true dostarcza manewry, geometrię kroków i odcinków. stops ma kolejność,
        dopasowane lokalizacje i narastające czasy dotarcia. Punkt wejściowy może zostać
        dopasowany do sieci (domyślnie do 25 m); przesunięcie jest jawne w start.
        Zwrócony czas nigdy nie przekracza budżetu. Gdy trasa jest zbyt krótka,
        matches_target=false. Dobór jest heurystyczny, bez gwarancji globalnego optimum.

        Udane plany są przechowywane w cache RAM (domyślnie 1 h); source=cache oznacza
        ponowne użycie planu dla identycznego żądania. Po 429 respektowany jest Retry-After.
        Bez potwierdzonej trasy lub cache zwracane jest 503, a nie geometria w linii prostej.
        Jednocześnie może powstawać jeden nowy plan na proces; inny otrzymuje 503 planner_busy.
        """
        return await request.app.state.planner.plan(body)

    @application.get(
        "/route",
        response_model=RouteResponse,
        tags=["Trasy"],
        summary="Trasa do najbliższego POI (bez budżetu czasu)",
        responses={
            404: {"description": "No POI of the requested category within the radius"},
        },
    )
    async def find_route(
        request: Request,
        latitude: Annotated[
            Latitude, Query(description="Szerokość geograficzna użytkownika WGS84.")
        ],
        longitude: Annotated[
            Longitude, Query(description="Długość geograficzna użytkownika WGS84.")
        ],
        category: Annotated[Category, Query(description="Kategoria celu z GET /categories.")],
        radius_m: Annotated[
            float,
            Query(
                gt=0,
                le=50_000,
                allow_inf_nan=False,
                description="Promień wyszukiwania w linii prostej, w metrach.",
            ),
        ] = 2_000,
    ) -> RouteResponse:
        """Pomocniczy endpoint zachowujący poprzednią funkcjonalność. Szuka najbliższego POI
        w zadanej kategorii i promieniu; nie optymalizuje czasu. W razie błędu OSRM zwraca 200
        z source=straight_line, is_estimate=true i fallback_reason. Taki odcinek nie nadaje się
        do nawigacji. Brak POI daje 404 z kategoriami lub sugestią najbliższego punktu
        poza promieniem.
        """
        index: POIIndex = request.app.state.poi_index
        nearest = await asyncio.to_thread(index.nearest, latitude, longitude, category)
        if nearest is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "no_matching_category",
                    "message": "No POIs for this category. Choose an available category.",
                    "available_categories": index.categories,
                },
            )
        poi, distance = nearest
        if distance > radius_m:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "no_poi_in_radius",
                    "message": "No matching POI within the radius. Try a larger radius.",
                    "radius_m": radius_m,
                    "nearest_poi": poi.model_dump(),
                    "nearest_distance_m": distance,
                    "suggested_radius_m": int(distance) + 1,
                },
            )
        return await request.app.state.router.route(latitude, longitude, poi, distance)

    return application


app = create_app()
