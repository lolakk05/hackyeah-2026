# Repository Guidelines

## Project Structure & Module Organization

This directory is the Python 3.12+ `route-finder` service within the `hackyeah-2026` monorepo. Run the commands below from `services/route-finder`.

- `main.py`: FastAPI application factory, lifespan initialization, and HTTP endpoints.
- `config.py`: validated settings and environment-variable loading.
- `models.py`: Pydantic request constraints and response models.
- `spatial.py`: GeoJSON loading and category-specific SciPy KD-trees.
- `routing.py`: asynchronous OSRM requests, throttling, and fallback estimates.
- `planner.py`: time-budget search, intermediate POIs, and in-memory plan caching.
- `hardcoded-zgloszenie/`: separate demo API, reports, snapshot, tests, and docs.
- `krakow_pois.geojson`: attributed OpenStreetMap snapshot with export metadata.
- `scripts/`: reproducible POI import and opt-in live routing smoke test.
- `tests/`: offline pytest tests; `docs/`: endpoint documentation and example response.
- `pyproject.toml` and `uv.lock`: dependencies and tool configuration.
- `test_main.http`: manual HTTP examples; keep these synchronized with current endpoints.

## Build, Test, and Development Commands

- `uv sync --group dev`: install runtime and development dependencies.
- `uv run python -m uvicorn main:app --reload`: start the tourist API; browse `/docs` for interactive documentation.
- `uv run ruff check .`: check errors, imports, and style.
- `uv run ruff format .`: format Python files.
- `uv run pytest`: run tourist API and isolated demo tests.

No separate compilation step is required. Update `uv.lock` when changing dependencies.

## Service Scope

This repository contains backend APIs only. Do not add HTML pages, frontend assets, maps, roadmaps, check-in screens, points, or levels. Client applications consume route JSON and manage progress separately. See `docs/USER_STORY.md` for the intended input, output, and current implementation gaps. Generated Swagger/ReDoc documentation is retained as API tooling.

## Coding Style & Naming Conventions

Use four-space indentation, type annotations, and a 100-character line limit. Follow `snake_case` for modules and functions, `PascalCase` for classes, and `UPPER_SNAKE_CASE` for constants. Keep endpoints thin and place spatial or routing logic in their respective modules. Use `httpx.AsyncClient` for network requests; move blocking file loading and tree construction off the event loop.

## Testing Guidelines

Pytest and pytest-asyncio use automatic asyncio mode. There is no fixed coverage threshold. Add `tests/test_*.py` files with `test_*` functions. Mock OSRM using `httpx.MockTransport`; cover time budgets, waypoint order, cache, radius boundaries, invalid input, missing POIs, timeouts, malformed responses, and HTTP 429 cooldowns. Exercise application lifespan so startup loading is tested.

## Commit & Pull Request Guidelines

History mostly uses `feat: ...`, alongside plain descriptive subjects. Prefer concise, imperative messages such as `feat: add walking route fallback`. PRs should explain behavior changes, link relevant issues, report checks run, and include request/response examples for API changes.

## Configuration & Routing Rules

See `README.md` for settings. Preserve GeoJSON order: `[longitude, latitude]` and OSM attribution. Use a foot-configured OSRM backend. `/routes/plan` must fit its budget; legacy `/route` permits marked straight-line estimates. The separate demo runs from `hardcoded-zgloszenie/`; keep its imports, data, and endpoints out of `main.py`. Never imply verified wheelchair accessibility. Throttling and reports are per process. Update the respective API documentation with endpoint changes.
