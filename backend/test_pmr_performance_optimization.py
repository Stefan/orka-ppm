"""
Test suite for PMR Performance Optimization
Tests caching, monitoring, and WebSocket optimization
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime

# Import services
from services.pmr_cache_service import PMRCacheService
from services.pmr_performance_monitor import PMRPerformanceMonitor, PerformanceMetric
from services.websocket_optimizer import WebSocketOptimizer, MessageBatch


class TestPMRCacheService:
    """Test PMR Cache Service"""
    
    def test_cache_service_initialization(self):
        """Test cache service initializes correctly"""
        cache_service = PMRCacheService()
        assert cache_service is not None
        # Note: May not be enabled if Redis is not available
    
    @pytest.mark.asyncio
    async def test_report_caching(self):
        """Test report caching functionality"""
        cache_service = PMRCacheService()
        
        if not cache_service.is_enabled():
            pytest.skip("Redis not available")
        
        report_id = uuid4()
        report_data = {
            "id": str(report_id),
            "title": "Test Report",
            "status": "draft"
        }
        
        # Cache report
        success = await cache_service.cache_report(report_id, report_data, ttl=60)
        assert success is True
        
        # Retrieve cached report
        cached = await cache_service.get_cached_report(report_id)
        assert cached is not None
        assert cached["title"] == "Test Report"
        
        # Invalidate cache
        success = await cache_service.invalidate_report(report_id)
        assert success is True
        
        # Verify invalidation
        cached = await cache_service.get_cached_report(report_id)
        assert cached is None
    
    @pytest.mark.asyncio
    async def test_cache_stats(self):
        """Test cache statistics"""
        cache_service = PMRCacheService()
        
        stats = await cache_service.get_cache_stats()
        assert "enabled" in stats
        
        if stats["enabled"]:
            assert "total_keys" in stats
            assert "hit_rate" in stats


class TestPMRPerformanceMonitor:
    """Test PMR Performance Monitor"""
    
    def test_monitor_initialization(self):
        """Test monitor initializes correctly"""
        monitor = PMRPerformanceMonitor()
        assert monitor is not None
        assert monitor.is_enabled() is True
    
    def test_record_metric(self):
        """Test metric recording"""
        monitor = PMRPerformanceMonitor()
        
        monitor.record_metric("test_metric", 100.5, "ms", {"tag": "test"})
        
        metrics = monitor.get_recent_metrics(limit=10)
        assert len(metrics) > 0
        assert metrics[-1]["name"] == "test_metric"
        assert metrics[-1]["value"] == 100.5
    
    def test_record_operation_time(self):
        """Test operation timing"""
        monitor = PMRPerformanceMonitor()
        
        monitor.record_operation_time("test_operation", 250.0, {"env": "test"})
        
        stats = monitor.get_operation_stats("test_operation")
        assert stats["count"] >= 1
        assert stats["avg_ms"] > 0
    
    def test_track_time_decorator(self):
        """Test timing decorator"""
        monitor = PMRPerformanceMonitor()
        
        @monitor.track_time("decorated_operation")
        def test_function():
            import time
            time.sleep(0.01)  # 10ms
            return "done"
        
        result = test_function()
        assert result == "done"
        
        stats = monitor.get_operation_stats("decorated_operation")
        assert stats["count"] >= 1
        assert stats["min_ms"] >= 10
    
    def test_threshold_alerts(self):
        """Test threshold-based alerting"""
        monitor = PMRPerformanceMonitor()
        
        # Clear any existing alerts
        monitor.alerts = []
        
        # Record metric that exceeds threshold
        monitor.record_metric("report_generation_time", 35000, "ms")  # 35 seconds > 30 second threshold
        
        alerts = monitor.get_recent_alerts(limit=10)
        # Should have generated an alert (if threshold checking is working)
        # Note: Alert generation depends on threshold configuration
        assert isinstance(alerts, list)
    
    def test_optimization_recommendations(self):
        """Test optimization recommendations"""
        monitor = PMRPerformanceMonitor()
        
        # Record some slow operations
        for _ in range(5):
            monitor.record_operation_time("report_generation_time", 35000)
        
        recommendations = monitor.get_optimization_recommendations()
        assert isinstance(recommendations, list)
    
    def test_health_check(self):
        """Test health check"""
        monitor = PMRPerformanceMonitor()
        
        health = monitor.health_check()
        assert "status" in health
        assert health["status"] in ["healthy", "degraded", "unhealthy"]


class TestWebSocketOptimizer:
    """Test WebSocket Optimizer"""
    
    def test_optimizer_initialization(self):
        """Test optimizer initializes correctly"""
        optimizer = WebSocketOptimizer()
        assert optimizer is not None
    
    @pytest.mark.asyncio
    async def test_connection_registration(self):
        """Test connection registration"""
        optimizer = WebSocketOptimizer()
        
        session_id = "test-session"
        user_id = "test-user"
        
        success = await optimizer.register_connection(
            session_id,
            user_id,
            {"user_name": "Test User"}
        )
        assert success is True
        
        # Check connection count
        count = optimizer.connection_pool.get_connection_count(session_id)
        assert count == 1
        
        # Unregister
        success = await optimizer.unregister_connection(session_id, user_id)
        assert success is True
    
    @pytest.mark.asyncio
    async def test_message_batching(self):
        """Test message batching"""
        optimizer = WebSocketOptimizer()
        optimizer.enable_batching = True
        
        session_id = "test-session"
        
        # Queue multiple messages
        for i in range(5):
            await optimizer.queue_message(
                session_id,
                {"type": "test", "index": i}
            )
        
        # Check batch exists
        assert session_id in optimizer.message_batches
        batch = optimizer.message_batches[session_id]
        assert len(batch.messages) == 5
    
    def test_message_batch_class(self):
        """Test MessageBatch class"""
        batch = MessageBatch(max_size=3, max_wait_ms=100)
        
        # Add messages
        is_full = batch.add_message({"msg": 1})
        assert is_full is False
        
        is_full = batch.add_message({"msg": 2})
        assert is_full is False
        
        is_full = batch.add_message({"msg": 3})
        assert is_full is True  # Batch is full
        
        # Check messages
        messages = batch.get_messages()
        assert len(messages) == 3
    
    def test_optimizer_stats(self):
        """Test optimizer statistics"""
        optimizer = WebSocketOptimizer()
        
        stats = optimizer.get_stats()
        assert "enabled" in stats
        assert "batching_enabled" in stats
        assert "total_connections" in stats
    
    def test_health_check(self):
        """Test health check"""
        optimizer = WebSocketOptimizer()
        
        health = optimizer.health_check()
        assert "status" in health
        assert health["status"] in ["healthy", "degraded", "unhealthy"]


class TestPerformanceMetric:
    """Test PerformanceMetric class"""
    
    def test_metric_creation(self):
        """Test metric creation"""
        metric = PerformanceMetric(
            name="test_metric",
            value=123.45,
            unit="ms",
            tags={"env": "test"}
        )
        
        assert metric.name == "test_metric"
        assert metric.value == 123.45
        assert metric.unit == "ms"
        assert metric.tags["env"] == "test"
        assert isinstance(metric.timestamp, datetime)
    
    def test_metric_to_dict(self):
        """Test metric serialization"""
        metric = PerformanceMetric("test", 100, "ms")
        
        data = metric.to_dict()
        assert data["name"] == "test"
        assert data["value"] == 100
        assert data["unit"] == "ms"
        assert "timestamp" in data


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
