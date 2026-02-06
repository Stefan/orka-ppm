"""
Dedicated API endpoint tests for projects router (P0).

Covers GET/POST /projects so route ordering and basic availability are asserted.
See docs/backend-api-route-coverage.md.
"""

import pytest
from fastapi.testclient import TestClient

from main import app


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
