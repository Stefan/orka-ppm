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
from config.database import supabase, service_supabase
from models.projects import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectStatus
from services.project_sync import run_sync
from models.base import HealthIndicator
from utils.converters import convert_uuids

router = APIRouter(prefix="/projects", tags=["projects"])

PROJECTS_CACHE_KEY_PREFIX = "projects:list"
PROJECTS_CACHE_TTL = 120  # seconds

def _projects_cache_key(org_id: str, offset: int, limit: int) -> str:
    """Build cache key for projects list (idempotent for same inputs)."""
    return f"{PROJECTS_CACHE_KEY_PREFIX}:{org_id}:{offset}:{limit}"


def _invalidate_projects_cache(request: Request) -> None:
    """Invalidate all projects list cache entries after create/update/delete."""
    cache = getattr(request.app.state, "cache_manager", None)
    if cache:
        try:
            import asyncio
            asyncio.create_task(cache.clear_pattern(f"{PROJECTS_CACHE_KEY_PREFIX}:*"))
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
        if project_data.get('program_id') is not None:
            project_data['program_id'] = str(project_data['program_id'])
        
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
    limit: int = Query(100, ge=1, le=500, description="Max number of projects to return"),
    offset: int = Query(0, ge=0, description="Number of projects to skip"),
    portfolio_id: Optional[UUID] = Query(None),
    status: Optional[ProjectStatus] = Query(None),
    count_exact: bool = Query(False, description="Request exact total count (expensive); use only when needed for pagination"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get projects with optional filtering and pagination. Uses cache (TTL 120s); invalidated on project create/update/delete. Default count_exact=false for faster response."""
    # #region agent log
    import json, time
    _t0 = time.perf_counter()
    try:
        with open("/Users/stefan/Projects/orka-ppm/.cursor/debug.log", "a") as _f: _f.write(json.dumps({"timestamp": int(time.time()*1000), "location": "projects.py:list_projects:entry", "message": "list_projects_start", "data": {"limit": limit, "offset": offset}, "hypothesisId": "A"}) + "\n")
    except Exception: pass
    # #endregion
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        org_id = (current_user.get("organization_id") or current_user.get("tenant_id") or "default")
        if isinstance(org_id, UUID):
            org_id = str(org_id)
        cache = getattr(request.app.state, "cache_manager", None)
        cache_key = f"{_projects_cache_key(org_id, offset, limit)}:{count_exact}"
        data = None
        if cache:
            data = await cache.get(cache_key)
        # #region agent log
        try:
            with open("/Users/stefan/Projects/orka-ppm/.cursor/debug.log", "a") as _f: _f.write(json.dumps({"timestamp": int(time.time()*1000), "location": "projects.py:list_projects:after_cache", "message": "after_cache_get", "data": {"elapsed_ms": round((time.perf_counter()-_t0)*1000), "cache_hit": data is not None}, "hypothesisId": "C"}) + "\n")
        except Exception: pass
        # #endregion
        if data is None:
            select_cols = "id", "name", "status", "portfolio_id", "program_id", "health", "budget", "actual_cost", "start_date", "end_date", "created_at", "updated_at", "description"
            if count_exact:
                query = supabase.table("projects").select(*select_cols, count="exact")
            else:
                query = supabase.table("projects").select(*select_cols)
            if portfolio_id is not None:
                query = query.eq("portfolio_id", str(portfolio_id))
            if status is not None:
                query = query.eq("status", status.value)
            response = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
            items = convert_uuids(response.data)
            if count_exact and hasattr(response, "count") and response.count is not None:
                total = response.count
            else:
                total = offset + len(items) if items else 0
            if cache:
                await cache.set(cache_key, {"items": items, "total": total}, ttl=PROJECTS_CACHE_TTL)
            data = {"items": items, "total": total}
            # #region agent log
            try:
                with open("/Users/stefan/Projects/orka-ppm/.cursor/debug.log", "a") as _f: _f.write(json.dumps({"timestamp": int(time.time()*1000), "location": "projects.py:list_projects:after_db", "message": "after_db_query", "data": {"elapsed_ms": round((time.perf_counter()-_t0)*1000), "items_count": len(items)}, "hypothesisId": "A"}) + "\n")
            except Exception: pass
            # #endregion
        if isinstance(data, dict):
            items = data.get("items", data)
            total = data.get("total")
        else:
            items = data
            total = len(items) if items else 0
        # #region agent log
        try:
            with open("/Users/stefan/Projects/orka-ppm/.cursor/debug.log", "a") as _f: _f.write(json.dumps({"timestamp": int(time.time()*1000), "location": "projects.py:list_projects:exit", "message": "list_projects_done", "data": {"total_ms": round((time.perf_counter()-_t0)*1000)}, "hypothesisId": "A"}) + "\n")
        except Exception: pass
        # #endregion
        return {"items": items, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel as PydanticBase


class SyncRequest(PydanticBase):
    source: str = "mock"
    portfolio_id: UUID
    program_id: Optional[UUID] = None
    dry_run: bool = True


@router.post("/sync")
async def projects_sync(
    payload: SyncRequest,
    current_user=Depends(require_permission(Permission.project_create)),
):
    """Sync projects from external source (e.g. Roche); AI-matching for commitments/actuals. Returns created + matched with score."""
    db = service_supabase if service_supabase else supabase
    if not db:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    try:
        result = await run_sync(
            db,
            source=payload.source,
            portfolio_id=str(payload.portfolio_id),
            program_id=str(payload.program_id) if payload.program_id else None,
            dry_run=payload.dry_run,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Projects sync failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user=Depends(require_permission(Permission.project_read))
):
    """Get a specific project"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    request: Request,
    project_id: UUID,
    payload: ProjectUpdate,
    current_user=Depends(require_permission(Permission.project_update))
):
    """Partial update (e.g. program_id for drag-drop)."""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        data = payload.dict(exclude_unset=True)
        if not data:
            response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
            if not response.data:
                raise HTTPException(status_code=404, detail="Project not found")
            return convert_uuids(response.data[0])
        for key in ("program_id", "manager_id"):
            if key in data and data[key] is not None:
                data[key] = str(data[key])
        if "team_members" in data and data["team_members"] is not None:
            data["team_members"] = [str(u) for u in data["team_members"]]
        response = supabase.table("projects").update(data).eq("id", str(project_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        _invalidate_projects_cache(request)
        return convert_uuids(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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