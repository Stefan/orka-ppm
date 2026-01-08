"""
Monte Carlo Simulation endpoints (Roche Construction feature)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from roche_construction_services import MonteCarloEngine
from roche_construction_models import (
    SimulationCreate, SimulationResult, SimulationConfig, SimulationType
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/simulations/monte-carlo", tags=["simulations"])

# Initialize Monte Carlo engine
monte_carlo_engine = MonteCarloEngine(supabase) if supabase else None

@router.post("/", response_model=SimulationResult, status_code=201)
async def run_monte_carlo_simulation(
    simulation_data: SimulationCreate,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Run a Monte Carlo simulation for risk analysis"""
    try:
        if not monte_carlo_engine:
            raise HTTPException(status_code=503, detail="Monte Carlo simulation service unavailable")
        
        if simulation_data.simulation_type != SimulationType.monte_carlo:
            raise HTTPException(status_code=400, detail="Invalid simulation type for this endpoint")
        
        result = await monte_carlo_engine.run_simulation(
            project_id=simulation_data.project_id,
            simulation_config=simulation_data.config,
            user_id=UUID(current_user["user_id"]),
            name=simulation_data.name,
            description=simulation_data.description
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Monte Carlo simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run simulation: {str(e)}")

@router.get("/{simulation_id}", response_model=SimulationResult)
async def get_simulation_result(
    simulation_id: UUID,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Get Monte Carlo simulation results"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("simulation_results").select("*").eq("id", str(simulation_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        return SimulationResult(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get simulation: {str(e)}")

@router.get("/projects/{project_id}/simulations")
async def list_project_simulations(
    project_id: UUID,
    simulation_type: Optional[SimulationType] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(require_permission(Permission.risk_read))
):
    """List all simulations for a project"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("simulation_results").select("*").eq("project_id", str(project_id))
        
        if simulation_type:
            query = query.eq("simulation_type", simulation_type.value)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        
        simulations = [SimulationResult(**sim_data) for sim_data in response.data or []]
        
        return {
            "project_id": str(project_id),
            "simulations": simulations,
            "total_count": len(simulations)
        }
        
    except Exception as e:
        print(f"List project simulations error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list simulations: {str(e)}")

@router.delete("/{simulation_id}", status_code=204)
async def delete_simulation(
    simulation_id: UUID,
    current_user = Depends(require_permission(Permission.risk_update))
):
    """Delete a simulation result"""
    try:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("simulation_results").delete().eq("id", str(simulation_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete simulation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete simulation: {str(e)}")

@router.post("/{simulation_id}/invalidate-cache", status_code=200)
async def invalidate_simulation_cache(
    simulation_id: UUID,
    current_user = Depends(require_permission(Permission.risk_update))
):
    """Invalidate cached simulation results to force recalculation"""
    try:
        if not monte_carlo_engine:
            raise HTTPException(status_code=503, detail="Monte Carlo simulation service unavailable")
        
        # Get simulation to find project_id
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("simulation_results").select("project_id").eq("id", str(simulation_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        project_id = UUID(response.data[0]["project_id"])
        
        # Invalidate cache for the project
        success = await monte_carlo_engine.invalidate_cached_results(project_id)
        
        if success:
            return {"message": "Simulation cache invalidated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to invalidate cache")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Invalidate cache error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to invalidate cache: {str(e)}")

@router.get("/projects/{project_id}/history")
async def get_simulation_history(
    project_id: UUID,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Get simulation history for a project"""
    try:
        if not monte_carlo_engine:
            raise HTTPException(status_code=503, detail="Monte Carlo simulation service unavailable")
        
        history = await monte_carlo_engine.get_simulation_history(project_id)
        
        return {
            "project_id": str(project_id),
            "simulation_history": history,
            "total_simulations": len(history)
        }
        
    except Exception as e:
        print(f"Get simulation history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get simulation history: {str(e)}")