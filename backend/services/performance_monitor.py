"""
Performance Monitoring and Alerting Service for Enhanced PMR
Tracks metrics, detects anomalies, and sends alerts
"""

import os
import logging
import time
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from collections import deque, defaultdict
from dataclasses import dataclass, field
from enum import Enum
import asyncio

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of performance metrics"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class PerformanceMetric:
    """Performance metric data"""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tags: Dict[str, str] = field(default_factory=dict)
    unit: str = ""


@dataclass
class PerformanceAlert:
    """Performance alert data"""
    alert_id: str
    metric_name: str
    severity: AlertSeverity
    message: str
    current_value: float
    threshold: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tags: Dict[str, str] = field(default_factory=dict)


class PerformanceMonitor:
    """
    Performance monitoring service for Enhanced PMR
    Tracks metrics, detects anomalies, and sends alerts
    """
    
    def __init__(
        self,
        retention_minutes: int = 60,
        alert_cooldown_seconds: int = 300
    ):
        """
        Initialize performance monitor
        
        Args:
            retention_minutes: How long to retain metrics in memory
            alert_cooldown_seconds: Minimum time between duplicate alerts
        """
        self.retention_minutes = retention_minutes
        self.alert_cooldown_seconds = alert_cooldown_seconds
        
        # Metric storage: metric_name -> deque of (timestamp, value)
        self.metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        # Metric metadata
        self.metric_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Alert history: alert_id -> last_triggered_time
        self.alert_history: Dict[str, datetime] = {}
        
        # Alert handlers: severity -> list of handlers
        self.alert_handlers: Dict[AlertSeverity, List[Callable]] = defaultdict(list)
        
        # Thresholds: metric_name -> {severity: threshold}
        self.thresholds: Dict[str, Dict[AlertSeverity, float]] = {}
        
        # Statistics
        self.stats = {
            "total_metrics_recorded": 0,
            "total_alerts_triggered": 0,
            "active_metrics": 0
        }
        
        # Start cleanup task
        self._cleanup_task = None
    
    async def start(self):
        """Start the performance monitor"""
        logger.info("Starting performance monitor...")
        self._cleanup_task = asyncio.create_task(self._cleanup_old_metrics())
    
    async def stop(self):
        """Stop the performance monitor"""
        logger.info("Stopping performance monitor...")
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
    
    # ========================================================================
    # Metric Recording
    # ========================================================================
    
    def record_metric(
        self,
        name: str,
        value: float,
        metric_type: MetricType = MetricType.GAUGE,
        tags: Optional[Dict[str, str]] = None,
        unit: str = ""
    ):
        """
        Record a performance metric
        
        Args:
            name: Metric name
            value: Metric value
            metric_type: Type of metric
            tags: Optional tags for categorization
            unit: Unit of measurement
        """
        timestamp = datetime.utcnow()
        
        # Store metric
        self.metrics[name].append((timestamp, value))
        
        # Store metadata
        if name not in self.metric_metadata:
            self.metric_metadata[name] = {
                "metric_type": metric_type,
                "unit": unit,
                "tags": tags or {},
                "first_recorded": timestamp
            }
        
        # Update statistics
        self.stats["total_metrics_recorded"] += 1
        self.stats["active_metrics"] = len(self.metrics)
        
        # Check thresholds
        self._check_thresholds(name, value, tags or {})
    
    def increment_counter(self, name: str, value: float = 1.0, tags: Optional[Dict[str, str]] = None):
        """Increment a counter metric"""
        current = self.get_latest_value(name) or 0
        self.record_metric(name, current + value, MetricType.COUNTER, tags)
    
    def record_timer(self, name: str, duration_ms: float, tags: Optional[Dict[str, str]] = None):
        """Record a timer metric in milliseconds"""
        self.record_metric(name, duration_ms, MetricType.TIMER, tags, unit="ms")
    
    def record_histogram(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Record a histogram metric"""
        self.record_metric(name, value, MetricType.HISTOGRAM, tags)
    
    # ========================================================================
    # PMR-Specific Metrics
    # ========================================================================
    
    def record_report_generation_time(self, report_id: str, duration_seconds: float):
        """Record PMR report generation time"""
        self.record_timer(
            "pmr.report.generation_time",
            duration_seconds * 1000,
            tags={"report_id": report_id}
        )
    
    def record_ai_insight_generation_time(self, report_id: str, duration_seconds: float):
        """Record AI insight generation time"""
        self.record_timer(
            "pmr.ai_insights.generation_time",
            duration_seconds * 1000,
            tags={"report_id": report_id}
        )
    
    def record_monte_carlo_execution_time(self, report_id: str, duration_seconds: float, iterations: int):
        """Record Monte Carlo analysis execution time"""
        self.record_timer(
            "pmr.monte_carlo.execution_time",
            duration_seconds * 1000,
            tags={"report_id": report_id, "iterations": str(iterations)}
        )
    
    def record_export_generation_time(self, report_id: str, format: str, duration_seconds: float):
        """Record export generation time"""
        self.record_timer(
            "pmr.export.generation_time",
            duration_seconds * 1000,
            tags={"report_id": report_id, "format": format}
        )
    
    def record_cache_hit(self, cache_key: str):
        """Record cache hit"""
        self.increment_counter("pmr.cache.hits", tags={"key_type": cache_key.split(':')[0]})
    
    def record_cache_miss(self, cache_key: str):
        """Record cache miss"""
        self.increment_counter("pmr.cache.misses", tags={"key_type": cache_key.split(':')[0]})
    
    def record_websocket_connection(self, report_id: str):
        """Record WebSocket connection"""
        self.increment_counter("pmr.websocket.connections", tags={"report_id": report_id})
    
    def record_websocket_message(self, report_id: str, message_type: str):
        """Record WebSocket message"""
        self.increment_counter(
            "pmr.websocket.messages",
            tags={"report_id": report_id, "type": message_type}
        )
    
    def record_api_request(self, endpoint: str, method: str, status_code: int, duration_ms: float):
        """Record API request"""
        self.record_timer(
            "pmr.api.request_duration",
            duration_ms,
            tags={"endpoint": endpoint, "method": method, "status": str(status_code)}
        )
        self.increment_counter(
            "pmr.api.requests",
            tags={"endpoint": endpoint, "method": method, "status": str(status_code)}
        )
    
    def record_database_query(self, query_type: str, duration_ms: float):
        """Record database query"""
        self.record_timer(
            "pmr.database.query_duration",
            duration_ms,
            tags={"query_type": query_type}
        )
    
    # ========================================================================
    # Metric Retrieval
    # ========================================================================
    
    def get_latest_value(self, name: str) -> Optional[float]:
        """Get the latest value for a metric"""
        if name not in self.metrics or not self.metrics[name]:
            return None
        return self.metrics[name][-1][1]
    
    def get_metric_history(
        self,
        name: str,
        minutes: Optional[int] = None
    ) -> List[tuple[datetime, float]]:
        """
        Get metric history
        
        Args:
            name: Metric name
            minutes: Optional time window in minutes
            
        Returns:
            List of (timestamp, value) tuples
        """
        if name not in self.metrics:
            return []
        
        if minutes is None:
            return list(self.metrics[name])
        
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        return [(ts, val) for ts, val in self.metrics[name] if ts >= cutoff]
    
    def get_metric_stats(self, name: str, minutes: Optional[int] = None) -> Dict[str, float]:
        """
        Get statistics for a metric
        
        Args:
            name: Metric name
            minutes: Optional time window in minutes
            
        Returns:
            Dictionary with min, max, avg, count
        """
        history = self.get_metric_history(name, minutes)
        
        if not history:
            return {
                "min": 0,
                "max": 0,
                "avg": 0,
                "count": 0,
                "latest": 0
            }
        
        values = [val for _, val in history]
        
        return {
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "count": len(values),
            "latest": values[-1]
        }
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all current metrics with their latest values"""
        return {
            name: {
                "latest_value": self.get_latest_value(name),
                "metadata": self.metric_metadata.get(name, {}),
                "stats": self.get_metric_stats(name, minutes=5)
            }
            for name in self.metrics.keys()
        }
    
    # ========================================================================
    # Threshold Management
    # ========================================================================
    
    def set_threshold(
        self,
        metric_name: str,
        severity: AlertSeverity,
        threshold: float
    ):
        """
        Set alert threshold for a metric
        
        Args:
            metric_name: Name of the metric
            severity: Alert severity level
            threshold: Threshold value
        """
        if metric_name not in self.thresholds:
            self.thresholds[metric_name] = {}
        
        self.thresholds[metric_name][severity] = threshold
        logger.info(f"Set {severity.value} threshold for {metric_name}: {threshold}")
    
    def _check_thresholds(self, metric_name: str, value: float, tags: Dict[str, str]):
        """Check if metric value exceeds any thresholds"""
        if metric_name not in self.thresholds:
            return
        
        for severity, threshold in self.thresholds[metric_name].items():
            if value > threshold:
                self._trigger_alert(metric_name, severity, value, threshold, tags)
    
    # ========================================================================
    # Alert Management
    # ========================================================================
    
    def register_alert_handler(self, severity: AlertSeverity, handler: Callable):
        """
        Register an alert handler
        
        Args:
            severity: Alert severity level
            handler: Async function to handle alerts
        """
        self.alert_handlers[severity].append(handler)
    
    def _trigger_alert(
        self,
        metric_name: str,
        severity: AlertSeverity,
        current_value: float,
        threshold: float,
        tags: Dict[str, str]
    ):
        """Trigger an alert"""
        alert_id = f"{metric_name}:{severity.value}"
        
        # Check cooldown
        if alert_id in self.alert_history:
            last_triggered = self.alert_history[alert_id]
            if (datetime.utcnow() - last_triggered).total_seconds() < self.alert_cooldown_seconds:
                return
        
        # Create alert
        alert = PerformanceAlert(
            alert_id=alert_id,
            metric_name=metric_name,
            severity=severity,
            message=f"{metric_name} exceeded {severity.value} threshold: {current_value} > {threshold}",
            current_value=current_value,
            threshold=threshold,
            tags=tags
        )
        
        # Update history
        self.alert_history[alert_id] = datetime.utcnow()
        self.stats["total_alerts_triggered"] += 1
        
        # Log alert
        log_method = {
            AlertSeverity.INFO: logger.info,
            AlertSeverity.WARNING: logger.warning,
            AlertSeverity.ERROR: logger.error,
            AlertSeverity.CRITICAL: logger.critical
        }.get(severity, logger.warning)
        
        log_method(f"ALERT: {alert.message}")
        
        # Call handlers
        asyncio.create_task(self._call_alert_handlers(alert))
    
    async def _call_alert_handlers(self, alert: PerformanceAlert):
        """Call registered alert handlers"""
        handlers = self.alert_handlers.get(alert.severity, [])
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(alert)
                else:
                    handler(alert)
            except Exception as e:
                logger.error(f"Error calling alert handler: {e}")
    
    # ========================================================================
    # Performance Report
    # ========================================================================
    
    def get_performance_report(self, minutes: int = 60) -> Dict[str, Any]:
        """
        Generate comprehensive performance report
        
        Args:
            minutes: Time window in minutes
            
        Returns:
            Performance report dictionary
        """
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "time_window_minutes": minutes,
            "statistics": self.stats.copy(),
            "metrics": {},
            "alerts": {
                "total_triggered": self.stats["total_alerts_triggered"],
                "recent_alerts": []
            }
        }
        
        # Add metric statistics
        for metric_name in self.metrics.keys():
            report["metrics"][metric_name] = {
                "stats": self.get_metric_stats(metric_name, minutes),
                "metadata": self.metric_metadata.get(metric_name, {})
            }
        
        # Add recent alerts
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        report["alerts"]["recent_alerts"] = [
            {
                "alert_id": alert_id,
                "last_triggered": last_triggered.isoformat()
            }
            for alert_id, last_triggered in self.alert_history.items()
            if last_triggered >= cutoff
        ]
        
        return report
    
    def get_pmr_performance_summary(self) -> Dict[str, Any]:
        """Get PMR-specific performance summary"""
        return {
            "report_generation": self.get_metric_stats("pmr.report.generation_time", minutes=60),
            "ai_insights": self.get_metric_stats("pmr.ai_insights.generation_time", minutes=60),
            "monte_carlo": self.get_metric_stats("pmr.monte_carlo.execution_time", minutes=60),
            "export": self.get_metric_stats("pmr.export.generation_time", minutes=60),
            "cache": {
                "hits": self.get_latest_value("pmr.cache.hits") or 0,
                "misses": self.get_latest_value("pmr.cache.misses") or 0,
                "hit_rate": self._calculate_cache_hit_rate()
            },
            "websocket": {
                "connections": self.get_latest_value("pmr.websocket.connections") or 0,
                "messages": self.get_latest_value("pmr.websocket.messages") or 0
            },
            "api": self.get_metric_stats("pmr.api.request_duration", minutes=60),
            "database": self.get_metric_stats("pmr.database.query_duration", minutes=60)
        }
    
    def _calculate_cache_hit_rate(self) -> float:
        """Calculate cache hit rate percentage"""
        hits = self.get_latest_value("pmr.cache.hits") or 0
        misses = self.get_latest_value("pmr.cache.misses") or 0
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return round((hits / total) * 100, 2)
    
    # ========================================================================
    # Cleanup
    # ========================================================================
    
    async def _cleanup_old_metrics(self):
        """Periodically cleanup old metrics"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                cutoff = datetime.utcnow() - timedelta(minutes=self.retention_minutes)
                
                for metric_name, metric_data in list(self.metrics.items()):
                    # Remove old entries
                    while metric_data and metric_data[0][0] < cutoff:
                        metric_data.popleft()
                    
                    # Remove empty metrics
                    if not metric_data:
                        del self.metrics[metric_name]
                        if metric_name in self.metric_metadata:
                            del self.metric_metadata[metric_name]
                
                # Cleanup old alert history
                for alert_id, last_triggered in list(self.alert_history.items()):
                    if (datetime.utcnow() - last_triggered).total_seconds() > 3600:  # 1 hour
                        del self.alert_history[alert_id]
                
                logger.debug("Cleaned up old metrics")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error cleaning up metrics: {e}")
    
    # ========================================================================
    # Context Manager for Timing
    # ========================================================================
    
    class Timer:
        """Context manager for timing operations"""
        
        def __init__(self, monitor: 'PerformanceMonitor', metric_name: str, tags: Optional[Dict[str, str]] = None):
            self.monitor = monitor
            self.metric_name = metric_name
            self.tags = tags or {}
            self.start_time = None
        
        def __enter__(self):
            self.start_time = time.time()
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            duration_ms = (time.time() - self.start_time) * 1000
            self.monitor.record_timer(self.metric_name, duration_ms, self.tags)
    
    def timer(self, metric_name: str, tags: Optional[Dict[str, str]] = None):
        """Create a timer context manager"""
        return self.Timer(self, metric_name, tags)


# Global performance monitor instance
_monitor_instance: Optional[PerformanceMonitor] = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get or create global performance monitor instance"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = PerformanceMonitor()
    return _monitor_instance
