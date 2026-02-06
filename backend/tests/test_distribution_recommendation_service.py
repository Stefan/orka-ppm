"""
Tests for distribution suggestion endpoint (GET /api/v1/distribution/suggestion).
Covers Distribution AI spec Task 1.1 – recommendation logic.
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from main import app
from auth.dependencies import get_current_user

client = TestClient(app)


def _auth_headers():
    return {"Authorization": "Bearer test-token-for-distribution"}


async def _override_get_current_user():
    return {"user_id": "u1", "organization_id": "org1"}


def test_suggestion_short_horizon_returns_custom():
    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        end = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        r = client.get(
            f"/api/v1/distribution/suggestion?duration_start={start}&duration_end={end}",
            headers=_auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("profile") in ("linear", "custom", "ai_generated")
        assert "reason" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_suggestion_long_horizon_returns_linear():
    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        start = datetime.now().strftime("%Y-%m-%d")
        end = (datetime.now() + timedelta(days=400)).strftime("%Y-%m-%d")
        r = client.get(
            f"/api/v1/distribution/suggestion?duration_start={start}&duration_end={end}",
            headers=_auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("profile") in ("linear", "custom", "ai_generated")
        assert "reason" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_suggestion_invalid_dates_returns_400():
    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        r = client.get(
            "/api/v1/distribution/suggestion?duration_start=2025-12-01&duration_end=2025-06-01",
            headers=_auth_headers(),
        )
        assert r.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_suggestion_accepts_project_id():
    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        end = (datetime.now() + timedelta(days=80)).strftime("%Y-%m-%d")
        r = client.get(
            f"/api/v1/distribution/suggestion?duration_start={start}&duration_end={end}&project_id=proj-123",
            headers=_auth_headers(),
        )
        assert r.status_code == 200
        assert "profile" in r.json() and "reason" in r.json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
