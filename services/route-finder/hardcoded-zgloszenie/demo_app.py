"""Independent presentation app; does not initialize the tourist API or its POI index."""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from smart_city import SmartCityDemo, router


def create_app(snapshot_file: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        path = snapshot_file or Path(
            os.environ.get(
                "DEMO_ROUTES_FILE",
                str(Path(__file__).with_name("data") / "rynek_wawel_routes.json"),
            )
        )
        application.state.smart_city_demo = await asyncio.to_thread(SmartCityDemo.load, path)
        yield

    application = FastAPI(
        title="Hardcoded zgłoszenie — smart-city demo",
        version="0.1.0",
        description="Osobna demonstracja Rynek → Wawel. Zgłoszenia są symulowane; "
        "warianty OSRM są odtwarzane z lokalnego pliku. "
        "Nie zweryfikowano pełnej dostępności dla wózka.",
        lifespan=lifespan,
    )
    application.include_router(router)

    @application.get("/", summary="Informacje o API symulowanych zgłoszeń")
    async def root():
        """Zwraca adresy endpointów JSON i dokumentacji osobnego API demo."""
        return {
            "service": "hardcoded-zgloszenie",
            "is_demo": True,
            "routes": "/demo/routes",
            "reports": "/demo/reports",
            "docs": "/docs",
            "openapi": "/openapi.json",
        }

    @application.get("/health", summary="Gotowość demonstracji")
    async def health():
        """Potwierdza start po załadowaniu snapshotu, bez wywołań OSRM i ładowania POI."""
        return {"status": "ok", "is_demo": True}

    return application


app = create_app()
