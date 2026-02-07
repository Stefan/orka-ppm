"""
Dedicated API endpoint tests for projects router (P0).

Covers GET/POST /projects so route ordering and basic availability are asserted.
See docs/backend-api-route-coverage.md.
Cora-Surpass Phase 1: paginated list response and cache key idempotency.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from routers.projects import _projects_cache_key


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.mark.regression
def test_projects_list_returns_ok_or_auth_error(client: TestClient) -> None:
    """GET /projects must not return 422 (route-order regression)."""
    r = client.get("/projects")
    assert r.status_code in (200, 401, 403, 500, 503), f"GET /projects → {r.status_code}"


@pytest.mark.regression
def test_projects_create_returns_ok_or_validation_or_auth_error(client: TestClient) -> None:
    """POST /projects must not return 422 from path matching (body validation 422 is ok)."""
    r = client.post("/projects", json={})
    # 422 can be from body validation; we care that path is not misinterpreted
    assert r.status_code in (201, 400, 401, 403, 422), f"POST /projects → {r.status_code}"


def test_projects_cache_key_idempotent() -> None:
    """Cache key for projects list is idempotent for same org, offset, limit."""
    key1 = _projects_cache_key("org-1", 0, 10)
    key2 = _projects_cache_key("org-1", 0, 10)
    assert key1 == key2
    assert key1 == "projects:list:org-1:0:10"
    assert _projects_cache_key("org-2", 20, 50) == "projects:list:org-2:20:50"


@pytest.mark.regression
def test_projects_list_accepts_limit_offset(client: TestClient) -> None:
    """GET /projects accepts limit and offset query params (no 422)."""
    r = client.get("/projects", params={"limit": 10, "offset": 0})
    assert r.status_code in (200, 401, 403, 500, 503), f"GET /projects?limit=10&offset=0 → {r.status_code}"
    if r.status_code == 200:
        data = r.json()
        assert "items" in data and "total" in data and "limit" in data and "offset" in data


@pytest.mark.regression
def test_projects_list_cache_hit_with_mock(client: TestClient) -> None:
    """With mocked cache returning data, GET /projects returns cached payload when auth succeeds."""
    cached = {"items": [{"id": "cached-id", "name": "Cached Project"}], "total": 1}
    mock_cache = MagicMock()
    mock_cache.get = AsyncMock(return_value=cached)
    mock_cache.set = AsyncMock(return_value=True)

    from auth.dependencies import get_current_user

    async def fake_user():
        return {"user_id": "u1", "organization_id": "org-1"}

    try:
        client.app.dependency_overrides[get_current_user] = fake_user
        client.app.state.cache_manager = mock_cache
        r = client.get("/projects", params={"limit": 10, "offset": 0})
        if r.status_code == 200:
            data = r.json()
            assert data.get("items") == cached["items"]
            assert data.get("total") == 1
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)
        if hasattr(client.app.state, "cache_manager"):
            del client.app.state.cache_manager
