"""R-B4: OpenAPI/Swagger must be disabled in production (APP_ENV=production)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings


def _settings(app_env: str) -> Settings:
    return Settings(
        APP_ENV=app_env,
        DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test_db",
        JWT_SECRET="ci-test-jwt-secret",
        EMAIL_ADDRESS="ci@example.com",
        EMAIL_APP_PASSWORD="ci-email-app-password",
        SMTP_HOST="smtp.example.com",
        EMAIL_VERIFICATION_SECRET="ci-email-verification-secret",
        S3_ENDPOINT="localhost:9000",
        S3_ACCESS_KEY="ci-access-key",
        S3_SECRET_KEY="ci-secret-key",
        S3_BUCKET="ci-bucket",
    )


def _client_for_env(app_env: str) -> TestClient:
    cfg = _settings(app_env)
    app = FastAPI(
        docs_url="/docs" if cfg.openapi_enabled else None,
        redoc_url="/redoc" if cfg.openapi_enabled else None,
        openapi_url="/openapi.json" if cfg.openapi_enabled else None,
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return TestClient(app)


def test_openapi_enabled_flag():
    assert _settings("development").openapi_enabled is True
    assert _settings("pilot").openapi_enabled is True
    assert _settings("production").openapi_enabled is False


def test_docs_available_in_development():
    with _client_for_env("development") as client:
        assert client.get("/docs").status_code == 200


def test_docs_disabled_in_production():
    with _client_for_env("production") as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404, path


def test_health_available_in_production():
    with _client_for_env("production") as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
