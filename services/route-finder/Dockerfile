# syntax=docker/dockerfile:1
FROM python:3.12-slim-trixie AS python-base

FROM python-base AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.10.10 /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
# Wheels avoid compiling NumPy/SciPy on a small VPS; fail if the lock is stale.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project --no-build

FROM python-base AS runtime
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    POI_FILE=/app/krakow_pois.geojson
WORKDIR /app
RUN groupadd --gid 10001 api \
    && useradd --uid 10001 --gid api --no-create-home --shell /usr/sbin/nologin api
COPY --from=dependencies /app/.venv /app/.venv
COPY main.py config.py models.py spatial.py routing.py planner.py localization.py ./
COPY krakow_pois.geojson ./
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).close()"]
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-graceful-shutdown", "50"]
