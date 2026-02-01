"""
Distribution API Router
Phase 2 & 3: Distribution Settings and Rules Engine endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

from backend.services.distribution_rules_engine import (
    DistributionRulesEngine,
    DistributionProfile,
    DistributionRuleType,
    Granularity
)
from backend.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/distribution", tags=["distribution"])


# Request/Response Models
class DistributionProfileEnum(str, Enum):
    """Distribution profile types"""
    LINEAR = "linear"
    CUSTOM = "custom"
    AI_GENERATED = "ai_generated"


class DistributionRuleTypeEnum(str, Enum):
    """Distribution rule types"""
    AUTOMATIC = "automatic"
    REPROFILING = "reprofiling"
    AI_GENERATOR = "ai_generator"


class GranularityEnum(str, Enum):
    """Time period granularity"""
    WEEK = "week"
    MONTH = "month"


class DistributionSettingsRequest(BaseModel):
    """Request model for distribution calculation"""
    profile: DistributionProfileEnum
    duration_start: str  # ISO date string
    duration_end: str  # ISO date string
    granularity: GranularityEnum
    total_budget: float = Field(gt=0, description="Total budget to distribute")
    current_spend: Optional[float] = Field(None, ge=0, description="Current spend (for reprofiling)")
    custom_distribution: Optional[List[float]] = Field(None, description="Custom percentages (must sum to 100)")


class DistributionPeriodResponse(BaseModel):
    """Response model for a distribution period"""
    start_date: str
    end_date: str
    amount: float
    percentage: float
    label: str


class DistributionResponse(BaseModel):
    """Response model for distribution calculation"""
    periods: List[DistributionPeriodResponse]
    total: float
    profile: DistributionProfileEnum
    confidence: Optional[float] = None
    error: Optional[str] = None


class DistributionRuleRequest(BaseModel):
    """Request model for creating/updating a distribution rule"""
    name: str = Field(..., min_length=1, max_length=200)
    type: DistributionRuleTypeEnum
    profile: DistributionProfileEnum
    settings: DistributionSettingsRequest


class DistributionRuleResponse(BaseModel):
    """Response model for a distribution rule"""
    id: str
    name: str
    type: DistributionRuleTypeEnum
    profile: DistributionProfileEnum
    settings: DistributionSettingsRequest
    created_at: str
    last_applied: Optional[str] = None
    application_count: int = 0


class ApplyRuleRequest(BaseModel):
    """Request model for applying a rule"""
    rule_id: str
    project_ids: List[str] = Field(default_factory=list, description="Project IDs to apply rule to (empty = all)")


# Endpoints
@router.post("/calculate", response_model=DistributionResponse)
async def calculate_distribution(
    request: DistributionSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate distribution based on settings
    Phase 2: Distribution Settings
    """
    try:
        # Parse dates
        start_date = datetime.fromisoformat(request.duration_start.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(request.duration_end.replace('Z', '+00:00'))
        
        # Validate date range
        if start_date >= end_date:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
        
        # Initialize engine
        engine = DistributionRulesEngine()
        
        # Calculate distribution based on profile
        if request.profile == DistributionProfileEnum.LINEAR:
            result = engine.apply_linear_distribution(
                total_budget=request.total_budget,
                start_date=start_date,
                end_date=end_date,
                granularity=Granularity(request.granularity.value)
            )
        
        elif request.profile == DistributionProfileEnum.CUSTOM:
            if not request.custom_distribution:
                raise HTTPException(status_code=400, detail="Custom distribution requires percentages")
            
            result = engine.apply_custom_distribution(
                total_budget=request.total_budget,
                start_date=start_date,
                end_date=end_date,
                granularity=Granularity(request.granularity.value),
                custom_percentages=request.custom_distribution
            )
        
        elif request.profile == DistributionProfileEnum.AI_GENERATED:
            result = engine.generate_s_curve_distribution(
                total_budget=request.total_budget,
                start_date=start_date,
                end_date=end_date,
                granularity=Granularity(request.granularity.value)
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown profile: {request.profile}")
        
        # Convert to response model
        return DistributionResponse(**result.to_dict())
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distribution calculation failed: {str(e)}")


@router.post("/rules", response_model=DistributionRuleResponse)
async def create_distribution_rule(
    request: DistributionRuleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new distribution rule
    Phase 3: Distribution Rules Engine
    """
    try:
        # In real app: Save to database
        # For now: Mock response
        rule_id = f"rule-{datetime.now().timestamp()}"
        
        return DistributionRuleResponse(
            id=rule_id,
            name=request.name,
            type=request.type,
            profile=request.profile,
            settings=request.settings,
            created_at=datetime.now().isoformat(),
            last_applied=None,
            application_count=0
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.get("/rules", response_model=List[DistributionRuleResponse])
async def list_distribution_rules(
    current_user: dict = Depends(get_current_user)
):
    """
    List all distribution rules
    Phase 3: Distribution Rules Engine
    """
    # In real app: Fetch from database
    # For now: Return empty list
    return []


@router.get("/rules/{rule_id}", response_model=DistributionRuleResponse)
async def get_distribution_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific distribution rule
    Phase 3: Distribution Rules Engine
    """
    # In real app: Fetch from database
    raise HTTPException(status_code=404, detail="Rule not found")


@router.put("/rules/{rule_id}", response_model=DistributionRuleResponse)
async def update_distribution_rule(
    rule_id: str,
    request: DistributionRuleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a distribution rule
    Phase 3: Distribution Rules Engine
    """
    # In real app: Update in database
    raise HTTPException(status_code=404, detail="Rule not found")


@router.delete("/rules/{rule_id}")
async def delete_distribution_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a distribution rule
    Phase 3: Distribution Rules Engine
    """
    # In real app: Delete from database
    return {"message": "Rule deleted successfully"}


@router.post("/rules/apply", response_model=dict)
async def apply_distribution_rule(
    request: ApplyRuleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Apply a distribution rule to projects
    Phase 3: Distribution Rules Engine
    """
    try:
        # In real app:
        # 1. Fetch rule from database
        # 2. Fetch target projects
        # 3. Apply rule to each project
        # 4. Save distribution settings
        # 5. Update rule application count
        
        return {
            "rule_id": request.rule_id,
            "projects_affected": len(request.project_ids) if request.project_ids else 0,
            "applied_at": datetime.now().isoformat(),
            "status": "success"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply rule: {str(e)}")


@router.post("/reprofile", response_model=DistributionResponse)
async def reprofile_distribution(
    request: DistributionSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Reprofile distribution based on current spend
    Phase 3: Reprofiling Rule
    """
    try:
        if request.current_spend is None:
            raise HTTPException(status_code=400, detail="Current spend is required for reprofiling")
        
        # Parse dates
        start_date = datetime.fromisoformat(request.duration_start.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(request.duration_end.replace('Z', '+00:00'))
        
        # Apply reprofiling
        engine = DistributionRulesEngine()
        result = engine.apply_reprofiling(
            total_budget=request.total_budget,
            current_spend=request.current_spend,
            start_date=start_date,
            end_date=end_date,
            granularity=Granularity(request.granularity.value)
        )
        
        return DistributionResponse(**result.to_dict())
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reprofiling failed: {str(e)}")
