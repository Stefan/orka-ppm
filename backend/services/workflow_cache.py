"""
Workflow Cache Service

Provides caching functionality for workflow definitions and related data
to improve performance and reduce database queries.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
import hashlib
import json

logger = logging.getLogger(__name__)


class WorkflowCache:
    """
    In-memory cache for workflow definitions and frequently accessed data.
    
    Implements LRU-style caching with TTL (time-to-live) for cache entries.
    Provides cache invalidation mechanisms for data consistency.
    """
    
    def __init__(
        self,
        max_size: int = 1000,
        default_ttl_seconds: int = 3600
    ):
        """
        Initialize workflow cache.
        
        Args:
            max_size: Maximum number of cache entries
            default_ttl_seconds: Default TTL for cache entries in seconds
        """
        self.max_size = max_size
        self.default_ttl_seconds = default_ttl_seconds
        
        # Cache storage: key -> (value, expiry_time, access_count)
        self._cache: Dict[str, tuple[Any, datetime, int]] = {}
        
        # Access tracking for LRU eviction
        self._access_order: List[str] = []
        
        # Cache statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "invalidations": 0
        }
        
        logger.info(
            f"Initialized workflow cache with max_size={max_size}, "
            f"default_ttl={default_ttl_seconds}s"
        )
    
    # ==================== Core Cache Operations ====================
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        if key not in self._cache:
            self._stats["misses"] += 1
            return None
        
        value, expiry_time, access_count = self._cache[key]
        
        # Check if expired
        if datetime.utcnow() > expiry_time:
            self._remove(key)
            self._stats["misses"] += 1
            return None
        
        # Update access tracking
        self._update_access(key, access_count)
        self._stats["hits"] += 1
        
        return value
    
    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: Optional TTL override (uses default if not provided)
        """
        # Check if cache is full and evict if necessary
        if len(self._cache) >= self.max_size and key not in self._cache:
            self._evict_lru()
        
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds
        expiry_time = datetime.utcnow() + timedelta(seconds=ttl)
        
        self._cache[key] = (value, expiry_time, 0)
        self._update_access(key, 0)
    
    def delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key was deleted, False if not found
        """
        if key in self._cache:
            self._remove(key)
            self._stats["invalidations"] += 1
            return True
        return False
    
    def clear(self) -> None:
        """Clear all cache entries."""
        count = len(self._cache)
        self._cache.clear()
        self._access_order.clear()
        self._stats["invalidations"] += count
        logger.info(f"Cleared {count} cache entries")
    
    # ==================== Workflow-Specific Cache Methods ====================
    
    def get_workflow(self, workflow_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get workflow definition from cache.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            Cached workflow data or None
        """
        key = f"workflow:{workflow_id}"
        return self.get(key)
    
    def set_workflow(
        self,
        workflow_id: UUID,
        workflow_data: Dict[str, Any],
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Cache workflow definition.
        
        Args:
            workflow_id: Workflow ID
            workflow_data: Workflow data to cache
            ttl_seconds: Optional TTL override
        """
        key = f"workflow:{workflow_id}"
        self.set(key, workflow_data, ttl_seconds)
    
    def invalidate_workflow(self, workflow_id: UUID) -> bool:
        """
        Invalidate cached workflow definition.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            True if invalidated, False if not cached
        """
        key = f"workflow:{workflow_id}"
        return self.delete(key)
    
    def get_workflow_version(
        self,
        workflow_id: UUID,
        version: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get specific workflow version from cache.
        
        Args:
            workflow_id: Workflow ID
            version: Version number
            
        Returns:
            Cached workflow version data or None
        """
        key = f"workflow:{workflow_id}:v{version}"
        return self.get(key)
    
    def set_workflow_version(
        self,
        workflow_id: UUID,
        version: int,
        workflow_data: Dict[str, Any],
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Cache specific workflow version.
        
        Workflow versions are immutable, so they can be cached longer.
        
        Args:
            workflow_id: Workflow ID
            version: Version number
            workflow_data: Workflow data to cache
            ttl_seconds: Optional TTL override (defaults to 24 hours for versions)
        """
        key = f"workflow:{workflow_id}:v{version}"
        # Use longer TTL for versions since they're immutable
        ttl = ttl_seconds if ttl_seconds is not None else 86400  # 24 hours
        self.set(key, workflow_data, ttl)
    
    def get_workflow_instance(
        self,
        instance_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get workflow instance from cache.
        
        Args:
            instance_id: Instance ID
            
        Returns:
            Cached instance data or None
        """
        key = f"instance:{instance_id}"
        return self.get(key)
    
    def set_workflow_instance(
        self,
        instance_id: UUID,
        instance_data: Dict[str, Any],
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Cache workflow instance.
        
        Args:
            instance_id: Instance ID
            instance_data: Instance data to cache
            ttl_seconds: Optional TTL override (defaults to 5 minutes for instances)
        """
        key = f"instance:{instance_id}"
        # Use shorter TTL for instances since they change frequently
        ttl = ttl_seconds if ttl_seconds is not None else 300  # 5 minutes
        self.set(key, instance_data, ttl)
    
    def invalidate_workflow_instance(self, instance_id: UUID) -> bool:
        """
        Invalidate cached workflow instance.
        
        Args:
            instance_id: Instance ID
            
        Returns:
            True if invalidated, False if not cached
        """
        key = f"instance:{instance_id}"
        return self.delete(key)
    
    def get_pending_approvals(
        self,
        user_id: UUID
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached pending approvals for user.
        
        Args:
            user_id: User ID
            
        Returns:
            Cached pending approvals or None
        """
        key = f"pending_approvals:{user_id}"
        return self.get(key)
    
    def set_pending_approvals(
        self,
        user_id: UUID,
        approvals: List[Dict[str, Any]],
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Cache pending approvals for user.
        
        Args:
            user_id: User ID
            approvals: List of pending approvals
            ttl_seconds: Optional TTL override (defaults to 1 minute)
        """
        key = f"pending_approvals:{user_id}"
        # Use very short TTL for pending approvals since they change frequently
        ttl = ttl_seconds if ttl_seconds is not None else 60  # 1 minute
        self.set(key, approvals, ttl)
    
    def invalidate_pending_approvals(self, user_id: UUID) -> bool:
        """
        Invalidate cached pending approvals for user.
        
        Args:
            user_id: User ID
            
        Returns:
            True if invalidated, False if not cached
        """
        key = f"pending_approvals:{user_id}"
        return self.delete(key)
    
    def invalidate_all_pending_approvals(self) -> int:
        """
        Invalidate all cached pending approvals.
        
        Useful when approval data changes that could affect multiple users.
        
        Returns:
            Number of cache entries invalidated
        """
        count = 0
        keys_to_delete = [
            key for key in self._cache.keys()
            if key.startswith("pending_approvals:")
        ]
        
        for key in keys_to_delete:
            self.delete(key)
            count += 1
        
        return count
    
    # ==================== Query Result Caching ====================
    
    def get_query_result(
        self,
        query_key: str,
        params: Dict[str, Any]
    ) -> Optional[Any]:
        """
        Get cached query result.
        
        Args:
            query_key: Query identifier
            params: Query parameters
            
        Returns:
            Cached query result or None
        """
        cache_key = self._generate_query_cache_key(query_key, params)
        return self.get(cache_key)
    
    def set_query_result(
        self,
        query_key: str,
        params: Dict[str, Any],
        result: Any,
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Cache query result.
        
        Args:
            query_key: Query identifier
            params: Query parameters
            result: Query result to cache
            ttl_seconds: Optional TTL override
        """
        cache_key = self._generate_query_cache_key(query_key, params)
        self.set(cache_key, result, ttl_seconds)
    
    def invalidate_query_pattern(self, pattern: str) -> int:
        """
        Invalidate all cached queries matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "list_workflows:")
            
        Returns:
            Number of cache entries invalidated
        """
        count = 0
        keys_to_delete = [
            key for key in self._cache.keys()
            if pattern in key
        ]
        
        for key in keys_to_delete:
            self.delete(key)
            count += 1
        
        return count
    
    # ==================== Cache Management ====================
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dict containing cache statistics
        """
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (
            self._stats["hits"] / total_requests
            if total_requests > 0
            else 0.0
        )
        
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "hit_rate": hit_rate,
            "evictions": self._stats["evictions"],
            "invalidations": self._stats["invalidations"]
        }
    
    def reset_stats(self) -> None:
        """Reset cache statistics."""
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "invalidations": 0
        }
    
    def cleanup_expired(self) -> int:
        """
        Remove expired entries from cache.
        
        Returns:
            Number of expired entries removed
        """
        now = datetime.utcnow()
        expired_keys = [
            key for key, (_, expiry_time, _) in self._cache.items()
            if now > expiry_time
        ]
        
        for key in expired_keys:
            self._remove(key)
        
        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
        
        return len(expired_keys)
    
    # ==================== Internal Methods ====================
    
    def _update_access(self, key: str, current_count: int) -> None:
        """
        Update access tracking for LRU eviction.
        
        Args:
            key: Cache key
            current_count: Current access count
        """
        # Update access count
        if key in self._cache:
            value, expiry_time, _ = self._cache[key]
            self._cache[key] = (value, expiry_time, current_count + 1)
        
        # Update access order
        if key in self._access_order:
            self._access_order.remove(key)
        self._access_order.append(key)
    
    def _remove(self, key: str) -> None:
        """
        Remove entry from cache.
        
        Args:
            key: Cache key
        """
        if key in self._cache:
            del self._cache[key]
        
        if key in self._access_order:
            self._access_order.remove(key)
    
    def _evict_lru(self) -> None:
        """Evict least recently used entry from cache."""
        if not self._access_order:
            return
        
        # Find LRU entry
        lru_key = self._access_order[0]
        
        # Remove from cache
        self._remove(lru_key)
        self._stats["evictions"] += 1
        
        logger.debug(f"Evicted LRU cache entry: {lru_key}")
    
    def _generate_query_cache_key(
        self,
        query_key: str,
        params: Dict[str, Any]
    ) -> str:
        """
        Generate cache key for query result.
        
        Args:
            query_key: Query identifier
            params: Query parameters
            
        Returns:
            Cache key string
        """
        # Sort params for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True)
        param_hash = hashlib.md5(sorted_params.encode()).hexdigest()[:8]
        
        return f"query:{query_key}:{param_hash}"


# Global cache instance
_workflow_cache: Optional[WorkflowCache] = None


def get_workflow_cache() -> WorkflowCache:
    """
    Get global workflow cache instance.
    
    Returns:
        WorkflowCache instance
    """
    global _workflow_cache
    
    if _workflow_cache is None:
        _workflow_cache = WorkflowCache()
    
    return _workflow_cache


def initialize_workflow_cache(
    max_size: int = 1000,
    default_ttl_seconds: int = 3600
) -> WorkflowCache:
    """
    Initialize global workflow cache with custom settings.
    
    Args:
        max_size: Maximum number of cache entries
        default_ttl_seconds: Default TTL for cache entries
        
    Returns:
        Initialized WorkflowCache instance
    """
    global _workflow_cache
    
    _workflow_cache = WorkflowCache(max_size, default_ttl_seconds)
    return _workflow_cache
