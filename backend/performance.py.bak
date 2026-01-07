# Performance optimization utilities for the PPM API
import time
import json
import hashlib
from typing import Any, Dict, Optional, Callable
from functools import wraps
from datetime import datetime, timedelta
import asyncio
import logging
from collections import defaultdict
import redis
import os
from fastapi import Request, Response
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis connection for caching
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established")
except Exception as e:
    logger.warning(f"Redis not available: {e}. Using in-memory cache.")
    REDIS_AVAILABLE = False
    # Fallback to in-memory cache
    _memory_cache = {}
    _cache_timestamps = {}

class PerformanceMonitor:
    """Performance monitoring and metrics collection"""
    
    def __init__(self):
        self.metrics = defaultdict(list)
        self.request_counts = defaultdict(int)
        self.error_counts = defaultdict(int)
        self.slow_queries = []
        
    def record_request(self, endpoint: str, duration: float, status_code: int):
        """Record request metrics"""
        self.metrics[endpoint].append({
            'duration': duration,
            'timestamp': datetime.utcnow().isoformat(),
            'status_code': status_code
        })
        self.request_counts[endpoint] += 1
        
        if status_code >= 400:
            self.error_counts[endpoint] += 1
            
        # Track slow queries (>1 second)
        if duration > 1.0:
            self.slow_queries.append({
                'endpoint': endpoint,
                'duration': duration,
                'timestamp': datetime.utcnow().isoformat()
            })
            
        # Keep only last 1000 entries per endpoint
        if len(self.metrics[endpoint]) > 1000:
            self.metrics[endpoint] = self.metrics[endpoint][-1000:]
            
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        stats = {}
        
        for endpoint, requests in self.metrics.items():
            if requests:
                durations = [r['duration'] for r in requests]
                stats[endpoint] = {
                    'total_requests': len(requests),
                    'avg_duration': sum(durations) / len(durations),
                    'min_duration': min(durations),
                    'max_duration': max(durations),
                    'error_rate': self.error_counts[endpoint] / len(requests) * 100,
                    'requests_per_minute': len([r for r in requests 
                                              if datetime.fromisoformat(r['timestamp']) > 
                                              datetime.utcnow() - timedelta(minutes=1)])
                }
                
        return {
            'endpoint_stats': stats,
            'total_requests': sum(self.request_counts.values()),
            'total_errors': sum(self.error_counts.values()),
            'slow_queries_count': len(self.slow_queries),
            'recent_slow_queries': self.slow_queries[-10:] if self.slow_queries else []
        }

# Global performance monitor instance
performance_monitor = PerformanceMonitor()

class CacheManager:
    """Centralized cache management with Redis fallback to memory"""
    
    def __init__(self):
        self.default_ttl = 300  # 5 minutes
        
    def _generate_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """Generate cache key from parameters"""
        # Sort params for consistent key generation
        sorted_params = json.dumps(params, sort_keys=True, default=str)
        key_hash = hashlib.md5(sorted_params.encode()).hexdigest()
        return f"{prefix}:{key_hash}"
        
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if REDIS_AVAILABLE:
                value = redis_client.get(key)
                if value:
                    return json.loads(value)
            else:
                # Memory cache with TTL check
                if key in _memory_cache:
                    timestamp = _cache_timestamps.get(key, 0)
                    if time.time() - timestamp < self.default_ttl:
                        return _memory_cache[key]
                    else:
                        # Expired, remove from cache
                        del _memory_cache[key]
                        del _cache_timestamps[key]
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
            
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache"""
        try:
            ttl = ttl or self.default_ttl
            if REDIS_AVAILABLE:
                redis_client.setex(key, ttl, json.dumps(value, default=str))
            else:
                # Memory cache
                _memory_cache[key] = value
                _cache_timestamps[key] = time.time()
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
            
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            if REDIS_AVAILABLE:
                redis_client.delete(key)
            else:
                _memory_cache.pop(key, None)
                _cache_timestamps.pop(key, None)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
            
    def clear_pattern(self, pattern: str) -> bool:
        """Clear all keys matching pattern"""
        try:
            if REDIS_AVAILABLE:
                keys = redis_client.keys(pattern)
                if keys:
                    redis_client.delete(*keys)
            else:
                # Memory cache pattern matching
                keys_to_delete = [k for k in _memory_cache.keys() if pattern.replace('*', '') in k]
                for key in keys_to_delete:
                    _memory_cache.pop(key, None)
                    _cache_timestamps.pop(key, None)
            return True
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
            return False

# Global cache manager instance
cache_manager = CacheManager()

def cached(prefix: str, ttl: int = 300, key_params: Optional[List[str]] = None):
    """Decorator for caching function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Generate cache key from specified parameters
            if key_params:
                cache_params = {k: kwargs.get(k) for k in key_params if k in kwargs}
            else:
                cache_params = kwargs
                
            cache_key = cache_manager._generate_key(prefix, cache_params)
            
            # Try to get from cache
            cached_result = cache_manager.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result
                
            # Execute function and cache result
            logger.debug(f"Cache miss for {cache_key}")
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
                
            cache_manager.set(cache_key, result, ttl)
            return result
            
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Generate cache key from specified parameters
            if key_params:
                cache_params = {k: kwargs.get(k) for k in key_params if k in kwargs}
            else:
                cache_params = kwargs
                
            cache_key = cache_manager._generate_key(prefix, cache_params)
            
            # Try to get from cache
            cached_result = cache_manager.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result
                
            # Execute function and cache result
            logger.debug(f"Cache miss for {cache_key}")
            result = func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl)
            return result
            
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

def invalidate_cache(patterns: List[str]):
    """Invalidate cache entries matching patterns"""
    for pattern in patterns:
        cache_manager.clear_pattern(pattern)
        logger.info(f"Invalidated cache pattern: {pattern}")

class RateLimiter:
    """Rate limiting implementation"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.limits = {
            'default': {'requests': 100, 'window': 60},  # 100 requests per minute
            'ai_agents': {'requests': 20, 'window': 60},  # 20 AI requests per minute
            'reports': {'requests': 10, 'window': 60},    # 10 reports per minute
        }
        
    def is_allowed(self, client_id: str, endpoint_type: str = 'default') -> tuple[bool, Dict[str, Any]]:
        """Check if request is allowed under rate limit"""
        now = time.time()
        limit_config = self.limits.get(endpoint_type, self.limits['default'])
        window = limit_config['window']
        max_requests = limit_config['requests']
        
        # Clean old requests outside the window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id] 
            if now - req_time < window
        ]
        
        current_requests = len(self.requests[client_id])
        
        if current_requests >= max_requests:
            return False, {
                'allowed': False,
                'limit': max_requests,
                'remaining': 0,
                'reset_time': int(now + window),
                'retry_after': window
            }
            
        # Add current request
        self.requests[client_id].append(now)
        
        return True, {
            'allowed': True,
            'limit': max_requests,
            'remaining': max_requests - current_requests - 1,
            'reset_time': int(now + window)
        }

# Global rate limiter instance
rate_limiter = RateLimiter()

def monitor_performance(func: Callable):
    """Decorator to monitor endpoint performance"""
    @wraps(func)
    async def async_wrapper(request: Request, *args, **kwargs):
        start_time = time.time()
        endpoint = f"{request.method} {request.url.path}"
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(request, *args, **kwargs)
            else:
                result = func(request, *args, **kwargs)
            
            duration = time.time() - start_time
            status_code = getattr(result, 'status_code', 200)
            performance_monitor.record_request(endpoint, duration, status_code)
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            performance_monitor.record_request(endpoint, duration, 500)
            raise
            
    @wraps(func)
    def sync_wrapper(request: Request, *args, **kwargs):
        start_time = time.time()
        endpoint = f"{request.method} {request.url.path}"
        
        try:
            result = func(request, *args, **kwargs)
            duration = time.time() - start_time
            status_code = getattr(result, 'status_code', 200)
            performance_monitor.record_request(endpoint, duration, status_code)
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            performance_monitor.record_request(endpoint, duration, 500)
            raise
            
    return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

def get_client_id(request: Request) -> str:
    """Extract client ID for rate limiting"""
    # Try to get user ID from auth token, fallback to IP
    auth_header = request.headers.get("authorization")
    if auth_header:
        try:
            # Extract user ID from JWT token (simplified)
            import jwt
            token = auth_header.replace("Bearer ", "")
            # Note: In production, properly decode and validate the JWT
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded.get("sub", request.client.host)
        except:
            pass
    
    return request.client.host

async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware"""
    client_id = get_client_id(request)
    
    # Determine endpoint type for rate limiting
    endpoint_type = 'default'
    if '/ai/' in request.url.path:
        endpoint_type = 'ai_agents'
    elif '/reports/' in request.url.path:
        endpoint_type = 'reports'
    
    allowed, rate_info = rate_limiter.is_allowed(client_id, endpoint_type)
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "limit": rate_info['limit'],
                "retry_after": rate_info['retry_after']
            },
            headers={
                "X-RateLimit-Limit": str(rate_info['limit']),
                "X-RateLimit-Remaining": str(rate_info['remaining']),
                "X-RateLimit-Reset": str(rate_info['reset_time']),
                "Retry-After": str(rate_info['retry_after'])
            }
        )
    
    response = await call_next(request)
    
    # Add rate limit headers to response
    response.headers["X-RateLimit-Limit"] = str(rate_info['limit'])
    response.headers["X-RateLimit-Remaining"] = str(rate_info['remaining'])
    response.headers["X-RateLimit-Reset"] = str(rate_info['reset_time'])
    
    return response

class BulkOperationManager:
    """Manager for bulk operations to improve performance"""
    
    @staticmethod
    def chunk_list(items: List[Any], chunk_size: int = 100) -> List[List[Any]]:
        """Split list into chunks for batch processing"""
        for i in range(0, len(items), chunk_size):
            yield items[i:i + chunk_size]
    
    @staticmethod
    async def process_in_batches(items: List[Any], processor: Callable, batch_size: int = 100):
        """Process items in batches to avoid overwhelming the system"""
        results = []
        for batch in BulkOperationManager.chunk_list(items, batch_size):
            if asyncio.iscoroutinefunction(processor):
                batch_results = await processor(batch)
            else:
                batch_results = processor(batch)
            results.extend(batch_results)
            
            # Small delay between batches to prevent overwhelming
            await asyncio.sleep(0.01)
            
        return results

# Export commonly used functions and classes
__all__ = [
    'cached',
    'invalidate_cache',
    'monitor_performance',
    'rate_limit_middleware',
    'performance_monitor',
    'cache_manager',
    'rate_limiter',
    'BulkOperationManager'
]