"""
Response Cache Service for RAG Knowledge Base
Caches generated responses to improve performance and reduce API costs
"""

import logging
import hashlib
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import asyncio
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    response: Dict[str, Any]
    created_at: datetime
    ttl_seconds: int
    access_count: int = 0
    last_accessed: Optional[datetime] = None

    @property
    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        return datetime.now() > (self.created_at + timedelta(seconds=self.ttl_seconds))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "key": self.key,
            "response": self.response,
            "created_at": self.created_at.isoformat(),
            "ttl_seconds": self.ttl_seconds,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CacheEntry':
        """Create from dictionary"""
        return cls(
            key=data["key"],
            response=data["response"],
            created_at=datetime.fromisoformat(data["created_at"]),
            ttl_seconds=data["ttl_seconds"],
            access_count=data.get("access_count", 0),
            last_accessed=datetime.fromisoformat(data["last_accessed"]) if data.get("last_accessed") else None
        )


class ResponseCacheError(Exception):
    """Base exception for response cache errors"""
    pass


class ResponseCache:
    """
    In-memory cache for RAG responses with Redis-like interface.

    Features:
    - TTL-based expiration
    - Cache key generation based on query + context
    - Access statistics
    - Memory management with LRU eviction
    - Cache warming for frequently asked questions
    """

    def __init__(
        self,
        max_size: int = 1000,
        default_ttl_seconds: int = 3600,  # 1 hour
        cleanup_interval_seconds: int = 300  # 5 minutes
    ):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl_seconds = default_ttl_seconds
        self.cleanup_interval_seconds = cleanup_interval_seconds
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the cache cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    async def stop(self):
        """Stop the cache cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

    def generate_key(self, query: str, user_context: Dict[str, Any], language: str = "en") -> str:
        """
        Generate a cache key from query and context.

        Args:
            query: User query
            user_context: User context (role, page, etc.)
            language: Query language

        Returns:
            Cache key string
        """
        # Create a deterministic key from query and relevant context
        key_data = {
            "query": query.strip().lower(),
            "language": language,
            "user_role": user_context.get("role", "user"),
            "current_page": user_context.get("current_page", ""),
            "current_project": user_context.get("current_project"),
            "current_portfolio": user_context.get("current_portfolio")
        }

        # Remove None values and sort for consistency
        filtered_data = {k: v for k, v in key_data.items() if v is not None}
        key_string = json.dumps(filtered_data, sort_keys=True)

        # Generate hash
        return hashlib.sha256(key_string.encode()).hexdigest()[:16]

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a cached response.

        Args:
            key: Cache key

        Returns:
            Cached response or None if not found/expired
        """
        entry = self.cache.get(key)
        if entry is None:
            return None

        if entry.is_expired:
            await self.delete(key)
            return None

        # Update access statistics
        entry.access_count += 1
        entry.last_accessed = datetime.now()

        logger.debug(f"Cache hit for key: {key}")
        return entry.response

    async def set(
        self,
        key: str,
        response: Dict[str, Any],
        ttl_seconds: Optional[int] = None
    ) -> None:
        """
        Store a response in cache.

        Args:
            key: Cache key
            response: Response to cache
            ttl_seconds: Time to live in seconds (uses default if None)
        """
        ttl = ttl_seconds or self.default_ttl_seconds

        entry = CacheEntry(
            key=key,
            response=response,
            created_at=datetime.now(),
            ttl_seconds=ttl
        )

        # Check if we need to evict entries
        if len(self.cache) >= self.max_size and key not in self.cache:
            await self._evict_lru()

        self.cache[key] = entry
        logger.debug(f"Cached response for key: {key}, TTL: {ttl}s")

    async def delete(self, key: str) -> bool:
        """
        Delete a cached response.

        Args:
            key: Cache key

        Returns:
            True if deleted, False if not found
        """
        if key in self.cache:
            del self.cache[key]
            logger.debug(f"Deleted cache entry: {key}")
            return True
        return False

    async def clear(self) -> None:
        """Clear all cached responses"""
        self.cache.clear()
        logger.info("Cleared all cache entries")

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """
        Invalidate cache entries matching a pattern.

        Args:
            pattern: Pattern to match (currently supports prefix matching)

        Returns:
            Number of entries invalidated
        """
        keys_to_delete = []
        for key in self.cache.keys():
            if key.startswith(pattern):
                keys_to_delete.append(key)

        for key in keys_to_delete:
            await self.delete(key)

        logger.info(f"Invalidated {len(keys_to_delete)} cache entries matching pattern: {pattern}")
        return len(keys_to_delete)

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_entries = len(self.cache)
        expired_entries = sum(1 for entry in self.cache.values() if entry.is_expired)

        if total_entries > 0:
            total_accesses = sum(entry.access_count for entry in self.cache.values())
            avg_accesses = total_accesses / total_entries
        else:
            avg_accesses = 0

        return {
            "total_entries": total_entries,
            "expired_entries": expired_entries,
            "active_entries": total_entries - expired_entries,
            "max_size": self.max_size,
            "utilization_percent": (total_entries / self.max_size) * 100,
            "average_accesses": avg_accesses,
            "hit_rate_estimate": min(avg_accesses, 1.0)  # Rough estimate
        }

    async def warm_cache(self, faq_queries: List[Dict[str, Any]]) -> int:
        """
        Warm the cache with frequently asked questions.

        Args:
            faq_queries: List of FAQ entries with query and response

        Returns:
            Number of entries warmed
        """
        warmed_count = 0
        for faq in faq_queries:
            try:
                query = faq["query"]
                response = faq["response"]
                user_context = faq.get("user_context", {})
                language = faq.get("language", "en")

                key = self.generate_key(query, user_context, language)
                await self.set(key, response, ttl_seconds=86400)  # 24 hours for FAQ
                warmed_count += 1

            except KeyError:
                logger.warning(f"Invalid FAQ entry: {faq}")
                continue

        logger.info(f"Warmed cache with {warmed_count} FAQ entries")
        return warmed_count

    async def _periodic_cleanup(self):
        """Periodically clean up expired entries"""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval_seconds)
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error during cache cleanup: {str(e)}")

    async def _cleanup_expired(self):
        """Remove expired cache entries"""
        expired_keys = [
            key for key, entry in self.cache.items()
            if entry.is_expired
        ]

        for key in expired_keys:
            await self.delete(key)

        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")

    async def _evict_lru(self):
        """Evict least recently used entries when cache is full"""
        if not self.cache:
            return

        # Find entries with oldest last_accessed (or created_at if never accessed)
        entries = list(self.cache.items())
        entries.sort(key=lambda x: x[1].last_accessed or x[1].created_at)

        # Remove oldest 10% or at least 1 entry
        to_evict = max(1, int(len(entries) * 0.1))
        for i in range(to_evict):
            key, _ = entries[i]
            await self.delete(key)

        logger.debug(f"Evicted {to_evict} LRU cache entries")