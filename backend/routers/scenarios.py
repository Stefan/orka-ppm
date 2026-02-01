"""
What-If Scenario Analysis endpoints (Generic Construction feature)
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from auth.rbac import require_permission, Permission

logger = logging.getLogger(__name__)
GENERIC_500 = "An unexpected error occurred. Please try again later."
from auth.dependencies import get_current_user
from config.database import supabase
from services.generic_construction_services import ScenarioAnalyzer
from generic_construction_models import (
    ScenarioCreate, ScenarioAnalysis, ScenarioComparison, ScenarioConfig
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/simulations/what-if", tags=["scenarios"])

# Initialize scenario analyzer
scenario_analyzer = ScenarioAnalyzer(supabase) if supabase else None

@router.post("/", response_model=ScenarioAnalysis, status_code=201)
async def create_scenario(
    scenario_data: ScenarioCreate,
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Create a new what-if scenario analysis.
    
    This endpoint creates a scenario with parameter changes and calculates
    the impact on timeline, cost, and resources.
    """
    try:
        if not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Scenario analysis service unavailable")
        
        result = await scenario_analyzer.create_scenario(
            base_project_id=scenario_data.project_id,
            scenario_config=scenario_data.config,
            user_id=UUID(current_user["user_id"]),
            base_scenario_id=scenario_data.base_scenario_id
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to create scenario")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.put("/{scenario_id}", response_model=ScenarioAnalysis)
async def update_scenario(
    scenario_id: UUID,
    scenario_config: ScenarioConfig,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Update a scenario configuration and recalculate impacts in real-time.
    
    This endpoint allows real-time parameter adjustment with immediate
    impact visualization.
    """
    try:
        if not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Scenario analysis service unavailable")
        
        # Use real-time update method
        result = await scenario_analyzer.update_scenario_realtime(
            scenario_id=scenario_id,
            parameter_changes=scenario_config.parameter_changes.model_dump(exclude_none=True),
            user_id=UUID(current_user["user_id"])
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to update scenario")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.get("/{scenario_id}", response_model=ScenarioAnalysis)
async def get_scenario(
    scenario_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get a specific scenario analysis with all impact calculations"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("scenario_analyses").select("*").eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        return ScenarioAnalysis(**response.data[0])
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to get scenario")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.get("/{scenario_id}/compare", response_model=ScenarioComparison)
async def compare_scenario_with_baseline(
    scenario_id: UUID,
    baseline_scenario_id: Optional[UUID] = Query(None, description="Baseline scenario to compare against"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Compare a scenario with baseline or another scenario.
    
    Provides side-by-side comparison with delta calculations.
    """
    try:
        if not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Scenario analysis service unavailable")
        
        # Determine scenarios to compare
        scenario_ids = [scenario_id]
        if baseline_scenario_id:
            scenario_ids.append(baseline_scenario_id)
        else:
            # Get project's baseline scenario
            scenario_result = supabase.table("scenario_analyses").select("project_id").eq("id", str(scenario_id)).execute()
            if scenario_result.data:
                project_id = scenario_result.data[0]['project_id']
                baseline_result = supabase.table("scenario_analyses").select("id").eq(
                    "project_id", project_id
                ).eq("is_baseline", True).execute()
                if baseline_result.data:
                    scenario_ids.append(UUID(baseline_result.data[0]['id']))
        
        if len(scenario_ids) < 2:
            raise HTTPException(
                status_code=400, 
                detail="No baseline scenario found for comparison. Please specify baseline_scenario_id."
            )
        
        comparison = await scenario_analyzer.compare_scenarios(scenario_ids)
        
        return comparison
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to compare scenarios")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.post("/compare", response_model=ScenarioComparison)
async def compare_multiple_scenarios(
    scenario_ids: List[UUID],
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    Compare multiple scenarios with comprehensive analysis.
    
    Supports comparing up to 10 scenarios simultaneously with
    recommendations based on the comparison.
    """
    try:
        if len(scenario_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 scenarios required for comparison")
        
        if len(scenario_ids) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 scenarios can be compared at once")
        
        if not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Scenario analysis service unavailable")
        
        comparison = await scenario_analyzer.compare_scenarios(scenario_ids)
        
        return comparison
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to compare scenarios")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.get("/projects/{project_id}/scenarios")
async def list_project_scenarios(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_inactive: bool = Query(False, description="Include inactive scenarios"),
    current_user = Depends(require_permission(Permission.project_read))
):
    """
    List all scenarios for a project with pagination.
    
    Returns scenarios ordered by creation date (newest first).
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("scenario_analyses").select("*").eq("project_id", str(project_id))
        
        if not include_inactive:
            query = query.eq("is_active", True)
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        scenarios = [ScenarioAnalysis(**scenario_data) for scenario_data in response.data or []]
        
        # Get total count
        count_response = supabase.table("scenario_analyses").select("id", count="exact").eq(
            "project_id", str(project_id)
        )
        if not include_inactive:
            count_response = count_response.eq("is_active", True)
        count_result = count_response.execute()
        total_count = count_result.count if hasattr(count_result, 'count') else len(scenarios)
        
        return {
            "project_id": str(project_id),
            "scenarios": scenarios,
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }
        
    except Exception:
        logger.exception("Failed to list scenarios")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Delete a scenario (soft delete by default, marking as inactive).
    
    Use hard_delete=true to permanently remove the scenario.
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        if hard_delete:
            # Hard delete - permanently remove
            response = supabase.table("scenario_analyses").delete().eq("id", str(scenario_id)).execute()
        else:
            # Soft delete - mark as inactive
            response = supabase.table("scenario_analyses").update({
                "is_active": False,
                "updated_at": datetime.now().isoformat()
            }).eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete scenario")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.post("/{scenario_id}/clone", response_model=ScenarioAnalysis, status_code=201)
async def clone_scenario(
    scenario_id: UUID,
    new_name: Optional[str] = Query(None, description="Name for the cloned scenario"),
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Clone an existing scenario with a new name.
    
    Useful for creating variations of existing scenarios.
    """
    try:
        if not supabase or not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Service unavailable")
        
        # Get original scenario
        original_response = supabase.table("scenario_analyses").select("*").eq("id", str(scenario_id)).execute()
        
        if not original_response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        original = original_response.data[0]
        
        # Create new scenario config
        scenario_config = ScenarioConfig(
            name=new_name or f"{original['name']} (Copy)",
            description=f"Cloned from: {original['name']}",
            parameter_changes=original['parameter_changes'],
            analysis_scope=original.get('impact_results', {}).keys() or ['timeline', 'cost', 'resources']
        )
        
        # Create new scenario
        result = await scenario_analyzer.create_scenario(
            base_project_id=UUID(original['project_id']),
            scenario_config=scenario_config,
            user_id=UUID(current_user["user_id"]),
            base_scenario_id=scenario_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to clone scenario")
        raise HTTPException(status_code=500, detail=GENERIC_500)

@router.post("/{scenario_id}/set-baseline", response_model=ScenarioAnalysis)
async def set_as_baseline(
    scenario_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """
    Set a scenario as the baseline for its project.
    
    Only one scenario per project can be the baseline.
    """
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get scenario to verify it exists and get project_id
        scenario_response = supabase.table("scenario_analyses").select("project_id").eq("id", str(scenario_id)).execute()
        
        if not scenario_response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        project_id = scenario_response.data[0]['project_id']
        
        # Unset any existing baseline for this project
        supabase.table("scenario_analyses").update({
            "is_baseline": False,
            "updated_at": datetime.now().isoformat()
        }).eq("project_id", project_id).eq("is_baseline", True).execute()
        
        # Set this scenario as baseline
        response = supabase.table("scenario_analyses").update({
            "is_baseline": True,
            "updated_at": datetime.now().isoformat()
        }).eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to set baseline")
        
        return ScenarioAnalysis(**response.data[0])
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to set baseline")
        raise HTTPException(status_code=500, detail=GENERIC_500)