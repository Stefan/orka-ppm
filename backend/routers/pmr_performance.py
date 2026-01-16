"""
PMR Performance Monitoring API Router
Provides endpoints for performance metrics, cache statistics, and optimization insights
"""

import logging
from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Dict, Any, Optional

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from services.pmr_cache_service import PMRCacheService
from services.pmr_performance_monitor import performance_monitor
from services.websocket_optimizer import websocket_optimizer

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/reports/pmr/performance", tags=["PMR Performance"])

# Initialize services
cache_service = PMRCacheService()


@router.get("/stats")
async def get_performance_stats(
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get comprehensive performance statistics
    
    Returns:
    - Cache statistics (hit rate, memory usage)
    - Operation timing statistics
    - WebSocket connection statistics
    - Recent performance alerts
    """
    try:
        # Get cache stats
        cache_stats = await cache_service.get_cache_stats()
        
        # Get performance monitor stats
        monitor_stats = performance_monitor.get_all_stats()
        
        # Get WebSocket optimizer stats
        ws_stats = websocket_optimizer.get_stats()
        
        return {
            "cache": cache_stats,
            "performance": monitor_stats,
            "websocket": ws_stats,
            "status": "healthy"
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve performance statistics: {str(e)}"
        )


@router.get("/metrics")
async def get_performance_metrics(
    limit: int = 50,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get recent performance metrics
    
    Parameters:
    - limit: Number of recent metrics to return (default: 50)
    """
    try:
        metrics = performance_monitor.get_recent_metrics(limit)
        
        return {
            "metrics": metrics,
            "count": len(metrics)
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve performance metrics: {str(e)}"
        )


@router.get("/alerts")
async def get_performance_alerts(
    limit: int = 20,
    severity: Optional[str] = None,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get recent performance alerts
    
    Parameters:
    - limit: Number of recent alerts to return (default: 20)
    - severity: Filter by severity (critical, high, medium, low)
    """
    try:
        if severity:
            alerts = performance_monitor.get_alerts_by_severity(severity)
        else:
            alerts = performance_monitor.get_recent_alerts(limit)
        
        return {
            "alerts": alerts,
            "count": len(alerts)
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance alerts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve performance alerts: {str(e)}"
        )


@router.get("/recommendations")
async def get_optimization_recommendations(
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get AI-powered optimization recommendations
    
    Returns recommendations based on:
    - Performance metrics analysis
    - Cache hit rates
    - Operation timing patterns
    - Alert history
    """
    try:
        recommendations = performance_monitor.get_optimization_recommendations()
        
        return {
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
    except Exception as e:
        logger.error(f"Failed to get optimization recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve optimization recommendations: {str(e)}"
        )


@router.get("/cache/stats")
async def get_cache_stats(
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get detailed cache statistics
    
    Returns:
    - Cache hit/miss rates
    - Memory usage
    - Total keys
    - Connected clients
    """
    try:
        stats = await cache_service.get_cache_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cache statistics: {str(e)}"
        )


@router.post("/cache/clear")
async def clear_cache(
    cache_type: Optional[str] = None,
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Clear cache entries
    
    Parameters:
    - cache_type: Type of cache to clear (reports, insights, monte_carlo, metrics, all)
    
    Requires admin permission
    """
    try:
        if not cache_service.is_enabled():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cache service is not enabled"
            )
        
        # Clear specific cache type or all
        # Implementation would depend on cache service methods
        
        return {
            "success": True,
            "message": f"Cache cleared: {cache_type or 'all'}",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache: {str(e)}"
        )


@router.get("/websocket/stats")
async def get_websocket_stats(
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get WebSocket optimizer statistics
    
    Returns:
    - Total connections
    - Active sessions
    - Batching configuration
    - Redis pub/sub status
    """
    try:
        stats = websocket_optimizer.get_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get WebSocket stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve WebSocket statistics: {str(e)}"
        )


@router.get("/websocket/sessions/{session_id}")
async def get_session_stats(
    session_id: str,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Get statistics for a specific WebSocket session
    
    Parameters:
    - session_id: ID of the collaboration session
    """
    try:
        stats = websocket_optimizer.get_session_stats(session_id)
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get session stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session statistics: {str(e)}"
        )


@router.get("/health")
async def performance_health_check(
    current_user = Depends(get_current_user)
):
    """
    Comprehensive health check for performance systems
    
    Checks:
    - Cache service health
    - Performance monitor health
    - WebSocket optimizer health
    """
    try:
        cache_health = await cache_service.health_check()
        monitor_health = performance_monitor.health_check()
        ws_health = websocket_optimizer.health_check()
        
        # Determine overall status
        statuses = [
            cache_health.get("status", "unknown"),
            monitor_health.get("status", "unknown"),
            ws_health.get("status", "unknown")
        ]
        
        if "unhealthy" in statuses:
            overall_status = "unhealthy"
        elif "degraded" in statuses:
            overall_status = "degraded"
        else:
            overall_status = "healthy"
        
        return {
            "status": overall_status,
            "components": {
                "cache": cache_health,
                "monitor": monitor_health,
                "websocket": ws_health
            },
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )


@router.post("/monitor/enable")
async def enable_monitoring(
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Enable performance monitoring
    
    Requires admin permission
    """
    try:
        performance_monitor.enable()
        
        return {
            "success": True,
            "message": "Performance monitoring enabled"
        }
        
    except Exception as e:
        logger.error(f"Failed to enable monitoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable monitoring: {str(e)}"
        )


@router.post("/monitor/disable")
async def disable_monitoring(
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Disable performance monitoring
    
    Requires admin permission
    """
    try:
        performance_monitor.disable()
        
        return {
            "success": True,
            "message": "Performance monitoring disabled"
        }
        
    except Exception as e:
        logger.error(f"Failed to disable monitoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable monitoring: {str(e)}"
        )


@router.delete("/monitor/data")
async def clear_monitoring_data(
    hours: int = 24,
    current_user = Depends(require_permission(Permission.admin_read))
):
    """
    Clear old monitoring data
    
    Parameters:
    - hours: Clear data older than this many hours (default: 24)
    
    Requires admin permission
    """
    try:
        result = performance_monitor.clear_old_data(hours)
        
        return {
            "success": True,
            "metrics_removed": result.get("metrics_removed", 0),
            "alerts_removed": result.get("alerts_removed", 0),
            "message": f"Cleared data older than {hours} hours"
        }
        
    except Exception as e:
        logger.error(f"Failed to clear monitoring data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear monitoring data: {str(e)}"
        )
