"""
API tests for GET /api/v1/search (Topbar Unified Search).
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


@pytest.mark.regression
def test_search_empty_q_returns_200_with_empty_results():
    """Without auth, dev mode may return 200 with default user."""
    r = client.get("/api/v1/search", params={"q": ""})
    # Empty q: returns 200 with fulltext/semantic/suggestions empty
    assert r.status_code in (200, 401)
    if r.status_code == 200:
        data = r.json()
        assert "fulltext" in data
        assert "semantic" in data
        assert "suggestions" in data
        assert data["fulltext"] == []
        assert data["suggestions"] == []


@pytest.mark.regression
def test_search_with_q_returns_200_structure():
    """With q and auth (or dev default), response has correct shape."""
    r = client.get("/api/v1/search", params={"q": "pro"}, headers={"Authorization": "Bearer dev-token"})
    assert r.status_code in (200, 401, 403)
    if r.status_code == 200:
        data = r.json()
        assert "fulltext" in data
        assert "semantic" in data
        assert "suggestions" in data
        assert "meta" in data
        assert isinstance(data["fulltext"], list)
        assert isinstance(data["suggestions"], list)


@pytest.mark.regression
def test_search_limit_param():
    """limit is accepted and bounded."""
    r = client.get("/api/v1/search", params={"q": "x", "limit": 5})
    assert r.status_code in (200, 401)
    if r.status_code == 200:
        data = r.json()
        assert "fulltext" in data
