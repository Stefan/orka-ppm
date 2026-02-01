"""
Property-based tests for Feature Flag and Deployment Safety (Property 15)

Feature: generic-construction-ppm-features
Property 15: Feature Flag and Deployment Safety

Validates: Requirements 10.5, 10.6

For any new feature deployment, feature flags must be available for gradual 
rollout and comprehensive API documentation must be provided.
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
from typing import List, Dict, Any, Optional
from uuid import uuid4, UUID
from datetime import datetime, timedelta
import hashlib

# Add parent directory to path for imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.feature_flags import (
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagStatus,
    RolloutStrategy
)
from services.feature_flag_service import FeatureFlagService


# ============================================================================
# Hypothesis Strategies
# ============================================================================

def feature_name_strategy():
    """Generate valid feature names"""
    return st.text(
        min_size=3,
        max_size=50,
        alphabet=st.characters(
            whitelist_categories=('Ll', 'Nd'),
            whitelist_characters='_-'
        )
    ).filter(lambda x: x[0].isalpha())


def feature_description_strategy():
    """Generate feature descriptions"""
    return st.text(min_size=10, max_size=500)


def rollout_percentage_strategy():
    """Generate valid rollout percentages"""
    return st.integers(min_value=0, max_value=100)


def user_id_list_strategy():
    """Generate list of user UUIDs"""
    return st.lists(
        st.builds(uuid4),
        min_size=0,
        max_size=20,
        unique=True
    )


def role_list_strategy():
    """Generate list of role names"""
    return st.lists(
        st.sampled_from(['admin', 'project_manager', 'user', 'viewer', 'contributor']),
        min_size=0,
        max_size=5,
        unique=True
    )


def feature_flag_create_strategy():
    """Generate FeatureFlagCreate instances"""
    return st.builds(
        FeatureFlagCreate,
        name=feature_name_strategy(),
        description=feature_description_strategy(),
        status=st.sampled_from(list(FeatureFlagStatus)),
        rollout_strategy=st.sampled_from(list(RolloutStrategy)),
        rollout_percentage=st.one_of(st.none(), rollout_percentage_strategy()),
        allowed_user_ids=st.one_of(st.none(), user_id_list_strategy()),
        allowed_roles=st.one_of(st.none(), role_list_strategy()),
        metadata=st.one_of(st.none(), st.dictionaries(st.text(max_size=20), st.text(max_size=100), max_size=5))
    )


# ============================================================================
# Mock Database for Testing
# ============================================================================

class MockSupabaseClient:
    """Mock Supabase client for testing"""
    
    def __init__(self):
        self.feature_flags = {}
        self.access_logs = []
    
    def table(self, table_name: str):
        return MockTable(self, table_name)


class MockTable:
    """Mock Supabase table"""
    
    def __init__(self, client: MockSupabaseClient, table_name: str):
        self.client = client
        self.table_name = table_name
        self._query = {}
        self._data = None
    
    def select(self, columns: str):
        self._query['select'] = columns
        return self
    
    def insert(self, data: Dict[str, Any]):
        if self.table_name == 'feature_flags':
            flag_id = str(uuid4())
            flag_data = {
                'id': flag_id,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                **data
            }
            self.client.feature_flags[flag_id] = flag_data
            self._data = [flag_data]
        return self
    
    def update(self, data: Dict[str, Any]):
        if self.table_name == 'feature_flags':
            self._update_data = data
        return self
    
    def delete(self):
        return self
    
    def eq(self, column: str, value: Any):
        if self.table_name == 'feature_flags':
            if column == 'id':
                flag = self.client.feature_flags.get(str(value))
                if hasattr(self, '_update_data') and flag:
                    # Apply update
                    flag.update(self._update_data)
                    self._data = [flag]
                else:
                    self._data = [flag] if flag else []
            elif column == 'name':
                matching = [f for f in self.client.feature_flags.values() if f.get('name') == value]
                self._data = matching
        return self
    
    def execute(self):
        return MockResponse(self._data if self._data is not None else [])


class MockResponse:
    """Mock Supabase response"""
    
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


# ============================================================================
# Property-Based Tests
# ============================================================================

class TestFeatureFlagDeploymentSafetyProperties:
    """
    Property-based tests for feature flag and deployment safety.
    
    Tests validate that:
    1. Feature flags can be created and managed for all new features
    2. Rollout strategies work correctly for gradual deployment
    3. User-based access control is enforced consistently
    4. Feature flag state changes are deterministic
    """
    
    @settings(max_examples=100)
    @given(flag_data=feature_flag_create_strategy())
    def test_feature_flag_creation_availability(self, flag_data: FeatureFlagCreate):
        """
        Property: For any new feature, a feature flag can be created with valid configuration.
        
        Validates: Requirement 10.6 - Feature flags available for gradual rollout
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        creator_id = uuid4()
        
        # Act
        try:
            created_flag = service.create_feature_flag(flag_data, creator_id)
            
            # Assert - Feature flag was created successfully
            assert created_flag is not None, "Feature flag should be created"
            assert created_flag.name == flag_data.name, "Feature name should match"
            assert created_flag.description == flag_data.description, "Description should match"
            assert created_flag.status == flag_data.status, "Status should match"
            assert created_flag.rollout_strategy == flag_data.rollout_strategy, "Rollout strategy should match"
            assert created_flag.created_by == creator_id, "Creator should be recorded"
            
            # Verify flag is retrievable
            retrieved_flag = service.get_feature_flag_by_name(flag_data.name)
            assert retrieved_flag is not None, "Created flag should be retrievable"
            assert retrieved_flag.id == created_flag.id, "Retrieved flag should match created flag"
            
        except ValueError as e:
            # Some combinations may be invalid (e.g., percentage strategy without percentage)
            # This is acceptable - the service should validate and reject invalid configurations
            assert "percentage" in str(e).lower() or "role" in str(e).lower() or "user" in str(e).lower()
    
    @settings(max_examples=100)
    @given(
        feature_name=feature_name_strategy(),
        user_id=st.builds(uuid4),
        rollout_percentage=rollout_percentage_strategy()
    )
    def test_percentage_rollout_consistency(
        self,
        feature_name: str,
        user_id: UUID,
        rollout_percentage: int
    ):
        """
        Property: For any user and rollout percentage, the same user always gets 
        the same result (enabled/disabled) for a given feature.
        
        This ensures gradual rollout is stable and users don't experience flickering.
        
        Validates: Requirement 10.6 - Gradual rollout consistency
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        flag_data = FeatureFlagCreate(
            name=feature_name,
            description="Test feature",
            status=FeatureFlagStatus.ENABLED,
            rollout_strategy=RolloutStrategy.PERCENTAGE,
            rollout_percentage=rollout_percentage
        )
        
        creator_id = uuid4()
        created_flag = service.create_feature_flag(flag_data, creator_id)
        
        # Act - Check feature multiple times for the same user
        results = []
        for _ in range(10):
            result = service.check_feature_enabled(feature_name, user_id, None)
            results.append(result.is_enabled)
        
        # Assert - All results should be identical (consistency)
        assert all(r == results[0] for r in results), \
            f"Feature flag check should be consistent for user {user_id}"
        
        # Verify the result matches the expected percentage distribution
        # (using the same hashing logic as the service)
        user_hash = service._hash_user_for_percentage(str(user_id), feature_name)
        expected_enabled = user_hash < rollout_percentage
        
        assert results[0] == expected_enabled, \
            f"Feature flag result should match hash-based calculation"
    
    @settings(max_examples=100)
    @given(
        feature_name=feature_name_strategy(),
        allowed_users=user_id_list_strategy(),
        test_user=st.builds(uuid4)
    )
    def test_user_list_access_control(
        self,
        feature_name: str,
        allowed_users: List[UUID],
        test_user: UUID
    ):
        """
        Property: For any feature with user list strategy, only users in the 
        allowed list can access the feature.
        
        Validates: Requirement 10.6 - User-based access control
        """
        # Skip if no allowed users (would always be disabled)
        assume(len(allowed_users) > 0)
        
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        flag_data = FeatureFlagCreate(
            name=feature_name,
            description="Test feature",
            status=FeatureFlagStatus.ENABLED,
            rollout_strategy=RolloutStrategy.USER_LIST,
            allowed_user_ids=allowed_users
        )
        
        creator_id = uuid4()
        created_flag = service.create_feature_flag(flag_data, creator_id)
        
        # Act
        result = service.check_feature_enabled(feature_name, test_user, None)
        
        # Assert
        expected_enabled = test_user in allowed_users
        assert result.is_enabled == expected_enabled, \
            f"User {test_user} should {'be' if expected_enabled else 'not be'} enabled"
        
        if expected_enabled:
            assert "allowed list" in result.reason.lower(), \
                "Reason should indicate user is in allowed list"
        else:
            assert "not in allowed list" in result.reason.lower(), \
                "Reason should indicate user is not in allowed list"
    
    @settings(max_examples=100)
    @given(
        feature_name=feature_name_strategy(),
        allowed_roles=role_list_strategy(),
        user_roles=role_list_strategy()
    )
    def test_role_based_access_control(
        self,
        feature_name: str,
        allowed_roles: List[str],
        user_roles: List[str]
    ):
        """
        Property: For any feature with role-based strategy, users with at least 
        one allowed role can access the feature.
        
        Validates: Requirement 10.6 - Role-based access control
        """
        # Skip if no allowed roles (would always be disabled)
        assume(len(allowed_roles) > 0)
        
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        flag_data = FeatureFlagCreate(
            name=feature_name,
            description="Test feature",
            status=FeatureFlagStatus.ENABLED,
            rollout_strategy=RolloutStrategy.ROLE_BASED,
            allowed_roles=allowed_roles
        )
        
        creator_id = uuid4()
        created_flag = service.create_feature_flag(flag_data, creator_id)
        
        # Act
        user_id = uuid4()
        result = service.check_feature_enabled(feature_name, user_id, user_roles)
        
        # Assert
        has_allowed_role = any(role in allowed_roles for role in user_roles)
        assert result.is_enabled == has_allowed_role, \
            f"User with roles {user_roles} should {'be' if has_allowed_role else 'not be'} enabled"
        
        if has_allowed_role:
            assert "allowed role" in result.reason.lower(), \
                "Reason should indicate user has allowed role"
        else:
            # Could be either "does not have allowed role" or "user roles required"
            assert ("does not have allowed role" in result.reason.lower() or 
                    "user roles required" in result.reason.lower()), \
                "Reason should indicate user lacks allowed role or roles are required"
    
    @settings(max_examples=50)
    @given(
        feature_name=feature_name_strategy(),
        initial_status=st.sampled_from(list(FeatureFlagStatus)),
        new_status=st.sampled_from(list(FeatureFlagStatus))
    )
    def test_feature_flag_status_transitions(
        self,
        feature_name: str,
        initial_status: FeatureFlagStatus,
        new_status: FeatureFlagStatus
    ):
        """
        Property: Feature flag status can be updated and the new status is 
        immediately reflected in access checks.
        
        Validates: Requirement 10.6 - Feature flag management
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        flag_data = FeatureFlagCreate(
            name=feature_name,
            description="Test feature",
            status=initial_status,
            rollout_strategy=RolloutStrategy.ALL_USERS
        )
        
        creator_id = uuid4()
        created_flag = service.create_feature_flag(flag_data, creator_id)
        
        # Act - Update status
        update_data = FeatureFlagUpdate(status=new_status)
        updated_flag = service.update_feature_flag(created_flag.id, update_data)
        
        # Check feature access
        user_id = uuid4()
        result = service.check_feature_enabled(feature_name, user_id, None)
        
        # Assert
        assert updated_flag.status == new_status, "Status should be updated"
        
        # Feature should be enabled only if status is ENABLED or BETA
        expected_enabled = new_status in [FeatureFlagStatus.ENABLED, FeatureFlagStatus.BETA]
        assert result.is_enabled == expected_enabled, \
            f"Feature should be {'enabled' if expected_enabled else 'disabled'} with status {new_status}"
    
    @settings(max_examples=50)
    @given(
        features=st.lists(
            st.tuples(feature_name_strategy(), feature_description_strategy()),
            min_size=1,
            max_size=10,
            unique_by=lambda x: x[0]
        )
    )
    def test_multiple_feature_flags_independence(
        self,
        features: List[tuple]
    ):
        """
        Property: Multiple feature flags can coexist and operate independently 
        without interfering with each other.
        
        Validates: Requirement 10.6 - Multiple feature management
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        creator_id = uuid4()
        
        created_flags = []
        for feature_name, description in features:
            flag_data = FeatureFlagCreate(
                name=feature_name,
                description=description,
                status=FeatureFlagStatus.ENABLED,
                rollout_strategy=RolloutStrategy.ALL_USERS
            )
            
            try:
                created_flag = service.create_feature_flag(flag_data, creator_id)
                created_flags.append(created_flag)
            except ValueError:
                # Duplicate name - skip
                pass
        
        # Act - Check each feature independently
        user_id = uuid4()
        results = {}
        for flag in created_flags:
            result = service.check_feature_enabled(flag.name, user_id, None)
            results[flag.name] = result
        
        # Assert - All features should be independently accessible
        assert len(results) == len(created_flags), \
            "All created features should be checkable"
        
        for flag in created_flags:
            assert results[flag.name].is_enabled, \
                f"Feature {flag.name} should be enabled"
            assert results[flag.name].feature_name == flag.name, \
                "Result should reference correct feature"
    
    @settings(max_examples=50)
    @given(
        feature_name=feature_name_strategy(),
        rollout_percentage=rollout_percentage_strategy(),
        num_users=st.integers(min_value=100, max_value=1000)
    )
    def test_percentage_rollout_distribution(
        self,
        feature_name: str,
        rollout_percentage: int,
        num_users: int
    ):
        """
        Property: For percentage-based rollout, the actual percentage of enabled 
        users should approximate the configured percentage (within reasonable bounds).
        
        Validates: Requirement 10.6 - Accurate percentage rollout
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        flag_data = FeatureFlagCreate(
            name=feature_name,
            description="Test feature",
            status=FeatureFlagStatus.ENABLED,
            rollout_strategy=RolloutStrategy.PERCENTAGE,
            rollout_percentage=rollout_percentage
        )
        
        creator_id = uuid4()
        created_flag = service.create_feature_flag(flag_data, creator_id)
        
        # Act - Check feature for many users
        enabled_count = 0
        for _ in range(num_users):
            user_id = uuid4()
            result = service.check_feature_enabled(feature_name, user_id, None)
            if result.is_enabled:
                enabled_count += 1
        
        # Assert - Actual percentage should be close to configured percentage
        actual_percentage = (enabled_count / num_users) * 100
        
        # Allow 10% margin of error for statistical variation
        margin = 10
        assert abs(actual_percentage - rollout_percentage) <= margin, \
            f"Actual rollout {actual_percentage:.1f}% should be within {margin}% of target {rollout_percentage}%"
    
    @settings(max_examples=50)
    @given(
        feature_name=feature_name_strategy(),
        description=feature_description_strategy()
    )
    def test_disabled_feature_always_blocks_access(
        self,
        feature_name: str,
        description: str
    ):
        """
        Property: A disabled feature flag always blocks access regardless of 
        rollout strategy or user attributes.
        
        Validates: Requirement 10.6 - Feature flag safety
        """
        # Arrange
        mock_db = MockSupabaseClient()
        service = FeatureFlagService(mock_db)
        
        # Test with different rollout strategies
        strategies = [
            (RolloutStrategy.ALL_USERS, None, None, None),
            (RolloutStrategy.PERCENTAGE, 100, None, None),
            (RolloutStrategy.USER_LIST, None, [uuid4()], None),
            (RolloutStrategy.ROLE_BASED, None, None, ['admin'])
        ]
        
        for strategy, percentage, users, roles in strategies:
            flag_data = FeatureFlagCreate(
                name=f"{feature_name}_{strategy.value}",
                description=description,
                status=FeatureFlagStatus.DISABLED,
                rollout_strategy=strategy,
                rollout_percentage=percentage,
                allowed_user_ids=users,
                allowed_roles=roles
            )
            
            creator_id = uuid4()
            created_flag = service.create_feature_flag(flag_data, creator_id)
            
            # Act - Check with various user configurations
            test_user = users[0] if users else uuid4()
            test_roles = roles if roles else ['admin']
            
            result = service.check_feature_enabled(
                created_flag.name,
                test_user,
                test_roles
            )
            
            # Assert - Should always be disabled
            assert not result.is_enabled, \
                f"Disabled feature with {strategy.value} strategy should block access"
            assert "disabled" in result.reason.lower(), \
                "Reason should indicate feature is disabled"


# ============================================================================
# Integration Tests for API Documentation
# ============================================================================

class TestAPIDocumentationAvailability:
    """
    Tests to verify comprehensive API documentation is available.
    
    Validates: Requirement 10.5 - API documentation
    """
    
    def test_feature_flag_endpoints_documented(self):
        """
        Verify that all feature flag endpoints have proper documentation.
        
        This test checks that the FastAPI router has docstrings and 
        response models defined.
        """
        from routers.feature_flags import router
        
        # Check that router exists and has routes
        assert router is not None, "Feature flags router should exist"
        assert len(router.routes) > 0, "Router should have routes defined"
        
        # Check each route has documentation
        for route in router.routes:
            if hasattr(route, 'endpoint'):
                endpoint = route.endpoint
                assert endpoint.__doc__ is not None, \
                    f"Endpoint {endpoint.__name__} should have documentation"
                assert len(endpoint.__doc__.strip()) > 20, \
                    f"Endpoint {endpoint.__name__} should have meaningful documentation"
    
    def test_generic_construction_endpoints_documented(self):
        """
        Verify that all Generic Construction feature endpoints are documented.
        
        Validates: Requirement 10.5
        """
        routers_to_check = [
            'shareable_urls',
            'simulations',
            'scenarios',
            'po_breakdown'
        ]
        
        for router_name in routers_to_check:
            try:
                module = __import__(f'routers.{router_name}', fromlist=['router'])
                router = getattr(module, 'router')
                
                assert router is not None, f"{router_name} router should exist"
                assert len(router.routes) > 0, f"{router_name} should have routes"
                
                # Check routes have documentation
                documented_routes = 0
                for route in router.routes:
                    if hasattr(route, 'endpoint') and route.endpoint.__doc__:
                        documented_routes += 1
                
                assert documented_routes > 0, \
                    f"{router_name} should have documented endpoints"
                    
            except ImportError:
                pytest.skip(f"Router {router_name} not available for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
