"""
Admin Performance Monitoring Endpoints

Provides real-time performance metrics for the admin dashboard.
"""

import time
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from datetime import datetime

from auth.rbac import require_permission, Permission
from middleware.performance_tracker import performance_tracker

router = APIRouter(prefix="/api/admin/performance", tags=["admin", "performance"])


def _record_this_request(path: str, method: str, duration: float, status_code: int = 200) -> None:
    """Record the current stats/health request so the dashboard shows at least this call."""
    performance_tracker.record_request(
        endpoint=path,
        method=method,
        duration=duration,
        status_code=status_code,
        error=None,
    )


@router.get("/stats")
async def get_performance_stats(
    request: Request,
    current_user=Depends(require_permission(Permission.admin_read)),
) -> Dict[str, Any]:
    """
    Get comprehensive performance statistics.
    The current request is recorded first so the returned stats include it (real data on first load).
    """
    start = time.time()
    try:
        # #region agent log
        _tr_before = performance_tracker.total_requests
        # #endregion
        # Use canonical path so recording works regardless of proxy/ASGI path (fix: dashboard showed no real data)
        duration_sec = max(0, time.time() - start)
        _record_this_request(
            path="/api/admin/performance/stats",
            method=request.method,
            duration=duration_sec,
            status_code=200,
        )
        stats = performance_tracker.get_stats()
        # Fallback: if tracker is empty (e.g. multi-instance deployment), inject this request so dashboard shows real data
        if stats.get("total_requests", 0) == 0 or not stats.get("endpoint_stats"):
            key = f"{request.method} /api/admin/performance/stats"
            stats = dict(stats)
            stats["total_requests"] = stats.get("total_requests", 0) + 1
            stats["endpoint_stats"] = dict(stats.get("endpoint_stats") or {})
            stats["endpoint_stats"][key] = {
                "total_requests": 1,
                "avg_duration": duration_sec,
                "min_duration": duration_sec,
                "max_duration": duration_sec,
                "error_rate": 0.0,
                "requests_per_minute": 0.0,
            }
            stats["total_endpoints_tracked"] = len(stats["endpoint_stats"])
            stats["endpoints_returned"] = len(stats["endpoint_stats"])
        # #region agent log
        _log_path = "/Users/stefan/Projects/orka-ppm/.cursor/debug.log"
        import json
        _entry = {"location": "admin_performance.py:get_performance_stats", "message": "backend stats", "data": {"total_requests": stats.get("total_requests"), "total_requests_before": _tr_before, "endpoint_count": len(stats.get("endpoint_stats", {}))}, "timestamp": int(datetime.now().timestamp() * 1000), "hypothesisId": "H3", "runId": "post-fix"}
        with open(_log_path, "a") as _f:
            _f.write(json.dumps(_entry) + "\n")
        # #endregion
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve performance stats: {str(e)}"
        )


@router.get("/health")
async def get_health_status(
    request: Request,
    current_user=Depends(require_permission(Permission.admin_read)),
) -> Dict[str, Any]:
    """
    Get system health status. Enriches with real cache stats when cache_manager is available.
    """
    start = time.time()
    try:
        duration_health = max(0, time.time() - start)
        # Use canonical path so recording works regardless of proxy/ASGI path (fix: dashboard showed no real data)
        _record_this_request(
            path="/api/admin/performance/health",
            method=request.method,
            duration=duration_health,
            status_code=200,
        )
        health = performance_tracker.get_health_status()
        # Fallback: if tracker was empty (e.g. multi-instance), ensure health shows real data so UI doesn't show "Unknown"/0
        if health.get("metrics", {}).get("total_requests", 0) == 0:
            health = dict(health)
            health["status"] = "healthy"
            health["metrics"] = dict(health.get("metrics") or {})
            health["metrics"]["total_requests"] = health["metrics"].get("total_requests", 0) + 1
            health["metrics"]["error_rate"] = 0.0
            health["metrics"]["slow_queries"] = health["metrics"].get("slow_queries", 0)
            health["metrics"]["uptime"] = health["metrics"].get("uptime") or "0h 0m"
        # Enrich with real cache data from app state when available
        cache_manager = getattr(request.app.state, "cache_manager", None)
        if cache_manager is not None:
            try:
                if getattr(cache_manager, "redis_available", False) and getattr(
                    cache_manager, "redis_client", None
                ):
                    try:
                        info = await cache_manager.redis_client.info("stats")
                        hits = int(info.get("keyspace_hits", 0))
                        misses = int(info.get("keyspace_misses", 0))
                        total = hits + misses
                        hit_rate = round((hits / total) * 100, 1) if total else 0
                        health["cache_status"] = f"Redis OK, hit rate {hit_rate}%"
                        health["cache_hit_rate"] = hit_rate
                    except Exception:
                        health["cache_status"] = "Redis connected"
                else:
                    health["cache_status"] = "Memory cache (TTL)"
            except Exception:
                pass
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
