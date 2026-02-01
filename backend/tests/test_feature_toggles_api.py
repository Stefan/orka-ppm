"""
Unit tests for Feature Toggle System API (feature_toggles router).
Design: .kiro/specs/feature-toggle-system/design.md
Tasks: 2.3, 3, 4, 5, 6
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# Add parent for imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture
def mock_supabase():
    with patch("routers.feature_toggles.supabase") as m:
        yield m


@pytest.fixture
def mock_get_current_user():
    with patch("routers.feature_toggles.get_current_user", new_callable=AsyncMock) as m:
        yield m


@pytest.fixture
def mock_require_admin():
    with patch("routers.feature_toggles.require_admin", new_callable=MagicMock) as m:
        def _dep():
            async def _inner():
                return {"user_id": str(uuid4()), "tenant_id": str(uuid4())}
            return _inner
        m.return_value = _dep()
        yield m


@pytest.mark.asyncio
async def test_get_features_returns_merged_flags(mock_supabase, mock_get_current_user):
    """GET /api/features returns flags merged (org overrides global)."""
    from routers.feature_toggles import get_features

    mock_get_current_user.return_value = {"user_id": "u1", "tenant_id": "org-1"}
    mock_supabase.table.return_value.select.return_value.or_.return_value.execute.return_value = MagicMock(
        data=[
            {"id": "f1", "name": "x", "enabled": False, "organization_id": None, "description": "d", "created_at": "2024-01-01T00:00:00Z", "updated_at": "2024-01-01T00:00:00Z"},
            {"id": "f2", "name": "x", "enabled": True, "organization_id": "org-1", "description": "d2", "created_at": "2024-01-01T00:00:00Z", "updated_at": "2024-01-01T00:00:00Z"},
        ]
    )
    result = await get_features(user=mock_get_current_user.return_value)
    assert "flags" in result
    assert len(result["flags"]) == 1  # merged by name, org override
    assert result["flags"][0].name == "x"
    assert result["flags"][0].enabled is True


@pytest.mark.asyncio
async def test_get_features_list_all_returns_all_rows(mock_supabase, mock_get_current_user):
    """GET /api/features?list_all=true returns all rows without merging."""
    from routers.feature_toggles import get_features

    mock_get_current_user.return_value = {"user_id": "u1", "tenant_id": "org-1"}
    mock_supabase.table.return_value.select.return_value.or_.return_value.execute.return_value = MagicMock(
        data=[
            {"id": "f1", "name": "x", "enabled": False, "organization_id": None, "description": "d", "created_at": "2024-01-01T00:00:00Z", "updated_at": "2024-01-01T00:00:00Z"},
            {"id": "f2", "name": "x", "enabled": True, "organization_id": "org-1", "description": "d2", "created_at": "2024-01-01T00:00:00Z", "updated_at": "2024-01-01T00:00:00Z"},
        ]
    )
    result = await get_features(user=mock_get_current_user.return_value, list_all=True)
    assert "flags" in result
    assert len(result["flags"]) == 2


def test_name_format_validation():
    """Name must be alphanumeric, underscore, hyphen only (Property 11)."""
    from schemas.feature_toggles import FeatureToggleCreate

    FeatureToggleCreate(name="valid_name", enabled=False)
    FeatureToggleCreate(name="valid-name", enabled=False)
    FeatureToggleCreate(name="Valid123", enabled=False)
    with pytest.raises(ValueError):
        FeatureToggleCreate(name="invalid name", enabled=False)
    with pytest.raises(ValueError):
        FeatureToggleCreate(name="invalid@", enabled=False)
