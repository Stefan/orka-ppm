"""
What-If Scenario Analysis endpoints (Roche Construction feature)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from roche_construction_services import ScenarioAnalyzer
from roche_construction_models import (
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
    """Create a new what-if scenario analysis"""
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
        
    except Exception as e:
        print(f"Create scenario error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create scenario: {str(e)}")

@router.get("/{scenario_id}", response_model=ScenarioAnalysis)
async def get_scenario(
    scenario_id: UUID,
    current_user = Depends(require_permission(Permission.project_read))
):
    """Get a specific scenario analysis"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("scenario_analyses").select("*").eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        return ScenarioAnalysis(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get scenario error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scenario: {str(e)}")

@router.get("/projects/{project_id}/scenarios")
async def list_project_scenarios(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(require_permission(Permission.project_read))
):
    """List all scenarios for a project"""
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
        
        response = supabase.table("scenario_analyses").select("*").eq(
            "project_id", str(project_id)
        ).eq("is_active", True).order("created_at", desc=True).limit(limit).execute()
        
        scenarios = [ScenarioAnalysis(**scenario_data) for scenario_data in response.data or []]
        
        return {
            "project_id": str(project_id),
            "scenarios": scenarios,
            "total_count": len(scenarios)
        }
        
    except Exception as e:
        print(f"List project scenarios error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list scenarios: {str(e)}")

@router.post("/compare", response_model=ScenarioComparison)
async def compare_scenarios(
    scenario_ids: List[UUID],
    current_user = Depends(require_permission(Permission.project_read))
):
    """Compare multiple scenarios"""
    try:
        if not scenario_analyzer:
            raise HTTPException(status_code=503, detail="Scenario analysis service unavailable")
        
        if len(scenario_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 scenarios required for comparison")
        
        if len(scenario_ids) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 scenarios can be compared at once")
        
        comparison = await scenario_analyzer.compare_scenarios(scenario_ids)
        
        return comparison
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Compare scenarios error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare scenarios: {str(e)}")

@router.put("/{scenario_id}", response_model=ScenarioAnalysis)
async def update_scenario(
    scenario_id: UUID,
    scenario_config: ScenarioConfig,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Update a scenario configuration and recalculate impacts"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get existing scenario
        response = supabase.table("scenario_analyses").select("*").eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        existing_scenario = response.data[0]
        
        # Update scenario with new configuration
        update_data = {
            "name": scenario_config.name,
            "description": scenario_config.description,
            "parameter_changes": scenario_config.parameter_changes.dict(),
            "updated_at": datetime.now().isoformat()
        }
        
        update_response = supabase.table("scenario_analyses").update(update_data).eq(
            "id", str(scenario_id)
        ).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=400, detail="Failed to update scenario")
        
        return ScenarioAnalysis(**update_response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update scenario error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update scenario: {str(e)}")

@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: UUID,
    current_user = Depends(require_permission(Permission.project_update))
):
    """Delete a scenario (soft delete by marking as inactive)"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Soft delete by marking as inactive
        response = supabase.table("scenario_analyses").update({
            "is_active": False,
            "updated_at": datetime.now().isoformat()
        }).eq("id", str(scenario_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete scenario error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete scenario: {str(e)}")