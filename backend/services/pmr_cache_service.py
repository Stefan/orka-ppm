"""
PMR Cache Service - Redis-based caching for Enhanced PMR
Implements caching strategies for frequently accessed reports and AI insights
"""

import os
import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from uuid import UUID
from decimal import Decimal

try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = None

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


class PMRCacheService:
    """
    Redis-based caching service for Enhanced PMR
    Provides caching for reports, AI insights, and Monte Carlo results
    """
    
    # Cache key prefixes
    REPORT_PREFIX = "pmr:report:"
    INSIGHTS_PREFIX = "pmr:insights:"
    MONTE_CARLO_PREFIX = "pmr:monte_carlo:"
    METRICS_PREFIX = "pmr:metrics:"
    TEMPLATE_PREFIX = "pmr:template:"
    
    # Default TTL values (in seconds)
    REPORT_TTL = 3600  # 1 hour
    INSIGHTS_TTL = 1800  # 30 minutes
    MONTE_CARLO_TTL = 7200  # 2 hours
    METRICS_TTL = 300  # 5 minutes
    TEMPLATE_TTL = 86400  # 24 hours
    
    def __init__(self, redis_url: Optional[str] = None):
        """Initialize cache service with Redis connection"""
        self.redis_client: Optional[Redis] = None
        self.enabled = False
        
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available - caching disabled")
            return
        
        try:
            # Get Redis URL from environment or parameter
            redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
            
            # Initialize Redis client
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            
            logger.info(f"PMR Cache Service initialized with Redis at {redis_url}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            self.redis_client = None
            self.enabled = False
    
    def is_enabled(self) -> bool:
        """Check if caching is enabled"""
        return self.enabled and self.redis_client is not None
    
    # Report Caching
    
    async def cache_report(
        self,
        report_id: UUID,
        report_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache a complete PMR report"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.REPORT_PREFIX}{report_id}"
            ttl = ttl or self.REPORT_TTL
            
            # Serialize report data
            serialized = json.dumps(report_data, cls=DecimalEncoder)
            
            # Store in Redis with TTL
            self.redis_client.setex(key, ttl, serialized)
            
            logger.debug(f"Cached report {report_id} with TTL {ttl}s")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache report {report_id}: {e}")
            return False
    
    async def get_cached_report(self, report_id: UUID) -> Optional[Dict[str, Any]]:
        """Retrieve cached PMR report"""
        if not self.is_enabled():
            return None
        
        try:
            key = f"{self.REPORT_PREFIX}{report_id}"
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for report {report_id}")
                return json.loads(cached)
            
            logger.debug(f"Cache miss for report {report_id}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached report {report_id}: {e}")
            return None
    
    async def invalidate_report(self, report_id: UUID) -> bool:
        """Invalidate cached report"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.REPORT_PREFIX}{report_id}"
            self.redis_client.delete(key)
            
            logger.debug(f"Invalidated cache for report {report_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to invalidate report cache {report_id}: {e}")
            return False
    
    # AI Insights Caching
    
    async def cache_insights(
        self,
        report_id: UUID,
        insights: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache AI insights for a report"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.INSIGHTS_PREFIX}{report_id}"
            ttl = ttl or self.INSIGHTS_TTL
            
            serialized = json.dumps(insights, cls=DecimalEncoder)
            self.redis_client.setex(key, ttl, serialized)
            
            logger.debug(f"Cached {len(insights)} insights for report {report_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache insights for report {report_id}: {e}")
            return False
    
    async def get_cached_insights(self, report_id: UUID) -> Optional[List[Dict[str, Any]]]:
        """Retrieve cached AI insights"""
        if not self.is_enabled():
            return None
        
        try:
            key = f"{self.INSIGHTS_PREFIX}{report_id}"
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for insights {report_id}")
                return json.loads(cached)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached insights {report_id}: {e}")
            return None
    
    # Monte Carlo Results Caching
    
    async def cache_monte_carlo(
        self,
        report_id: UUID,
        results: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache Monte Carlo analysis results"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.MONTE_CARLO_PREFIX}{report_id}"
            ttl = ttl or self.MONTE_CARLO_TTL
            
            serialized = json.dumps(results, cls=DecimalEncoder)
            self.redis_client.setex(key, ttl, serialized)
            
            logger.debug(f"Cached Monte Carlo results for report {report_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache Monte Carlo results {report_id}: {e}")
            return False
    
    async def get_cached_monte_carlo(self, report_id: UUID) -> Optional[Dict[str, Any]]:
        """Retrieve cached Monte Carlo results"""
        if not self.is_enabled():
            return None
        
        try:
            key = f"{self.MONTE_CARLO_PREFIX}{report_id}"
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for Monte Carlo {report_id}")
                return json.loads(cached)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached Monte Carlo {report_id}: {e}")
            return None
    
    # Real-Time Metrics Caching
    
    async def cache_metrics(
        self,
        project_id: UUID,
        metrics: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache real-time metrics for a project"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.METRICS_PREFIX}{project_id}"
            ttl = ttl or self.METRICS_TTL
            
            serialized = json.dumps(metrics, cls=DecimalEncoder)
            self.redis_client.setex(key, ttl, serialized)
            
            logger.debug(f"Cached metrics for project {project_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache metrics {project_id}: {e}")
            return False
    
    async def get_cached_metrics(self, project_id: UUID) -> Optional[Dict[str, Any]]:
        """Retrieve cached real-time metrics"""
        if not self.is_enabled():
            return None
        
        try:
            key = f"{self.METRICS_PREFIX}{project_id}"
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for metrics {project_id}")
                return json.loads(cached)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached metrics {project_id}: {e}")
            return None
    
    # Template Caching
    
    async def cache_template(
        self,
        template_id: UUID,
        template_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache PMR template"""
        if not self.is_enabled():
            return False
        
        try:
            key = f"{self.TEMPLATE_PREFIX}{template_id}"
            ttl = ttl or self.TEMPLATE_TTL
            
            serialized = json.dumps(template_data, cls=DecimalEncoder)
            self.redis_client.setex(key, ttl, serialized)
            
            logger.debug(f"Cached template {template_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache template {template_id}: {e}")
            return False
    
    async def get_cached_template(self, template_id: UUID) -> Optional[Dict[str, Any]]:
        """Retrieve cached template"""
        if not self.is_enabled():
            return None
        
        try:
            key = f"{self.TEMPLATE_PREFIX}{template_id}"
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for template {template_id}")
                return json.loads(cached)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached template {template_id}: {e}")
            return None
    
    # Bulk Operations
    
    async def invalidate_project_caches(self, project_id: UUID) -> int:
        """Invalidate all caches related to a project"""
        if not self.is_enabled():
            return 0
        
        try:
            # Find all keys related to the project
            patterns = [
                f"{self.REPORT_PREFIX}*",
                f"{self.METRICS_PREFIX}{project_id}"
            ]
            
            deleted_count = 0
            for pattern in patterns:
                keys = self.redis_client.keys(pattern)
                if keys:
                    deleted_count += self.redis_client.delete(*keys)
            
            logger.info(f"Invalidated {deleted_count} cache entries for project {project_id}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to invalidate project caches {project_id}: {e}")
            return 0
    
    # Cache Statistics
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.is_enabled():
            return {"enabled": False}
        
        try:
            info = self.redis_client.info("stats")
            
            return {
                "enabled": True,
                "total_keys": self.redis_client.dbsize(),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                ),
                "memory_used": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"enabled": True, "error": str(e)}
    
    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    # Health Check
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache service health"""
        if not self.is_enabled():
            return {
                "status": "disabled",
                "message": "Redis caching is not enabled"
            }
        
        try:
            # Test connection
            self.redis_client.ping()
            
            # Get basic info
            info = self.redis_client.info()
            
            return {
                "status": "healthy",
                "redis_version": info.get("redis_version", "unknown"),
                "uptime_seconds": info.get("uptime_in_seconds", 0),
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "N/A"),
                "total_keys": self.redis_client.dbsize()
            }
            
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
