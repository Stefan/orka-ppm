"""
Unit tests for JWT / auth token handling.
Enterprise Test Strategy - Task 2.1
Requirements: 5.1, 5.3, 5.4
"""

import pytest
from unittest.mock import patch


@pytest.mark.unit
@pytest.mark.asyncio
async def test_missing_credentials_returns_dev_user():
    """When no credentials, dev fallback returns admin user."""
    from auth.dependencies import get_current_user

    result = await get_current_user(credentials=None)
    assert result is not None
    assert result.get("user_id") == "00000000-0000-0000-0000-000000000001"
    assert result.get("email") == "dev@example.com"
    assert result.get("roles") == ["admin"] or "admin" in result.get("roles", [])


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize("token_sub,expected_id", [
    ("user-123", "user-123"),
    ("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000002"),
])
async def test_jwt_decode_extracts_sub(token_sub, expected_id):
    """JWT decode fallback extracts sub as user_id."""
    with patch("auth.dependencies.jwt.decode") as mock_decode:
        mock_decode.return_value = {
            "sub": token_sub,
            "email": "test@example.com",
            "roles": ["viewer"],
        }
        from auth.dependencies import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake-token")
        with patch("auth.dependencies.get_supabase_rbac_bridge", side_effect=ImportError):
            result = await get_current_user(credentials=creds)
        assert result.get("user_id") == expected_id
        assert result.get("email") == "test@example.com"
