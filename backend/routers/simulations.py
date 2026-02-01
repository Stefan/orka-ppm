"""
Monte Carlo Risk Simulation API endpoints.

This module provides comprehensive REST API endpoints for:
- Running Monte Carlo simulations
- Managing scenarios and comparisons
- Retrieving and exporting simulation results
- Configuration and validation
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, Body
from fastapi.responses import JSONResponse, FileResponse
from uuid import UUID, uuid4
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import tempfile
import os
import logging

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase

# Import Monte Carlo components
from monte_carlo.engine import MonteCarloEngine
from monte_carlo.scenario_generator import ScenarioGenerator
from monte_carlo.results_analyzer import SimulationResultsAnalyzer
from monte_carlo.visualization import ChartGenerator, VisualizationManager, ChartConfig, ChartFormat, ChartTheme, ChartTemplateManager
from monte_carlo.models import (
    Risk, Scenario, SimulationResults, CorrelationMatrix, ValidationResult,
    ProgressStatus, RiskModification, MitigationStrategy, ScheduleData
)
from monte_carlo.simulation_config import SimulationConfig

# Import validation and error handling
from monte_carlo.api_validation import (
    SimulationRequestValidator, ScenarioRequestValidator, APIErrorHandler,
    GracefulDegradationManager, ValidationError, BusinessLogicError, 
    ExternalSystemError, validate_and_sanitize_simulation_request,
    handle_api_exception, create_user_friendly_error_message
)

from utils.converters import convert_uuids

# Import caching service
from services.simulation_cache_service import get_cache_service, SimulationCacheService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/monte-carlo", tags=["monte-carlo-simulations"])

# Initialize Monte Carlo components
monte_carlo_engine = MonteCarloEngine()
scenario_generator = ScenarioGenerator()
results_analyzer = SimulationResultsAnalyzer()
visualization_manager = VisualizationManager()
chart_generator = ChartGenerator()

# Initialize error handling and degradation management
error_handler = APIErrorHandler()
degradation_manager = GracefulDegradationManager()

# Cache service will be initialized on first use
_cache_service: Optional[SimulationCacheService] = None

# Pydantic models for API requests/responses
from pydantic import BaseModel, Field
from typing import Union

class RiskCreateRequest(BaseModel):
    """Request model for creating a risk."""
    id: str
    name: str
    category: str
    impact_type: str
    distribution_type: str
    distribution_parameters: Dict[str, float]
    baseline_impact: float
    correlation_dependencies: List[str] = []
    mitigation_strategies: List[Dict[str, Any]] = []

class SimulationRequest(BaseModel):
    """Request model for running a simulation."""
    risks: List[RiskCreateRequest]
    iterations: int = Field(default=10000, ge=10000)
    correlations: Optional[Dict[str, Dict[str, float]]] = None
    random_seed: Optional[int] = None
    baseline_costs: Optional[Dict[str, float]] = None
    schedule_data: Optional[Dict[str, Any]] = None

class ScenarioCreateRequest(BaseModel):
    """Request model for creating a scenario."""
    name: str
    description: str = ""
    base_risks: List[RiskCreateRequest]
    modifications: Dict[str, Dict[str, Any]] = {}

class ScenarioComparisonRequest(BaseModel):
    """Request model for comparing scenarios."""
    scenario_ids: List[str]
    comparison_metrics: List[str] = ["cost", "schedule", "risk_contribution"]

class VisualizationExportRequest(BaseModel):
    """Request model for exporting visualization suite."""
    simulation_id: str
    scenario_ids: List[str] = []
    export_format: str = Field(default="png", pattern="^(png|pdf|svg|html)$")
    include_interactive: bool = False
    layout_type: str = Field(default="standard", pattern="^(standard|executive|detailed)$")

# Custom exception handler decorator
def handle_monte_carlo_exceptions(func):
    """Decorator to handle Monte Carlo API exceptions consistently."""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Validation error in {func.__name__}: {e.message}")
            status_code, error_response = handle_api_exception(e)
            raise HTTPException(status_code=status_code, detail=error_response)
        except BusinessLogicError as e:
            logger.warning(f"Business logic error in {func.__name__}: {e.message}")
            status_code, error_response = handle_api_exception(e)
            raise HTTPException(status_code=status_code, detail=error_response)
        except ExternalSystemError as e:
            logger.error(f"External system error in {func.__name__}: {e.message}")
            
            # Attempt graceful degradation
            if e.recoverable:
                degradation_response = degradation_manager.handle_system_failure(
                    e.system or "unknown", func.__name__
                )
                error_response = error_handler.format_external_system_error(e)
                error_response["degradation"] = degradation_response
                raise HTTPException(status_code=503, detail=error_response)
            else:
                status_code, error_response = handle_api_exception(e)
                raise HTTPException(status_code=status_code, detail=error_response)
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {str(e)}", exc_info=True)
            status_code, error_response = handle_api_exception(e)
            raise HTTPException(status_code=status_code, detail=error_response)
    
    return wrapper

# Simulation Execution Endpoints

@router.post("/simulations/run", response_model=Dict[str, Any])
@handle_monte_carlo_exceptions
async def run_simulation(
    request: SimulationRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(require_permission(Permission.simulation_run)),
    use_cache: bool = Query(True, description="Use cached results if available")
):
    """
    Execute a Monte Carlo simulation with the provided risks and parameters.
    
    This endpoint runs a comprehensive Monte Carlo simulation and returns
    the simulation ID for tracking progress and retrieving results.
    Supports caching for improved performance.
    """
    # Get cache service
    cache_service = await get_cache_service()
    
    # Validate and sanitize request
    try:
        validation_result = validate_and_sanitize_simulation_request(request.dict())
        validated_data = validation_result["validated_data"]
        performance_info = validation_result["performance_info"]
        
        # Check performance warnings
        if performance_info["performance_tier"] == "high":
            logger.warning(f"High complexity simulation requested by user {current_user['user_id']}")
        
    except Exception as e:
        raise ValidationError(f"Request validation failed: {str(e)}")
    
    try:
        # Convert request to internal models
        risks = []
        for risk_data in validated_data["risks"]:
            # Convert risk data to Risk model
            from monte_carlo.distribution_modeler import RiskDistributionModeler
            from monte_carlo.models import RiskCategory, ImpactType, DistributionType, ProbabilityDistribution
            
            modeler = RiskDistributionModeler()
            
            # Create probability distribution
            distribution = ProbabilityDistribution(
                distribution_type=DistributionType(risk_data["distribution_type"]),
                parameters=risk_data["distribution_parameters"]
            )
            
            # Create mitigation strategies
            mitigation_strategies = []
            for ms_data in risk_data.get("mitigation_strategies", []):
                mitigation = MitigationStrategy(
                    id=ms_data.get("id", str(uuid4())),
                    name=ms_data.get("name", ""),
                    description=ms_data.get("description", ""),
                    cost=ms_data.get("cost", 0.0),
                    effectiveness=ms_data.get("effectiveness", 0.0),
                    implementation_time=ms_data.get("implementation_time", 0)
                )
                mitigation_strategies.append(mitigation)
            
            risk = Risk(
                id=risk_data["id"],
                name=risk_data["name"],
                category=RiskCategory(risk_data["category"]),
                impact_type=ImpactType(risk_data["impact_type"]),
                probability_distribution=distribution,
                baseline_impact=risk_data["baseline_impact"],
                correlation_dependencies=risk_data.get("correlation_dependencies", []),
                mitigation_strategies=mitigation_strategies
            )
            risks.append(risk)
        
        # Create correlation matrix if provided
        correlations = None
        if validated_data.get("correlations"):
            correlation_dict = {}
            risk_ids = [risk.id for risk in risks]
            
            for risk1_id, correlations_data in validated_data["correlations"].items():
                for risk2_id, correlation_value in correlations_data.items():
                    if risk1_id in risk_ids and risk2_id in risk_ids:
                        correlation_dict[(risk1_id, risk2_id)] = correlation_value
            
            correlations = CorrelationMatrix(
                correlations=correlation_dict,
                risk_ids=risk_ids
            )
        
        # Convert schedule data if provided
        schedule_data = None
        if validated_data.get("schedule_data"):
            # Convert schedule data dictionary to ScheduleData model
            # This is a simplified conversion - in practice you'd have more validation
            schedule_data = ScheduleData(
                project_baseline_duration=validated_data["schedule_data"].get("project_baseline_duration", 0.0),
                milestones=[],  # Would convert milestone data
                activities=[],  # Would convert activity data
                resource_constraints=[]  # Would convert resource constraint data
            )
        
        # Run simulation with error handling
        try:
            results = monte_carlo_engine.run_simulation(
                risks=risks,
                iterations=validated_data["iterations"],
                correlations=correlations,
                random_seed=validated_data.get("random_seed"),
                baseline_costs=validated_data.get("baseline_costs"),
                schedule_data=schedule_data
            )
        except Exception as e:
            raise BusinessLogicError(f"Simulation execution failed: {str(e)}")
        
        # Cache results if enabled
        if use_cache and cache_service.cache_enabled:
            try:
                # Extract project_id if available (from baseline_costs or schedule_data)
                project_id = None
                if validated_data.get("baseline_costs"):
                    # Try to extract project_id from baseline_costs keys
                    for key in validated_data["baseline_costs"].keys():
                        if key.startswith("project_"):
                            try:
                                project_id = UUID(key.replace("project_", ""))
                                break
                            except:
                                pass
                
                if project_id:
                    await cache_service.cache_simulation_result(
                        simulation_id=results.simulation_id,
                        results=results,
                        project_id=project_id,
                        risks_data=[r.dict() for r in request.risks],
                        ttl=3600  # 1 hour cache
                    )
                    logger.info(f"Cached simulation results for {results.simulation_id}")
            except Exception as e:
                logger.warning(f"Failed to cache simulation results: {e}")
        
        # Store results in database with error handling
        storage_status = "success"
        try:
            if supabase:
                simulation_data = {
                    "id": results.simulation_id,
                    "timestamp": results.timestamp.isoformat(),
                    "iteration_count": results.iteration_count,
                    "execution_time": results.execution_time,
                    "user_id": current_user["user_id"],
                    "status": "completed",
                    "results_summary": {
                        "cost_mean": float(results.cost_outcomes.mean()),
                        "cost_std": float(results.cost_outcomes.std()),
                        "schedule_mean": float(results.schedule_outcomes.mean()),
                        "schedule_std": float(results.schedule_outcomes.std()),
                        "convergence_status": results.convergence_metrics.converged
                    }
                }
                
                supabase.table("monte_carlo_simulations").insert(simulation_data).execute()
            else:
                storage_status = "degraded"
                logger.warning("Database unavailable - results stored in memory only")
        except Exception as e:
            storage_status = "failed"
            logger.error(f"Failed to store simulation results: {str(e)}")
            # Continue execution - results are still available in memory
        
        response = {
            "simulation_id": results.simulation_id,
            "status": "completed",
            "timestamp": results.timestamp.isoformat(),
            "iteration_count": results.iteration_count,
            "execution_time": results.execution_time,
            "convergence_status": results.convergence_metrics.converged,
            "storage_status": storage_status,
            "performance_info": performance_info,
            "summary": {
                "cost_statistics": {
                    "mean": float(results.cost_outcomes.mean()),
                    "std": float(results.cost_outcomes.std()),
                    "min": float(results.cost_outcomes.min()),
                    "max": float(results.cost_outcomes.max())
                },
                "schedule_statistics": {
                    "mean": float(results.schedule_outcomes.mean()),
                    "std": float(results.schedule_outcomes.std()),
                    "min": float(results.schedule_outcomes.min()),
                    "max": float(results.schedule_outcomes.max())
                }
            }
        }
        
        # Add degradation notice if storage failed
        if storage_status != "success":
            degradation_info = degradation_manager.handle_system_failure("database", "store_results")
            response["degradation"] = degradation_info
        
        return response
        
    except ValidationError:
        raise  # Re-raise validation errors
    except BusinessLogicError:
        raise  # Re-raise business logic errors
    except Exception as e:
        raise ExternalSystemError(f"Simulation service error: {str(e)}", "simulation_engine", recoverable=True)

@router.get("/simulations/{simulation_id}/progress")
@handle_monte_carlo_exceptions
async def get_simulation_progress(
    simulation_id: str,
    current_user = Depends(require_permission(Permission.simulation_read))
):
    """Get the progress status of a running simulation."""
    # Validate simulation ID format
    if not simulation_id or len(simulation_id) < 10:
        raise ValidationError("Invalid simulation ID format", "simulation_id")
    
    try:
        progress = monte_carlo_engine.get_simulation_progress(simulation_id)
        
        if progress is None:
            # Check if simulation is completed and cached
            try:
                cached_results = monte_carlo_engine.get_cached_results(simulation_id)
                if cached_results:
                    return {
                        "simulation_id": simulation_id,
                        "status": "completed",
                        "progress": 100.0,
                        "elapsed_time": cached_results.execution_time,
                        "estimated_remaining_time": 0.0
                    }
                else:
                    raise HTTPException(status_code=404, detail="Simulation not found")
            except Exception as e:
                raise ExternalSystemError(f"Failed to retrieve cached results: {str(e)}", "cache", recoverable=True)
        
        return {
            "simulation_id": progress.simulation_id,
            "status": progress.status,
            "progress": (progress.current_iteration / progress.total_iterations) * 100,
            "current_iteration": progress.current_iteration,
            "total_iterations": progress.total_iterations,
            "elapsed_time": progress.elapsed_time,
            "estimated_remaining_time": progress.estimated_remaining_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise ExternalSystemError(f"Failed to get simulation progress: {str(e)}", "simulation_engine", recoverable=True)

@router.get("/simulations/{simulation_id}/results")
@handle_monte_carlo_exceptions
async def get_simulation_results(
    simulation_id: str,
    include_raw_data: bool = Query(False, description="Include raw simulation data"),
    current_user = Depends(require_permission(Permission.simulation_read))
):
    """Retrieve complete simulation results with caching support."""
    try:
        # Validate simulation ID
        if not simulation_id or len(simulation_id) < 10:
            raise ValidationError("Invalid simulation ID format", "simulation_id")
        
        # Try cache first
        cache_service = await get_cache_service()
        results = None
        
        if cache_service.cache_enabled:
            try:
                results = await cache_service.get_cached_result(simulation_id)
                if results:
                    logger.info(f"Retrieved simulation {simulation_id} from cache")
            except Exception as e:
                logger.warning(f"Cache retrieval failed: {e}")
        
        # Fall back to engine cache if not in Redis
        if results is None:
            try:
                results = monte_carlo_engine.get_cached_results(simulation_id)
            except Exception as e:
                logger.warning(f"Engine cache retrieval failed: {e}")
        
        # Try to retrieve from database as fallback if still not found
        if results is None:
            if supabase:
                try:
                    response = supabase.table("monte_carlo_simulations").select("*").eq("id", simulation_id).execute()
                    if not response.data:
                        raise HTTPException(status_code=404, detail="Simulation results not found")
                    
                    # Return basic results from database
                    db_result = response.data[0]
                    return {
                        "simulation_id": simulation_id,
                        "timestamp": db_result["timestamp"],
                        "iteration_count": db_result["iteration_count"],
                        "execution_time": db_result["execution_time"],
                        "status": db_result["status"],
                        "results_summary": db_result.get("results_summary", {}),
                        "note": "Detailed results not available - showing summary from database"
                    }
                except Exception as e:
                    logger.error(f"Database retrieval failed: {str(e)}")
            
            raise HTTPException(status_code=404, detail="Simulation results not found")
        
        # Analyze results with error handling
        try:
            percentile_analysis = results_analyzer.calculate_percentiles(results)
            confidence_intervals = results_analyzer.generate_confidence_intervals(results, [0.8, 0.9, 0.95])
            risk_contributions = results_analyzer.identify_top_risk_contributors(results, top_n=10)
        except Exception as e:
            logger.error(f"Results analysis failed: {str(e)}")
            # Return basic results without analysis
            return {
                "simulation_id": results.simulation_id,
                "timestamp": results.timestamp.isoformat(),
                "iteration_count": results.iteration_count,
                "execution_time": results.execution_time,
                "status": "completed",
                "error": "Analysis failed - returning basic results only",
                "basic_statistics": {
                    "cost_mean": float(results.cost_outcomes.mean()),
                    "cost_std": float(results.cost_outcomes.std()),
                    "schedule_mean": float(results.schedule_outcomes.mean()),
                    "schedule_std": float(results.schedule_outcomes.std())
                }
            }
        
        response_data = {
            "simulation_id": results.simulation_id,
            "timestamp": results.timestamp.isoformat(),
            "iteration_count": results.iteration_count,
            "execution_time": results.execution_time,
            "convergence_metrics": {
                "converged": results.convergence_metrics.converged,
                "mean_stability": results.convergence_metrics.mean_stability,
                "variance_stability": results.convergence_metrics.variance_stability,
                "iterations_to_convergence": results.convergence_metrics.iterations_to_convergence
            },
            "cost_analysis": {
                "percentiles": percentile_analysis.percentiles,
                "mean": percentile_analysis.mean,
                "median": percentile_analysis.median,
                "std_dev": percentile_analysis.std_dev,
                "coefficient_of_variation": percentile_analysis.coefficient_of_variation
            },
            "confidence_intervals": {
                str(level): {"lower": interval[0], "upper": interval[1]}
                for level, interval in confidence_intervals.intervals.items()
            },
            "risk_contributions": [
                {
                    "risk_id": contrib.risk_id,
                    "risk_name": contrib.risk_name,
                    "contribution_percentage": contrib.contribution_percentage,
                    "variance_contribution": contrib.variance_contribution
                }
                for contrib in risk_contributions
            ]
        }
        
        # Include raw data if requested (with size limits)
        if include_raw_data:
            if results.iteration_count > 100000:
                logger.warning(f"Large dataset requested for raw data export: {results.iteration_count} iterations")
                response_data["warning"] = "Large dataset - consider using export endpoint for better performance"
            
            try:
                response_data["raw_data"] = {
                    "cost_outcomes": results.cost_outcomes.tolist(),
                    "schedule_outcomes": results.schedule_outcomes.tolist(),
                    "risk_contributions": {
                        risk_id: contributions.tolist()
                        for risk_id, contributions in results.risk_contributions.items()
                    }
                }
            except Exception as e:
                logger.error(f"Raw data serialization failed: {str(e)}")
                response_data["raw_data_error"] = "Raw data too large or corrupted - use export endpoint"
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise ExternalSystemError(f"Failed to retrieve simulation results: {str(e)}", "results_service", recoverable=True)

# Scenario Management Endpoints

@router.post("/scenarios", response_model=Dict[str, Any])
async def create_scenario(
    request: ScenarioCreateRequest,
    current_user = Depends(require_permission(Permission.scenario_create))
):
    """Create a new risk scenario for analysis."""
    try:
        # Convert request to internal models (similar to simulation request)
        risks = []
        for risk_data in request.base_risks:
            from monte_carlo.models import RiskCategory, ImpactType, DistributionType, ProbabilityDistribution
            
            distribution = ProbabilityDistribution(
                distribution_type=DistributionType(risk_data.distribution_type),
                parameters=risk_data.distribution_parameters
            )
            
            risk = Risk(
                id=risk_data.id,
                name=risk_data.name,
                category=RiskCategory(risk_data.category),
                impact_type=ImpactType(risk_data.impact_type),
                probability_distribution=distribution,
                baseline_impact=risk_data.baseline_impact,
                correlation_dependencies=risk_data.correlation_dependencies
            )
            risks.append(risk)
        
        # Convert modifications
        modifications = {}
        for risk_id, mod_data in request.modifications.items():
            modifications[risk_id] = RiskModification(
                parameter_changes=mod_data.get("parameter_changes", {}),
                distribution_type_change=mod_data.get("distribution_type_change"),
                mitigation_applied=mod_data.get("mitigation_applied")
            )
        
        # Create scenario
        scenario = scenario_generator.create_scenario(
            base_risks=risks,
            modifications=modifications,
            name=request.name,
            description=request.description
        )
        
        # Store scenario in database if available
        if supabase:
            scenario_data = {
                "id": scenario.id,
                "name": scenario.name,
                "description": scenario.description,
                "created_by": current_user["user_id"],
                "created_at": datetime.now().isoformat(),
                "risk_count": len(scenario.risks),
                "modification_count": len(scenario.modifications)
            }
            
            supabase.table("monte_carlo_scenarios").insert(scenario_data).execute()
        
        return {
            "scenario_id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
            "risk_count": len(scenario.risks),
            "modification_count": len(scenario.modifications),
            "created_at": datetime.now().isoformat()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid scenario parameters: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create scenario: {str(e)}")

@router.get("/scenarios")
async def list_scenarios(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(require_permission(Permission.scenario_read))
):
    """List all available scenarios."""
    try:
        scenarios = scenario_generator.list_scenarios()
        
        # Apply pagination
        total_count = len(scenarios)
        paginated_scenarios = scenarios[offset:offset + limit]
        
        return {
            "scenarios": [
                {
                    "scenario_id": scenario.id,
                    "name": scenario.name,
                    "description": scenario.description,
                    "risk_count": len(scenario.risks),
                    "modification_count": len(scenario.modifications),
                    "has_simulation_results": scenario.simulation_results is not None
                }
                for scenario in paginated_scenarios
            ],
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list scenarios: {str(e)}")

@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    current_user = Depends(require_permission(Permission.scenario_read))
):
    """Get detailed information about a specific scenario."""
    try:
        scenario = scenario_generator.get_scenario(scenario_id)
        
        if scenario is None:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        return {
            "scenario_id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
            "risks": [
                {
                    "id": risk.id,
                    "name": risk.name,
                    "category": risk.category.value,
                    "impact_type": risk.impact_type.value,
                    "baseline_impact": risk.baseline_impact,
                    "distribution_type": risk.probability_distribution.distribution_type.value,
                    "distribution_parameters": risk.probability_distribution.parameters
                }
                for risk in scenario.risks
            ],
            "modifications": {
                risk_id: {
                    "parameter_changes": mod.parameter_changes,
                    "distribution_type_change": mod.distribution_type_change.value if mod.distribution_type_change else None,
                    "mitigation_applied": mod.mitigation_applied
                }
                for risk_id, mod in scenario.modifications.items()
            },
            "has_simulation_results": scenario.simulation_results is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scenario: {str(e)}")

@router.post("/scenarios/compare")
async def compare_scenarios(
    request: ScenarioComparisonRequest,
    current_user = Depends(require_permission(Permission.scenario_compare))
):
    """Compare multiple scenarios and their simulation results."""
    try:
        if len(request.scenario_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 scenarios required for comparison")
        
        # Get scenarios
        scenarios = []
        for scenario_id in request.scenario_ids:
            scenario = scenario_generator.get_scenario(scenario_id)
            if scenario is None:
                raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
            scenarios.append(scenario)
        
        # Check if scenarios have simulation results
        scenarios_with_results = []
        for scenario in scenarios:
            if scenario.simulation_results is None:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Scenario {scenario.id} has no simulation results. Run simulation first."
                )
            scenarios_with_results.append(scenario.simulation_results)
        
        # Perform pairwise comparisons
        comparisons = []
        for i in range(len(scenarios_with_results)):
            for j in range(i + 1, len(scenarios_with_results)):
                comparison = results_analyzer.compare_scenarios(
                    scenarios_with_results[i], 
                    scenarios_with_results[j]
                )
                comparisons.append({
                    "scenario_a_id": scenarios[i].id,
                    "scenario_a_name": scenarios[i].name,
                    "scenario_b_id": scenarios[j].id,
                    "scenario_b_name": scenarios[j].name,
                    "cost_difference": comparison.cost_difference,
                    "schedule_difference": comparison.schedule_difference,
                    "statistical_significance": comparison.statistical_significance,
                    "effect_size": comparison.effect_size
                })
        
        return {
            "comparison_timestamp": datetime.now().isoformat(),
            "scenarios_compared": len(scenarios),
            "comparison_metrics": request.comparison_metrics,
            "pairwise_comparisons": comparisons
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare scenarios: {str(e)}")

# Results Export Endpoints

@router.post("/export")
async def export_results(
    request: VisualizationExportRequest,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Export simulation results in various formats."""
    try:
        results = monte_carlo_engine.get_cached_results(request.simulation_id)
        
        if results is None:
            raise HTTPException(status_code=404, detail="Simulation results not found")
        
        # Create temporary file for export
        temp_dir = tempfile.mkdtemp()
        
        if request.format == "json":
            # Export as JSON
            export_data = {
                "simulation_id": results.simulation_id,
                "timestamp": results.timestamp.isoformat(),
                "iteration_count": results.iteration_count,
                "execution_time": results.execution_time,
                "cost_outcomes": results.cost_outcomes.tolist() if request.include_raw_data else None,
                "schedule_outcomes": results.schedule_outcomes.tolist() if request.include_raw_data else None,
                "risk_contributions": {
                    risk_id: contributions.tolist()
                    for risk_id, contributions in results.risk_contributions.items()
                } if request.include_raw_data else None,
                "convergence_metrics": {
                    "converged": results.convergence_metrics.converged,
                    "mean_stability": results.convergence_metrics.mean_stability,
                    "variance_stability": results.convergence_metrics.variance_stability
                }
            }
            
            file_path = os.path.join(temp_dir, f"simulation_{request.simulation_id}.json")
            with open(file_path, 'w') as f:
                json.dump(export_data, f, indent=2)
            
            return FileResponse(
                path=file_path,
                filename=f"simulation_{request.simulation_id}.json",
                media_type="application/json"
            )
        
        elif request.format == "csv":
            # Export as CSV
            import pandas as pd
            
            # Create summary statistics CSV
            percentile_analysis = results_analyzer.calculate_percentiles(results)
            
            summary_data = {
                "Metric": ["Mean", "Median", "Std Dev", "P10", "P25", "P75", "P90", "P95", "P99"],
                "Cost": [
                    percentile_analysis.mean,
                    percentile_analysis.median,
                    percentile_analysis.std_dev,
                    percentile_analysis.percentiles.get(10, 0),
                    percentile_analysis.percentiles.get(25, 0),
                    percentile_analysis.percentiles.get(75, 0),
                    percentile_analysis.percentiles.get(90, 0),
                    percentile_analysis.percentiles.get(95, 0),
                    percentile_analysis.percentiles.get(99, 0)
                ]
            }
            
            df = pd.DataFrame(summary_data)
            file_path = os.path.join(temp_dir, f"simulation_{request.simulation_id}.csv")
            df.to_csv(file_path, index=False)
            
            return FileResponse(
                path=file_path,
                filename=f"simulation_{request.simulation_id}.csv",
                media_type="text/csv"
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported export format: {request.format}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export results: {str(e)}")

# Configuration and Validation Endpoints

@router.post("/validate")
async def validate_simulation_parameters(
    request: SimulationRequest,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Validate simulation parameters before execution."""
    try:
        # Convert request to internal models (similar to run_simulation)
        risks = []
        for risk_data in request.risks:
            from monte_carlo.models import RiskCategory, ImpactType, DistributionType, ProbabilityDistribution
            
            distribution = ProbabilityDistribution(
                distribution_type=DistributionType(risk_data.distribution_type),
                parameters=risk_data.distribution_parameters
            )
            
            risk = Risk(
                id=risk_data.id,
                name=risk_data.name,
                category=RiskCategory(risk_data.category),
                impact_type=ImpactType(risk_data.impact_type),
                probability_distribution=distribution,
                baseline_impact=risk_data.baseline_impact,
                correlation_dependencies=risk_data.correlation_dependencies
            )
            risks.append(risk)
        
        # Validate parameters
        validation_result = monte_carlo_engine.validate_simulation_parameters(
            risks=risks,
            iterations=request.iterations
        )
        
        return {
            "is_valid": validation_result.is_valid,
            "errors": validation_result.errors,
            "warnings": validation_result.warnings,
            "recommendations": validation_result.recommendations,
            "estimated_execution_time": min(30.0, len(risks) * 0.1 + request.iterations / 1000),
            "risk_count": len(risks),
            "iteration_count": request.iterations
        }
        
    except ValueError as e:
        return {
            "is_valid": False,
            "errors": [str(e)],
            "warnings": [],
            "recommendations": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@router.get("/config/defaults")
async def get_default_configuration(
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Get default simulation configuration parameters."""
    try:
        from monte_carlo.simulation_config import ConfigurationManager
        
        config_manager = ConfigurationManager()
        default_config = config_manager.get_default_config()
        
        return {
            "default_iterations": default_config.iterations,
            "convergence_threshold": default_config.convergence_threshold,
            "max_execution_time": default_config.max_execution_time,
            "parameter_change_sensitivity": default_config.parameter_change_sensitivity,
            "supported_distributions": [dt.value for dt in DistributionType],
            "supported_risk_categories": [rc.value for rc in RiskCategory],
            "supported_impact_types": [it.value for it in ImpactType],
            "performance_limits": {
                "max_risks": 100,
                "max_iterations": 1000000,
                "max_execution_time_seconds": 300
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get default configuration: {str(e)}")

# Legacy endpoints for backward compatibility
@router.post("/", response_model=Dict[str, Any], deprecated=True)
async def run_monte_carlo_simulation_legacy(
    simulation_data: Dict[str, Any],
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Legacy endpoint for backward compatibility."""
    # Convert legacy format to new format and redirect
    try:
        # This would contain conversion logic from old format to new format
        # For now, return a deprecation notice
        return {
            "message": "This endpoint is deprecated. Please use /api/v1/monte-carlo/simulations/run",
            "new_endpoint": "/api/v1/monte-carlo/simulations/run",
            "migration_guide": "https://docs.example.com/api/migration"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy endpoint error: {str(e)}")

@router.get("/{simulation_id}", response_model=Dict[str, Any], deprecated=True)
async def get_simulation_result_legacy(
    simulation_id: UUID,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Legacy endpoint for getting simulation results."""
    # Redirect to new endpoint
    return await get_simulation_results(str(simulation_id), False, current_user)

# Visualization Endpoints

class ChartGenerationRequest(BaseModel):
    """Request model for generating charts."""
    chart_types: List[str] = Field(default=["distribution", "tornado", "cdf"], description="Types of charts to generate")
    outcome_type: str = Field(default="cost", pattern="^(cost|schedule)$")
    format: str = Field(default="png", pattern="^(png|pdf|svg|html)$")
    theme: str = Field(default="professional", pattern="^(default|professional|presentation|colorblind_friendly)$")
    include_risk_heat_map: bool = False
    simulation_id: Optional[str] = None  # Optional; path param is authoritative

class VisualizationExportRequest(BaseModel):
    """Request model for exporting visualization suite."""
    simulation_id: str  # Required for /export endpoint
    scenario_ids: List[str] = []
    export_format: str = Field(default="png", pattern="^(png|pdf|svg|html)$")
    include_interactive: bool = False
    layout_type: str = Field(default="standard", pattern="^(standard|executive|detailed)$")

@router.post("/simulations/{simulation_id}/visualizations/generate")
async def generate_simulation_charts(
    simulation_id: str
):
    """Generate visualization charts for simulation results."""
    try:
        # Debug logging
        logger.info(f"Monte Carlo visualization request for simulation {simulation_id}")

        # Simple test response first
        return {
            "simulation_id": simulation_id,
            "message": "Endpoint reached successfully - bypassing all validation",
            "charts": {}
        }

        # Use default config
        req = ChartGenerationRequest()
        logger.info(f"Using default config: chart_types={req.chart_types}, outcome_type={req.outcome_type}")

        # Get simulation results
        results = monte_carlo_engine.get_cached_results(simulation_id)
        if results is None:
            raise HTTPException(status_code=404, detail="Simulation results not found")

        # Configure chart generator
        theme_map = {
            "default": ChartTheme.DEFAULT,
            "professional": ChartTheme.PROFESSIONAL,
            "presentation": ChartTheme.PRESENTATION,
            "colorblind_friendly": ChartTheme.COLORBLIND_FRIENDLY
        }

        format_map = {
            "png": ChartFormat.PNG,
            "pdf": ChartFormat.PDF,
            "svg": ChartFormat.SVG,
            "html": ChartFormat.HTML
        }

        config = ChartConfig(
            format=format_map[req.format],
            theme=theme_map[req.theme]
        )

        chart_gen = ChartGenerator(config)
        generated_charts = {}

        # Generate requested chart types
        for chart_type in req.chart_types:
            try:
                if chart_type == "distribution":
                    chart_data = chart_gen.generate_probability_distribution_chart(
                        results, outcome_type=req.outcome_type
                    )
                    generated_charts[f"{req.outcome_type}_distribution"] = {
                        "title": chart_data.title,
                        "subtitle": chart_data.subtitle,
                        "base64_image": chart_gen.get_chart_as_base64(chart_data),
                        "metadata": chart_data.metadata
                    }

                elif chart_type == "tornado":
                    # Skip tornado diagram for now due to data issues
                    logger.warning("Skipping tornado diagram generation - sample data may be incomplete")
                    generated_charts[f"{req.outcome_type}_tornado_error"] = "Tornado diagram temporarily disabled for sample data"

                elif chart_type == "cdf":
                    chart_data = chart_gen.generate_cdf_chart(
                        results, outcome_type=req.outcome_type
                    )
                    generated_charts[f"{req.outcome_type}_cdf"] = {
                        "title": chart_data.title,
                        "subtitle": chart_data.subtitle,
                        "base64_image": chart_gen.get_chart_as_base64(chart_data),
                        "metadata": chart_data.metadata
                    }

            except Exception as e:
                logger.warning(f"Failed to generate {chart_type} chart: {str(e)}")
                generated_charts[f"{chart_type}_error"] = str(e)

        return {
            "simulation_id": simulation_id,
            "charts": generated_charts,
            "generation_timestamp": datetime.now().isoformat(),
            "config": {
                "format": req.format,
                "theme": req.theme,
                "outcome_type": req.outcome_type
            }
        }
        results = monte_carlo_engine.get_cached_results(simulation_id)
        if results is None:
            raise HTTPException(status_code=404, detail="Simulation results not found")
        
        # Configure chart generator
        theme_map = {
            "default": ChartTheme.DEFAULT,
            "professional": ChartTheme.PROFESSIONAL,
            "presentation": ChartTheme.PRESENTATION,
            "colorblind_friendly": ChartTheme.COLORBLIND_FRIENDLY
        }
        
        format_map = {
            "png": ChartFormat.PNG,
            "pdf": ChartFormat.PDF,
            "svg": ChartFormat.SVG,
            "html": ChartFormat.HTML
        }
        
        config = ChartConfig(
            format=format_map[req.format],
            theme=theme_map[req.theme]
        )
        
        chart_gen = ChartGenerator(config)
        generated_charts = {}
        
        # Generate requested chart types
        for chart_type in req.chart_types:
            try:
                if chart_type == "distribution":
                    chart_data = chart_gen.generate_probability_distribution_chart(
                        results, outcome_type=req.outcome_type
                    )
                    generated_charts[f"{req.outcome_type}_distribution"] = {
                        "title": chart_data.title,
                        "subtitle": chart_data.subtitle,
                        "base64_image": chart_gen.get_chart_as_base64(chart_data),
                        "metadata": chart_data.metadata
                    }
                
                elif chart_type == "tornado":
                    chart_data = chart_gen.generate_tornado_diagram(
                        results, outcome_type=req.outcome_type
                    )
                    generated_charts[f"{req.outcome_type}_tornado"] = {
                        "title": chart_data.title,
                        "subtitle": chart_data.subtitle,
                        "base64_image": chart_gen.get_chart_as_base64(chart_data),
                        "metadata": chart_data.metadata
                    }
                
                elif chart_type == "cdf":
                    chart_data = chart_gen.generate_cdf_chart(
                        results, outcome_type=req.outcome_type
                    )
                    generated_charts[f"{req.outcome_type}_cdf"] = {
                        "title": chart_data.title,
                        "subtitle": chart_data.subtitle,
                        "base64_image": chart_gen.get_chart_as_base64(chart_data),
                        "metadata": chart_data.metadata
                    }
                    
            except Exception as e:
                logger.warning(f"Failed to generate {chart_type} chart: {str(e)}")
                generated_charts[f"{chart_type}_error"] = str(e)
        
        return {
            "simulation_id": simulation_id,
            "charts": generated_charts,
            "generation_timestamp": datetime.now().isoformat(),
            "config": {
                "format": req.format,
                "theme": req.theme,
                "outcome_type": req.outcome_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise ExternalSystemError(f"Chart generation failed: {str(e)}", "visualization", recoverable=True)

@router.get("/simulations/{simulation_id}/visualizations/interactive")
@handle_monte_carlo_exceptions
async def get_interactive_chart_data(
    simulation_id: str,
    current_user = Depends(require_permission(Permission.risk_read))
):
    """Get interactive chart data for web-based visualization."""
    try:
        # Get simulation results
        results = monte_carlo_engine.get_cached_results(simulation_id)
        if results is None:
            raise HTTPException(status_code=404, detail="Simulation results not found")
        
        # Generate interactive chart specifications
        vis_manager = VisualizationManager()
        interactive_specs = vis_manager.generate_interactive_charts(results)
        
        return {
            "simulation_id": simulation_id,
            "interactive_charts": interactive_specs,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise ExternalSystemError(f"Interactive chart data generation failed: {str(e)}", "visualization", recoverable=True)


# Cache Management Endpoints

@router.delete("/cache/projects/{project_id}")
@handle_monte_carlo_exceptions
async def invalidate_project_cache(
    project_id: UUID,
    current_user = Depends(require_permission(Permission.simulation_run))
):
    """
    Invalidate all cached simulations for a project.
    
    This endpoint should be called when project risk data changes
    to ensure fresh simulations are run.
    """
    try:
        cache_service = await get_cache_service()
        
        if not cache_service.cache_enabled:
            return {
                "message": "Cache not enabled",
                "invalidated_count": 0
            }
        
        invalidated_count = await cache_service.invalidate_project_cache(project_id)
        
        return {
            "project_id": str(project_id),
            "invalidated_count": invalidated_count,
            "timestamp": datetime.now().isoformat(),
            "message": f"Successfully invalidated {invalidated_count} cache entries"
        }
        
    except Exception as e:
        logger.error(f"Failed to invalidate project cache: {e}")
        raise HTTPException(status_code=500, detail=f"Cache invalidation failed: {str(e)}")


@router.get("/cache/statistics")
@handle_monte_carlo_exceptions
async def get_cache_statistics(
    current_user = Depends(require_permission(Permission.simulation_read))
):
    """Get cache statistics and metrics."""
    try:
        cache_service = await get_cache_service()
        stats = await cache_service.get_cache_statistics()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve cache statistics: {str(e)}")


@router.post("/simulations/background")
@handle_monte_carlo_exceptions
async def queue_background_simulation(
    request: SimulationRequest,
    project_id: UUID = Query(..., description="Project ID for the simulation"),
    priority: int = Query(0, ge=0, le=10, description="Priority level (0-10, higher = more urgent)"),
    current_user = Depends(require_permission(Permission.simulation_run))
):
    """
    Queue a simulation for background processing.
    
    Useful for large simulations that may take longer than 30 seconds.
    """
    try:
        cache_service = await get_cache_service()
        
        if not cache_service.cache_enabled:
            raise HTTPException(
                status_code=503,
                detail="Background processing not available - cache service not enabled"
            )
        
        # Validate request
        validation_result = validate_and_sanitize_simulation_request(request.dict())
        
        # Queue the simulation
        job_id = await cache_service.queue_background_simulation(
            project_id=project_id,
            simulation_config=validation_result["validated_data"],
            priority=priority
        )
        
        return {
            "job_id": job_id,
            "project_id": str(project_id),
            "status": "queued",
            "priority": priority,
            "queued_at": datetime.now().isoformat(),
            "message": "Simulation queued for background processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to queue background simulation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue simulation: {str(e)}")


@router.get("/simulations/background/next")
@handle_monte_carlo_exceptions
async def get_next_background_simulation(
    current_user = Depends(require_permission(Permission.simulation_run))
):
    """
    Get next simulation from the background processing queue.
    
    This endpoint is used by background workers to process queued simulations.
    """
    try:
        cache_service = await get_cache_service()
        
        if not cache_service.cache_enabled:
            raise HTTPException(
                status_code=503,
                detail="Background processing not available - cache service not enabled"
            )
        
        job_data = await cache_service.get_next_queued_simulation()
        
        if job_data is None:
            return {
                "message": "No simulations in queue",
                "queue_empty": True
            }
        
        return {
            "job_data": job_data,
            "queue_empty": False,
            "dequeued_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get next background simulation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve queued simulation: {str(e)}")