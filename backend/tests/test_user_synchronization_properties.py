"""
Property-based tests for User Synchronization Service
Feature: user-synchronization, Property 6: Sync Missing Profile Detection
Feature: user-synchronization, Property 7: Sync Profile Creation  
Feature: user-synchronization, Property 8: Sync Data Preservation
Feature: user-synchronization, Property 9: Sync Reporting Accuracy
Feature: user-synchronization, Property 10: Sync Idempotence
Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import uuid
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
from unittest.mock import Mock, patch, MagicMock

# Import the service we're testing
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import only what we need to avoid email validator dependency
try:
    from user_synchronization_service import UserSynchronizationService, SyncResult
    # Define UserRole enum locally to avoid model dependency
    class UserRole:
        team_member = "team_member"
        admin = "admin"
        project_manager = "project_manager"
except ImportError as e:
    # If import fails, we'll skip the tests
    pytest.skip(f"Cannot import required modules: {e}", allow_module_level=True)

load_dotenv()

# Test data strategies for property-based testing
@st.composite
def auth_user_strategy(draw):
    """Generate auth user data for testing"""
    # Generate simple email without using st.emails() to avoid email_validator dependency
    username = draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Ll', 'Lu', 'Nd'))))
    domain = draw(st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=('Ll', 'Lu', 'Nd'))))
    email = f"{username}@{domain}.com"
    
    return {
        "id": str(uuid.uuid4()),
        "email": email,
        "created_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "last_sign_in_at": draw(st.one_of(st.none(), st.datetimes().map(lambda d: d.isoformat())))
    }

@st.composite
def user_profile_strategy(draw):
    """Generate user profile data for testing"""
    user_id = str(uuid.uuid4())
    roles = ["team_member", "admin", "project_manager", "resource_manager", "portfolio_manager", "viewer"]
    return {
        "user_id": user_id,
        "role": draw(st.sampled_from(roles)),
        "is_active": draw(st.booleans()),
        "created_at": draw(st.datetimes().map(lambda d: d.isoformat())),
        "updated_at": draw(st.datetimes().map(lambda d: d.isoformat()))
    }

@st.composite
def auth_users_list_strategy(draw):
    """Generate a list of auth users for testing"""
    size = draw(st.integers(min_value=0, max_value=10))
    return draw(st.lists(auth_user_strategy(), min_size=size, max_size=size))

@st.composite
def user_profiles_list_strategy(draw):
    """Generate a list of user profiles for testing"""
    size = draw(st.integers(min_value=0, max_value=10))
    return draw(st.lists(user_profile_strategy(), min_size=size, max_size=size))

class TestUserSynchronizationProperties:
    """Property-based tests for User Synchronization Service"""

    def setup_method(self):
        """Set up test environment before each test"""
        self.mock_client = Mock()
        
    @settings(max_examples=100)
    @given(
        auth_users=auth_users_list_strategy(),
        existing_profiles=user_profiles_list_strategy()
    )
    def test_sync_missing_profile_detection(self, auth_users, existing_profiles):
        """
        Property 6: Sync Missing Profile Detection
        For any auth.users record without a corresponding user_profiles record, 
        the sync system should identify it as missing
        **Validates: Requirements 3.1**
        """
        # Create mock responses
        auth_response = Mock()
        auth_response.data = auth_users
        
        profiles_response = Mock()
        profiles_response.data = existing_profiles
        
        # Set up mock client
        self.mock_client.table.return_value.select.return_value.execute.side_effect = [
            auth_response,  # First call for auth.users
            profiles_response  # Second call for user_profiles
        ]
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Get existing profile user IDs
                existing_user_ids = {profile["user_id"] for profile in existing_profiles}
                
                # Call the method under test
                missing_profiles = service.identify_missing_profiles()
                
                # Verify the property: all returned users should not have profiles
                for missing_user in missing_profiles:
                    assert missing_user["id"] not in existing_user_ids, \
                        f"User {missing_user['id']} should not have an existing profile"
                
                # Verify completeness: all auth users without profiles should be identified
                expected_missing = [user for user in auth_users if user["id"] not in existing_user_ids]
                assert len(missing_profiles) == len(expected_missing), \
                    "Should identify exactly the users without profiles"
                
                # Verify all expected missing users are in the result
                missing_user_ids = {user["id"] for user in missing_profiles}
                expected_missing_ids = {user["id"] for user in expected_missing}
                assert missing_user_ids == expected_missing_ids, \
                    "Should identify exactly the expected missing users"

    @settings(max_examples=100)
    @given(missing_users=auth_users_list_strategy())
    def test_sync_profile_creation(self, missing_users):
        """
        Property 7: Sync Profile Creation
        For any missing user profile identified by sync, a user_profiles record 
        should be created with default values
        **Validates: Requirements 3.2**
        """
        assume(len(missing_users) > 0)  # Only test when there are users to create profiles for
        
        # Mock successful insertions
        insert_responses = []
        for user in missing_users:
            response = Mock()
            response.data = [{
                "user_id": user["id"],
                "role": UserRole.team_member,
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }]
            insert_responses.append(response)
        
        # Set up mock client for profile creation
        self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []  # No existing profiles
        self.mock_client.table.return_value.insert.return_value.execute.side_effect = insert_responses
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Call the method under test
                result = service.create_missing_profiles(missing_users)
                
                # Verify the property: profiles should be created for all missing users
                assert result.created_profiles == len(missing_users), \
                    "Should create profiles for all missing users"
                
                assert result.failed_creations == 0, \
                    "Should not have any failed creations with valid data"
                
                assert len(result.created_user_ids) == len(missing_users), \
                    "Should track all created user IDs"
                
                # Verify all user IDs are tracked
                expected_user_ids = {user["id"] for user in missing_users}
                actual_user_ids = set(result.created_user_ids)
                assert actual_user_ids == expected_user_ids, \
                    "Should track exactly the expected user IDs"
                
                # Verify default values are used
                # This is validated by checking that the mock was called with correct data
                insert_calls = self.mock_client.table.return_value.insert.call_args_list
                assert len(insert_calls) == len(missing_users), \
                    "Should make insert call for each user"
                
                for call in insert_calls:
                    profile_data = call[0][0]  # First argument to insert()
                    assert profile_data["role"] == UserRole.team_member, \
                        "Should use default role"
                    assert profile_data["is_active"] == True, \
                        "Should set default active status"
                    assert "user_id" in profile_data, \
                        "Should include user_id"
                    assert "created_at" in profile_data, \
                        "Should set created_at timestamp"
                    assert "updated_at" in profile_data, \
                        "Should set updated_at timestamp"

    @settings(max_examples=100)
    @given(
        existing_profiles=user_profiles_list_strategy(),
        missing_users=auth_users_list_strategy()
    )
    def test_sync_data_preservation(self, existing_profiles, missing_users):
        """
        Property 8: Sync Data Preservation
        For any existing user_profiles record, synchronization should not modify its existing data
        **Validates: Requirements 3.3**
        """
        assume(len(existing_profiles) > 0)  # Only test when there are existing profiles
        
        # Create a mapping of user_id to profile for existing profiles
        existing_profiles_map = {profile["user_id"]: profile for profile in existing_profiles}
        
        # Ensure missing users don't overlap with existing profiles
        filtered_missing_users = [
            user for user in missing_users 
            if user["id"] not in existing_profiles_map
        ]
        
        # Mock responses for existing profile checks
        def mock_existing_check(user_id):
            if user_id in existing_profiles_map:
                response = Mock()
                response.data = [existing_profiles_map[user_id]]
                return response
            else:
                response = Mock()
                response.data = []
                return response
        
        # Mock the detailed profile retrieval
        def mock_detailed_profile_check(*args, **kwargs):
            # Extract user_id from the eq() call
            if hasattr(args[0], 'call_args_list') and args[0].call_args_list:
                # Get the user_id from the eq() call
                eq_call = args[0].call_args_list[-1]
                if eq_call and len(eq_call[0]) > 1:
                    user_id = eq_call[0][1]
                    return mock_existing_check(user_id)
            
            # Fallback: return empty response
            response = Mock()
            response.data = []
            return response
        
        # Set up mock client
        self.mock_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = \
            lambda: mock_detailed_profile_check(self.mock_client.table.return_value.select.return_value.eq)
        
        # Mock successful insertions for missing users only
        insert_responses = []
        for user in filtered_missing_users:
            response = Mock()
            response.data = [{
                "user_id": user["id"],
                "role": UserRole.team_member,
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }]
            insert_responses.append(response)
        
        self.mock_client.table.return_value.insert.return_value.execute.side_effect = insert_responses
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Test all users (existing + missing) with preservation enabled
                all_users = []
                
                # Add existing users (simulate they exist in auth.users)
                for profile in existing_profiles:
                    all_users.append({
                        "id": profile["user_id"],
                        "email": f"user{profile['user_id'][:8]}@test.com",
                        "created_at": datetime.now().isoformat()
                    })
                
                # Add missing users
                all_users.extend(filtered_missing_users)
                
                # Call create_missing_profiles with preservation enabled
                result = service.create_missing_profiles(all_users, preserve_existing=True)
                
                # Verify preservation property: existing profiles should not be modified
                # This is verified by checking that:
                # 1. No profiles were created for users with existing profiles
                # 2. Only missing users had profiles created
                # 3. The count of existing profiles matches expectations
                
                expected_existing = len([
                    user for user in all_users 
                    if user["id"] in existing_profiles_map
                ])
                
                expected_created = len([
                    user for user in all_users 
                    if user["id"] not in existing_profiles_map
                ])
                
                assert result.existing_profiles == expected_existing, \
                    f"Should preserve {expected_existing} existing profiles, got {result.existing_profiles}"
                
                assert result.created_profiles == expected_created, \
                    f"Should create {expected_created} new profiles, got {result.created_profiles}"
                
                # Verify no insert calls were made for existing users
                insert_calls = self.mock_client.table.return_value.insert.call_args_list
                created_user_ids = set()
                for call in insert_calls:
                    if call and len(call[0]) > 0:
                        profile_data = call[0][0]
                        created_user_ids.add(profile_data["user_id"])
                
                # Ensure no existing users had insert calls
                for existing_user_id in existing_profiles_map.keys():
                    assert existing_user_id not in created_user_ids, \
                        f"Should not attempt to create profile for existing user {existing_user_id}"
                
                # Verify all created users were actually missing
                for created_user_id in created_user_ids:
                    assert created_user_id not in existing_profiles_map, \
                        f"Should only create profiles for missing users, not {created_user_id}"

    @settings(max_examples=50)
    @given(
        existing_profile=user_profile_strategy(),
        new_data=st.dictionaries(
            st.sampled_from(["role", "is_active", "last_login", "deactivated_at"]),
            st.one_of(
                st.sampled_from(["admin", "team_member", "project_manager"]),
                st.booleans(),
                st.datetimes().map(lambda d: d.isoformat()),
                st.none()
            ),
            min_size=1,
            max_size=4
        )
    )
    def test_preserve_existing_profile_data_merge(self, existing_profile, new_data):
        """
        Property 8: Sync Data Preservation - Data Merge
        For any existing profile data and new data, the preserve function should 
        merge them while preserving existing values
        **Validates: Requirements 3.3**
        """
        user_id = existing_profile["user_id"]
        
        # Mock the detailed profile retrieval
        detailed_response = Mock()
        detailed_response.data = [existing_profile]
        
        self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = detailed_response
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Call preserve_existing_profile_data
                merged_data = service.preserve_existing_profile_data(user_id, new_data)
                
                # Verify preservation property: existing values should be preserved
                preserve_fields = [
                    "role", "is_active", "last_login", "deactivated_at", 
                    "deactivated_by", "deactivation_reason", "sso_provider", 
                    "sso_user_id", "created_at"
                ]
                
                for field in preserve_fields:
                    if field in existing_profile and existing_profile[field] is not None:
                        assert merged_data[field] == existing_profile[field], \
                            f"Should preserve existing value for {field}: {existing_profile[field]}"
                
                # Verify new fields that don't exist in existing profile can be added
                for field, value in new_data.items():
                    if field not in existing_profile or existing_profile[field] is None:
                        # New field should be added if it's not in preserve list or existing value is None
                        if field not in preserve_fields or existing_profile.get(field) is None:
                            assert merged_data.get(field) == value, \
                                f"Should add new field {field} with value {value}"
                
                # Verify updated_at is always updated
                assert "updated_at" in merged_data, \
                    "Should always include updated_at timestamp"
                
                # If existing profile had updated_at, it should be different (newer)
                if "updated_at" in existing_profile:
                    assert merged_data["updated_at"] != existing_profile["updated_at"], \
                        "Should update the updated_at timestamp"

    @settings(max_examples=100)
    @given(
        auth_users=auth_users_list_strategy(),
        existing_profiles=user_profiles_list_strategy()
    )
    def test_sync_reporting_accuracy(self, auth_users, existing_profiles):
        """
        Property 9: Sync Reporting Accuracy
        For any synchronization operation, the reported number of created profiles 
        should match the actual number of profiles created
        **Validates: Requirements 3.4**
        """
        # Set up mock responses
        auth_response = Mock()
        auth_response.data = auth_users
        auth_response.count = len(auth_users)
        
        profiles_response = Mock()
        profiles_response.data = existing_profiles
        profiles_response.count = len(existing_profiles)
        
        # Calculate expected missing users
        existing_user_ids = {profile["user_id"] for profile in existing_profiles}
        missing_users = [user for user in auth_users if user["id"] not in existing_user_ids]
        
        # Mock successful profile creation for missing users
        insert_responses = []
        for user in missing_users:
            response = Mock()
            response.data = [{
                "user_id": user["id"],
                "role": UserRole.team_member,
                "is_active": True
            }]
            insert_responses.append(response)
        
        # Set up mock client
        self.mock_client.table.return_value.select.return_value.execute.side_effect = [
            auth_response,  # For get_sync_statistics - auth users count
            profiles_response,  # For get_sync_statistics - profiles count
            auth_response,  # For identify_missing_profiles - auth users
            profiles_response,  # For identify_missing_profiles - profiles
            auth_response,  # For identify_missing_profiles in perform_full_sync
            profiles_response   # For identify_missing_profiles in perform_full_sync
        ]
        
        # Mock profile existence checks (return empty for all)
        self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Mock profile insertions
        self.mock_client.table.return_value.insert.return_value.execute.side_effect = insert_responses
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Call the method under test
                result = service.perform_full_sync(dry_run=False)
                
                # Verify the property: reported numbers should match actual operations
                expected_created = len(missing_users)
                assert result.created_profiles == expected_created, \
                    f"Should report {expected_created} created profiles, got {result.created_profiles}"
                
                assert result.total_auth_users == len(auth_users), \
                    f"Should report {len(auth_users)} total auth users, got {result.total_auth_users}"
                
                assert result.existing_profiles == len(existing_profiles), \
                    f"Should report {len(existing_profiles)} existing profiles, got {result.existing_profiles}"
                
                assert len(result.created_user_ids) == result.created_profiles, \
                    "Number of tracked user IDs should match reported created count"
                
                # Verify report generation accuracy
                report = service.generate_sync_report(result)
                assert report["operation_summary"]["profiles_created"] == expected_created, \
                    "Report should accurately reflect created profiles count"
                
                assert report["operation_summary"]["total_auth_users"] == len(auth_users), \
                    "Report should accurately reflect total auth users count"
                
                assert len(report["created_users"]) == expected_created, \
                    "Report should list all created user IDs"

    @settings(max_examples=100)
    @given(
        auth_users=auth_users_list_strategy(),
        existing_profiles=user_profiles_list_strategy()
    )
    def test_sync_idempotence(self, auth_users, existing_profiles):
        """
        Property 10: Sync Idempotence
        For any synchronization operation, running it multiple times should produce 
        the same result without creating duplicates or errors
        **Validates: Requirements 3.5**
        """
        # Set up mock responses
        auth_response = Mock()
        auth_response.data = auth_users
        auth_response.count = len(auth_users)
        
        profiles_response = Mock()
        profiles_response.data = existing_profiles
        profiles_response.count = len(existing_profiles)
        
        # Calculate expected missing users
        existing_user_ids = {profile["user_id"] for profile in existing_profiles}
        missing_users = [user for user in auth_users if user["id"] not in existing_user_ids]
        
        # For first run: mock successful creation
        first_run_responses = []
        for user in missing_users:
            response = Mock()
            response.data = [{
                "user_id": user["id"],
                "role": UserRole.team_member,
                "is_active": True
            }]
            first_run_responses.append(response)
        
        # For second run: mock that profiles already exist
        existing_check_responses = []
        for user in missing_users:
            response = Mock()
            response.data = [{  # Profile exists
                "user_id": user["id"]
            }]
            existing_check_responses.append(response)
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # First run setup
                self.mock_client.table.return_value.select.return_value.execute.side_effect = [
                    auth_response,  # get_sync_statistics - auth users
                    profiles_response,  # get_sync_statistics - profiles  
                    auth_response,  # identify_missing_profiles - auth users
                    profiles_response,  # identify_missing_profiles - profiles
                    auth_response,  # perform_full_sync - auth users
                    profiles_response   # perform_full_sync - profiles
                ]
                
                # Mock no existing profiles for first run
                self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
                self.mock_client.table.return_value.insert.return_value.execute.side_effect = first_run_responses
                
                # First synchronization run
                first_result = service.perform_full_sync(dry_run=False)
                
                # Reset mock for second run
                self.mock_client.reset_mock()
                
                # Second run setup - profiles now exist
                self.mock_client.table.return_value.select.return_value.execute.side_effect = [
                    auth_response,  # get_sync_statistics - auth users
                    profiles_response,  # get_sync_statistics - profiles
                    auth_response,  # identify_missing_profiles - auth users
                    profiles_response,  # identify_missing_profiles - profiles  
                    auth_response,  # perform_full_sync - auth users
                    profiles_response   # perform_full_sync - profiles
                ]
                
                # Mock that profiles now exist (simulate first run created them)
                updated_profiles = existing_profiles + [
                    {"user_id": user["id"]} for user in missing_users
                ]
                updated_profiles_response = Mock()
                updated_profiles_response.data = updated_profiles
                
                # Override the profiles response for second run
                self.mock_client.table.return_value.select.return_value.execute.side_effect = [
                    auth_response,  # get_sync_statistics - auth users
                    updated_profiles_response,  # get_sync_statistics - updated profiles
                    auth_response,  # identify_missing_profiles - auth users  
                    updated_profiles_response,  # identify_missing_profiles - updated profiles
                    auth_response,  # perform_full_sync - auth users
                    updated_profiles_response   # perform_full_sync - updated profiles
                ]
                
                # Second synchronization run
                second_result = service.perform_full_sync(dry_run=False)
                
                # Verify idempotence property
                if len(missing_users) > 0:
                    # First run should create profiles
                    assert first_result.created_profiles == len(missing_users), \
                        "First run should create profiles for missing users"
                    
                    # Second run should create no new profiles (idempotent)
                    assert second_result.created_profiles == 0, \
                        "Second run should create no new profiles (idempotent)"
                    
                    assert second_result.failed_creations == 0, \
                        "Second run should have no failures"
                    
                    assert len(second_result.errors) == 0, \
                        "Second run should have no errors"
                else:
                    # If no missing users, both runs should create nothing
                    assert first_result.created_profiles == 0, \
                        "First run should create no profiles when none missing"
                    assert second_result.created_profiles == 0, \
                        "Second run should create no profiles when none missing"
                
                # Both runs should report same total counts
                assert first_result.total_auth_users == second_result.total_auth_users, \
                    "Both runs should report same total auth users"

    @settings(max_examples=50)
    @given(user_id=st.text(min_size=1, max_size=50))
    def test_single_profile_creation_idempotence(self, user_id):
        """
        Property 10: Sync Idempotence - Single User
        For any single user profile creation, calling it multiple times should be idempotent
        **Validates: Requirements 3.5**
        """
        # Mock auth user exists
        auth_response = Mock()
        auth_response.data = [{"id": user_id}]
        
        # First call: no existing profile
        no_profile_response = Mock()
        no_profile_response.data = []
        
        # Profile creation success
        create_response = Mock()
        create_response.data = [{
            "user_id": user_id,
            "role": UserRole.team_member,
            "is_active": True
        }]
        
        # Second call: profile exists
        existing_profile_response = Mock()
        existing_profile_response.data = [{"user_id": user_id}]
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # First call setup
                self.mock_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
                    auth_response,  # Check auth user exists
                    no_profile_response  # No existing profile
                ]
                self.mock_client.table.return_value.insert.return_value.execute.return_value = create_response
                
                # First call should create profile
                first_result = service.create_profile_for_user(user_id)
                assert first_result == True, "First call should successfully create profile"
                
                # Reset mock for second call
                self.mock_client.reset_mock()
                
                # Second call setup - profile now exists
                self.mock_client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
                    auth_response,  # Check auth user exists
                    existing_profile_response  # Profile now exists
                ]
                
                # Second call should be idempotent (no creation, but return success)
                second_result = service.create_profile_for_user(user_id)
                assert second_result == True, "Second call should return success (idempotent)"
                
                # Verify insert was not called on second run (idempotent)
                self.mock_client.table.return_value.insert.assert_not_called()

    def test_sync_error_handling_consistency(self):
        """
        Property: Error Handling Consistency
        For any synchronization operation that encounters errors, the system should 
        maintain consistency and report errors accurately
        **Validates: Requirements 3.1, 3.2, 3.4**
        """
        # Create test data
        auth_users = [
            {"id": "user1", "email": "user1@test.com"},
            {"id": "user2", "email": "user2@test.com"},
            {"id": "user3", "email": "user3@test.com"}
        ]
        
        # Mock auth users response
        auth_response = Mock()
        auth_response.data = auth_users
        
        # Mock no existing profiles
        profiles_response = Mock()
        profiles_response.data = []
        
        # Mock mixed success/failure responses
        success_response = Mock()
        success_response.data = [{"user_id": "user1"}]
        
        failure_response = Mock()
        failure_response.data = None  # Simulate failure
        
        error_response = Mock()
        error_response.side_effect = Exception("Database error")
        
        # Create service with mocked client
        with patch('user_synchronization_service.service_supabase', self.mock_client):
            with patch('user_synchronization_service.supabase', self.mock_client):
                service = UserSynchronizationService()
                service.client = self.mock_client
                
                # Set up responses
                self.mock_client.table.return_value.select.return_value.execute.side_effect = [
                    auth_response,  # identify_missing_profiles - auth users
                    profiles_response  # identify_missing_profiles - profiles
                ]
                
                # Mock profile existence checks (all return empty)
                self.mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
                
                # Mock mixed insert results
                self.mock_client.table.return_value.insert.return_value.execute.side_effect = [
                    success_response,  # user1 succeeds
                    failure_response,  # user2 fails (no data)
                    error_response     # user3 throws exception
                ]
                
                # Call create_missing_profiles
                result = service.create_missing_profiles(auth_users)
                
                # Verify error handling consistency
                assert result.created_profiles == 1, "Should report exactly 1 successful creation"
                assert result.failed_creations == 2, "Should report exactly 2 failed creations"
                assert len(result.errors) == 2, "Should report exactly 2 errors"
                assert len(result.created_user_ids) == 1, "Should track exactly 1 created user ID"
                assert "user1" in result.created_user_ids, "Should track the successful user ID"
                
                # Verify total consistency
                total_operations = result.created_profiles + result.failed_creations
                assert total_operations == len(auth_users), \
                    "Total operations should equal input users"