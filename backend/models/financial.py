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

# Project Controls Integration Models
class ProjectControlsFinancialData(BaseModel):
    """Extended financial data for project controls integration"""
    project_id: UUID
    budgeted_cost_of_work_scheduled: float  # BCWS/PV
    budgeted_cost_of_work_performed: float  # BCWP/EV
    actual_cost_of_work_performed: float    # ACWP/AC
    budget_at_completion: float             # BAC
    management_reserve: Optional[float] = None
    contingency_reserve: Optional[float] = None
    approved_change_orders: float = 0.0
    pending_change_orders: float = 0.0

class EnhancedFinancialSummary(FinancialSummary):
    """Enhanced financial summary with project controls metrics"""
    earned_value: float
    planned_value: float
    cost_performance_index: float
    schedule_performance_index: float
    estimate_at_completion: float
    estimate_to_complete: float
    variance_at_completion: float
    to_complete_performance_index: float
    performance_measurement_baseline: float

class FinancialForecast(BaseModel):
    """Financial forecasting model for project controls"""
    project_id: UUID
    forecast_period: str  # "monthly", "quarterly", "annual"
    forecast_data: List[dict]  # Time-series forecast data
    confidence_intervals: Dict[str, float]
    assumptions: List[str]
    risk_adjustments: Dict[str, float]
    generated_at: datetime
    generated_by: UUID