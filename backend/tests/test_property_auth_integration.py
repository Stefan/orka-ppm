"""
Property-Based Tests for Auth Integration

Feature: rbac-enhancement, Task 4.3: Property tests for auth integration

**Validates: Requirements 2.2, 2.3, 2.5**

Property Definitions:
- Property 6: Role Change Synchronization
  *For any* user role modification, the Auth_Integration must update the user's 
  session to reflect new permissions accurately

- Property 7: Auth System Bridge Consistency
  *For any* access to Supabase auth.roles, the integration must provide consistent 
  bridging to the custom roles system

- Property 8: Role Aggregation Accuracy
  *For any* user with multiple assigned roles, the system must correctly aggregate 
  permissions across all roles without duplication or omission

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
import jwt
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import List, Dict, Any, Set, Optional
from unittest.mock import AsyncMock, MagicMock, patch, Mock

from auth.supabase_rbac_bridge import SupabaseRBACBridge
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs for testing."""
    # Generate random UUIDs, avoiding the dev user IDs
    dev_ids = {
        "00000000-0000-0000-0000-000000000001",
        "bf1b1732-2449-4987-9fdb-fefa2a93b816"
    }
    uuid_val = draw(st.uuids())
    assume(str(uuid_val) not in dev_ids)
    return uuid_val


@st.composite
def user_role_strategy(draw):
    """Generate valid UserRole values."""
    return draw(st.sampled_from(list(UserRole)))


@st.composite
def permission_strategy(draw):
    """Generate valid Permission values."""
    return draw(st.sampled_from(list(Permission)))


@st.composite
def role_name_strategy(draw):
    """Generate valid role names."""
    return draw(st.sampled_from([r.value for r in UserRole]))


@st.composite
def role_change_type_strategy(draw):
    """Generate valid role change types."""
    return draw(st.sampled_from(["added", "removed", "modified"]))


@st.composite
def mock_role_data_strategy(draw, role_name: Optional[str] = None):
    """Generate mock role data as returned from database."""
    if role_name is None:
        role_name = draw(role_name_strategy())
    
    try:
        role_enum = UserRole(role_name)
        permissions = [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(role_enum, [])]
    except ValueError:
        permissions = []
    
    return {
        "id": str(draw(st.uuids())),
        "name": role_name,
        "permissions": permissions,
        "is_active": True,
        "scope_type": None,
        "scope_id": None,
    }


@st.composite
def user_with_multiple_roles_strategy(draw):
    """Generate a user with multiple role assignments."""
    user_id = draw(uuid_strategy())
    num_roles = draw(st.integers(min_value=1, max_value=4))
    
    # Generate unique roles
    all_roles = list(UserRole)
    selected_roles = draw(st.lists(
        st.sampled_from(all_roles),
        min_size=num_roles,
        max_size=num_roles,
        unique=True
    ))
    
    role_data_list = []
    for role in selected_roles:
        role_data = {
            "id": str(draw(st.uuids())),
            "name": role.value,
            "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(role, [])],
            "is_active": True,
            "scope_type": None,
            "scope_id": None,
        }
        role_data_list.append(role_data)
    
    return user_id, role_data_list



# =============================================================================
# Helper Functions
# =============================================================================

def create_mock_supabase_client(user_roles_data: List[Dict[str, Any]] = None):
    """Create a mock Supabase client with configurable role data."""
    mock = MagicMock()
    mock_query = MagicMock()
    
    # Setup query chain
    mock_query.select = MagicMock(return_value=mock_query)
    mock_query.eq = MagicMock(return_value=mock_query)
    mock_query.is_ = MagicMock(return_value=mock_query)
    mock_query.insert = MagicMock(return_value=mock_query)
    
    # Setup execute to return the provided data
    if user_roles_data is None:
        user_roles_data = []
    
    mock_query.execute = MagicMock(return_value=MagicMock(data=user_roles_data))
    mock.table = MagicMock(return_value=mock_query)
    
    return mock


def create_mock_service_supabase_client():
    """Create a mock service role Supabase client."""
    mock = MagicMock()
    mock.auth = MagicMock()
    mock.auth.admin = MagicMock()
    mock.auth.admin.update_user_by_id = AsyncMock(return_value=MagicMock(user=MagicMock()))
    mock.auth.refresh_session = AsyncMock(return_value=MagicMock(
        session=MagicMock(),
        user=MagicMock()
    ))
    return mock


def create_user_roles_db_response(user_id: UUID, role_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create a mock database response for user_roles query."""
    response_data = []
    for role_data in role_data_list:
        response_data.append({
            "id": str(uuid4()),
            "user_id": str(user_id),
            "role_id": role_data["id"],
            "scope_type": role_data.get("scope_type"),
            "scope_id": role_data.get("scope_id"),
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None,
            "is_active": True,
            "roles": role_data,
        })
    return response_data



# =============================================================================
# Property 6: Role Change Synchronization
# **Validates: Requirements 2.2**
# =============================================================================

class TestRoleChangeSynchronization:
    """
    Property 6: Role Change Synchronization
    
    Feature: rbac-enhancement, Property 6: Role Change Synchronization
    **Validates: Requirements 2.2**
    
    For any user role modification, the Auth_Integration must update the user's 
    session to reflect new permissions accurately.
    """
    
    @given(
        user_id=uuid_strategy(),
        role_name=role_name_strategy(),
        change_type=role_change_type_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_role_change_triggers_session_update(self, user_id, role_name, change_type):
        """
        Property: For any role change, update_session_permissions must be called
        and cache must be cleared.
        
        **Validates: Requirements 2.2**
        """
        # Create mock clients
        mock_supabase = create_mock_supabase_client([])
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Notify role change
        result = await bridge.notify_role_change(user_id, change_type, role_name)
        
        # Should succeed
        assert result is True
        
        # Verify service client was called to update user metadata
        mock_service_supabase.auth.admin.update_user_by_id.assert_called()
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_session_update_clears_cache(self, user_id):
        """
        Property: For any user, updating session permissions must clear all
        cached data for that user.
        
        **Validates: Requirements 2.2**
        """
        # Create mock clients
        mock_supabase = create_mock_supabase_client([])
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Cache some data for the user
        cache_key = f"enhanced_user:{user_id}"
        await bridge.cache_data_advanced(cache_key, {"test": "data"})
        
        # Verify data is cached
        cached = await bridge.get_cached_data_advanced(cache_key)
        assert cached is not None
        
        # Update session permissions
        result = await bridge.update_session_permissions(user_id)
        assert result is True
        
        # Cache should be cleared
        cached_after = await bridge.get_cached_data_advanced(cache_key)
        assert cached_after is None

    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_sync_user_roles_updates_auth_metadata(self, user_id, role_data):
        """
        Property: For any user with roles, sync_user_roles must update Supabase
        auth metadata with current role information.
        
        **Validates: Requirements 2.2**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Sync user roles
        result = await bridge.sync_user_roles(user_id)
        
        # Should succeed
        assert result is True
        
        # Verify update_user_by_id was called with role information
        mock_service_supabase.auth.admin.update_user_by_id.assert_called_once()
        call_args = mock_service_supabase.auth.admin.update_user_by_id.call_args
        
        # Verify user_id was passed
        assert call_args[0][0] == str(user_id)
        
        # Verify user_metadata contains roles
        user_metadata = call_args[0][1]["user_metadata"]
        assert "roles" in user_metadata
        assert role_data["name"] in user_metadata["roles"]
        assert "permissions" in user_metadata
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_refresh_user_session_updates_permissions(self, user_id):
        """
        Property: For any user, refreshing session must update permissions and
        return updated user info.
        
        **Validates: Requirements 2.2**
        """
        # Create mock clients
        mock_supabase = create_mock_supabase_client([])
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Refresh user session
        result = await bridge.refresh_user_session(user_id)
        
        # Should return session data
        assert result is not None
        assert "permissions_updated" in result
        assert result["permissions_updated"] is True
        assert "user" in result
    
    @given(
        user_id=uuid_strategy(),
        num_changes=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_role_changes_maintain_consistency(self, user_id, num_changes):
        """
        Property: For any sequence of role changes, each change must properly
        update the session and maintain consistency.
        
        **Validates: Requirements 2.2**
        """
        # Create mock clients
        mock_supabase = create_mock_supabase_client([])
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Perform multiple role changes
        for i in range(num_changes):
            role_name = list(UserRole)[i % len(UserRole)].value
            change_type = ["added", "removed", "modified"][i % 3]
            
            result = await bridge.notify_role_change(user_id, change_type, role_name)
            assert result is True
        
        # Verify update was called for each change
        assert mock_service_supabase.auth.admin.update_user_by_id.call_count == num_changes



# =============================================================================
# Property 7: Auth System Bridge Consistency
# **Validates: Requirements 2.3**
# =============================================================================

class TestAuthSystemBridgeConsistency:
    """
    Property 7: Auth System Bridge Consistency
    
    Feature: rbac-enhancement, Property 7: Auth System Bridge Consistency
    **Validates: Requirements 2.3**
    
    For any access to Supabase auth.roles, the integration must provide consistent 
    bridging to the custom roles system.
    """
    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_jwt_token_enhancement_includes_roles(self, user_id, role_data):
        """
        Property: For any user with roles, JWT token enhancement must include
        complete role and permission information.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Enhance JWT token
        enhanced_payload = await bridge.enhance_jwt_token(user_id)
        
        # Should contain role information
        assert "roles" in enhanced_payload
        assert "permissions" in enhanced_payload
        assert "effective_roles" in enhanced_payload
        assert "enhanced_at" in enhanced_payload
        
        # Role name should be in the roles list
        assert role_data["name"] in enhanced_payload["roles"]
        
        # Permissions should include role's permissions
        for perm in role_data["permissions"]:
            assert perm in enhanced_payload["permissions"]
    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_enhanced_token_string_is_valid_jwt(self, user_id, role_data):
        """
        Property: For any user, created enhanced token string must be a valid
        JWT that can be decoded and validated.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Create enhanced token string
        secret_key = "test-secret-key-12345678901234567890"
        token = await bridge.create_enhanced_token_string(user_id, secret_key)
        
        # Should create a token
        assert token is not None
        assert isinstance(token, str)
        
        # Should be decodable
        decoded = jwt.decode(token, secret_key, algorithms=["HS256"])
        assert decoded["sub"] == str(user_id)
        assert "roles" in decoded
        assert "permissions" in decoded

    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_extract_roles_from_token_consistency(self, user_id, role_data):
        """
        Property: For any enhanced token, extracting roles must return the same
        information that was used to create the token.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Create enhanced token
        secret_key = "test-secret-key-12345678901234567890"
        token = await bridge.create_enhanced_token_string(user_id, secret_key)
        
        # Extract roles from token
        role_info = await bridge.extract_roles_from_token(token)
        
        # Should be marked as enhanced
        assert role_info["is_enhanced"] is True
        
        # Should contain user ID
        assert role_info["user_id"] == str(user_id)
        
        # Should contain role name
        assert role_data["name"] in role_info["roles"]
        
        # Should contain permissions
        for perm in role_data["permissions"]:
            assert perm in role_info["permissions"]
    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_validate_enhanced_token_accepts_valid_tokens(self, user_id, role_data):
        """
        Property: For any valid enhanced token, validation must succeed and
        return the decoded payload.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Create enhanced token
        secret_key = "test-secret-key-12345678901234567890"
        token = await bridge.create_enhanced_token_string(user_id, secret_key)
        
        # Validate token
        validated = await bridge.validate_enhanced_token(token, secret_key)
        
        # Should validate successfully
        assert validated is not None
        assert validated["sub"] == str(user_id)
        assert "roles" in validated
        assert "permissions" in validated
    
    @given(user_id=uuid_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_validate_enhanced_token_rejects_expired_tokens(self, user_id):
        """
        Property: For any expired token, validation must fail and return None.
        
        **Validates: Requirements 2.3**
        """
        # Create mock clients
        mock_supabase = create_mock_supabase_client([])
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Create an expired token manually
        secret_key = "test-secret-key-12345678901234567890"
        payload = {
            "sub": str(user_id),
            "roles": ["viewer"],
            "permissions": [],
            "iat": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
        }
        expired_token = jwt.encode(payload, secret_key, algorithm="HS256")
        
        # Validate expired token
        validated = await bridge.validate_enhanced_token(expired_token, secret_key)
        
        # Should fail validation
        assert validated is None

    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_get_user_from_jwt_retrieves_enhanced_info(self, user_id, role_data):
        """
        Property: For any JWT token, get_user_from_jwt must retrieve enhanced
        user information including roles and permissions.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Create a JWT token
        token = jwt.encode(
            {"sub": str(user_id), "email": "test@example.com"},
            "secret",
            algorithm="HS256"
        )
        
        # Get user from JWT
        user_info = await bridge.get_user_from_jwt(token)
        
        # Should retrieve user info
        assert user_info is not None
        assert user_info["user_id"] == str(user_id)
        assert "roles" in user_info
        assert "permissions" in user_info
        
        # Should include the role
        assert role_data["name"] in user_info["roles"]
    
    @given(
        user_id=uuid_strategy(),
        role_data=mock_role_data_strategy()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_get_enhanced_user_info_uses_cache(self, user_id, role_data):
        """
        Property: For any user, multiple calls to get_enhanced_user_info should
        use cache and return consistent results.
        
        **Validates: Requirements 2.3**
        """
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, [role_data])
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # First call - should hit database
        user_info_1 = await bridge.get_enhanced_user_info(user_id)
        
        # Second call - should hit cache
        user_info_2 = await bridge.get_enhanced_user_info(user_id)
        
        # Should return consistent results
        assert user_info_1 is not None
        assert user_info_2 is not None
        assert user_info_1["user_id"] == user_info_2["user_id"]
        assert set(user_info_1["roles"]) == set(user_info_2["roles"])
        assert set(user_info_1["permissions"]) == set(user_info_2["permissions"])



# =============================================================================
# Property 8: Role Aggregation Accuracy
# **Validates: Requirements 2.5**
# =============================================================================

class TestRoleAggregationAccuracy:
    """
    Property 8: Role Aggregation Accuracy
    
    Feature: rbac-enhancement, Property 8: Role Aggregation Accuracy
    **Validates: Requirements 2.5**
    
    For any user with multiple assigned roles, the system must correctly aggregate 
    permissions across all roles without duplication or omission.
    """
    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_roles_aggregate_all_permissions(self, user_with_roles):
        """
        Property: For any user with multiple roles, get_enhanced_user_info must
        return the union of all permissions from all roles.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Calculate expected permissions (union of all role permissions)
        expected_permissions: Set[str] = set()
        for role_data in role_data_list:
            expected_permissions.update(role_data["permissions"])
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get enhanced user info
        user_info = await bridge.get_enhanced_user_info(user_id)
        
        # Should have all roles
        assert len(user_info["roles"]) == len(role_data_list)
        
        # Should have aggregated permissions (union)
        actual_permissions = set(user_info["permissions"])
        assert actual_permissions == expected_permissions
    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_aggregated_permissions_have_no_duplicates(self, user_with_roles):
        """
        Property: For any user with multiple roles, aggregated permissions must
        not contain duplicates.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get enhanced user info
        user_info = await bridge.get_enhanced_user_info(user_id)
        
        # Permissions should have no duplicates
        permissions_list = user_info["permissions"]
        permissions_set = set(permissions_list)
        
        assert len(permissions_list) == len(permissions_set)

    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_no_permissions_omitted_in_aggregation(self, user_with_roles):
        """
        Property: For any user with multiple roles, no permissions from any role
        should be omitted in the aggregation.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get enhanced user info
        user_info = await bridge.get_enhanced_user_info(user_id)
        
        # Check that all permissions from all roles are present
        actual_permissions = set(user_info["permissions"])
        
        for role_data in role_data_list:
            for permission in role_data["permissions"]:
                assert permission in actual_permissions, \
                    f"Permission {permission} from role {role_data['name']} was omitted"
    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_effective_roles_list_includes_all_roles(self, user_with_roles):
        """
        Property: For any user with multiple roles, effective_roles list must
        include all assigned roles.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get enhanced user info
        user_info = await bridge.get_enhanced_user_info(user_id)
        
        # Should have effective roles for each assigned role
        effective_roles = user_info["effective_roles"]
        assert len(effective_roles) == len(role_data_list)
        
        # Each role should be represented
        effective_role_names = {er["role_name"] for er in effective_roles}
        expected_role_names = {rd["name"] for rd in role_data_list}
        assert effective_role_names == expected_role_names
    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_sync_roles_includes_all_aggregated_permissions(self, user_with_roles):
        """
        Property: For any user with multiple roles, sync_user_roles must update
        auth metadata with all aggregated permissions.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Calculate expected permissions
        expected_permissions: Set[str] = set()
        for role_data in role_data_list:
            expected_permissions.update(role_data["permissions"])
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Sync user roles
        result = await bridge.sync_user_roles(user_id)
        assert result is True
        
        # Verify update_user_by_id was called with aggregated permissions
        call_args = mock_service_supabase.auth.admin.update_user_by_id.call_args
        user_metadata = call_args[0][1]["user_metadata"]
        
        # Should have all permissions
        actual_permissions = set(user_metadata["permissions"])
        assert actual_permissions == expected_permissions

    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_jwt_enhancement_includes_all_aggregated_permissions(self, user_with_roles):
        """
        Property: For any user with multiple roles, JWT token enhancement must
        include all aggregated permissions.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Calculate expected permissions
        expected_permissions: Set[str] = set()
        for role_data in role_data_list:
            expected_permissions.update(role_data["permissions"])
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Enhance JWT token
        enhanced_payload = await bridge.enhance_jwt_token(user_id)
        
        # Should include all aggregated permissions
        actual_permissions = set(enhanced_payload["permissions"])
        assert actual_permissions == expected_permissions
    
    @given(
        user_id=uuid_strategy(),
        num_roles=st.integers(min_value=2, max_value=4)
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_permission_aggregation_is_idempotent(self, user_id, num_roles):
        """
        Property: For any user with multiple roles, aggregating permissions
        multiple times should produce the same result.
        
        **Validates: Requirements 2.5**
        """
        # Select unique roles
        all_roles = list(UserRole)[:num_roles]
        role_data_list = []
        
        for role in all_roles:
            role_data = {
                "id": str(uuid4()),
                "name": role.value,
                "permissions": [p.value for p in DEFAULT_ROLE_PERMISSIONS.get(role, [])],
                "is_active": True,
                "scope_type": None,
                "scope_id": None,
            }
            role_data_list.append(role_data)
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get user info multiple times
        user_info_1 = await bridge.get_enhanced_user_info(user_id)
        
        # Clear cache and get again
        bridge.clear_all_cache()
        user_info_2 = await bridge.get_enhanced_user_info(user_id)
        
        # Permissions should be identical
        assert set(user_info_1["permissions"]) == set(user_info_2["permissions"])
    
    @given(user_with_roles=user_with_multiple_roles_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_role_summary_reflects_aggregated_permissions(self, user_with_roles):
        """
        Property: For any user with multiple roles, get_user_role_summary must
        accurately reflect the count of aggregated permissions.
        
        **Validates: Requirements 2.5**
        """
        user_id, role_data_list = user_with_roles
        
        # Calculate expected permission count
        expected_permissions: Set[str] = set()
        for role_data in role_data_list:
            expected_permissions.update(role_data["permissions"])
        
        # Create mock database response
        db_response = create_user_roles_db_response(user_id, role_data_list)
        
        # Create mock clients
        mock_supabase = create_mock_supabase_client(db_response)
        mock_service_supabase = create_mock_service_supabase_client()
        
        # Create bridge
        bridge = SupabaseRBACBridge(
            supabase_client=mock_supabase,
            service_supabase_client=mock_service_supabase
        )
        
        # Get role summary
        summary = await bridge.get_user_role_summary(user_id)
        
        # Should reflect correct counts
        assert summary["role_count"] == len(role_data_list)
        assert summary["permissions_count"] == len(expected_permissions)
        assert summary["has_roles"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
