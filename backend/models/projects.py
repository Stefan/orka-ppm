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
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.planning
    priority: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID] = None
    team_members: List[UUID] = []

class ProjectResponse(BaseResponse):
    portfolio_id: str
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
    owner_id: UUID

class PortfolioResponse(BaseResponse):
    name: str
    description: Optional[str]
    owner_id: str