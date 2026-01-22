"""
Property-Based Tests for Viewer Role Restrictions

This module contains property-based tests for viewer role restrictions:
- Property 23: Viewer Read-Only Access Enforcement
- Property 24: Viewer Write Operation Prevention
- Property 25: Financial Data Access Filtering
- Property 26: Organizational Report Access Control
- Property 27: Read-Only UI Indication

Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from uuid import UUID, uuid4
from typing import List, Dict, Any, Set

from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS
from auth.enhanced_rbac_models import PermissionContext, ScopeType
from auth.viewer_restrictions import ViewerRestrictionChecker
from auth.enhanced_permission_checker import EnhancedPermissionChecker


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def permission_checker():
    """Create an EnhancedPermissionChecker without database connection."""
    return EnhancedPermissionChecker(supabase_client=None)


@pytest.fixture
def viewer_checker(permission_checker):
    """Create a ViewerRestrictionChecker."""
    return ViewerRestrictionChecker(permission_checker=permission_checker)


# =============================================================================
# Hypothesis Strategies
# =============================================================================

@st.composite
def user_id_strategy(draw):
    """Generate a valid UUID for user ID."""
    return uuid4()


@st.composite
def permission_context_strategy(draw):
    """Generate a valid PermissionContext."""
    has_project = draw(st.booleans())
    has_portfolio = draw(st.booleans())
    has_organization = draw(st.booleans())
    
    return PermissionContext(
        project_id=uuid4() if has_project else None,
        portfolio_id=uuid4() if has_portfolio else None,
        organization_id=uuid4() if has_organization else None,
    )


@st.composite
def write_permission_strategy(draw):
    """Generate a write permission from the WRITE_PERMISSIONS set."""
    write_perms = list(ViewerRestrictionChecker.WRITE_PERMISSIONS)
    return draw(st.sampled_from(write_perms))


@st.composite
def read_permission_strategy(draw):
    """Generate a read permission from the READ_PERMISSIONS set."""
    read_perms = list(ViewerRestrictionChecker.READ_PERMISSIONS)
    return draw(st.sampled_from(read_perms))


@st.composite
def financial_data_strategy(draw):
    """Generate sample financial data."""
    return {
        "total_budget": draw(st.floats(min_value=0, max_value=10000000)),
        "total_spent": draw(st.floats(min_value=0, max_value=10000000)),
        "total_remaining": draw(st.floats(min_value=0, max_value=10000000)),
        "budget_variance": draw(st.floats(min_value=-1000000, max_value=1000000)),
        "budget_variance_percentage": draw(st.floats(min_value=-100, max_value=100)),
        "currency": draw(st.sampled_from(["USD", "EUR", "GBP"])),
        "project_id": str(uuid4()),
        "line_items": [
            {"description": "Item 1", "cost": 1000},
            {"description": "Item 2", "cost": 2000},
        ],
        "vendor_details": {
            "vendor_name": "Vendor A",
            "contract_number": "C-12345",
        },
    }


# =============================================================================
# Property 23: Viewer Read-Only Access Enforcement
# Validates: Requirements 6.1
# =============================================================================

class TestProperty23ViewerReadOnlyAccess:
    """
    Property 23: Viewer Read-Only Access Enforcement
    
    Property: Users with only viewer permissions should be identified as viewer-only
    and should not have any write permissions.
    
    **Validates: Requirements 6.1**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_only_users_have_no_write_permissions(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        context
    ):
        """
        Property: If a user is identified as viewer-only, they should have
        no write permissions in their permission set.
        
        **Validates: Requirements 6.1**
        """
        # Mock the permission checker to return only viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Check if user is viewer-only
        is_viewer = await viewer_checker.is_viewer_only(user_id, context)
        
        # Property: Viewer-only users should be identified as such
        assert is_viewer is True
        
        # Get user's permissions
        user_permissions = await permission_checker.get_user_permissions(user_id, context)
        user_permissions_set = set(user_permissions)
        
        # Property: No write permissions should be present
        write_permissions_present = user_permissions_set & ViewerRestrictionChecker.WRITE_PERMISSIONS
        assert len(write_permissions_present) == 0, \
            f"Viewer-only user has write permissions: {write_permissions_present}"
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_non_viewer_users_have_write_permissions(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        context
    ):
        """
        Property: If a user is not viewer-only, they should have at least
        one write permission in their permission set.
        
        **Validates: Requirements 6.1**
        """
        # Mock the permission checker to return admin permissions (includes write)
        async def mock_get_user_permissions(uid, ctx):
            return DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Check if user is viewer-only
        is_viewer = await viewer_checker.is_viewer_only(user_id, context)
        
        # Property: Non-viewer users should not be identified as viewer-only
        assert is_viewer is False
        
        # Get user's permissions
        user_permissions = await permission_checker.get_user_permissions(user_id, context)
        user_permissions_set = set(user_permissions)
        
        # Property: At least one write permission should be present
        write_permissions_present = user_permissions_set & ViewerRestrictionChecker.WRITE_PERMISSIONS
        assert len(write_permissions_present) > 0, \
            "Non-viewer user has no write permissions"


# =============================================================================
# Property 24: Viewer Write Operation Prevention
# Validates: Requirements 6.2
# =============================================================================

class TestProperty24ViewerWritePrevention:
    """
    Property 24: Viewer Write Operation Prevention
    
    Property: Viewer-only users should be prevented from performing any
    write operations, regardless of the operation type.
    
    **Validates: Requirements 6.2**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        operation=st.text(min_size=1, max_size=50),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_write_operations_are_prevented(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        operation,
        context
    ):
        """
        Property: All write operations by viewer-only users should be denied
        with an appropriate error message.
        
        **Validates: Requirements 6.2**
        """
        # Mock the permission checker to return only viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Attempt write operation
        is_allowed, error_message = await viewer_checker.prevent_write_operation(
            user_id, operation, context
        )
        
        # Property: Write operation should be denied
        assert is_allowed is False, \
            f"Viewer-only user was allowed to perform write operation: {operation}"
        
        # Property: Error message should be provided
        assert error_message is not None, \
            "No error message provided for denied write operation"
        assert "read-only" in error_message.lower() or "write" in error_message.lower(), \
            f"Error message doesn't mention read-only or write: {error_message}"
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        operation=st.text(min_size=1, max_size=50),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_non_viewer_write_operations_are_allowed(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        operation,
        context
    ):
        """
        Property: Write operations by non-viewer users should be allowed.
        
        **Validates: Requirements 6.2**
        """
        # Mock the permission checker to return admin permissions
        async def mock_get_user_permissions(uid, ctx):
            return DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Attempt write operation
        is_allowed, error_message = await viewer_checker.prevent_write_operation(
            user_id, operation, context
        )
        
        # Property: Write operation should be allowed
        assert is_allowed is True, \
            f"Non-viewer user was denied write operation: {operation}"
        
        # Property: No error message should be provided
        assert error_message is None, \
            f"Error message provided for allowed operation: {error_message}"


# =============================================================================
# Property 25: Financial Data Access Filtering
# Validates: Requirements 6.3
# =============================================================================

class TestProperty25FinancialDataFiltering:
    """
    Property 25: Financial Data Access Filtering
    
    Property: Financial data should be filtered based on user's access level,
    with viewers receiving only summary data and non-viewers receiving full data.
    
    **Validates: Requirements 6.3**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        financial_data=financial_data_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_financial_data_is_filtered(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        financial_data,
        context
    ):
        """
        Property: Viewers should receive filtered financial data with
        sensitive details removed.
        
        **Validates: Requirements 6.3**
        """
        # Mock the permission checker to return viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        async def mock_check_permission(uid, perm, ctx):
            return perm == Permission.financial_read
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        permission_checker.check_permission = mock_check_permission
        
        # Get access level
        access_level = await viewer_checker.get_financial_data_access_level(user_id, context)
        
        # Property: Viewers should have summary access
        assert access_level == "summary", \
            f"Viewer has unexpected access level: {access_level}"
        
        # Filter financial data
        filtered_data = await viewer_checker.filter_financial_data(
            user_id, financial_data, context
        )
        
        # Property: Sensitive fields should be removed
        assert "line_items" not in filtered_data, \
            "Viewer can see line items (sensitive data)"
        assert "vendor_details" not in filtered_data, \
            "Viewer can see vendor details (sensitive data)"
        
        # Property: Summary fields should be present
        summary_fields = {"total_budget", "total_spent", "total_remaining"}
        for field in summary_fields:
            if field in financial_data:
                assert field in filtered_data, \
                    f"Summary field '{field}' missing from filtered data"
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        financial_data=financial_data_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_non_viewer_financial_data_is_not_filtered(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        financial_data,
        context
    ):
        """
        Property: Non-viewers should receive complete financial data
        without filtering.
        
        **Validates: Requirements 6.3**
        """
        # Mock the permission checker to return admin permissions
        async def mock_get_user_permissions(uid, ctx):
            return DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        async def mock_check_permission(uid, perm, ctx):
            return perm == Permission.financial_read
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        permission_checker.check_permission = mock_check_permission
        
        # Get access level
        access_level = await viewer_checker.get_financial_data_access_level(user_id, context)
        
        # Property: Non-viewers should have full access
        assert access_level == "full", \
            f"Non-viewer has unexpected access level: {access_level}"
        
        # Filter financial data
        filtered_data = await viewer_checker.filter_financial_data(
            user_id, financial_data, context
        )
        
        # Property: All original data should be present
        assert filtered_data == financial_data, \
            "Non-viewer's financial data was filtered"


# =============================================================================
# Property 26: Organizational Report Access Control
# Validates: Requirements 6.4
# =============================================================================

class TestProperty26ReportAccessControl:
    """
    Property 26: Organizational Report Access Control
    
    Property: Report access should be controlled based on organizational scope,
    with viewers restricted to their organizational level.
    
    **Validates: Requirements 6.4**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        report_type=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_report_access_within_scope(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        report_type
    ):
        """
        Property: Viewers should be able to access reports within their
        organizational scope.
        
        **Validates: Requirements 6.4**
        """
        # Mock the permission checker to return viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        async def mock_check_permission(uid, perm, ctx):
            return perm == Permission.report_read
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        permission_checker.check_permission = mock_check_permission
        
        # Same organizational context for report and user
        org_id = uuid4()
        report_scope = PermissionContext(organization_id=org_id)
        user_context = PermissionContext(organization_id=org_id)
        
        # Check report access
        can_access, denial_reason = await viewer_checker.can_access_report(
            user_id, report_type, report_scope, user_context
        )
        
        # Property: Access should be granted within scope
        assert can_access is True, \
            f"Viewer denied access to report within scope: {denial_reason}"
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        report_type=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_report_access_outside_scope(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        report_type
    ):
        """
        Property: Viewers should be denied access to reports outside their
        organizational scope.
        
        **Validates: Requirements 6.4**
        """
        # Mock the permission checker to return viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        async def mock_check_permission(uid, perm, ctx):
            return perm == Permission.report_read
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        permission_checker.check_permission = mock_check_permission
        
        # Different organizational contexts for report and user
        report_scope = PermissionContext(organization_id=uuid4())
        user_context = PermissionContext(organization_id=uuid4())
        
        # Check report access
        can_access, denial_reason = await viewer_checker.can_access_report(
            user_id, report_type, report_scope, user_context
        )
        
        # Property: Access should be denied outside scope
        assert can_access is False, \
            "Viewer granted access to report outside scope"
        assert denial_reason is not None, \
            "No denial reason provided for out-of-scope access"


# =============================================================================
# Property 27: Read-Only UI Indication
# Validates: Requirements 6.5
# =============================================================================

class TestProperty27ReadOnlyUIIndication:
    """
    Property 27: Read-Only UI Indication
    
    Property: UI indicators should correctly reflect user's read-only status
    and provide appropriate information about disabled features.
    
    **Validates: Requirements 6.5**
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_viewer_ui_indicators_show_read_only(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        context
    ):
        """
        Property: UI indicators for viewer-only users should indicate
        read-only access and list disabled features.
        
        **Validates: Requirements 6.5**
        """
        # Mock the permission checker to return viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Get UI indicators
        indicators = await viewer_checker.get_ui_indicators(user_id, context)
        
        # Property: Should indicate read-only access
        assert indicators["is_read_only"] is True, \
            "Viewer not marked as read-only"
        
        # Property: Should show read-only badge
        assert indicators["show_read_only_badge"] is True, \
            "Read-only badge not shown for viewer"
        
        # Property: Should have UI message
        assert indicators["ui_message"] is not None, \
            "No UI message provided for viewer"
        
        # Property: Should list disabled features
        assert isinstance(indicators["disabled_features"], list), \
            "Disabled features not provided as list"
        assert len(indicators["disabled_features"]) > 0, \
            "No disabled features listed for viewer"
    
    @pytest.mark.asyncio
    @given(
        user_id=user_id_strategy(),
        context=st.one_of(st.none(), permission_context_strategy())
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_non_viewer_ui_indicators_show_full_access(
        self,
        viewer_checker,
        permission_checker,
        user_id,
        context
    ):
        """
        Property: UI indicators for non-viewer users should indicate
        full access without read-only restrictions.
        
        **Validates: Requirements 6.5**
        """
        # Mock the permission checker to return admin permissions
        async def mock_get_user_permissions(uid, ctx):
            return DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        
        # Get UI indicators
        indicators = await viewer_checker.get_ui_indicators(user_id, context)
        
        # Property: Should not indicate read-only access
        assert indicators["is_read_only"] is False, \
            "Non-viewer marked as read-only"
        
        # Property: Should not show read-only badge
        assert indicators["show_read_only_badge"] is False, \
            "Read-only badge shown for non-viewer"
        
        # Property: Should have empty disabled features list
        assert len(indicators["disabled_features"]) == 0, \
            f"Non-viewer has disabled features: {indicators['disabled_features']}"


# =============================================================================
# Integration Tests
# =============================================================================

class TestViewerRestrictionsIntegration:
    """Integration tests for viewer restrictions."""
    
    @pytest.mark.asyncio
    async def test_complete_viewer_workflow(self, viewer_checker, permission_checker):
        """
        Test complete workflow for viewer restrictions.
        
        **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
        """
        user_id = uuid4()
        context = PermissionContext(project_id=uuid4())
        
        # Mock viewer permissions
        async def mock_get_user_permissions(uid, ctx):
            return list(ViewerRestrictionChecker.READ_PERMISSIONS)
        
        async def mock_check_permission(uid, perm, ctx):
            return perm in ViewerRestrictionChecker.READ_PERMISSIONS
        
        permission_checker.get_user_permissions = mock_get_user_permissions
        permission_checker.check_permission = mock_check_permission
        
        # 1. Check viewer-only status
        is_viewer = await viewer_checker.is_viewer_only(user_id, context)
        assert is_viewer is True
        
        # 2. Prevent write operation
        is_allowed, error = await viewer_checker.prevent_write_operation(
            user_id, "update_project", context
        )
        assert is_allowed is False
        assert error is not None
        
        # 3. Check financial access level
        access_level = await viewer_checker.get_financial_data_access_level(user_id, context)
        assert access_level == "summary"
        
        # 4. Get UI indicators
        indicators = await viewer_checker.get_ui_indicators(user_id, context)
        assert indicators["is_read_only"] is True
        assert indicators["show_read_only_badge"] is True
