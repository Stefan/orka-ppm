"""
Workflow Metrics API Endpoints

Provides API endpoints for accessing workflow performance metrics,
monitoring data, and performance dashboards.
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from services.workflow_performance_monitor import get_performance_monitor
from services.workflow_cache import get_workflow_cache
from auth.dependencies import require_permission, Permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-metrics", tags=["workflow-metrics"])


# ==================== Response Models ====================

class PerformanceStatsResponse(BaseModel):
    """Performance statistics response."""
    uptime_seconds: float
    throughput_per_minute: int
    workflow_metrics: Dict[str, Any]
    approval_metrics: Dict[str, Any]
    cache_metrics: Dict[str, Any]
    operation_stats: Dict[str, Any]


class OperationStatsResponse(BaseModel):
    """Operation statistics response."""
    operation: str
    count: int
    errors: int
    error_rate: float
    avg_duration_ms: float
    min_duration_ms: float
    max_duration_ms: float
    p50_duration_ms: float
    p95_duration_ms: float
    p99_duration_ms: float


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""
    size: int
    max_size: int
    hits: int
    misses: int
    hit_rate: float
    evictions: int
    invalidations: int


class PerformanceAlertResponse(BaseModel):
    """Performance alert response."""
    severity: str
    type: str
    message: str
    details: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    uptime_seconds: float
    workflows_active: int
    approvals_pending: int
    cache_hit_rate: float
    alerts: List[PerformanceAlertResponse]


# ==================== Endpoints ====================

@router.get("/stats", response_model=PerformanceStatsResponse)
async def get_performance_stats(
    current_user = Depends(require_permission(Permission.workflow_read))
) -> Dict[str, Any]:
    """
    Get comprehensive performance statistics.
    
    Returns detailed performance metrics including:
    - Workflow lifecycle metrics
    - Approval metrics
    - Cache performance
    - Operation timing statistics
    
    Requires: workflow_read permission
    """
    try:
        monitor = get_performance_monitor()
        stats = monitor.get_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting performance stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance stats: {str(e)}"
        )


@router.get("/stats/operation/{operation}", response_model=OperationStatsResponse)
async def get_operation_stats(
    operation: str,
    current_user = Depends(require_permission(Permission.workflow_read))
) -> Dict[str, Any]:
    """
    Get statistics for a specific operation.
    
    Args:
        operation: Operation name
    
    Returns operation-specific metrics including:
    - Call count and error rate
    - Timing percentiles (p50, p95, p99)
    - Min/max/average duration
    
    Requires: workflow_read permission
    """
    try:
        monitor = get_performance_monitor()
        stats = monitor.get_operation_stats(operation)
        
        if stats['count'] == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No statistics found for operation: {operation}"
            )
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting operation stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get operation stats: {str(e)}"
        )


@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats(
    current_user = Depends(require_permission(Permission.workflow_read))
) -> Dict[str, Any]:
    """
    Get cache performance statistics.
    
    Returns cache metrics including:
    - Cache size and capacity
    - Hit/miss rates
    - Eviction and invalidation counts
    
    Requires: workflow_read permission
    """
    try:
        cache = get_workflow_cache()
        stats = cache.get_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )


@router.post("/cache/clear")
async def clear_cache(
    current_user = Depends(require_permission(Permission.workflow_manage))
) -> Dict[str, str]:
    """
    Clear all cache entries.
    
    This will force all subsequent requests to fetch fresh data from the database.
    Use with caution as it may temporarily impact performance.
    
    Requires: workflow_manage permission
    """
    try:
        cache = get_workflow_cache()
        cache.clear()
        
        logger.info(f"Cache cleared by user {current_user}")
        
        return {
            "status": "success",
            "message": "Cache cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.post("/cache/cleanup")
async def cleanup_expired_cache(
    current_user = Depends(require_permission(Permission.workflow_manage))
) -> Dict[str, Any]:
    """
    Remove expired entries from cache.
    
    This performs cache maintenance by removing entries that have exceeded their TTL.
    
    Requires: workflow_manage permission
    """
    try:
        cache = get_workflow_cache()
        removed_count = cache.cleanup_expired()
        
        logger.info(f"Cache cleanup performed by user {current_user}, removed {removed_count} entries")
        
        return {
            "status": "success",
            "removed_count": removed_count,
            "message": f"Removed {removed_count} expired cache entries"
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup cache: {str(e)}"
        )


@router.get("/alerts", response_model=List[PerformanceAlertResponse])
async def get_performance_alerts(
    current_user = Depends(require_permission(Permission.workflow_read))
) -> List[Dict[str, Any]]:
    """
    Get current performance alerts.
    
    Returns alerts for:
    - High error rates
    - Slow operations
    - Low cache hit rates
    - High workflow rejection rates
    
    Requires: workflow_read permission
    """
    try:
        monitor = get_performance_monitor()
        alerts = monitor.check_performance_thresholds()
        
        # Format alerts for response
        formatted_alerts = []
        for alert in alerts:
            formatted_alert = {
                "severity": alert["severity"],
                "type": alert["type"],
                "message": alert["message"],
                "details": {
                    k: v for k, v in alert.items()
                    if k not in ["severity", "type", "message"]
                }
            }
            formatted_alerts.append(formatted_alert)
        
        return formatted_alerts
        
    except Exception as e:
        logger.error(f"Error getting performance alerts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance alerts: {str(e)}"
        )


@router.get("/health", response_model=HealthCheckResponse)
async def health_check() -> Dict[str, Any]:
    """
    Workflow engine health check.
    
    Returns health status including:
    - Overall status (healthy/degraded/unhealthy)
    - Uptime
    - Active workflows and pending approvals
    - Cache performance
    - Current alerts
    
    This endpoint does not require authentication for monitoring purposes.
    """
    try:
        monitor = get_performance_monitor()
        stats = monitor.get_stats()
        alerts = monitor.check_performance_thresholds()
        
        # Determine health status based on alerts
        critical_alerts = [a for a in alerts if a["severity"] == "critical"]
        warning_alerts = [a for a in alerts if a["severity"] == "warning"]
        
        if critical_alerts:
            status = "unhealthy"
        elif warning_alerts:
            status = "degraded"
        else:
            status = "healthy"
        
        # Format alerts
        formatted_alerts = [
            {
                "severity": alert["severity"],
                "type": alert["type"],
                "message": alert["message"],
                "details": {
                    k: v for k, v in alert.items()
                    if k not in ["severity", "type", "message"]
                }
            }
            for alert in alerts
        ]
        
        return {
            "status": status,
            "uptime_seconds": stats["uptime_seconds"],
            "workflows_active": (
                stats["workflow_metrics"]["created"] -
                stats["workflow_metrics"]["completed"] -
                stats["workflow_metrics"]["rejected"] -
                stats["workflow_metrics"]["cancelled"]
            ),
            "approvals_pending": stats["approval_metrics"]["submitted"] - (
                stats["approval_metrics"]["approved"] +
                stats["approval_metrics"]["rejected"] +
                stats["approval_metrics"]["expired"]
            ),
            "cache_hit_rate": stats["cache_metrics"]["hit_rate"],
            "alerts": formatted_alerts
        }
        
    except Exception as e:
        logger.error(f"Error performing health check: {e}")
        return {
            "status": "unhealthy",
            "uptime_seconds": 0,
            "workflows_active": 0,
            "approvals_pending": 0,
            "cache_hit_rate": 0,
            "alerts": [{
                "severity": "critical",
                "type": "health_check_failed",
                "message": f"Health check failed: {str(e)}",
                "details": {}
            }]
        }


@router.get("/summary")
async def get_performance_summary(
    current_user = Depends(require_permission(Permission.workflow_read))
) -> Dict[str, str]:
    """
    Get human-readable performance summary.
    
    Returns a formatted text summary of workflow engine performance.
    
    Requires: workflow_read permission
    """
    try:
        monitor = get_performance_monitor()
        summary = monitor.get_summary()
        
        return {
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error getting performance summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance summary: {str(e)}"
        )


@router.post("/metrics/reset")
async def reset_metrics(
    current_user = Depends(require_permission(Permission.workflow_manage))
) -> Dict[str, str]:
    """
    Reset all performance metrics.
    
    This clears all collected metrics and restarts tracking from zero.
    Use with caution as historical data will be lost.
    
    Requires: workflow_manage permission
    """
    try:
        monitor = get_performance_monitor()
        monitor.reset_metrics()
        
        logger.info(f"Performance metrics reset by user {current_user}")
        
        return {
            "status": "success",
            "message": "Performance metrics reset successfully"
        }
        
    except Exception as e:
        logger.error(f"Error resetting metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset metrics: {str(e)}"
        )


@router.get("/dashboard")
async def get_performance_dashboard(
    current_user = Depends(require_permission(Permission.workflow_read))
) -> Dict[str, Any]:
    """
    Get comprehensive performance dashboard data.
    
    Returns all data needed for a performance monitoring dashboard:
    - Overall statistics
    - Top operations by volume and latency
    - Current alerts
    - Cache performance
    - Workflow and approval metrics
    
    Requires: workflow_read permission
    """
    try:
        monitor = get_performance_monitor()
        cache = get_workflow_cache()
        
        stats = monitor.get_stats()
        cache_stats = cache.get_stats()
        alerts = monitor.check_performance_thresholds()
        
        # Get top operations by count
        op_stats = stats['operation_stats']
        top_by_count = sorted(
            op_stats.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )[:10]
        
        # Get slowest operations by p95
        top_by_latency = sorted(
            op_stats.items(),
            key=lambda x: x[1]['p95_duration_ms'],
            reverse=True
        )[:10]
        
        # Format alerts
        formatted_alerts = [
            {
                "severity": alert["severity"],
                "type": alert["type"],
                "message": alert["message"],
                "details": {
                    k: v for k, v in alert.items()
                    if k not in ["severity", "type", "message"]
                }
            }
            for alert in alerts
        ]
        
        return {
            "overview": {
                "uptime_seconds": stats["uptime_seconds"],
                "throughput_per_minute": stats["throughput_per_minute"],
                "total_operations": sum(
                    op['count'] for op in op_stats.values()
                ),
                "total_errors": sum(
                    op['errors'] for op in op_stats.values()
                )
            },
            "workflows": stats["workflow_metrics"],
            "approvals": stats["approval_metrics"],
            "cache": cache_stats,
            "top_operations_by_count": [
                {"operation": op, **data}
                for op, data in top_by_count
            ],
            "slowest_operations": [
                {"operation": op, **data}
                for op, data in top_by_latency
            ],
            "alerts": formatted_alerts
        }
        
    except Exception as e:
        logger.error(f"Error getting performance dashboard: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance dashboard: {str(e)}"
        )
