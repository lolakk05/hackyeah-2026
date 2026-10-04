import httpx
import pytest
from fastapi.testclient import TestClient

from main import create_app

ORIGIN = "http://localhost:8081"
PREFLIGHT = {
    "Origin": ORIGIN,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type, authorization",
}


def test_browser_preflight_does_not_call_osrm(client_factory):
    def forbidden(request):
        pytest.fail("A preflight must not request a route")

    with client_factory(forbidden) as client:
        response = client.options("/routes/plan", headers=PREFLIGHT)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"]
    assert "authorization" in response.headers["access-control-allow-headers"]
    assert "access-control-allow-credentials" not in response.headers


def test_browser_can_read_success_validation_errors_and_get_405(client_factory):
    with client_factory() as client:
        success = client.post(
            "/routes/plan", json={"duration_minutes": 10}, headers={"Origin": ORIGIN}
        )
        invalid = client.post(
            "/routes/plan", json={"duration_minutes": 0}, headers={"Origin": ORIGIN}
        )
        wrong_method = client.get("/routes/plan", headers={"Origin": ORIGIN})
    assert success.status_code == 200
    assert invalid.status_code == 422
    assert wrong_method.status_code == 405
    assert "POST" in wrong_method.headers["allow"]
    for response in (success, invalid, wrong_method):
        assert response.headers["access-control-allow-origin"] == "*"


def test_browser_can_read_rate_limit_retry_header(client_factory):
    with client_factory(
        lambda request: httpx.Response(429, headers={"Retry-After": "60"})
    ) as client:
        response = client.post(
            "/routes/plan", json={"duration_minutes": 10}, headers={"Origin": ORIGIN}
        )
    assert response.status_code == 503
    assert response.headers["retry-after"] == "60"
    assert response.headers["access-control-allow-origin"] == "*"
    assert "Retry-After" in response.headers["access-control-expose-headers"]


def test_explicit_origins_are_respected(client_factory):
    with client_factory(cors_allow_origins=[ORIGIN]) as client:
        allowed = client.options("/routes/plan", headers=PREFLIGHT)
        denied = client.options(
            "/routes/plan", headers={**PREFLIGHT, "Origin": "https://other.example"}
        )
        denied_get = client.get("/health", headers={"Origin": "https://other.example"})
        method = client.options(
            "/routes/plan", headers={**PREFLIGHT, "Access-Control-Request-Method": "DELETE"}
        )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == ORIGIN
    assert "Origin" in allowed.headers["vary"]
    assert denied.status_code == method.status_code == 400
    assert "access-control-allow-origin" not in denied.headers
    assert "access-control-allow-origin" not in denied_get.headers


@pytest.mark.parametrize(
    "origins,expected",
    [
        (None, "*"),
        (" http://localhost:8081 , https://front.example ", ORIGIN),
        ("", None),
    ],
)
def test_cors_environment_applies_to_application(monkeypatch, poi_file, origins, expected):
    monkeypatch.setenv("POI_FILE", str(poi_file))
    if origins is None:
        monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ALLOW_ORIGINS", origins)
    with TestClient(create_app()) as client:
        response = client.options("/routes/plan", headers=PREFLIGHT)
    assert response.status_code == (200 if expected else 400)
    assert response.headers.get("access-control-allow-origin") == expected
