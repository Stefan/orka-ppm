"""
Pytest fixtures for backend tests.
Enterprise Test Strategy - Task 1.1
Requirements: 4.1, 4.3, 5.1

Provides:
- Database/Supabase mocks for isolation
- API client (TestClient) for endpoint tests
- Test data factories for synthetic data
"""

import os
import pytest
from unittest.mock import Mock, MagicMock, AsyncMock
from uuid import uuid4
from datetime import datetime

# Hypothesis settings for property-based tests (Task 1.1)
def pytest_configure(config):
    """Register hypothesis settings."""
    try:
        from hypothesis import settings
        settings.register_profile("default", max_examples=100, deadline=5000)
        settings.register_profile("ci", max_examples=200, deadline=10000)
        settings.load_profile("default")
    except ImportError:
        pass


# ----- Database / Supabase fixtures -----

@pytest.fixture
def mock_supabase():
    """Mock Supabase client for unit tests (no real DB)."""
    client = MagicMock()
    # Table chain: .table("x").select().execute()
    table = MagicMock()
    client.table.return_value = table
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.upsert.return_value = table
    table.delete.return_value = table
    table.eq.return_value = table
    table.neq.return_value = table
    table.gte.return_value = table
    table.lte.return_value = table
    table.in_.return_value = table
    table.order.return_value = table
    table.limit.return_value = table
    table.single.return_value = table
    table.execute.return_value = Mock(data=[], count=0)
    return client


@pytest.fixture
def mock_db(mock_supabase):
    """Alias for mock_supabase for compatibility."""
    return mock_supabase


# ----- API client fixture -----

@pytest.fixture
def api_client():
    """FastAPI TestClient for integration/API tests."""
    try:
        from fastapi.testclient import TestClient
        from main import app
        return TestClient(app)
    except ImportError:
        pytest.skip("FastAPI TestClient not available (main app not importable)")


@pytest.fixture
def auth_headers():
    """Default auth headers for API tests (dev token or mock)."""
    return {"Authorization": "Bearer mock-dev-token"}


# ----- Test data factories -----

@pytest.fixture
def project_factory():
    """Factory for synthetic project records."""
    def _create(id=None, name=None, status="active", budget=100000):
        return {
            "id": id or str(uuid4()),
            "name": name or f"Project_{uuid4().hex[:8]}",
            "description": "Synthetic test project",
            "status": status,
            "budget": budget,
            "health": "green",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
    return _create


@pytest.fixture
def user_factory():
    """Factory for synthetic user records (no PII in production)."""
    def _create(user_id=None, email=None, role="viewer"):
        uid = user_id or str(uuid4())
        return {
            "user_id": uid,
            "email": email or f"user_{uid[:8]}@test.example",
            "roles": [role],
            "permissions": [],
            "tenant_id": uid,
        }
    return _create


@pytest.fixture(autouse=True)
def reset_env(monkeypatch):
    """Ensure test env vars don't leak from real env (optional)."""
    # Uncomment to force test database URL in integration tests:
    # monkeypatch.setenv("SUPABASE_URL", "http://test.supabase")
    # monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-key")
    yield
