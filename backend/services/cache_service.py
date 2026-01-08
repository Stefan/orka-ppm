"""
Redis caching service for change management system performance optimization.
Provides caching for frequently accessed change data, approval workflows, and templates.
"""

import json
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
from uuid import UUID

import redis
from redis.exceptions import ConnectionError, RedisError

from config.settings import settings

logger = logging.getLogger(__name__)

class CacheService:
    """Redis-based caching service for change management system"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis connection if URL is provided"""
        if not settings.REDIS_URL:
            logger.warning("Redis URL not configured. Caching will be disabled.")
            return
        
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established successfully")
        except (ConnectionError, RedisError) as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
    
    def is_available(self) -> bool:
        """Check if Redis is available"""
        if not self.redis_client:
            return False
        
        try:
            self.redis_client.ping()
            return True
        except (ConnectionError, RedisError):
            return False
    
    def _serialize_value(self, value: Any) -> str:
        """Serialize value for Redis storage"""
        if isinstance(value, (dict, list)):
            return json.dumps(value, default=str)
        elif isinstance(value, (UUID, datetime)):
            return str(value)
        else:
            return str(value)
    
    def _deserialize_value(self, value: str, value_type: str = "auto") -> Any:
        """Deserialize value from Redis storage"""
        if not value:
            return None
        
        if value_type == "json":
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        elif value_type == "auto":
            # Try to detect JSON
            if value.startswith(("{", "[")):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
        
        return value
    
    async def get(self, key: str, value_type: str = "auto") -> Optional[Any]:
        """Get value from cache"""
        if not self.is_available():
            return None
        
        try:
            value = self.redis_client.get(key)
            if value is None:
                return None
            
            return self._deserialize_value(value, value_type)
        except RedisError as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with optional TTL"""
        if not self.is_available():
            return False
        
        try:
            serialized_value = self._serialize_value(value)
            if ttl:
                return self.redis_client.setex(key, ttl, serialized_value)
            else:
                return self.redis_client.set(key, serialized_value)
        except RedisError as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.is_available():
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except RedisError as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.is_available():
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except RedisError as e:
            logger.error(f"Redis DELETE PATTERN error for pattern {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.is_available():
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except RedisError as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment counter in cache"""
        if not self.is_available():
            return None
        
        try:
            return self.redis_client.incrby(key, amount)
        except RedisError as e:
            logger.error(f"Redis INCREMENT error for key {key}: {e}")
            return None
    
    async def set_hash(self, key: str, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Set hash in cache"""
        if not self.is_available():
            return False
        
        try:
            # Serialize all values in the mapping
            serialized_mapping = {
                k: self._serialize_value(v) for k, v in mapping.items()
            }
            
            result = self.redis_client.hset(key, mapping=serialized_mapping)
            if ttl:
                self.redis_client.expire(key, ttl)
            return bool(result)
        except RedisError as e:
            logger.error(f"Redis HSET error for key {key}: {e}")
            return False
    
    async def get_hash(self, key: str) -> Optional[Dict[str, Any]]:
        """Get hash from cache"""
        if not self.is_available():
            return None
        
        try:
            hash_data = self.redis_client.hgetall(key)
            if not hash_data:
                return None
            
            # Deserialize all values
            return {
                k: self._deserialize_value(v) for k, v in hash_data.items()
            }
        except RedisError as e:
            logger.error(f"Redis HGETALL error for key {key}: {e}")
            return None
    
    async def get_hash_field(self, key: str, field: str) -> Optional[Any]:
        """Get specific field from hash"""
        if not self.is_available():
            return None
        
        try:
            value = self.redis_client.hget(key, field)
            if value is None:
                return None
            return self._deserialize_value(value)
        except RedisError as e:
            logger.error(f"Redis HGET error for key {key}, field {field}: {e}")
            return None
    
    # Change Management Specific Cache Methods
    
    def _get_change_key(self, change_id: Union[str, UUID]) -> str:
        """Generate cache key for change request"""
        return f"change:{change_id}"
    
    def _get_approval_workflow_key(self, workflow_type: str) -> str:
        """Generate cache key for approval workflow configuration"""
        return f"workflow:config:{workflow_type}"
    
    def _get_template_key(self, template_id: Union[str, UUID]) -> str:
        """Generate cache key for change template"""
        return f"template:{template_id}"
    
    def _get_user_approvals_key(self, user_id: Union[str, UUID]) -> str:
        """Generate cache key for user's pending approvals"""
        return f"user:approvals:{user_id}"
    
    def _get_project_changes_key(self, project_id: Union[str, UUID]) -> str:
        """Generate cache key for project's change requests"""
        return f"project:changes:{project_id}"
    
    def _get_analytics_key(self, project_id: Optional[Union[str, UUID]] = None, 
                          date_range: Optional[str] = None) -> str:
        """Generate cache key for analytics data"""
        if project_id and date_range:
            return f"analytics:{project_id}:{date_range}"
        elif project_id:
            return f"analytics:{project_id}"
        elif date_range:
            return f"analytics:global:{date_range}"
        else:
            return "analytics:global"
    
    # Change Request Caching
    
    async def cache_change_request(
        self, 
        change_id: Union[str, UUID], 
        change_data: Dict[str, Any],
        ttl: int = 3600  # 1 hour default
    ) -> bool:
        """Cache change request data"""
        key = self._get_change_key(change_id)
        return await self.set(key, change_data, ttl)
    
    async def get_cached_change_request(
        self, 
        change_id: Union[str, UUID]
    ) -> Optional[Dict[str, Any]]:
        """Get cached change request data"""
        key = self._get_change_key(change_id)
        return await self.get(key, "json")
    
    async def invalidate_change_request(self, change_id: Union[str, UUID]) -> bool:
        """Invalidate cached change request"""
        key = self._get_change_key(change_id)
        return await self.delete(key)
    
    # Approval Workflow Caching
    
    async def cache_approval_workflow_config(
        self, 
        workflow_type: str, 
        config_data: Dict[str, Any],
        ttl: int = 7200  # 2 hours default
    ) -> bool:
        """Cache approval workflow configuration"""
        key = self._get_approval_workflow_key(workflow_type)
        return await self.set(key, config_data, ttl)
    
    async def get_cached_approval_workflow_config(
        self, 
        workflow_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached approval workflow configuration"""
        key = self._get_approval_workflow_key(workflow_type)
        return await self.get(key, "json")
    
    async def invalidate_approval_workflow_config(self, workflow_type: str) -> bool:
        """Invalidate cached approval workflow configuration"""
        key = self._get_approval_workflow_key(workflow_type)
        return await self.delete(key)
    
    # Template Caching
    
    async def cache_change_template(
        self, 
        template_id: Union[str, UUID], 
        template_data: Dict[str, Any],
        ttl: int = 3600  # 1 hour default
    ) -> bool:
        """Cache change template data"""
        key = self._get_template_key(template_id)
        return await self.set(key, template_data, ttl)
    
    async def get_cached_change_template(
        self, 
        template_id: Union[str, UUID]
    ) -> Optional[Dict[str, Any]]:
        """Get cached change template data"""
        key = self._get_template_key(template_id)
        return await self.get(key, "json")
    
    async def invalidate_change_template(self, template_id: Union[str, UUID]) -> bool:
        """Invalidate cached change template"""
        key = self._get_template_key(template_id)
        return await self.delete(key)
    
    # User Approvals Caching
    
    async def cache_user_pending_approvals(
        self, 
        user_id: Union[str, UUID], 
        approvals_data: List[Dict[str, Any]],
        ttl: int = 300  # 5 minutes default (frequently changing)
    ) -> bool:
        """Cache user's pending approvals"""
        key = self._get_user_approvals_key(user_id)
        return await self.set(key, approvals_data, ttl)
    
    async def get_cached_user_pending_approvals(
        self, 
        user_id: Union[str, UUID]
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached user's pending approvals"""
        key = self._get_user_approvals_key(user_id)
        return await self.get(key, "json")
    
    async def invalidate_user_pending_approvals(self, user_id: Union[str, UUID]) -> bool:
        """Invalidate cached user's pending approvals"""
        key = self._get_user_approvals_key(user_id)
        return await self.delete(key)
    
    # Project Changes Caching
    
    async def cache_project_changes(
        self, 
        project_id: Union[str, UUID], 
        changes_data: List[Dict[str, Any]],
        ttl: int = 1800  # 30 minutes default
    ) -> bool:
        """Cache project's change requests"""
        key = self._get_project_changes_key(project_id)
        return await self.set(key, changes_data, ttl)
    
    async def get_cached_project_changes(
        self, 
        project_id: Union[str, UUID]
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached project's change requests"""
        key = self._get_project_changes_key(project_id)
        return await self.get(key, "json")
    
    async def invalidate_project_changes(self, project_id: Union[str, UUID]) -> bool:
        """Invalidate cached project's change requests"""
        key = self._get_project_changes_key(project_id)
        return await self.delete(key)
    
    # Analytics Caching
    
    async def cache_analytics_data(
        self, 
        analytics_data: Dict[str, Any],
        project_id: Optional[Union[str, UUID]] = None,
        date_range: Optional[str] = None,
        ttl: int = 1800  # 30 minutes default
    ) -> bool:
        """Cache analytics data"""
        key = self._get_analytics_key(project_id, date_range)
        return await self.set(key, analytics_data, ttl)
    
    async def get_cached_analytics_data(
        self, 
        project_id: Optional[Union[str, UUID]] = None,
        date_range: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached analytics data"""
        key = self._get_analytics_key(project_id, date_range)
        return await self.get(key, "json")
    
    async def invalidate_analytics_data(
        self, 
        project_id: Optional[Union[str, UUID]] = None,
        date_range: Optional[str] = None
    ) -> bool:
        """Invalidate cached analytics data"""
        key = self._get_analytics_key(project_id, date_range)
        return await self.delete(key)
    
    # Bulk Cache Invalidation
    
    async def invalidate_change_related_caches(self, change_id: Union[str, UUID]) -> int:
        """Invalidate all caches related to a specific change request"""
        patterns = [
            f"change:{change_id}",
            "analytics:*",  # Analytics might be affected
            "project:changes:*",  # Project change lists might be affected
            "user:approvals:*"  # User approval lists might be affected
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        return total_deleted
    
    async def invalidate_project_related_caches(self, project_id: Union[str, UUID]) -> int:
        """Invalidate all caches related to a specific project"""
        patterns = [
            f"project:changes:{project_id}",
            f"analytics:{project_id}:*",
            "analytics:global*"  # Global analytics might include this project
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        return total_deleted
    
    async def invalidate_user_related_caches(self, user_id: Union[str, UUID]) -> int:
        """Invalidate all caches related to a specific user"""
        patterns = [
            f"user:approvals:{user_id}"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        return total_deleted
    
    # Health Check
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on cache service"""
        if not self.is_available():
            return {
                "status": "unhealthy",
                "redis_available": False,
                "error": "Redis connection not available"
            }
        
        try:
            # Test basic operations
            test_key = "health_check_test"
            test_value = {"timestamp": datetime.now().isoformat()}
            
            # Test set/get/delete
            await self.set(test_key, test_value, 10)
            retrieved = await self.get(test_key, "json")
            await self.delete(test_key)
            
            if retrieved != test_value:
                return {
                    "status": "unhealthy",
                    "redis_available": True,
                    "error": "Cache operations not working correctly"
                }
            
            # Get Redis info
            info = self.redis_client.info()
            
            return {
                "status": "healthy",
                "redis_available": True,
                "redis_version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": info.get("used_memory_human"),
                "keyspace": info.get("db0", {})
            }
        
        except Exception as e:
            return {
                "status": "unhealthy",
                "redis_available": True,
                "error": f"Health check failed: {str(e)}"
            }

# Global cache service instance
cache_service = CacheService()