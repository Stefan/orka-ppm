"""
Risk and Issue management Pydantic models
"""

from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from enum import Enum

from .base import BaseResponse

class RiskCategory(str, Enum):
    technical = "technical"
    financial = "financial"
    operational = "operational"
    strategic = "strategic"
    external = "external"

class RiskStatus(str, Enum):
    identified = "identified"
    analyzing = "analyzing"
    mitigating = "mitigating"
    closed = "closed"

class IssueSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class IssueStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"

class RiskCreate(BaseModel):
    project_id: UUID
    title: str
    description: Optional[str] = None
    category: RiskCategory
    probability: float  # 0.0 to 1.0
    impact: float  # 0.0 to 1.0
    status: RiskStatus = RiskStatus.identified
    mitigation: Optional[str] = None
    owner_id: Optional[UUID] = None
    due_date: Optional[date] = None

class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[RiskCategory] = None
    probability: Optional[float] = None
    impact: Optional[float] = None
    status: Optional[RiskStatus] = None
    mitigation: Optional[str] = None
    owner_id: Optional[UUID] = None
    due_date: Optional[date] = None

class RiskResponse(BaseResponse):
    project_id: str
    title: str
    description: Optional[str]
    category: str
    probability: float
    impact: float
    status: str
    mitigation: Optional[str]
    owner_id: Optional[str]
    due_date: Optional[date]

class IssueCreate(BaseModel):
    project_id: UUID
    risk_id: Optional[UUID] = None  # Link to risk if issue comes from risk materialization
    title: str
    description: Optional[str] = None
    severity: IssueSeverity
    status: IssueStatus = IssueStatus.open
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[IssueSeverity] = None
    status: Optional[IssueStatus] = None
    assigned_to: Optional[UUID] = None
    resolution: Optional[str] = None
    due_date: Optional[date] = None

class IssueResponse(BaseResponse):
    project_id: str
    risk_id: Optional[str]
    title: str
    description: Optional[str]
    severity: str
    status: str
    assigned_to: Optional[str]
    resolution: Optional[str]
    due_date: Optional[date]

class RiskForecastRequest(BaseModel):
    portfolio_id: Optional[str] = None
    project_id: Optional[str] = None