# Design Document

## Introduction

This document outlines the design for an advanced Project Controls system that extends the existing PPM platform with comprehensive Estimate to Complete (ETC) and Estimate at Completion (EAC) calculations, month-by-month forecasting, and earned value management capabilities for Construction/Engineering projects.

## Architecture Overview

The Project Controls system follows the existing FastAPI backend and Next.js frontend architecture, integrating seamlessly with current financial tracking, resource management, and project management modules.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Project Controls Dashboard  │  ETC/EAC Calculator         │
│  Forecast Viewer            │  Earned Value Reports        │
│  Variance Analysis          │  Performance Predictor       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                      │
├─────────────────────────────────────────────────────────────┤
│  /project-controls/*        │  /forecasts/*               │
│  /earned-value/*           │  /performance-analytics/*    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  ETC Calculator Service     │  Forecast Engine Service     │
│  EAC Calculator Service     │  Earned Value Manager        │
│  Variance Analyzer Service  │  Performance Predictor       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  Project Controls Tables    │  Forecast Tables             │
│  Earned Value Tables       │  Performance Analytics        │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Core Project Controls Models

#### ETC Calculation Model
```python
class ETCCalculation(BaseModel):
    id: UUID
    project_id: UUID
    work_package_id: Optional[UUID]
    calculation_method: str  # "bottom_up", "performance_based", "parametric", "manual"
    remaining_work_hours: float
    remaining_cost: float
    productivity_factor: Optional[float]
    confidence_level: float  # 0.0 to 1.0
    justification: Optional[str]
    calculated_by: UUID
    approved_by: Optional[UUID]
    calculation_date: datetime
    is_active: bool = True
```

#### EAC Calculation Model
```python
class EACCalculation(BaseModel):
    id: UUID
    project_id: UUID
    calculation_method: str  # "current_performance", "budget_performance", "management_forecast", "bottom_up"
    budgeted_cost: float  # BAC
    actual_cost: float    # AC
    earned_value: float   # EV
    cost_performance_index: float  # CPI
    schedule_performance_index: float  # SPI
    estimate_at_completion: float  # EAC
    variance_at_completion: float  # VAC = BAC - EAC
    to_complete_performance_index: float  # TCPI
    calculation_date: datetime
    is_baseline: bool = False
```

#### Monthly Forecast Model
```python
class MonthlyForecast(BaseModel):
    id: UUID
    project_id: UUID
    forecast_date: date
    planned_cost: float
    forecasted_cost: float
    planned_revenue: float
    forecasted_revenue: float
    cash_flow: float
    resource_costs: Dict[str, float]
    risk_adjustments: Dict[str, float]
    confidence_interval: Dict[str, float]  # {"lower": 0.8, "upper": 1.2}
    scenario_type: str = "most_likely"  # "best_case", "worst_case", "most_likely"
```

#### Earned Value Metrics Model
```python
class EarnedValueMetrics(BaseModel):
    id: UUID
    project_id: UUID
    measurement_date: date
    planned_value: float      # PV (BCWS)
    earned_value: float       # EV (BCWP)
    actual_cost: float        # AC (ACWP)
    budget_at_completion: float  # BAC
    cost_variance: float      # CV = EV - AC
    schedule_variance: float  # SV = EV - PV
    cost_performance_index: float     # CPI = EV / AC
    schedule_performance_index: float # SPI = EV / PV
    estimate_at_completion: float     # EAC
    estimate_to_complete: float       # ETC
    variance_at_completion: float     # VAC = BAC - EAC
    to_complete_performance_index: float  # TCPI
    percent_complete: float
    percent_spent: float
```

#### Performance Prediction Model
```python
class PerformancePrediction(BaseModel):
    id: UUID
    project_id: UUID
    prediction_date: date
    completion_date_forecast: date
    cost_forecast: float
    performance_trend: str  # "improving", "stable", "declining"
    risk_factors: List[Dict[str, Any]]
    confidence_score: float
    recommended_actions: List[str]
    prediction_model: str  # "linear_regression", "monte_carlo", "expert_judgment"
```

### Extended Financial Models

#### Work Package Model
```python
class WorkPackage(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    budget: float
    start_date: date
    end_date: date
    percent_complete: float = 0.0
    actual_cost: float = 0.0
    earned_value: float = 0.0
    responsible_manager: UUID
    parent_package_id: Optional[UUID]
    is_active: bool = True
```

## API Endpoints

### Project Controls Router (`/project-controls`)

#### ETC Calculations
```python
@router.post("/etc/calculate")
async def calculate_etc(
    project_id: UUID,
    calculation_request: ETCCalculationRequest,
    current_user = Depends(get_current_user)
) -> ETCCalculationResponse

@router.get("/etc/{project_id}")
async def get_project_etc(
    project_id: UUID,
    method: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> List[ETCCalculationResponse]

@router.post("/etc/{calculation_id}/approve")
async def approve_etc_calculation(
    calculation_id: UUID,
    current_user = Depends(require_permission(Permission.project_controls_approve))
) -> ETCCalculationResponse
```

#### EAC Calculations
```python
@router.post("/eac/calculate")
async def calculate_eac(
    project_id: UUID,
    calculation_request: EACCalculationRequest,
    current_user = Depends(get_current_user)
) -> EACCalculationResponse

@router.get("/eac/{project_id}/comparison")
async def compare_eac_methods(
    project_id: UUID,
    current_user = Depends(get_current_user)
) -> EACComparisonResponse

@router.post("/eac/{project_id}/baseline")
async def set_eac_baseline(
    project_id: UUID,
    calculation_id: UUID,
    current_user = Depends(require_permission(Permission.project_controls_baseline))
) -> EACCalculationResponse
```

### Forecasting Router (`/forecasts`)

#### Monthly Forecasts
```python
@router.post("/monthly/{project_id}")
async def generate_monthly_forecast(
    project_id: UUID,
    forecast_request: MonthlyForecastRequest,
    current_user = Depends(get_current_user)
) -> List[MonthlyForecastResponse]

@router.get("/monthly/{project_id}")
async def get_monthly_forecasts(
    project_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    scenario_type: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> List[MonthlyForecastResponse]

@router.post("/scenarios/{project_id}")
async def generate_forecast_scenarios(
    project_id: UUID,
    scenario_request: ForecastScenarioRequest,
    current_user = Depends(get_current_user)
) -> ForecastScenarioResponse
```

### Earned Value Router (`/earned-value`)

#### Earned Value Management
```python
@router.post("/metrics/{project_id}")
async def calculate_earned_value_metrics(
    project_id: UUID,
    measurement_date: date,
    current_user = Depends(get_current_user)
) -> EarnedValueMetricsResponse

@router.get("/metrics/{project_id}")
async def get_earned_value_history(
    project_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user = Depends(get_current_user)
) -> List[EarnedValueMetricsResponse]

@router.get("/dashboard/{project_id}")
async def get_earned_value_dashboard(
    project_id: UUID,
    current_user = Depends(get_current_user)
) -> EarnedValueDashboardResponse
```

### Performance Analytics Router (`/performance-analytics`)

#### Performance Predictions
```python
@router.post("/predict/{project_id}")
async def generate_performance_prediction(
    project_id: UUID,
    prediction_request: PerformancePredictionRequest,
    current_user = Depends(get_current_user)
) -> PerformancePredictionResponse

@router.get("/trends/{project_id}")
async def get_performance_trends(
    project_id: UUID,
    period_months: int = 12,
    current_user = Depends(get_current_user)
) -> PerformanceTrendsResponse

@router.get("/variance-analysis/{project_id}")
async def get_variance_analysis(
    project_id: UUID,
    analysis_level: str = "project",  # "project", "phase", "work_package"
    current_user = Depends(get_current_user)
) -> VarianceAnalysisResponse
```

## Service Layer Design

### ETC Calculator Service

```python
class ETCCalculatorService:
    def calculate_bottom_up_etc(self, project_id: UUID, work_packages: List[WorkPackage]) -> float:
        """Calculate ETC by summing detailed estimates for remaining work"""
        
    def calculate_performance_based_etc(self, project_id: UUID, cpi: float, remaining_budget: float) -> float:
        """Calculate ETC using Cost Performance Index: ETC = (BAC - EV) / CPI"""
        
    def calculate_parametric_etc(self, project_id: UUID, productivity_factors: Dict[str, float]) -> float:
        """Calculate ETC using historical performance ratios and productivity factors"""
        
    def calculate_weighted_etc(self, etc_calculations: List[ETCCalculation]) -> ETCCalculation:
        """Calculate weighted average ETC with confidence intervals"""
        
    def validate_etc_calculation(self, calculation: ETCCalculation) -> ValidationResult:
        """Validate ETC calculation against business rules and thresholds"""
```

### EAC Calculator Service

```python
class EACCalculatorService:
    def calculate_current_performance_eac(self, ac: float, bac: float, ev: float) -> float:
        """EAC = AC + (BAC - EV) / CPI"""
        
    def calculate_budget_performance_eac(self, ac: float, bac: float, ev: float, cpi: float, spi: float) -> float:
        """EAC = AC + (BAC - EV) / (CPI × SPI)"""
        
    def calculate_management_forecast_eac(self, ac: float, management_etc: float) -> float:
        """EAC = AC + Management ETC"""
        
    def calculate_bottom_up_eac(self, project_id: UUID) -> float:
        """Calculate EAC using detailed bottom-up estimates"""
        
    def compare_eac_methods(self, project_id: UUID) -> EACComparison:
        """Compare different EAC calculation methods and provide variance analysis"""
```

### Forecast Engine Service

```python
class ForecastEngineService:
    def generate_monthly_cost_forecast(self, project_id: UUID, forecast_params: ForecastParameters) -> List[MonthlyForecast]:
        """Generate month-by-month cost forecasts based on work schedules and resource assignments"""
        
    def generate_cash_flow_forecast(self, project_id: UUID, payment_terms: PaymentTerms) -> List[MonthlyForecast]:
        """Generate cash flow forecasts considering payment terms and milestone payments"""
        
    def apply_risk_adjustments(self, base_forecast: List[MonthlyForecast], risk_factors: List[RiskFactor]) -> List[MonthlyForecast]:
        """Apply risk adjustments to base forecasts"""
        
    def generate_scenario_forecasts(self, project_id: UUID, scenarios: List[ScenarioParameters]) -> Dict[str, List[MonthlyForecast]]:
        """Generate best-case, worst-case, and most-likely forecast scenarios"""
```

### Earned Value Manager Service

```python
class EarnedValueManagerService:
    def calculate_earned_value_metrics(self, project_id: UUID, measurement_date: date) -> EarnedValueMetrics:
        """Calculate comprehensive earned value metrics for a specific date"""
        
    def update_work_package_progress(self, work_package_id: UUID, percent_complete: float) -> WorkPackage:
        """Update work package progress and recalculate earned value"""
        
    def generate_earned_value_report(self, project_id: UUID, report_period: DateRange) -> EarnedValueReport:
        """Generate comprehensive earned value report with trends and analysis"""
        
    def calculate_performance_indices(self, pv: float, ev: float, ac: float, bac: float) -> PerformanceIndices:
        """Calculate CPI, SPI, TCPI, and other performance indices"""
```

## Frontend Components

### Project Controls Dashboard

```typescript
// app/project-controls/page.tsx
interface ProjectControlsDashboard {
  project: Project
  etcCalculations: ETCCalculation[]
  eacCalculations: EACCalculation[]
  earnedValueMetrics: EarnedValueMetrics
  monthlyForecasts: MonthlyForecast[]
  performanceTrends: PerformanceTrend[]
}

// Key components:
// - ETC/EAC Calculator Widget
// - Earned Value Performance Chart
// - Monthly Forecast Timeline
// - Variance Analysis Table
// - Performance Prediction Panel
```

### ETC/EAC Calculator Component

```typescript
// components/project-controls/ETCEACCalculator.tsx
interface ETCEACCalculatorProps {
  projectId: string
  onCalculationComplete: (result: CalculationResult) => void
}

// Features:
// - Multiple calculation method selection
// - Real-time calculation preview
// - Confidence interval display
// - Approval workflow integration
// - Historical comparison
```

### Forecast Viewer Component

```typescript
// components/project-controls/ForecastViewer.tsx
interface ForecastViewerProps {
  projectId: string
  forecastType: 'cost' | 'revenue' | 'cash_flow'
  scenarioType: 'best_case' | 'worst_case' | 'most_likely'
}

// Features:
// - Interactive timeline chart
// - Scenario comparison
// - Risk adjustment visualization
// - Export capabilities
// - Drill-down to monthly details
```

### Earned Value Dashboard Component

```typescript
// components/project-controls/EarnedValueDashboard.tsx
interface EarnedValueDashboardProps {
  projectId: string
  measurementPeriod: DateRange
}

// Features:
// - Performance index gauges
// - Trend charts (CPI, SPI over time)
// - Variance analysis tables
// - Forecast completion dates
// - Work package breakdown
```

## Database Schema

### Project Controls Tables

```sql
-- ETC Calculations
CREATE TABLE etc_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    work_package_id UUID REFERENCES work_packages(id),
    calculation_method VARCHAR(50) NOT NULL,
    remaining_work_hours DECIMAL(10,2) NOT NULL,
    remaining_cost DECIMAL(15,2) NOT NULL,
    productivity_factor DECIMAL(5,4),
    confidence_level DECIMAL(3,2) NOT NULL,
    justification TEXT,
    calculated_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- EAC Calculations
CREATE TABLE eac_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    calculation_method VARCHAR(50) NOT NULL,
    budgeted_cost DECIMAL(15,2) NOT NULL,
    actual_cost DECIMAL(15,2) NOT NULL,
    earned_value DECIMAL(15,2) NOT NULL,
    cost_performance_index DECIMAL(5,4) NOT NULL,
    schedule_performance_index DECIMAL(5,4) NOT NULL,
    estimate_at_completion DECIMAL(15,2) NOT NULL,
    variance_at_completion DECIMAL(15,2) NOT NULL,
    to_complete_performance_index DECIMAL(5,4) NOT NULL,
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    is_baseline BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Monthly Forecasts
CREATE TABLE monthly_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    forecast_date DATE NOT NULL,
    planned_cost DECIMAL(15,2) NOT NULL,
    forecasted_cost DECIMAL(15,2) NOT NULL,
    planned_revenue DECIMAL(15,2) NOT NULL,
    forecasted_revenue DECIMAL(15,2) NOT NULL,
    cash_flow DECIMAL(15,2) NOT NULL,
    resource_costs JSONB,
    risk_adjustments JSONB,
    confidence_interval JSONB,
    scenario_type VARCHAR(20) DEFAULT 'most_likely',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Earned Value Metrics
CREATE TABLE earned_value_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    measurement_date DATE NOT NULL,
    planned_value DECIMAL(15,2) NOT NULL,
    earned_value DECIMAL(15,2) NOT NULL,
    actual_cost DECIMAL(15,2) NOT NULL,
    budget_at_completion DECIMAL(15,2) NOT NULL,
    cost_variance DECIMAL(15,2) NOT NULL,
    schedule_variance DECIMAL(15,2) NOT NULL,
    cost_performance_index DECIMAL(5,4) NOT NULL,
    schedule_performance_index DECIMAL(5,4) NOT NULL,
    estimate_at_completion DECIMAL(15,2) NOT NULL,
    estimate_to_complete DECIMAL(15,2) NOT NULL,
    variance_at_completion DECIMAL(15,2) NOT NULL,
    to_complete_performance_index DECIMAL(5,4) NOT NULL,
    percent_complete DECIMAL(5,2) NOT NULL,
    percent_spent DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Work Packages
CREATE TABLE work_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budget DECIMAL(15,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    percent_complete DECIMAL(5,2) DEFAULT 0.0,
    actual_cost DECIMAL(15,2) DEFAULT 0.0,
    earned_value DECIMAL(15,2) DEFAULT 0.0,
    responsible_manager UUID NOT NULL REFERENCES users(id),
    parent_package_id UUID REFERENCES work_packages(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Predictions
CREATE TABLE performance_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    prediction_date DATE NOT NULL,
    completion_date_forecast DATE NOT NULL,
    cost_forecast DECIMAL(15,2) NOT NULL,
    performance_trend VARCHAR(20) NOT NULL,
    risk_factors JSONB,
    confidence_score DECIMAL(3,2) NOT NULL,
    recommended_actions JSONB,
    prediction_model VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes for Performance

```sql
-- Performance indexes
CREATE INDEX idx_etc_calculations_project_id ON etc_calculations(project_id);
CREATE INDEX idx_etc_calculations_active ON etc_calculations(project_id, is_active);
CREATE INDEX idx_eac_calculations_project_id ON eac_calculations(project_id);
CREATE INDEX idx_eac_calculations_baseline ON eac_calculations(project_id, is_baseline);
CREATE INDEX idx_monthly_forecasts_project_date ON monthly_forecasts(project_id, forecast_date);
CREATE INDEX idx_earned_value_metrics_project_date ON earned_value_metrics(project_id, measurement_date);
CREATE INDEX idx_work_packages_project_id ON work_packages(project_id);
CREATE INDEX idx_work_packages_active ON work_packages(project_id, is_active);
CREATE INDEX idx_performance_predictions_project_id ON performance_predictions(project_id);
```

## Integration Points

### Existing System Integration

1. **Financial Tracking Integration**
   - Sync actual costs from `financial_tracking` table
   - Update budget allocations and change orders
   - Integrate with budget alert system

2. **Resource Management Integration**
   - Pull resource assignments and rates
   - Calculate resource-based cost forecasts
   - Integrate with capacity planning

3. **Project Management Integration**
   - Sync project schedules and milestones
   - Update project health indicators
   - Integrate with risk management

4. **Dashboard Integration**
   - Add Project Controls widgets to main dashboard
   - Integrate performance metrics with existing KPIs
   - Provide drill-down capabilities

## Security and Permissions

### Role-Based Access Control

```python
class ProjectControlsPermission(Enum):
    project_controls_read = "project_controls:read"
    project_controls_calculate = "project_controls:calculate"
    project_controls_approve = "project_controls:approve"
    project_controls_baseline = "project_controls:baseline"
    project_controls_forecast = "project_controls:forecast"
    project_controls_admin = "project_controls:admin"
```

### Data Access Patterns

- **Project Managers**: Full access to their projects' controls data
- **Financial Analysts**: Read access to all projects, calculate permissions
- **Executives**: Dashboard and summary views across all projects
- **Project Controls Specialists**: Full access with approval permissions
- **Auditors**: Read-only access to historical data and baselines

## Performance Considerations

### Caching Strategy

1. **ETC/EAC Calculations**: Cache approved calculations for 24 hours
2. **Monthly Forecasts**: Cache forecast data for 1 hour
3. **Earned Value Metrics**: Cache daily metrics for 4 hours
4. **Performance Trends**: Cache trend analysis for 2 hours

### Database Optimization

1. **Partitioning**: Partition large tables by project_id and date
2. **Archiving**: Archive historical data older than 2 years
3. **Materialized Views**: Create views for common dashboard queries
4. **Query Optimization**: Optimize complex earned value calculations

## Correctness Properties

### Property 1: ETC Calculation Accuracy
**Property**: All ETC calculations must be mathematically correct and traceable
**Verification**: 
- Bottom-up ETC = Sum of all remaining work package estimates
- Performance-based ETC = (BAC - EV) / CPI where CPI > 0
- Parametric ETC uses validated productivity factors
- Manual ETC requires justification and approval

### Property 2: EAC Calculation Consistency
**Property**: EAC calculations must follow standard earned value formulas
**Verification**:
- Current Performance: EAC = AC + (BAC - EV) / CPI
- Budget Performance: EAC = AC + (BAC - EV) / (CPI × SPI)
- Management Forecast: EAC = AC + Management ETC
- Bottom-up: EAC = AC + Sum of remaining work estimates

### Property 3: Earned Value Metric Integrity
**Property**: Earned value metrics must maintain mathematical relationships
**Verification**:
- CV = EV - AC (Cost Variance)
- SV = EV - PV (Schedule Variance)
- CPI = EV / AC where AC > 0
- SPI = EV / PV where PV > 0
- VAC = BAC - EAC (Variance at Completion)

### Property 4: Forecast Data Consistency
**Property**: Monthly forecasts must be internally consistent and realistic
**Verification**:
- Sum of monthly forecasts equals total project forecast
- Cash flow calculations consider payment terms and milestones
- Risk adjustments are within reasonable bounds (±50%)
- Confidence intervals are mathematically valid

### Property 5: Performance Index Validity
**Property**: Performance indices must be within valid ranges and meaningful
**Verification**:
- CPI and SPI are positive numbers
- TCPI = (BAC - EV) / (BAC - AC) for BAC > AC
- Percent complete ≤ 100%
- Performance trends are based on statistical analysis

### Property 6: Work Package Hierarchy Integrity
**Property**: Work package data must maintain hierarchical consistency
**Verification**:
- Child work package costs sum to parent package costs
- Progress percentages are weighted by budget
- Earned value calculations roll up correctly
- No circular references in parent-child relationships

### Property 7: Baseline Management Accuracy
**Property**: Baseline data must be immutable and properly versioned
**Verification**:
- Only one active baseline per project at a time
- Baseline changes require proper approval workflow
- Historical baselines are preserved for audit trail
- Variance calculations use correct baseline data

### Property 8: Resource-Based Forecast Accuracy
**Property**: Resource-based forecasts must reflect actual resource assignments
**Verification**:
- Resource costs match current rates and assignments
- Productivity factors are based on historical data
- Availability constraints are properly considered
- Escalation rates are applied consistently

### Property 9: Risk-Adjusted Forecast Validity
**Property**: Risk adjustments must be based on quantified risk assessments
**Verification**:
- Risk probabilities sum to ≤ 100% per category
- Impact calculations use validated methodologies
- Monte Carlo simulations use appropriate distributions
- Contingency recommendations are statistically sound

### Property 10: Integration Data Synchronization
**Property**: Project controls data must stay synchronized with source systems
**Verification**:
- Actual costs match financial tracking system
- Resource assignments sync with resource management
- Project schedules align with project management data
- Budget changes are reflected in all calculations

### Property 11: Calculation Method Transparency
**Property**: All calculation methods must be documented and auditable
**Verification**:
- Calculation formulas are clearly documented
- Input data sources are traceable
- Assumptions are explicitly stated
- Results can be independently verified

### Property 12: Performance Prediction Reliability
**Property**: Performance predictions must be based on statistical models
**Verification**:
- Prediction models use sufficient historical data
- Confidence intervals are statistically valid
- Trend analysis uses appropriate time periods
- External factors are properly weighted

### Property 13: Variance Analysis Completeness
**Property**: Variance analysis must identify all significant deviations
**Verification**:
- Cost and schedule variances are calculated at all levels
- Variance thresholds are configurable and enforced
- Root cause analysis is supported by data
- Corrective action recommendations are actionable

### Property 14: Forecast Scenario Consistency
**Property**: Multiple forecast scenarios must be internally consistent
**Verification**:
- Best-case scenarios use optimistic but realistic assumptions
- Worst-case scenarios consider credible risk events
- Most-likely scenarios reflect current performance trends
- Scenario differences are clearly documented

### Property 15: Dashboard Data Accuracy
**Property**: Dashboard displays must reflect current and accurate data
**Verification**:
- Real-time data updates within defined refresh intervals
- Aggregated metrics match detailed calculations
- Visual representations accurately reflect underlying data
- Export functions provide complete and accurate data

### Property 16: Approval Workflow Integrity
**Property**: Approval workflows must enforce proper authorization
**Verification**:
- Only authorized users can approve calculations
- Approval history is maintained and auditable
- Approved data cannot be modified without re-approval
- Workflow states are properly managed

### Property 17: Historical Data Preservation
**Property**: Historical project controls data must be preserved for audit
**Verification**:
- All calculation versions are retained
- Data modifications are logged with timestamps
- Audit trails include user identification
- Data retention policies are enforced

### Property 18: Performance Threshold Management
**Property**: Performance thresholds must trigger appropriate alerts
**Verification**:
- Threshold values are configurable by role
- Alert notifications are sent to appropriate stakeholders
- Escalation procedures are followed for critical variances
- Alert resolution is tracked and documented

### Property 19: Currency and Unit Consistency
**Property**: All financial calculations must use consistent currency and units
**Verification**:
- Currency conversions use current exchange rates
- Unit conversions are mathematically correct
- Display formats match user preferences
- Rounding rules are consistently applied

### Property 20: System Performance Requirements
**Property**: System must meet performance requirements for large datasets
**Verification**:
- Dashboard loads within 3 seconds for projects with <1000 work packages
- Calculations complete within 30 seconds for complex projects
- Concurrent user access doesn't degrade performance
- Database queries are optimized for large data volumes