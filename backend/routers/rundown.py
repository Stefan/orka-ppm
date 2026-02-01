"""
Rundown Profiles API Router
API endpoints for contingency rundown profile generation and retrieval
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import logging

from supabase import Client
from auth.dependencies import get_current_user
from config.database import supabase
from services.rundown_generator import RundownGenerator, RundownGeneratorError

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/rundown",
    tags=["rundown"],
    responses={404: {"description": "Not found"}}
)


# ============================================
# Request/Response Models
# ============================================

class GenerateRequest(BaseModel):
    """Request body for profile generation"""
    project_id: Optional[str] = Field(
        None,
        description="Optional project ID. If not provided, generates for all projects."
    )
    profile_types: Optional[List[Literal["standard", "optimistic", "pessimistic"]]] = Field(
        default=["standard"],
        description="Types of profiles to generate"
    )
    scenario_name: Optional[str] = Field(
        default="baseline",
        description="Name of the scenario"
    )
    include_predictions: Optional[bool] = Field(
        default=True,
        description="Whether to include AI predictions"
    )


class GenerationError(BaseModel):
    """Error details from generation"""
    project_id: str
    project_name: Optional[str] = None
    error_type: str
    error_message: str
    timestamp: str


class GenerateResponse(BaseModel):
    """Response from profile generation"""
    execution_id: str
    status: Literal["started", "completed", "failed", "partial"]
    projects_processed: int
    profiles_created: int
    errors_count: int
    execution_time_ms: int
    errors: List[GenerationError]
    timestamp: str


class RundownProfile(BaseModel):
    """A single rundown profile data point"""
    id: str
    project_id: str
    month: str
    planned_value: float
    actual_value: float
    predicted_value: Optional[float] = None
    profile_type: str
    scenario_name: str
    created_at: datetime
    updated_at: datetime


class ProfilesResponse(BaseModel):
    """Response containing profile data"""
    project_id: str
    profiles: List[RundownProfile]
    total_count: int


class GenerationStatusResponse(BaseModel):
    """Status of profile generation"""
    last_execution_id: Optional[str] = None
    last_status: Optional[str] = None
    last_timestamp: Optional[datetime] = None
    projects_with_profiles: int
    total_profiles: int
    is_generating: bool = False


class RundownSummary(BaseModel):
    """Summary of rundown profiles for a project"""
    project_id: str
    project_name: str
    total_points: int
    start_month: str
    end_month: str
    current_planned: float
    current_actual: float
    current_predicted: Optional[float] = None
    variance: float
    variance_percentage: float
    is_over_budget: bool
    last_updated: datetime


# ============================================
# Background task for generation
# ============================================

async def run_generation_task(
    generator: RundownGenerator,
    project_id: Optional[str],
    profile_types: List[str],
    scenario_name: str,
    include_predictions: bool
):
    """Background task to run profile generation."""
    try:
        await generator.generate(
            project_id=project_id,
            profile_types=profile_types,
            scenario_name=scenario_name,
            include_predictions=include_predictions
        )
    except Exception as e:
        logger.error(f"Background generation task failed: {e}")


# ============================================
# API Endpoints
# ============================================

@router.post(
    "/generate",
    response_model=GenerateResponse,
    summary="Generate rundown profiles",
    description="""
    Generate or regenerate rundown profiles for projects.
    
    If project_id is provided, generates profiles for that specific project only.
    Otherwise, generates profiles for all active projects.
    
    The generation calculates:
    - Planned profile: Linear budget distribution over project duration
    - Actual profile: Adjusted values based on commitments and actuals
    - Predicted profile: AI-based predictions using linear regression
    """
)
async def generate_profiles(
    request: GenerateRequest,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate rundown profiles for one or all projects."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    generator = RundownGenerator(supabase)
    
    try:
        result = await generator.generate(
            project_id=request.project_id,
            profile_types=request.profile_types or ["standard"],
            scenario_name=request.scenario_name or "baseline",
            include_predictions=request.include_predictions if request.include_predictions is not None else True
        )
        
        return GenerateResponse(
            execution_id=result["execution_id"],
            status=result["status"],
            projects_processed=result["projects_processed"],
            profiles_created=result["profiles_created"],
            errors_count=result["errors_count"],
            execution_time_ms=result["execution_time_ms"],
            errors=[GenerationError(**e) for e in result.get("errors", [])],
            timestamp=result["timestamp"]
        )
        
    except RundownGeneratorError as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in generation: {e}")
        raise HTTPException(status_code=500, detail="Profile generation failed")


@router.post(
    "/generate/async",
    summary="Start async profile generation",
    description="Start profile generation in the background and return immediately."
)
async def generate_profiles_async(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start profile generation as a background task."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    generator = RundownGenerator(supabase)
    
    background_tasks.add_task(
        run_generation_task,
        generator,
        request.project_id,
        request.profile_types or ["standard"],
        request.scenario_name or "baseline",
        request.include_predictions if request.include_predictions is not None else True
    )
    
    return {
        "message": "Profile generation started",
        "execution_id": generator.execution_id
    }


@router.get(
    "/profiles/{project_id}",
    response_model=ProfilesResponse,
    summary="Get rundown profiles for a project",
    description="Retrieve all rundown profiles for a specific project."
)
async def get_project_profiles(
    project_id: str,
    profile_type: Optional[str] = Query(
        None,
        description="Filter by profile type"
    ),
    scenario_name: Optional[str] = Query(
        "baseline",
        description="Filter by scenario name"
    ),
    from_month: Optional[str] = Query(
        None,
        description="Start month (YYYYMM format)"
    ),
    to_month: Optional[str] = Query(
        None,
        description="End month (YYYYMM format)"
    ),
    current_user: dict = Depends(get_current_user)
):
    """Get rundown profiles for a specific project."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        query = supabase.table("rundown_profiles").select("*").eq(
            "project_id", project_id
        )
        
        if profile_type:
            query = query.eq("profile_type", profile_type)
        if scenario_name:
            query = query.eq("scenario_name", scenario_name)
        if from_month:
            query = query.gte("month", from_month)
        if to_month:
            query = query.lte("month", to_month)
            
        query = query.order("month")
        
        response = query.execute()
        profiles = response.data or []
        
        return ProfilesResponse(
            project_id=project_id,
            profiles=[RundownProfile(**p) for p in profiles],
            total_count=len(profiles)
        )
        
    except Exception as e:
        logger.error(f"Error fetching profiles for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profiles")


@router.get(
    "/profiles",
    summary="Get rundown profiles for multiple projects",
    description="Retrieve rundown profiles for multiple projects at once."
)
async def get_multiple_profiles(
    project_ids: List[str] = Query(
        ...,
        description="List of project IDs"
    ),
    profile_type: Optional[str] = Query(
        "standard",
        description="Filter by profile type"
    ),
    scenario_name: Optional[str] = Query(
        "baseline",
        description="Filter by scenario name"
    ),
    current_user: dict = Depends(get_current_user)
):
    """Get rundown profiles for multiple projects."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        query = supabase.table("rundown_profiles").select("*").in_(
            "project_id", project_ids
        )
        
        if profile_type:
            query = query.eq("profile_type", profile_type)
        if scenario_name:
            query = query.eq("scenario_name", scenario_name)
            
        query = query.order("project_id").order("month")
        
        response = query.execute()
        profiles = response.data or []
        
        # Group by project
        grouped = {}
        for profile in profiles:
            pid = profile["project_id"]
            if pid not in grouped:
                grouped[pid] = []
            grouped[pid].append(profile)
            
        return {
            "profiles_by_project": grouped,
            "total_profiles": len(profiles),
            "projects_count": len(grouped)
        }
        
    except Exception as e:
        logger.error(f"Error fetching multiple profiles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profiles")


@router.get(
    "/summary/{project_id}",
    response_model=RundownSummary,
    summary="Get rundown summary for a project",
    description="Get a summary of the rundown profiles for a project."
)
async def get_project_summary(
    project_id: str,
    scenario_name: Optional[str] = Query("baseline"),
    current_user: dict = Depends(get_current_user)
):
    """Get rundown summary for a specific project."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        # Fetch project info
        project_response = supabase.table("projects").select(
            "id, name"
        ).eq("id", project_id).single().execute()
        
        project = project_response.data
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Fetch profiles
        profiles_response = supabase.table("rundown_profiles").select("*").eq(
            "project_id", project_id
        ).eq("scenario_name", scenario_name).order("month").execute()
        
        profiles = profiles_response.data or []
        
        if not profiles:
            raise HTTPException(
                status_code=404, 
                detail="No rundown profiles found for this project"
            )
            
        # Calculate summary
        current_month = datetime.utcnow().strftime("%Y%m")
        current_profile = next(
            (p for p in profiles if p["month"] == current_month),
            profiles[-1]  # Use latest if current month not found
        )
        
        current_planned = current_profile["planned_value"]
        current_actual = current_profile["actual_value"]
        variance = current_actual - current_planned
        variance_pct = (variance / current_planned * 100) if current_planned else 0
        
        return RundownSummary(
            project_id=project_id,
            project_name=project["name"],
            total_points=len(profiles),
            start_month=profiles[0]["month"],
            end_month=profiles[-1]["month"],
            current_planned=current_planned,
            current_actual=current_actual,
            current_predicted=current_profile.get("predicted_value"),
            variance=variance,
            variance_percentage=round(variance_pct, 2),
            is_over_budget=variance > 0,
            last_updated=profiles[-1]["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting summary for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get summary")


@router.get(
    "/status",
    response_model=GenerationStatusResponse,
    summary="Get generation status",
    description="Get the current status of profile generation."
)
async def get_generation_status(
    current_user: dict = Depends(get_current_user)
):
    """Get the current generation status."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        # Get last execution
        last_log = supabase.table("rundown_generation_logs").select("*").order(
            "created_at", desc=True
        ).limit(1).execute()
        
        last_entry = last_log.data[0] if last_log.data else None
        
        # Count projects with profiles
        profiles_count = supabase.table("rundown_profiles").select(
            "project_id", count="exact"
        ).execute()
        
        distinct_projects = supabase.rpc(
            "count_distinct_projects_with_profiles"
        ).execute() if False else {"count": 0}  # Use raw count if RPC not available
        
        # Count total profiles
        total = supabase.table("rundown_profiles").select("*", count="exact").execute()
        
        return GenerationStatusResponse(
            last_execution_id=last_entry["execution_id"] if last_entry else None,
            last_status=last_entry["status"] if last_entry else None,
            last_timestamp=last_entry["created_at"] if last_entry else None,
            projects_with_profiles=len(set(p["project_id"] for p in (profiles_count.data or []))),
            total_profiles=total.count or 0,
            is_generating=False
        )
        
    except Exception as e:
        logger.error(f"Error getting generation status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get status")


@router.get(
    "/logs",
    summary="Get generation logs",
    description="Get recent profile generation logs."
)
async def get_generation_logs(
    limit: int = Query(20, ge=1, le=100),
    execution_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get generation logs."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        query = supabase.table("rundown_generation_logs").select("*")
        
        if execution_id:
            query = query.eq("execution_id", execution_id)
            
        query = query.order("created_at", desc=True).limit(limit)
        
        response = query.execute()
        
        return {
            "logs": response.data or [],
            "count": len(response.data or [])
        }
        
    except Exception as e:
        logger.error(f"Error fetching generation logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch logs")


@router.delete(
    "/profiles/{project_id}",
    summary="Delete rundown profiles",
    description="Delete all rundown profiles for a project."
)
async def delete_project_profiles(
    project_id: str,
    scenario_name: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Delete rundown profiles for a project."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        query = supabase.table("rundown_profiles").delete().eq(
            "project_id", project_id
        )
        
        if scenario_name:
            query = query.eq("scenario_name", scenario_name)
            
        response = query.execute()
        
        return {
            "message": "Profiles deleted successfully",
            "project_id": project_id,
            "scenario_name": scenario_name
        }
        
    except Exception as e:
        logger.error(f"Error deleting profiles for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete profiles")
