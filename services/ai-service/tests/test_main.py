import asyncio
import json

from fastapi.testclient import TestClient
import httpx
from ollama import AsyncClient
import pytest

import main


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for key in ("OLLAMA_URL", "OLLAMA_MODEL", "OLLAMA_TIMEOUT_SECONDS"):
        monkeypatch.delenv(key, raising=False)


def model_response(answer="To jest odpowiedź modelu."):
    return httpx.Response(200, json={
        "model": "llama3.2", "done": True,
        "message": {"role": "assistant", "content": answer},
    })


def install_transport(monkeypatch, handler):
    clients = []

    def factory(**kwargs):
        client = AsyncClient(**kwargs, transport=httpx.MockTransport(handler))
        clients.append(client)
        return client

    monkeypatch.setattr(main, "AsyncClient", factory)
    return clients


def test_question_is_forwarded_to_real_sdk_and_answer_returned(monkeypatch):
    captured = []
    answer = "1. Katedra Wawelska.\n2. Zamek Królewski.\n3. Smocza Jama."

    def respond(request):
        assert request.url == "http://127.0.0.1:11434/api/chat"
        captured.append(json.loads(request.content))
        return model_response(answer)

    clients = install_transport(monkeypatch, respond)
    question = "Wymień 3 ciekawe miejsca na Wawelu. Odpowiedz krótko."
    with TestClient(main.app) as client:
        response = client.post("/guide", json={"question": question})
        assert response.status_code == 200
        assert response.json() == {"answer": answer}
        assert captured[0]["messages"] == [{"role": "user", "content": question}]
        assert captured[0]["model"] == "llama3.2"
        assert captured[0]["stream"] is False
        assert not captured[0].get("tools")
        assert not captured[0].get("format")
    assert clients[0]._client.is_closed


@pytest.mark.parametrize("body", [
    {}, {"question": ""}, {"question": " \n\t"}, {"question": 10},
    {"question": "a" * 4001}, {"question": "Sukiennice", "place_id": "sukiennice"},
    {"question": "Cześć", "model": "other"}, [],
])
def test_invalid_input_never_calls_ollama(monkeypatch, body):
    captured = []
    install_transport(monkeypatch, lambda request: captured.append(request))
    with TestClient(main.app) as client:
        response = client.post("/guide", json=body)
        assert response.status_code == 422
        assert captured == []


@pytest.mark.parametrize("status,expected", [(404, 503), (500, 502)])
def test_ollama_errors_are_sanitized(monkeypatch, status, expected):
    install_transport(monkeypatch, lambda request: httpx.Response(status, json={"error": "PRIVATE_DIAGNOSTIC"}))
    with TestClient(main.app) as client:
        response = client.post("/guide", json={"question": "Czym są Sukiennice?"})
        assert response.status_code == expected
        assert "PRIVATE_DIAGNOSTIC" not in response.text


@pytest.mark.parametrize("exception,expected", [
    (httpx.ConnectError, 503), (httpx.ReadTimeout, 504), (httpx.ReadError, 502),
])
def test_network_failures(monkeypatch, exception, expected):
    def fail(request):
        raise exception("PRIVATE_DIAGNOSTIC", request=request)

    install_transport(monkeypatch, fail)
    with TestClient(main.app) as client:
        response = client.post("/guide", json={"question": "Czym są Sukiennice?"})
        assert response.status_code == expected
        assert "PRIVATE_DIAGNOSTIC" not in response.text


@pytest.mark.parametrize("answer", [None, "", "  "])
def test_empty_model_response(monkeypatch, answer):
    install_transport(monkeypatch, lambda request: model_response(answer))
    with TestClient(main.app) as client:
        assert client.post("/guide", json={"question": "Czym są Sukiennice?"}).status_code == 502


def test_total_timeout(monkeypatch):
    async def slow(request):
        await asyncio.sleep(1)
        return model_response()

    monkeypatch.setenv("OLLAMA_TIMEOUT_SECONDS", "0.01")
    install_transport(monkeypatch, slow)
    with TestClient(main.app) as client:
        assert client.post("/guide", json={"question": "Czym są Sukiennice?"}).status_code == 504


def test_model_and_host_are_server_configuration(monkeypatch):
    def respond(request):
        assert request.url == "http://ollama.internal:11434/api/chat"
        assert json.loads(request.content)["model"] == "my-local-model"
        return model_response()

    monkeypatch.setenv("OLLAMA_URL", "http://ollama.internal:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "my-local-model")
    install_transport(monkeypatch, respond)
    with TestClient(main.app) as client:
        assert client.post("/guide", json={"question": "Cześć"}).status_code == 200


def test_documentation_and_existing_routes(monkeypatch):
    install_transport(monkeypatch, lambda request: model_response())
    with TestClient(main.app) as client:
        assert client.get("/").json() == {"message": "Hello World"}
        assert client.get("/hello/User").json() == {"message": "Hello User"}
        assert client.get("/docs").status_code == 200
        schema = client.get("/openapi.json").json()
        request = schema["components"]["schemas"]["QuestionRequest"]
        assert set(request["properties"]) == {"question"}
        assert request["required"] == ["question"]
