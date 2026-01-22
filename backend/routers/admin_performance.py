"""
Admin Performance Monitoring Endpoints

Provides real-time performance metrics for the admin dashboard.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from datetime import datetime

from auth.rbac import require_permission, Permission
from middleware.performance_tracker import performance_tracker

router = APIRouter(prefix="/api/admin/performance", tags=["admin", "performance"])


@router.get("/stats")
async def get_performance_stats(
    current_user=Depends(require_permission(Permission.admin_read))
) -> Dict[str, Any]:
    """
    Get comprehensive performance statistics.
    
    Returns:
        - Total requests count
        - Total errors count
        - Slow queries count
        - Per-endpoint statistics (requests, avg duration, error rate, RPM)
        - Recent slow queries
        - System uptime
    
    Requires: Admin read permission
    """
    try:
        stats = performance_tracker.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve performance stats: {str(e)}"
        )


@router.get("/health")
async def get_health_status(
    current_user=Depends(require_permission(Permission.admin_read))
) -> Dict[str, Any]:
    """
    Get system health status based on performance metrics.
    
    Returns:
        - Health status (healthy, degraded, unhealthy)
        - Current timestamp
        - Key metrics (total requests, error rate, slow queries, uptime)
        - Cache status
    
    Requires: Admin read permission
    """
    try:
        health = performance_tracker.get_health_status()
        return health
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve health status: {str(e)}"
        )


@router.post("/reset")
async def reset_performance_stats(
    current_user=Depends(require_permission(Permission.system_admin))
) -> Dict[str, str]:
    """
    Reset all performance statistics.
    
    This clears all tracked metrics and starts fresh.
    Useful for testing or after maintenance.
    
    Requires: System admin permission
    """
    try:
        performance_tracker.reset_stats()
        return {
            "message": "Performance statistics reset successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset performance stats: {str(e)}"
        )


@router.get("/slow-queries")
async def get_slow_queries(
    limit: int = 20,
    current_user=Depends(require_permission(Permission.admin_read))
) -> Dict[str, Any]:
    """
    Get recent slow queries.
    
    Args:
        limit: Maximum number of slow queries to return (default: 20)
    
    Returns:
        List of slow queries with endpoint, duration, timestamp, and error info
    
    Requires: Admin read permission
    """
    try:
        stats = performance_tracker.get_stats()
        slow_queries = stats.get('recent_slow_queries', [])
        
        # Return most recent queries up to limit
        return {
            'slow_queries': slow_queries[-limit:],
            'total_count': len(performance_tracker.slow_queries),
            'threshold_seconds': performance_tracker.slow_query_threshold
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve slow queries: {str(e)}"
        )
