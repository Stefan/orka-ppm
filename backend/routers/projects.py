"""
Project management endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from uuid import UUID
from typing import Optional

from auth.rbac import require_permission, Permission

logger = logging.getLogger(__name__)
from auth.dependencies import get_current_user
from config.database import supabase
from models.projects import ProjectCreate, ProjectResponse, ProjectStatus
from models.base import HealthIndicator
from utils.converters import convert_uuids

router = APIRouter(prefix="/projects", tags=["projects"])

PROJECTS_CACHE_KEY = "projects:list"
PROJECTS_CACHE_TTL = 60  # seconds

def _invalidate_projects_cache(request: Request) -> None:
    """Invalidate projects list cache after create/update/delete."""
    cache = getattr(request.app.state, "cache_manager", None)
    if cache:
        try:
            import asyncio
            asyncio.create_task(cache.delete(PROJECTS_CACHE_KEY))
        except Exception:
            pass


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    request: Request,
    project: ProjectCreate,
    current_user = Depends(require_permission(Permission.project_create))
):
    """Create a new project"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        project_data = project.dict()
        project_data['health'] = HealthIndicator.green.value
        
        response = supabase.table("projects").insert(project_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create project")
        
        _invalidate_projects_cache(request)
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
async def list_projects(
    request: Request,
    portfolio_id: Optional[UUID] = Query(None),
    status: Optional[ProjectStatus] = Query(None),
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get all projects with optional filtering. Uses cache (TTL 60s); invalidated on project create."""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        cache = getattr(request.app.state, "cache_manager", None)
        data = None
        if cache:
            data = await cache.get(PROJECTS_CACHE_KEY)
        if data is None:
            response = supabase.table("projects").select(
                "id", "name", "status", "portfolio_id", "health", "budget", "actual_cost",
                "start_date", "end_date", "created_at", "updated_at", "description"
            ).execute()
            data = convert_uuids(response.data)
            if cache:
                await cache.set(PROJECTS_CACHE_KEY, data, ttl=PROJECTS_CACHE_TTL)
        if portfolio_id is not None:
            pid = str(portfolio_id)
            data = [p for p in data if p.get("portfolio_id") == pid]
        if status is not None:
            data = [p for p in data if p.get("status") == status.value]
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID, 
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get a specific project"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/scenarios")
async def get_project_scenarios(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get scenarios for a specific project - Frontend compatibility endpoint"""
    try:
        if not supabase:
            # Return mock data for development when database is unavailable
            mock_scenarios = [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "project_id": str(project_id),
                    "name": "Budget Increase Scenario",
                    "description": "What if we increase the budget by 20%?",
                    "base_scenario_id": None,
                    "parameter_changes": {
                        "budget": 120000,
                        "resource_allocations": {"developers": 5, "designers": 2}
                    },
                    "timeline_impact": {
                        "original_duration": 90,
                        "new_duration": 75,
                        "duration_change": -15,
                        "critical_path_affected": True,
                        "affected_milestones": ["Phase 1 Complete", "Beta Release"]
                    },
                    "cost_impact": {
                        "original_cost": 100000,
                        "new_cost": 120000,
                        "cost_change": 20000,
                        "cost_change_percentage": 20.0,
                        "affected_categories": ["Personnel", "Equipment"]
                    },
                    "resource_impact": {
                        "utilization_changes": {"developers": 0.2, "designers": 0.1},
                        "over_allocated_resources": [],
                        "under_allocated_resources": ["qa_engineers"],
                        "new_resource_requirements": ["senior_developer"]
                    },
                    "created_by": current_user.get("user_id", "mock-user"),
                    "created_at": "2024-01-01T10:00:00Z",
                    "updated_at": "2024-01-01T10:00:00Z",
                    "is_active": True,
                    "is_baseline": False
                },
                {
                    "id": "550e8400-e29b-41d4-a716-446655440002",
                    "project_id": str(project_id),
                    "name": "Accelerated Timeline",
                    "description": "What if we need to deliver 30 days earlier?",
                    "base_scenario_id": None,
                    "parameter_changes": {
                        "end_date": "2024-06-01",
                        "resource_allocations": {"developers": 8, "designers": 3}
                    },
                    "timeline_impact": {
                        "original_duration": 90,
                        "new_duration": 60,
                        "duration_change": -30,
                        "critical_path_affected": True,
                        "affected_milestones": ["All milestones"]
                    },
                    "cost_impact": {
                        "original_cost": 100000,
                        "new_cost": 135000,
                        "cost_change": 35000,
                        "cost_change_percentage": 35.0,
                        "affected_categories": ["Personnel", "Overtime"]
                    },
                    "resource_impact": {
                        "utilization_changes": {"developers": 0.6, "designers": 0.5},
                        "over_allocated_resources": ["developers", "designers"],
                        "under_allocated_resources": [],
                        "new_resource_requirements": ["additional_developers", "project_coordinator"]
                    },
                    "created_by": current_user.get("user_id", "mock-user"),
                    "created_at": "2024-01-02T14:30:00Z",
                    "updated_at": "2024-01-02T14:30:00Z",
                    "is_active": True,
                    "is_baseline": False
                }
            ]
            
            return {
                "project_id": str(project_id),
                "scenarios": mock_scenarios,
                "total_count": len(mock_scenarios)
            }
        
        # Try to get scenarios from the database
        response = supabase.table("scenario_analyses").select("*").eq(
            "project_id", str(project_id)
        ).eq("is_active", True).order("created_at", desc=True).limit(limit).execute()
        
        scenarios = response.data or []
        
        return {
            "project_id": str(project_id),
            "scenarios": scenarios,
            "total_count": len(scenarios)
        }
        
    except Exception as e:
        logger.exception("Get project scenarios error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get scenarios: {str(e)}")