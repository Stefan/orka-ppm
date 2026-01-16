"""
PMR Performance Monitoring Service
Tracks performance metrics, alerts, and optimization opportunities
"""

import os
import logging
import time
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from uuid import UUID
from functools import wraps
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)


class PerformanceMetric:
    """Container for a single performance metric"""
    
    def __init__(self, name: str, value: float, unit: str = "ms", tags: Optional[Dict[str, str]] = None):
        self.name = name
        self.value = value
        self.unit = unit
        self.tags = tags or {}
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "tags": self.tags,
            "timestamp": self.timestamp.isoformat()
        }


class PerformanceAlert:
    """Container for performance alerts"""
    
    def __init__(
        self,
        alert_type: str,
        severity: str,
        message: str,
        metric_name: str,
        threshold: float,
        actual_value: float,
        tags: Optional[Dict[str, str]] = None
    ):
        self.alert_type = alert_type
        self.severity = severity
        self.message = message
        self.metric_name = metric_name
        self.threshold = threshold
        self.actual_value = actual_value
        self.tags = tags or {}
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_type": self.alert_type,
            "severity": self.severity,
            "message": self.message,
            "metric_name": self.metric_name,
            "threshold": self.threshold,
            "actual_value": self.actual_value,
            "tags": self.tags,
            "timestamp": self.timestamp.isoformat()
        }


class PMRPerformanceMonitor:
    """
    Performance monitoring service for Enhanced PMR
    Tracks metrics, generates alerts, and provides optimization insights
    """
    
    # Performance thresholds
    THRESHOLDS = {
        "report_generation_time": 30000,  # 30 seconds
        "ai_insight_generation_time": 10000,  # 10 seconds
        "monte_carlo_analysis_time": 15000,  # 15 seconds
        "websocket_message_latency": 100,  # 100ms
        "cache_hit_rate": 70,  # 70%
        "database_query_time": 1000,  # 1 second
        "api_response_time": 2000,  # 2 seconds
        "memory_usage_mb": 512,  # 512 MB
        "concurrent_sessions": 50  # 50 sessions
    }
    
    def __init__(self):
        """Initialize performance monitor"""
        self.metrics: List[PerformanceMetric] = []
        self.alerts: List[PerformanceAlert] = []
        self.operation_timings: Dict[str, List[float]] = defaultdict(list)
        self.alert_callbacks: List[Callable] = []
        self.enabled = True
        
        # Statistics
        self.stats = {
            "total_operations": 0,
            "total_alerts": 0,
            "start_time": datetime.utcnow()
        }
        
        logger.info("PMR Performance Monitor initialized")
    
    def is_enabled(self) -> bool:
        """Check if monitoring is enabled"""
        return self.enabled
    
    def enable(self) -> None:
        """Enable performance monitoring"""
        self.enabled = True
        logger.info("Performance monitoring enabled")
    
    def disable(self) -> None:
        """Disable performance monitoring"""
        self.enabled = False
        logger.info("Performance monitoring disabled")
    
    # Metric Recording
    
    def record_metric(
        self,
        name: str,
        value: float,
        unit: str = "ms",
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a performance metric"""
        if not self.is_enabled():
            return
        
        try:
            metric = PerformanceMetric(name, value, unit, tags)
            self.metrics.append(metric)
            
            # Keep only recent metrics (last 1000)
            if len(self.metrics) > 1000:
                self.metrics = self.metrics[-1000:]
            
            # Check thresholds
            self._check_threshold(metric)
            
            logger.debug(f"Recorded metric: {name}={value}{unit}")
            
        except Exception as e:
            logger.error(f"Failed to record metric: {e}")
    
    def record_operation_time(
        self,
        operation_name: str,
        duration_ms: float,
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """Record operation timing"""
        if not self.is_enabled():
            return
        
        try:
            self.operation_timings[operation_name].append(duration_ms)
            
            # Keep only recent timings (last 100 per operation)
            if len(self.operation_timings[operation_name]) > 100:
                self.operation_timings[operation_name] = self.operation_timings[operation_name][-100:]
            
            self.record_metric(operation_name, duration_ms, "ms", tags)
            self.stats["total_operations"] += 1
            
        except Exception as e:
            logger.error(f"Failed to record operation time: {e}")
    
    # Timing Decorators
    
    def track_time(self, operation_name: str, tags: Optional[Dict[str, str]] = None):
        """Decorator to track function execution time"""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    return result
                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    self.record_operation_time(operation_name, duration_ms, tags)
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    self.record_operation_time(operation_name, duration_ms, tags)
            
            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator
    
    # Alert Management
    
    def _check_threshold(self, metric: PerformanceMetric) -> None:
        """Check if metric exceeds threshold and generate alert"""
        if metric.name not in self.THRESHOLDS:
            return
        
        threshold = self.THRESHOLDS[metric.name]
        
        # Determine if threshold is exceeded
        exceeded = False
        if "rate" in metric.name or "ratio" in metric.name:
            # For rates/ratios, lower is worse
            exceeded = metric.value < threshold
        else:
            # For times/counts, higher is worse
            exceeded = metric.value > threshold
        
        if exceeded:
            self._generate_alert(metric, threshold)
    
    def _generate_alert(self, metric: PerformanceMetric, threshold: float) -> None:
        """Generate a performance alert"""
        try:
            # Determine severity
            severity = self._calculate_severity(metric.value, threshold)
            
            # Create alert message
            message = f"{metric.name} exceeded threshold: {metric.value}{metric.unit} > {threshold}{metric.unit}"
            
            alert = PerformanceAlert(
                alert_type="threshold_exceeded",
                severity=severity,
                message=message,
                metric_name=metric.name,
                threshold=threshold,
                actual_value=metric.value,
                tags=metric.tags
            )
            
            self.alerts.append(alert)
            self.stats["total_alerts"] += 1
            
            # Keep only recent alerts (last 100)
            if len(self.alerts) > 100:
                self.alerts = self.alerts[-100:]
            
            # Trigger callbacks
            self._trigger_alert_callbacks(alert)
            
            logger.warning(f"Performance alert: {message}")
            
        except Exception as e:
            logger.error(f"Failed to generate alert: {e}")
    
    def _calculate_severity(self, value: float, threshold: float) -> str:
        """Calculate alert severity based on how much threshold is exceeded"""
        ratio = value / threshold if threshold > 0 else 1.0
        
        if ratio >= 2.0:
            return "critical"
        elif ratio >= 1.5:
            return "high"
        elif ratio >= 1.2:
            return "medium"
        else:
            return "low"
    
    def register_alert_callback(self, callback: Callable[[PerformanceAlert], None]) -> None:
        """Register a callback to be called when alerts are generated"""
        self.alert_callbacks.append(callback)
    
    def _trigger_alert_callbacks(self, alert: PerformanceAlert) -> None:
        """Trigger all registered alert callbacks"""
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")
    
    # Statistics and Reporting
    
    def get_operation_stats(self, operation_name: str) -> Dict[str, Any]:
        """Get statistics for a specific operation"""
        if operation_name not in self.operation_timings:
            return {"error": "Operation not found"}
        
        timings = self.operation_timings[operation_name]
        if not timings:
            return {"error": "No data available"}
        
        sorted_timings = sorted(timings)
        count = len(sorted_timings)
        
        return {
            "operation": operation_name,
            "count": count,
            "min_ms": round(min(sorted_timings), 2),
            "max_ms": round(max(sorted_timings), 2),
            "avg_ms": round(sum(sorted_timings) / count, 2),
            "median_ms": round(sorted_timings[count // 2], 2),
            "p95_ms": round(sorted_timings[int(count * 0.95)], 2) if count > 0 else 0,
            "p99_ms": round(sorted_timings[int(count * 0.99)], 2) if count > 0 else 0
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Get statistics for all operations"""
        operation_stats = {}
        for operation_name in self.operation_timings.keys():
            operation_stats[operation_name] = self.get_operation_stats(operation_name)
        
        uptime = (datetime.utcnow() - self.stats["start_time"]).total_seconds()
        
        return {
            "enabled": self.enabled,
            "uptime_seconds": round(uptime, 2),
            "total_operations": self.stats["total_operations"],
            "total_alerts": self.stats["total_alerts"],
            "total_metrics": len(self.metrics),
            "operations": operation_stats,
            "recent_alerts": [alert.to_dict() for alert in self.alerts[-10:]]
        }
    
    def get_recent_metrics(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent performance metrics"""
        return [metric.to_dict() for metric in self.metrics[-limit:]]
    
    def get_recent_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent performance alerts"""
        return [alert.to_dict() for alert in self.alerts[-limit:]]
    
    def get_alerts_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """Get alerts filtered by severity"""
        return [
            alert.to_dict()
            for alert in self.alerts
            if alert.severity == severity
        ]
    
    # Optimization Recommendations
    
    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Generate optimization recommendations based on collected metrics"""
        recommendations = []
        
        # Check report generation time
        if "report_generation_time" in self.operation_timings:
            stats = self.get_operation_stats("report_generation_time")
            if stats.get("avg_ms", 0) > self.THRESHOLDS["report_generation_time"]:
                recommendations.append({
                    "category": "report_generation",
                    "priority": "high",
                    "issue": f"Average report generation time is {stats['avg_ms']}ms",
                    "recommendation": "Consider enabling caching for AI insights and Monte Carlo results",
                    "expected_improvement": "30-50% reduction in generation time"
                })
        
        # Check WebSocket latency
        if "websocket_message_latency" in self.operation_timings:
            stats = self.get_operation_stats("websocket_message_latency")
            if stats.get("p95_ms", 0) > self.THRESHOLDS["websocket_message_latency"]:
                recommendations.append({
                    "category": "websocket",
                    "priority": "medium",
                    "issue": f"P95 WebSocket latency is {stats['p95_ms']}ms",
                    "recommendation": "Implement message batching and connection pooling",
                    "expected_improvement": "20-30% reduction in latency"
                })
        
        # Check database query time
        if "database_query_time" in self.operation_timings:
            stats = self.get_operation_stats("database_query_time")
            if stats.get("avg_ms", 0) > self.THRESHOLDS["database_query_time"]:
                recommendations.append({
                    "category": "database",
                    "priority": "high",
                    "issue": f"Average database query time is {stats['avg_ms']}ms",
                    "recommendation": "Add database indexes and implement query result caching",
                    "expected_improvement": "40-60% reduction in query time"
                })
        
        # Check for high alert count
        if self.stats["total_alerts"] > 10:
            recommendations.append({
                "category": "general",
                "priority": "high",
                "issue": f"High number of performance alerts: {self.stats['total_alerts']}",
                "recommendation": "Review recent alerts and address root causes",
                "expected_improvement": "Overall system stability improvement"
            })
        
        return recommendations
    
    # Health Check
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on performance monitoring"""
        try:
            uptime = (datetime.utcnow() - self.stats["start_time"]).total_seconds()
            
            # Count recent critical alerts
            recent_critical = len([
                a for a in self.alerts[-20:]
                if a.severity == "critical"
            ])
            
            status = "healthy"
            if recent_critical > 5:
                status = "degraded"
            elif recent_critical > 10:
                status = "unhealthy"
            
            return {
                "status": status,
                "enabled": self.enabled,
                "uptime_seconds": round(uptime, 2),
                "total_operations": self.stats["total_operations"],
                "total_alerts": self.stats["total_alerts"],
                "recent_critical_alerts": recent_critical,
                "tracked_operations": len(self.operation_timings),
                "message": "Performance monitoring is operational"
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    # Cleanup
    
    def clear_old_data(self, hours: int = 24) -> Dict[str, int]:
        """Clear metrics and alerts older than specified hours"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            # Clear old metrics
            old_metric_count = len(self.metrics)
            self.metrics = [m for m in self.metrics if m.timestamp > cutoff_time]
            metrics_removed = old_metric_count - len(self.metrics)
            
            # Clear old alerts
            old_alert_count = len(self.alerts)
            self.alerts = [a for a in self.alerts if a.timestamp > cutoff_time]
            alerts_removed = old_alert_count - len(self.alerts)
            
            logger.info(f"Cleared {metrics_removed} old metrics and {alerts_removed} old alerts")
            
            return {
                "metrics_removed": metrics_removed,
                "alerts_removed": alerts_removed
            }
            
        except Exception as e:
            logger.error(f"Failed to clear old data: {e}")
            return {"error": str(e)}


# Global performance monitor instance
performance_monitor = PMRPerformanceMonitor()
