"""
Redis Cache Service for Enhanced PMR
Provides caching strategies for frequently accessed reports and data
"""

import os
import json
import logging
from typing import Any, Optional, Dict, List
from datetime import datetime, timedelta
from decimal import Decimal
import redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class RedisCacheService:
    """
    Redis-based caching service for Enhanced PMR
    Provides high-performance caching with TTL and invalidation strategies
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """Initialize Redis cache service"""
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.client: Optional[redis.Redis] = None
        self.enabled = True
        
        try:
            self.client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self.client.ping()
            logger.info("Redis cache service initialized successfully")
        except (RedisError, Exception) as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            self.enabled = False
            self.client = None
    
    # ========================================================================
    # Core Cache Operations
    # ========================================================================
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        if not self.enabled or not self.client:
            return None
        
        try:
            value = self.client.get(key)
            if value:
                logger.debug(f"Cache HIT: {key}")
                return json.loads(value)
            logger.debug(f"Cache MISS: {key}")
            return None
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = 300
    ) -> bool:
        """
        Set value in cache with TTL
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default: 5 minutes)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.client:
            return False
        
        try:
            serialized = json.dumps(value, cls=DecimalEncoder)
            self.client.setex(key, ttl, serialized)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            return True
        except (RedisError, TypeError) as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete value from cache
        
        Args:
            key: Cache key
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.client:
            return False
        
        try:
            self.client.delete(key)
            logger.debug(f"Cache DELETE: {key}")
            return True
        except RedisError as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching pattern
        
        Args:
            pattern: Redis key pattern (e.g., "pmr:report:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.client:
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"Cache INVALIDATE: {pattern} ({deleted} keys)")
                return deleted
            return 0
        except RedisError as e:
            logger.error(f"Cache invalidate error for pattern {pattern}: {e}")
            return 0
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.enabled or not self.client:
            return False
        
        try:
            return bool(self.client.exists(key))
        except RedisError:
            return False
    
    def get_ttl(self, key: str) -> int:
        """Get remaining TTL for key in seconds"""
        if not self.enabled or not self.client:
            return -1
        
        try:
            return self.client.ttl(key)
        except RedisError:
            return -1
    
    # ========================================================================
    # PMR-Specific Cache Operations
    # ========================================================================
    
    def cache_report(
        self,
        report_id: str,
        report_data: Dict[str, Any],
        ttl: int = 300
    ) -> bool:
        """
        Cache a complete PMR report
        
        Args:
            report_id: Report UUID
            report_data: Report data dictionary
            ttl: Time to live in seconds (default: 5 minutes)
        """
        key = f"pmr:report:{report_id}"
        return self.set(key, report_data, ttl)
    
    def get_cached_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get cached PMR report"""
        key = f"pmr:report:{report_id}"
        return self.get(key)
    
    def invalidate_report(self, report_id: str) -> bool:
        """Invalidate cached report and related data"""
        keys_to_delete = [
            f"pmr:report:{report_id}",
            f"pmr:insights:{report_id}",
            f"pmr:monte_carlo:{report_id}",
            f"pmr:sections:{report_id}:*"
        ]
        
        deleted = 0
        for key in keys_to_delete:
            if '*' in key:
                deleted += self.invalidate_pattern(key)
            else:
                if self.delete(key):
                    deleted += 1
        
        logger.info(f"Invalidated {deleted} cache entries for report {report_id}")
        return deleted > 0
    
    def cache_insights(
        self,
        report_id: str,
        insights: List[Dict[str, Any]],
        ttl: int = 600
    ) -> bool:
        """
        Cache AI insights for a report
        
        Args:
            report_id: Report UUID
            insights: List of insight dictionaries
            ttl: Time to live in seconds (default: 10 minutes)
        """
        key = f"pmr:insights:{report_id}"
        return self.set(key, insights, ttl)
    
    def get_cached_insights(self, report_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached AI insights"""
        key = f"pmr:insights:{report_id}"
        return self.get(key)
    
    def cache_monte_carlo_results(
        self,
        report_id: str,
        results: Dict[str, Any],
        ttl: int = 1800
    ) -> bool:
        """
        Cache Monte Carlo analysis results
        
        Args:
            report_id: Report UUID
            results: Monte Carlo results dictionary
            ttl: Time to live in seconds (default: 30 minutes)
        """
        key = f"pmr:monte_carlo:{report_id}"
        return self.set(key, results, ttl)
    
    def get_cached_monte_carlo(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get cached Monte Carlo results"""
        key = f"pmr:monte_carlo:{report_id}"
        return self.get(key)
    
    def cache_section(
        self,
        report_id: str,
        section_id: str,
        section_data: Dict[str, Any],
        ttl: int = 180
    ) -> bool:
        """
        Cache individual report section
        
        Args:
            report_id: Report UUID
            section_id: Section identifier
            section_data: Section data dictionary
            ttl: Time to live in seconds (default: 3 minutes)
        """
        key = f"pmr:sections:{report_id}:{section_id}"
        return self.set(key, section_data, ttl)
    
    def get_cached_section(
        self,
        report_id: str,
        section_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached report section"""
        key = f"pmr:sections:{report_id}:{section_id}"
        return self.get(key)
    
    def cache_project_data(
        self,
        project_id: str,
        data: Dict[str, Any],
        ttl: int = 600
    ) -> bool:
        """
        Cache project data for report generation
        
        Args:
            project_id: Project UUID
            data: Project data dictionary
            ttl: Time to live in seconds (default: 10 minutes)
        """
        key = f"pmr:project_data:{project_id}"
        return self.set(key, data, ttl)
    
    def get_cached_project_data(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get cached project data"""
        key = f"pmr:project_data:{project_id}"
        return self.get(key)
    
    # ========================================================================
    # Cache Statistics and Monitoring
    # ========================================================================
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.enabled or not self.client:
            return {
                "enabled": False,
                "status": "disabled"
            }
        
        try:
            info = self.client.info('stats')
            memory_info = self.client.info('memory')
            
            return {
                "enabled": True,
                "status": "connected",
                "total_keys": self.client.dbsize(),
                "hits": info.get('keyspace_hits', 0),
                "misses": info.get('keyspace_misses', 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get('keyspace_hits', 0),
                    info.get('keyspace_misses', 0)
                ),
                "memory_used": memory_info.get('used_memory_human', 'N/A'),
                "memory_peak": memory_info.get('used_memory_peak_human', 'N/A'),
                "connected_clients": info.get('connected_clients', 0)
            }
        except RedisError as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {
                "enabled": True,
                "status": "error",
                "error": str(e)
            }
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    def get_pmr_cache_keys(self) -> Dict[str, int]:
        """Get count of PMR-related cache keys by type"""
        if not self.enabled or not self.client:
            return {}
        
        try:
            patterns = {
                "reports": "pmr:report:*",
                "insights": "pmr:insights:*",
                "monte_carlo": "pmr:monte_carlo:*",
                "sections": "pmr:sections:*",
                "project_data": "pmr:project_data:*"
            }
            
            counts = {}
            for name, pattern in patterns.items():
                keys = self.client.keys(pattern)
                counts[name] = len(keys)
            
            return counts
        except RedisError as e:
            logger.error(f"Failed to get PMR cache keys: {e}")
            return {}
    
    def clear_all_pmr_cache(self) -> int:
        """Clear all PMR-related cache entries"""
        return self.invalidate_pattern("pmr:*")
    
    # ========================================================================
    # Audit-Specific Cache Operations (Task 18.1)
    # ========================================================================
    
    def cache_search_results(
        self,
        query_hash: str,
        results: Dict[str, Any],
        ttl: int = 600
    ) -> bool:
        """
        Cache semantic search results for audit logs
        
        Args:
            query_hash: Hash of the search query and filters
            results: Search results dictionary
            ttl: Time to live in seconds (default: 10 minutes)
            
        Requirements: 7.10
        """
        key = f"audit:search:{query_hash}"
        return self.set(key, results, ttl)
    
    def get_cached_search_results(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached search results"""
        key = f"audit:search:{query_hash}"
        return self.get(key)
    
    def cache_classification_result(
        self,
        event_id: str,
        classification: Dict[str, Any],
        ttl: int = 3600
    ) -> bool:
        """
        Cache ML classification result for audit event
        
        Args:
            event_id: Audit event UUID
            classification: Classification result dictionary
            ttl: Time to live in seconds (default: 1 hour)
            
        Requirements: 7.10
        """
        key = f"audit:classification:{event_id}"
        return self.set(key, classification, ttl)
    
    def get_cached_classification(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get cached classification result"""
        key = f"audit:classification:{event_id}"
        return self.get(key)
    
    def cache_dashboard_stats(
        self,
        tenant_id: str,
        stats: Dict[str, Any],
        ttl: int = 30
    ) -> bool:
        """
        Cache dashboard statistics
        
        Args:
            tenant_id: Tenant UUID
            stats: Dashboard statistics dictionary
            ttl: Time to live in seconds (default: 30 seconds)
            
        Requirements: 7.10
        """
        key = f"audit:dashboard:{tenant_id}"
        return self.set(key, stats, ttl)
    
    def get_cached_dashboard_stats(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get cached dashboard statistics"""
        key = f"audit:dashboard:{tenant_id}"
        return self.get(key)
    
    def invalidate_audit_cache(self, tenant_id: str) -> int:
        """
        Invalidate all audit-related cache entries for a tenant
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            Number of keys deleted
        """
        patterns = [
            f"audit:search:*:{tenant_id}",
            f"audit:classification:*",
            f"audit:dashboard:{tenant_id}"
        ]
        
        deleted = 0
        for pattern in patterns:
            deleted += self.invalidate_pattern(pattern)
        
        logger.info(f"Invalidated {deleted} audit cache entries for tenant {tenant_id}")
        return deleted
    
    def get_audit_cache_keys(self) -> Dict[str, int]:
        """Get count of audit-related cache keys by type"""
        if not self.enabled or not self.client:
            return {}
        
        try:
            patterns = {
                "search_results": "audit:search:*",
                "classifications": "audit:classification:*",
                "dashboard_stats": "audit:dashboard:*"
            }
            
            counts = {}
            for name, pattern in patterns.items():
                keys = self.client.keys(pattern)
                counts[name] = len(keys)
            
            return counts
        except RedisError as e:
            logger.error(f"Failed to get audit cache keys: {e}")
            return {}
    
    # ========================================================================
    # Health Check
    # ========================================================================
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Redis connection"""
        if not self.enabled or not self.client:
            return {
                "healthy": False,
                "status": "disabled",
                "message": "Redis caching is disabled"
            }
        
        try:
            # Test connection with ping
            response_time_start = datetime.utcnow()
            self.client.ping()
            response_time = (datetime.utcnow() - response_time_start).total_seconds() * 1000
            
            return {
                "healthy": True,
                "status": "connected",
                "response_time_ms": round(response_time, 2),
                "message": "Redis is healthy"
            }
        except RedisError as e:
            return {
                "healthy": False,
                "status": "error",
                "error": str(e),
                "message": "Redis connection failed"
            }


# Global cache instance
_cache_instance: Optional[RedisCacheService] = None


def get_cache_service() -> RedisCacheService:
    """Get or create global cache service instance"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCacheService()
    return _cache_instance
