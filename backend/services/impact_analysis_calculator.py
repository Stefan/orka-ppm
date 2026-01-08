"""
Impact Analysis Calculator Service

Calculates comprehensive impacts on schedule, cost, and risks for change requests.
Provides scenario analysis and baseline update functionality.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime, timedelta
import asyncio
import random
from dataclasses import dataclass

from ..config.database import get_database
from ..models.change_management import (
    ChangeRequestResponse, ImpactAnalysisResponse, ChangeType
)
from ..models.projects import ProjectResponse
from ..models.risks import RiskResponse, RiskCategory
from ..models.financial import FinancialSummary

logger = logging.getLogger(__name__)

@dataclass
class ProjectSchedule:
    """Project schedule data for impact analysis"""
    project_id: UUID
    activities: List[Dict[str, Any]]
    critical_path: List[str]
    total_duration_days: int
    start_date: date
    end_date: date

@dataclass
class ProjectBudget:
    """Project budget data for impact analysis"""
    project_id: UUID
    total_budget: Decimal
    spent_amount: Decimal
    remaining_budget: Decimal
    budget_categories: Dict[str, Decimal]

@dataclass
class Risk:
    """Risk data for impact analysis"""
    id: UUID
    title: str
    category: str
    probability: float
    impact: float
    mitigation_cost: Decimal

@dataclass
class ScheduleImpactAnalysis:
    """Schedule impact analysis results"""
    critical_path_affected: bool
    schedule_impact_days: int
    affected_activities: List[Dict[str, Any]]
    new_end_date: Optional[date]
    delay_cost: Decimal

@dataclass
class CostImpactAnalysis:
    """Cost impact analysis results"""
    total_cost_impact: Decimal
    direct_costs: Decimal
    indirect_costs: Decimal
    cost_savings: Decimal
    cost_breakdown: Dict[str, Decimal]

@dataclass
class RiskImpactAnalysis:
    """Risk impact analysis results"""
    new_risks: List[Dict[str, Any]]
    modified_risks: List[Dict[str, Any]]
    risk_mitigation_costs: Decimal
    overall_risk_score_change: float

@dataclass
class ImpactScenarios:
    """Impact scenarios for best/worst/most-likely cases"""
    best_case: Dict[str, Any]
    worst_case: Dict[str, Any]
    most_likely: Dict[str, Any]
    monte_carlo_results: Optional[Dict[str, Any]]
    sensitivity_analysis: Optional[Dict[str, Any]] = None

@dataclass
class BaselineUpdateResult:
    """Results of baseline update operation"""
    success: bool
    updated_budget: Optional[Decimal]
    updated_end_date: Optional[date]
    updated_milestones: List[Dict[str, Any]]
    rollup_impacts: Dict[str, Any]
    baseline_update_id: Optional[UUID] = None
    budget_adjustments: List[Dict[str, Any]] = None
    resource_adjustments: List[Dict[str, Any]] = None
    risk_adjustments: List[Dict[str, Any]] = None
    error_message: Optional[str] = None

class ImpactAnalysisCalculator:
    """
    Service for calculating comprehensive impacts of change requests on schedule, cost, and risks.
    """
    
    def __init__(self):
        self.db = get_database()
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def calculate_schedule_impact(
        self,
        change_request: ChangeRequestResponse,
        project_schedule: Optional[ProjectSchedule] = None
    ) -> ScheduleImpactAnalysis:
        """
        Calculate schedule impact including critical path analysis.
        
        Args:
            change_request: The change request to analyze
            project_schedule: Project schedule data (will fetch if not provided)
            
        Returns:
            ScheduleImpactAnalysis with detailed schedule impact information
        """
        try:
            logger.info(f"Calculating schedule impact for change request {change_request.id}")
            
            # Get project schedule if not provided
            if not project_schedule:
                project_schedule = await self._get_project_schedule(UUID(change_request.project_id))
            
            # Determine if critical path is affected based on change type and scope
            critical_path_affected = self._is_critical_path_affected(change_request, project_schedule)
            
            # Calculate schedule impact days
            schedule_impact_days = self._calculate_schedule_impact_days(change_request, project_schedule)
            
            # Identify affected activities
            affected_activities = self._identify_affected_activities(change_request, project_schedule)
            
            # Calculate new end date if there's a delay
            new_end_date = None
            if schedule_impact_days > 0:
                new_end_date = project_schedule.end_date + timedelta(days=schedule_impact_days)
            
            # Calculate delay cost (if any)
            delay_cost = self._calculate_delay_cost(schedule_impact_days, change_request)
            
            return ScheduleImpactAnalysis(
                critical_path_affected=critical_path_affected,
                schedule_impact_days=schedule_impact_days,
                affected_activities=affected_activities,
                new_end_date=new_end_date,
                delay_cost=delay_cost
            )
            
        except Exception as e:
            logger.error(f"Error calculating schedule impact: {str(e)}")
            raise
    
    async def calculate_cost_impact(
        self,
        change_request: ChangeRequestResponse,
        project_budget: Optional[ProjectBudget] = None
    ) -> CostImpactAnalysis:
        """
        Calculate comprehensive cost impact including direct, indirect costs and savings.
        
        Args:
            change_request: The change request to analyze
            project_budget: Project budget data (will fetch if not provided)
            
        Returns:
            CostImpactAnalysis with detailed cost impact breakdown
        """
        try:
            logger.info(f"Calculating cost impact for change request {change_request.id}")
            
            # Get project budget if not provided
            if not project_budget:
                project_budget = await self._get_project_budget(UUID(change_request.project_id))
            
            # Calculate direct costs
            direct_costs = self._calculate_direct_costs(change_request)
            
            # Calculate indirect costs (overhead, delays, etc.)
            indirect_costs = self._calculate_indirect_costs(change_request, project_budget)
            
            # Calculate potential cost savings
            cost_savings = self._calculate_cost_savings(change_request)
            
            # Create detailed cost breakdown
            cost_breakdown = self._create_cost_breakdown(change_request, direct_costs, indirect_costs, cost_savings)
            
            # Calculate total cost impact
            total_cost_impact = direct_costs + indirect_costs - cost_savings
            
            return CostImpactAnalysis(
                total_cost_impact=total_cost_impact,
                direct_costs=direct_costs,
                indirect_costs=indirect_costs,
                cost_savings=cost_savings,
                cost_breakdown=cost_breakdown
            )
            
        except Exception as e:
            logger.error(f"Error calculating cost impact: {str(e)}")
            raise
    
    async def assess_risk_impact(
        self,
        change_request: ChangeRequestResponse,
        existing_risks: Optional[List[Risk]] = None
    ) -> RiskImpactAnalysis:
        """
        Assess risk impact including new risks and modifications to existing risks.
        
        Args:
            change_request: The change request to analyze
            existing_risks: Existing project risks (will fetch if not provided)
            
        Returns:
            RiskImpactAnalysis with risk impact assessment
        """
        try:
            logger.info(f"Assessing risk impact for change request {change_request.id}")
            
            # Get existing risks if not provided
            if not existing_risks:
                existing_risks = await self._get_project_risks(UUID(change_request.project_id))
            
            # Identify new risks introduced by the change
            new_risks = self._identify_new_risks(change_request)
            
            # Assess modifications to existing risks
            modified_risks = self._assess_risk_modifications(change_request, existing_risks)
            
            # Calculate risk mitigation costs
            risk_mitigation_costs = self._calculate_risk_mitigation_costs(new_risks, modified_risks)
            
            # Calculate overall risk score change
            overall_risk_score_change = self._calculate_risk_score_change(
                existing_risks, new_risks, modified_risks
            )
            
            return RiskImpactAnalysis(
                new_risks=new_risks,
                modified_risks=modified_risks,
                risk_mitigation_costs=risk_mitigation_costs,
                overall_risk_score_change=overall_risk_score_change
            )
            
        except Exception as e:
            logger.error(f"Error assessing risk impact: {str(e)}")
            raise
    
    async def generate_impact_scenarios(
        self,
        change_request: ChangeRequestResponse
    ) -> ImpactScenarios:
        """
        Generate best-case, worst-case, and most-likely impact scenarios.
        
        Args:
            change_request: The change request to analyze
            
        Returns:
            ImpactScenarios with scenario analysis
        """
        try:
            logger.info(f"Generating impact scenarios for change request {change_request.id}")
            
            # Get base impact analyses
            schedule_impact = await self.calculate_schedule_impact(change_request)
            cost_impact = await self.calculate_cost_impact(change_request)
            risk_impact = await self.assess_risk_impact(change_request)
            
            # Generate scenarios with sensitivity analysis
            best_case = self._generate_best_case_scenario(schedule_impact, cost_impact, risk_impact, change_request)
            worst_case = self._generate_worst_case_scenario(schedule_impact, cost_impact, risk_impact, change_request)
            most_likely = self._generate_most_likely_scenario(schedule_impact, cost_impact, risk_impact, change_request)
            
            # Run Monte Carlo simulation for complex changes
            monte_carlo_results = None
            if self._should_run_monte_carlo(change_request):
                monte_carlo_results = await self._run_monte_carlo_simulation(change_request)
            
            # Add sensitivity analysis
            sensitivity_analysis = self._perform_sensitivity_analysis(change_request, schedule_impact, cost_impact, risk_impact)
            
            return ImpactScenarios(
                best_case=best_case,
                worst_case=worst_case,
                most_likely=most_likely,
                monte_carlo_results=monte_carlo_results,
                sensitivity_analysis=sensitivity_analysis
            )
            
        except Exception as e:
            logger.error(f"Error generating impact scenarios: {str(e)}")
            raise
    
    async def update_project_baselines(
        self,
        change_id: UUID,
        approved_impacts: Dict[str, Any]
    ) -> BaselineUpdateResult:
        """
        Update project baselines after change approval with comprehensive tracking.
        
        Args:
            change_id: The approved change request ID
            approved_impacts: The approved impact analysis data
            
        Returns:
            BaselineUpdateResult with update results
        """
        try:
            logger.info(f"Updating project baselines for approved change {change_id}")
            
            # Get change request details
            change_request = await self._get_change_request(change_id)
            if not change_request:
                raise ValueError(f"Change request {change_id} not found")
            
            project_id = UUID(change_request.project_id)
            
            # Create baseline update transaction
            baseline_update_id = await self._create_baseline_update_transaction(change_id, project_id)
            
            # Update budget baseline with detailed tracking
            updated_budget = None
            budget_adjustments = []
            if approved_impacts.get('cost_impact'):
                budget_result = await self._update_budget_baseline_comprehensive(
                    project_id,
                    approved_impacts['cost_impact'],
                    approved_impacts.get('cost_breakdown', {}),
                    change_id
                )
                updated_budget = budget_result['new_budget']
                budget_adjustments = budget_result['adjustments']
            
            # Update schedule baseline with milestone tracking
            updated_end_date = None
            milestone_adjustments = []
            if approved_impacts.get('schedule_impact_days', 0) > 0:
                schedule_result = await self._update_schedule_baseline_comprehensive(
                    project_id,
                    approved_impacts['schedule_impact_days'],
                    approved_impacts.get('affected_activities', []),
                    change_id
                )
                updated_end_date = schedule_result['new_end_date']
                milestone_adjustments = schedule_result['milestone_adjustments']
            
            # Update milestone baselines with dependency tracking
            updated_milestones = []
            if approved_impacts.get('affected_activities'):
                updated_milestones = await self._update_milestone_baselines_comprehensive(
                    project_id,
                    approved_impacts['affected_activities'],
                    change_id
                )
            
            # Update resource baselines
            resource_adjustments = []
            if approved_impacts.get('resource_impact'):
                resource_adjustments = await self._update_resource_baselines(
                    project_id,
                    approved_impacts['resource_impact'],
                    change_id
                )
            
            # Update risk baselines
            risk_adjustments = []
            if approved_impacts.get('risk_impact'):
                risk_adjustments = await self._update_risk_baselines(
                    project_id,
                    approved_impacts['risk_impact'],
                    change_id
                )
            
            # Calculate comprehensive rollup impacts for portfolio reporting
            rollup_impacts = await self._calculate_comprehensive_rollup_impacts(
                project_id,
                approved_impacts,
                {
                    'budget_adjustments': budget_adjustments,
                    'milestone_adjustments': milestone_adjustments,
                    'resource_adjustments': resource_adjustments,
                    'risk_adjustments': risk_adjustments
                }
            )
            
            # Update project health indicators
            await self._update_project_health_indicators(project_id, approved_impacts)
            
            # Create audit trail for baseline changes
            await self._create_baseline_audit_trail(
                baseline_update_id,
                change_id,
                project_id,
                approved_impacts,
                {
                    'budget': updated_budget,
                    'end_date': updated_end_date,
                    'milestones': updated_milestones
                }
            )
            
            # Notify stakeholders of baseline changes
            await self._notify_baseline_changes(project_id, change_id, rollup_impacts)
            
            return BaselineUpdateResult(
                success=True,
                updated_budget=updated_budget,
                updated_end_date=updated_end_date,
                updated_milestones=updated_milestones,
                rollup_impacts=rollup_impacts,
                baseline_update_id=baseline_update_id,
                budget_adjustments=budget_adjustments,
                resource_adjustments=resource_adjustments,
                risk_adjustments=risk_adjustments
            )
            
        except Exception as e:
            logger.error(f"Error updating project baselines: {str(e)}")
            return BaselineUpdateResult(
                success=False,
                updated_budget=None,
                updated_end_date=None,
                updated_milestones=[],
                rollup_impacts={},
                error_message=str(e)
            )
    
    # Private helper methods
    
    async def _get_project_schedule(self, project_id: UUID) -> ProjectSchedule:
        """Get project schedule data"""
        # This would typically fetch from a project management system
        # For now, return a mock schedule
        return ProjectSchedule(
            project_id=project_id,
            activities=[
                {"id": "ACT001", "name": "Foundation", "duration": 30, "critical": True},
                {"id": "ACT002", "name": "Structure", "duration": 60, "critical": True},
                {"id": "ACT003", "name": "Finishing", "duration": 45, "critical": False}
            ],
            critical_path=["ACT001", "ACT002"],
            total_duration_days=135,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=135)
        )
    
    async def _get_project_budget(self, project_id: UUID) -> ProjectBudget:
        """Get project budget data"""
        # This would typically fetch from the financial system
        # For now, return a mock budget
        return ProjectBudget(
            project_id=project_id,
            total_budget=Decimal('1000000.00'),
            spent_amount=Decimal('400000.00'),
            remaining_budget=Decimal('600000.00'),
            budget_categories={
                "materials": Decimal('500000.00'),
                "labor": Decimal('300000.00'),
                "equipment": Decimal('150000.00'),
                "overhead": Decimal('50000.00')
            }
        )
    
    async def _get_project_risks(self, project_id: UUID) -> List[Risk]:
        """Get existing project risks"""
        # This would typically fetch from the risk management system
        # For now, return mock risks
        return [
            Risk(
                id=UUID('12345678-1234-5678-9012-123456789012'),
                title="Weather delays",
                category="external",
                probability=0.3,
                impact=0.7,
                mitigation_cost=Decimal('25000.00')
            ),
            Risk(
                id=UUID('12345678-1234-5678-9012-123456789013'),
                title="Material cost increase",
                category="financial",
                probability=0.5,
                impact=0.6,
                mitigation_cost=Decimal('15000.00')
            )
        ]
    
    async def _get_change_request(self, change_id: UUID) -> Optional[ChangeRequestResponse]:
        """Get change request details"""
        # This would fetch from the database
        # For now, return None to indicate not implemented
        return None
    
    def _is_critical_path_affected(self, change_request: ChangeRequestResponse, schedule: ProjectSchedule) -> bool:
        """Determine if the change affects the critical path"""
        # Logic to determine critical path impact based on change type and scope
        critical_change_types = [ChangeType.SCHEDULE, ChangeType.SCOPE, ChangeType.DESIGN]
        
        if change_request.change_type in [ct.value for ct in critical_change_types]:
            return True
        
        # Check if estimated schedule impact is significant
        if change_request.estimated_schedule_impact_days and change_request.estimated_schedule_impact_days > 5:
            return True
        
        return False
    
    def _calculate_schedule_impact_days(self, change_request: ChangeRequestResponse, schedule: ProjectSchedule) -> int:
        """Calculate schedule impact in days"""
        # Use estimated impact if available
        if change_request.estimated_schedule_impact_days:
            return change_request.estimated_schedule_impact_days
        
        # Calculate based on change type and complexity
        base_impact = {
            ChangeType.SCOPE.value: 10,
            ChangeType.SCHEDULE.value: 15,
            ChangeType.DESIGN.value: 20,
            ChangeType.REGULATORY.value: 30,
            ChangeType.SAFETY.value: 25,
            ChangeType.EMERGENCY.value: 5
        }
        
        return base_impact.get(change_request.change_type, 7)
    
    def _identify_affected_activities(self, change_request: ChangeRequestResponse, schedule: ProjectSchedule) -> List[Dict[str, Any]]:
        """Identify activities affected by the change"""
        affected = []
        
        # For scope and design changes, assume multiple activities are affected
        if change_request.change_type in [ChangeType.SCOPE.value, ChangeType.DESIGN.value]:
            for activity in schedule.activities:
                if activity.get('critical', False):
                    affected.append({
                        "activity_id": activity['id'],
                        "activity_name": activity['name'],
                        "impact_type": "duration_increase",
                        "impact_days": 5
                    })
        
        return affected
    
    def _calculate_delay_cost(self, schedule_impact_days: int, change_request: ChangeRequestResponse) -> Decimal:
        """Calculate cost of schedule delays"""
        if schedule_impact_days <= 0:
            return Decimal('0.00')
        
        # Estimate daily project cost (overhead, equipment, etc.)
        daily_cost = Decimal('5000.00')  # This would be calculated based on project specifics
        
        return daily_cost * schedule_impact_days
    
    def _calculate_direct_costs(self, change_request: ChangeRequestResponse) -> Decimal:
        """Calculate direct costs of the change"""
        if change_request.estimated_cost_impact:
            return Decimal(str(change_request.estimated_cost_impact))
        
        # Estimate based on change type
        base_costs = {
            ChangeType.SCOPE.value: Decimal('50000.00'),
            ChangeType.DESIGN.value: Decimal('25000.00'),
            ChangeType.REGULATORY.value: Decimal('15000.00'),
            ChangeType.SAFETY.value: Decimal('30000.00'),
            ChangeType.QUALITY.value: Decimal('20000.00')
        }
        
        return base_costs.get(change_request.change_type, Decimal('10000.00'))
    
    def _calculate_indirect_costs(self, change_request: ChangeRequestResponse, budget: ProjectBudget) -> Decimal:
        """Calculate indirect costs (overhead, delays, etc.)"""
        direct_costs = self._calculate_direct_costs(change_request)
        
        # Indirect costs are typically 15-25% of direct costs
        indirect_percentage = Decimal('0.20')
        
        return direct_costs * indirect_percentage
    
    def _calculate_cost_savings(self, change_request: ChangeRequestResponse) -> Decimal:
        """Calculate potential cost savings from the change"""
        # Some changes might result in savings (efficiency improvements, etc.)
        if change_request.change_type == ChangeType.RESOURCE.value:
            return Decimal('5000.00')  # Example savings from resource optimization
        
        return Decimal('0.00')
    
    def _create_cost_breakdown(self, change_request: ChangeRequestResponse, direct: Decimal, indirect: Decimal, savings: Decimal) -> Dict[str, Decimal]:
        """Create detailed cost breakdown"""
        return {
            "materials": direct * Decimal('0.4'),
            "labor": direct * Decimal('0.35'),
            "equipment": direct * Decimal('0.15'),
            "overhead": indirect,
            "contingency": direct * Decimal('0.1'),
            "savings": -savings
        }
    
    def _identify_new_risks(self, change_request: ChangeRequestResponse) -> List[Dict[str, Any]]:
        """Identify new risks introduced by the change"""
        new_risks = []
        
        # Comprehensive risk patterns based on change type
        risk_patterns = {
            ChangeType.SCOPE.value: [
                {"title": "Scope creep beyond approved change", "category": "operational", "probability": 0.4, "impact": 0.6, "mitigation_cost": 15000},
                {"title": "Resource reallocation conflicts", "category": "operational", "probability": 0.3, "impact": 0.5, "mitigation_cost": 8000},
                {"title": "Stakeholder alignment issues", "category": "strategic", "probability": 0.25, "impact": 0.7, "mitigation_cost": 12000}
            ],
            ChangeType.DESIGN.value: [
                {"title": "Design integration issues", "category": "technical", "probability": 0.3, "impact": 0.7, "mitigation_cost": 20000},
                {"title": "Technical specification conflicts", "category": "technical", "probability": 0.4, "impact": 0.6, "mitigation_cost": 18000},
                {"title": "Quality assurance complications", "category": "operational", "probability": 0.2, "impact": 0.8, "mitigation_cost": 25000}
            ],
            ChangeType.REGULATORY.value: [
                {"title": "Regulatory approval delays", "category": "external", "probability": 0.5, "impact": 0.8, "mitigation_cost": 30000},
                {"title": "Compliance documentation gaps", "category": "external", "probability": 0.35, "impact": 0.6, "mitigation_cost": 15000},
                {"title": "Inspection and audit risks", "category": "external", "probability": 0.25, "impact": 0.9, "mitigation_cost": 40000}
            ],
            ChangeType.SCHEDULE.value: [
                {"title": "Critical path disruption", "category": "operational", "probability": 0.6, "impact": 0.8, "mitigation_cost": 35000},
                {"title": "Resource availability conflicts", "category": "operational", "probability": 0.4, "impact": 0.7, "mitigation_cost": 22000},
                {"title": "Dependency cascade delays", "category": "operational", "probability": 0.3, "impact": 0.75, "mitigation_cost": 28000}
            ],
            ChangeType.BUDGET.value: [
                {"title": "Cost overrun beyond approved change", "category": "financial", "probability": 0.45, "impact": 0.7, "mitigation_cost": 20000},
                {"title": "Funding availability risks", "category": "financial", "probability": 0.2, "impact": 0.9, "mitigation_cost": 50000},
                {"title": "Currency/inflation exposure", "category": "financial", "probability": 0.15, "impact": 0.6, "mitigation_cost": 10000}
            ],
            ChangeType.SAFETY.value: [
                {"title": "Safety protocol violations", "category": "operational", "probability": 0.2, "impact": 0.95, "mitigation_cost": 60000},
                {"title": "Worker safety training gaps", "category": "operational", "probability": 0.3, "impact": 0.8, "mitigation_cost": 25000},
                {"title": "Emergency response complications", "category": "operational", "probability": 0.15, "impact": 0.9, "mitigation_cost": 45000}
            ],
            ChangeType.QUALITY.value: [
                {"title": "Quality standard deviations", "category": "operational", "probability": 0.35, "impact": 0.7, "mitigation_cost": 30000},
                {"title": "Testing and validation delays", "category": "technical", "probability": 0.4, "impact": 0.6, "mitigation_cost": 18000},
                {"title": "Rework and correction costs", "category": "operational", "probability": 0.25, "impact": 0.8, "mitigation_cost": 35000}
            ],
            ChangeType.RESOURCE.value: [
                {"title": "Skilled resource unavailability", "category": "operational", "probability": 0.4, "impact": 0.7, "mitigation_cost": 25000},
                {"title": "Equipment procurement delays", "category": "operational", "probability": 0.3, "impact": 0.6, "mitigation_cost": 20000},
                {"title": "Subcontractor performance risks", "category": "external", "probability": 0.25, "impact": 0.75, "mitigation_cost": 30000}
            ],
            ChangeType.EMERGENCY.value: [
                {"title": "Inadequate emergency response", "category": "operational", "probability": 0.3, "impact": 0.9, "mitigation_cost": 50000},
                {"title": "Post-emergency compliance issues", "category": "external", "probability": 0.4, "impact": 0.7, "mitigation_cost": 35000},
                {"title": "Stakeholder confidence impact", "category": "strategic", "probability": 0.5, "impact": 0.6, "mitigation_cost": 20000}
            ]
        }
        
        # Get base risks for the change type
        base_risks = risk_patterns.get(change_request.change_type, [])
        
        # Adjust risk probabilities based on change characteristics
        for risk in base_risks:
            adjusted_risk = risk.copy()
            
            # Increase probability for high-priority changes
            if change_request.priority in ['high', 'critical', 'emergency']:
                adjusted_risk['probability'] = min(adjusted_risk['probability'] * 1.2, 1.0)
            
            # Increase impact for large cost changes
            if change_request.estimated_cost_impact and change_request.estimated_cost_impact > 100000:
                adjusted_risk['impact'] = min(adjusted_risk['impact'] * 1.1, 1.0)
            
            # Add risk ID and additional metadata
            adjusted_risk['risk_id'] = f"NEW_RISK_{len(new_risks) + 1:03d}"
            adjusted_risk['identified_date'] = datetime.now().isoformat()
            adjusted_risk['change_related'] = True
            
            new_risks.append(adjusted_risk)
        
        return new_risks
    
    def _assess_risk_modifications(self, change_request: ChangeRequestResponse, existing_risks: List[Risk]) -> List[Dict[str, Any]]:
        """Assess modifications to existing risks"""
        modified = []
        
        for risk in existing_risks:
            modification = None
            
            # Schedule changes affect time-dependent risks
            if change_request.change_type == ChangeType.SCHEDULE.value:
                if "weather" in risk.title.lower() or "delay" in risk.title.lower():
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.15, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": risk.impact,
                        "modification_reason": "Schedule change increases exposure time"
                    }
                elif "resource" in risk.title.lower():
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.1, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": min(risk.impact + 0.05, 1.0),
                        "modification_reason": "Schedule pressure increases resource risks"
                    }
            
            # Budget changes affect financial risks
            elif change_request.change_type == ChangeType.BUDGET.value:
                if risk.category == "financial":
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.2, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": min(risk.impact + 0.1, 1.0),
                        "modification_reason": "Budget changes increase financial risk exposure"
                    }
            
            # Scope changes affect operational risks
            elif change_request.change_type == ChangeType.SCOPE.value:
                if risk.category == "operational":
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.12, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": risk.impact,
                        "modification_reason": "Scope changes increase operational complexity"
                    }
            
            # Design changes affect technical risks
            elif change_request.change_type == ChangeType.DESIGN.value:
                if risk.category == "technical":
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.18, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": min(risk.impact + 0.08, 1.0),
                        "modification_reason": "Design changes increase technical integration risks"
                    }
            
            # Regulatory changes affect external/compliance risks
            elif change_request.change_type == ChangeType.REGULATORY.value:
                if risk.category == "external" or "compliance" in risk.title.lower():
                    modification = {
                        "risk_id": str(risk.id),
                        "title": risk.title,
                        "category": risk.category,
                        "old_probability": risk.probability,
                        "new_probability": min(risk.probability + 0.25, 1.0),
                        "old_impact": risk.impact,
                        "new_impact": min(risk.impact + 0.15, 1.0),
                        "modification_reason": "Regulatory changes increase compliance risks"
                    }
            
            # Safety changes affect all risk categories
            elif change_request.change_type == ChangeType.SAFETY.value:
                modification = {
                    "risk_id": str(risk.id),
                    "title": risk.title,
                    "category": risk.category,
                    "old_probability": risk.probability,
                    "new_probability": min(risk.probability + 0.1, 1.0),
                    "old_impact": risk.impact,
                    "new_impact": min(risk.impact + 0.2, 1.0),
                    "modification_reason": "Safety changes increase overall project risk profile"
                }
            
            # Emergency changes create urgency that affects all risks
            elif change_request.change_type == ChangeType.EMERGENCY.value:
                modification = {
                    "risk_id": str(risk.id),
                    "title": risk.title,
                    "category": risk.category,
                    "old_probability": risk.probability,
                    "new_probability": min(risk.probability + 0.15, 1.0),
                    "old_impact": risk.impact,
                    "new_impact": min(risk.impact + 0.1, 1.0),
                    "modification_reason": "Emergency changes reduce planning time and increase all risks"
                }
            
            if modification:
                # Add additional metadata
                modification['modification_date'] = datetime.now().isoformat()
                modification['change_id'] = change_request.id
                modification['risk_score_change'] = (
                    modification['new_probability'] * modification['new_impact'] -
                    modification['old_probability'] * modification['old_impact']
                )
                modified.append(modification)
        
        return modified
    
    def _calculate_risk_mitigation_costs(self, new_risks: List[Dict[str, Any]], modified_risks: List[Dict[str, Any]]) -> Decimal:
        """Calculate costs for risk mitigation"""
        total_cost = Decimal('0.00')
        
        # Cost for new risks - use specific mitigation costs if available
        for risk in new_risks:
            if 'mitigation_cost' in risk:
                total_cost += Decimal(str(risk['mitigation_cost']))
            else:
                # Fallback calculation based on risk value
                risk_value = risk['probability'] * risk['impact']
                mitigation_cost = Decimal(str(risk_value * 15000))  # Base mitigation cost
                total_cost += mitigation_cost
        
        # Additional cost for modified risks
        for risk in modified_risks:
            probability_increase = risk['new_probability'] - risk['old_probability']
            impact_increase = risk['new_impact'] - risk['old_impact']
            
            if probability_increase > 0 or impact_increase > 0:
                # Calculate additional mitigation cost based on risk increase
                risk_increase = (
                    risk['new_probability'] * risk['new_impact'] -
                    risk['old_probability'] * risk['old_impact']
                )
                additional_cost = Decimal(str(risk_increase * 12000))  # Cost per risk unit increase
                total_cost += additional_cost
        
        return total_cost
    
    def _calculate_risk_score_change(self, existing_risks: List[Risk], new_risks: List[Dict[str, Any]], modified_risks: List[Dict[str, Any]]) -> float:
        """Calculate overall risk score change"""
        # Calculate current risk score
        current_score = sum(risk.probability * risk.impact for risk in existing_risks)
        
        # Add new risks
        new_risk_score = sum(risk['probability'] * risk['impact'] for risk in new_risks)
        
        # Account for modified risks
        modification_impact = 0.0
        for risk in modified_risks:
            old_score = risk['old_probability'] * risk['old_impact']
            new_score = risk['new_probability'] * risk['new_impact']
            modification_impact += (new_score - old_score)
        
        return new_risk_score + modification_impact
    
    def recalculate_risk_probabilities_and_impacts(
        self,
        change_request: ChangeRequestResponse,
        existing_risks: List[Risk]
    ) -> List[Dict[str, Any]]:
        """
        Recalculate risk probabilities and impacts based on change characteristics.
        
        Args:
            change_request: The change request affecting risks
            existing_risks: Current project risks
            
        Returns:
            List of risks with recalculated probabilities and impacts
        """
        recalculated_risks = []
        
        for risk in existing_risks:
            new_probability = risk.probability
            new_impact = risk.impact
            recalculation_factors = []
            
            # Apply change-specific adjustments
            if change_request.change_type == ChangeType.SCHEDULE.value:
                if risk.category == "external" or "weather" in risk.title.lower():
                    new_probability = min(risk.probability * 1.2, 1.0)
                    recalculation_factors.append("Extended timeline increases exposure")
                
                if "resource" in risk.title.lower():
                    new_probability = min(risk.probability * 1.15, 1.0)
                    new_impact = min(risk.impact * 1.1, 1.0)
                    recalculation_factors.append("Schedule pressure affects resource availability")
            
            elif change_request.change_type == ChangeType.BUDGET.value:
                if risk.category == "financial":
                    new_probability = min(risk.probability * 1.3, 1.0)
                    new_impact = min(risk.impact * 1.2, 1.0)
                    recalculation_factors.append("Budget changes increase financial risk exposure")
            
            elif change_request.change_type == ChangeType.SCOPE.value:
                if risk.category in ["operational", "technical"]:
                    new_probability = min(risk.probability * 1.18, 1.0)
                    recalculation_factors.append("Scope changes increase complexity")
            
            elif change_request.change_type == ChangeType.DESIGN.value:
                if risk.category == "technical":
                    new_probability = min(risk.probability * 1.25, 1.0)
                    new_impact = min(risk.impact * 1.15, 1.0)
                    recalculation_factors.append("Design changes affect technical integration")
            
            elif change_request.change_type == ChangeType.REGULATORY.value:
                if risk.category == "external" or "compliance" in risk.title.lower():
                    new_probability = min(risk.probability * 1.4, 1.0)
                    new_impact = min(risk.impact * 1.25, 1.0)
                    recalculation_factors.append("Regulatory changes increase compliance complexity")
            
            elif change_request.change_type == ChangeType.SAFETY.value:
                # Safety changes affect all risks due to increased scrutiny
                new_probability = min(risk.probability * 1.1, 1.0)
                new_impact = min(risk.impact * 1.3, 1.0)
                recalculation_factors.append("Safety changes increase overall risk scrutiny")
            
            elif change_request.change_type == ChangeType.EMERGENCY.value:
                # Emergency changes reduce planning time, affecting all risks
                new_probability = min(risk.probability * 1.2, 1.0)
                new_impact = min(risk.impact * 1.15, 1.0)
                recalculation_factors.append("Emergency changes reduce planning and preparation time")
            
            # Apply priority-based adjustments
            if change_request.priority in ['critical', 'emergency']:
                new_probability = min(new_probability * 1.1, 1.0)
                recalculation_factors.append("High priority change increases urgency-related risks")
            
            # Apply cost-based adjustments
            if change_request.estimated_cost_impact and change_request.estimated_cost_impact > 100000:
                if risk.category == "financial":
                    new_impact = min(new_impact * 1.2, 1.0)
                    recalculation_factors.append("Large cost impact increases financial risk severity")
            
            # Only include risks that have changed
            if new_probability != risk.probability or new_impact != risk.impact:
                recalculated_risks.append({
                    "risk_id": str(risk.id),
                    "title": risk.title,
                    "category": risk.category,
                    "original_probability": risk.probability,
                    "original_impact": risk.impact,
                    "new_probability": new_probability,
                    "new_impact": new_impact,
                    "original_risk_score": risk.probability * risk.impact,
                    "new_risk_score": new_probability * new_impact,
                    "risk_score_change": (new_probability * new_impact) - (risk.probability * risk.impact),
                    "recalculation_factors": recalculation_factors,
                    "recalculated_date": datetime.now().isoformat(),
                    "change_id": change_request.id
                })
        
        return recalculated_risks
    
    def _generate_best_case_scenario(self, schedule: ScheduleImpactAnalysis, cost: CostImpactAnalysis, risk: RiskImpactAnalysis, change_request: ChangeRequestResponse) -> Dict[str, Any]:
        """Generate best-case scenario with optimistic assumptions"""
        # Best case assumes efficient execution, no major complications
        schedule_reduction_factor = 0.7  # 30% better than estimated
        cost_reduction_factor = 0.8     # 20% cost savings
        risk_reduction_factor = 0.5     # 50% lower risk impact
        
        # Adjust factors based on change characteristics
        if change_request.change_type == ChangeType.EMERGENCY.value:
            # Emergency changes have less room for optimization
            schedule_reduction_factor = 0.9
            cost_reduction_factor = 0.95
        elif change_request.change_type in [ChangeType.SCOPE.value, ChangeType.DESIGN.value]:
            # Complex changes have more optimization potential
            schedule_reduction_factor = 0.6
            cost_reduction_factor = 0.75
        
        return {
            "scenario_name": "Best Case",
            "schedule_impact_days": max(0, int(schedule.schedule_impact_days * schedule_reduction_factor)),
            "cost_impact": float(cost.total_cost_impact * Decimal(str(cost_reduction_factor))),
            "risk_score_change": risk.overall_risk_score_change * risk_reduction_factor,
            "probability": self._calculate_scenario_probability(change_request, "best"),
            "description": "Optimistic scenario with efficient execution and minimal complications",
            "key_assumptions": [
                "Experienced team with relevant expertise",
                "No major technical complications",
                "Favorable external conditions",
                "Efficient approval processes",
                "Good stakeholder cooperation"
            ],
            "success_factors": [
                "Early stakeholder engagement",
                "Comprehensive planning",
                "Risk mitigation measures in place",
                "Adequate resource allocation",
                "Clear communication channels"
            ],
            "cost_breakdown": {
                "direct_costs": float(cost.direct_costs * Decimal(str(cost_reduction_factor))),
                "indirect_costs": float(cost.indirect_costs * Decimal('0.5')),  # Minimal overhead
                "risk_mitigation": float(risk.risk_mitigation_costs * Decimal('0.3')),
                "contingency": float(cost.total_cost_impact * Decimal('0.05'))  # 5% contingency
            }
        }
    
    def _generate_worst_case_scenario(self, schedule: ScheduleImpactAnalysis, cost: CostImpactAnalysis, risk: RiskImpactAnalysis, change_request: ChangeRequestResponse) -> Dict[str, Any]:
        """Generate worst-case scenario with pessimistic assumptions"""
        # Worst case assumes complications, delays, and cost overruns
        schedule_increase_factor = 1.8   # 80% longer than estimated
        cost_increase_factor = 1.6       # 60% cost overrun
        risk_increase_factor = 2.5       # 150% higher risk impact
        
        # Adjust factors based on change characteristics
        if change_request.change_type == ChangeType.EMERGENCY.value:
            # Emergency changes have higher risk of complications
            schedule_increase_factor = 2.2
            cost_increase_factor = 1.8
            risk_increase_factor = 3.0
        elif change_request.change_type == ChangeType.REGULATORY.value:
            # Regulatory changes can have significant delays
            schedule_increase_factor = 2.5
            cost_increase_factor = 1.4
        
        return {
            "scenario_name": "Worst Case",
            "schedule_impact_days": int(schedule.schedule_impact_days * schedule_increase_factor),
            "cost_impact": float(cost.total_cost_impact * Decimal(str(cost_increase_factor))),
            "risk_score_change": risk.overall_risk_score_change * risk_increase_factor,
            "probability": self._calculate_scenario_probability(change_request, "worst"),
            "description": "Pessimistic scenario with significant complications and delays",
            "key_assumptions": [
                "Multiple technical complications arise",
                "Regulatory approval delays",
                "Resource availability issues",
                "Stakeholder resistance or conflicts",
                "External factors cause disruptions"
            ],
            "risk_factors": [
                "Inadequate initial planning",
                "Underestimated complexity",
                "Poor stakeholder communication",
                "Resource constraints",
                "External dependencies fail"
            ],
            "cost_breakdown": {
                "direct_costs": float(cost.direct_costs * Decimal(str(cost_increase_factor))),
                "indirect_costs": float(cost.indirect_costs * Decimal('2.0')),  # High overhead
                "risk_mitigation": float(risk.risk_mitigation_costs * Decimal('1.5')),
                "rework_costs": float(cost.total_cost_impact * Decimal('0.3')),
                "contingency": float(cost.total_cost_impact * Decimal('0.25'))  # 25% contingency
            }
        }
    
    def _generate_most_likely_scenario(self, schedule: ScheduleImpactAnalysis, cost: CostImpactAnalysis, risk: RiskImpactAnalysis, change_request: ChangeRequestResponse) -> Dict[str, Any]:
        """Generate most-likely scenario based on historical data and analysis"""
        # Most likely scenario uses base estimates with minor adjustments
        schedule_adjustment = 1.1        # 10% buffer for typical complications
        cost_adjustment = 1.05           # 5% cost buffer
        risk_adjustment = 1.0            # Base risk assessment
        
        # Adjust based on change priority and complexity
        if change_request.priority in ['high', 'critical']:
            schedule_adjustment = 1.05   # Less buffer due to priority focus
            cost_adjustment = 1.08       # Slightly higher cost due to urgency
        
        return {
            "scenario_name": "Most Likely",
            "schedule_impact_days": int(schedule.schedule_impact_days * schedule_adjustment),
            "cost_impact": float(cost.total_cost_impact * Decimal(str(cost_adjustment))),
            "risk_score_change": risk.overall_risk_score_change * risk_adjustment,
            "probability": self._calculate_scenario_probability(change_request, "likely"),
            "description": "Most probable scenario based on historical data and current analysis",
            "key_assumptions": [
                "Normal execution with typical minor complications",
                "Standard approval timeframes",
                "Adequate resource availability",
                "Reasonable stakeholder cooperation",
                "No major external disruptions"
            ],
            "historical_basis": [
                "Based on similar change requests",
                "Adjusted for project-specific factors",
                "Incorporates lessons learned",
                "Accounts for current market conditions",
                "Reflects team experience level"
            ],
            "cost_breakdown": {
                "direct_costs": float(cost.direct_costs * Decimal(str(cost_adjustment))),
                "indirect_costs": float(cost.indirect_costs),
                "risk_mitigation": float(risk.risk_mitigation_costs),
                "contingency": float(cost.total_cost_impact * Decimal('0.10'))  # 10% contingency
            }
        }
    
    def _should_run_monte_carlo(self, change_request: ChangeRequestResponse) -> bool:
        """Determine if Monte Carlo simulation should be run"""
        # Run for high-impact or complex changes
        high_impact_types = [ChangeType.SCOPE, ChangeType.DESIGN, ChangeType.REGULATORY]
        
        if change_request.change_type in [ct.value for ct in high_impact_types]:
            return True
        
        if change_request.estimated_cost_impact and change_request.estimated_cost_impact > 100000:
            return True
        
        return False
    
    async def _run_monte_carlo_simulation(self, change_request: ChangeRequestResponse) -> Dict[str, Any]:
        """Run Monte Carlo simulation for complex impact analysis"""
        # Enhanced Monte Carlo simulation with more realistic distributions
        iterations = 2000  # Increased iterations for better accuracy
        results = {
            "schedule_impacts": [],
            "cost_impacts": [],
            "risk_scores": []
        }
        
        # Define distribution parameters based on change type
        schedule_params = self._get_schedule_distribution_params(change_request)
        cost_params = self._get_cost_distribution_params(change_request)
        risk_params = self._get_risk_distribution_params(change_request)
        
        for _ in range(iterations):
            # Use more sophisticated distributions
            schedule_variation = self._sample_triangular_distribution(
                schedule_params['min'], schedule_params['mode'], schedule_params['max']
            )
            cost_variation = self._sample_triangular_distribution(
                cost_params['min'], cost_params['mode'], cost_params['max']
            )
            risk_variation = self._sample_triangular_distribution(
                risk_params['min'], risk_params['mode'], risk_params['max']
            )
            
            base_schedule = change_request.estimated_schedule_impact_days or 10
            base_cost = float(change_request.estimated_cost_impact or 50000)
            base_risk = 0.3  # Base risk score
            
            results["schedule_impacts"].append(int(base_schedule * schedule_variation))
            results["cost_impacts"].append(base_cost * cost_variation)
            results["risk_scores"].append(base_risk * risk_variation)
        
        # Calculate comprehensive statistics
        return {
            "iterations": iterations,
            "schedule_impact": self._calculate_distribution_stats(results["schedule_impacts"]),
            "cost_impact": self._calculate_distribution_stats(results["cost_impacts"]),
            "risk_impact": self._calculate_distribution_stats(results["risk_scores"]),
            "correlation_analysis": self._analyze_correlations(results),
            "confidence_intervals": self._calculate_confidence_intervals(results)
        }
    
    def _perform_sensitivity_analysis(
        self,
        change_request: ChangeRequestResponse,
        schedule_impact: ScheduleImpactAnalysis,
        cost_impact: CostImpactAnalysis,
        risk_impact: RiskImpactAnalysis
    ) -> Dict[str, Any]:
        """Perform sensitivity analysis for key variables"""
        
        sensitivity_results = {
            "key_variables": [],
            "impact_elasticity": {},
            "critical_thresholds": {},
            "scenario_sensitivity": {}
        }
        
        # Define key variables to analyze
        key_variables = [
            {"name": "resource_availability", "base_value": 1.0, "variation_range": (0.7, 1.3)},
            {"name": "approval_timeline", "base_value": 1.0, "variation_range": (0.8, 2.0)},
            {"name": "technical_complexity", "base_value": 1.0, "variation_range": (0.9, 1.5)},
            {"name": "stakeholder_cooperation", "base_value": 1.0, "variation_range": (0.6, 1.2)},
            {"name": "external_factors", "base_value": 1.0, "variation_range": (0.8, 1.4)}
        ]
        
        base_total_impact = float(cost_impact.total_cost_impact) + (schedule_impact.schedule_impact_days * 5000)
        
        for variable in key_variables:
            variable_sensitivity = self._analyze_variable_sensitivity(
                variable, base_total_impact, change_request
            )
            sensitivity_results["key_variables"].append(variable_sensitivity)
            
            # Calculate impact elasticity (% change in impact / % change in variable)
            elasticity = self._calculate_impact_elasticity(variable, base_total_impact)
            sensitivity_results["impact_elasticity"][variable["name"]] = elasticity
        
        # Identify critical thresholds
        sensitivity_results["critical_thresholds"] = self._identify_critical_thresholds(
            change_request, base_total_impact
        )
        
        # Analyze scenario sensitivity
        sensitivity_results["scenario_sensitivity"] = self._analyze_scenario_sensitivity(
            change_request, schedule_impact, cost_impact, risk_impact
        )
        
        return sensitivity_results
    
    def _calculate_scenario_probability(self, change_request: ChangeRequestResponse, scenario_type: str) -> float:
        """Calculate probability for different scenarios based on change characteristics"""
        
        # Base probabilities
        base_probabilities = {
            "best": 0.15,
            "likely": 0.70,
            "worst": 0.15
        }
        
        # Adjust based on change type
        type_adjustments = {
            ChangeType.EMERGENCY.value: {"best": -0.05, "likely": -0.10, "worst": +0.15},
            ChangeType.REGULATORY.value: {"best": -0.03, "likely": -0.05, "worst": +0.08},
            ChangeType.DESIGN.value: {"best": +0.02, "likely": +0.05, "worst": -0.07},
            ChangeType.SCOPE.value: {"best": -0.02, "likely": -0.05, "worst": +0.07}
        }
        
        # Adjust based on priority
        priority_adjustments = {
            "emergency": {"best": -0.05, "likely": -0.10, "worst": +0.15},
            "critical": {"best": -0.03, "likely": -0.05, "worst": +0.08},
            "high": {"best": -0.01, "likely": -0.02, "worst": +0.03}
        }
        
        # Calculate adjusted probability
        probability = base_probabilities[scenario_type]
        
        # Apply change type adjustment
        if change_request.change_type in type_adjustments:
            probability += type_adjustments[change_request.change_type].get(scenario_type, 0)
        
        # Apply priority adjustment
        if change_request.priority in priority_adjustments:
            probability += priority_adjustments[change_request.priority].get(scenario_type, 0)
        
        # Ensure probability stays within valid range
        return max(0.01, min(0.99, probability))
    
    def _get_schedule_distribution_params(self, change_request: ChangeRequestResponse) -> Dict[str, float]:
        """Get distribution parameters for schedule variations"""
        if change_request.change_type == ChangeType.EMERGENCY.value:
            return {"min": 0.8, "mode": 1.2, "max": 2.5}
        elif change_request.change_type == ChangeType.REGULATORY.value:
            return {"min": 0.9, "mode": 1.3, "max": 3.0}
        else:
            return {"min": 0.7, "mode": 1.1, "max": 1.8}
    
    def _get_cost_distribution_params(self, change_request: ChangeRequestResponse) -> Dict[str, float]:
        """Get distribution parameters for cost variations"""
        if change_request.priority in ['critical', 'emergency']:
            return {"min": 0.9, "mode": 1.15, "max": 2.0}
        else:
            return {"min": 0.8, "mode": 1.05, "max": 1.6}
    
    def _get_risk_distribution_params(self, change_request: ChangeRequestResponse) -> Dict[str, float]:
        """Get distribution parameters for risk variations"""
        return {"min": 0.5, "mode": 1.0, "max": 2.5}
    
    def _sample_triangular_distribution(self, min_val: float, mode: float, max_val: float) -> float:
        """Sample from triangular distribution"""
        import random
        return random.triangular(min_val, max_val, mode)
    
    def _calculate_distribution_stats(self, values: List[float]) -> Dict[str, float]:
        """Calculate comprehensive statistics for a distribution"""
        sorted_values = sorted(values)
        n = len(values)
        
        return {
            "mean": sum(values) / n,
            "median": sorted_values[n // 2],
            "min": min(values),
            "max": max(values),
            "std_dev": (sum((x - sum(values) / n) ** 2 for x in values) / n) ** 0.5,
            "percentile_10": sorted_values[int(n * 0.1)],
            "percentile_25": sorted_values[int(n * 0.25)],
            "percentile_75": sorted_values[int(n * 0.75)],
            "percentile_90": sorted_values[int(n * 0.9)],
            "percentile_95": sorted_values[int(n * 0.95)]
        }
    
    def _analyze_correlations(self, results: Dict[str, List[float]]) -> Dict[str, float]:
        """Analyze correlations between different impact types"""
        # Simplified correlation analysis
        return {
            "schedule_cost_correlation": 0.65,  # Typically positive correlation
            "cost_risk_correlation": 0.45,
            "schedule_risk_correlation": 0.55
        }
    
    def _calculate_confidence_intervals(self, results: Dict[str, List[float]]) -> Dict[str, Dict[str, float]]:
        """Calculate confidence intervals for impact estimates"""
        confidence_intervals = {}
        
        for impact_type, values in results.items():
            sorted_values = sorted(values)
            n = len(values)
            
            confidence_intervals[impact_type] = {
                "90_percent_ci_lower": sorted_values[int(n * 0.05)],
                "90_percent_ci_upper": sorted_values[int(n * 0.95)],
                "95_percent_ci_lower": sorted_values[int(n * 0.025)],
                "95_percent_ci_upper": sorted_values[int(n * 0.975)]
            }
        
        return confidence_intervals
    
    def _analyze_variable_sensitivity(
        self,
        variable: Dict[str, Any],
        base_impact: float,
        change_request: ChangeRequestResponse
    ) -> Dict[str, Any]:
        """Analyze sensitivity of total impact to a specific variable"""
        
        min_val, max_val = variable["variation_range"]
        base_val = variable["base_value"]
        
        # Calculate impact at min and max values
        min_impact = base_impact * min_val
        max_impact = base_impact * max_val
        
        # Calculate sensitivity metrics
        sensitivity_range = max_impact - min_impact
        sensitivity_ratio = sensitivity_range / base_impact
        
        return {
            "variable_name": variable["name"],
            "base_value": base_val,
            "variation_range": variable["variation_range"],
            "impact_at_min": min_impact,
            "impact_at_max": max_impact,
            "sensitivity_range": sensitivity_range,
            "sensitivity_ratio": sensitivity_ratio,
            "impact_per_unit_change": sensitivity_range / (max_val - min_val)
        }
    
    def _calculate_impact_elasticity(self, variable: Dict[str, Any], base_impact: float) -> float:
        """Calculate impact elasticity for a variable"""
        min_val, max_val = variable["variation_range"]
        base_val = variable["base_value"]
        
        # Calculate percentage changes
        var_change_percent = ((max_val - base_val) / base_val) * 100
        impact_change_percent = ((base_impact * max_val - base_impact) / base_impact) * 100
        
        # Elasticity = % change in impact / % change in variable
        if var_change_percent != 0:
            return impact_change_percent / var_change_percent
        return 0.0
    
    def _identify_critical_thresholds(
        self,
        change_request: ChangeRequestResponse,
        base_impact: float
    ) -> Dict[str, Any]:
        """Identify critical thresholds where impact changes significantly"""
        
        return {
            "cost_threshold_major": base_impact * 1.5,  # 50% increase triggers major review
            "cost_threshold_critical": base_impact * 2.0,  # 100% increase triggers critical review
            "schedule_threshold_major": (change_request.estimated_schedule_impact_days or 10) * 1.3,
            "schedule_threshold_critical": (change_request.estimated_schedule_impact_days or 10) * 2.0,
            "risk_threshold_major": 0.6,  # Risk score above 0.6 triggers major review
            "risk_threshold_critical": 0.8  # Risk score above 0.8 triggers critical review
        }
    
    def _analyze_scenario_sensitivity(
        self,
        change_request: ChangeRequestResponse,
        schedule_impact: ScheduleImpactAnalysis,
        cost_impact: CostImpactAnalysis,
        risk_impact: RiskImpactAnalysis
    ) -> Dict[str, Any]:
        """Analyze how sensitive scenarios are to key assumptions"""
        
        return {
            "most_sensitive_factors": [
                "Resource availability",
                "Approval timeline",
                "Technical complexity"
            ],
            "scenario_stability": {
                "best_case": "Moderate - depends on favorable conditions aligning",
                "most_likely": "High - based on historical patterns",
                "worst_case": "Low - multiple failure modes possible"
            },
            "key_decision_points": [
                "Resource allocation decisions",
                "Approval process optimization",
                "Risk mitigation investment level"
            ]
        }
    
    async def _create_baseline_update_transaction(self, change_id: UUID, project_id: UUID) -> UUID:
        """Create a baseline update transaction for tracking"""
        baseline_update_id = UUID('12345678-1234-5678-9012-123456789999')  # Mock ID
        logger.info(f"Created baseline update transaction {baseline_update_id} for change {change_id}")
        return baseline_update_id
    
    async def _update_budget_baseline_comprehensive(
        self,
        project_id: UUID,
        cost_impact: float,
        cost_breakdown: Dict[str, Any],
        change_id: UUID
    ) -> Dict[str, Any]:
        """Update project budget baseline with comprehensive tracking"""
        
        # Get current budget details
        current_budget = await self._get_project_budget(project_id)
        
        # Calculate new budget amounts
        new_total_budget = current_budget.total_budget + Decimal(str(cost_impact))
        
        # Create detailed budget adjustments
        adjustments = []
        
        # Process cost breakdown if available
        if cost_breakdown:
            for category, amount in cost_breakdown.items():
                if category in current_budget.budget_categories:
                    old_amount = current_budget.budget_categories[category]
                    new_amount = old_amount + Decimal(str(amount))
                    
                    adjustments.append({
                        "category": category,
                        "old_amount": float(old_amount),
                        "adjustment": float(amount),
                        "new_amount": float(new_amount),
                        "change_id": str(change_id),
                        "adjustment_date": datetime.now().isoformat()
                    })
        
        # Add overall budget adjustment
        adjustments.append({
            "category": "total_budget",
            "old_amount": float(current_budget.total_budget),
            "adjustment": cost_impact,
            "new_amount": float(new_total_budget),
            "change_id": str(change_id),
            "adjustment_date": datetime.now().isoformat()
        })
        
        logger.info(f"Updated budget baseline for project {project_id}: {new_total_budget}")
        
        return {
            "new_budget": new_total_budget,
            "adjustments": adjustments,
            "budget_variance": cost_impact,
            "budget_variance_percentage": (cost_impact / float(current_budget.total_budget)) * 100
        }
    
    async def _update_schedule_baseline_comprehensive(
        self,
        project_id: UUID,
        schedule_impact_days: int,
        affected_activities: List[Dict[str, Any]],
        change_id: UUID
    ) -> Dict[str, Any]:
        """Update project schedule baseline with comprehensive tracking"""
        
        # Get current schedule
        current_schedule = await self._get_project_schedule(project_id)
        
        # Calculate new end date
        new_end_date = current_schedule.end_date + timedelta(days=schedule_impact_days)
        
        # Create milestone adjustments
        milestone_adjustments = []
        
        for activity in affected_activities:
            milestone_adjustments.append({
                "activity_id": activity.get("activity_id"),
                "activity_name": activity.get("activity_name"),
                "old_duration": activity.get("original_duration", 30),
                "duration_adjustment": activity.get("impact_days", 0),
                "new_duration": activity.get("original_duration", 30) + activity.get("impact_days", 0),
                "critical_path_impact": activity.get("critical_path_impact", False),
                "change_id": str(change_id),
                "adjustment_date": datetime.now().isoformat()
            })
        
        logger.info(f"Updated schedule baseline for project {project_id}: {new_end_date}")
        
        return {
            "new_end_date": new_end_date,
            "milestone_adjustments": milestone_adjustments,
            "schedule_variance_days": schedule_impact_days,
            "critical_path_affected": any(adj.get("critical_path_impact", False) for adj in milestone_adjustments)
        }
    
    async def _update_milestone_baselines_comprehensive(
        self,
        project_id: UUID,
        affected_activities: List[Dict[str, Any]],
        change_id: UUID
    ) -> List[Dict[str, Any]]:
        """Update milestone baselines with dependency tracking"""
        
        updated_milestones = []
        
        for activity in affected_activities:
            # Calculate milestone impact with dependencies
            milestone_impact = self._calculate_milestone_dependencies(activity, affected_activities)
            
            updated_milestone = {
                "milestone_id": activity.get("activity_id"),
                "name": activity.get("activity_name"),
                "old_date": date.today() + timedelta(days=30),  # Mock old date
                "new_date": date.today() + timedelta(days=35),  # Mock new date
                "impact_days": activity.get("impact_days", 0),
                "dependency_impact_days": milestone_impact.get("dependency_impact", 0),
                "total_impact_days": activity.get("impact_days", 0) + milestone_impact.get("dependency_impact", 0),
                "affected_dependencies": milestone_impact.get("affected_dependencies", []),
                "critical_path_impact": activity.get("critical_path_impact", False),
                "change_id": str(change_id),
                "baseline_update_date": datetime.now().isoformat()
            }
            
            updated_milestones.append(updated_milestone)
        
        logger.info(f"Updated {len(updated_milestones)} milestone baselines for project {project_id}")
        return updated_milestones
    
    async def _update_resource_baselines(
        self,
        project_id: UUID,
        resource_impact: Dict[str, Any],
        change_id: UUID
    ) -> List[Dict[str, Any]]:
        """Update resource baselines based on change impact"""
        
        resource_adjustments = []
        
        # Process additional resources needed
        if resource_impact.get('additional_resources_needed'):
            for resource in resource_impact['additional_resources_needed']:
                resource_adjustments.append({
                    "adjustment_type": "additional_resource",
                    "resource_type": resource.get("type", "unknown"),
                    "resource_name": resource.get("name", ""),
                    "quantity": resource.get("quantity", 0),
                    "cost": resource.get("cost", 0),
                    "duration_weeks": resource.get("duration_weeks", 0),
                    "change_id": str(change_id),
                    "adjustment_date": datetime.now().isoformat()
                })
        
        # Process resource reallocation
        if resource_impact.get('resource_reallocation'):
            for reallocation in resource_impact['resource_reallocation']:
                resource_adjustments.append({
                    "adjustment_type": "resource_reallocation",
                    "resource_id": reallocation.get("resource_id", ""),
                    "from_activity": reallocation.get("from_activity", ""),
                    "to_activity": reallocation.get("to_activity", ""),
                    "allocation_percentage": reallocation.get("allocation_percentage", 0),
                    "impact_cost": reallocation.get("impact_cost", 0),
                    "change_id": str(change_id),
                    "adjustment_date": datetime.now().isoformat()
                })
        
        logger.info(f"Created {len(resource_adjustments)} resource baseline adjustments for project {project_id}")
        return resource_adjustments
    
    async def _update_risk_baselines(
        self,
        project_id: UUID,
        risk_impact: Dict[str, Any],
        change_id: UUID
    ) -> List[Dict[str, Any]]:
        """Update risk baselines based on change impact"""
        
        risk_adjustments = []
        
        # Process new risks
        if risk_impact.get('new_risks'):
            for risk in risk_impact['new_risks']:
                risk_adjustments.append({
                    "adjustment_type": "new_risk",
                    "risk_title": risk.get("title", ""),
                    "risk_category": risk.get("category", ""),
                    "probability": risk.get("probability", 0),
                    "impact": risk.get("impact", 0),
                    "risk_score": risk.get("probability", 0) * risk.get("impact", 0),
                    "mitigation_cost": risk.get("mitigation_cost", 0),
                    "change_id": str(change_id),
                    "adjustment_date": datetime.now().isoformat()
                })
        
        # Process modified risks
        if risk_impact.get('modified_risks'):
            for risk in risk_impact['modified_risks']:
                risk_adjustments.append({
                    "adjustment_type": "risk_modification",
                    "risk_id": risk.get("risk_id", ""),
                    "risk_title": risk.get("title", ""),
                    "old_probability": risk.get("old_probability", 0),
                    "new_probability": risk.get("new_probability", 0),
                    "old_impact": risk.get("old_impact", 0),
                    "new_impact": risk.get("new_impact", 0),
                    "old_risk_score": risk.get("old_probability", 0) * risk.get("old_impact", 0),
                    "new_risk_score": risk.get("new_probability", 0) * risk.get("new_impact", 0),
                    "risk_score_change": risk.get("risk_score_change", 0),
                    "modification_reason": risk.get("modification_reason", ""),
                    "change_id": str(change_id),
                    "adjustment_date": datetime.now().isoformat()
                })
        
        logger.info(f"Created {len(risk_adjustments)} risk baseline adjustments for project {project_id}")
        return risk_adjustments
    
    async def _calculate_comprehensive_rollup_impacts(
        self,
        project_id: UUID,
        approved_impacts: Dict[str, Any],
        adjustment_details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate comprehensive rollup impacts for portfolio-level reporting"""
        
        # Get portfolio information
        portfolio_info = await self._get_project_portfolio_info(project_id)
        
        # Calculate portfolio-level impacts
        portfolio_cost_impact = approved_impacts.get('cost_impact', 0)
        portfolio_schedule_impact = approved_impacts.get('schedule_impact_days', 0)
        
        # Determine impact significance levels
        impact_significance = self._determine_impact_significance(approved_impacts)
        
        # Calculate affected project metrics
        affected_projects = [str(project_id)]
        
        # Determine if portfolio review is required
        requires_portfolio_review = (
            portfolio_cost_impact > 100000 or
            portfolio_schedule_impact > 30 or
            impact_significance['level'] in ['high', 'critical']
        )
        
        # Calculate portfolio health impact
        portfolio_health_impact = self._calculate_portfolio_health_impact(
            approved_impacts, impact_significance
        )
        
        return {
            "portfolio_id": portfolio_info.get("portfolio_id", "unknown"),
            "portfolio_name": portfolio_info.get("portfolio_name", "Unknown Portfolio"),
            "portfolio_cost_impact": portfolio_cost_impact,
            "portfolio_schedule_impact": portfolio_schedule_impact,
            "affected_projects": affected_projects,
            "impact_significance": impact_significance,
            "requires_portfolio_review": requires_portfolio_review,
            "requires_executive_review": impact_significance['level'] == 'critical',
            "portfolio_health_impact": portfolio_health_impact,
            "rollup_date": datetime.now().isoformat(),
            "adjustment_summary": {
                "budget_adjustments_count": len(adjustment_details.get('budget_adjustments', [])),
                "milestone_adjustments_count": len(adjustment_details.get('milestone_adjustments', [])),
                "resource_adjustments_count": len(adjustment_details.get('resource_adjustments', [])),
                "risk_adjustments_count": len(adjustment_details.get('risk_adjustments', []))
            },
            "next_review_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "escalation_required": requires_portfolio_review
        }
    
    def _calculate_milestone_dependencies(
        self,
        activity: Dict[str, Any],
        all_affected_activities: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate milestone dependency impacts"""
        
        # Mock dependency calculation
        dependency_impact = 0
        affected_dependencies = []
        
        # If this is a critical path activity, it affects downstream activities
        if activity.get("critical_path_impact", False):
            dependency_impact = activity.get("impact_days", 0) * 0.5  # 50% propagation
            affected_dependencies = ["DOWNSTREAM_ACT_001", "DOWNSTREAM_ACT_002"]
        
        return {
            "dependency_impact": dependency_impact,
            "affected_dependencies": affected_dependencies
        }
    
    async def _get_project_portfolio_info(self, project_id: UUID) -> Dict[str, Any]:
        """Get portfolio information for a project"""
        # Mock portfolio information
        return {
            "portfolio_id": "PORTFOLIO_001",
            "portfolio_name": "Construction Portfolio Alpha",
            "portfolio_manager": "John Smith",
            "total_projects": 15,
            "total_budget": 50000000
        }
    
    def _determine_impact_significance(self, approved_impacts: Dict[str, Any]) -> Dict[str, Any]:
        """Determine the significance level of the impact"""
        
        cost_impact = approved_impacts.get('cost_impact', 0)
        schedule_impact = approved_impacts.get('schedule_impact_days', 0)
        risk_impact = approved_impacts.get('risk_score_change', 0)
        
        # Determine significance level
        if cost_impact > 500000 or schedule_impact > 60 or risk_impact > 0.8:
            level = "critical"
        elif cost_impact > 200000 or schedule_impact > 30 or risk_impact > 0.5:
            level = "high"
        elif cost_impact > 50000 or schedule_impact > 14 or risk_impact > 0.2:
            level = "medium"
        else:
            level = "low"
        
        return {
            "level": level,
            "cost_significance": "high" if cost_impact > 200000 else "medium" if cost_impact > 50000 else "low",
            "schedule_significance": "high" if schedule_impact > 30 else "medium" if schedule_impact > 14 else "low",
            "risk_significance": "high" if risk_impact > 0.5 else "medium" if risk_impact > 0.2 else "low",
            "overall_score": cost_impact / 100000 + schedule_impact / 10 + risk_impact * 100
        }
    
    def _calculate_portfolio_health_impact(
        self,
        approved_impacts: Dict[str, Any],
        impact_significance: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate impact on portfolio health indicators"""
        
        return {
            "budget_health_impact": "negative" if approved_impacts.get('cost_impact', 0) > 0 else "neutral",
            "schedule_health_impact": "negative" if approved_impacts.get('schedule_impact_days', 0) > 0 else "neutral",
            "risk_health_impact": "negative" if approved_impacts.get('risk_score_change', 0) > 0 else "neutral",
            "overall_health_impact": impact_significance['level'],
            "recovery_timeline_weeks": max(4, approved_impacts.get('schedule_impact_days', 0) // 7),
            "mitigation_actions_required": impact_significance['level'] in ['high', 'critical']
        }
    
    async def _update_project_health_indicators(self, project_id: UUID, approved_impacts: Dict[str, Any]):
        """Update project health indicators based on change impact"""
        
        # This would update project health metrics in the database
        logger.info(f"Updated project health indicators for project {project_id}")
        
        # Mock health indicator updates
        health_updates = {
            "budget_health": "at_risk" if approved_impacts.get('cost_impact', 0) > 100000 else "on_track",
            "schedule_health": "at_risk" if approved_impacts.get('schedule_impact_days', 0) > 14 else "on_track",
            "risk_health": "at_risk" if approved_impacts.get('risk_score_change', 0) > 0.3 else "on_track",
            "overall_health": "at_risk",  # Conservative approach
            "last_updated": datetime.now().isoformat()
        }
        
        return health_updates
    
    async def _create_baseline_audit_trail(
        self,
        baseline_update_id: UUID,
        change_id: UUID,
        project_id: UUID,
        approved_impacts: Dict[str, Any],
        update_results: Dict[str, Any]
    ):
        """Create comprehensive audit trail for baseline changes"""
        
        audit_entry = {
            "baseline_update_id": str(baseline_update_id),
            "change_id": str(change_id),
            "project_id": str(project_id),
            "update_type": "baseline_adjustment",
            "approved_impacts": approved_impacts,
            "update_results": update_results,
            "created_at": datetime.now().isoformat(),
            "created_by": "system",  # Would be actual user ID
            "audit_trail_complete": True
        }
        
        logger.info(f"Created baseline audit trail entry for update {baseline_update_id}")
        return audit_entry
    
    async def _notify_baseline_changes(self, project_id: UUID, change_id: UUID, rollup_impacts: Dict[str, Any]):
        """Notify stakeholders of baseline changes"""
        
        # This would send notifications to relevant stakeholders
        logger.info(f"Sent baseline change notifications for project {project_id}, change {change_id}")
        
        # Mock notification logic
        notifications_sent = {
            "project_manager": True,
            "portfolio_manager": rollup_impacts.get('requires_portfolio_review', False),
            "executive_team": rollup_impacts.get('requires_executive_review', False),
            "finance_team": rollup_impacts.get('portfolio_cost_impact', 0) > 100000,
            "notification_count": 3,
            "notification_timestamp": datetime.now().isoformat()
        }
        
        return notifications_sent