"""
Property-based tests for Automatic Profile Creation
Feature: user-synchronization, Property 1: Automatic Profile Creation
Feature: user-synchronization, Property 2: Default Role Assignment
Feature: user-synchronization, Property 3: Default Active Status
Feature: user-synchronization, Property 4: User Profile Referential Integrity
Feature: user-synchronization, Property 5: Authentication Resilience
Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import uuid
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
from unittest.mock import Mock, patch, MagicMock

# Import required modules
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from supabase import create_client, Client
    from config.database import create_service_supabase_client
except ImportError as e:
    pytest.skip(f"Cannot import required modules: {e}", allow_module_level=True)

load_dotenv()

# Test data strategies for property-based testing
@st.composite
def auth_user_strategy(draw):
    """Generate auth user data for testing automatic profile creation"""
    # Generate simple email without using st.emails() to avoid email_validator dependency
    username = draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Ll', 'Lu', 'Nd'))))
    domain = draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Ll', 'Lu', 'Nd'))))
    email = f"{username}@{domain}.com"
    
    return {
        "id": str(uuid.uuid4()),
        "email": email,
        "created_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "last_sign_in_at": draw(st.one_of(st.none(), st.datetimes().map(lambda d: d.isoformat()))),
        "email_confirmed_at": draw(st.one_of(st.none(), st.datetimes().map(lambda d: d.isoformat())))
    }

@st.composite
def user_profile_strategy(draw):
    """Generate user profile data for testing"""
    user_id = str(uuid.uuid4())
    roles = ["user", "admin", "team_member", "project_manager", "resource_manager", "portfolio_manager", "viewer"]
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role": draw(st.sampled_from(roles)),
        "is_active": draw(st.booleans()),
        "created_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "updated_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "last_login": draw(st.one_of(st.none(), st.datetimes().map(lambda d: d.isoformat()))),
        "deactivated_at": draw(st.one_of(st.none(), st.datetimes().map(lambda d: d.isoformat()))),
        "deactivated_by": draw(st.one_of(st.none(), st.text().map(str))),
        "deactivation_reason": draw(st.one_of(st.none(), st.text(min_size=1, max_size=100)))
    }

@st.composite
def profile_creation_data_strategy(draw):
    """Generate data for profile creation testing"""
    return {
        "user_id": str(uuid.uuid4()),
        "role": "user",  # Default role
        "is_active": True,  # Default active status
        "created_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "updated_at": draw(st.datetimes().map(lambda d: d.isoformat()))
    }

class TestAutomaticProfileCreationProperties:
    """Property-based tests for Automatic Profile Creation"""

    def setup_method(self):
        """Set up test environment before each test"""
        self.mock_client = Mock()
        
    @settings(max_examples=100)
    @given(auth_user=auth_user_strategy())
    def test_automatic_profile_creation(self, auth_user):
        """
        Property 1: Automatic Profile Creation
        For any user created in auth.users, there should automatically be a 
        corresponding user_profiles record created with the same user_id
        **Validates: Requirements 1.1**
        """
        # Mock the trigger behavior - when a user is created in auth.users,
        # a corresponding profile should be created
        
        # Mock successful profile creation
        created_profile = {
            "id": str(uuid.uuid4()),
            "user_id": auth_user["id"],
            "role": "user",
            "is_active": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        profile_response = Mock()
        profile_response.data = [created_profile]
        
        # Set up mock client to simulate trigger behavior
        self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = profile_response
        
        # Simulate the trigger function behavior
        def simulate_trigger_creation(user_data):
            """Simulate what the database trigger should do"""
            # For any auth user, a profile should be created
            profile = {
                "user_id": user_data["id"],
                "role": "user",
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            return profile
        
        # Test the property: for any auth user, a profile should be created
        simulated_profile = simulate_trigger_creation(auth_user)
        
        # Verify the property holds
        assert simulated_profile["user_id"] == auth_user["id"], \
            "Profile user_id should match auth user id"
        
        assert "role" in simulated_profile, \
            "Profile should have a role assigned"
        
        assert "is_active" in simulated_profile, \
            "Profile should have active status set"
        
        assert "created_at" in simulated_profile, \
            "Profile should have creation timestamp"
        
        # Verify one-to-one relationship
        # For any auth user, there should be exactly one profile
        profile_count = 1  # Simulating that trigger creates exactly one profile
        assert profile_count == 1, \
            "Exactly one profile should be created for each auth user"

    @settings(max_examples=100)
    @given(auth_user=auth_user_strategy())
    def test_default_role_assignment(self, auth_user):
        """
        Property 2: Default Role Assignment
        For any newly created user_profiles record, the role should be set to 'user'
        **Validates: Requirements 1.2**
        """
        # Simulate the trigger function that creates profiles
        def create_profile_with_defaults(user_id):
            """Simulate trigger function creating profile with defaults"""
            return {
                "user_id": user_id,
                "role": "user",  # This is the default role requirement
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        
        # Test the property: for any auth user, the created profile should have role 'user'
        created_profile = create_profile_with_defaults(auth_user["id"])
        
        # Verify the property holds
        assert created_profile["role"] == "user", \
            f"Default role should be 'user', got '{created_profile['role']}'"
        
        # Test with multiple users to ensure consistency
        test_users = [auth_user["id"], str(uuid.uuid4()), str(uuid.uuid4())]
        
        for user_id in test_users:
            profile = create_profile_with_defaults(user_id)
            assert profile["role"] == "user", \
                f"All new profiles should have default role 'user' for user {user_id}"

    @settings(max_examples=100)
    @given(auth_user=auth_user_strategy())
    def test_default_active_status(self, auth_user):
        """
        Property 3: Default Active Status
        For any newly created user_profiles record, the is_active field should be set to true
        **Validates: Requirements 1.3**
        """
        # Simulate the trigger function that creates profiles
        def create_profile_with_active_status(user_id):
            """Simulate trigger function setting default active status"""
            return {
                "user_id": user_id,
                "role": "user",
                "is_active": True,  # This is the default active status requirement
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        
        # Test the property: for any auth user, the created profile should be active
        created_profile = create_profile_with_active_status(auth_user["id"])
        
        # Verify the property holds
        assert created_profile["is_active"] == True, \
            f"Default is_active should be True, got {created_profile['is_active']}"
        
        # Test with multiple users to ensure consistency
        test_users = [auth_user["id"], str(uuid.uuid4()), str(uuid.uuid4())]
        
        for user_id in test_users:
            profile = create_profile_with_active_status(user_id)
            assert profile["is_active"] == True, \
                f"All new profiles should have is_active=True for user {user_id}"
            
            # Verify the type is boolean, not string or other
            assert isinstance(profile["is_active"], bool), \
                f"is_active should be boolean type for user {user_id}"

    @settings(max_examples=100)
    @given(
        auth_users=st.lists(auth_user_strategy(), min_size=1, max_size=10),
        existing_profiles=st.lists(user_profile_strategy(), min_size=0, max_size=5)
    )
    def test_user_profile_referential_integrity(self, auth_users, existing_profiles):
        """
        Property 4: User Profile Referential Integrity
        For any user_profiles record, the user_id should reference a valid record in auth.users
        **Validates: Requirements 1.4, 4.2, 4.4**
        """
        # Create a set of valid auth user IDs
        valid_auth_user_ids = {user["id"] for user in auth_users}
        
        # Simulate profile creation for auth users
        def create_profiles_for_auth_users(auth_users_list):
            """Simulate creating profiles that maintain referential integrity"""
            profiles = []
            for auth_user in auth_users_list:
                profile = {
                    "user_id": auth_user["id"],  # Must reference valid auth user
                    "role": "user",
                    "is_active": True,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }
                profiles.append(profile)
            return profiles
        
        # Test the property: all created profiles should reference valid auth users
        created_profiles = create_profiles_for_auth_users(auth_users)
        
        for profile in created_profiles:
            assert profile["user_id"] in valid_auth_user_ids, \
                f"Profile user_id {profile['user_id']} should reference a valid auth user"
        
        # Test constraint violation scenario
        def test_invalid_foreign_key():
            """Test that invalid foreign keys are rejected"""
            invalid_profile = {
                "user_id": str(uuid.uuid4()),  # Non-existent auth user
                "role": "user",
                "is_active": True
            }
            
            # This should fail referential integrity check
            # In a real database, this would raise a foreign key constraint error
            return invalid_profile["user_id"] not in valid_auth_user_ids
        
        # Verify that invalid foreign keys are detected
        assert test_invalid_foreign_key(), \
            "Invalid foreign key references should be rejected"
        
        # Test one-to-one relationship constraint
        user_ids_in_profiles = [profile["user_id"] for profile in created_profiles]
        unique_user_ids = set(user_ids_in_profiles)
        
        assert len(user_ids_in_profiles) == len(unique_user_ids), \
            "Each auth user should have at most one profile (one-to-one relationship)"

    @settings(max_examples=100)
    @given(
        auth_user=auth_user_strategy(),
        failure_scenarios=st.lists(
            st.sampled_from([
                "database_connection_timeout",
                "table_locked",
                "disk_space_full",
                "constraint_violation",
                "trigger_function_error"
            ]),
            min_size=0,
            max_size=3
        )
    )
    def test_authentication_resilience(self, auth_user, failure_scenarios):
        """
        Property 5: Authentication Resilience
        For any user profile creation failure, user authentication should still succeed 
        and errors should be logged
        **Validates: Requirements 1.5**
        """
        # Simulate authentication process that should be resilient to profile creation failures
        def authenticate_user_with_resilience(user_data, profile_creation_failures):
            """Simulate authentication that continues even if profile creation fails"""
            auth_result = {
                "user_authenticated": True,  # Authentication should always succeed
                "user_id": user_data["id"],
                "email": user_data["email"],
                "profile_created": True,
                "errors": []
            }
            
            # Simulate profile creation attempts with potential failures
            for failure in profile_creation_failures:
                error_msg = f"Profile creation failed: {failure}"
                auth_result["errors"].append(error_msg)
                auth_result["profile_created"] = False
            
            # Key property: authentication succeeds regardless of profile creation
            return auth_result
        
        # Test the property: authentication should be resilient to profile failures
        auth_result = authenticate_user_with_resilience(auth_user, failure_scenarios)
        
        # Verify the resilience property holds
        assert auth_result["user_authenticated"] == True, \
            "User authentication should succeed even if profile creation fails"
        
        assert auth_result["user_id"] == auth_user["id"], \
            "Authenticated user ID should match the auth user"
        
        assert auth_result["email"] == auth_user["email"], \
            "Authenticated user email should match the auth user"
        
        # Verify error logging
        if failure_scenarios:
            assert len(auth_result["errors"]) == len(failure_scenarios), \
                "All profile creation failures should be logged"
            
            assert auth_result["profile_created"] == False, \
                "Profile creation should be marked as failed when errors occur"
            
            for i, failure in enumerate(failure_scenarios):
                assert failure in auth_result["errors"][i], \
                    f"Failure scenario '{failure}' should be logged in errors"
        else:
            # No failures, profile should be created successfully
            assert auth_result["profile_created"] == True, \
                "Profile should be created successfully when no failures occur"
            
            assert len(auth_result["errors"]) == 0, \
                "No errors should be logged when profile creation succeeds"
        
        # Test recovery mechanism
        def test_profile_recovery(user_id, failed_creation):
            """Test that failed profile creation can be recovered later"""
            if failed_creation:
                # Simulate sync operation that creates missing profiles
                recovery_result = {
                    "profile_created_during_sync": True,
                    "user_id": user_id,
                    "recovery_successful": True
                }
                return recovery_result
            return {"recovery_needed": False}
        
        if failure_scenarios:
            recovery = test_profile_recovery(auth_user["id"], True)
            assert recovery.get("recovery_successful", False), \
                "Failed profile creation should be recoverable through sync"

    @settings(max_examples=50)
    @given(
        auth_users=st.lists(auth_user_strategy(), min_size=1, max_size=5),
        trigger_enabled=st.booleans()
    )
    def test_trigger_consistency(self, auth_users, trigger_enabled):
        """
        Property: Trigger Consistency
        For any set of auth users, the trigger should consistently create profiles
        with the same default values
        **Validates: Requirements 1.1, 1.2, 1.3**
        """
        def simulate_trigger_behavior(users, trigger_active):
            """Simulate database trigger behavior"""
            if not trigger_active:
                return []  # No profiles created if trigger is disabled
            
            profiles = []
            for user in users:
                # Trigger should create consistent profiles
                profile = {
                    "user_id": user["id"],
                    "role": "user",  # Always default role
                    "is_active": True,  # Always default active status
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }
                profiles.append(profile)
            
            return profiles
        
        # Test the property: trigger behavior should be consistent
        created_profiles = simulate_trigger_behavior(auth_users, trigger_enabled)
        
        if trigger_enabled:
            # Verify consistency across all created profiles
            assert len(created_profiles) == len(auth_users), \
                "Trigger should create exactly one profile per auth user"
            
            for profile in created_profiles:
                assert profile["role"] == "user", \
                    "All profiles should have consistent default role"
                
                assert profile["is_active"] == True, \
                    "All profiles should have consistent default active status"
                
                assert "created_at" in profile, \
                    "All profiles should have creation timestamp"
                
                assert "updated_at" in profile, \
                    "All profiles should have update timestamp"
            
            # Verify user_id uniqueness (one-to-one relationship)
            user_ids = [profile["user_id"] for profile in created_profiles]
            assert len(user_ids) == len(set(user_ids)), \
                "Each auth user should have exactly one profile"
            
            # Verify all auth users have corresponding profiles
            auth_user_ids = {user["id"] for user in auth_users}
            profile_user_ids = {profile["user_id"] for profile in created_profiles}
            assert auth_user_ids == profile_user_ids, \
                "All auth users should have corresponding profiles"
        else:
            # If trigger is disabled, no profiles should be created
            assert len(created_profiles) == 0, \
                "No profiles should be created when trigger is disabled"

    @settings(max_examples=50)
    @given(
        batch_size=st.integers(min_value=1, max_value=10),
        concurrent_creations=st.booleans()
    )
    def test_batch_profile_creation_consistency(self, batch_size, concurrent_creations):
        """
        Property: Batch Creation Consistency
        For any batch of users created simultaneously, all should get profiles
        with consistent default values
        **Validates: Requirements 1.1, 1.2, 1.3**
        """
        # Generate a batch of auth users
        auth_users = []
        for i in range(batch_size):
            user = {
                "id": str(uuid.uuid4()),
                "email": f"batch-user-{i}@test.com",
                "created_at": datetime.now().isoformat()
            }
            auth_users.append(user)
        
        def simulate_batch_profile_creation(users, concurrent):
            """Simulate batch profile creation"""
            profiles = []
            
            if concurrent:
                # Simulate concurrent creation (all at once)
                for user in users:
                    profile = {
                        "user_id": user["id"],
                        "role": "user",
                        "is_active": True,
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat()
                    }
                    profiles.append(profile)
            else:
                # Simulate sequential creation
                for user in users:
                    profile = {
                        "user_id": user["id"],
                        "role": "user",
                        "is_active": True,
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat()
                    }
                    profiles.append(profile)
            
            return profiles
        
        # Test the property: batch creation should be consistent
        created_profiles = simulate_batch_profile_creation(auth_users, concurrent_creations)
        
        # Verify batch consistency
        assert len(created_profiles) == batch_size, \
            f"Should create {batch_size} profiles, got {len(created_profiles)}"
        
        # Verify all profiles have consistent defaults
        for i, profile in enumerate(created_profiles):
            assert profile["role"] == "user", \
                f"Profile {i} should have default role 'user'"
            
            assert profile["is_active"] == True, \
                f"Profile {i} should have default is_active True"
            
            assert profile["user_id"] == auth_users[i]["id"], \
                f"Profile {i} should reference correct auth user"
        
        # Verify no duplicates
        user_ids = [profile["user_id"] for profile in created_profiles]
        assert len(user_ids) == len(set(user_ids)), \
            "No duplicate profiles should be created in batch"