"""
Project-related Pydantic models
"""

from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional, Any
from uuid import UUID

from .base import BaseResponse, ProjectStatus, HealthIndicator


class ProjectPpmInput(BaseModel):
    """
    Project payload from external PPM (e.g. Roche DIA / Cora).
    Used for import; name is derived from order_ids[0], description, or id.
    """
    id: Optional[int] = None
    parent_project_ids: List[int] = Field(default_factory=list, alias="parentProjectIds")
    archived: bool = False
    description: Optional[str] = None
    live_date: Optional[str] = Field(None, alias="liveDate")
    start_date: Optional[str] = Field(None, alias="startDate")
    finish_date: Optional[str] = Field(None, alias="finishDate")
    date_last_updated: Optional[str] = Field(None, alias="dateLastUpdated")
    percentage_complete: Optional[float] = Field(None, alias="percentageComplete")
    project_type_id: Optional[int] = Field(None, alias="projectTypeId")
    project_type_description: Optional[str] = Field(None, alias="projectTypeDescription")
    project_status_id: Optional[int] = Field(None, alias="projectStatusId")
    project_status_description: Optional[str] = Field(None, alias="projectStatusDescription")
    project_phase_id: Optional[int] = Field(None, alias="projectPhaseId")
    project_phase_description: Optional[str] = Field(None, alias="projectPhaseDescription")
    documents: List[Any] = Field(default_factory=list)
    strategy_id: Optional[int] = Field(None, alias="strategyId")
    strategy: Optional[str] = None
    ppm_project_home_url: Optional[str] = Field(None, alias="ppmProjectHomeUrl")
    project_request_status_id: Optional[int] = Field(None, alias="projectRequestStatusId")
    project_request_status_description: Optional[str] = Field(None, alias="projectRequestStatusDescription")
    project_strategies: List[Any] = Field(default_factory=list, alias="projectStrategies")
    legal_entity_id: Optional[int] = Field(None, alias="legalEntityId")
    legal_entity_description: Optional[str] = Field(None, alias="legalEntityDescription")
    order_ids: List[str] = Field(default_factory=list, alias="orderIds")
    pm_technique: Optional[int] = Field(None, alias="pmTechnique")
    pm_technique_description: Optional[str] = Field(None, alias="pmTechniqueDescription")
    freeze_period: Optional[int] = Field(None, alias="freezePeriod")
    freeze_period_description: Optional[str] = Field(None, alias="freezePeriodDescription")
    forecast_display_setting: Optional[str] = Field(None, alias="forecastDisplaySetting")
    cost_centre: Optional[str] = Field(None, alias="costCentre")
    country_id: Optional[int] = Field(None, alias="countryId")
    currency: Optional[str] = None

    model_config = {"populate_by_name": True}


class ProjectCreate(BaseModel):
    portfolio_id: UUID
    program_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.planning
    priority: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID] = None
    team_members: List[UUID] = []

class ProjectUpdate(BaseModel):
    """Partial update for project (e.g. program_id for drag-drop)."""
    program_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID] = None
    team_members: Optional[List[UUID]] = None


class ProjectResponse(BaseResponse):
    portfolio_id: str
    program_id: Optional[str] = None
    name: str
    description: Optional[str]
    status: str
    priority: Optional[str]
    budget: Optional[float]
    actual_cost: Optional[float]
    start_date: Optional[date]
    end_date: Optional[date]
    manager_id: Optional[str]
    team_members: List[str]
    health: str
    # PPM / external source fields (optional)
    external_id: Optional[int] = None
    parent_project_external_ids: Optional[List[int]] = None
    archived: Optional[bool] = None
    live_date: Optional[datetime] = None
    date_last_updated: Optional[datetime] = None
    percentage_complete: Optional[float] = None
    project_type_id: Optional[int] = None
    project_type_description: Optional[str] = None
    project_status_id: Optional[int] = None
    project_status_description: Optional[str] = None
    project_phase_id: Optional[int] = None
    project_phase_description: Optional[str] = None
    ppm_project_home_url: Optional[str] = None
    legal_entity_id: Optional[int] = None
    legal_entity_description: Optional[str] = None
    order_ids: Optional[List[str]] = None
    pm_technique: Optional[int] = None
    pm_technique_description: Optional[str] = None
    freeze_period: Optional[int] = None
    freeze_period_description: Optional[str] = None
    forecast_display_setting: Optional[str] = None
    cost_centre: Optional[str] = None
    country_id: Optional[int] = None
    currency: Optional[str] = None

class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None


class PortfolioResponse(BaseResponse):
    name: str
    description: Optional[str]
    owner_id: Optional[str] = None
    organization_id: Optional[str] = None
    path: Optional[str] = None


# Program models (Portfolio > Program > Project)
class ProgramCreate(BaseModel):
    portfolio_id: UUID
    name: str
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class ProgramResponse(BaseResponse):
    portfolio_id: str
    name: str
    description: Optional[str]
    sort_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_budget: Optional[float] = None
    total_actual_cost: Optional[float] = None
    project_count: Optional[int] = None
    alert_count: Optional[int] = None