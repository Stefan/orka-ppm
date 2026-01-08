"""
Property-based tests for enhanced user management API
Tests the user synchronization system's API enhancements
"""

import pytest
from hypothesis import given, settings, strategies as st
from uuid import uuid4
from datetime import datetime

from routers.users import create_user_response, _determine_user_status
from models.users import UserResponse


# Test data generators
def auth_user_strategy():
    """Generate auth.users data"""
    return st.fixed_dictionaries({
        "id": st.uuids().map(str),
        "email": st.text(min_size=5, max_size=50).map(lambda x: f"{x}@example.com"),
        "created_at": st.datetimes().map(lambda dt: dt.isoformat()),
        "updated_at": st.datetimes().map(lambda dt: dt.isoformat()),
        "last_sign_in_at": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat())),
        "email_confirmed_at": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat()))
    })


def user_profile_strategy():
    """Generate user_profiles data"""
    return st.fixed_dictionaries({
        "id": st.uuids().map(str),
        "user_id": st.uuids().map(str),
        "role": st.sampled_from(["admin", "user", "manager", "team_member"]),
        "is_active": st.booleans(),
        "last_login": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat())),
        "deactivated_at": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat())),
        "deactivated_by": st.one_of(st.none(), st.uuids().map(str)),
        "deactivation_reason": st.one_of(st.none(), st.text(min_size=1, max_size=100)),
        "sso_provider": st.one_of(st.none(), st.text(min_size=1, max_size=20)),
        "sso_user_id": st.one_of(st.none(), st.text(min_size=1, max_size=50)),
        "created_at": st.datetimes().map(lambda dt: dt.isoformat()),
        "updated_at": st.datetimes().map(lambda dt: dt.isoformat())
    })


def user_with_profile_strategy():
    """Generate combined auth user and profile data"""
    return st.tuples(auth_user_strategy(), st.one_of(st.none(), user_profile_strategy()))


class TestEnhancedUserAPIProperties:
    """Property-based tests for enhanced user management API"""

    @settings(max_examples=100)
    @given(user_data=user_with_profile_strategy())
    def test_api_data_completeness_property(self, user_data):
        """
        Property 16: API Data Completeness
        For any user retrieved through the API, the response should contain data from both auth.users and user_profiles tables
        **Validates: Requirements 6.1, 6.2**
        **Feature: user-synchronization, Property 16: API Data Completeness**
        """
        auth_data, profile_data = user_data
        profile_data = profile_data or {}
        
        # Ensure user_id consistency
        if profile_data:
            profile_data["user_id"] = auth_data["id"]
        
        # Create user response using the API function
        response = create_user_response(auth_data, profile_data)
        
        # Verify response contains auth data
        assert response.id == auth_data["id"]
        assert response.email == auth_data["email"]
        assert response.last_login == auth_data.get("last_sign_in_at")
        
        # Verify response contains profile data (with defaults for missing profiles)
        expected_role = profile_data.get("role", "user")
        expected_is_active = profile_data.get("is_active", True)
        
        assert response.role == expected_role
        assert response.is_active == expected_is_active
        assert response.deactivated_at == profile_data.get("deactivated_at")
        assert response.deactivated_by == profile_data.get("deactivated_by")
        assert response.deactivation_reason == profile_data.get("deactivation_reason")
        assert response.sso_provider == profile_data.get("sso_provider")
        
        # Verify timestamps are properly handled
        expected_created_at = profile_data.get("created_at") or auth_data.get("created_at")
        expected_updated_at = profile_data.get("updated_at") or auth_data.get("updated_at")
        
        assert response.created_at == expected_created_at
        assert response.updated_at == expected_updated_at

    @settings(max_examples=100)
    @given(auth_data=auth_user_strategy())
    def test_api_missing_profile_handling_property(self, auth_data):
        """
        Property 17: API Missing Profile Handling
        For any user with a missing user_profiles record, the API should handle the case gracefully without crashing
        **Validates: Requirements 6.3**
        **Feature: user-synchronization, Property 17: API Missing Profile Handling**
        """
        # Test with completely missing profile (empty dict)
        empty_profile = {}
        
        try:
            response = create_user_response(auth_data, empty_profile)
            
            # Should not crash and should provide sensible defaults
            assert response.id == auth_data["id"]
            assert response.email == auth_data["email"]
            assert response.role == "user"  # Default role
            assert response.is_active is True  # Default active status
            assert response.status in ["active", "inactive", "deactivated"]  # Valid status
            assert response.deactivated_at is None  # No deactivation for missing profile
            assert response.deactivated_by is None
            assert response.deactivation_reason is None
            assert response.sso_provider is None
            
        except Exception as e:
            pytest.fail(f"API should handle missing profiles gracefully, but raised: {e}")

    @settings(max_examples=100)
    @given(user_data=user_with_profile_strategy())
    def test_api_backward_compatibility_property(self, user_data):
        """
        Property 18: API Backward Compatibility
        For any existing API endpoint, the response format and data structure should remain unchanged after implementing user synchronization
        **Validates: Requirements 6.4**
        **Feature: user-synchronization, Property 18: API Backward Compatibility**
        """
        auth_data, profile_data = user_data
        profile_data = profile_data or {}
        
        # Ensure user_id consistency
        if profile_data:
            profile_data["user_id"] = auth_data["id"]
        
        response = create_user_response(auth_data, profile_data)
        
        # Verify response is a valid UserResponse object
        assert isinstance(response, UserResponse)
        
        # Verify all required fields are present (backward compatibility)
        required_fields = [
            "id", "email", "role", "status", "is_active", "last_login",
            "created_at", "updated_at", "deactivated_at", "deactivated_by",
            "deactivation_reason", "sso_provider"
        ]
        
        for field in required_fields:
            assert hasattr(response, field), f"Missing required field: {field}"
        
        # Verify field types are consistent
        assert isinstance(response.id, str)
        assert isinstance(response.email, str)
        assert isinstance(response.role, str)
        assert isinstance(response.status, str)
        assert isinstance(response.is_active, bool)
        
        # Optional fields should be None or proper type
        if response.last_login is not None:
            assert isinstance(response.last_login, str)
        if response.deactivated_at is not None:
            assert isinstance(response.deactivated_at, str)
        if response.deactivated_by is not None:
            assert isinstance(response.deactivated_by, str)
        if response.deactivation_reason is not None:
            assert isinstance(response.deactivation_reason, str)
        if response.sso_provider is not None:
            assert isinstance(response.sso_provider, str)

    @settings(max_examples=100)
    @given(users_data=st.lists(user_with_profile_strategy(), min_size=1, max_size=10))
    def test_api_response_consistency_property(self, users_data):
        """
        Property 19: API Response Consistency
        For any user data returned by the API, the format should be consistent regardless of whether the user_profiles record exists or was created by synchronization
        **Validates: Requirements 6.5**
        **Feature: user-synchronization, Property 19: API Response Consistency**
        """
        responses = []
        
        for auth_data, profile_data in users_data:
            profile_data = profile_data or {}
            
            # Ensure user_id consistency
            if profile_data:
                profile_data["user_id"] = auth_data["id"]
            
            response = create_user_response(auth_data, profile_data)
            responses.append(response)
        
        # Verify all responses have consistent structure
        if len(responses) > 1:
            first_response = responses[0]
            
            for response in responses[1:]:
                # All responses should have the same fields
                assert set(first_response.__dict__.keys()) == set(response.__dict__.keys())
                
                # All responses should have the same field types for non-None values
                for field_name in first_response.__dict__.keys():
                    first_value = getattr(first_response, field_name)
                    current_value = getattr(response, field_name)
                    
                    if first_value is not None and current_value is not None:
                        assert type(first_value) == type(current_value), \
                            f"Inconsistent type for field {field_name}: {type(first_value)} vs {type(current_value)}"
        
        # Verify status determination is consistent
        for i, (auth_data, profile_data) in enumerate(users_data):
            profile_data = profile_data or {}
            response = responses[i]
            expected_status = _determine_user_status(profile_data)
            assert response.status == expected_status

    @settings(max_examples=50)
    @given(profile_data=st.one_of(st.none(), user_profile_strategy()))
    def test_status_determination_consistency(self, profile_data):
        """
        Test that status determination is consistent and correct
        """
        status = _determine_user_status(profile_data or {})
        
        # Status should always be one of the valid values
        assert status in ["active", "inactive", "deactivated"]
        
        if profile_data:
            if profile_data.get("deactivated_at"):
                assert status == "deactivated"
            elif profile_data.get("is_active", True):
                assert status == "active"
            else:
                assert status == "inactive"
        else:
            # Default for missing profile
            assert status == "active"


if __name__ == "__main__":
    # Run a simple test to verify the module loads correctly
    print("Enhanced User API property tests loaded successfully")
    
    # Test basic functionality
    auth_data = {
        "id": str(uuid4()),
        "email": "test@example.com",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "last_sign_in_at": None,
        "email_confirmed_at": datetime.now().isoformat()
    }
    
    profile_data = {
        "id": str(uuid4()),
        "user_id": auth_data["id"],
        "role": "user",
        "is_active": True,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    response = create_user_response(auth_data, profile_data)
    print(f"Test response created: {response.email}, {response.role}, {response.status}")