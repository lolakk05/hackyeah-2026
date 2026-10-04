"""Live endpoint check: uv run python scripts/smoke_ollama.py."""

import asyncio
import json
from pathlib import Path
import sys
from time import perf_counter

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app


async def main():
    async with app.router.lifespan_context(app):
        print(f"Model: {app.state.ollama_model}; timeout: {app.state.ollama_timeout}s", flush=True)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            started = perf_counter()
            response = await client.post("/guide", json={
                "question": "Wymień 3 ciekawe miejsca do zobaczenia na Wawelu w Krakowie. Odpowiedz krótko.",
            })
            print(f"HTTP {response.status_code}; elapsed: {perf_counter() - started:.1f}s", flush=True)
            print(json.dumps(response.json(), ensure_ascii=True), flush=True)
            response.raise_for_status()
            assert response.json()["answer"].strip()


if __name__ == "__main__":
    asyncio.run(main())
