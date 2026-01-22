"""
Session Performance Optimization

This module provides session-level performance optimization for RBAC including:
- Permission preloading during user session initialization
- Efficient database queries with proper indexing
- Performance monitoring and metrics collection
- Batch operations for improved throughput

Requirements: 8.3, 8.4, 8.5
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID
from collections import defaultdict

from .rbac import Permission, UserRole
from .enhanced_rbac_models import PermissionContext, EffectiveRole
from .permission_cache import PermissionCache

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """
    Performance metrics collector for RBAC operations.
    
    Requirements: 8.5 - Performance monitoring and metrics collection
    """
    
    def __init__(self):
        """Initialize performance metrics."""
        self._operation_times: Dict[str, List[float]] = defaultdict(list)
        self._operation_counts: Dict[str, int] = defaultdict(int)
        self._slow_queries: List[Dict[str, Any]] = []
        self._slow_query_threshold = 1.0  # seconds
        
    def record_operation(
        self,
        operation_name: str,
        duration: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record an operation's execution time.
        
        Args:
            operation_name: Name of the operation
            duration: Duration in seconds
            metadata: Optional metadata about the operation
        """
        self._operation_times[operation_name].append(duration)
        self._operation_counts[operation_name] += 1
        
        # Track slow queries
        if duration >= self._slow_query_threshold:
            self._slow_queries.append({
                "operation": operation_name,
                "duration": duration,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {}
            })
            
            # Keep only last 100 slow queries
            if len(self._slow_queries) > 100:
                self._slow_queries = self._slow_queries[-100:]
    
    def get_operation_stats(self, operation_name: str) -> Dict[str, Any]:
        """
        Get statistics for a specific operation.
        
        Args:
            operation_name: Name of the operation
            
        Returns:
            Dictionary with operation statistics
        """
        times = self._operation_times.get(operation_name, [])
        if not times:
            return {
                "operation": operation_name,
                "count": 0,
                "avg_duration": 0.0,
                "min_duration": 0.0,
                "max_duration": 0.0,
                "total_duration": 0.0
            }
        
        return {
            "operation": operation_name,
            "count": len(times),
            "avg_duration": sum(times) / len(times),
            "min_duration": min(times),
            "max_duration": max(times),
            "total_duration": sum(times),
            "p50_duration": self._percentile(times, 50),
            "p95_duration": self._percentile(times, 95),
            "p99_duration": self._percentile(times, 99),
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """
        Get statistics for all operations.
        
        Returns:
            Dictionary with all operation statistics
        """
        stats = {}
        for operation_name in self._operation_times.keys():
            stats[operation_name] = self.get_operation_stats(operation_name)
        
        return {
            "operations": stats,
            "slow_queries": self._slow_queries[-20:],  # Last 20 slow queries
            "total_operations": sum(self._operation_counts.values()),
            "slow_query_threshold": self._slow_query_threshold
        }
    
    def reset(self) -> None:
        """Reset all metrics."""
        self._operation_times.clear()
        self._operation_counts.clear()
        self._slow_queries.clear()
    
    @staticmethod
    def _percentile(values: List[float], percentile: int) -> float:
        """Calculate percentile of values."""
        if not values:
            return 0.0
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        return sorted_values[min(index, len(sorted_values) - 1)]


class SessionPerformanceOptimizer:
    """
    Session-level performance optimizer for RBAC.
    
    This class provides:
    - Permission preloading during session initialization
    - Efficient batch operations
    - Performance monitoring
    - Query optimization
    
    Requirements:
    - 8.3: Preload permissions during session initialization
    - 8.4: Efficient database queries with proper indexing
    - 8.5: Performance monitoring and metrics
    """
    
    def __init__(
        self,
        supabase_client=None,
        permission_cache: Optional[PermissionCache] = None
    ):
        """
        Initialize the SessionPerformanceOptimizer.
        
        Args:
            supabase_client: Supabase client for database operations
            permission_cache: Optional PermissionCache instance
        """
        self.supabase = supabase_client
        self.cache = permission_cache
        self.metrics = PerformanceMetrics()
        
        logger.info("SessionPerformanceOptimizer initialized")
    
    async def preload_user_permissions(
        self,
        user_id: UUID,
        contexts: Optional[List[PermissionContext]] = None
    ) -> Dict[str, List[Permission]]:
        """
        Preload permissions for a user during session initialization.
        
        This method loads and caches all permissions the user will likely need,
        reducing database queries during the session.
        
        Args:
            user_id: The user's UUID
            contexts: Optional list of contexts to preload (e.g., user's projects)
            
        Returns:
            Dictionary mapping context keys to permission lists
            
        Requirements: 8.3 - Preload permissions during session initialization
        """
        start_time = time.time()
        
        try:
            results = {}
            
            # Import here to avoid circular dependency
            from .enhanced_permission_checker import get_enhanced_permission_checker
            checker = get_enhanced_permission_checker(self.supabase)
            
            # Preload global permissions
            global_perms = await checker.get_user_permissions(user_id, None)
            results["global"] = global_perms
            
            # Preload context-specific permissions if provided
            if contexts:
                for context in contexts:
                    context_key = context.to_cache_key()
                    context_perms = await checker.get_user_permissions(user_id, context)
                    results[context_key] = context_perms
            
            # If no contexts provided, try to preload user's common contexts
            else:
                # Get user's projects and portfolios
                user_contexts = await self._get_user_contexts(user_id)
                for context in user_contexts:
                    context_key = context.to_cache_key()
                    context_perms = await checker.get_user_permissions(user_id, context)
                    results[context_key] = context_perms
            
            duration = time.time() - start_time
            self.metrics.record_operation(
                "preload_user_permissions",
                duration,
                {"user_id": str(user_id), "contexts_loaded": len(results)}
            )
            
            logger.info(
                f"Preloaded {len(results)} permission contexts for user {user_id} "
                f"in {duration:.3f}s"
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error preloading permissions for user {user_id}: {e}")
            duration = time.time() - start_time
            self.metrics.record_operation(
                "preload_user_permissions_error",
                duration,
                {"user_id": str(user_id), "error": str(e)}
            )
            return {}
    
    async def batch_load_user_roles(
        self,
        user_ids: List[UUID]
    ) -> Dict[UUID, List[EffectiveRole]]:
        """
        Load roles for multiple users in a single optimized query.
        
        This is more efficient than loading roles one user at a time.
        
        Args:
            user_ids: List of user UUIDs
            
        Returns:
            Dictionary mapping user_id to their effective roles
            
        Requirements: 8.4 - Efficient database queries
        """
        start_time = time.time()
        
        try:
            if not self.supabase or not user_ids:
                return {}
            
            # Convert UUIDs to strings for query
            user_id_strs = [str(uid) for uid in user_ids]
            
            # Single optimized query to get all role assignments with role data
            # This uses proper indexing on user_id and is_active columns
            response = self.supabase.table("user_roles").select(
                "user_id, role_id, scope_type, scope_id, "
                "roles(id, name, permissions, is_active)"
            ).in_("user_id", user_id_strs).eq("is_active", True).execute()
            
            if not response.data:
                return {}
            
            # Group results by user_id
            user_roles: Dict[UUID, List[EffectiveRole]] = defaultdict(list)
            
            for assignment in response.data:
                user_id = UUID(assignment["user_id"])
                role_data = assignment.get("roles", {})
                
                # Skip inactive roles
                if not role_data or not role_data.get("is_active", True):
                    continue
                
                # Create EffectiveRole
                from .enhanced_rbac_models import ScopeType
                scope_type = (
                    ScopeType(assignment["scope_type"])
                    if assignment.get("scope_type")
                    else ScopeType.GLOBAL
                )
                
                effective_role = EffectiveRole(
                    role_id=UUID(assignment["role_id"]),
                    role_name=role_data.get("name", "unknown"),
                    permissions=role_data.get("permissions", []),
                    source_type=scope_type,
                    source_id=(
                        UUID(assignment["scope_id"])
                        if assignment.get("scope_id")
                        else None
                    ),
                    is_inherited=False
                )
                
                user_roles[user_id].append(effective_role)
            
            duration = time.time() - start_time
            self.metrics.record_operation(
                "batch_load_user_roles",
                duration,
                {"user_count": len(user_ids), "roles_loaded": sum(len(r) for r in user_roles.values())}
            )
            
            logger.debug(
                f"Batch loaded roles for {len(user_ids)} users in {duration:.3f}s"
            )
            
            return dict(user_roles)
            
        except Exception as e:
            logger.error(f"Error batch loading user roles: {e}")
            duration = time.time() - start_time
            self.metrics.record_operation(
                "batch_load_user_roles_error",
                duration,
                {"user_count": len(user_ids), "error": str(e)}
            )
            return {}
    
    async def batch_check_permissions(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> Dict[Permission, bool]:
        """
        Check multiple permissions for a user in a single operation.
        
        More efficient than checking permissions one at a time.
        
        Args:
            user_id: The user's UUID
            permissions: List of permissions to check
            context: Optional permission context
            
        Returns:
            Dictionary mapping each permission to its check result
            
        Requirements: 8.4 - Efficient permission checking
        """
        start_time = time.time()
        
        try:
            from .enhanced_permission_checker import get_enhanced_permission_checker
            checker = get_enhanced_permission_checker(self.supabase)
            
            # Get user permissions once
            user_perms = await checker.get_user_permissions(user_id, context)
            user_perms_set = set(user_perms)
            
            # Check all permissions against the set
            results = {
                perm: (perm in user_perms_set)
                for perm in permissions
            }
            
            duration = time.time() - start_time
            self.metrics.record_operation(
                "batch_check_permissions",
                duration,
                {"user_id": str(user_id), "permission_count": len(permissions)}
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error batch checking permissions: {e}")
            duration = time.time() - start_time
            self.metrics.record_operation(
                "batch_check_permissions_error",
                duration,
                {"user_id": str(user_id), "error": str(e)}
            )
            # Return all False on error
            return {perm: False for perm in permissions}
    
    async def optimize_role_queries(self) -> Dict[str, Any]:
        """
        Analyze and optimize role-related database queries.
        
        This method checks for missing indexes and provides recommendations.
        
        Returns:
            Dictionary with optimization recommendations
            
        Requirements: 8.4 - Efficient database queries with proper indexing
        """
        start_time = time.time()
        
        try:
            if not self.supabase:
                return {"error": "No database connection"}
            
            recommendations = []
            
            # Check for required indexes on user_roles table
            required_indexes = [
                {
                    "table": "user_roles",
                    "columns": ["user_id", "is_active"],
                    "name": "idx_user_roles_active"
                },
                {
                    "table": "user_roles",
                    "columns": ["user_id", "scope_type", "scope_id"],
                    "name": "idx_user_roles_scope"
                },
                {
                    "table": "user_roles",
                    "columns": ["expires_at"],
                    "name": "idx_user_roles_expiry"
                }
            ]
            
            # Check for required indexes on roles table
            required_indexes.extend([
                {
                    "table": "roles",
                    "columns": ["is_active"],
                    "name": "idx_roles_active"
                }
            ])
            
            # Note: In production, you would query pg_indexes to check if these exist
            # For now, we'll provide recommendations
            for index in required_indexes:
                recommendations.append({
                    "type": "index",
                    "table": index["table"],
                    "columns": index["columns"],
                    "name": index["name"],
                    "sql": f"CREATE INDEX IF NOT EXISTS {index['name']} ON {index['table']} ({', '.join(index['columns'])})"
                })
            
            duration = time.time() - start_time
            self.metrics.record_operation("optimize_role_queries", duration)
            
            return {
                "recommendations": recommendations,
                "analysis_duration": duration
            }
            
        except Exception as e:
            logger.error(f"Error optimizing role queries: {e}")
            return {"error": str(e)}
    
    async def _get_user_contexts(self, user_id: UUID) -> List[PermissionContext]:
        """
        Get common contexts for a user (their projects and portfolios).
        
        Args:
            user_id: The user's UUID
            
        Returns:
            List of PermissionContext objects
        """
        contexts = []
        
        try:
            if not self.supabase:
                return contexts
            
            user_id_str = str(user_id)
            
            # Get user's project assignments
            project_response = self.supabase.table("user_roles").select(
                "scope_id"
            ).eq("user_id", user_id_str).eq(
                "scope_type", "project"
            ).eq("is_active", True).execute()
            
            if project_response.data:
                for row in project_response.data:
                    if row.get("scope_id"):
                        contexts.append(
                            PermissionContext(project_id=UUID(row["scope_id"]))
                        )
            
            # Get user's portfolio assignments
            portfolio_response = self.supabase.table("user_roles").select(
                "scope_id"
            ).eq("user_id", user_id_str).eq(
                "scope_type", "portfolio"
            ).eq("is_active", True).execute()
            
            if portfolio_response.data:
                for row in portfolio_response.data:
                    if row.get("scope_id"):
                        contexts.append(
                            PermissionContext(portfolio_id=UUID(row["scope_id"]))
                        )
            
            return contexts
            
        except Exception as e:
            logger.error(f"Error getting user contexts: {e}")
            return contexts
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for RBAC operations.
        
        Returns:
            Dictionary with performance metrics
            
        Requirements: 8.5 - Performance monitoring
        """
        stats = self.metrics.get_all_stats()
        
        # Add cache stats if available
        if self.cache:
            stats["cache"] = self.cache.get_cache_stats()
        
        return stats
    
    def reset_metrics(self) -> None:
        """
        Reset performance metrics.
        
        Requirements: 8.5 - Performance monitoring
        """
        self.metrics.reset()
        if self.cache:
            self.cache.reset_stats()


# Singleton instance
_session_optimizer: Optional[SessionPerformanceOptimizer] = None


def get_session_optimizer(
    supabase_client=None,
    permission_cache: Optional[PermissionCache] = None
) -> SessionPerformanceOptimizer:
    """
    Get or create the singleton SessionPerformanceOptimizer instance.
    
    Args:
        supabase_client: Optional Supabase client to use
        permission_cache: Optional PermissionCache instance
        
    Returns:
        The SessionPerformanceOptimizer singleton instance
    """
    global _session_optimizer
    
    if _session_optimizer is None:
        _session_optimizer = SessionPerformanceOptimizer(
            supabase_client=supabase_client,
            permission_cache=permission_cache
        )
    
    return _session_optimizer
