"""
Integration tests for authentication flows.
Enterprise Test Strategy - Task 3.5
Requirements: 6.6
"""

import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.integration
@pytest.mark.asyncio
async def test_token_extraction_fallback():
    """Token extraction falls back to JWT decode when bridge unavailable."""
    with patch("auth.supabase_rbac_bridge.get_supabase_rbac_bridge", side_effect=ImportError):
        from auth.dependencies import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials
        with patch("auth.dependencies.jwt.decode") as mock_decode:
            mock_decode.return_value = {
                "sub": "user-abc",
                "email": "user@test.com",
                "roles": ["viewer"],
            }
            creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
            user = await get_current_user(credentials=creds)
            assert user["user_id"] == "user-abc"
            assert user["email"] == "user@test.com"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_no_credentials_returns_dev_user():
    """No credentials returns development default user."""
    from auth.dependencies import get_current_user
    user = await get_current_user(credentials=None)
    assert user["user_id"] == "00000000-0000-0000-0000-000000000001"
    assert "admin" in user.get("roles", [])
