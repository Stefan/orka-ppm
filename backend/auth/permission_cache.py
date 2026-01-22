"""
Permission Caching System

This module provides a comprehensive caching system for RBAC permissions with:
- Redis-based distributed caching for multi-instance deployments
- Local in-memory caching as fallback
- Cache invalidation on role changes and permission updates
- Batch permission loading for multiple users
- Performance monitoring and metrics

Requirements: 8.1, 8.2
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from .rbac import Permission
from .enhanced_rbac_models import PermissionContext

logger = logging.getLogger(__name__)


class PermissionCache:
    """
    Permission caching system with Redis and local caching support.
    
    This class provides:
    - Two-tier caching (Redis + local memory)
    - Automatic cache invalidation on role changes
    - Batch permission loading
    - Performance metrics collection
    
    Requirements:
    - 8.1: Cache permission results to minimize database queries
    - 8.2: Invalidate cache entries on role changes
    """
    
    def __init__(
        self,
        redis_client: Optional[Any] = None,
        cache_ttl: int = 3600,
        local_cache_size: int = 10000
    ):
        """
        Initialize the PermissionCache.
        
        Args:
            redis_client: Optional Redis client for distributed caching
            cache_ttl: Cache time-to-live in seconds (default: 1 hour)
            local_cache_size: Maximum size of local cache (default: 10000 entries)
        """
        self.redis = redis_client
        self.cache_ttl = cache_ttl
        self.local_cache_size = local_cache_size
        
        # Local in-memory cache
        self._local_cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, float] = {}
        
        # Performance metrics
        self._cache_hits = 0
        self._cache_misses = 0
        self._redis_hits = 0
        self._local_hits = 0
        self._invalidations = 0
        
        logger.info(
            f"PermissionCache initialized with TTL={cache_ttl}s, "
            f"Redis={'enabled' if redis_client else 'disabled'}"
        )
    
    async def get_cached_permission(
        self,
        user_id: UUID,
        permission: str,
        context: Optional[PermissionContext] = None
    ) -> Optional[bool]:
        """
        Get a cached permission result.
        
        Checks Redis first (if available), then falls back to local cache.
        
        Args:
            user_id: The user's UUID
            permission: The permission string to check
            context: Optional permission context
            
        Returns:
            Cached permission result (True/False) or None if not cached
            
        Requirements: 8.1 - Cache permission results
        """
        cache_key = self._build_cache_key(user_id, permission, context)
        
        # Try Redis first
        if self.redis:
            try:
                cached = await self._get_from_redis(cache_key)
                if cached is not None:
                    self._cache_hits += 1
                    self._redis_hits += 1
                    return cached
            except Exception as e:
                logger.warning(f"Redis cache read error: {e}")
        
        # Fallback to local cache
        cached = self._get_from_local_cache(cache_key)
        if cached is not None:
            self._cache_hits += 1
            self._local_hits += 1
            return cached
        
        self._cache_misses += 1
        return None
    
    async def cache_permission(
        self,
        user_id: UUID,
        permission: str,
        result: bool,
        context: Optional[PermissionContext] = None
    ) -> None:
        """
        Cache a permission result.
        
        Stores in both Redis (if available) and local cache.
        
        Args:
            user_id: The user's UUID
            permission: The permission string
            result: The permission check result (True/False)
            context: Optional permission context
            
        Requirements: 8.1 - Cache permission results
        """
        cache_key = self._build_cache_key(user_id, permission, context)
        
        # Cache in Redis
        if self.redis:
            try:
                await self._set_in_redis(cache_key, result)
            except Exception as e:
                logger.warning(f"Redis cache write error: {e}")
        
        # Cache locally
        self._set_in_local_cache(cache_key, result)
    
    async def get_cached_permissions(
        self,
        user_id: UUID,
        context: Optional[PermissionContext] = None
    ) -> Optional[List[Permission]]:
        """
        Get cached list of all permissions for a user.
        
        Args:
            user_id: The user's UUID
            context: Optional permission context
            
        Returns:
            Cached list of Permission enums or None if not cached
            
        Requirements: 8.1 - Cache permission results
        """
        cache_key = self._build_permissions_cache_key(user_id, context)
        
        # Try Redis first
        if self.redis:
            try:
                cached = await self._get_from_redis(cache_key)
                if cached is not None:
                    self._cache_hits += 1
                    self._redis_hits += 1
                    # Convert permission strings back to Permission enums
                    return [Permission(p) for p in cached]
            except Exception as e:
                logger.warning(f"Redis cache read error: {e}")
        
        # Fallback to local cache
        cached = self._get_from_local_cache(cache_key)
        if cached is not None:
            self._cache_hits += 1
            self._local_hits += 1
            return cached
        
        self._cache_misses += 1
        return None
    
    async def cache_permissions(
        self,
        user_id: UUID,
        permissions: List[Permission],
        context: Optional[PermissionContext] = None
    ) -> None:
        """
        Cache a list of all permissions for a user.
        
        Args:
            user_id: The user's UUID
            permissions: List of Permission enums
            context: Optional permission context
            
        Requirements: 8.1 - Cache permission results
        """
        cache_key = self._build_permissions_cache_key(user_id, context)
        
        # Cache in Redis (convert enums to strings for JSON serialization)
        if self.redis:
            try:
                perm_strings = [p.value for p in permissions]
                await self._set_in_redis(cache_key, perm_strings)
            except Exception as e:
                logger.warning(f"Redis cache write error: {e}")
        
        # Cache locally (keep as Permission enums)
        self._set_in_local_cache(cache_key, permissions)
    
    async def invalidate_user_cache(self, user_id: UUID) -> int:
        """
        Invalidate all cached permissions for a user.
        
        Should be called when user's roles change.
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Number of cache entries invalidated
            
        Requirements: 8.2 - Invalidate cache on role changes
        """
        user_id_str = str(user_id)
        count = 0
        
        # Invalidate in Redis
        if self.redis:
            try:
                # Find all keys for this user
                pattern = f"perm:{user_id_str}:*"
                count += await self._delete_redis_pattern(pattern)
            except Exception as e:
                logger.warning(f"Redis cache invalidation error: {e}")
        
        # Invalidate in local cache
        keys_to_remove = [
            key for key in self._local_cache.keys()
            if user_id_str in key
        ]
        for key in keys_to_remove:
            del self._local_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
            count += 1
        
        self._invalidations += count
        logger.info(f"Invalidated {count} cache entries for user {user_id}")
        return count
    
    async def invalidate_role_cache(self, role_id: UUID) -> int:
        """
        Invalidate cached permissions for all users with a specific role.
        
        Should be called when role permissions change.
        
        Args:
            role_id: The role's UUID
            
        Returns:
            Number of cache entries invalidated
            
        Requirements: 8.2 - Invalidate cache on permission updates
        """
        # This requires knowing which users have this role
        # For now, we'll clear all caches as a safe fallback
        # In production, maintain a role->users mapping for targeted invalidation
        logger.warning(
            f"Role {role_id} permissions changed - clearing all permission caches"
        )
        return await self.clear_all_cache()
    
    async def invalidate_context_cache(
        self,
        context_type: str,
        context_id: UUID
    ) -> int:
        """
        Invalidate cached permissions for a specific context.
        
        Should be called when project/portfolio assignments change.
        
        Args:
            context_type: Type of context ("project", "portfolio", "organization")
            context_id: The context's UUID
            
        Returns:
            Number of cache entries invalidated
            
        Requirements: 8.2 - Invalidate cache on assignment changes
        """
        count = 0
        context_id_str = str(context_id)
        
        # Map context type to cache key prefix
        # Cache keys use format: proj:<uuid>, port:<uuid>, org:<uuid>
        prefix_map = {
            "project": "proj",
            "portfolio": "port",
            "organization": "org"
        }
        prefix = prefix_map.get(context_type, context_type)
        context_key_pattern = f"{prefix}:{context_id_str}"
        
        # Invalidate in Redis
        if self.redis:
            try:
                pattern = f"perm:*:*{context_key_pattern}*"
                count += await self._delete_redis_pattern(pattern)
            except Exception as e:
                logger.warning(f"Redis cache invalidation error: {e}")
        
        # Invalidate in local cache
        keys_to_remove = [
            key for key in self._local_cache.keys()
            if context_key_pattern in key
        ]
        for key in keys_to_remove:
            del self._local_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
            count += 1
        
        self._invalidations += count
        logger.info(
            f"Invalidated {count} cache entries for {context_type} {context_id}"
        )
        return count
    
    async def clear_all_cache(self) -> int:
        """
        Clear all cached permissions.
        
        Returns:
            Number of cache entries cleared
            
        Requirements: 8.2 - Cache invalidation
        """
        count = 0
        
        # Clear Redis
        if self.redis:
            try:
                pattern = "perm:*"
                count += await self._delete_redis_pattern(pattern)
            except Exception as e:
                logger.warning(f"Redis cache clear error: {e}")
        
        # Clear local cache
        count += len(self._local_cache)
        self._local_cache.clear()
        self._cache_timestamps.clear()
        
        self._invalidations += count
        logger.info(f"Cleared all permission caches ({count} entries)")
        return count
    
    async def batch_load_permissions(
        self,
        user_ids: List[UUID],
        context: Optional[PermissionContext] = None
    ) -> Dict[UUID, Optional[List[Permission]]]:
        """
        Load permissions for multiple users in batch.
        
        This is more efficient than loading permissions one user at a time.
        Returns cached results where available.
        
        Args:
            user_ids: List of user UUIDs
            context: Optional permission context
            
        Returns:
            Dictionary mapping user_id to their permissions (or None if not cached)
            
        Requirements: 8.1 - Batch permission loading
        """
        results: Dict[UUID, Optional[List[Permission]]] = {}
        
        for user_id in user_ids:
            cached = await self.get_cached_permissions(user_id, context)
            results[user_id] = cached
        
        return results
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache performance statistics.
        
        Returns:
            Dictionary with cache metrics
            
        Requirements: 8.5 - Performance monitoring
        """
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = (
            (self._cache_hits / total_requests * 100)
            if total_requests > 0
            else 0.0
        )
        
        return {
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "redis_hits": self._redis_hits,
            "local_hits": self._local_hits,
            "hit_rate_percent": round(hit_rate, 2),
            "invalidations": self._invalidations,
            "local_cache_size": len(self._local_cache),
            "cache_ttl_seconds": self.cache_ttl,
            "redis_enabled": self.redis is not None,
        }
    
    def reset_stats(self) -> None:
        """Reset cache performance statistics."""
        self._cache_hits = 0
        self._cache_misses = 0
        self._redis_hits = 0
        self._local_hits = 0
        self._invalidations = 0
    
    # =========================================================================
    # Private Helper Methods
    # =========================================================================
    
    def _build_cache_key(
        self,
        user_id: UUID,
        permission: str,
        context: Optional[PermissionContext]
    ) -> str:
        """Build a cache key for a specific permission check."""
        context_key = context.to_cache_key() if context else "global"
        return f"perm:{user_id}:{permission}:{context_key}"
    
    def _build_permissions_cache_key(
        self,
        user_id: UUID,
        context: Optional[PermissionContext]
    ) -> str:
        """Build a cache key for all user permissions."""
        context_key = context.to_cache_key() if context else "global"
        return f"perms:{user_id}:{context_key}"
    
    def _get_from_local_cache(self, cache_key: str) -> Optional[Any]:
        """Get a value from local cache if valid."""
        if cache_key not in self._local_cache:
            return None
        
        # Check if expired
        timestamp = self._cache_timestamps.get(cache_key, 0)
        if (datetime.now().timestamp() - timestamp) >= self.cache_ttl:
            # Cache expired
            del self._local_cache[cache_key]
            if cache_key in self._cache_timestamps:
                del self._cache_timestamps[cache_key]
            return None
        
        # Enforce cache size limit (LRU-style eviction)
        if len(self._local_cache) > self.local_cache_size:
            self._evict_oldest_entries()
        
        return self._local_cache[cache_key]
    
    def _set_in_local_cache(self, cache_key: str, value: Any) -> None:
        """Set a value in local cache."""
        self._local_cache[cache_key] = value
        self._cache_timestamps[cache_key] = datetime.now().timestamp()
        
        # Enforce cache size limit
        if len(self._local_cache) > self.local_cache_size:
            self._evict_oldest_entries()
    
    def _evict_oldest_entries(self) -> None:
        """Evict oldest entries from local cache to maintain size limit."""
        if len(self._local_cache) <= self.local_cache_size:
            return
        
        # Sort by timestamp and remove oldest 10%
        sorted_keys = sorted(
            self._cache_timestamps.items(),
            key=lambda x: x[1]
        )
        
        num_to_remove = len(self._local_cache) // 10
        for key, _ in sorted_keys[:num_to_remove]:
            if key in self._local_cache:
                del self._local_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
    
    async def _get_from_redis(self, cache_key: str) -> Optional[Any]:
        """Get a value from Redis cache."""
        if not self.redis:
            return None
        
        try:
            cached = await self.redis.get(cache_key)
            if cached is not None:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Redis get error for key {cache_key}: {e}")
            return None
    
    async def _set_in_redis(self, cache_key: str, value: Any) -> None:
        """Set a value in Redis cache."""
        if not self.redis:
            return
        
        try:
            await self.redis.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(value)
            )
        except Exception as e:
            logger.warning(f"Redis set error for key {cache_key}: {e}")
    
    async def _delete_redis_pattern(self, pattern: str) -> int:
        """Delete all Redis keys matching a pattern."""
        if not self.redis:
            return 0
        
        try:
            # Scan for keys matching pattern
            keys = []
            cursor = 0
            while True:
                cursor, partial_keys = await self.redis.scan(
                    cursor,
                    match=pattern,
                    count=100
                )
                keys.extend(partial_keys)
                if cursor == 0:
                    break
            
            # Delete keys
            if keys:
                await self.redis.delete(*keys)
                return len(keys)
            return 0
        except Exception as e:
            logger.warning(f"Redis pattern delete error for {pattern}: {e}")
            return 0


# Singleton instance
_permission_cache: Optional[PermissionCache] = None


def get_permission_cache(redis_client: Optional[Any] = None) -> PermissionCache:
    """
    Get or create the singleton PermissionCache instance.
    
    Args:
        redis_client: Optional Redis client to use
        
    Returns:
        The PermissionCache singleton instance
    """
    global _permission_cache
    
    if _permission_cache is None:
        _permission_cache = PermissionCache(redis_client=redis_client)
    
    return _permission_cache
