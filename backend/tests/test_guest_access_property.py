"""
Property-Based Tests for Guest Access Controller

This module contains property-based tests using Hypothesis to validate
universal correctness properties of the guest access control system.

Feature: shareable-project-urls

Properties tested:
- Property 2: Permission Enforcement Consistency (Requirements 2.2, 2.3, 2.4, 2.5)
- Property 3: Time-Based Access Control (Requirements 3.2, 3.3)
- Property 5: Data Filtering Accuracy (Requirements 2.3, 2.4, 2.5, 5.2)

Requirements: 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 5.2
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock
from uuid import uuid4

from services.guest_access_controller import GuestAccessController
from models.shareable_urls import SharePermissionLevel


# ==================== Custom Strategies ====================

@st.composite
def valid_tokens(draw):
    """Generate valid 64-character URL-safe tokens"""
    chars = st.sampled_from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
    return ''.join(draw(chars) for _ in range(64))


@st.composite
def share_permission_levels(draw):
    """Generate valid share permission levels"""
    return draw(st.sampled_from([
        SharePermissionLevel.VIEW_ONLY,
        SharePermissionLevel.LIMITED_DATA,
        SharePermissionLevel.FULL_PROJECT
    ]))


@st.composite
def datetime_with_timezone(draw, min_days=-365, max_days=365):
    """Generate timezone-aware datetime objects"""
    days_offset = draw(st.integers(min_value=min_days, max_value=max_days))
    hours_offset = draw(st.integers(min_value=0, max_value=23))
    minutes_offset = draw(st.integers(min_value=0, max_value=59))
    
    base_time = datetime.now(timezone.utc)
    offset = timedelta(days=days_offset, hours=hours_offset, minutes=minutes_offset)
    return base_time + offset


@st.composite
def project_data_with_sensitive_fields(draw):
    """Generate project data with various sensitive and non-sensitive fields"""
    project_id = str(uuid4())
    
    # Always include basic fields
    data = {
        'id': project_id,
        'name': draw(st.text(min_size=1, max_size=100)),
        'description': draw(st.one_of(st.none(), st.text(max_size=500))),
        'status': draw(st.sampled_from(['active', 'completed', 'on_hold', 'cancelled'])),
        'progress_percentage': draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=100.0))),
        'start_date': None,
        'end_date': None,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    
    # Optionally add dates
    if draw(st.booleans()):
        start_date = draw(st.dates())
        data['start_date'] = start_date.isoformat()
    if draw(st.booleans()):
        end_date = draw(st.dates())
        data['end_date'] = end_date.isoformat()
    
    # Randomly include sensitive financial fields
    if draw(st.booleans()):
        data['budget'] = draw(st.floats(min_value=0, max_value=10000000))
    if draw(st.booleans()):
        data['actual_cost'] = draw(st.floats(min_value=0, max_value=10000000))
    if draw(st.booleans()):
        data['spent'] = draw(st.floats(min_value=0, max_value=10000000))
    if draw(st.booleans()):
        data['financial_data'] = {'q1': draw(st.floats(min_value=0, max_value=1000000))}
    
    # Randomly include sensitive internal notes
    if draw(st.booleans()):
        data['internal_notes'] = draw(st.text(max_size=200))
    if draw(st.booleans()):
        data['private_notes'] = draw(st.text(max_size=200))
    if draw(st.booleans()):
        data['confidential_notes'] = draw(st.text(max_size=200))
    
    # Randomly include sensitive metadata
    if draw(st.booleans()):
        data['created_by_email'] = f"{draw(st.text(min_size=1, max_size=20))}@example.com"
    if draw(st.booleans()):
        data['updated_by_email'] = f"{draw(st.text(min_size=1, max_size=20))}@example.com"
    
    # Randomly include extended fields
    if draw(st.booleans()):
        data['priority'] = draw(st.sampled_from(['low', 'medium', 'high', 'critical']))
    if draw(st.booleans()):
        data['health'] = draw(st.sampled_from(['green', 'yellow', 'red']))
    if draw(st.booleans()):
        data['portfolio_id'] = str(uuid4())
    if draw(st.booleans()):
        data['manager_id'] = str(uuid4())
    
    # Randomly include full project fields
    if draw(st.booleans()):
        data['tasks'] = []
    if draw(st.booleans()):
        data['schedules'] = []
    if draw(st.booleans()):
        data['risks'] = []
    if draw(st.booleans()):
        data['dependencies'] = []
    if draw(st.booleans()):
        data['resources'] = []
    
    # Randomly include limited data fields
    if draw(st.booleans()):
        data['milestones'] = []
    if draw(st.booleans()):
        data['timeline'] = {}
    if draw(st.booleans()):
        data['documents'] = []
    if draw(st.booleans()):
        data['team_members'] = []
    
    return data


# ==================== Property Tests ====================

@pytest.mark.property
class TestProperty2PermissionEnforcementConsistency:
    """
    Property 2: Permission Enforcement Consistency
    
    For any external user accessing via share link, only the permissions granted
    to that specific link must be enforced, regardless of the user's access method
    or timing.
    
    **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
    """
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.mark.property
    @given(
        permission_level=share_permission_levels(),
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_permission_enforcement_is_consistent(self, controller, permission_level, project_data):
        """
        Property: Permission enforcement must be consistent across all access attempts
        
        For any permission level and project data, the filtering must:
        1. Always produce the same result for the same inputs
        2. Never expose fields beyond the permission level
        3. Always include basic fields for all permission levels
        """
        # Sanitize and filter the data
        sanitized = controller._sanitize_project_data(project_data)
        filtered = controller._filter_sensitive_fields(sanitized, permission_level)
        
        # Property 1: Idempotency - filtering twice should give same result
        filtered_again = controller._filter_sensitive_fields(sanitized, permission_level)
        assert filtered == filtered_again, "Filtering must be idempotent"
        
        # Property 2: Basic fields always included
        basic_fields = {'id', 'name', 'description', 'status', 'progress_percentage', 
                       'start_date', 'end_date', 'created_at', 'updated_at'}
        for field in basic_fields:
            if field in project_data:
                assert field in filtered, f"Basic field '{field}' must be included for all permission levels"
        
        # Property 3: Permission-specific field restrictions
        if permission_level == SharePermissionLevel.VIEW_ONLY:
            # VIEW_ONLY should NEVER include extended fields
            forbidden_fields = {'milestones', 'timeline', 'documents', 'team_members', 
                              'tasks', 'schedules', 'risks', 'priority', 'health'}
            for field in forbidden_fields:
                assert field not in filtered, f"VIEW_ONLY must not include '{field}'"
        
        elif permission_level == SharePermissionLevel.LIMITED_DATA:
            # LIMITED_DATA should include some extended fields but not full project fields
            # Should NOT include full project fields
            forbidden_fields = {'tasks', 'schedules', 'risks', 'dependencies', 'resources', 'manager_id'}
            for field in forbidden_fields:
                assert field not in filtered, f"LIMITED_DATA must not include '{field}'"
        
        elif permission_level == SharePermissionLevel.FULL_PROJECT:
            # FULL_PROJECT can include all non-sensitive fields
            # But still no sensitive data (verified by sanitization)
            pass
        
        # Property 4: Sensitive data NEVER exposed at any permission level
        sensitive_fields = {'budget', 'actual_cost', 'spent', 'financial_data', 
                          'internal_notes', 'private_notes', 'confidential_notes',
                          'created_by_email', 'updated_by_email'}
        for field in sensitive_fields:
            assert field not in filtered, f"Sensitive field '{field}' must NEVER be exposed"


@pytest.mark.property
class TestProperty3TimeBasedAccessControl:
    """
    Property 3: Time-Based Access Control
    
    For any share link with an expiration time, access must be automatically disabled
    when the current time exceeds the expiration timestamp, with timezone-aware comparison.
    
    **Validates: Requirements 3.2, 3.3**
    """
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.mark.property
    @given(
        expires_at=datetime_with_timezone(min_days=-30, max_days=30)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_expiry_check_is_timezone_aware(self, controller, expires_at):
        """
        Property: Expiry checking must correctly handle timezone-aware datetimes
        
        For any expiration datetime:
        1. Past times must be considered expired
        2. Future times must not be considered expired
        3. Timezone information must be preserved and used correctly
        """
        now = datetime.now(timezone.utc)
        is_expired = controller._is_expired(expires_at)
        
        # Property: Expiry status must match time comparison
        if expires_at <= now:
            assert is_expired is True, f"Past time {expires_at} must be expired (now={now})"
        else:
            assert is_expired is False, f"Future time {expires_at} must not be expired (now={now})"
    
    @pytest.mark.property
    @given(
        days_offset=st.integers(min_value=-365, max_value=365)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_expiry_check_handles_naive_datetimes(self, controller, days_offset):
        """
        Property: Expiry checking must handle naive datetimes by assuming UTC
        
        For any naive datetime (no timezone info):
        1. Must be treated as UTC
        2. Must produce correct expiry status
        """
        # Create naive datetime
        naive_datetime = datetime.now() + timedelta(days=days_offset)
        
        # Check expiry
        is_expired = controller._is_expired(naive_datetime)
        
        # Property: Naive datetime should be treated as UTC
        now_utc = datetime.now(timezone.utc)
        naive_as_utc = naive_datetime.replace(tzinfo=timezone.utc)
        
        expected_expired = naive_as_utc <= now_utc
        assert is_expired == expected_expired, \
            f"Naive datetime must be treated as UTC: {naive_datetime} -> {naive_as_utc}"


    @pytest.mark.asyncio
    @pytest.mark.property
    @given(
        token=valid_tokens(),
        is_active=st.booleans(),
        is_revoked=st.booleans(),
        days_until_expiry=st.integers(min_value=-30, max_value=30)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    async def test_token_validation_respects_all_expiry_conditions(
        self, controller, token, is_active, is_revoked, days_until_expiry
    ):
        """
        Property: Token validation must respect all expiry and status conditions
        
        For any token with various states:
        1. Inactive tokens must be rejected
        2. Revoked tokens must be rejected
        3. Expired tokens must be rejected
        4. Only valid, active, non-revoked, non-expired tokens are accepted
        """
        # Setup mock database
        mock_db = Mock()
        mock_db.table = Mock(return_value=mock_db)
        mock_db.select = Mock(return_value=mock_db)
        mock_db.eq = Mock(return_value=mock_db)
        
        controller.db = mock_db
        
        # Create share data
        expires_at = datetime.now(timezone.utc) + timedelta(days=days_until_expiry)
        share_data = {
            "id": str(uuid4()),
            "project_id": str(uuid4()),
            "token": token,
            "permission_level": "view_only",
            "expires_at": expires_at.isoformat(),
            "is_active": is_active,
            "revoked_at": datetime.now(timezone.utc).isoformat() if is_revoked else None
        }
        
        mock_db.execute = Mock(return_value=Mock(data=[share_data]))
        
        # Validate token
        result = await controller.validate_token(token)
        
        # Property: Token is valid ONLY if all conditions are met
        is_expired = expires_at <= datetime.now(timezone.utc)
        should_be_valid = is_active and not is_revoked and not is_expired
        
        assert result.is_valid == should_be_valid, \
            f"Token validity must match all conditions: active={is_active}, " \
            f"revoked={is_revoked}, expired={is_expired}"
        
        # Property: Error messages must be appropriate
        if not result.is_valid:
            assert result.error_message is not None, "Invalid tokens must have error message"
            
            if not is_active:
                assert "no longer active" in result.error_message.lower()
            elif is_revoked:
                assert "revoked" in result.error_message.lower()
            elif is_expired:
                assert "expired" in result.error_message.lower()


@pytest.mark.property
class TestProperty5DataFilteringAccuracy:
    """
    Property 5: Data Filtering Accuracy
    
    For any permission level and project data combination, the filtered output must
    contain only the information permitted by that specific permission level and
    never expose restricted data.
    
    **Validates: Requirements 2.3, 2.4, 2.5, 5.2**
    """
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.mark.property
    @given(
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_sanitization_always_removes_sensitive_data(self, controller, project_data):
        """
        Property: Sanitization must ALWAYS remove sensitive data regardless of input
        
        For any project data with sensitive fields:
        1. All financial fields must be removed
        2. All internal notes must be removed
        3. All sensitive metadata must be removed
        4. Non-sensitive fields must be preserved
        """
        # Define all sensitive fields
        sensitive_financial = {'budget', 'actual_cost', 'spent', 'financial_data', 
                              'cost_breakdown', 'financial_details', 'cost_data'}
        sensitive_notes = {'internal_notes', 'private_notes', 'confidential_notes', 
                          'admin_notes', 'internal_comments'}
        sensitive_metadata = {'created_by_email', 'updated_by_email', 'creator_email'}
        all_sensitive = sensitive_financial | sensitive_notes | sensitive_metadata
        
        # Sanitize data
        sanitized = controller._sanitize_project_data(project_data)
        
        # Property 1: NO sensitive fields in output
        for field in all_sensitive:
            assert field not in sanitized, \
                f"Sensitive field '{field}' must be removed by sanitization"
        
        # Property 2: Non-sensitive fields preserved
        non_sensitive_fields = {'id', 'name', 'description', 'status', 'progress_percentage',
                               'start_date', 'end_date', 'priority', 'health'}
        for field in non_sensitive_fields:
            if field in project_data:
                assert field in sanitized, \
                    f"Non-sensitive field '{field}' must be preserved"
                assert sanitized[field] == project_data[field], \
                    f"Non-sensitive field '{field}' value must be unchanged"
        
        # Property 3: Sanitization is idempotent
        sanitized_again = controller._sanitize_project_data(sanitized)
        assert sanitized == sanitized_again, "Sanitization must be idempotent"
    
    @pytest.mark.property
    @given(
        permission_level=share_permission_levels(),
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_filtering_respects_permission_hierarchy(self, controller, permission_level, project_data):
        """
        Property: Filtering must respect the permission level hierarchy
        
        For any permission level:
        1. VIEW_ONLY ⊆ LIMITED_DATA ⊆ FULL_PROJECT (subset relationship)
        2. Higher permission levels include all fields from lower levels
        3. Each level has specific additional fields
        """
        # Sanitize first (always required)
        sanitized = controller._sanitize_project_data(project_data)
        
        # Filter at each permission level
        view_only = controller._filter_sensitive_fields(sanitized, SharePermissionLevel.VIEW_ONLY)
        limited_data = controller._filter_sensitive_fields(sanitized, SharePermissionLevel.LIMITED_DATA)
        full_project = controller._filter_sensitive_fields(sanitized, SharePermissionLevel.FULL_PROJECT)
        
        # Property 1: VIEW_ONLY fields are subset of LIMITED_DATA
        view_only_keys = set(view_only.keys())
        limited_data_keys = set(limited_data.keys())
        assert view_only_keys.issubset(limited_data_keys), \
            "VIEW_ONLY fields must be subset of LIMITED_DATA"
        
        # Property 2: LIMITED_DATA fields are subset of FULL_PROJECT
        full_project_keys = set(full_project.keys())
        assert limited_data_keys.issubset(full_project_keys), \
            "LIMITED_DATA fields must be subset of FULL_PROJECT"
        
        # Property 3: Values must be consistent across permission levels
        for key in view_only_keys:
            if key in limited_data:
                assert view_only[key] == limited_data[key], \
                    f"Field '{key}' value must be consistent across permission levels"
            if key in full_project:
                assert view_only[key] == full_project[key], \
                    f"Field '{key}' value must be consistent across permission levels"
    
    @pytest.mark.property
    @given(
        permission_level=share_permission_levels(),
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_combined_sanitization_and_filtering_never_exposes_sensitive_data(
        self, controller, permission_level, project_data
    ):
        """
        Property: Combined sanitization and filtering must NEVER expose sensitive data
        
        For any permission level and project data:
        1. Sensitive data must be removed by sanitization
        2. Filtering must not re-introduce sensitive data
        3. Final output must be safe for external access
        """
        # Define all sensitive fields
        all_sensitive_fields = {
            'budget', 'actual_cost', 'spent', 'financial_data', 'cost_breakdown',
            'financial_details', 'cost_data', 'budget_details', 'expenditure',
            'internal_notes', 'private_notes', 'confidential_notes', 'admin_notes',
            'created_by_email', 'updated_by_email', 'creator_email'
        }
        
        # Apply full pipeline: sanitize then filter
        sanitized = controller._sanitize_project_data(project_data)
        filtered = controller._filter_sensitive_fields(sanitized, permission_level)
        
        # Property: NO sensitive fields in final output
        for field in all_sensitive_fields:
            assert field not in filtered, \
                f"Sensitive field '{field}' must NEVER appear in filtered output " \
                f"(permission={permission_level})"
        
        # Property: If sensitive field was in input, it must be removed
        sensitive_in_input = all_sensitive_fields & set(project_data.keys())
        if sensitive_in_input:
            for field in sensitive_in_input:
                assert field not in filtered, \
                    f"Sensitive field '{field}' from input must be removed"
    
    @pytest.mark.property
    @given(
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_sanitization_does_not_modify_original_data(self, controller, project_data):
        """
        Property: Sanitization must not modify the original data structure
        
        For any project data:
        1. Original data must remain unchanged after sanitization
        2. Sanitized data must be a new object
        """
        # Store original keys and values
        original_keys = set(project_data.keys())
        original_values = {k: v for k, v in project_data.items()}
        
        # Sanitize data
        sanitized = controller._sanitize_project_data(project_data)
        
        # Property 1: Original data unchanged
        assert set(project_data.keys()) == original_keys, \
            "Original data keys must not be modified"
        
        for key, value in original_values.items():
            assert project_data[key] == value, \
                f"Original data value for '{key}' must not be modified"
        
        # Property 2: Sanitized is a different object
        assert sanitized is not project_data, \
            "Sanitized data must be a new object, not the original"


@pytest.mark.property
class TestProperty2And5Combined:
    """
    Combined tests for Permission Enforcement and Data Filtering
    
    These tests verify that permission enforcement and data filtering work
    correctly together across all scenarios.
    """
    
    @pytest.fixture
    def controller(self):
        """Create a GuestAccessController instance"""
        return GuestAccessController(db_session=None)
    
    @pytest.mark.property
    @given(
        permission_level=share_permission_levels(),
        project_data=project_data_with_sensitive_fields(),
        access_count=st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_repeated_access_produces_consistent_results(
        self, controller, permission_level, project_data, access_count
    ):
        """
        Property: Repeated access with same permission level must produce identical results
        
        For any permission level and project data:
        1. Multiple accesses must return identical filtered data
        2. No state should affect filtering results
        3. Results must be deterministic
        """
        # Perform multiple filtering operations
        results = []
        for _ in range(min(access_count, 10)):  # Limit to 10 for performance
            sanitized = controller._sanitize_project_data(project_data)
            filtered = controller._filter_sensitive_fields(sanitized, permission_level)
            results.append(filtered)
        
        # Property: All results must be identical
        first_result = results[0]
        for i, result in enumerate(results[1:], 1):
            assert result == first_result, \
                f"Access #{i+1} produced different result than first access"
    
    @pytest.mark.property
    @given(
        project_data=project_data_with_sensitive_fields()
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_all_permission_levels_remove_sensitive_data(self, controller, project_data):
        """
        Property: ALL permission levels must remove sensitive data
        
        For any project data with sensitive fields:
        1. VIEW_ONLY must not expose sensitive data
        2. LIMITED_DATA must not expose sensitive data
        3. FULL_PROJECT must not expose sensitive data
        """
        sensitive_fields = {
            'budget', 'actual_cost', 'spent', 'financial_data',
            'internal_notes', 'private_notes', 'confidential_notes',
            'created_by_email', 'updated_by_email'
        }
        
        # Test all permission levels
        for perm_level in [SharePermissionLevel.VIEW_ONLY, 
                          SharePermissionLevel.LIMITED_DATA,
                          SharePermissionLevel.FULL_PROJECT]:
            sanitized = controller._sanitize_project_data(project_data)
            filtered = controller._filter_sensitive_fields(sanitized, perm_level)
            
            # Property: No sensitive fields at any permission level
            for field in sensitive_fields:
                assert field not in filtered, \
                    f"Sensitive field '{field}' must not be in {perm_level} output"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "property"])
