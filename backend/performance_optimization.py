"""
Performance optimization module for API caching, monitoring, and rate limiting.
Implements Redis caching, response time monitoring, and bulk operations support.
"""

import time
import json
import hashlib
import asyncio
from typing import Any, Dict, List, Optional, Callable, Union
from datetime import datetime, timedelta
from functools import wraps
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from cachetools import TTLCache
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import aiofiles

# Metrics for monitoring
REQUEST_COUNT = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('api_request_duration_seconds', 'API request duration', ['method', 'endpoint'])
CACHE_HITS = Counter('cache_hits_total', 'Cache hits', ['cache_type'])
CACHE_MISSES = Counter('cache_misses_total', 'Cache misses', ['cache_type'])
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Active connections')
BULK_OPERATIONS = Counter('bulk_operations_total', 'Bulk operations', ['operation_type', 'status'])

class CacheManager:
    """Redis-based cache manager with fallback to in-memory cache"""
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_client: Optional[redis.Redis] = None
        self.memory_cache = TTLCache(maxsize=1000, ttl=300)  # 5-minute TTL
        self.redis_available = False
        
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                self.redis_available = True
                print("✅ Redis cache initialized")
            except Exception as e:
                print(f"⚠️ Redis connection failed, using memory cache: {e}")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.redis_available and self.redis_client:
                value = await self.redis_client.get(key)
                if value:
                    CACHE_HITS.labels(cache_type='redis').inc()
                    return json.loads(value)
                else:
                    CACHE_MISSES.labels(cache_type='redis').inc()
            
            # Fallback to memory cache
            if key in self.memory_cache:
                CACHE_HITS.labels(cache_type='memory').inc()
                return self.memory_cache[key]
            
            CACHE_MISSES.labels(cache_type='memory').inc()
            return None
            
        except Exception as e:
            print(f"Cache get error: {e}")
            CACHE_MISSES.labels(cache_type='error').inc()
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        try:
            if self.redis_available and self.redis_client:
                serialized = json.dumps(value, default=str)
                await self.redis_client.setex(key, ttl, serialized)
                return True
            
            # Fallback to memory cache
            self.memory_cache[key] = value
            return True
            
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if self.redis_available and self.redis_client:
                await self.redis_client.delete(key)
            
            if key in self.memory_cache:
                del self.memory_cache[key]
            
            return True
            
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        try:
            if self.redis_available and self.redis_client:
                keys = await self.redis_client.keys(pattern)
                if keys:
                    return await self.redis_client.delete(*keys)
            
            # Clear memory cache (simple pattern matching)
            keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace('*', '') in k]
            for key in keys_to_delete:
                del self.memory_cache[key]
            
            return len(keys_to_delete)
            
        except Exception as e:
            print(f"Cache clear pattern error: {e}")
            return 0

class PerformanceMonitor:
    """Performance monitoring and metrics collection"""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.error_counts: Dict[str, int] = {}
        self.endpoint_stats: Dict[str, Dict[str, Any]] = {}
    
    def record_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """Record request metrics"""
        REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status_code).inc()
        REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(duration)
        
        # Store in memory for detailed analysis
        self.response_times.append(duration)
        if len(self.response_times) > 1000:  # Keep only last 1000 requests
            self.response_times = self.response_times[-1000:]
        
        # Track endpoint statistics
        endpoint_key = f"{method}:{endpoint}"
        if endpoint_key not in self.endpoint_stats:
            self.endpoint_stats[endpoint_key] = {
                'total_requests': 0,
                'total_duration': 0,
                'error_count': 0,
                'avg_duration': 0
            }
        
        stats = self.endpoint_stats[endpoint_key]
        stats['total_requests'] += 1
        stats['total_duration'] += duration
        stats['avg_duration'] = stats['total_duration'] / stats['total_requests']
        
        if status_code >= 400:
            stats['error_count'] += 1
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        if not self.response_times:
            return {"message": "No performance data available"}
        
        avg_response_time = sum(self.response_times) / len(self.response_times)
        max_response_time = max(self.response_times)
        min_response_time = min(self.response_times)
        
        # Calculate percentiles
        sorted_times = sorted(self.response_times)
        p95_index = int(len(sorted_times) * 0.95)
        p99_index = int(len(sorted_times) * 0.99)
        
        return {
            "total_requests": len(self.response_times),
            "avg_response_time_ms": round(avg_response_time * 1000, 2),
            "max_response_time_ms": round(max_response_time * 1000, 2),
            "min_response_time_ms": round(min_response_time * 1000, 2),
            "p95_response_time_ms": round(sorted_times[p95_index] * 1000, 2) if p95_index < len(sorted_times) else 0,
            "p99_response_time_ms": round(sorted_times[p99_index] * 1000, 2) if p99_index < len(sorted_times) else 0,
            "endpoint_stats": self.endpoint_stats
        }

class BulkOperationManager:
    """Manager for bulk data operations with progress tracking"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.active_operations: Dict[str, Dict[str, Any]] = {}
    
    async def start_bulk_operation(self, operation_id: str, operation_type: str, total_items: int) -> str:
        """Start tracking a bulk operation"""
        self.active_operations[operation_id] = {
            'operation_type': operation_type,
            'total_items': total_items,
            'processed_items': 0,
            'failed_items': 0,
            'start_time': datetime.now(),
            'status': 'running',
            'errors': []
        }
        
        # Cache the operation status
        await self.cache_manager.set(f"bulk_op:{operation_id}", self.active_operations[operation_id], ttl=3600)
        
        BULK_OPERATIONS.labels(operation_type=operation_type, status='started').inc()
        return operation_id
    
    async def update_progress(self, operation_id: str, processed: int, failed: int = 0, error: str = None):
        """Update bulk operation progress"""
        if operation_id not in self.active_operations:
            return False
        
        operation = self.active_operations[operation_id]
        operation['processed_items'] = processed
        operation['failed_items'] = failed
        
        if error:
            operation['errors'].append(error)
        
        # Update cache
        await self.cache_manager.set(f"bulk_op:{operation_id}", operation, ttl=3600)
        return True
    
    async def complete_bulk_operation(self, operation_id: str, success: bool = True):
        """Complete a bulk operation"""
        if operation_id not in self.active_operations:
            return False
        
        operation = self.active_operations[operation_id]
        operation['status'] = 'completed' if success else 'failed'
        operation['end_time'] = datetime.now()
        operation['duration_seconds'] = (operation['end_time'] - operation['start_time']).total_seconds()
        
        # Update cache with longer TTL for completed operations
        await self.cache_manager.set(f"bulk_op:{operation_id}", operation, ttl=86400)  # 24 hours
        
        BULK_OPERATIONS.labels(operation_type=operation['operation_type'], status=operation['status']).inc()
        
        # Remove from active operations after a delay
        await asyncio.sleep(60)  # Keep in memory for 1 minute
        if operation_id in self.active_operations:
            del self.active_operations[operation_id]
        
        return True
    
    async def get_operation_status(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """Get bulk operation status"""
        # Check memory first
        if operation_id in self.active_operations:
            return self.active_operations[operation_id]
        
        # Check cache
        cached_status = await self.cache_manager.get(f"bulk_op:{operation_id}")
        return cached_status

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

def create_cache_key(prefix: str, *args, **kwargs) -> str:
    """Create a consistent cache key"""
    key_parts = [prefix] + [str(arg) for arg in args]
    if kwargs:
        key_parts.append(hashlib.md5(json.dumps(kwargs, sort_keys=True).encode()).hexdigest()[:8])
    return ":".join(key_parts)

def cached(ttl: int = 300, prefix: str = "api"):
    """Decorator for caching function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get cache manager from app state (will be injected)
            cache_manager = getattr(wrapper, '_cache_manager', None)
            if not cache_manager:
                return await func(*args, **kwargs)
            
            # Create cache key
            cache_key = create_cache_key(prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_result = await cache_manager.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_manager.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

async def performance_middleware(request: Request, call_next):
    """Middleware for performance monitoring"""
    start_time = time.time()
    
    # Track active connections
    ACTIVE_CONNECTIONS.inc()
    
    try:
        response = await call_next(request)
        
        # Record metrics
        duration = time.time() - start_time
        method = request.method
        endpoint = request.url.path
        status_code = response.status_code
        
        # Get performance monitor from app state
        performance_monitor = getattr(request.app.state, 'performance_monitor', None)
        if performance_monitor:
            performance_monitor.record_request(method, endpoint, status_code, duration)
        
        # Add performance headers
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        response.headers["X-Request-ID"] = str(id(request))
        
        return response
        
    except Exception as e:
        # Record error
        duration = time.time() - start_time
        method = request.method
        endpoint = request.url.path
        
        performance_monitor = getattr(request.app.state, 'performance_monitor', None)
        if performance_monitor:
            performance_monitor.record_request(method, endpoint, 500, duration)
        
        raise e
    
    finally:
        ACTIVE_CONNECTIONS.dec()

class APIVersionManager:
    """API versioning manager"""
    
    def __init__(self):
        self.supported_versions = ["v1", "v2"]
        self.default_version = "v1"
        self.deprecated_versions = []
    
    def get_version_from_request(self, request: Request) -> str:
        """Extract API version from request"""
        # Check header first
        version = request.headers.get("API-Version")
        if version and version in self.supported_versions:
            return version
        
        # Check query parameter
        version = request.query_params.get("version")
        if version and version in self.supported_versions:
            return version
        
        # Check path prefix
        path_parts = request.url.path.strip("/").split("/")
        if path_parts and path_parts[0] in self.supported_versions:
            return path_parts[0]
        
        return self.default_version
    
    def is_version_deprecated(self, version: str) -> bool:
        """Check if version is deprecated"""
        return version in self.deprecated_versions
    
    def add_version_headers(self, response: Response, version: str):
        """Add version-related headers to response"""
        response.headers["API-Version"] = version
        response.headers["Supported-Versions"] = ",".join(self.supported_versions)
        
        if self.is_version_deprecated(version):
            response.headers["Deprecation"] = "true"
            response.headers["Sunset"] = (datetime.now() + timedelta(days=90)).isoformat()

async def version_middleware(request: Request, call_next):
    """Middleware for API versioning"""
    version_manager = getattr(request.app.state, 'version_manager', APIVersionManager())
    
    # Get version from request
    version = version_manager.get_version_from_request(request)
    request.state.api_version = version
    
    # Process request
    response = await call_next(request)
    
    # Add version headers
    version_manager.add_version_headers(response, version)
    
    return response

# Export main components
__all__ = [
    'CacheManager',
    'PerformanceMonitor', 
    'BulkOperationManager',
    'limiter',
    'cached',
    'performance_middleware',
    'version_middleware',
    'APIVersionManager',
    'create_cache_key'
]