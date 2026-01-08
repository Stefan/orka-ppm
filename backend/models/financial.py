"""
Financial tracking and budget management Pydantic models
"""

from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from .base import BaseResponse

class BudgetAlertRuleCreate(BaseModel):
    project_id: Optional[UUID] = None
    threshold_percentage: float
    alert_type: str = "budget_threshold"
    notification_emails: List[str] = []
    is_active: bool = True

class BudgetAlertRuleResponse(BaseResponse):
    project_id: Optional[str]
    threshold_percentage: float
    alert_type: str
    notification_emails: List[str]
    is_active: bool

class BudgetAlert(BaseModel):
    project_id: UUID
    alert_type: str
    threshold_percentage: float
    current_percentage: float
    budget_amount: float
    spent_amount: float
    message: str
    recipients: List[str]

class BudgetAlertResponse(BaseResponse):
    project_id: str
    alert_type: str
    threshold_percentage: float
    current_percentage: float
    budget_amount: float
    spent_amount: float
    message: str
    recipients: List[str]
    is_resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]

class FinancialTrackingCreate(BaseModel):
    project_id: UUID
    category: str
    description: Optional[str] = None
    amount: float
    currency: str = "USD"
    transaction_type: str  # "expense", "income", "budget_allocation"
    date_incurred: date

class FinancialTrackingResponse(BaseResponse):
    project_id: str
    category: str
    description: Optional[str]
    amount: float
    currency: str
    transaction_type: str
    date_incurred: date

class BudgetAlertRule(BaseModel):
    project_id: Optional[UUID] = None  # None means applies to all projects
    threshold_percentage: float  # e.g., 80.0 for 80%
    alert_type: str = "budget_threshold"
    notification_emails: List[str] = []
    is_active: bool = True

class FinancialSummary(BaseModel):
    project_id: str
    total_budget: float
    total_spent: float
    remaining_budget: float
    budget_utilization_percentage: float
    variance: float
    variance_percentage: float
    last_updated: datetime

class ComprehensiveFinancialReport(BaseModel):
    summary: dict
    projects: List[dict]
    alerts: List[dict]
    trends: dict
    generated_at: datetime