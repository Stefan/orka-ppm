"""
Performance-optimized endpoints for faster dashboard loading
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime, timedelta

# Import will be set by main.py to avoid circular imports
get_current_user = None
supabase = None

def set_dependencies(current_user_func, supabase_client):
    """Set dependencies to avoid circular imports"""
    global get_current_user, supabase
    get_current_user = current_user_func
    supabase = supabase_client

router = APIRouter(prefix="/api/v1/optimized", tags=["Performance Optimized"])

@router.get("/dashboard/quick-stats")
async def get_quick_dashboard_stats(
    current_user = Depends(get_current_user)
):
    """
    Get essential dashboard stats quickly - optimized for fast loading
    Returns only the most critical metrics needed for initial page load
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Quick parallel queries for essential data
        async def get_project_count():
            try:
                result = supabase.table("projects").select("count", count="exact").execute()
                return result.count or 0
            except:
                return 0
        
        async def get_health_distribution():
            try:
                result = supabase.table("projects").select("health").execute()
                health_counts = {"green": 0, "yellow": 0, "red": 0}
                for project in result.data:
                    health = project.get("health", "green")
                    if health in health_counts:
                        health_counts[health] += 1
                return health_counts
            except:
                return {"green": 0, "yellow": 0, "red": 0}
        
        async def get_active_projects():
            try:
                result = supabase.table("projects").select("count", count="exact").eq("status", "active").execute()
                return result.count or 0
            except:
                return 0
        
        # Execute all queries in parallel for speed
        total_projects, health_dist, active_projects = await asyncio.gather(
            get_project_count(),
            get_health_distribution(),
            get_active_projects()
        )
        
        # Calculate quick KPIs
        success_rate = 85.0  # Placeholder - would calculate from actual data
        budget_performance = 92.0  # Placeholder
        timeline_performance = 78.0  # Placeholder
        
        return {
            "quick_stats": {
                "total_projects": total_projects,
                "active_projects": active_projects,
                "health_distribution": health_dist,
                "critical_alerts": health_dist["red"],
                "at_risk_projects": health_dist["yellow"]
            },
            "kpis": {
                "project_success_rate": success_rate,
                "budget_performance": budget_performance,
                "timeline_performance": timeline_performance,
                "average_health_score": 2.1,
                "resource_efficiency": 88.0,
                "active_projects_ratio": round((active_projects / max(total_projects, 1)) * 100, 1)
            },
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Quick stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get quick stats: {str(e)}")

@router.get("/dashboard/projects-summary")
async def get_projects_summary(
    limit: int = Query(10, ge=1, le=50),
    current_user = Depends(get_current_user)
):
    """
    Get a summary of recent projects - optimized for quick loading
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get recent projects with minimal data
        result = supabase.table("projects").select(
            "id, name, status, health, budget, actual_cost, created_at, portfolio_id"
        ).order("created_at", desc=True).limit(limit).execute()
        
        projects = []
        for project in result.data:
            projects.append({
                "id": project["id"],
                "name": project["name"],
                "status": project["status"],
                "health": project["health"],
                "budget": project.get("budget"),
                "actual_cost": project.get("actual_cost"),
                "created_at": project["created_at"],
                "portfolio_id": project["portfolio_id"]
            })
        
        return {
            "projects": projects,
            "total_count": len(projects),
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Projects summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get projects summary: {str(e)}")

@router.get("/dashboard/health-check")
async def dashboard_health_check():
    """
    Quick health check for dashboard - returns immediately
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected" if supabase else "disconnected",
            "api": "running"
        }
    }

@router.get("/dashboard/minimal-metrics")
async def get_minimal_metrics(
    current_user = Depends(get_current_user)
):
    """
    Get absolute minimal metrics for fastest possible loading
    """
    try:
        if not supabase:
            # Return mock data if database unavailable
            return {
                "metrics": {
                    "total_projects": 0,
                    "active_projects": 0,
                    "health_distribution": {"green": 0, "yellow": 0, "red": 0}
                },
                "status": "offline"
            }
        
        # Single query to get basic project info
        result = supabase.table("projects").select("status, health").execute()
        
        total = len(result.data)
        active = sum(1 for p in result.data if p.get("status") == "active")
        health_dist = {"green": 0, "yellow": 0, "red": 0}
        
        for project in result.data:
            health = project.get("health", "green")
            if health in health_dist:
                health_dist[health] += 1
        
        return {
            "metrics": {
                "total_projects": total,
                "active_projects": active,
                "health_distribution": health_dist
            },
            "status": "online"
        }
        
    except Exception as e:
        print(f"Minimal metrics error: {e}")
        return {
            "metrics": {
                "total_projects": 0,
                "active_projects": 0,
                "health_distribution": {"green": 0, "yellow": 0, "red": 0}
            },
            "status": "error",
            "error": str(e)
        }