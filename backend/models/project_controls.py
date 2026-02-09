"""
Project Controls Pydantic models for ETC, EAC, and Earned Value Management
"""

from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum

from .base import BaseResponse

# Enums for Project Controls
class ETCCalculationMethod(str, Enum):
    bottom_up = "bottom_up"
    performance_based = "performance_based"
    parametric = "parametric"
    manual = "manual"

class EACCalculationMethod(str, Enum):
    current_performance = "current_performance"
    budget_performance = "budget_performance"
    management_forecast = "management_forecast"
    bottom_up = "bottom_up"

class ForecastScenarioType(str, Enum):
    best_case = "best_case"
    worst_case = "worst_case"
    most_likely = "most_likely"

class PerformanceTrend(str, Enum):
    improving = "improving"
    stable = "stable"
    declining = "declining"

class PredictionModel(str, Enum):
    linear_regression = "linear_regression"
    monte_carlo = "monte_carlo"
    expert_judgment = "expert_judgment"

# ETC Calculation Models
class ETCCalculationCreate(BaseModel):
    project_id: UUID
    work_package_id: Optional[UUID] = None
    calculation_method: ETCCalculationMethod
    remaining_work_hours: float = Field(ge=0)
    remaining_cost: float = Field(ge=0)
    productivity_factor: Optional[float] = Field(default=None, gt=0)
    confidence_level: float = Field(ge=0.0, le=1.0)
    justification: Optional[str] = None

class ETCCalculationResponse(BaseResponse):
    project_id: str
    work_package_id: Optional[str]
    calculation_method: str
    remaining_work_hours: float
    remaining_cost: float
    productivity_factor: Optional[float]
    confidence_level: float
    justification: Optional[str]
    calculated_by: str
    approved_by: Optional[str]
    calculation_date: datetime
    is_active: bool

class ETCCalculationRequest(BaseModel):
    calculation_method: ETCCalculationMethod
    work_package_ids: Optional[List[UUID]] = None
    productivity_factors: Optional[Dict[str, float]] = None
    manual_estimates: Optional[Dict[str, float]] = None
    justification: Optional[str] = None

# EAC Calculation Models
class EACCalculationCreate(BaseModel):
    project_id: UUID
    calculation_method: EACCalculationMethod
    budgeted_cost: float = Field(ge=0)
    actual_cost: float = Field(ge=0)
    earned_value: float = Field(ge=0)
    management_etc: Optional[float] = Field(default=None, ge=0)

class EACCalculationResponse(BaseResponse):
    project_id: str
    calculation_method: str
    budgeted_cost: float
    actual_cost: float
    earned_value: float
    cost_performance_index: float
    schedule_performance_index: float
    estimate_at_completion: float
    variance_at_completion: float
    to_complete_performance_index: float
    calculation_date: datetime
    is_baseline: bool

class EACCalculationRequest(BaseModel):
    calculation_method: EACCalculationMethod
    management_etc: Optional[float] = None
    include_risk_adjustments: bool = False

class EACComparisonResponse(BaseModel):
    project_id: str
    comparison_date: datetime
    calculations: List[EACCalculationResponse]
    recommended_method: str
    variance_analysis: Dict[str, float]

# Monthly Forecast Models
class MonthlyForecastCreate(BaseModel):
    project_id: UUID
    forecast_date: date
    planned_cost: float = Field(ge=0)
    forecasted_cost: float = Field(ge=0)
    planned_revenue: float = Field(ge=0)
    forecasted_revenue: float = Field(ge=0)
    cash_flow: float
    resource_costs: Optional[Dict[str, float]] = None
    risk_adjustments: Optional[Dict[str, float]] = None
    confidence_interval: Optional[Dict[str, float]] = None
    scenario_type: ForecastScenarioType = ForecastScenarioType.most_likely

class MonthlyForecastResponse(BaseResponse):
    project_id: str
    forecast_date: date
    planned_cost: float
    forecasted_cost: float
    planned_revenue: float
    forecasted_revenue: float
    cash_flow: float
    resource_costs: Optional[Dict[str, float]]
    risk_adjustments: Optional[Dict[str, float]]
    confidence_interval: Optional[Dict[str, float]]
    scenario_type: str

class MonthlyForecastRequest(BaseModel):
    start_date: date
    end_date: date
    include_risk_adjustments: bool = True
    scenario_types: List[ForecastScenarioType] = [ForecastScenarioType.most_likely]
    resource_constraints: Optional[Dict[str, Any]] = None

class ForecastScenarioRequest(BaseModel):
    scenario_parameters: Dict[str, Any]
    risk_factors: Optional[List[Dict[str, Any]]] = None
    confidence_level: float = Field(default=0.8, ge=0.0, le=1.0)

class ForecastScenarioResponse(BaseModel):
    project_id: str
    scenarios: Dict[str, List[MonthlyForecastResponse]]
    comparison_metrics: Dict[str, float]
    generated_at: datetime

# Earned Value Models
class EarnedValueMetricsCreate(BaseModel):
    project_id: UUID
    measurement_date: date
    planned_value: float = Field(ge=0)
    earned_value: float = Field(ge=0)
    actual_cost: float = Field(ge=0)
    budget_at_completion: float = Field(ge=0)
    percent_complete: float = Field(ge=0.0, le=100.0)

class EarnedValueMetricsResponse(BaseResponse):
    project_id: str
    measurement_date: date
    planned_value: float
    earned_value: float
    actual_cost: float
    budget_at_completion: float
    cost_variance: float
    schedule_variance: float
    cost_performance_index: float
    schedule_performance_index: float
    estimate_at_completion: float
    estimate_to_complete: float
    variance_at_completion: float
    to_complete_performance_index: float
    percent_complete: float
    percent_spent: float

class EarnedValueDashboardResponse(BaseModel):
    project_id: str
    current_metrics: EarnedValueMetricsResponse
    performance_trends: List[Dict[str, Any]]
    variance_analysis: Dict[str, Any]
    forecast_completion: Dict[str, Any]
    work_package_breakdown: List[Dict[str, Any]]

# Work Package Models
class WorkPackageCreate(BaseModel):
    project_id: UUID
    name: str
    description: Optional[str] = None
    budget: float = Field(ge=0)
    start_date: date
    end_date: date
    responsible_manager: UUID
    parent_package_id: Optional[UUID] = None

class WorkPackageResponse(BaseResponse):
    project_id: str
    name: str
    description: Optional[str]
    budget: float
    start_date: date
    end_date: date
    percent_complete: float
    actual_cost: float
    earned_value: float
    responsible_manager: str
    parent_package_id: Optional[str]
    is_active: bool

class WorkPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    percent_complete: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    earned_value: Optional[float] = Field(default=None, ge=0)
    responsible_manager: Optional[UUID] = None
    parent_package_id: Optional[UUID] = None
    is_active: Optional[bool] = None

# Performance Prediction Models
class PerformancePredictionCreate(BaseModel):
    project_id: UUID
    prediction_date: date
    completion_date_forecast: date
    cost_forecast: float = Field(ge=0)
    performance_trend: PerformanceTrend
    risk_factors: Optional[List[Dict[str, Any]]] = None
    confidence_score: float = Field(ge=0.0, le=1.0)
    recommended_actions: Optional[List[str]] = None
    prediction_model: PredictionModel

class PerformancePredictionResponse(BaseResponse):
    project_id: str
    prediction_date: date
    completion_date_forecast: date
    cost_forecast: float
    performance_trend: str
    risk_factors: Optional[List[Dict[str, Any]]]
    confidence_score: float
    recommended_actions: Optional[List[str]]
    prediction_model: str

class PerformancePredictionRequest(BaseModel):
    prediction_horizon_months: int = Field(default=6, ge=1, le=24)
    include_risk_analysis: bool = True
    prediction_models: List[PredictionModel] = [PredictionModel.linear_regression]
    confidence_level: float = Field(default=0.8, ge=0.0, le=1.0)

class PerformanceTrendsResponse(BaseModel):
    project_id: str
    analysis_period: Dict[str, date]
    cpi_trend: List[Dict[str, Any]]
    spi_trend: List[Dict[str, Any]]
    cost_variance_trend: List[Dict[str, Any]]
    schedule_variance_trend: List[Dict[str, Any]]
    performance_summary: Dict[str, Any]

# Variance Analysis Models
class VarianceAnalysisResponse(BaseModel):
    project_id: str
    analysis_date: datetime
    analysis_level: str  # "project", "phase", "work_package"
    cost_variances: List[Dict[str, Any]]
    schedule_variances: List[Dict[str, Any]]
    performance_indices: Dict[str, float]
    trend_analysis: Dict[str, Any]
    threshold_violations: List[Dict[str, Any]]
    recommended_actions: List[str]

# Integration Models
class FinancialIntegrationData(BaseModel):
    actual_costs: Dict[str, float]
    budget_changes: List[Dict[str, Any]]
    change_orders: List[Dict[str, Any]]
    payment_schedules: List[Dict[str, Any]]

class ResourceIntegrationData(BaseModel):
    resource_assignments: List[Dict[str, Any]]
    resource_rates: Dict[str, float]
    productivity_metrics: Dict[str, float]
    capacity_constraints: Dict[str, Any]

# Validation and Calculation Result Models
class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    recommendations: List[str] = []

class CalculationResult(BaseModel):
    calculation_id: str
    result_value: float
    confidence_level: float
    calculation_method: str
    input_parameters: Dict[str, Any]
    validation_result: ValidationResult
    calculated_at: datetime

# Performance Indices Model
class PerformanceIndices(BaseModel):
    cost_performance_index: float
    schedule_performance_index: float
    to_complete_performance_index: float
    cost_variance: float
    schedule_variance: float
    variance_at_completion: float
    estimate_at_completion: float
    estimate_to_complete: float

# Risk Factor Model
class RiskFactor(BaseModel):
    name: str
    category: str
    probability: float = Field(ge=0.0, le=1.0)
    impact: float
    mitigation_strategy: Optional[str] = None
    owner: Optional[str] = None

# Payment Terms Model
class PaymentTerms(BaseModel):
    milestone_payments: List[Dict[str, Any]]
    retention_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    payment_schedule: str  # "monthly", "milestone", "completion"
    currency: str = "USD"

# Forecast Parameters Model
class ForecastParameters(BaseModel):
    include_escalation: bool = True
    escalation_rate: float = Field(default=0.03, ge=0.0, le=1.0)
    include_seasonality: bool = False
    risk_buffer_percentage: float = Field(default=0.1, ge=0.0, le=1.0)
    resource_productivity_factors: Optional[Dict[str, float]] = None

# Scenario Parameters Model
class ScenarioParameters(BaseModel):
    name: str
    description: Optional[str] = None
    cost_adjustment_factor: float = Field(default=1.0, gt=0.0)
    schedule_adjustment_factor: float = Field(default=1.0, gt=0.0)
    risk_factors: List[RiskFactor] = []
    resource_constraints: Optional[Dict[str, Any]] = None