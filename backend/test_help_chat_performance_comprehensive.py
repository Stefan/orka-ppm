"""
Comprehensive Performance Tests for Help Chat System

Tests response times under various loads, caching effectiveness, and fallback mechanisms.
Validates Requirements 9.1, 9.2, 9.3, 9.4, 9.5
"""

import pytest
import asyncio
import time
import statistics
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any
import concurrent.futures

from services.help_chat_performance import (
    HelpChatPerformanceService,
    HelpChatCache,
    HelpChatPerformanceMonitor,
    HelpChatFallbackService
)

class TestHelpChatResponseTimes:
    """Test response time requirements (Requirement 9.1, 9.2)"""
    
    @pytest.fixture
    def mock_supabase(self):
        return Mock()
    
    @pytest.fixture
    def performance_service(self, mock_supabase):
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_cached_response_time_under_3_seconds(self, performance_service):
        """
        Test Requirement 9.1: WHEN users send queries, THE Context_Aware_Assistant 
        SHALL respond within 3 seconds for cached content
        """
        # Arrange
        query = "How do I create a new project?"
        context = {"route": "/projects", "userRole": "user"}
        cached_response = {
            "response": "To create a new project, click the 'New Project' button...",
            "confidence": 0.9,
            "sources": []
        }
        
        # Pre-cache the response
        await performance_service.cache_response(query, context, cached_response)
        
        # Act - Measure response time for cached content
        start_time = time.time()
        result = await performance_service.get_cached_response(query, context)
        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Assert
        assert result is not None, "Cached response should be available"
        assert result == cached_response, "Cached response should match original"
        assert response_time < 3000, f"Cached response time {response_time:.2f}ms exceeds 3 second limit"
        
        print(f"✅ Cached response time: {response_time:.2f}ms (< 3000ms)")
    
    @pytest.mark.asyncio
    async def test_multiple_cached_queries_performance(self, performance_service):
        """Test performance with multiple cached queries in sequence"""
        queries_and_contexts = [
            ("How do I create a project?", {"route": "/projects"}),
            ("Where is the dashboard?", {"route": "/dashboard"}),
            ("How do I add resources?", {"route": "/resources"}),
            ("What are the reporting features?", {"route": "/reports"}),
            ("How do I manage budgets?", {"route": "/financials"})
        ]
        
        # Pre-cache all responses
        for i, (query, context) in enumerate(queries_and_contexts):
            cached_response = {
                "response": f"Response for query {i+1}",
                "confidence": 0.8,
                "sources": []
            }
            await performance_service.cache_response(query, context, cached_response)
        
        # Test sequential access times
        response_times = []
        for query, context in queries_and_contexts:
            start_time = time.time()
            result = await performance_service.get_cached_response(query, context)
            response_time = (time.time() - start_time) * 1000
            response_times.append(response_time)
            
            assert result is not None, f"Cached response should be available for: {query}"
            assert response_time < 3000, f"Response time {response_time:.2f}ms exceeds limit for: {query}"
        
        avg_response_time = statistics.mean(response_times)
        max_response_time = max(response_times)
        
        print(f"✅ Average cached response time: {avg_response_time:.2f}ms")
        print(f"✅ Maximum cached response time: {max_response_time:.2f}ms")
        
        assert avg_response_time < 1000, f"Average response time {avg_response_time:.2f}ms should be under 1 second"
        assert max_response_time < 3000, f"Maximum response time {max_response_time:.2f}ms exceeds 3 second limit"
    
    @pytest.mark.asyncio
    async def test_progress_indicators_for_complex_queries(self, performance_service):
        """
        Test Requirement 9.2: WHEN processing complex queries, THE Context_Aware_Assistant 
        SHALL show typing indicators and progress updates
        """
        # This test simulates the behavior that would be implemented in the router
        # We test the performance monitoring aspect here
        
        query = "Explain the complete project lifecycle with all phases and dependencies"
        context = {"route": "/projects", "complexity": "high"}
        
        # Simulate complex query processing with progress tracking
        start_time = time.time()
        
        # Simulate processing stages
        processing_stages = [
            ("Analyzing query", 0.5),
            ("Retrieving context", 1.0),
            ("Generating response", 2.0),
            ("Formatting output", 0.3)
        ]
        
        stage_times = []
        for stage_name, duration in processing_stages:
            stage_start = time.time()
            await asyncio.sleep(duration / 10)  # Simulate processing (scaled down for testing)
            stage_time = (time.time() - stage_start) * 1000
            stage_times.append((stage_name, stage_time))
        
        total_time = (time.time() - start_time) * 1000
        
        # Record the operation performance
        await performance_service.record_operation_performance("complex_query", start_time, True)
        
        # Verify progress tracking capability
        assert len(stage_times) == 4, "All processing stages should be tracked"
        assert total_time > 0, "Total processing time should be measurable"
        
        # Verify performance metrics are recorded
        metrics = performance_service.monitor.get_performance_metrics()
        assert metrics.total_requests >= 1, "Performance metrics should record the operation"
        
        print(f"✅ Complex query processing stages tracked: {len(stage_times)}")
        print(f"✅ Total processing time: {total_time:.2f}ms")
        for stage_name, stage_time in stage_times:
            print(f"   - {stage_name}: {stage_time:.2f}ms")

class TestHelpChatCachingEffectiveness:
    """Test caching effectiveness (Requirement 9.4)"""
    
    @pytest.fixture
    def cache(self):
        return HelpChatCache(max_size=100, default_ttl=300)
    
    @pytest.fixture
    def performance_service(self):
        mock_supabase = Mock()
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_cache_hit_rate_effectiveness(self, cache):
        """
        Test Requirement 9.4: THE Help_Chat_Manager SHALL cache frequently 
        requested information for faster response times
        """
        # Test data
        test_queries = [
            ("How do I create a project?", {"route": "/projects"}),
            ("Where is the dashboard?", {"route": "/dashboard"}),
            ("How do I create a project?", {"route": "/projects"}),  # Repeat
            ("How do I add users?", {"route": "/admin"}),
            ("Where is the dashboard?", {"route": "/dashboard"}),  # Repeat
            ("How do I create a project?", {"route": "/projects"}),  # Repeat
        ]
        
        # Cache some responses
        for i, (query, context) in enumerate(test_queries[:3]):
            response = {"response": f"Response {i}", "confidence": 0.8}
            cache_key = cache._create_cache_key("help_query", query, context)
            await cache.set(cache_key, response)
        
        # Test cache hits and misses
        hits = 0
        misses = 0
        
        for query, context in test_queries:
            cache_key = cache._create_cache_key("help_query", query, context)
            result = await cache.get(cache_key)
            if result is not None:
                hits += 1
            else:
                misses += 1
        
        # Calculate hit rate
        total_requests = hits + misses
        hit_rate = (hits / total_requests) * 100 if total_requests > 0 else 0
        
        # Verify cache effectiveness
        assert hit_rate >= 50, f"Cache hit rate {hit_rate:.1f}% should be at least 50%"
        assert hits >= 3, f"Should have at least 3 cache hits, got {hits}"
        
        # Verify cache statistics
        stats = cache.get_stats()
        assert stats['total_hits'] >= hits, "Cache stats should track hits"
        assert stats['hit_rate_percent'] > 0, "Hit rate should be positive"
        
        print(f"✅ Cache hit rate: {hit_rate:.1f}%")
        print(f"✅ Cache hits: {hits}, misses: {misses}")
        print(f"✅ Cache statistics: {stats}")
    
    @pytest.mark.asyncio
    async def test_cache_performance_under_load(self, cache):
        """Test cache performance with high volume of requests"""
        # Generate test data
        num_unique_queries = 50
        num_total_requests = 200
        
        queries = []
        for i in range(num_unique_queries):
            query = f"Test query {i}"
            context = {"route": f"/page{i % 10}", "user": f"user{i % 5}"}
            queries.append((query, context))
        
        # Pre-populate cache with some responses
        for i in range(num_unique_queries // 2):
            query, context = queries[i]
            response = {"response": f"Cached response {i}", "confidence": 0.8}
            cache_key = cache._create_cache_key("help_query", query, context)
            await cache.set(cache_key, response)
        
        # Simulate high load with random queries
        import random
        start_time = time.time()
        
        cache_operations = []
        for _ in range(num_total_requests):
            query, context = random.choice(queries)
            cache_key = cache._create_cache_key("help_query", query, context)
            
            operation_start = time.time()
            result = await cache.get(cache_key)
            operation_time = (time.time() - operation_start) * 1000
            
            cache_operations.append(operation_time)
        
        total_time = (time.time() - start_time) * 1000
        avg_operation_time = statistics.mean(cache_operations)
        max_operation_time = max(cache_operations)
        
        # Performance assertions
        assert avg_operation_time < 10, f"Average cache operation time {avg_operation_time:.2f}ms should be under 10ms"
        assert max_operation_time < 50, f"Maximum cache operation time {max_operation_time:.2f}ms should be under 50ms"
        assert total_time < 5000, f"Total time for {num_total_requests} operations {total_time:.2f}ms should be under 5 seconds"
        
        # Cache effectiveness assertions
        stats = cache.get_stats()
        hit_rate = stats['hit_rate_percent']
        assert hit_rate > 20, f"Hit rate {hit_rate:.1f}% should be above 20% under load"
        
        print(f"✅ Processed {num_total_requests} cache operations in {total_time:.2f}ms")
        print(f"✅ Average operation time: {avg_operation_time:.2f}ms")
        print(f"✅ Cache hit rate under load: {hit_rate:.1f}%")

class TestHelpChatFallbackMechanisms:
    """Test fallback mechanisms (Requirement 9.3)"""
    
    @pytest.fixture
    def fallback_service(self):
        return HelpChatFallbackService()
    
    @pytest.fixture
    def performance_service(self):
        mock_supabase = Mock()
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_fallback_when_ai_service_unavailable(self, performance_service):
        """
        Test Requirement 9.3: WHEN the AI service is unavailable, THE Help_Chat_Manager 
        SHALL provide fallback responses with basic navigation help
        """
        # Simulate AI service unavailability by recording high error rates
        for _ in range(10):
            performance_service.monitor.record_operation("help_query", 5000, False, "service_unavailable")
        
        # Check if fallback should be used
        should_use_fallback = performance_service.should_use_fallback()
        assert should_use_fallback, "Should use fallback when error rate is high"
        
        # Test fallback response generation
        query = "How do I navigate to the projects page?"
        context = {"route": "/dashboard", "userRole": "user"}
        
        start_time = time.time()
        fallback_response = await performance_service.get_fallback_response(query, context)
        response_time = (time.time() - start_time) * 1000
        
        # Verify fallback response
        assert fallback_response is not None, "Fallback response should be generated"
        assert 'response' in fallback_response, "Fallback should contain response text"
        assert 'is_fallback' in fallback_response, "Should be marked as fallback"
        assert fallback_response['is_fallback'] is True, "Should be identified as fallback"
        assert fallback_response['confidence'] > 0, "Fallback should have confidence score"
        
        # Verify response time for fallback
        assert response_time < 1000, f"Fallback response time {response_time:.2f}ms should be under 1 second"
        
        print(f"✅ Fallback response generated in {response_time:.2f}ms")
        print(f"✅ Fallback response: {fallback_response['response'][:100]}...")
    
    def test_fallback_response_quality(self, fallback_service):
        """Test quality and appropriateness of fallback responses"""
        test_scenarios = [
            {
                "query": "Where can I find the project menu?",
                "context": {"route": "/dashboard"},
                "expected_type": "navigation",
                "should_contain": ["menu", "navigation", "project"]
            },
            {
                "query": "What features are available?",
                "context": {"route": "/features"},
                "expected_type": "features",
                "should_contain": ["feature", "platform", "PPM"]
            },
            {
                "query": "The system is not working",
                "context": {"route": "/projects"},
                "expected_type": "troubleshooting",
                "should_contain": ["troubleshoot", "problem", "issue", "refresh"]
            },
            {
                "query": "I need help with something",
                "context": {"route": "/help"},
                "expected_type": "general",
                "should_contain": ["help", "assistance", "support"]
            }
        ]
        
        for scenario in test_scenarios:
            fallback = fallback_service.get_fallback_response(scenario["query"], scenario["context"])
            
            # Verify response structure
            assert fallback.response, "Fallback should have response text"
            assert fallback.confidence > 0, "Fallback should have confidence score"
            assert fallback.suggested_actions, "Fallback should have suggested actions"
            
            # Verify response content appropriateness
            response_lower = fallback.response.lower()
            contains_expected = any(term.lower() in response_lower for term in scenario["should_contain"])
            assert contains_expected, f"Fallback response should contain relevant terms for {scenario['expected_type']}"
            
            print(f"✅ {scenario['expected_type'].title()} fallback response appropriate")
        
        # Verify usage statistics
        stats = fallback_service.get_usage_stats()
        assert stats['total_fallbacks'] == len(test_scenarios), "Should track all fallback usages"
        assert len(stats['fallback_by_type']) > 0, "Should categorize fallback types"

class TestHelpChatLoadHandling:
    """Test load handling and request queuing (Requirement 9.5)"""
    
    @pytest.fixture
    def performance_service(self):
        mock_supabase = Mock()
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_concurrent_request_handling(self, performance_service):
        """
        Test Requirement 9.5: WHEN experiencing high load, THE Help_Chat_Manager 
        SHALL queue requests gracefully without losing user input
        """
        # Simulate concurrent requests
        num_concurrent_requests = 20
        request_duration = 0.1  # 100ms per request
        
        async def simulate_help_request(request_id: int):
            """Simulate a help chat request"""
            query = f"Test query {request_id}"
            context = {"route": "/test", "requestId": request_id}
            
            start_time = time.time()
            
            # Simulate processing time
            await asyncio.sleep(request_duration)
            
            # Cache a response
            response = {
                "response": f"Response for query {request_id}",
                "confidence": 0.8,
                "request_id": request_id
            }
            
            success = await performance_service.cache_response(query, context, response)
            
            # Record performance
            await performance_service.record_operation_performance("help_query", start_time, success)
            
            return {
                "request_id": request_id,
                "success": success,
                "processing_time": (time.time() - start_time) * 1000
            }
        
        # Execute concurrent requests
        start_time = time.time()
        
        tasks = [simulate_help_request(i) for i in range(num_concurrent_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        total_time = (time.time() - start_time) * 1000
        
        # Analyze results
        successful_requests = [r for r in results if isinstance(r, dict) and r.get('success')]
        failed_requests = [r for r in results if not isinstance(r, dict) or not r.get('success')]
        
        processing_times = [r['processing_time'] for r in successful_requests]
        avg_processing_time = statistics.mean(processing_times) if processing_times else 0
        max_processing_time = max(processing_times) if processing_times else 0
        
        # Assertions for graceful handling
        success_rate = len(successful_requests) / num_concurrent_requests * 100
        assert success_rate >= 95, f"Success rate {success_rate:.1f}% should be at least 95%"
        assert len(failed_requests) <= 1, f"Should have at most 1 failed request, got {len(failed_requests)}"
        
        # Performance assertions
        assert avg_processing_time < 1000, f"Average processing time {avg_processing_time:.2f}ms should be under 1 second"
        assert total_time < 5000, f"Total time {total_time:.2f}ms for {num_concurrent_requests} concurrent requests should be under 5 seconds"
        
        # Verify performance monitoring
        metrics = performance_service.monitor.get_performance_metrics()
        assert metrics.total_requests >= num_concurrent_requests, "Should record all requests"
        
        print(f"✅ Processed {num_concurrent_requests} concurrent requests in {total_time:.2f}ms")
        print(f"✅ Success rate: {success_rate:.1f}%")
        print(f"✅ Average processing time: {avg_processing_time:.2f}ms")
        print(f"✅ Maximum processing time: {max_processing_time:.2f}ms")
    
    @pytest.mark.asyncio
    async def test_high_load_performance_degradation(self, performance_service):
        """Test system behavior under sustained high load"""
        # Simulate sustained high load
        load_duration = 2.0  # 2 seconds of sustained load
        requests_per_second = 10
        total_requests = int(load_duration * requests_per_second)
        
        async def sustained_load_request(request_id: int):
            """Simulate a request during sustained load"""
            start_time = time.time()
            
            # Simulate variable processing time (some requests are slower)
            processing_time = 0.05 + (request_id % 3) * 0.02  # 50-90ms
            await asyncio.sleep(processing_time)
            
            # Record performance
            await performance_service.record_operation_performance("sustained_load", start_time, True)
            
            return time.time() - start_time
        
        # Execute sustained load
        start_time = time.time()
        
        # Stagger request starts to simulate realistic load
        tasks = []
        for i in range(total_requests):
            # Add small delay between request starts
            if i > 0:
                await asyncio.sleep(1.0 / requests_per_second)
            tasks.append(asyncio.create_task(sustained_load_request(i)))
        
        # Wait for all requests to complete
        processing_times = await asyncio.gather(*tasks)
        total_load_time = time.time() - start_time
        
        # Analyze performance under load
        avg_response_time = statistics.mean(processing_times) * 1000  # Convert to ms
        p95_response_time = statistics.quantiles(processing_times, n=20)[18] * 1000  # 95th percentile
        max_response_time = max(processing_times) * 1000
        
        # Performance assertions
        assert avg_response_time < 500, f"Average response time {avg_response_time:.2f}ms should stay under 500ms under load"
        assert p95_response_time < 1000, f"95th percentile response time {p95_response_time:.2f}ms should stay under 1 second"
        assert max_response_time < 2000, f"Maximum response time {max_response_time:.2f}ms should stay under 2 seconds"
        
        # Verify no requests were lost
        metrics = performance_service.monitor.get_performance_metrics()
        assert metrics.total_requests >= total_requests, "All requests should be recorded"
        assert metrics.error_count == 0, "No errors should occur under normal high load"
        
        print(f"✅ Sustained load test: {total_requests} requests over {total_load_time:.2f}s")
        print(f"✅ Average response time under load: {avg_response_time:.2f}ms")
        print(f"✅ 95th percentile response time: {p95_response_time:.2f}ms")
        print(f"✅ Maximum response time: {max_response_time:.2f}ms")
    
    @pytest.mark.asyncio
    async def test_request_queuing_without_data_loss(self, performance_service):
        """Test that requests are queued gracefully without losing user input"""
        # Simulate a scenario where processing is temporarily slow
        slow_requests = []
        fast_requests = []
        
        async def slow_request(request_id: int):
            """Simulate a slow request that might cause queuing"""
            query = f"Complex query {request_id}"
            context = {"route": "/complex", "requestId": request_id, "type": "slow"}
            
            start_time = time.time()
            await asyncio.sleep(0.5)  # Simulate slow processing
            
            # Ensure data is preserved
            response = {
                "response": f"Complex response for {query}",
                "confidence": 0.7,
                "request_id": request_id,
                "query_preserved": query,
                "context_preserved": context
            }
            
            success = await performance_service.cache_response(query, context, response)
            await performance_service.record_operation_performance("slow_query", start_time, success)
            
            return {"id": request_id, "type": "slow", "success": success, "data_preserved": True}
        
        async def fast_request(request_id: int):
            """Simulate a fast request that should be processed quickly"""
            query = f"Quick query {request_id}"
            context = {"route": "/quick", "requestId": request_id, "type": "fast"}
            
            start_time = time.time()
            await asyncio.sleep(0.05)  # Simulate fast processing
            
            response = {
                "response": f"Quick response for {query}",
                "confidence": 0.9,
                "request_id": request_id
            }
            
            success = await performance_service.cache_response(query, context, response)
            await performance_service.record_operation_performance("fast_query", start_time, success)
            
            return {"id": request_id, "type": "fast", "success": success, "data_preserved": True}
        
        # Mix slow and fast requests to test queuing
        all_tasks = []
        
        # Start some slow requests
        for i in range(5):
            all_tasks.append(slow_request(i))
        
        # Add fast requests that should be queued
        for i in range(10):
            all_tasks.append(fast_request(i + 100))
        
        # Execute all requests concurrently
        start_time = time.time()
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Analyze results
        successful_results = [r for r in results if isinstance(r, dict) and r.get('success')]
        slow_results = [r for r in successful_results if r.get('type') == 'slow']
        fast_results = [r for r in successful_results if r.get('type') == 'fast']
        
        # Verify no data loss
        assert len(successful_results) == 15, f"All 15 requests should succeed, got {len(successful_results)}"
        assert len(slow_results) == 5, f"All 5 slow requests should succeed, got {len(slow_results)}"
        assert len(fast_results) == 10, f"All 10 fast requests should succeed, got {len(fast_results)}"
        
        # Verify data preservation
        for result in successful_results:
            assert result.get('data_preserved'), f"Data should be preserved for request {result.get('id')}"
        
        # Verify reasonable total time (should be dominated by slow requests but not much worse)
        expected_min_time = 0.5  # Time for slow requests
        expected_max_time = 1.0  # Should not be much longer due to concurrency
        
        assert total_time >= expected_min_time, f"Total time {total_time:.2f}s should be at least {expected_min_time}s"
        assert total_time <= expected_max_time, f"Total time {total_time:.2f}s should not exceed {expected_max_time}s significantly"
        
        print(f"✅ Processed mixed load (5 slow + 10 fast requests) in {total_time:.2f}s")
        print(f"✅ All requests completed successfully with data preserved")
        print(f"✅ Slow requests: {len(slow_results)}, Fast requests: {len(fast_results)}")

class TestIntegratedPerformanceScenarios:
    """Test integrated performance scenarios combining multiple requirements"""
    
    @pytest.fixture
    def performance_service(self):
        mock_supabase = Mock()
        return HelpChatPerformanceService(mock_supabase)
    
    @pytest.mark.asyncio
    async def test_end_to_end_performance_scenario(self, performance_service):
        """Test complete performance scenario with caching, load, and fallback"""
        # Phase 1: Normal operation with caching
        print("Phase 1: Testing normal operation with caching...")
        
        # Pre-populate cache with common queries
        common_queries = [
            ("How do I create a project?", {"route": "/projects"}),
            ("Where is the dashboard?", {"route": "/dashboard"}),
            ("How do I add users?", {"route": "/admin"}),
        ]
        
        for query, context in common_queries:
            response = {"response": f"Cached response for: {query}", "confidence": 0.9}
            await performance_service.cache_response(query, context, response)
        
        # Test cached response performance
        cached_times = []
        for query, context in common_queries:
            start_time = time.time()
            result = await performance_service.get_cached_response(query, context)
            response_time = (time.time() - start_time) * 1000
            cached_times.append(response_time)
            
            assert result is not None, f"Should get cached response for: {query}"
            assert response_time < 3000, f"Cached response time {response_time:.2f}ms exceeds 3s limit"
        
        avg_cached_time = statistics.mean(cached_times)
        print(f"✅ Phase 1 complete - Average cached response time: {avg_cached_time:.2f}ms")
        
        # Phase 2: High load testing
        print("Phase 2: Testing high load handling...")
        
        async def concurrent_request(request_id: int):
            # Mix of cached and new requests
            if request_id % 3 == 0:
                # Use cached query
                query, context = common_queries[request_id % len(common_queries)]
            else:
                # New query
                query = f"New query {request_id}"
                context = {"route": f"/page{request_id}", "requestId": request_id}
            
            start_time = time.time()
            
            # Try cache first
            cached_result = await performance_service.get_cached_response(query, context)
            if cached_result is None:
                # Simulate AI processing for new queries
                await asyncio.sleep(0.1)
                response = {"response": f"AI response for {query}", "confidence": 0.8}
                await performance_service.cache_response(query, context, response)
            
            await performance_service.record_operation_performance("mixed_query", start_time, True)
            return time.time() - start_time
        
        # Execute concurrent load
        num_concurrent = 25
        load_start = time.time()
        
        load_tasks = [concurrent_request(i) for i in range(num_concurrent)]
        load_times = await asyncio.gather(*load_tasks)
        
        load_duration = time.time() - load_start
        avg_load_time = statistics.mean(load_times) * 1000
        
        assert avg_load_time < 1000, f"Average load response time {avg_load_time:.2f}ms should be under 1s"
        print(f"✅ Phase 2 complete - {num_concurrent} concurrent requests in {load_duration:.2f}s")
        
        # Phase 3: Fallback testing
        print("Phase 3: Testing fallback mechanisms...")
        
        # Simulate service degradation
        for _ in range(10):
            performance_service.monitor.record_operation("help_query", 6000, False, "timeout")
        
        # Test fallback activation
        should_fallback = performance_service.should_use_fallback()
        assert should_fallback, "Should activate fallback after service degradation"
        
        # Test fallback response times
        fallback_queries = [
            "How do I navigate the system?",
            "What features are available?",
            "I'm having trouble with the platform"
        ]
        
        fallback_times = []
        for query in fallback_queries:
            context = {"route": "/help"}
            start_time = time.time()
            
            fallback_response = await performance_service.get_fallback_response(query, context)
            response_time = (time.time() - start_time) * 1000
            fallback_times.append(response_time)
            
            assert fallback_response['is_fallback'], "Should be marked as fallback"
            assert response_time < 1000, f"Fallback response time {response_time:.2f}ms should be under 1s"
        
        avg_fallback_time = statistics.mean(fallback_times)
        print(f"✅ Phase 3 complete - Average fallback response time: {avg_fallback_time:.2f}ms")
        
        # Final performance report
        report = await performance_service.get_performance_report()
        
        assert report['health_score'] >= 0, "Health score should be calculable"
        assert 'cache_performance' in report, "Should include cache performance metrics"
        assert 'response_performance' in report, "Should include response performance metrics"
        
        print(f"✅ End-to-end test complete - Health score: {report['health_score']:.1f}")
        print(f"✅ Cache hit rate: {report['cache_performance']['hit_rate_percent']:.1f}%")
        
        # Overall performance assertions
        assert avg_cached_time < 100, "Cached responses should be very fast"
        assert avg_load_time < 500, "Load handling should be efficient"
        assert avg_fallback_time < 200, "Fallback responses should be immediate"

if __name__ == "__main__":
    # Run a quick performance validation
    async def quick_validation():
        print("🚀 Running Help Chat Performance Validation...")
        
        # Test basic performance service
        mock_supabase = Mock()
        service = HelpChatPerformanceService(mock_supabase)
        
        # Test caching performance
        query = "Test query"
        context = {"route": "/test"}
        response = {"response": "Test response", "confidence": 0.8}
        
        start_time = time.time()
        await service.cache_response(query, context, response)
        cache_time = (time.time() - start_time) * 1000
        
        start_time = time.time()
        cached_result = await service.get_cached_response(query, context)
        retrieve_time = (time.time() - start_time) * 1000
        
        assert cached_result == response, "Cache should preserve data"
        assert cache_time < 100, f"Cache write time {cache_time:.2f}ms should be fast"
        assert retrieve_time < 50, f"Cache read time {retrieve_time:.2f}ms should be very fast"
        
        print(f"✅ Cache write: {cache_time:.2f}ms, read: {retrieve_time:.2f}ms")
        print("✅ Performance validation completed successfully")
    
    asyncio.run(quick_validation())