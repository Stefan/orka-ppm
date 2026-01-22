"""
Workflow Performance Monitor

Provides performance monitoring and metrics collection for workflow engine operations.
Tracks execution times, throughput, error rates, and other performance indicators.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from collections import defaultdict, deque
import time
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """Container for performance metrics."""
    
    def __init__(self):
        """Initialize metrics container."""
        # Operation counters
        self.operation_counts: Dict[str, int] = defaultdict(int)
        self.operation_errors: Dict[str, int] = defaultdict(int)
        
        # Timing metrics (in milliseconds)
        self.operation_times: Dict[str, List[float]] = defaultdict(list)
        self.max_history_size = 1000  # Keep last 1000 measurements per operation
        
        # Workflow-specific metrics
        self.workflows_created = 0
        self.workflows_completed = 0
        self.workflows_rejected = 0
        self.workflows_cancelled = 0
        
        self.approvals_submitted = 0
        self.approvals_approved = 0
        self.approvals_rejected = 0
        self.approvals_expired = 0
        
        # Cache metrics
        self.cache_hits = 0
        self.cache_misses = 0
        
        # Throughput tracking (operations per minute)
        self.throughput_window = deque(maxlen=60)  # Last 60 seconds
        
        # Start time
        self.start_time = datetime.utcnow()
    
    def record_operation(
        self,
        operation: str,
        duration_ms: float,
        success: bool = True
    ) -> None:
        """
        Record an operation execution.
        
        Args:
            operation: Operation name
            duration_ms: Duration in milliseconds
            success: Whether operation succeeded
        """
        self.operation_counts[operation] += 1
        
        if not success:
            self.operation_errors[operation] += 1
        
        # Store timing (keep only recent history)
        times = self.operation_times[operation]
        times.append(duration_ms)
        if len(times) > self.max_history_size:
            times.pop(0)
        
        # Update throughput
        self.throughput_window.append((time.time(), operation))
    
    def get_operation_stats(self, operation: str) -> Dict[str, Any]:
        """
        Get statistics for a specific operation.
        
        Args:
            operation: Operation name
            
        Returns:
            Dict containing operation statistics
        """
        times = self.operation_times.get(operation, [])
        count = self.operation_counts.get(operation, 0)
        errors = self.operation_errors.get(operation, 0)
        
        if not times:
            return {
                "operation": operation,
                "count": count,
                "errors": errors,
                "error_rate": errors / count if count > 0 else 0,
                "avg_duration_ms": 0,
                "min_duration_ms": 0,
                "max_duration_ms": 0,
                "p50_duration_ms": 0,
                "p95_duration_ms": 0,
                "p99_duration_ms": 0
            }
        
        sorted_times = sorted(times)
        n = len(sorted_times)
        
        return {
            "operation": operation,
            "count": count,
            "errors": errors,
            "error_rate": errors / count if count > 0 else 0,
            "avg_duration_ms": sum(times) / n,
            "min_duration_ms": sorted_times[0],
            "max_duration_ms": sorted_times[-1],
            "p50_duration_ms": sorted_times[n // 2],
            "p95_duration_ms": sorted_times[int(n * 0.95)],
            "p99_duration_ms": sorted_times[int(n * 0.99)]
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """
        Get all performance statistics.
        
        Returns:
            Dict containing all statistics
        """
        # Calculate uptime
        uptime_seconds = (datetime.utcnow() - self.start_time).total_seconds()
        
        # Calculate throughput (operations per minute)
        now = time.time()
        recent_ops = [op for ts, op in self.throughput_window if now - ts <= 60]
        throughput = len(recent_ops)
        
        # Get stats for all operations
        operation_stats = {
            op: self.get_operation_stats(op)
            for op in self.operation_counts.keys()
        }
        
        # Calculate cache hit rate
        total_cache_requests = self.cache_hits + self.cache_misses
        cache_hit_rate = (
            self.cache_hits / total_cache_requests
            if total_cache_requests > 0
            else 0
        )
        
        return {
            "uptime_seconds": uptime_seconds,
            "throughput_per_minute": throughput,
            "workflow_metrics": {
                "created": self.workflows_created,
                "completed": self.workflows_completed,
                "rejected": self.workflows_rejected,
                "cancelled": self.workflows_cancelled,
                "completion_rate": (
                    self.workflows_completed / self.workflows_created
                    if self.workflows_created > 0
                    else 0
                )
            },
            "approval_metrics": {
                "submitted": self.approvals_submitted,
                "approved": self.approvals_approved,
                "rejected": self.approvals_rejected,
                "expired": self.approvals_expired,
                "approval_rate": (
                    self.approvals_approved / self.approvals_submitted
                    if self.approvals_submitted > 0
                    else 0
                )
            },
            "cache_metrics": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate": cache_hit_rate
            },
            "operation_stats": operation_stats
        }
    
    def reset(self) -> None:
        """Reset all metrics."""
        self.operation_counts.clear()
        self.operation_errors.clear()
        self.operation_times.clear()
        
        self.workflows_created = 0
        self.workflows_completed = 0
        self.workflows_rejected = 0
        self.workflows_cancelled = 0
        
        self.approvals_submitted = 0
        self.approvals_approved = 0
        self.approvals_rejected = 0
        self.approvals_expired = 0
        
        self.cache_hits = 0
        self.cache_misses = 0
        
        self.throughput_window.clear()
        self.start_time = datetime.utcnow()


class WorkflowPerformanceMonitor:
    """
    Performance monitor for workflow engine operations.
    
    Tracks and reports on workflow execution performance, including:
    - Operation timing and throughput
    - Error rates and failures
    - Workflow lifecycle metrics
    - Cache performance
    - Database query performance
    """
    
    def __init__(self):
        """Initialize performance monitor."""
        self.metrics = PerformanceMetrics()
        self.enabled = True
        
        logger.info("Initialized workflow performance monitor")
    
    @contextmanager
    def measure_operation(self, operation: str):
        """
        Context manager to measure operation duration.
        
        Args:
            operation: Operation name
            
        Yields:
            None
            
        Example:
            with monitor.measure_operation("create_workflow"):
                # ... operation code ...
        """
        if not self.enabled:
            yield
            return
        
        start_time = time.time()
        success = True
        
        try:
            yield
        except Exception as e:
            success = False
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_operation(operation, duration_ms, success)
    
    # ==================== Workflow Lifecycle Tracking ====================
    
    def record_workflow_created(self, workflow_id: UUID) -> None:
        """
        Record workflow creation.
        
        Args:
            workflow_id: Workflow ID
        """
        if not self.enabled:
            return
        
        self.metrics.workflows_created += 1
        logger.debug(f"Recorded workflow creation: {workflow_id}")
    
    def record_workflow_completed(
        self,
        workflow_id: UUID,
        duration_seconds: float
    ) -> None:
        """
        Record workflow completion.
        
        Args:
            workflow_id: Workflow ID
            duration_seconds: Total workflow duration
        """
        if not self.enabled:
            return
        
        self.metrics.workflows_completed += 1
        self.metrics.record_operation(
            "workflow_completion",
            duration_seconds * 1000,
            success=True
        )
        logger.debug(f"Recorded workflow completion: {workflow_id} ({duration_seconds:.2f}s)")
    
    def record_workflow_rejected(self, workflow_id: UUID) -> None:
        """
        Record workflow rejection.
        
        Args:
            workflow_id: Workflow ID
        """
        if not self.enabled:
            return
        
        self.metrics.workflows_rejected += 1
        logger.debug(f"Recorded workflow rejection: {workflow_id}")
    
    def record_workflow_cancelled(self, workflow_id: UUID) -> None:
        """
        Record workflow cancellation.
        
        Args:
            workflow_id: Workflow ID
        """
        if not self.enabled:
            return
        
        self.metrics.workflows_cancelled += 1
        logger.debug(f"Recorded workflow cancellation: {workflow_id}")
    
    # ==================== Approval Tracking ====================
    
    def record_approval_submitted(
        self,
        approval_id: UUID,
        decision: str
    ) -> None:
        """
        Record approval submission.
        
        Args:
            approval_id: Approval ID
            decision: Approval decision
        """
        if not self.enabled:
            return
        
        self.metrics.approvals_submitted += 1
        
        if decision == "approved":
            self.metrics.approvals_approved += 1
        elif decision == "rejected":
            self.metrics.approvals_rejected += 1
        
        logger.debug(f"Recorded approval submission: {approval_id} ({decision})")
    
    def record_approval_expired(self, approval_id: UUID) -> None:
        """
        Record approval expiration.
        
        Args:
            approval_id: Approval ID
        """
        if not self.enabled:
            return
        
        self.metrics.approvals_expired += 1
        logger.debug(f"Recorded approval expiration: {approval_id}")
    
    # ==================== Cache Performance ====================
    
    def record_cache_hit(self, key: str) -> None:
        """
        Record cache hit.
        
        Args:
            key: Cache key
        """
        if not self.enabled:
            return
        
        self.metrics.cache_hits += 1
    
    def record_cache_miss(self, key: str) -> None:
        """
        Record cache miss.
        
        Args:
            key: Cache key
        """
        if not self.enabled:
            return
        
        self.metrics.cache_misses += 1
    
    # ==================== Statistics and Reporting ====================
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get current performance statistics.
        
        Returns:
            Dict containing performance statistics
        """
        return self.metrics.get_all_stats()
    
    def get_operation_stats(self, operation: str) -> Dict[str, Any]:
        """
        Get statistics for a specific operation.
        
        Args:
            operation: Operation name
            
        Returns:
            Dict containing operation statistics
        """
        return self.metrics.get_operation_stats(operation)
    
    def get_summary(self) -> str:
        """
        Get human-readable performance summary.
        
        Returns:
            Formatted summary string
        """
        stats = self.get_stats()
        
        summary_lines = [
            "=== Workflow Engine Performance Summary ===",
            f"Uptime: {stats['uptime_seconds']:.0f}s",
            f"Throughput: {stats['throughput_per_minute']} ops/min",
            "",
            "Workflow Metrics:",
            f"  Created: {stats['workflow_metrics']['created']}",
            f"  Completed: {stats['workflow_metrics']['completed']}",
            f"  Rejected: {stats['workflow_metrics']['rejected']}",
            f"  Cancelled: {stats['workflow_metrics']['cancelled']}",
            f"  Completion Rate: {stats['workflow_metrics']['completion_rate']:.1%}",
            "",
            "Approval Metrics:",
            f"  Submitted: {stats['approval_metrics']['submitted']}",
            f"  Approved: {stats['approval_metrics']['approved']}",
            f"  Rejected: {stats['approval_metrics']['rejected']}",
            f"  Expired: {stats['approval_metrics']['expired']}",
            f"  Approval Rate: {stats['approval_metrics']['approval_rate']:.1%}",
            "",
            "Cache Metrics:",
            f"  Hits: {stats['cache_metrics']['hits']}",
            f"  Misses: {stats['cache_metrics']['misses']}",
            f"  Hit Rate: {stats['cache_metrics']['hit_rate']:.1%}",
            "",
            "Top Operations:"
        ]
        
        # Add top 5 operations by count
        op_stats = stats['operation_stats']
        sorted_ops = sorted(
            op_stats.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )[:5]
        
        for op_name, op_data in sorted_ops:
            summary_lines.append(
                f"  {op_name}: {op_data['count']} calls, "
                f"avg {op_data['avg_duration_ms']:.2f}ms, "
                f"p95 {op_data['p95_duration_ms']:.2f}ms"
            )
        
        return "\n".join(summary_lines)
    
    def reset_metrics(self) -> None:
        """Reset all performance metrics."""
        self.metrics.reset()
        logger.info("Reset performance metrics")
    
    def enable(self) -> None:
        """Enable performance monitoring."""
        self.enabled = True
        logger.info("Enabled performance monitoring")
    
    def disable(self) -> None:
        """Disable performance monitoring."""
        self.enabled = False
        logger.info("Disabled performance monitoring")
    
    # ==================== Alerting ====================
    
    def check_performance_thresholds(self) -> List[Dict[str, Any]]:
        """
        Check if any performance thresholds are exceeded.
        
        Returns:
            List of alerts for threshold violations
        """
        alerts = []
        stats = self.get_stats()
        
        # Check error rates
        for op_name, op_stats in stats['operation_stats'].items():
            if op_stats['error_rate'] > 0.05:  # 5% error rate threshold
                alerts.append({
                    "severity": "warning",
                    "type": "high_error_rate",
                    "operation": op_name,
                    "error_rate": op_stats['error_rate'],
                    "message": f"High error rate for {op_name}: {op_stats['error_rate']:.1%}"
                })
        
        # Check slow operations (p95 > 1000ms)
        for op_name, op_stats in stats['operation_stats'].items():
            if op_stats['p95_duration_ms'] > 1000:
                alerts.append({
                    "severity": "warning",
                    "type": "slow_operation",
                    "operation": op_name,
                    "p95_duration_ms": op_stats['p95_duration_ms'],
                    "message": f"Slow operation {op_name}: p95={op_stats['p95_duration_ms']:.0f}ms"
                })
        
        # Check cache hit rate
        if stats['cache_metrics']['hit_rate'] < 0.5:  # 50% threshold
            total_requests = (
                stats['cache_metrics']['hits'] + stats['cache_metrics']['misses']
            )
            if total_requests > 100:  # Only alert if significant traffic
                alerts.append({
                    "severity": "info",
                    "type": "low_cache_hit_rate",
                    "hit_rate": stats['cache_metrics']['hit_rate'],
                    "message": f"Low cache hit rate: {stats['cache_metrics']['hit_rate']:.1%}"
                })
        
        # Check workflow rejection rate
        if stats['workflow_metrics']['created'] > 10:
            rejection_rate = (
                stats['workflow_metrics']['rejected'] /
                stats['workflow_metrics']['created']
            )
            if rejection_rate > 0.3:  # 30% threshold
                alerts.append({
                    "severity": "warning",
                    "type": "high_rejection_rate",
                    "rejection_rate": rejection_rate,
                    "message": f"High workflow rejection rate: {rejection_rate:.1%}"
                })
        
        return alerts


# Global monitor instance
_performance_monitor: Optional[WorkflowPerformanceMonitor] = None


def get_performance_monitor() -> WorkflowPerformanceMonitor:
    """
    Get global performance monitor instance.
    
    Returns:
        WorkflowPerformanceMonitor instance
    """
    global _performance_monitor
    
    if _performance_monitor is None:
        _performance_monitor = WorkflowPerformanceMonitor()
    
    return _performance_monitor


def initialize_performance_monitor() -> WorkflowPerformanceMonitor:
    """
    Initialize global performance monitor.
    
    Returns:
        Initialized WorkflowPerformanceMonitor instance
    """
    global _performance_monitor
    
    _performance_monitor = WorkflowPerformanceMonitor()
    return _performance_monitor
