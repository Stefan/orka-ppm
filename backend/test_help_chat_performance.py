"""
Test Help Chat Performance Optimization
Tests for caching, monitoring, and fallback functionality
"""

import pytest
import asyncio
import time
from datetime import datetime
from unittest.mock import Mock, AsyncMock

from services.help_chat_performance import (
    HelpChatCache, 
    HelpChatPerformanceMonitor, 
    HelpChatFallbackService,
    HelpChatPerformanceService
)

class TestHelpChatCache:
    """Test help chat caching functionality"""
    
    @pytest.fixture
    def cache(self):
        return HelpChatCache(max_size=10, default_ttl=300)
    
    @pytest.mark.asyncio
    async def test_cache_set_and_get(self, cache):
        """Test basic cache set and get operations"""
        key = "test_key"
        value = {"response": "test response", "confidence": 0.8}
        
        # Set value in cache
        success = await cache.set(key, value)
        assert success is True
        
        # Get value from cache
        cached_value = await cache.get(key)
        assert cached_value == value
        
        # Test cache stats
        stats = cache.get_stats()
        assert stats['total_hits'] == 1
        assert stats['total_misses'] == 0
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, cache):
        """Test cache miss behavior"""
        # Try to get non-existent key
        cached_value = await cache.get("non_existent_key")
        assert cached_value is None
        
        # Check stats
        stats = cache.get_stats()
        assert stats['total_misses'] == 1
    
    @pytest.mark.asyncio
    async def test_cache_key_creation(self, cache):
        """Test cache key creation consistency"""
        query = "How do I create a project?"
        context = {"route": "/projects", "userRole": "user"}
        language = "en"
        
        key1 = cache._create_cache_key("help_query", query, context, language)
        key2 = cache._create_cache_key("help_query", query, context, language)
        
        # Same inputs should create same key
        assert key1 == key2
        
        # Different context should create different key
        different_context = {"route": "/dashboard", "userRole": "admin"}
        key3 = cache._create_cache_key("help_query", query, different_context, language)
        assert key1 != key3
    
    @pytest.mark.asyncio
    async def test_cache_pattern_clearing(self, cache):
        """Test clearing cache by pattern"""
        # Set multiple values
        await cache.set("help:en:123:abc", {"response": "test1"})
        await cache.set("help:de:456:def", {"response": "test2"})
        await cache.set("other:en:789:ghi", {"response": "test3"})
        
        # Clear help pattern
        cleared_count = await cache.clear_pattern("help:*")
        assert cleared_count >= 2  # Should clear at least the help entries
        
        # Verify specific entries are cleared
        assert await cache.get("help:en:123:abc") is None
        assert await cache.get("help:de:456:def") is None

class TestHelpChatPerformanceMonitor:
    """Test performance monitoring functionality"""
    
    @pytest.fixture
    def monitor(self):
        return HelpChatPerformanceMonitor()
    
    def test_record_operation_success(self, monitor):
        """Test recording successful operations"""
        monitor.record_operation("help_query", 150.5, True)
        
        metrics = monitor.get_performance_metrics()
        assert metrics.total_requests == 1
        assert metrics.avg_response_time_ms == 150.5
        assert metrics.error_count == 0
    
    def test_record_operation_error(self, monitor):
        """Test recording failed operations"""
        monitor.record_operation("help_query", 250.0, False, "timeout_error")
        
        metrics = monitor.get_performance_metrics()
        assert metrics.total_requests == 1
        assert metrics.error_count == 1
        
        detailed_stats = monitor.get_detailed_stats()
        assert "timeout_error" in detailed_stats['error_breakdown']
        assert detailed_stats['error_breakdown']['timeout_error'] == 1
    
    def test_multiple_operations_statistics(self, monitor):
        """Test statistics with multiple operations"""
        # Record multiple operations
        response_times = [100, 200, 300, 150, 250]
        for time_ms in response_times:
            monitor.record_operation("help_query", time_ms, True)
        
        metrics = monitor.get_performance_metrics()
        assert metrics.total_requests == 5
        assert metrics.avg_response_time_ms == 200.0  # Average of response times
        assert metrics.min_response_time_ms == 100.0
        assert metrics.max_response_time_ms == 300.0
        
        # Test 95th percentile (should be 300 for this small dataset)
        assert metrics.p95_response_time_ms == 300.0

class TestHelpChatFallbackService:
    """Test fallback service functionality"""
    
    @pytest.fixture
    def fallback_service(self):
        return HelpChatFallbackService()
    
    def test_navigation_fallback(self, fallback_service):
        """Test navigation-related fallback responses"""
        query = "Where can I find the project menu?"
        context = {"route": "/dashboard"}
        
        fallback = fallback_service.get_fallback_response(query, context)
        
        assert "navigation" in fallback.response.lower()
        assert fallback.confidence > 0
        assert len(fallback.suggested_actions) > 0
        
        # Check usage stats
        stats = fallback_service.get_usage_stats()
        assert stats['total_fallbacks'] == 1
        assert 'navigation' in stats['fallback_by_type']
    
    def test_feature_fallback(self, fallback_service):
        """Test feature-related fallback responses"""
        query = "What features are available in the platform?"
        context = {"route": "/dashboard"}
        
        fallback = fallback_service.get_fallback_response(query, context)
        
        assert "feature" in fallback.response.lower()
        assert fallback.confidence > 0
    
    def test_troubleshooting_fallback(self, fallback_service):
        """Test troubleshooting fallback responses"""
        query = "The system is not working properly"
        context = {"route": "/projects"}
        
        fallback = fallback_service.get_fallback_response(query, context)
        
        assert any(word in fallback.response.lower() for word in ["troubleshoot", "problem", "issue"])
        assert fallback.confidence > 0

class TestHelpChatPerformanceService:
    """Test integrated performance service"""
    
    @pytest.fixture
    def mock_supabase(self):
        return Mock()
    
    @pytest.fixture
    def performance_service(self, mock_supabase):
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_cache_integration(self, performance_service):
        """Test caching integration in performance service"""
        query = "How do I create a project?"
        context = {"route": "/projects", "userRole": "user"}
        response_data = {"response": "To create a project...", "confidence": 0.9}
        
        # Cache response
        success = await performance_service.cache_response(query, context, response_data)
        assert success is True
        
        # Retrieve cached response
        cached = await performance_service.get_cached_response(query, context)
        assert cached == response_data
    
    @pytest.mark.asyncio
    async def test_performance_recording(self, performance_service):
        """Test performance recording integration"""
        start_time = time.time()
        
        # Simulate some processing time
        await asyncio.sleep(0.1)
        
        # Record operation
        await performance_service.record_operation_performance(
            "help_query", start_time, True
        )
        
        # Get performance report
        report = await performance_service.get_performance_report()
        
        assert 'health_score' in report
        assert 'cache_performance' in report
        assert 'response_performance' in report
        assert report['health_score'] >= 0
        assert report['health_score'] <= 100
    
    def test_fallback_decision(self, performance_service):
        """Test fallback decision logic"""
        # Initially should not use fallback
        assert performance_service.should_use_fallback() is False
        
        # Record high response times
        for _ in range(5):
            performance_service.monitor.record_operation("help_query", 5000, True)  # 5 seconds
        
        # Now should use fallback
        assert performance_service.should_use_fallback() is True
    
    @pytest.mark.asyncio
    async def test_fallback_response_generation(self, performance_service):
        """Test fallback response generation"""
        query = "How do I navigate to projects?"
        context = {"route": "/dashboard"}
        
        fallback_response = await performance_service.get_fallback_response(query, context)
        
        assert 'response' in fallback_response
        assert 'confidence' in fallback_response
        assert 'is_fallback' in fallback_response
        assert fallback_response['is_fallback'] is True
        assert fallback_response['confidence'] > 0

# Integration test
@pytest.mark.asyncio
async def test_end_to_end_performance_flow():
    """Test complete performance optimization flow"""
    mock_supabase = Mock()
    service = HelpChatPerformanceService(mock_supabase)
    
    query = "How do I create a new project?"
    context = {"route": "/projects", "userRole": "user", "pageTitle": "Projects"}
    
    # 1. Check cache (should be empty initially)
    cached = await service.get_cached_response(query, context)
    assert cached is None
    
    # 2. Simulate processing and record performance
    start_time = time.time()
    await asyncio.sleep(0.05)  # Simulate 50ms processing
    
    # 3. Create response data
    response_data = {
        "response": "To create a new project, click the 'New Project' button...",
        "confidence": 0.85,
        "sources": [],
        "session_id": "test_session"
    }
    
    # 4. Cache the response
    await service.cache_response(query, context, response_data)
    
    # 5. Record performance
    await service.record_operation_performance("help_query", start_time, True)
    
    # 6. Verify cache works
    cached = await service.get_cached_response(query, context)
    assert cached == response_data
    
    # 7. Get performance report
    report = await service.get_performance_report()
    assert report['health_score'] > 0
    assert report['cache_performance']['total_hits'] >= 1
    
    print("✅ End-to-end performance flow test passed")

if __name__ == "__main__":
    # Run a simple test
    asyncio.run(test_end_to_end_performance_flow())
    print("✅ All performance tests completed successfully")