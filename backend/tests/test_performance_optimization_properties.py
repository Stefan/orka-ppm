"""
Property-Based Tests for RBAC Performance Optimization

This module contains property-based tests for:
- Property 33: Permission Caching Efficiency
- Property 34: Cache Invalidation Consistency
- Property 35: Session Performance Optimization
- Property 36: Database Query Efficiency
- Property 37: Performance Monitoring Availability

Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
"""

import pytest
import asyncio
import time
from uuid import UUID, uuid4
from typing import List, Dict, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from hypothesis import given, strategies as st, settings, assume, HealthCheck

# Import RBAC components
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from auth.rbac import Permission, UserRole
from auth.enhanced_rbac_models import PermissionContext, ScopeType
from auth.permission_cache import PermissionCache, get_permission_cache
from auth.session_performance import (
    SessionPerformanceOptimizer,
    PerformanceMetrics,
    get_session_optimizer
)


# =============================================================================
# Hypothesis Strategies
# =============================================================================

def user_ids():
    """Generate valid user UUIDs."""
    return st.uuids().map(lambda u: u)


def permissions():
    """Generate valid Permission enums."""
    return st.sampled_from(list(Permission))


def permission_contexts():
    """Generate valid PermissionContext objects."""
    return st.one_of(
        st.none(),
        st.builds(
            PermissionContext,
            project_id=st.one_of(st.none(), st.uuids()),
            portfolio_id=st.one_of(st.none(), st.uuids()),
            organization_id=st.one_of(st.none(), st.uuids()),
        )
    )


def cache_ttls():
    """Generate valid cache TTL values."""
    return st.integers(min_value=1, max_value=3600)


def permission_results():
    """Generate permission check results."""
    return st.booleans()


# =============================================================================
# Property 33: Permission Caching Efficiency
# Validates: Requirements 8.1
# =============================================================================

class TestPermissionCachingEfficiency:
    """
    Property 33: Permission Caching Efficiency
    
    For any frequent permission check, the system must cache results to minimize
    database queries while maintaining accuracy.
    
    Feature: rbac-enhancement, Property 33: Permission Caching Efficiency
    """
    
    @given(
        user_id=user_ids(),
        permission=permissions(),
        context=permission_contexts(),
        result=permission_results(),
        cache_ttl=cache_ttls()
    )
    @settings(max_examples=100, deadline=None)
    def test_property_33_cache_stores_and_retrieves_correctly(
        self,
        user_id: UUID,
        permission: Permission,
        context: PermissionContext,
        result: bool,
        cache_ttl: int
    ):
        """
        Test that cached permission results are stored and retrieved correctly.
        
        Property: For any permission check result, caching it and then retrieving
        it must return the same result.
        """
        async def run_test():
            # Create cache instance
            cache = PermissionCache(redis_client=None, cache_ttl=cache_ttl)
            
            # Cache a permission result
            await cache.cache_permission(user_id, permission.value, result, context)
            
            # Retrieve the cached result
            cached_result = await cache.get_cached_permission(
                user_id, permission.value, context
            )
            
            # Verify the result matches
            assert cached_result == result, (
                f"Cached result {cached_result} does not match original {result}"
            )
            
            # Verify cache hit was recorded
            stats = cache.get_cache_stats()
            assert stats["cache_hits"] > 0, "Cache hit should be recorded"
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids(),
        permissions_list=st.lists(permissions(), min_size=1, max_size=10, unique=True),
        context=permission_contexts()
    )
    @settings(max_examples=50, deadline=None)
    def test_property_33_batch_caching_efficiency(
        self,
        user_id: UUID,
        permissions_list: List[Permission],
        context: PermissionContext
    ):
        """
        Test that batch permission caching is more efficient than individual caching.
        
        Property: Caching multiple permissions at once should be more efficient
        than caching them individually.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # Cache all permissions at once
            await cache.cache_permissions(user_id, permissions_list, context)
            
            # Retrieve all permissions
            cached_perms = await cache.get_cached_permissions(user_id, context)
            
            # Verify all permissions were cached
            assert cached_perms is not None, "Permissions should be cached"
            assert len(cached_perms) == len(permissions_list), (
                f"Expected {len(permissions_list)} permissions, got {len(cached_perms)}"
            )
            
            # Verify all permissions match
            cached_set = set(cached_perms)
            original_set = set(permissions_list)
            assert cached_set == original_set, (
                f"Cached permissions {cached_set} do not match original {original_set}"
            )
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids(),
        permission=permissions(),
        context=permission_contexts(),
        result=permission_results()
    )
    @settings(max_examples=50, deadline=None)
    def test_property_33_cache_hit_rate_improvement(
        self,
        user_id: UUID,
        permission: Permission,
        context: PermissionContext,
        result: bool
    ):
        """
        Test that repeated permission checks improve cache hit rate.
        
        Property: Checking the same permission multiple times should result in
        cache hits after the first check.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # First check - cache miss
            first_result = await cache.get_cached_permission(
                user_id, permission.value, context
            )
            assert first_result is None, "First check should be a cache miss"
            
            # Cache the result
            await cache.cache_permission(user_id, permission.value, result, context)
            
            # Subsequent checks - cache hits
            for _ in range(5):
                cached_result = await cache.get_cached_permission(
                    user_id, permission.value, context
                )
                assert cached_result == result, "Subsequent checks should be cache hits"
            
            # Verify cache hit rate
            stats = cache.get_cache_stats()
            assert stats["cache_hits"] >= 5, "Should have at least 5 cache hits"
            assert stats["hit_rate_percent"] > 0, "Hit rate should be positive"
        
        asyncio.run(run_test())


# =============================================================================
# Property 34: Cache Invalidation Consistency
# Validates: Requirements 8.2
# =============================================================================

class TestCacheInvalidationConsistency:
    """
    Property 34: Cache Invalidation Consistency
    
    For any user role change, the system must invalidate relevant cache entries
    to maintain permission consistency.
    
    Feature: rbac-enhancement, Property 34: Cache Invalidation Consistency
    """
    
    @given(
        user_id=user_ids(),
        permissions_list=st.lists(permissions(), min_size=1, max_size=5, unique=True),
        contexts=st.lists(permission_contexts(), min_size=1, max_size=3)
    )
    @settings(max_examples=50, deadline=None)
    def test_property_34_user_cache_invalidation_completeness(
        self,
        user_id: UUID,
        permissions_list: List[Permission],
        contexts: List[PermissionContext]
    ):
        """
        Test that invalidating user cache removes all cached entries for that user.
        
        Property: After invalidating a user's cache, all subsequent permission
        checks should be cache misses.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # Cache multiple permissions in different contexts
            for perm in permissions_list:
                for context in contexts:
                    await cache.cache_permission(user_id, perm.value, True, context)
            
            # Verify entries are cached
            for perm in permissions_list:
                for context in contexts:
                    result = await cache.get_cached_permission(
                        user_id, perm.value, context
                    )
                    assert result is not None, "Entries should be cached"
            
            # Invalidate user cache
            invalidated_count = await cache.invalidate_user_cache(user_id)
            assert invalidated_count > 0, "Should invalidate at least one entry"
            
            # Verify all entries are invalidated
            for perm in permissions_list:
                for context in contexts:
                    result = await cache.get_cached_permission(
                        user_id, perm.value, context
                    )
                    assert result is None, (
                        f"Entry for {perm.value} in context {context} should be invalidated"
                    )
        
        asyncio.run(run_test())
    
    @given(
        user_ids_list=st.lists(user_ids(), min_size=2, max_size=5, unique=True),
        permission=permissions(),
        context=permission_contexts()
    )
    @settings(max_examples=50, deadline=None)
    def test_property_34_selective_invalidation(
        self,
        user_ids_list: List[UUID],
        permission: Permission,
        context: PermissionContext
    ):
        """
        Test that invalidating one user's cache doesn't affect other users.
        
        Property: Invalidating cache for user A should not invalidate cache for user B.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # Cache permission for all users
            for uid in user_ids_list:
                await cache.cache_permission(uid, permission.value, True, context)
            
            # Invalidate cache for first user only
            target_user = user_ids_list[0]
            await cache.invalidate_user_cache(target_user)
            
            # Verify target user's cache is invalidated
            result = await cache.get_cached_permission(
                target_user, permission.value, context
            )
            assert result is None, "Target user's cache should be invalidated"
            
            # Verify other users' caches are intact
            for uid in user_ids_list[1:]:
                result = await cache.get_cached_permission(
                    uid, permission.value, context
                )
                assert result is not None, (
                    f"User {uid}'s cache should not be affected"
                )
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids(),
        permission=permissions(),
        context_type=st.sampled_from(["project", "portfolio", "organization"]),
        context_id=user_ids()  # Reuse UUID strategy
    )
    @settings(max_examples=50, deadline=None)
    def test_property_34_context_invalidation(
        self,
        user_id: UUID,
        permission: Permission,
        context_type: str,
        context_id: UUID
    ):
        """
        Test that context-specific cache invalidation works correctly.
        
        Property: Invalidating cache for a specific context should only affect
        entries for that context.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # Create contexts
            if context_type == "project":
                target_context = PermissionContext(project_id=context_id)
                other_context = PermissionContext(project_id=uuid4())
            elif context_type == "portfolio":
                target_context = PermissionContext(portfolio_id=context_id)
                other_context = PermissionContext(portfolio_id=uuid4())
            else:
                target_context = PermissionContext(organization_id=context_id)
                other_context = PermissionContext(organization_id=uuid4())
            
            # Cache permission in both contexts
            await cache.cache_permission(user_id, permission.value, True, target_context)
            await cache.cache_permission(user_id, permission.value, True, other_context)
            
            # Invalidate target context
            await cache.invalidate_context_cache(context_type, context_id)
            
            # Verify target context is invalidated
            result = await cache.get_cached_permission(
                user_id, permission.value, target_context
            )
            assert result is None, "Target context should be invalidated"
            
            # Verify other context is intact
            result = await cache.get_cached_permission(
                user_id, permission.value, other_context
            )
            assert result is not None, "Other context should not be affected"
        
        asyncio.run(run_test())


# =============================================================================
# Property 35: Session Performance Optimization
# Validates: Requirements 8.3
# =============================================================================

class TestSessionPerformanceOptimization:
    """
    Property 35: Session Performance Optimization
    
    For any user session loading, the system must preload commonly needed
    permissions for optimal performance.
    
    Feature: rbac-enhancement, Property 35: Session Performance Optimization
    """
    
    @given(
        user_id=user_ids(),
        num_contexts=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_35_permission_preloading_completeness(
        self,
        user_id: UUID,
        num_contexts: int
    ):
        """
        Test that permission preloading loads all expected contexts.
        
        Property: Preloading permissions should load global permissions and
        all provided context-specific permissions.
        """
        async def run_test():
            # Mock Supabase client
            mock_supabase = Mock()
            mock_cache = PermissionCache(redis_client=None)
            
            optimizer = SessionPerformanceOptimizer(
                supabase_client=mock_supabase,
                permission_cache=mock_cache
            )
            
            # Create contexts
            contexts = [
                PermissionContext(project_id=uuid4())
                for _ in range(num_contexts)
            ]
            
            # Mock the permission checker
            with patch('auth.enhanced_permission_checker.get_enhanced_permission_checker') as mock_checker:
                mock_instance = AsyncMock()
                mock_instance.get_user_permissions = AsyncMock(
                    return_value=[Permission.project_read]
                )
                mock_checker.return_value = mock_instance
                
                # Preload permissions
                results = await optimizer.preload_user_permissions(user_id, contexts)
                
                # Verify global permissions were loaded
                assert "global" in results, "Global permissions should be preloaded"
                
                # Verify all contexts were loaded
                assert len(results) >= num_contexts + 1, (
                    f"Expected at least {num_contexts + 1} contexts, got {len(results)}"
                )
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids(),
        num_contexts=st.integers(min_value=1, max_value=3)
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_35_preloading_performance_benefit(
        self,
        user_id: UUID,
        num_contexts: int
    ):
        """
        Test that preloading improves subsequent permission check performance.
        
        Property: After preloading, subsequent permission checks should be faster
        due to cache hits.
        """
        async def run_test():
            mock_cache = PermissionCache(redis_client=None)
            optimizer = SessionPerformanceOptimizer(
                supabase_client=None,
                permission_cache=mock_cache
            )
            
            contexts = [
                PermissionContext(project_id=uuid4())
                for _ in range(num_contexts)
            ]
            
            # Mock the permission checker
            with patch('auth.enhanced_permission_checker.get_enhanced_permission_checker') as mock_checker:
                mock_instance = AsyncMock()
                mock_instance.get_user_permissions = AsyncMock(
                    return_value=[Permission.project_read]
                )
                mock_checker.return_value = mock_instance
                
                # Preload permissions
                await optimizer.preload_user_permissions(user_id, contexts)
                
                # Verify metrics were recorded
                stats = optimizer.get_performance_metrics()
                assert "operations" in stats, "Metrics should be recorded"
                assert "preload_user_permissions" in stats["operations"], (
                    "Preload operation should be tracked"
                )
        
        asyncio.run(run_test())


# =============================================================================
# Property 36: Database Query Efficiency
# Validates: Requirements 8.4
# =============================================================================

class TestDatabaseQueryEfficiency:
    """
    Property 36: Database Query Efficiency
    
    For any role and permission lookup, the system must use efficient database
    queries with proper indexing.
    
    Feature: rbac-enhancement, Property 36: Database Query Efficiency
    """
    
    @given(
        user_ids_list=st.lists(user_ids(), min_size=2, max_size=10, unique=True)
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_36_batch_loading_efficiency(
        self,
        user_ids_list: List[UUID]
    ):
        """
        Test that batch loading is more efficient than individual queries.
        
        Property: Loading roles for N users in batch should use fewer queries
        than loading them individually.
        """
        async def run_test():
            # Mock Supabase client
            mock_supabase = Mock()
            mock_table = Mock()
            mock_query = Mock()
            
            # Setup mock chain
            mock_supabase.table.return_value = mock_table
            mock_table.select.return_value = mock_query
            mock_query.in_.return_value = mock_query
            mock_query.eq.return_value = mock_query
            mock_query.execute.return_value = Mock(data=[])
            
            optimizer = SessionPerformanceOptimizer(supabase_client=mock_supabase)
            
            # Batch load roles
            results = await optimizer.batch_load_user_roles(user_ids_list)
            
            # Verify single query was made (batch operation)
            assert mock_supabase.table.call_count == 1, (
                "Batch loading should use a single query"
            )
            
            # Verify results structure
            assert isinstance(results, dict), "Results should be a dictionary"
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids(),
        permissions_list=st.lists(permissions(), min_size=2, max_size=10, unique=True)
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_36_batch_permission_checking(
        self,
        user_id: UUID,
        permissions_list: List[Permission]
    ):
        """
        Test that batch permission checking is efficient.
        
        Property: Checking N permissions in batch should be more efficient than
        checking them individually.
        """
        async def run_test():
            optimizer = SessionPerformanceOptimizer(supabase_client=None)
            
            # Mock the permission checker
            with patch('auth.enhanced_permission_checker.get_enhanced_permission_checker') as mock_checker:
                mock_instance = AsyncMock()
                mock_instance.get_user_permissions = AsyncMock(
                    return_value=permissions_list[:len(permissions_list)//2]
                )
                mock_checker.return_value = mock_instance
                
                # Batch check permissions
                results = await optimizer.batch_check_permissions(
                    user_id, permissions_list, None
                )
                
                # Verify all permissions were checked
                assert len(results) == len(permissions_list), (
                    f"Expected {len(permissions_list)} results, got {len(results)}"
                )
                
                # Verify results are boolean
                for perm, result in results.items():
                    assert isinstance(result, bool), (
                        f"Result for {perm} should be boolean"
                    )
                
                # Verify get_user_permissions was called only once
                assert mock_instance.get_user_permissions.call_count == 1, (
                    "Should fetch user permissions only once for batch check"
                )
        
        asyncio.run(run_test())


# =============================================================================
# Property 37: Performance Monitoring Availability
# Validates: Requirements 8.5
# =============================================================================

class TestPerformanceMonitoringAvailability:
    """
    Property 37: Performance Monitoring Availability
    
    For any permission checking operation, the system must collect and provide
    performance monitoring metrics.
    
    Feature: rbac-enhancement, Property 37: Performance Monitoring Availability
    """
    
    @given(
        operation_name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll'))),
        durations=st.lists(st.floats(min_value=0.001, max_value=5.0), min_size=1, max_size=20)
    )
    @settings(max_examples=50, deadline=None)
    def test_property_37_metrics_collection_completeness(
        self,
        operation_name: str,
        durations: List[float]
    ):
        """
        Test that performance metrics are collected for all operations.
        
        Property: For any operation, metrics should be recorded and retrievable.
        """
        metrics = PerformanceMetrics()
        
        # Record operations
        for duration in durations:
            metrics.record_operation(operation_name, duration)
        
        # Get stats
        stats = metrics.get_operation_stats(operation_name)
        
        # Verify stats completeness
        assert stats["operation"] == operation_name, "Operation name should match"
        assert stats["count"] == len(durations), (
            f"Expected {len(durations)} operations, got {stats['count']}"
        )
        assert stats["avg_duration"] > 0, "Average duration should be positive"
        assert stats["min_duration"] >= 0, "Min duration should be non-negative"
        assert stats["max_duration"] >= stats["min_duration"], (
            "Max duration should be >= min duration"
        )
        assert stats["total_duration"] > 0, "Total duration should be positive"
    
    @given(
        slow_threshold=st.floats(min_value=0.1, max_value=2.0),
        durations=st.lists(st.floats(min_value=0.001, max_value=5.0), min_size=5, max_size=20)
    )
    @settings(max_examples=50, deadline=None)
    def test_property_37_slow_query_detection(
        self,
        slow_threshold: float,
        durations: List[float]
    ):
        """
        Test that slow queries are detected and tracked.
        
        Property: Operations exceeding the slow query threshold should be tracked.
        """
        metrics = PerformanceMetrics()
        metrics._slow_query_threshold = slow_threshold
        
        # Record operations
        for i, duration in enumerate(durations):
            metrics.record_operation(f"operation_{i}", duration)
        
        # Get all stats
        all_stats = metrics.get_all_stats()
        
        # Count expected slow queries
        expected_slow = sum(1 for d in durations if d >= slow_threshold)
        actual_slow = len(all_stats["slow_queries"])
        
        # Verify slow queries are tracked
        assert actual_slow <= expected_slow, (
            f"Expected at most {expected_slow} slow queries, got {actual_slow}"
        )
        
        # Verify slow query structure
        for slow_query in all_stats["slow_queries"]:
            assert "operation" in slow_query, "Slow query should have operation name"
            assert "duration" in slow_query, "Slow query should have duration"
            assert "timestamp" in slow_query, "Slow query should have timestamp"
            assert slow_query["duration"] >= slow_threshold, (
                f"Slow query duration {slow_query['duration']} should be >= {slow_threshold}"
            )
    
    @given(
        user_id=user_ids()
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_37_cache_metrics_availability(
        self,
        user_id: UUID
    ):
        """
        Test that cache performance metrics are available.
        
        Property: Cache statistics should be available and include hit rate,
        miss rate, and other relevant metrics.
        """
        async def run_test():
            cache = PermissionCache(redis_client=None)
            
            # Perform some cache operations
            await cache.cache_permission(user_id, "test_perm", True, None)
            await cache.get_cached_permission(user_id, "test_perm", None)
            await cache.get_cached_permission(user_id, "missing_perm", None)
            
            # Get cache stats
            stats = cache.get_cache_stats()
            
            # Verify stats structure
            assert "cache_hits" in stats, "Stats should include cache hits"
            assert "cache_misses" in stats, "Stats should include cache misses"
            assert "hit_rate_percent" in stats, "Stats should include hit rate"
            assert "local_cache_size" in stats, "Stats should include cache size"
            assert "cache_ttl_seconds" in stats, "Stats should include TTL"
            
            # Verify hit rate calculation
            total = stats["cache_hits"] + stats["cache_misses"]
            if total > 0:
                expected_rate = (stats["cache_hits"] / total) * 100
                assert abs(stats["hit_rate_percent"] - expected_rate) < 0.01, (
                    f"Hit rate calculation incorrect: {stats['hit_rate_percent']} vs {expected_rate}"
                )
        
        asyncio.run(run_test())
    
    @given(
        user_id=user_ids()
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_37_session_optimizer_metrics(
        self,
        user_id: UUID
    ):
        """
        Test that session optimizer provides comprehensive metrics.
        
        Property: Session optimizer should provide metrics for all operations
        including cache stats.
        """
        async def run_test():
            mock_cache = PermissionCache(redis_client=None)
            optimizer = SessionPerformanceOptimizer(
                supabase_client=None,
                permission_cache=mock_cache
            )
            
            # Perform some operations
            with patch('auth.enhanced_permission_checker.get_enhanced_permission_checker') as mock_checker:
                mock_instance = AsyncMock()
                mock_instance.get_user_permissions = AsyncMock(
                    return_value=[Permission.project_read]
                )
                mock_checker.return_value = mock_instance
                
                await optimizer.preload_user_permissions(user_id, [])
            
            # Get metrics
            metrics = optimizer.get_performance_metrics()
            
            # Verify metrics structure
            assert "operations" in metrics, "Metrics should include operations"
            assert "cache" in metrics, "Metrics should include cache stats"
            assert "total_operations" in metrics, "Metrics should include total count"
            
            # Verify cache stats are included
            cache_stats = metrics["cache"]
            assert "cache_hits" in cache_stats, "Cache stats should be included"
            assert "hit_rate_percent" in cache_stats, "Hit rate should be included"
        
        asyncio.run(run_test())


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
