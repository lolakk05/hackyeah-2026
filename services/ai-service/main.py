import asyncio
from contextlib import asynccontextmanager
import os

import httpx
from fastapi import FastAPI, HTTPException, Request
from ollama import AsyncClient, ResponseError
from pydantic import BaseModel, ConfigDict, Field, field_validator


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    app.state.ollama_timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
    client = AsyncClient(
        host=os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"),
        timeout=app.state.ollama_timeout,
        trust_env=False,
    )
    app.state.ollama = client
    try:
        yield
    finally:
        await client.close()


app = FastAPI(
    title="AI Service",
    description="POST /guide wysyła question do lokalnej Ollamy i zwraca answer.",
    lifespan=lifespan,
)


class QuestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    question: str = Field(
        min_length=1,
        max_length=4000,
        description="Treść pytania wysyłana do modelu jako wiadomość użytkownika.",
        examples=["Wymień 3 ciekawe miejsca do zobaczenia w Krakowie. Odpowiedz krótko."],
    )

    @field_validator("question")
    @classmethod
    def non_empty_question(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Pytanie nie może być puste.")
        return value


class AnswerResponse(BaseModel):
    answer: str = Field(description="Treść odpowiedzi modelu.")


@app.post(
    "/guide",
    response_model=AnswerResponse,
    summary="Zadaj pytanie lokalnemu modelowi",
    responses={
        502: {"description": "Błąd Ollamy albo pusta odpowiedź modelu."},
        503: {"description": "Ollama lub wybrany model są niedostępne."},
        504: {"description": "Przekroczony czas odpowiedzi."},
    },
)
async def ask_guide(body: QuestionRequest, request: Request) -> AnswerResponse:
    try:
        async with asyncio.timeout(request.app.state.ollama_timeout):
            response = await request.app.state.ollama.chat(
                model=request.app.state.ollama_model,
                messages=[{"role": "user", "content": body.question}],
                stream=False,
            )
    except (TimeoutError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=504, detail="Przekroczono czas oczekiwania na model.") from exc
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail="Nie można połączyć się z Ollamą.") from exc
    except ResponseError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=503, detail="Model jest niedostępny. Sprawdź ollama list.") from exc
        raise HTTPException(status_code=502, detail="Ollama nie mogła wygenerować odpowiedzi.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Błąd komunikacji z Ollamą.") from exc

    answer = response.message.content
    if not answer or not answer.strip():
        raise HTTPException(status_code=502, detail="Model zwrócił pustą odpowiedź.")
    return AnswerResponse(answer=answer)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
