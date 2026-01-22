"""
Property-Based Tests for Dynamic Permission Evaluation

Feature: rbac-enhancement, Properties 28-32: Dynamic Permission Evaluation

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

Property Definitions:

Property 28: Context-Aware Permission Evaluation
*For any* permission check with context, the evaluation must consider project assignments,
portfolio hierarchy, and organizational structure.

Property 29: Assignment Change Permission Synchronization
*For any* change in user assignments, permissions must be automatically updated and
caches must be invalidated.

Property 30: Multi-Level Permission Verification
*For any* permission check, the system must verify permissions at role-based,
resource-specific, and hierarchy-based levels.

Property 31: Time-Based Permission Support
*For any* time-based permission grant, the permission must only be valid during
the specified time period.

Property 32: Custom Permission Logic Extensibility
*For any* custom permission rule, the rule must be evaluated and can override
base permission results.

Testing Framework: pytest with Hypothesis for property-based testing
Minimum iterations: 100 per property test
"""

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from typing import List, Optional, Set
from unittest.mock import AsyncMock, MagicMock, patch

from auth.enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    EffectiveRole,
)
from auth.enhanced_permission_checker import EnhancedPermissionChecker
from auth.dynamic_permission_evaluator import (
    DynamicPermissionEvaluator,
    AssignmentChangeEvent,
    CustomPermissionRule,
    PermissionEvaluationResult,
)
from auth.time_based_permissions import (
    TimeBasedPermission,
    TimeBasedPermissionManager,
)
from auth.rbac import Permission, UserRole, DEFAULT_ROLE_PERMISSIONS


# =============================================================================
# Hypothesis Strategies for Generating Test Data
# =============================================================================

@st.composite
def uuid_strategy(draw):
    """Generate valid UUIDs for testing."""
    dev_ids = {
        "00000000-0000-0000-0000-000000000001",
        "bf1b1732-2449-4987-9fdb-fefa2a93b816"
    }
    uuid_val = draw(st.uuids())
    assume(str(uuid_val) not in dev_ids)
    return uuid_val


@st.composite
def permission_strategy(draw):
    """Generate valid Permission values."""
    return draw(st.sampled_from(list(Permission)))


@st.composite
def permission_context_strategy(draw):
    """Generate valid PermissionContext objects."""
    include_project = draw(st.booleans())
    include_portfolio = draw(st.booleans())
    include_organization = draw(st.booleans())
    include_resource = draw(st.booleans())
    
    return PermissionContext(
        project_id=draw(st.uuids()) if include_project else None,
        portfolio_id=draw(st.uuids()) if include_portfolio else None,
        organization_id=draw(st.uuids()) if include_organization else None,
        resource_id=draw(st.uuids()) if include_resource else None,
    )


@st.composite
def assignment_change_event_strategy(draw):
    """Generate valid AssignmentChangeEvent objects."""
    user_id = draw(uuid_strategy())
    assignment_type = draw(st.sampled_from(["project", "portfolio", "organization"]))
    assignment_id = draw(st.uuids())
    action = draw(st.sampled_from(["added", "removed", "modified"]))
    
    return AssignmentChangeEvent(
        user_id=user_id,
        assignment_type=assignment_type,
        assignment_id=assignment_id,
        action=action
    )


@st.composite
def time_delta_strategy(draw):
    """Generate valid timedelta objects."""
    days = draw(st.integers(min_value=0, max_value=365))
    hours = draw(st.integers(min_value=0, max_value=23))
    minutes = draw(st.integers(min_value=0, max_value=59))
    return timedelta(days=days, hours=hours, minutes=minutes)


@st.composite
def datetime_strategy(draw):
    """Generate valid datetime objects."""
    # Generate dates within a reasonable range
    days_offset = draw(st.integers(min_value=-365, max_value=365))
    base_time = datetime.now(timezone.utc)
    return base_time + timedelta(days=days_offset)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def permission_checker():
    """Create a permission checker without database connection."""
    return EnhancedPermissionChecker(supabase_client=None)


@pytest.fixture
def dynamic_evaluator(permission_checker):
    """Create a dynamic permission evaluator."""
    return DynamicPermissionEvaluator(
        permission_checker=permission_checker,
        supabase_client=None
    )


@pytest.fixture
def time_based_manager():
    """Create a time-based permission manager."""
    return TimeBasedPermissionManager(supabase_client=None)


# =============================================================================
# Property 28: Context-Aware Permission Evaluation
# Validates: Requirements 7.1
# =============================================================================

class TestContextAwarePermissionEvaluation:
    """
    Property 28: Context-Aware Permission Evaluation
    
    Feature: rbac-enhancement, Property 28
    **Validates: Requirements 7.1**
    
    Property: For any permission check with context, the evaluation must consider
    project assignments, portfolio hierarchy, and organizational structure.
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_context_aware_evaluation_considers_all_levels(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Context-aware evaluation must consider all hierarchy levels.
        
        For any user, permission, and context, the evaluation result must
        include information about which levels were checked (role-based,
        hierarchy-based, resource-specific).
        
        **Validates: Requirements 7.1**
        """
        # Create evaluator
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Evaluate permission
        result = await evaluator.evaluate_permission(user_id, permission, context)
        
        # Property: Result must be a PermissionEvaluationResult
        assert isinstance(result, PermissionEvaluationResult)
        
        # Property: Result must have evaluation path
        assert isinstance(result.evaluation_path, list)
        assert len(result.evaluation_path) > 0
        
        # Property: Evaluation path must include standard role check
        assert any("role-based" in step.lower() for step in result.evaluation_path)
        
        # Property: If context has project_id, hierarchy check must be mentioned
        if context and context.project_id:
            assert any("hierarchy" in step.lower() for step in result.evaluation_path)
        
        # Property: If context has resource_id, resource check must be mentioned
        if context and context.resource_id:
            assert any("resource" in step.lower() for step in result.evaluation_path)
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_evaluation_result_consistency(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Multiple evaluations with same inputs must return consistent results.
        
        For any user, permission, and context, evaluating the same permission
        multiple times must return the same result.
        
        **Validates: Requirements 7.1**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Evaluate permission twice
        result1 = await evaluator.evaluate_permission(user_id, permission, context)
        result2 = await evaluator.evaluate_permission(user_id, permission, context)
        
        # Property: Results must be consistent
        assert result1.has_permission == result2.has_permission
        assert result1.permission == result2.permission


# =============================================================================
# Property 29: Assignment Change Permission Synchronization
# Validates: Requirements 7.2
# =============================================================================

class TestAssignmentChangePermissionSynchronization:
    """
    Property 29: Assignment Change Permission Synchronization
    
    Feature: rbac-enhancement, Property 29
    **Validates: Requirements 7.2**
    
    Property: For any change in user assignments, permissions must be automatically
    updated and caches must be invalidated.
    """
    
    @pytest.mark.asyncio
    @given(
        event=assignment_change_event_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_assignment_change_clears_cache(self, event):
        """
        Property: Assignment changes must clear relevant permission caches.
        
        For any assignment change event, the user's permission cache must be
        cleared to ensure fresh evaluation.
        
        **Validates: Requirements 7.2**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Add some cached data for the user
        cache_key = f"perm:{event.user_id}:test:global"
        checker._permission_cache[cache_key] = True
        
        # Property: Cache should exist before event
        assert cache_key in checker._permission_cache
        
        # Handle assignment change
        await evaluator.handle_assignment_change(event)
        
        # Property: Cache should be cleared after event
        assert cache_key not in checker._permission_cache
    
    @pytest.mark.asyncio
    @given(
        event=assignment_change_event_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_assignment_change_notifies_listeners(self, event):
        """
        Property: Assignment changes must notify all registered listeners.
        
        For any assignment change event, all registered listeners must be called.
        
        **Validates: Requirements 7.2**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Register a mock listener
        listener_called = []
        
        async def mock_listener(evt):
            listener_called.append(evt)
        
        evaluator.register_assignment_listener(mock_listener)
        
        # Handle assignment change
        await evaluator.handle_assignment_change(event)
        
        # Property: Listener must be called
        assert len(listener_called) == 1
        assert listener_called[0].user_id == event.user_id
        assert listener_called[0].action == event.action


# =============================================================================
# Property 30: Multi-Level Permission Verification
# Validates: Requirements 7.3
# =============================================================================

class TestMultiLevelPermissionVerification:
    """
    Property 30: Multi-Level Permission Verification
    
    Feature: rbac-enhancement, Property 30
    **Validates: Requirements 7.3**
    
    Property: For any permission check, the system must verify permissions at
    role-based, resource-specific, and hierarchy-based levels.
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_multi_level_verification_checks_all_levels(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Multi-level verification must check all permission levels.
        
        For any user, permission, and context, the multi-level verification
        must return results for role-based, resource-specific, and hierarchy-based
        checks.
        
        **Validates: Requirements 7.3**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Verify multi-level permission
        results = await evaluator.verify_multi_level_permission(
            user_id, permission, context
        )
        
        # Property: Results must include all levels
        assert "role_based" in results
        assert "resource_specific" in results
        assert "hierarchy_based" in results
        assert "overall" in results
        
        # Property: All results must be boolean
        assert isinstance(results["role_based"], bool)
        assert isinstance(results["resource_specific"], bool)
        assert isinstance(results["hierarchy_based"], bool)
        assert isinstance(results["overall"], bool)
        
        # Property: Overall must be True if any level is True
        if results["role_based"] or results["resource_specific"] or results["hierarchy_based"]:
            assert results["overall"] is True
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_multi_level_verification_consistency(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Multi-level verification must be consistent across calls.
        
        For any user, permission, and context, multiple calls to multi-level
        verification must return the same results.
        
        **Validates: Requirements 7.3**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Verify twice
        results1 = await evaluator.verify_multi_level_permission(
            user_id, permission, context
        )
        results2 = await evaluator.verify_multi_level_permission(
            user_id, permission, context
        )
        
        # Property: Results must be consistent
        assert results1 == results2


# =============================================================================
# Property 31: Time-Based Permission Support
# Validates: Requirements 7.4
# =============================================================================

class TestTimeBasedPermissionSupport:
    """
    Property 31: Time-Based Permission Support
    
    Feature: rbac-enhancement, Property 31
    **Validates: Requirements 7.4**
    
    Property: For any time-based permission grant, the permission must only be
    valid during the specified time period.
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        duration=time_delta_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_time_based_permission_validity_period(
        self,
        user_id,
        permission,
        duration
    ):
        """
        Property: Time-based permissions must only be valid during their period.
        
        For any time-based permission with a duration, the permission must be
        valid immediately after grant and invalid after expiration.
        
        **Validates: Requirements 7.4**
        """
        # Assume reasonable duration
        assume(duration.total_seconds() > 0)
        assume(duration.total_seconds() < 365 * 24 * 3600)  # Less than a year
        
        manager = TimeBasedPermissionManager(supabase_client=None)
        
        # Grant temporary permission
        now = datetime.now(timezone.utc)
        time_perm = await manager.grant_temporary_permission(
            user_id=user_id,
            permission=permission,
            duration=duration,
            starts_at=now
        )
        
        # Property: Permission must be valid now
        assert time_perm.is_valid_at(now)
        
        # Property: Permission must be valid just before expiration
        just_before_expiry = time_perm.expires_at - timedelta(seconds=1)
        assert time_perm.is_valid_at(just_before_expiry)
        
        # Property: Permission must be invalid after expiration
        after_expiry = time_perm.expires_at + timedelta(seconds=1)
        assert not time_perm.is_valid_at(after_expiry)
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        start_time=datetime_strategy(),
        end_time=datetime_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_scheduled_permission_validity(
        self,
        user_id,
        permission,
        start_time,
        end_time
    ):
        """
        Property: Scheduled permissions must only be valid during their window.
        
        For any scheduled permission, the permission must be invalid before
        start time and after end time.
        
        **Validates: Requirements 7.4**
        """
        # Ensure start is before end
        assume(start_time < end_time)
        
        manager = TimeBasedPermissionManager(supabase_client=None)
        
        # Grant scheduled permission
        time_perm = await manager.grant_scheduled_permission(
            user_id=user_id,
            permission=permission,
            starts_at=start_time,
            expires_at=end_time
        )
        
        # Property: Permission must be invalid before start
        before_start = start_time - timedelta(seconds=1)
        assert not time_perm.is_valid_at(before_start)
        
        # Property: Permission must be valid during window
        during = start_time + (end_time - start_time) / 2
        assert time_perm.is_valid_at(during)
        
        # Property: Permission must be invalid after end
        after_end = end_time + timedelta(seconds=1)
        assert not time_perm.is_valid_at(after_end)
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        duration=time_delta_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_time_based_permission_expiration_calculation(
        self,
        user_id,
        permission,
        duration
    ):
        """
        Property: Time until expiration must be calculated correctly.
        
        For any time-based permission, the time_until_expiration method must
        return the correct remaining time.
        
        **Validates: Requirements 7.4**
        """
        assume(duration.total_seconds() > 0)
        assume(duration.total_seconds() < 365 * 24 * 3600)
        
        manager = TimeBasedPermissionManager(supabase_client=None)
        
        # Grant temporary permission
        now = datetime.now(timezone.utc)
        time_perm = await manager.grant_temporary_permission(
            user_id=user_id,
            permission=permission,
            duration=duration,
            starts_at=now
        )
        
        # Property: Time until expiration must be approximately equal to duration
        time_remaining = time_perm.time_until_expiration()
        assert time_remaining is not None
        
        # Allow small difference due to execution time
        difference = abs(time_remaining.total_seconds() - duration.total_seconds())
        assert difference < 2  # Less than 2 seconds difference


# =============================================================================
# Property 32: Custom Permission Logic Extensibility
# Validates: Requirements 7.5
# =============================================================================

class TestCustomPermissionLogicExtensibility:
    """
    Property 32: Custom Permission Logic Extensibility
    
    Feature: rbac-enhancement, Property 32
    **Validates: Requirements 7.5**
    
    Property: For any custom permission rule, the rule must be evaluated and
    can override base permission results.
    """
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_custom_rule_registration_and_evaluation(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Custom rules must be registered and evaluated.
        
        For any custom rule, after registration it must be evaluated during
        permission checks.
        
        **Validates: Requirements 7.5**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Create a custom rule that always grants permission
        class AlwaysGrantRule(CustomPermissionRule):
            def __init__(self):
                super().__init__("always_grant", "Always grant permission")
                self.evaluated = False
            
            async def evaluate(self, user_id, permission, context, base_result):
                self.evaluated = True
                return True
        
        rule = AlwaysGrantRule()
        
        # Property: Rule should not be evaluated before registration
        assert not rule.evaluated
        
        # Register the rule
        evaluator.register_custom_rule(rule)
        
        # Property: Rule must be in registered rules
        assert "always_grant" in [r.name for r in evaluator.get_custom_rules()]
        
        # Evaluate permission
        result = await evaluator.evaluate_permission(user_id, permission, context)
        
        # Property: Rule must have been evaluated
        assert rule.evaluated
        
        # Property: Permission must be granted due to custom rule
        assert result.has_permission is True
        assert "custom_rule:always_grant" in result.applied_rules
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy(),
        context=permission_context_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_custom_rule_can_override_base_result(
        self,
        user_id,
        permission,
        context
    ):
        """
        Property: Custom rules can override base permission results.
        
        For any custom rule that grants permission, the final result must be
        True even if base permission check fails.
        
        **Validates: Requirements 7.5**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Create a custom rule that overrides to grant
        class OverrideGrantRule(CustomPermissionRule):
            def __init__(self):
                super().__init__("override_grant", "Override to grant")
            
            async def evaluate(self, user_id, permission, context, base_result):
                # Always grant, regardless of base result
                return True
        
        rule = OverrideGrantRule()
        evaluator.register_custom_rule(rule)
        
        # Evaluate permission (base will likely be False for random user)
        result = await evaluator.evaluate_permission(user_id, permission, context)
        
        # Property: Permission must be granted due to custom rule override
        assert result.has_permission is True
    
    @pytest.mark.asyncio
    @given(
        user_id=uuid_strategy(),
        permission=permission_strategy()
    )
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    async def test_custom_rule_unregistration(
        self,
        user_id,
        permission
    ):
        """
        Property: Custom rules can be unregistered.
        
        For any registered custom rule, after unregistration it must not be
        evaluated during permission checks.
        
        **Validates: Requirements 7.5**
        """
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        
        # Create and register a custom rule
        class TestRule(CustomPermissionRule):
            def __init__(self):
                super().__init__("test_rule", "Test rule")
                self.evaluation_count = 0
            
            async def evaluate(self, user_id, permission, context, base_result):
                self.evaluation_count += 1
                return True
        
        rule = TestRule()
        evaluator.register_custom_rule(rule)
        
        # Evaluate once
        await evaluator.evaluate_permission(user_id, permission, None)
        
        # Property: Rule should have been evaluated once
        assert rule.evaluation_count == 1
        
        # Unregister the rule
        evaluator.unregister_custom_rule("test_rule")
        
        # Property: Rule must not be in registered rules
        assert "test_rule" not in [r.name for r in evaluator.get_custom_rules()]
        
        # Evaluate again
        await evaluator.evaluate_permission(user_id, permission, None)
        
        # Property: Rule should not have been evaluated again
        assert rule.evaluation_count == 1


# =============================================================================
# Integration Tests
# =============================================================================

class TestDynamicEvaluationIntegration:
    """Integration tests for dynamic permission evaluation."""
    
    @pytest.mark.asyncio
    async def test_full_dynamic_evaluation_workflow(self):
        """
        Test the complete dynamic evaluation workflow.
        
        This test validates that all components work together correctly.
        """
        # Create components
        checker = EnhancedPermissionChecker(supabase_client=None)
        evaluator = DynamicPermissionEvaluator(
            permission_checker=checker,
            supabase_client=None
        )
        time_manager = TimeBasedPermissionManager(supabase_client=None)
        
        # Test data
        user_id = uuid4()
        permission = Permission.project_read
        context = PermissionContext(project_id=uuid4())
        
        # Grant time-based permission
        await time_manager.grant_temporary_permission(
            user_id=user_id,
            permission=permission,
            duration=timedelta(hours=1),
            context=context
        )
        
        # Register custom rule
        class TestRule(CustomPermissionRule):
            def __init__(self):
                super().__init__("test", "Test rule")
            
            async def evaluate(self, uid, perm, ctx, base):
                return True
        
        evaluator.register_custom_rule(TestRule())
        
        # Evaluate permission
        result = await evaluator.evaluate_permission(user_id, permission, context)
        
        # Verify result
        assert isinstance(result, PermissionEvaluationResult)
        assert result.permission == permission
        assert result.context == context
        assert len(result.evaluation_path) > 0
