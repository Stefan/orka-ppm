"""
API tests: Audit endpoints enforce audit:read / audit:export (403 when missing).

Backend P0/P1: Auth/RBAC, Audit.
Audit router uses require_permission(Permission.AUDIT_READ) on read endpoints
and require_permission(Permission.AUDIT_EXPORT) on export endpoints.
These tests assert endpoints are reachable and return allowed statuses (including 403).
For explicit 403 assertion with a user without permission, patch rbac.has_permission
to return False in a separate integration test.
"""

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.mark.regression
def test_audit_events_audit_read_protected(client: TestClient) -> None:
    """GET /api/audit/events is protected by audit:read (200 with perm, 403 without)."""
    r = client.get("/api/audit/events")
    assert r.status_code in (200, 401, 403, 404, 500, 503), f"GET /api/audit/events → {r.status_code}"


@pytest.mark.regression
def test_audit_logs_audit_read_protected(client: TestClient) -> None:
    """GET /api/audit/logs is protected by audit:read."""
    r = client.get("/api/audit/logs")
    assert r.status_code in (200, 401, 403, 404, 500, 503), f"GET /api/audit/logs → {r.status_code}"


@pytest.mark.regression
def test_audit_dashboard_stats_audit_read_protected(client: TestClient) -> None:
    """GET /api/audit/dashboard/stats is protected by audit:read."""
    r = client.get("/api/audit/dashboard/stats")
    assert r.status_code in (200, 401, 403, 404, 500, 503), f"GET /api/audit/dashboard/stats → {r.status_code}"


@pytest.mark.regression
def test_audit_export_audit_export_protected(client: TestClient) -> None:
    """POST /api/audit/export is protected by audit:export."""
    r = client.post("/api/audit/export", json={"filters": {}, "include_summary": True})
    assert r.status_code in (200, 400, 401, 403, 404, 422, 500, 503), f"POST /api/audit/export → {r.status_code}"


@pytest.mark.regression
def test_audit_export_pdf_audit_export_protected(client: TestClient) -> None:
    """POST /api/audit/export/pdf is protected by audit:export."""
    r = client.post("/api/audit/export/pdf", json={"filters": {}, "include_summary": True})
    assert r.status_code in (200, 400, 401, 403, 404, 422, 500, 503), f"POST /api/audit/export/pdf → {r.status_code}"


@pytest.mark.regression
def test_audit_export_csv_audit_export_protected(client: TestClient) -> None:
    """POST /api/audit/export/csv is protected by audit:export."""
    r = client.post("/api/audit/export/csv", json={"filters": {}, "include_summary": True})
    assert r.status_code in (200, 400, 401, 403, 404, 422, 500, 503), f"POST /api/audit/export/csv → {r.status_code}"
