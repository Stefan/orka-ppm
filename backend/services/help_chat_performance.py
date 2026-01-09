"""
Help Chat Performance Optimization Service
Implements caching, monitoring, and fallback responses for the AI help chat system
"""

import time
import json
import hashlib
import asyncio
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass, asdict
import logging

from cachetools import TTLCache
from supabase import Client

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Performance metrics for help chat operations"""
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    avg_response_time_ms: float = 0.0
    max_response_time_ms: float = 0.0
    min_response_time_ms: float = float('inf')
    p95_response_time_ms: float = 0.0
    error_count: int = 0
    fallback_responses: int = 0
    last_updated: datetime = None

@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    data: Any
    created_at: datetime
    ttl_seconds: int
    access_count: int = 0
    last_accessed: datetime = None

@dataclass
class FallbackResponse:
    """Fallback response for service unavailability"""
    response: str
    confidence: float
    sources: List[Dict] = None
    suggested_actions: List[Dict] = None

class HelpChatCache:
    """Multi-level cache for help chat responses"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.memory_cache = TTLCache(maxsize=max_size, ttl=default_ttl)
        self.persistent_cache: Dict[str, CacheEntry] = {}
        self.max_persistent_size = max_size * 2
        self.default_ttl = default_ttl
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'size': 0
        }
    
    def _create_cache_key(self, prefix: str, query: str, context: Dict[str, Any], 
                         language: str = 'en') -> str:
        """Create a consistent cache key"""
        # Create a hash of the context to keep keys manageable
        context_str = json.dumps(context, sort_keys=True)
        context_hash = hashlib.md5(context_str.encode()).hexdigest()[:8]
        
        # Create key with query hash for privacy
        query_hash = hashlib.md5(query.lower().encode()).hexdigest()[:12]
        
        return f"{prefix}:{language}:{context_hash}:{query_hash}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache with fallback levels"""
        try:
            # Level 1: Memory cache (fastest)
            if key in self.memory_cache:
                self.cache_stats['hits'] += 1
                return self.memory_cache[key]
            
            # Level 2: Persistent cache
            if key in self.persistent_cache:
                entry = self.persistent_cache[key]
                
                # Check if entry is still valid
                if self._is_entry_valid(entry):
                    # Update access statistics
                    entry.access_count += 1
                    entry.last_accessed = datetime.now()
                    
                    # Promote to memory cache
                    self.memory_cache[key] = entry.data
                    
                    self.cache_stats['hits'] += 1
                    return entry.data
                else:
                    # Remove expired entry
                    del self.persistent_cache[key]
            
            self.cache_stats['misses'] += 1
            return None
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            self.cache_stats['misses'] += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL"""
        try:
            ttl = ttl or self.default_ttl
            
            # Set in memory cache
            self.memory_cache[key] = value
            
            # Set in persistent cache with metadata
            entry = CacheEntry(
                data=value,
                created_at=datetime.now(),
                ttl_seconds=ttl,
                access_count=1,
                last_accessed=datetime.now()
            )
            
            self.persistent_cache[key] = entry
            
            # Cleanup if cache is too large
            await self._cleanup_persistent_cache()
            
            self.cache_stats['size'] = len(self.persistent_cache)
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from all cache levels"""
        try:
            # Remove from memory cache
            if key in self.memory_cache:
                del self.memory_cache[key]
            
            # Remove from persistent cache
            if key in self.persistent_cache:
                del self.persistent_cache[key]
            
            self.cache_stats['size'] = len(self.persistent_cache)
            return True
            
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        try:
            cleared_count = 0
            
            # Clear from memory cache
            keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace('*', '') in k]
            for key in keys_to_delete:
                del self.memory_cache[key]
                cleared_count += 1
            
            # Clear from persistent cache
            keys_to_delete = [k for k in self.persistent_cache.keys() if pattern.replace('*', '') in k]
            for key in keys_to_delete:
                del self.persistent_cache[key]
                cleared_count += 1
            
            self.cache_stats['size'] = len(self.persistent_cache)
            return cleared_count
            
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
            return 0
    
    def _is_entry_valid(self, entry: CacheEntry) -> bool:
        """Check if cache entry is still valid"""
        age_seconds = (datetime.now() - entry.created_at).total_seconds()
        return age_seconds < entry.ttl_seconds
    
    async def _cleanup_persistent_cache(self):
        """Clean up expired and least-used entries"""
        if len(self.persistent_cache) <= self.max_persistent_size:
            return
        
        # Remove expired entries first
        expired_keys = []
        for key, entry in self.persistent_cache.items():
            if not self._is_entry_valid(entry):
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.persistent_cache[key]
            self.cache_stats['evictions'] += 1
        
        # If still too large, remove least recently used entries
        if len(self.persistent_cache) > self.max_persistent_size:
            # Sort by last accessed time and access count
            sorted_entries = sorted(
                self.persistent_cache.items(),
                key=lambda x: (x[1].last_accessed or x[1].created_at, x[1].access_count)
            )
            
            # Remove oldest entries
            entries_to_remove = len(self.persistent_cache) - self.max_persistent_size
            for i in range(entries_to_remove):
                key = sorted_entries[i][0]
                del self.persistent_cache[key]
                self.cache_stats['evictions'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
        hit_rate = (self.cache_stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'memory_cache_size': len(self.memory_cache),
            'persistent_cache_size': len(self.persistent_cache),
            'total_hits': self.cache_stats['hits'],
            'total_misses': self.cache_stats['misses'],
            'hit_rate_percent': round(hit_rate, 2),
            'evictions': self.cache_stats['evictions'],
            'max_persistent_size': self.max_persistent_size
        }

class HelpChatPerformanceMonitor:
    """Performance monitoring for help chat operations"""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.error_counts: Dict[str, int] = {}
        self.operation_stats: Dict[str, Dict[str, Any]] = {}
        self.start_time = datetime.now()
        self.max_response_times = 1000  # Keep last 1000 response times
    
    def record_operation(self, operation_type: str, duration_ms: float, 
                        success: bool = True, error_type: str = None):
        """Record operation performance metrics"""
        # Record response time
        self.response_times.append(duration_ms)
        if len(self.response_times) > self.max_response_times:
            self.response_times = self.response_times[-self.max_response_times:]
        
        # Record error if applicable
        if not success and error_type:
            self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Update operation statistics
        if operation_type not in self.operation_stats:
            self.operation_stats[operation_type] = {
                'total_requests': 0,
                'total_duration_ms': 0,
                'error_count': 0,
                'avg_duration_ms': 0,
                'min_duration_ms': float('inf'),
                'max_duration_ms': 0
            }
        
        stats = self.operation_stats[operation_type]
        stats['total_requests'] += 1
        stats['total_duration_ms'] += duration_ms
        stats['avg_duration_ms'] = stats['total_duration_ms'] / stats['total_requests']
        stats['min_duration_ms'] = min(stats['min_duration_ms'], duration_ms)
        stats['max_duration_ms'] = max(stats['max_duration_ms'], duration_ms)
        
        if not success:
            stats['error_count'] += 1
    
    def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        if not self.response_times:
            return PerformanceMetrics(last_updated=datetime.now())
        
        # Calculate statistics
        total_requests = len(self.response_times)
        avg_response_time = sum(self.response_times) / total_requests
        max_response_time = max(self.response_times)
        min_response_time = min(self.response_times)
        
        # Calculate 95th percentile
        sorted_times = sorted(self.response_times)
        p95_index = int(len(sorted_times) * 0.95)
        p95_response_time = sorted_times[p95_index] if p95_index < len(sorted_times) else 0
        
        # Calculate error count
        total_errors = sum(self.error_counts.values())
        
        return PerformanceMetrics(
            total_requests=total_requests,
            avg_response_time_ms=round(avg_response_time, 2),
            max_response_time_ms=round(max_response_time, 2),
            min_response_time_ms=round(min_response_time, 2),
            p95_response_time_ms=round(p95_response_time, 2),
            error_count=total_errors,
            last_updated=datetime.now()
        )
    
    def get_detailed_stats(self) -> Dict[str, Any]:
        """Get detailed performance statistics"""
        metrics = self.get_performance_metrics()
        
        return {
            'summary': asdict(metrics),
            'operation_stats': self.operation_stats,
            'error_breakdown': self.error_counts,
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds()
        }
    
    def reset_stats(self):
        """Reset all performance statistics"""
        self.response_times.clear()
        self.error_counts.clear()
        self.operation_stats.clear()
        self.start_time = datetime.now()

class HelpChatFallbackService:
    """Fallback service for when AI services are unavailable"""
    
    def __init__(self):
        self.fallback_responses = self._initialize_fallback_responses()
        self.usage_stats = {
            'total_fallbacks': 0,
            'fallback_by_type': {}
        }
    
    def _initialize_fallback_responses(self) -> Dict[str, FallbackResponse]:
        """Initialize predefined fallback responses"""
        return {
            'general': FallbackResponse(
                response="I'm currently experiencing technical difficulties. Here are some general resources that might help you navigate the PPM platform. You can also try asking your question again in a few moments.",
                confidence=0.3,
                sources=[],
                suggested_actions=[
                    {"id": "retry", "label": "Try Again", "action": "retry"},
                    {"id": "help_docs", "label": "View Help Documentation", "action": "navigate", "target": "/help"},
                    {"id": "contact_support", "label": "Contact Support", "action": "navigate", "target": "/feedback"}
                ]
            ),
            'navigation': FallbackResponse(
                response="For navigation help, you can use the main menu on the left side of the screen. Key sections include Dashboard, Projects, Portfolios, Resources, Financials, and Reports. Each section has its own submenu with specific features.",
                confidence=0.7,
                sources=[],
                suggested_actions=[
                    {"id": "dashboard", "label": "Go to Dashboard", "action": "navigate", "target": "/dashboard"},
                    {"id": "projects", "label": "View Projects", "action": "navigate", "target": "/projects"}
                ]
            ),
            'features': FallbackResponse(
                response="The PPM platform includes project management, portfolio oversight, resource allocation, budget tracking, risk assessment, and reporting features. Each feature is accessible through the main navigation menu.",
                confidence=0.6,
                sources=[],
                suggested_actions=[
                    {"id": "explore", "label": "Explore Features", "action": "navigate", "target": "/dashboard"},
                    {"id": "tutorials", "label": "View Tutorials", "action": "navigate", "target": "/help/tutorials"}
                ]
            ),
            'troubleshooting': FallbackResponse(
                response="For troubleshooting issues, please check your internet connection and try refreshing the page. If problems persist, you can submit feedback through the feedback system or contact support.",
                confidence=0.5,
                sources=[],
                suggested_actions=[
                    {"id": "refresh", "label": "Refresh Page", "action": "refresh"},
                    {"id": "feedback", "label": "Submit Feedback", "action": "navigate", "target": "/feedback"}
                ]
            )
        }
    
    def get_fallback_response(self, query: str, context: Dict[str, Any]) -> FallbackResponse:
        """Get appropriate fallback response based on query and context"""
        query_lower = query.lower()
        
        # Determine fallback type based on query content
        if any(word in query_lower for word in ['navigate', 'menu', 'find', 'where']):
            fallback_type = 'navigation'
        elif any(word in query_lower for word in ['feature', 'function', 'capability', 'what']):
            fallback_type = 'features'
        elif any(word in query_lower for word in ['error', 'problem', 'issue', 'broken', 'not working']):
            fallback_type = 'troubleshooting'
        else:
            fallback_type = 'general'
        
        # Record usage statistics
        self.usage_stats['total_fallbacks'] += 1
        self.usage_stats['fallback_by_type'][fallback_type] = \
            self.usage_stats['fallback_by_type'].get(fallback_type, 0) + 1
        
        return self.fallback_responses[fallback_type]
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get fallback service usage statistics"""
        return self.usage_stats.copy()

class HelpChatPerformanceService:
    """Main performance service that coordinates caching, monitoring, and fallbacks"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.cache = HelpChatCache()
        self.monitor = HelpChatPerformanceMonitor()
        self.fallback_service = HelpChatFallbackService()
        
        # Performance thresholds
        self.response_time_threshold_ms = 3000  # 3 seconds
        self.error_rate_threshold = 0.05  # 5%
        self.cache_hit_rate_threshold = 0.3  # 30%
    
    async def get_cached_response(self, query: str, context: Dict[str, Any], 
                                language: str = 'en') -> Optional[Any]:
        """Get cached response if available"""
        cache_key = self.cache._create_cache_key('help_query', query, context, language)
        return await self.cache.get(cache_key)
    
    async def cache_response(self, query: str, context: Dict[str, Any], 
                           response: Any, language: str = 'en', ttl: int = 300) -> bool:
        """Cache a response"""
        cache_key = self.cache._create_cache_key('help_query', query, context, language)
        return await self.cache.set(cache_key, response, ttl)
    
    async def record_operation_performance(self, operation_type: str, start_time: float, 
                                         success: bool = True, error_type: str = None):
        """Record performance metrics for an operation"""
        duration_ms = (time.time() - start_time) * 1000
        self.monitor.record_operation(operation_type, duration_ms, success, error_type)
    
    def should_use_fallback(self) -> bool:
        """Determine if fallback responses should be used based on performance"""
        metrics = self.monitor.get_performance_metrics()
        
        # Use fallback if response times are too high
        if metrics.avg_response_time_ms > self.response_time_threshold_ms:
            return True
        
        # Use fallback if error rate is too high
        if metrics.total_requests > 10:  # Only check after some requests
            error_rate = metrics.error_count / metrics.total_requests
            if error_rate > self.error_rate_threshold:
                return True
        
        return False
    
    async def get_fallback_response(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Get fallback response when AI service is unavailable"""
        fallback = self.fallback_service.get_fallback_response(query, context)
        
        # Record fallback usage
        self.monitor.record_operation('fallback_response', 50, True)  # Fast fallback
        
        return {
            'response': fallback.response,
            'sources': fallback.sources or [],
            'confidence': fallback.confidence,
            'suggested_actions': fallback.suggested_actions or [],
            'is_fallback': True,
            'fallback_reason': 'service_unavailable'
        }
    
    async def clear_cache_by_pattern(self, pattern: str) -> int:
        """Clear cached responses matching pattern"""
        return await self.cache.clear_pattern(pattern)
    
    async def get_performance_report(self) -> Dict[str, Any]:
        """Get comprehensive performance report"""
        cache_stats = self.cache.get_stats()
        performance_stats = self.monitor.get_detailed_stats()
        fallback_stats = self.fallback_service.get_usage_stats()
        
        # Calculate health score
        health_score = self._calculate_health_score(cache_stats, performance_stats)
        
        return {
            'health_score': health_score,
            'cache_performance': cache_stats,
            'response_performance': performance_stats,
            'fallback_usage': fallback_stats,
            'recommendations': self._generate_recommendations(cache_stats, performance_stats),
            'timestamp': datetime.now().isoformat()
        }
    
    def _calculate_health_score(self, cache_stats: Dict, performance_stats: Dict) -> float:
        """Calculate overall health score (0-100)"""
        score = 100.0
        
        # Deduct for low cache hit rate
        hit_rate = cache_stats.get('hit_rate_percent', 0) / 100
        if hit_rate < self.cache_hit_rate_threshold:
            score -= (self.cache_hit_rate_threshold - hit_rate) * 100
        
        # Deduct for high response times
        avg_response_time = performance_stats.get('summary', {}).get('avg_response_time_ms', 0)
        if avg_response_time > self.response_time_threshold_ms:
            score -= min(30, (avg_response_time - self.response_time_threshold_ms) / 100)
        
        # Deduct for errors
        total_requests = performance_stats.get('summary', {}).get('total_requests', 1)
        error_count = performance_stats.get('summary', {}).get('error_count', 0)
        error_rate = error_count / total_requests if total_requests > 0 else 0
        
        if error_rate > self.error_rate_threshold:
            score -= (error_rate - self.error_rate_threshold) * 500  # Heavy penalty for errors
        
        return max(0, min(100, score))
    
    def _generate_recommendations(self, cache_stats: Dict, performance_stats: Dict) -> List[str]:
        """Generate performance improvement recommendations"""
        recommendations = []
        
        # Cache recommendations
        hit_rate = cache_stats.get('hit_rate_percent', 0)
        if hit_rate < 30:
            recommendations.append("Consider increasing cache TTL or improving cache key strategy")
        
        # Performance recommendations
        avg_response_time = performance_stats.get('summary', {}).get('avg_response_time_ms', 0)
        if avg_response_time > 2000:
            recommendations.append("Response times are high - consider optimizing AI model calls")
        
        # Error recommendations
        error_count = performance_stats.get('summary', {}).get('error_count', 0)
        if error_count > 0:
            recommendations.append("Investigate and resolve recurring errors")
        
        # Fallback recommendations
        fallback_count = performance_stats.get('fallback_usage', {}).get('total_fallbacks', 0)
        if fallback_count > 10:
            recommendations.append("High fallback usage detected - check AI service availability")
        
        return recommendations

# Global instance (will be initialized in main app)
help_chat_performance: Optional[HelpChatPerformanceService] = None

def get_help_chat_performance() -> HelpChatPerformanceService:
    """Get the global help chat performance service instance"""
    global help_chat_performance
    if help_chat_performance is None:
        raise RuntimeError("Help chat performance service not initialized")
    return help_chat_performance

def initialize_help_chat_performance(supabase_client: Client) -> HelpChatPerformanceService:
    """Initialize the global help chat performance service"""
    global help_chat_performance
    help_chat_performance = HelpChatPerformanceService(supabase_client)
    return help_chat_performance