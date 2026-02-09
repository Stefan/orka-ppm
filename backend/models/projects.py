"""
Project-related Pydantic models
"""

from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from .base import BaseResponse, ProjectStatus, HealthIndicator

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