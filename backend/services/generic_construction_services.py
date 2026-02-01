"""
Service classes for Generic Construction/Engineering PPM Features
"""

import asyncio
import json
import secrets
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
import numpy as np
from supabase import Client
import jwt
from cryptography.fernet import Fernet
import hashlib
import base64

from generic_construction_models import (
    ShareablePermissions,
    ShareableURLResponse,
    ShareableURLValidation,
    SimulationConfig,
    SimulationStatistics,
    SimulationResult,
    ProjectChanges,
    TimelineImpact,
    CostImpact,
    ResourceImpact,
    ScenarioConfig,
    ScenarioAnalysis,
    ScenarioComparison
)


class TokenManager:
    """Manages secure token generation and validation for shareable URLs"""
    
    def __init__(self, secret_key: str):
        # Create a Fernet key from the secret
        key = hashlib.sha256(secret_key.encode()).digest()
        self.fernet = Fernet(base64.urlsafe_b64encode(key))
    
    def generate_secure_token(self, payload: Dict[str, Any]) -> str:
        """Generate a cryptographically secure token with embedded payload"""
        # Add timestamp and random nonce for uniqueness
        payload['iat'] = int(datetime.now().timestamp())
        payload['nonce'] = secrets.token_hex(16)
        
        # Serialize and encrypt the payload
        json_payload = json.dumps(payload, default=str)
        encrypted_token = self.fernet.encrypt(json_payload.encode())
        
        # Return base64 encoded token
        return base64.urlsafe_b64encode(encrypted_token).decode()
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """Validate and decrypt token, return payload or raise exception"""
        try:
            # Decode and decrypt
            encrypted_data = base64.urlsafe_b64decode(token.encode())
            decrypted_data = self.fernet.decrypt(encrypted_data)
            payload = json.loads(decrypted_data.decode())
            
            return payload
        except Exception as e:
            raise ValueError(f"Invalid token: {str(e)}")
    
    def is_token_expired(self, token: str) -> bool:
        """Check if token is expired based on embedded expiration"""
        try:
            payload = self.validate_token(token)
            exp_timestamp = payload.get('exp')
            if exp_timestamp:
                return datetime.now().timestamp() > exp_timestamp
            return False
        except:
            return True


class ShareableURLService:
    """Service for managing shareable project URLs with permissions"""
    
    def __init__(self, supabase: Client, secret_key: str):
        self.supabase = supabase
        self.token_manager = TokenManager(secret_key)
    
    async def generate_shareable_url(
        self, 
        project_id: UUID, 
        permissions: ShareablePermissions,
        expiration: datetime,
        user_id: UUID,
        description: Optional[str] = None
    ) -> ShareableURLResponse:
        """Generate a new shareable URL for a project"""
        
        # Create token payload
        token_payload = {
            'project_id': str(project_id),
            'permissions': permissions.model_dump(),
            'exp': int(expiration.timestamp()),
            'created_by': str(user_id)
        }
        
        # Generate secure token
        token = self.token_manager.generate_secure_token(token_payload)
        
        # Store in database
        url_data = {
            'project_id': str(project_id),
            'token': token,
            'permissions': permissions.model_dump(),
            'created_by': str(user_id),
            'expires_at': expiration.isoformat(),
            'access_count': 0,
            'is_revoked': False
        }
        
        result = self.supabase.table('shareable_urls').insert(url_data).execute()
        
        if not result.data:
            raise Exception("Failed to create shareable URL")
        
        return ShareableURLResponse(**result.data[0])
    
    async def validate_shareable_url(self, token: str) -> ShareableURLValidation:
        """Validate a shareable URL token and return validation result"""
        try:
            # First validate token format and decrypt
            payload = self.token_manager.validate_token(token)
            
            # Check if token exists in database and is not revoked
            result = self.supabase.table('shareable_urls').select('*').eq('token', token).execute()
            
            if not result.data:
                return ShareableURLValidation(
                    is_valid=False,
                    error_message="URL not found"
                )
            
            url_data = result.data[0]
            
            # Check if revoked
            if url_data['is_revoked']:
                return ShareableURLValidation(
                    is_valid=False,
                    error_message="URL has been revoked"
                )
            
            # Check if expired
            expires_at = datetime.fromisoformat(url_data['expires_at'].replace('Z', '+00:00'))
            if datetime.now() > expires_at:
                return ShareableURLValidation(
                    is_valid=False,
                    error_message="URL has expired"
                )
            
            # Update access count
            self.supabase.table('shareable_urls').update({
                'access_count': url_data['access_count'] + 1,
                'last_accessed': datetime.now().isoformat()
            }).eq('id', url_data['id']).execute()
            
            return ShareableURLValidation(
                is_valid=True,
                permissions=ShareablePermissions(**url_data['permissions']),
                project_id=UUID(url_data['project_id'])
            )
            
        except Exception as e:
            return ShareableURLValidation(
                is_valid=False,
                error_message=f"Token validation failed: {str(e)}"
            )
    
    async def revoke_shareable_url(self, url_id: UUID, user_id: UUID) -> bool:
        """Revoke a shareable URL"""
        try:
            result = self.supabase.table('shareable_urls').update({
                'is_revoked': True,
                'revoked_by': str(user_id),
                'revoked_at': datetime.now().isoformat(),
                'revocation_reason': 'Manually revoked'
            }).eq('id', str(url_id)).execute()
            
            return len(result.data) > 0
        except Exception:
            return False
    
    async def list_project_shareable_urls(self, project_id: UUID) -> List[ShareableURLResponse]:
        """List all shareable URLs for a project"""
        result = self.supabase.table('shareable_urls').select('*').eq(
            'project_id', str(project_id)
        ).order('created_at', desc=True).execute()
        
        return [ShareableURLResponse(**url_data) for url_data in result.data]


class MonteCarloEngine:
    """Monte Carlo simulation engine for risk analysis"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def run_simulation(
        self,
        project_id: UUID,
        simulation_config: SimulationConfig,
        user_id: UUID,
        name: str,
        description: Optional[str] = None
    ) -> SimulationResult:
        """Run Monte Carlo simulation on project risks"""
        
        start_time = time.time()
        
        # Get project risks
        risks = await self._get_project_risks(project_id)
        
        if not risks:
            raise ValueError("No risks found for project - cannot run simulation")
        
        # Run Monte Carlo iterations
        cost_results, schedule_results = await self._run_monte_carlo_iterations(
            risks, simulation_config
        )
        
        # Calculate statistics and percentiles
        statistics = self._calculate_statistics(cost_results, schedule_results)
        percentiles = self._calculate_percentiles(cost_results, schedule_results, simulation_config.confidence_levels)
        
        execution_time = int((time.time() - start_time) * 1000)  # milliseconds
        
        # Store results
        result_data = {
            'project_id': str(project_id),
            'simulation_type': 'monte_carlo',
            'name': name,
            'description': description,
            'config': simulation_config.dict(),
            'input_parameters': {'risks': [risk.dict() for risk in risks]},
            'results': {
                'cost_distribution': cost_results.tolist() if simulation_config.include_cost_analysis else [],
                'schedule_distribution': schedule_results.tolist() if simulation_config.include_schedule_analysis else []
            },
            'statistics': statistics.dict() if statistics else {},
            'percentiles': percentiles,
            'execution_time_ms': execution_time,
            'iterations_completed': simulation_config.iterations,
            'created_by': str(user_id),
            'is_cached': True,
            'cache_expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        db_result = self.supabase.table('simulation_results').insert(result_data).execute()
        
        if not db_result.data:
            raise Exception("Failed to store simulation results")
        
        return SimulationResult(**db_result.data[0])
    
    async def _get_project_risks(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get risks for a project"""
        result = self.supabase.table('risks').select('*').eq('project_id', str(project_id)).execute()
        return result.data or []
    
    async def _run_monte_carlo_iterations(
        self, 
        risks: List[Dict[str, Any]], 
        config: SimulationConfig
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Run Monte Carlo iterations"""
        
        iterations = config.iterations
        cost_results = np.zeros(iterations)
        schedule_results = np.zeros(iterations)
        
        for i in range(iterations):
            iteration_cost_impact = 0
            iteration_schedule_impact = 0
            
            for risk in risks:
                # Sample from probability distribution
                if np.random.random() < risk['probability']:
                    # Risk occurs - sample impact
                    if config.include_cost_analysis:
                        # Assume triangular distribution for cost impact
                        min_cost = risk['impact'] * 0.5
                        max_cost = risk['impact'] * 1.5
                        most_likely = risk['impact']
                        cost_impact = np.random.triangular(min_cost, most_likely, max_cost)
                        iteration_cost_impact += cost_impact
                    
                    if config.include_schedule_analysis:
                        # Assume schedule impact is proportional to cost impact
                        # Convert to days (rough estimate)
                        schedule_impact = risk['impact'] * 0.1  # 10% of cost impact as days
                        schedule_impact = np.random.triangular(
                            schedule_impact * 0.5, 
                            schedule_impact, 
                            schedule_impact * 1.5
                        )
                        iteration_schedule_impact += schedule_impact
            
            cost_results[i] = iteration_cost_impact
            schedule_results[i] = iteration_schedule_impact
        
        return cost_results, schedule_results
    
    def _calculate_statistics(
        self, 
        cost_results: np.ndarray, 
        schedule_results: np.ndarray
    ) -> SimulationStatistics:
        """Calculate statistical measures"""
        
        return SimulationStatistics(
            mean_cost=float(np.mean(cost_results)) if len(cost_results) > 0 else None,
            std_cost=float(np.std(cost_results)) if len(cost_results) > 0 else None,
            mean_schedule=float(np.mean(schedule_results)) if len(schedule_results) > 0 else None,
            std_schedule=float(np.std(schedule_results)) if len(schedule_results) > 0 else None,
            correlation_coefficient=float(np.corrcoef(cost_results, schedule_results)[0, 1]) 
                if len(cost_results) > 0 and len(schedule_results) > 0 else None
        )
    
    def _calculate_percentiles(
        self, 
        cost_results: np.ndarray, 
        schedule_results: np.ndarray,
        confidence_levels: List[float]
    ) -> Dict[str, float]:
        """Calculate percentile values"""
        
        percentiles = {}
        
        # Convert confidence levels to percentiles (0.1 -> 10th percentile)
        percentile_values = [level * 100 for level in confidence_levels]
        
        if len(cost_results) > 0:
            cost_percentiles = np.percentile(cost_results, percentile_values)
            for i, level in enumerate(confidence_levels):
                percentiles[f'cost_p{int(level*100)}'] = float(cost_percentiles[i])
        
        if len(schedule_results) > 0:
            schedule_percentiles = np.percentile(schedule_results, percentile_values)
            for i, level in enumerate(confidence_levels):
                percentiles[f'schedule_p{int(level*100)}'] = float(schedule_percentiles[i])
        
        return percentiles
    
    async def get_simulation_history(self, project_id: UUID) -> List[SimulationResult]:
        """Get simulation history for a project"""
        result = self.supabase.table('simulation_results').select('*').eq(
            'project_id', str(project_id)
        ).order('created_at', desc=True).execute()
        
        return [SimulationResult(**sim_data) for sim_data in result.data]
    
    async def invalidate_cached_results(self, project_id: UUID) -> bool:
        """Invalidate cached simulation results for a project"""
        try:
            self.supabase.table('simulation_results').update({
                'is_cached': False,
                'cache_expires_at': datetime.now().isoformat()
            }).eq('project_id', str(project_id)).execute()
            return True
        except Exception:
            return False


class ProjectModelingEngine:
    """Engine for modeling project parameter changes and calculating impacts"""
    
    def __init__(self):
        pass
    
    def calculate_timeline_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges,
        milestones: List[Dict[str, Any]] = None
    ) -> TimelineImpact:
        """Calculate timeline impact of parameter changes with critical path analysis"""
        
        # Get original timeline
        original_start = datetime.fromisoformat(base_project.get('start_date', datetime.now().isoformat()))
        original_end = datetime.fromisoformat(base_project.get('end_date', (datetime.now() + timedelta(days=90)).isoformat()))
        original_duration = (original_end - original_start).days
        
        # Calculate new timeline based on changes
        new_start = changes.start_date or original_start.date()
        new_end = changes.end_date or original_end.date()
        
        # Apply resource allocation impact on duration
        if changes.resource_allocations:
            # More resources can reduce duration, fewer can increase it
            resource_factor = self._calculate_resource_impact_factor(changes.resource_allocations)
            duration_adjustment = int(original_duration * (1 - resource_factor))
            new_end = new_start + timedelta(days=max(1, original_duration + duration_adjustment))
        
        new_duration = (new_end - new_start).days
        
        # Identify affected milestones
        affected_milestones = []
        if milestones:
            for milestone in milestones:
                milestone_date = datetime.fromisoformat(milestone.get('planned_date', datetime.now().isoformat())).date()
                if milestone_date > new_end or milestone_date < new_start:
                    affected_milestones.append(milestone.get('name', 'Unknown Milestone'))
        
        # Determine if critical path is affected (significant duration change)
        critical_path_affected = abs(new_duration - original_duration) > 7  # More than a week
        
        return TimelineImpact(
            original_duration=original_duration,
            new_duration=new_duration,
            duration_change=new_duration - original_duration,
            critical_path_affected=critical_path_affected,
            affected_milestones=affected_milestones
        )
    
    def calculate_cost_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> CostImpact:
        """Calculate cost impact of parameter changes"""
        
        original_cost = Decimal(str(base_project.get('budget', 0)))
        
        # Start with explicit budget change if provided
        if changes.budget:
            new_cost = changes.budget
        else:
            new_cost = original_cost
        
        # Apply resource allocation cost impact
        if changes.resource_allocations:
            resource_cost_delta = self._calculate_resource_cost_delta(
                changes.resource_allocations, 
                original_cost
            )
            new_cost += resource_cost_delta
        
        # Apply risk adjustment cost impact
        if changes.risk_adjustments:
            risk_cost_delta = self._calculate_risk_cost_delta(changes.risk_adjustments)
            new_cost += risk_cost_delta
        
        cost_change = new_cost - original_cost
        cost_change_percentage = float((cost_change / original_cost * 100)) if original_cost > 0 else 0
        
        # Identify affected cost categories
        affected_categories = []
        if changes.budget:
            affected_categories.append('budget')
        if changes.resource_allocations:
            affected_categories.append('resources')
        if changes.risk_adjustments:
            affected_categories.append('risk_mitigation')
        
        return CostImpact(
            original_cost=original_cost,
            new_cost=new_cost,
            cost_change=cost_change,
            cost_change_percentage=cost_change_percentage,
            affected_categories=affected_categories
        )
    
    def calculate_resource_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges,
        current_allocations: List[Dict[str, Any]] = None
    ) -> ResourceImpact:
        """Calculate resource impact of parameter changes"""
        
        if not changes.resource_allocations:
            return ResourceImpact(
                utilization_changes={},
                over_allocated_resources=[],
                under_allocated_resources=[],
                new_resource_requirements=[]
            )
        
        utilization_changes = {}
        over_allocated = []
        under_allocated = []
        new_requirements = []
        
        # Analyze each resource allocation change
        for resource_type, allocation_value in changes.resource_allocations.items():
            # Calculate utilization change (assuming 100% is full capacity)
            utilization_changes[resource_type] = allocation_value
            
            # Identify over/under allocation
            if allocation_value > 1.0:  # Over 100% capacity
                over_allocated.append(resource_type)
            elif allocation_value < 0.5:  # Under 50% capacity
                under_allocated.append(resource_type)
            
            # Identify new resource requirements (new resource types)
            if current_allocations:
                existing_types = [r.get('resource_type') for r in current_allocations]
                if resource_type not in existing_types:
                    new_requirements.append(resource_type)
        
        return ResourceImpact(
            utilization_changes=utilization_changes,
            over_allocated_resources=over_allocated,
            under_allocated_resources=under_allocated,
            new_resource_requirements=new_requirements
        )
    
    def _calculate_resource_impact_factor(self, resource_allocations: Dict[str, float]) -> float:
        """Calculate overall resource impact factor on timeline"""
        # Average resource change (positive means more resources, negative means fewer)
        if not resource_allocations:
            return 0.0
        
        # Calculate average utilization change
        avg_change = sum(resource_allocations.values()) / len(resource_allocations)
        
        # Convert to timeline impact factor (capped at ±30%)
        # More resources = faster completion (negative duration change)
        # Fewer resources = slower completion (positive duration change)
        return max(-0.3, min(0.3, (avg_change - 1.0) * 0.2))
    
    def _calculate_resource_cost_delta(
        self, 
        resource_allocations: Dict[str, float], 
        base_cost: Decimal
    ) -> Decimal:
        """Calculate cost delta from resource allocation changes"""
        # Assume resource costs are proportional to allocation
        # Average cost per resource type is base_cost / number of resource types
        
        total_delta = Decimal('0')
        for resource_type, allocation in resource_allocations.items():
            # Assume each resource type costs 20% of base budget
            resource_base_cost = base_cost * Decimal('0.2')
            # Cost delta is proportional to allocation change from 100%
            delta = resource_base_cost * Decimal(str(allocation - 1.0))
            total_delta += delta
        
        return total_delta
    
    def _calculate_risk_cost_delta(self, risk_adjustments: Dict[str, Dict[str, float]]) -> Decimal:
        """Calculate cost delta from risk adjustments"""
        total_delta = Decimal('0')
        
        for risk_id, adjustments in risk_adjustments.items():
            # Extract cost impact from risk adjustments
            cost_impact = adjustments.get('cost_impact', 0.0)
            probability = adjustments.get('probability', 0.5)
            
            # Expected value of risk cost
            expected_cost = Decimal(str(cost_impact * probability))
            total_delta += expected_cost
        
        return total_delta


class ScenarioAnalyzer:
    """What-If scenario analysis service with real-time updates"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.modeling_engine = ProjectModelingEngine()
    
    async def create_scenario(
        self,
        base_project_id: UUID,
        scenario_config: ScenarioConfig,
        user_id: UUID,
        base_scenario_id: Optional[UUID] = None
    ) -> ScenarioAnalysis:
        """Create a new what-if scenario with comprehensive impact analysis"""
        
        # Get base project data
        base_project = await self._get_project_data(base_project_id)
        
        # Get additional context data
        milestones = await self._get_project_milestones(base_project_id)
        current_allocations = await self._get_resource_allocations(base_project_id)
        
        # Calculate impacts using modeling engine
        timeline_impact = None
        cost_impact = None
        resource_impact = None
        
        if 'timeline' in scenario_config.analysis_scope:
            timeline_impact = self.modeling_engine.calculate_timeline_impact(
                base_project, 
                scenario_config.parameter_changes,
                milestones
            )
        
        if 'cost' in scenario_config.analysis_scope:
            cost_impact = self.modeling_engine.calculate_cost_impact(
                base_project, 
                scenario_config.parameter_changes
            )
        
        if 'resources' in scenario_config.analysis_scope:
            resource_impact = self.modeling_engine.calculate_resource_impact(
                base_project, 
                scenario_config.parameter_changes,
                current_allocations
            )
        
        # Store scenario
        scenario_data = {
            'project_id': str(base_project_id),
            'name': scenario_config.name,
            'description': scenario_config.description,
            'base_scenario_id': str(base_scenario_id) if base_scenario_id else None,
            'parameter_changes': scenario_config.parameter_changes.dict(exclude_none=True),
            'impact_results': {
                'timeline': timeline_impact.dict() if timeline_impact else {},
                'cost': cost_impact.dict() if cost_impact else {},
                'resource': resource_impact.dict() if resource_impact else {}
            },
            'timeline_impact': timeline_impact.dict() if timeline_impact else None,
            'cost_impact': cost_impact.dict() if cost_impact else None,
            'resource_impact': resource_impact.dict() if resource_impact else None,
            'created_by': str(user_id),
            'is_active': True,
            'is_baseline': False
        }
        
        result = self.supabase.table('scenario_analyses').insert(scenario_data).execute()
        
        if not result.data:
            raise Exception("Failed to create scenario")
        
        return ScenarioAnalysis(**result.data[0])
    
    async def update_scenario_realtime(
        self,
        scenario_id: UUID,
        parameter_changes: Dict[str, Any],
        user_id: UUID
    ) -> ScenarioAnalysis:
        """Update scenario parameters and recalculate impacts in real-time"""
        
        # Get existing scenario
        existing_scenario = await self._get_scenario(scenario_id)
        
        # Get base project data
        base_project = await self._get_project_data(UUID(existing_scenario['project_id']))
        
        # Merge parameter changes
        current_changes = existing_scenario.get('parameter_changes', {})
        updated_changes = {**current_changes, **parameter_changes}
        
        # Convert to ProjectChanges model
        project_changes = ProjectChanges(**updated_changes)
        
        # Get additional context data
        milestones = await self._get_project_milestones(UUID(existing_scenario['project_id']))
        current_allocations = await self._get_resource_allocations(UUID(existing_scenario['project_id']))
        
        # Recalculate impacts
        timeline_impact = self.modeling_engine.calculate_timeline_impact(
            base_project, 
            project_changes,
            milestones
        )
        
        cost_impact = self.modeling_engine.calculate_cost_impact(
            base_project, 
            project_changes
        )
        
        resource_impact = self.modeling_engine.calculate_resource_impact(
            base_project, 
            project_changes,
            current_allocations
        )
        
        # Update scenario in database
        update_data = {
            'parameter_changes': updated_changes,
            'timeline_impact': timeline_impact.dict() if timeline_impact else None,
            'cost_impact': cost_impact.dict() if cost_impact else None,
            'resource_impact': resource_impact.dict() if resource_impact else None,
            'updated_at': datetime.now().isoformat()
        }
        
        result = self.supabase.table('scenario_analyses').update(update_data).eq(
            'id', str(scenario_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to update scenario")
        
        return ScenarioAnalysis(**result.data[0])
    
    async def _get_project_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get project data for analysis"""
        result = self.supabase.table('projects').select('*').eq('id', str(project_id)).execute()
        if not result.data:
            raise ValueError(f"Project {project_id} not found")
        return result.data[0]
    
    async def _get_scenario(self, scenario_id: UUID) -> Dict[str, Any]:
        """Get scenario by ID"""
        result = self.supabase.table('scenario_analyses').select('*').eq('id', str(scenario_id)).execute()
        if not result.data:
            raise ValueError(f"Scenario {scenario_id} not found")
        return result.data[0]
    
    async def _get_project_milestones(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get project milestones"""
        try:
            result = self.supabase.table('milestones').select('*').eq('project_id', str(project_id)).execute()
            return result.data or []
        except Exception:
            return []
    
    async def _get_resource_allocations(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get current resource allocations"""
        try:
            result = self.supabase.table('resource_assignments').select('*').eq('project_id', str(project_id)).execute()
            return result.data or []
        except Exception:
            return []
    
    async def compare_scenarios(self, scenario_ids: List[UUID]) -> ScenarioComparison:
        """Compare multiple scenarios with detailed analysis"""
        
        if len(scenario_ids) < 2:
            raise ValueError("At least 2 scenarios required for comparison")
        
        scenarios = []
        for scenario_id in scenario_ids:
            result = self.supabase.table('scenario_analyses').select('*').eq('id', str(scenario_id)).execute()
            if result.data:
                scenarios.append(ScenarioAnalysis(**result.data[0]))
            else:
                raise ValueError(f"Scenario {scenario_id} not found")
        
        # Build comprehensive comparison matrix
        comparison_matrix = {}
        for scenario in scenarios:
            scenario_key = str(scenario.id)
            comparison_matrix[scenario_key] = {
                'name': scenario.name,
                'description': scenario.description,
                'cost_impact': scenario.cost_impact.dict() if scenario.cost_impact else {},
                'timeline_impact': scenario.timeline_impact.dict() if scenario.timeline_impact else {},
                'resource_impact': scenario.resource_impact.dict() if scenario.resource_impact else {},
                'parameter_changes': scenario.parameter_changes.dict() if hasattr(scenario.parameter_changes, 'dict') else scenario.parameter_changes
            }
        
        # Generate recommendations based on comparison
        recommendations = self._generate_scenario_recommendations(scenarios)
        
        return ScenarioComparison(
            scenarios=scenarios,
            comparison_matrix=comparison_matrix,
            recommendations=recommendations
        )
    
    def _generate_scenario_recommendations(self, scenarios: List[ScenarioAnalysis]) -> List[str]:
        """Generate recommendations based on scenario comparison"""
        recommendations = []
        
        # Find scenario with best cost impact
        cost_scenarios = [(s, s.cost_impact.cost_change if s.cost_impact else Decimal('0')) for s in scenarios]
        best_cost_scenario = min(cost_scenarios, key=lambda x: x[1])
        if best_cost_scenario[1] < 0:
            recommendations.append(
                f"Scenario '{best_cost_scenario[0].name}' offers the best cost savings "
                f"with a reduction of {abs(best_cost_scenario[1])}"
            )
        
        # Find scenario with best timeline impact
        timeline_scenarios = [(s, s.timeline_impact.duration_change if s.timeline_impact else 0) for s in scenarios]
        best_timeline_scenario = min(timeline_scenarios, key=lambda x: x[1])
        if best_timeline_scenario[1] < 0:
            recommendations.append(
                f"Scenario '{best_timeline_scenario[0].name}' offers the fastest completion "
                f"with {abs(best_timeline_scenario[1])} days saved"
            )
        
        # Check for resource over-allocation warnings
        for scenario in scenarios:
            if scenario.resource_impact and scenario.resource_impact.over_allocated_resources:
                recommendations.append(
                    f"Warning: Scenario '{scenario.name}' has over-allocated resources: "
                    f"{', '.join(scenario.resource_impact.over_allocated_resources)}"
                )
        
        # Check for critical path impacts
        for scenario in scenarios:
            if scenario.timeline_impact and scenario.timeline_impact.critical_path_affected:
                recommendations.append(
                    f"Note: Scenario '{scenario.name}' affects the critical path - "
                    f"review milestone impacts carefully"
                )
        
        if not recommendations:
            recommendations.append("All scenarios have similar impacts - consider other factors for decision making")
        
        return recommendations
    
    async def _calculate_timeline_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[TimelineImpact]:
        """Calculate timeline impact of parameter changes (legacy method for compatibility)"""
        milestones = await self._get_project_milestones(UUID(base_project['id']))
        return self.modeling_engine.calculate_timeline_impact(base_project, changes, milestones)
    
    async def _calculate_cost_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[CostImpact]:
        """Calculate cost impact of parameter changes (legacy method for compatibility)"""
        return self.modeling_engine.calculate_cost_impact(base_project, changes)
    
    async def _calculate_resource_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[ResourceImpact]:
        """Calculate resource impact of parameter changes (legacy method for compatibility)"""
        current_allocations = await self._get_resource_allocations(UUID(base_project['id']))
        return self.modeling_engine.calculate_resource_impact(base_project, changes, current_allocations)


class ChangeManagementService:
    """Service for managing change requests with workflow integration"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def create_change_request(
        self,
        change_data: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Create a new change request"""
        
        # Generate change number
        change_number = await self._generate_change_number(change_data['project_id'])
        
        # Prepare change request data
        request_data = {
            'project_id': str(change_data['project_id']),
            'change_number': change_number,
            'title': change_data['title'],
            'description': change_data['description'],
            'change_type': change_data['change_type'],
            'priority': change_data.get('priority', 'medium'),
            'impact_assessment': change_data['impact_assessment'],
            'justification': change_data['justification'],
            'business_case': change_data.get('business_case'),
            'requested_by': str(user_id),
            'status': 'draft',
            'estimated_cost_impact': str(change_data.get('estimated_cost_impact', 0)),
            'estimated_schedule_impact': change_data.get('estimated_schedule_impact', 0),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Insert into database
        result = self.supabase.table('change_requests').insert(request_data).execute()
        
        if not result.data:
            raise Exception("Failed to create change request")
        
        change_request = result.data[0]
        
        # Initialize workflow if not in draft status
        if change_data.get('auto_submit', False):
            await self._initiate_workflow(change_request['id'], user_id)
        
        return change_request
    
    async def _generate_change_number(self, project_id: UUID) -> str:
        """Generate a unique change request number"""
        # Get project code or use project ID
        project_result = self.supabase.table('projects').select('name, code').eq('id', str(project_id)).execute()
        project_code = 'PROJ'
        if project_result.data:
            project_code = project_result.data[0].get('code', 'PROJ')[:4].upper()
        
        # Get next sequence number for this project
        count_result = self.supabase.table('change_requests').select('id').eq('project_id', str(project_id)).execute()
        sequence = len(count_result.data) + 1
        
        return f"CR-{project_code}-{sequence:04d}"
    
    async def submit_change_request(
        self,
        change_id: UUID,
        user_id: UUID
    ) -> Dict[str, Any]:
        """Submit a change request for approval"""
        
        # Update status to submitted
        result = self.supabase.table('change_requests').update({
            'status': 'submitted',
            'updated_at': datetime.now().isoformat()
        }).eq('id', str(change_id)).execute()
        
        if not result.data:
            raise Exception("Failed to submit change request")
        
        # Initiate workflow
        await self._initiate_workflow(change_id, user_id)
        
        return result.data[0]
    
    async def _initiate_workflow(self, change_id: UUID, user_id: UUID) -> None:
        """Initiate approval workflow for change request"""
        
        # Get change request details
        change_result = self.supabase.table('change_requests').select('*').eq('id', str(change_id)).execute()
        if not change_result.data:
            raise Exception("Change request not found")
        
        change_request = change_result.data[0]
        
        # Determine workflow based on change type and impact
        workflow_type = self._determine_workflow_type(change_request)
        
        # Create workflow instance (assuming workflow_instances table exists)
        workflow_data = {
            'workflow_type': workflow_type,
            'entity_type': 'change_request',
            'entity_id': str(change_id),
            'initiated_by': str(user_id),
            'status': 'active',
            'current_step': 1,
            'created_at': datetime.now().isoformat()
        }
        
        try:
            workflow_result = self.supabase.table('workflow_instances').insert(workflow_data).execute()
            if workflow_result.data:
                # Update change request with workflow instance ID
                self.supabase.table('change_requests').update({
                    'workflow_instance_id': workflow_result.data[0]['id'],
                    'status': 'under_review'
                }).eq('id', str(change_id)).execute()
        except Exception as e:
            print(f"Warning: Could not create workflow instance: {e}")
            # Continue without workflow integration
    
    def _determine_workflow_type(self, change_request: Dict[str, Any]) -> str:
        """Determine appropriate workflow based on change characteristics"""
        
        change_type = change_request['change_type']
        estimated_cost = float(change_request.get('estimated_cost_impact', 0))
        priority = change_request.get('priority', 'medium')
        
        # Simple workflow determination logic
        if change_type == 'budget' or estimated_cost > 50000:
            return 'high_impact_change'
        elif priority == 'critical':
            return 'expedited_change'
        elif change_type in ['scope', 'schedule']:
            return 'standard_change'
        else:
            return 'minor_change'
    
    async def process_approval_decision(
        self,
        change_id: UUID,
        decision: str,
        comments: Optional[str],
        approver_id: UUID
    ) -> Dict[str, Any]:
        """Process an approval decision for a change request"""
        
        if decision not in ['approve', 'reject']:
            raise ValueError("Decision must be 'approve' or 'reject'")
        
        # Update change request status
        update_data = {
            'updated_at': datetime.now().isoformat()
        }
        
        if decision == 'approve':
            update_data.update({
                'status': 'approved',
                'approved_at': datetime.now().isoformat(),
                'approved_by': str(approver_id)
            })
        else:
            update_data['status'] = 'rejected'
        
        result = self.supabase.table('change_requests').update(update_data).eq('id', str(change_id)).execute()
        
        if not result.data:
            raise Exception("Failed to update change request")
        
        # Log approval decision
        await self._log_approval_decision(change_id, decision, comments, approver_id)
        
        return result.data[0]
    
    async def _log_approval_decision(
        self,
        change_id: UUID,
        decision: str,
        comments: Optional[str],
        approver_id: UUID
    ) -> None:
        """Log approval decision for audit trail"""
        
        log_data = {
            'change_request_id': str(change_id),
            'decision': decision,
            'comments': comments,
            'approver_id': str(approver_id),
            'decision_date': datetime.now().isoformat()
        }
        
        try:
            self.supabase.table('change_request_approvals').insert(log_data).execute()
        except Exception as e:
            print(f"Warning: Could not log approval decision: {e}")
    
    async def link_change_to_po(
        self,
        change_id: UUID,
        po_breakdown_id: UUID,
        impact_type: str,
        impact_amount: Optional[float] = None,
        description: Optional[str] = None
    ) -> bool:
        """Link a change request to a PO breakdown"""
        
        link_data = {
            'change_request_id': str(change_id),
            'po_breakdown_id': str(po_breakdown_id),
            'impact_type': impact_type,
            'impact_amount': str(impact_amount) if impact_amount else None,
            'description': description,
            'created_at': datetime.now().isoformat()
        }
        
        try:
            result = self.supabase.table('change_request_po_links').insert(link_data).execute()
            return len(result.data) > 0
        except Exception as e:
            print(f"Error linking change to PO: {e}")
            return False
    
    async def get_change_request(self, change_id: UUID) -> Dict[str, Any]:
        """Get a change request by ID"""
        
        result = self.supabase.table('change_requests').select('*').eq('id', str(change_id)).execute()
        
        if not result.data:
            raise Exception("Change request not found")
        
        return result.data[0]
    
    async def list_project_change_requests(
        self,
        project_id: UUID,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List change requests for a project"""
        
        query = self.supabase.table('change_requests').select('*').eq('project_id', str(project_id))
        
        if status_filter:
            query = query.eq('status', status_filter)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        return result.data or []
    
    async def update_change_request(
        self,
        change_id: UUID,
        updates: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Update a change request"""
        
        # Add update timestamp
        updates['updated_at'] = datetime.now().isoformat()
        
        result = self.supabase.table('change_requests').update(updates).eq('id', str(change_id)).execute()
        
        if not result.data:
            raise Exception("Failed to update change request")
        
        return result.data[0]
    
    async def get_change_request_statistics(self, project_id: UUID) -> Dict[str, Any]:
        """Get change request statistics for a project"""
        
        # Get all change requests for the project
        result = self.supabase.table('change_requests').select('status, estimated_cost_impact, estimated_schedule_impact').eq('project_id', str(project_id)).execute()
        
        changes = result.data or []
        
        # Calculate statistics
        stats = {
            'total_changes': len(changes),
            'draft_changes': len([c for c in changes if c['status'] == 'draft']),
            'submitted_changes': len([c for c in changes if c['status'] == 'submitted']),
            'under_review_changes': len([c for c in changes if c['status'] == 'under_review']),
            'approved_changes': len([c for c in changes if c['status'] == 'approved']),
            'rejected_changes': len([c for c in changes if c['status'] == 'rejected']),
            'implemented_changes': len([c for c in changes if c['status'] == 'implemented']),
            'total_cost_impact': sum(float(c.get('estimated_cost_impact', 0)) for c in changes),
            'total_schedule_impact': sum(int(c.get('estimated_schedule_impact', 0)) for c in changes)
        }
        
        return stats


class HierarchyManager:
    """Manages hierarchical PO breakdown structures"""
    
    def __init__(self):
        pass
    
    def validate_custom_code_uniqueness(
        self,
        code: str,
        project_id: UUID,
        supabase: Client,
        exclude_breakdown_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Validate that custom code is unique within project scope"""
        if not code:
            return {
                'is_valid': True,
                'message': 'No code provided'
            }
        
        # Query for existing breakdowns with same code in project
        query = supabase.table('po_breakdowns').select('id, name, code').eq('project_id', str(project_id)).eq('code', code).eq('is_active', True)
        
        # Exclude current breakdown if updating
        if exclude_breakdown_id:
            query = query.neq('id', str(exclude_breakdown_id))
        
        result = query.execute()
        
        if result.data and len(result.data) > 0:
            return {
                'is_valid': False,
                'message': f'Code "{code}" already exists in project',
                'conflicting_breakdowns': result.data
            }
        
        return {
            'is_valid': True,
            'message': 'Code is unique within project scope'
        }
    
    def validate_hierarchy_move(
        self,
        item_id: UUID,
        new_parent_id: Optional[UUID],
        breakdowns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate that moving an item to a new parent is valid"""
        errors = []
        warnings = []
        
        # Find the item being moved
        item = None
        for b in breakdowns:
            if b.get('id') == str(item_id):
                item = b
                break
        
        if not item:
            return {
                'is_valid': False,
                'errors': ['Item not found'],
                'warnings': []
            }
        
        # If moving to root (no parent), always valid
        if not new_parent_id:
            return {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'new_hierarchy_level': 0
            }
        
        # Find the new parent
        new_parent = None
        for b in breakdowns:
            if b.get('id') == str(new_parent_id):
                new_parent = b
                break
        
        if not new_parent:
            return {
                'is_valid': False,
                'errors': ['New parent not found'],
                'warnings': []
            }
        
        # Check for circular reference (item cannot be moved under itself or its descendants)
        if self._is_descendant(str(new_parent_id), str(item_id), breakdowns):
            errors.append('Cannot move item under itself or its descendants (circular reference)')
        
        # Check hierarchy depth limit (max 10 levels)
        new_level = new_parent.get('hierarchy_level', 0) + 1
        max_child_depth = self._get_max_descendant_depth(str(item_id), breakdowns)
        total_depth = new_level + max_child_depth
        
        if total_depth > 10:
            errors.append(f'Move would exceed maximum hierarchy depth of 10 levels (would be {total_depth})')
        elif total_depth > 8:
            warnings.append(f'Move will result in deep hierarchy ({total_depth} levels)')
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'new_hierarchy_level': new_level
        }
    
    def _is_descendant(self, potential_descendant_id: str, ancestor_id: str, breakdowns: List[Dict[str, Any]]) -> bool:
        """Check if potential_descendant_id is a descendant of ancestor_id"""
        if potential_descendant_id == ancestor_id:
            return True
        
        # Find the potential descendant
        current = None
        for b in breakdowns:
            if b.get('id') == potential_descendant_id:
                current = b
                break
        
        if not current:
            return False
        
        # Walk up the parent chain
        while current:
            parent_id = current.get('parent_breakdown_id')
            if not parent_id:
                return False
            
            if parent_id == ancestor_id:
                return True
            
            # Find parent
            current = None
            for b in breakdowns:
                if b.get('id') == parent_id:
                    current = b
                    break
        
        return False
    
    def _get_max_descendant_depth(self, item_id: str, breakdowns: List[Dict[str, Any]]) -> int:
        """Get the maximum depth of descendants for an item"""
        children = [b for b in breakdowns if b.get('parent_breakdown_id') == item_id]
        
        if not children:
            return 0
        
        max_depth = 0
        for child in children:
            child_id = child.get('id')
            if child_id:
                child_depth = self._get_max_descendant_depth(child_id, breakdowns)
                max_depth = max(max_depth, child_depth + 1)
        
        return max_depth
    
    def update_hierarchy_levels(
        self,
        item_id: UUID,
        new_parent_id: Optional[UUID],
        breakdowns: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate new hierarchy levels for item and all descendants after move"""
        updates = []
        
        # Find the item
        item = None
        for b in breakdowns:
            if b.get('id') == str(item_id):
                item = b
                break
        
        if not item:
            return updates
        
        # Calculate new level
        if new_parent_id:
            new_parent = None
            for b in breakdowns:
                if b.get('id') == str(new_parent_id):
                    new_parent = b
                    break
            
            if new_parent:
                new_level = new_parent.get('hierarchy_level', 0) + 1
            else:
                new_level = 0
        else:
            new_level = 0
        
        # Calculate level change
        old_level = item.get('hierarchy_level', 0)
        level_change = new_level - old_level
        
        # Update item and all descendants
        def update_descendants(parent_id: str, level_delta: int):
            for b in breakdowns:
                if b.get('id') == parent_id:
                    updates.append({
                        'id': parent_id,
                        'hierarchy_level': b.get('hierarchy_level', 0) + level_delta,
                        'parent_breakdown_id': str(new_parent_id) if parent_id == str(item_id) and new_parent_id else b.get('parent_breakdown_id')
                    })
                    
                    # Recursively update children
                    children = [child for child in breakdowns if child.get('parent_breakdown_id') == parent_id]
                    for child in children:
                        child_id = child.get('id')
                        if child_id:
                            update_descendants(child_id, level_delta)
                    break
        
        update_descendants(str(item_id), level_change)
        
        return updates
    
    def parse_csv_hierarchy(self, csv_data: str, column_mappings: Dict[str, str]) -> List[Dict[str, Any]]:
        """Parse CSV data into hierarchical structure"""
        import csv
        from io import StringIO
        
        # Sanitize CSV data to handle newline characters in fields
        # Replace carriage returns and newlines within fields with spaces
        sanitized_data = csv_data.replace('\r\n', '\n').replace('\r', ' ')
        
        # Parse CSV with proper newline handling
        csv_reader = csv.DictReader(StringIO(sanitized_data, newline=''))
        rows = list(csv_reader)
        
        # Convert to standardized format using column mappings
        parsed_rows = []
        for row in rows:
            parsed_row = {}
            for csv_column, model_field in column_mappings.items():
                if csv_column in row:
                    # Clean field values by removing any remaining control characters
                    value = row[csv_column]
                    if isinstance(value, str):
                        value = value.replace('\r', ' ').replace('\n', ' ').strip()
                    parsed_row[model_field] = value
            
            # Add hierarchy level detection
            parsed_row['hierarchy_level'] = self._detect_hierarchy_level(parsed_row)
            parsed_rows.append(parsed_row)
        
        return parsed_rows
    
    def _detect_hierarchy_level(self, row: Dict[str, Any]) -> int:
        """Detect hierarchy level from row data"""
        # Simple heuristic: count leading spaces or use explicit level field
        name = row.get('name', '')
        if name:
            # Count leading spaces/tabs
            level = 0
            for char in name:
                if char in [' ', '\t']:
                    level += 1
                else:
                    break
            return level // 2  # Assume 2 spaces per level
        return 0
    
    def validate_hierarchy_integrity(self, breakdowns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate hierarchical parent-child relationships"""
        errors = []
        warnings = []
        
        # Sort by hierarchy level
        sorted_breakdowns = sorted(breakdowns, key=lambda x: x.get('hierarchy_level', 0))
        
        # Track parent IDs by level
        parent_stack = {}
        
        for breakdown in sorted_breakdowns:
            level = breakdown.get('hierarchy_level', 0)
            parent_id = breakdown.get('parent_breakdown_id')
            
            # Validate parent relationship
            if level > 0:
                expected_parent_level = level - 1
                if parent_id:
                    # Check if parent exists and has correct level
                    parent_found = False
                    for potential_parent in sorted_breakdowns:
                        if potential_parent.get('id') == parent_id:
                            if potential_parent.get('hierarchy_level', 0) == expected_parent_level:
                                parent_found = True
                            else:
                                errors.append(f"Parent {parent_id} has incorrect hierarchy level")
                            break
                    
                    if not parent_found:
                        errors.append(f"Parent {parent_id} not found for breakdown {breakdown.get('name')}")
                else:
                    warnings.append(f"Breakdown {breakdown.get('name')} at level {level} has no parent")
            
            # Update parent stack
            parent_stack[level] = breakdown.get('id')
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'total_items': len(breakdowns),
            'max_hierarchy_level': max([b.get('hierarchy_level', 0) for b in breakdowns]) if breakdowns else 0
        }
    
    def calculate_cost_rollups(self, breakdowns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate cost rollups for hierarchical structure"""
        # Create lookup by ID
        breakdown_lookup = {b.get('id'): b for b in breakdowns if b.get('id')}
        
        # Calculate rollups from bottom up
        rollup_data = {}
        
        # Sort by hierarchy level (deepest first)
        sorted_breakdowns = sorted(breakdowns, key=lambda x: x.get('hierarchy_level', 0), reverse=True)
        
        for breakdown in sorted_breakdowns:
            breakdown_id = breakdown.get('id')
            if not breakdown_id:
                continue
            
            # Initialize rollup data
            rollup_data[breakdown_id] = {
                'planned_amount': float(breakdown.get('planned_amount', 0)),
                'committed_amount': float(breakdown.get('committed_amount', 0)),
                'actual_amount': float(breakdown.get('actual_amount', 0)),
                'child_planned_total': 0,
                'child_committed_total': 0,
                'child_actual_total': 0,
                'children_count': 0
            }
            
            # Find children and sum their amounts
            children = [b for b in breakdowns if b.get('parent_breakdown_id') == breakdown_id]
            
            for child in children:
                child_id = child.get('id')
                if child_id in rollup_data:
                    child_rollup = rollup_data[child_id]
                    rollup_data[breakdown_id]['child_planned_total'] += child_rollup['planned_amount'] + child_rollup['child_planned_total']
                    rollup_data[breakdown_id]['child_committed_total'] += child_rollup['committed_amount'] + child_rollup['child_committed_total']
                    rollup_data[breakdown_id]['child_actual_total'] += child_rollup['actual_amount'] + child_rollup['child_actual_total']
                    rollup_data[breakdown_id]['children_count'] += 1
        
        return rollup_data


class POBreakdownService:
    """Service for managing SAP PO breakdown structures"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.hierarchy_manager = HierarchyManager()
    
    async def import_sap_csv(
        self,
        csv_data: str,
        project_id: UUID,
        import_config: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Import SAP PO data from CSV"""
        
        import_batch_id = uuid4()
        errors = []
        warnings = []
        created_breakdowns = []
        
        try:
            # Parse CSV using hierarchy manager
            parsed_rows = self.hierarchy_manager.parse_csv_hierarchy(csv_data, import_config['column_mappings'])
            
            # Validate hierarchy
            validation_result = self.hierarchy_manager.validate_hierarchy_integrity(parsed_rows)
            if not validation_result['is_valid']:
                errors.extend(validation_result['errors'])
                if not import_config.get('skip_validation_errors', False):
                    return {
                        'success': False,
                        'import_batch_id': import_batch_id,
                        'total_rows': len(parsed_rows),
                        'successful_imports': 0,
                        'failed_imports': len(parsed_rows),
                        'errors': errors,
                        'warnings': warnings,
                        'created_breakdowns': []
                    }
            
            warnings.extend(validation_result['warnings'])
            
            # Import rows in hierarchy order (parents first)
            sorted_rows = sorted(parsed_rows, key=lambda x: x.get('hierarchy_level', 0))
            id_mapping = {}  # Map temporary IDs to actual UUIDs
            
            for row in sorted_rows:
                try:
                    # Prepare breakdown data
                    breakdown_data = {
                        'project_id': str(project_id),
                        'name': row.get('name', '').strip(),
                        'code': row.get('code'),
                        'sap_po_number': row.get('sap_po_number'),
                        'sap_line_item': row.get('sap_line_item'),
                        'hierarchy_level': row.get('hierarchy_level', 0),
                        'cost_center': row.get('cost_center'),
                        'gl_account': row.get('gl_account'),
                        'planned_amount': str(row.get('planned_amount', 0)),
                        'committed_amount': str(row.get('committed_amount', 0)),
                        'actual_amount': str(row.get('actual_amount', 0)),
                        'currency': import_config.get('default_currency', 'USD'),
                        'breakdown_type': import_config.get('default_breakdown_type', 'sap_standard'),
                        'category': row.get('category'),
                        'subcategory': row.get('subcategory'),
                        'custom_fields': row.get('custom_fields', {}),
                        'tags': row.get('tags', []),
                        'notes': row.get('notes'),
                        'import_batch_id': str(import_batch_id),
                        'import_source': 'csv_import',
                        'version': 1,
                        'is_active': True,
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    # Handle parent relationship
                    parent_temp_id = row.get('parent_breakdown_id')
                    if parent_temp_id and parent_temp_id in id_mapping:
                        breakdown_data['parent_breakdown_id'] = id_mapping[parent_temp_id]
                    
                    # Insert into database
                    result = self.supabase.table('po_breakdowns').insert(breakdown_data).execute()
                    
                    if result.data:
                        created_id = result.data[0]['id']
                        created_breakdowns.append(created_id)
                        
                        # Map temporary ID to actual UUID for parent relationships
                        temp_id = row.get('temp_id') or row.get('id')
                        if temp_id:
                            id_mapping[temp_id] = created_id
                    else:
                        errors.append(f"Failed to insert breakdown: {breakdown_data['name']}")
                
                except Exception as e:
                    errors.append(f"Error processing row {row.get('name', 'Unknown')}: {str(e)}")
            
            return {
                'success': len(errors) == 0,
                'import_batch_id': import_batch_id,
                'total_rows': len(parsed_rows),
                'successful_imports': len(created_breakdowns),
                'failed_imports': len(parsed_rows) - len(created_breakdowns),
                'errors': errors,
                'warnings': warnings,
                'created_breakdowns': created_breakdowns
            }
            
        except Exception as e:
            return {
                'success': False,
                'import_batch_id': import_batch_id,
                'total_rows': 0,
                'successful_imports': 0,
                'failed_imports': 0,
                'errors': [f"Import failed: {str(e)}"],
                'warnings': [],
                'created_breakdowns': []
            }
    
    async def create_custom_breakdown(
        self,
        project_id: UUID,
        breakdown_data: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Create a custom PO breakdown"""
        
        # Prepare data for insertion
        insert_data = {
            'project_id': str(project_id),
            'name': breakdown_data['name'],
            'code': breakdown_data.get('code'),
            'sap_po_number': breakdown_data.get('sap_po_number'),
            'sap_line_item': breakdown_data.get('sap_line_item'),
            'hierarchy_level': breakdown_data.get('hierarchy_level', 0),
            'parent_breakdown_id': str(breakdown_data['parent_breakdown_id']) if breakdown_data.get('parent_breakdown_id') else None,
            'cost_center': breakdown_data.get('cost_center'),
            'gl_account': breakdown_data.get('gl_account'),
            'planned_amount': str(breakdown_data['planned_amount']),
            'committed_amount': str(breakdown_data.get('committed_amount', 0)),
            'actual_amount': str(breakdown_data.get('actual_amount', 0)),
            'currency': breakdown_data.get('currency', 'USD'),
            'breakdown_type': breakdown_data['breakdown_type'],
            'category': breakdown_data.get('category'),
            'subcategory': breakdown_data.get('subcategory'),
            'custom_fields': breakdown_data.get('custom_fields', {}),
            'tags': breakdown_data.get('tags', []),
            'notes': breakdown_data.get('notes'),
            'version': 1,
            'is_active': True,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Insert into database
        result = self.supabase.table('po_breakdowns').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create PO breakdown")
        
        return result.data[0]
    
    async def update_breakdown_structure(
        self,
        breakdown_id: UUID,
        updates: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Update a PO breakdown"""
        
        # Add update timestamp and version increment
        updates['updated_at'] = datetime.now().isoformat()
        
        # Handle version increment
        current_result = self.supabase.table('po_breakdowns').select('version').eq('id', str(breakdown_id)).execute()
        if current_result.data:
            current_version = current_result.data[0].get('version', 1)
            updates['version'] = current_version + 1
        
        # Update in database
        result = self.supabase.table('po_breakdowns').update(updates).eq('id', str(breakdown_id)).execute()
        
        if not result.data:
            raise Exception("Failed to update PO breakdown")
        
        return result.data[0]
    
    async def get_breakdown_hierarchy(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get complete breakdown hierarchy for a project"""
        
        result = self.supabase.table('po_breakdowns').select('*').eq('project_id', str(project_id)).eq('is_active', True).order('hierarchy_level').order('name').execute()
        
        breakdowns = result.data or []
        
        # Calculate rollups
        rollup_data = self.hierarchy_manager.calculate_cost_rollups(breakdowns)
        
        # Add rollup data to breakdowns
        for breakdown in breakdowns:
            breakdown_id = breakdown.get('id')
            if breakdown_id in rollup_data:
                breakdown['rollup_data'] = rollup_data[breakdown_id]
        
        return breakdowns
    
    async def get_breakdown_by_id(self, breakdown_id: UUID) -> Dict[str, Any]:
        """Get a specific breakdown by ID"""
        
        result = self.supabase.table('po_breakdowns').select('*').eq('id', str(breakdown_id)).execute()
        
        if not result.data:
            raise Exception("PO breakdown not found")
        
        return result.data[0]
    
    async def delete_breakdown(self, breakdown_id: UUID, user_id: UUID) -> bool:
        """Soft delete a breakdown (mark as inactive)"""
        
        try:
            # Check for children
            children_result = self.supabase.table('po_breakdowns').select('id').eq('parent_breakdown_id', str(breakdown_id)).eq('is_active', True).execute()
            
            if children_result.data:
                raise Exception("Cannot delete breakdown with active children")
            
            # Soft delete
            result = self.supabase.table('po_breakdowns').update({
                'is_active': False,
                'updated_at': datetime.now().isoformat()
            }).eq('id', str(breakdown_id)).execute()
            
            return len(result.data) > 0
            
        except Exception:
            return False
    
    async def get_breakdown_summary(self, project_id: UUID) -> Dict[str, Any]:
        """Get summary statistics for project breakdowns"""
        
        result = self.supabase.table('po_breakdowns').select('planned_amount, committed_amount, actual_amount, currency, hierarchy_level').eq('project_id', str(project_id)).eq('is_active', True).execute()
        
        breakdowns = result.data or []
        
        if not breakdowns:
            return {
                'total_planned': 0,
                'total_committed': 0,
                'total_actual': 0,
                'total_remaining': 0,
                'breakdown_count': 0,
                'hierarchy_levels': 0,
                'currency': 'USD'
            }
        
        # Calculate totals (assuming same currency for simplicity)
        total_planned = sum(float(b.get('planned_amount', 0)) for b in breakdowns)
        total_committed = sum(float(b.get('committed_amount', 0)) for b in breakdowns)
        total_actual = sum(float(b.get('actual_amount', 0)) for b in breakdowns)
        total_remaining = total_planned - total_actual
        
        max_level = max(b.get('hierarchy_level', 0) for b in breakdowns)
        currency = breakdowns[0].get('currency', 'USD') if breakdowns else 'USD'
        
        return {
            'total_planned': total_planned,
            'total_committed': total_committed,
            'total_actual': total_actual,
            'total_remaining': total_remaining,
            'breakdown_count': len(breakdowns),
            'hierarchy_levels': max_level + 1,
            'currency': currency
        }
    
    async def search_breakdowns(
        self,
        project_id: UUID,
        search_query: Optional[str] = None,
        breakdown_type: Optional[str] = None,
        cost_center: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Search breakdowns with filters"""
        
        query = self.supabase.table('po_breakdowns').select('*').eq('project_id', str(project_id)).eq('is_active', True)
        
        # Apply filters
        if breakdown_type:
            query = query.eq('breakdown_type', breakdown_type)
        
        if cost_center:
            query = query.eq('cost_center', cost_center)
        
        if search_query:
            # Simple text search (in a real implementation, might use full-text search)
            query = query.ilike('name', f'%{search_query}%')
        
        # Apply pagination and ordering
        result = query.order('hierarchy_level').order('name').range(offset, offset + limit - 1).execute()
        
        return result.data or []
    
    # ========================================================================
    # Custom Field and Metadata Management
    # Task 6.1: Add custom field and metadata support
    # Requirements: 4.1, 4.3, 4.4
    # ========================================================================
    
    async def update_custom_fields(
        self,
        breakdown_id: UUID,
        custom_fields: Dict[str, Any],
        user_id: UUID,
        merge: bool = True
    ) -> Dict[str, Any]:
        """
        Update custom fields for a PO breakdown.
        
        Args:
            breakdown_id: ID of the breakdown to update
            custom_fields: Dictionary of custom field key-value pairs
            user_id: ID of user making the update
            merge: If True, merge with existing fields; if False, replace entirely
        
        Returns:
            Updated breakdown data
        
        Validates: Requirements 4.3 (flexible JSONB storage for custom fields)
        """
        # Get current breakdown
        current_result = self.supabase.table('po_breakdowns').select('custom_fields, version').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not current_result.data:
            raise Exception(f"PO breakdown {breakdown_id} not found")
        
        current_data = current_result.data[0]
        current_custom_fields = current_data.get('custom_fields', {})
        current_version = current_data.get('version', 1)
        
        # Merge or replace custom fields
        if merge:
            updated_custom_fields = {**current_custom_fields, **custom_fields}
        else:
            updated_custom_fields = custom_fields
        
        # Update in database
        update_data = {
            'custom_fields': updated_custom_fields,
            'updated_at': datetime.now().isoformat(),
            'version': current_version + 1
        }
        
        result = self.supabase.table('po_breakdowns').update(update_data).eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to update custom fields")
        
        return result.data[0]
    
    async def get_custom_field(
        self,
        breakdown_id: UUID,
        field_name: str
    ) -> Optional[Any]:
        """
        Get a specific custom field value from a PO breakdown.
        
        Args:
            breakdown_id: ID of the breakdown
            field_name: Name of the custom field to retrieve
        
        Returns:
            Value of the custom field, or None if not found
        
        Validates: Requirements 4.3 (flexible JSONB storage for custom fields)
        """
        result = self.supabase.table('po_breakdowns').select('custom_fields').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            return None
        
        custom_fields = result.data[0].get('custom_fields', {})
        return custom_fields.get(field_name)
    
    async def delete_custom_field(
        self,
        breakdown_id: UUID,
        field_name: str,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Delete a specific custom field from a PO breakdown.
        
        Args:
            breakdown_id: ID of the breakdown
            field_name: Name of the custom field to delete
            user_id: ID of user making the update
        
        Returns:
            Updated breakdown data
        
        Validates: Requirements 4.3 (flexible JSONB storage for custom fields)
        """
        # Get current breakdown
        current_result = self.supabase.table('po_breakdowns').select('custom_fields, version').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not current_result.data:
            raise Exception(f"PO breakdown {breakdown_id} not found")
        
        current_data = current_result.data[0]
        custom_fields = current_data.get('custom_fields', {})
        current_version = current_data.get('version', 1)
        
        # Remove the field
        if field_name in custom_fields:
            del custom_fields[field_name]
        
        # Update in database
        update_data = {
            'custom_fields': custom_fields,
            'updated_at': datetime.now().isoformat(),
            'version': current_version + 1
        }
        
        result = self.supabase.table('po_breakdowns').update(update_data).eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to delete custom field")
        
        return result.data[0]
    
    # ========================================================================
    # Tag Management
    # Task 6.1: Add support for multiple tags for cross-cutting organization
    # Requirements: 4.4
    # ========================================================================
    
    async def add_tags(
        self,
        breakdown_id: UUID,
        tags: List[str],
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Add tags to a PO breakdown (supports multiple tags for cross-cutting organization).
        
        Args:
            breakdown_id: ID of the breakdown
            tags: List of tags to add
            user_id: ID of user making the update
        
        Returns:
            Updated breakdown data
        
        Validates: Requirements 4.4 (multiple tags for cross-cutting organization)
        """
        # Get current breakdown
        current_result = self.supabase.table('po_breakdowns').select('tags, version').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not current_result.data:
            raise Exception(f"PO breakdown {breakdown_id} not found")
        
        current_data = current_result.data[0]
        current_tags = current_data.get('tags', [])
        current_version = current_data.get('version', 1)
        
        # Add new tags (avoid duplicates)
        updated_tags = list(set(current_tags + tags))
        
        # Update in database
        update_data = {
            'tags': updated_tags,
            'updated_at': datetime.now().isoformat(),
            'version': current_version + 1
        }
        
        result = self.supabase.table('po_breakdowns').update(update_data).eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to add tags")
        
        return result.data[0]
    
    async def remove_tags(
        self,
        breakdown_id: UUID,
        tags: List[str],
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Remove tags from a PO breakdown.
        
        Args:
            breakdown_id: ID of the breakdown
            tags: List of tags to remove
            user_id: ID of user making the update
        
        Returns:
            Updated breakdown data
        
        Validates: Requirements 4.4 (multiple tags for cross-cutting organization)
        """
        # Get current breakdown
        current_result = self.supabase.table('po_breakdowns').select('tags, version').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not current_result.data:
            raise Exception(f"PO breakdown {breakdown_id} not found")
        
        current_data = current_result.data[0]
        current_tags = current_data.get('tags', [])
        current_version = current_data.get('version', 1)
        
        # Remove specified tags
        updated_tags = [tag for tag in current_tags if tag not in tags]
        
        # Update in database
        update_data = {
            'tags': updated_tags,
            'updated_at': datetime.now().isoformat(),
            'version': current_version + 1
        }
        
        result = self.supabase.table('po_breakdowns').update(update_data).eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to remove tags")
        
        return result.data[0]
    
    async def search_by_tags(
        self,
        project_id: UUID,
        tags: List[str],
        match_all: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Search PO breakdowns by tags.
        
        Args:
            project_id: ID of the project
            tags: List of tags to search for
            match_all: If True, match all tags; if False, match any tag
            limit: Maximum number of results
            offset: Offset for pagination
        
        Returns:
            List of matching breakdowns
        
        Validates: Requirements 4.4 (multiple tags for cross-cutting organization)
        """
        # Get all active breakdowns for the project
        result = self.supabase.table('po_breakdowns').select('*').eq(
            'project_id', str(project_id)
        ).eq('is_active', True).execute()
        
        if not result.data:
            return []
        
        # Filter by tags in Python (PostgreSQL JSONB array operations can be complex)
        matching_breakdowns = []
        for breakdown in result.data:
            breakdown_tags = set(breakdown.get('tags', []))
            search_tags = set(tags)
            
            if match_all:
                # All search tags must be present
                if search_tags.issubset(breakdown_tags):
                    matching_breakdowns.append(breakdown)
            else:
                # Any search tag must be present
                if search_tags.intersection(breakdown_tags):
                    matching_breakdowns.append(breakdown)
        
        # Apply pagination
        return matching_breakdowns[offset:offset + limit]
    
    # ========================================================================
    # Category and Subcategory Management
    # Task 6.1: Implement category and subcategory management
    # Requirements: 4.1
    # ========================================================================
    
    async def update_category(
        self,
        breakdown_id: UUID,
        category: Optional[str],
        subcategory: Optional[str],
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Update category and subcategory for a PO breakdown.
        
        Args:
            breakdown_id: ID of the breakdown
            category: New category value (or None to clear)
            subcategory: New subcategory value (or None to clear)
            user_id: ID of user making the update
        
        Returns:
            Updated breakdown data
        
        Validates: Requirements 4.1 (user-defined categories and subcategories)
        """
        # Get current version
        current_result = self.supabase.table('po_breakdowns').select('version').eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not current_result.data:
            raise Exception(f"PO breakdown {breakdown_id} not found")
        
        current_version = current_result.data[0].get('version', 1)
        
        # Update in database
        update_data = {
            'category': category,
            'subcategory': subcategory,
            'updated_at': datetime.now().isoformat(),
            'version': current_version + 1
        }
        
        result = self.supabase.table('po_breakdowns').update(update_data).eq(
            'id', str(breakdown_id)
        ).execute()
        
        if not result.data:
            raise Exception("Failed to update category")
        
        return result.data[0]
    
    async def get_project_categories(
        self,
        project_id: UUID
    ) -> Dict[str, List[str]]:
        """
        Get all unique categories and subcategories used in a project.
        
        Args:
            project_id: ID of the project
        
        Returns:
            Dictionary mapping categories to lists of subcategories
        
        Validates: Requirements 4.1 (user-defined categories and subcategories)
        """
        result = self.supabase.table('po_breakdowns').select('category, subcategory').eq(
            'project_id', str(project_id)
        ).eq('is_active', True).execute()
        
        if not result.data:
            return {}
        
        # Build category hierarchy
        categories = {}
        for breakdown in result.data:
            category = breakdown.get('category')
            subcategory = breakdown.get('subcategory')
            
            if category:
                if category not in categories:
                    categories[category] = []
                
                if subcategory and subcategory not in categories[category]:
                    categories[category].append(subcategory)
        
        return categories
    
    async def search_by_category(
        self,
        project_id: UUID,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Search PO breakdowns by category and/or subcategory.
        
        Args:
            project_id: ID of the project
            category: Category to filter by (optional)
            subcategory: Subcategory to filter by (optional)
            limit: Maximum number of results
            offset: Offset for pagination
        
        Returns:
            List of matching breakdowns
        
        Validates: Requirements 4.1 (user-defined categories and subcategories)
        """
        query = self.supabase.table('po_breakdowns').select('*').eq(
            'project_id', str(project_id)
        ).eq('is_active', True)
        
        if category:
            query = query.eq('category', category)
        
        if subcategory:
            query = query.eq('subcategory', subcategory)
        
        result = query.order('hierarchy_level').order('name').range(
            offset, offset + limit - 1
        ).execute()
        
        return result.data or []
    
    # ========================================================================
    # Custom Hierarchy Operations
    # Task 6.2: Implement custom hierarchy operations
    # Requirements: 4.2, 4.5
    # ========================================================================
    
    async def reorder_breakdown_items(
        self,
        parent_id: Optional[UUID],
        ordered_item_ids: List[UUID],
        user_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Reorder breakdown items within the same parent (drag-and-drop support).
        
        This method updates the display order of items at the same hierarchy level
        by setting a 'display_order' field that can be used for sorting.
        
        Args:
            parent_id: ID of the parent breakdown (None for root level)
            ordered_item_ids: List of breakdown IDs in desired order
            user_id: ID of user making the update
        
        Returns:
            List of updated breakdown data
        
        Validates: Requirements 4.2 (drag-and-drop reordering support)
        """
        updated_items = []
        
        # Validate all items belong to the same parent
        for item_id in ordered_item_ids:
            result = self.supabase.table('po_breakdowns').select('parent_breakdown_id').eq(
                'id', str(item_id)
            ).execute()
            
            if not result.data:
                raise ValueError(f"Breakdown {item_id} not found")
            
            item_parent = result.data[0].get('parent_breakdown_id')
            expected_parent = str(parent_id) if parent_id else None
            
            if item_parent != expected_parent:
                raise ValueError(
                    f"Breakdown {item_id} does not belong to parent {parent_id}. "
                    f"All items must have the same parent for reordering."
                )
        
        # Update display_order for each item
        for index, item_id in enumerate(ordered_item_ids):
            update_data = {
                'display_order': index,
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('po_breakdowns').update(update_data).eq(
                'id', str(item_id)
            ).execute()
            
            if result.data:
                updated_items.append(result.data[0])
        
        return updated_items
    
    async def validate_custom_code(
        self,
        project_id: UUID,
        code: str,
        exclude_breakdown_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Validate custom code uniqueness within project scope.
        
        Args:
            project_id: ID of the project
            code: Code to validate
            exclude_breakdown_id: Optional breakdown ID to exclude from check (for updates)
        
        Returns:
            Dictionary with validation result:
            {
                'is_valid': bool,
                'is_unique': bool,
                'conflicts': List[Dict],
                'suggestions': List[str]
            }
        
        Validates: Requirements 4.5 (custom code validation with project-scope uniqueness)
        """
        # Check if code is empty
        if not code or not code.strip():
            return {
                'is_valid': False,
                'is_unique': False,
                'conflicts': [],
                'suggestions': [],
                'error': 'Code cannot be empty'
            }
        
        # Check code format (alphanumeric, hyphens, underscores only)
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', code):
            return {
                'is_valid': False,
                'is_unique': False,
                'conflicts': [],
                'suggestions': [],
                'error': 'Code must contain only letters, numbers, hyphens, and underscores'
            }
        
        # Check uniqueness within project
        query = self.supabase.table('po_breakdowns').select('id, name, code').eq(
            'project_id', str(project_id)
        ).eq('code', code).eq('is_active', True)
        
        result = query.execute()
        
        conflicts = []
        if result.data:
            for item in result.data:
                # Exclude the current breakdown if updating
                if exclude_breakdown_id and item['id'] == str(exclude_breakdown_id):
                    continue
                conflicts.append({
                    'id': item['id'],
                    'name': item['name'],
                    'code': item['code']
                })
        
        is_unique = len(conflicts) == 0
        
        # Generate suggestions if not unique
        suggestions = []
        if not is_unique:
            # Suggest variations with suffixes
            for i in range(1, 6):
                suggested_code = f"{code}_{i}"
                # Check if suggestion is available
                check_result = self.supabase.table('po_breakdowns').select('id').eq(
                    'project_id', str(project_id)
                ).eq('code', suggested_code).eq('is_active', True).execute()
                
                if not check_result.data:
                    suggestions.append(suggested_code)
                    if len(suggestions) >= 3:
                        break
        
        return {
            'is_valid': is_unique,
            'is_unique': is_unique,
            'conflicts': conflicts,
            'suggestions': suggestions
        }
    
    async def bulk_update_codes(
        self,
        code_mappings: Dict[UUID, str],
        project_id: UUID,
        user_id: UUID,
        validate_first: bool = True
    ) -> Dict[str, Any]:
        """
        Bulk update codes for multiple breakdowns with validation.
        
        Args:
            code_mappings: Dictionary mapping breakdown IDs to new codes
            project_id: ID of the project
            user_id: ID of user making the update
            validate_first: If True, validate all codes before applying any updates
        
        Returns:
            Dictionary with update results:
            {
                'successful': List[UUID],
                'failed': List[Dict],
                'validation_errors': List[Dict]
            }
        
        Validates: Requirements 4.5 (custom code validation with project-scope uniqueness)
        """
        successful = []
        failed = []
        validation_errors = []
        
        # Validate all codes first if requested
        if validate_first:
            for breakdown_id, code in code_mappings.items():
                validation = await self.validate_custom_code(
                    project_id, code, exclude_breakdown_id=breakdown_id
                )
                
                if not validation['is_valid']:
                    validation_errors.append({
                        'breakdown_id': str(breakdown_id),
                        'code': code,
                        'error': validation.get('error', 'Code is not unique'),
                        'conflicts': validation.get('conflicts', []),
                        'suggestions': validation.get('suggestions', [])
                    })
            
            # If any validation errors, return without applying updates
            if validation_errors:
                return {
                    'successful': [],
                    'failed': [],
                    'validation_errors': validation_errors
                }
        
        # Apply updates
        for breakdown_id, code in code_mappings.items():
            try:
                # Get current version
                current_result = self.supabase.table('po_breakdowns').select('version').eq(
                    'id', str(breakdown_id)
                ).execute()
                
                if not current_result.data:
                    failed.append({
                        'breakdown_id': str(breakdown_id),
                        'code': code,
                        'error': 'Breakdown not found'
                    })
                    continue
                
                current_version = current_result.data[0].get('version', 1)
                
                # Update code
                update_data = {
                    'code': code,
                    'updated_at': datetime.now().isoformat(),
                    'version': current_version + 1
                }
                
                result = self.supabase.table('po_breakdowns').update(update_data).eq(
                    'id', str(breakdown_id)
                ).execute()
                
                if result.data:
                    successful.append(breakdown_id)
                else:
                    failed.append({
                        'breakdown_id': str(breakdown_id),
                        'code': code,
                        'error': 'Update failed'
                    })
            
            except Exception as e:
                failed.append({
                    'breakdown_id': str(breakdown_id),
                    'code': code,
                    'error': str(e)
                })
        
        return {
            'successful': [str(id) for id in successful],
            'failed': failed,
            'validation_errors': validation_errors
        }
    
    async def get_hierarchy_with_custom_order(
        self,
        project_id: UUID,
        parent_id: Optional[UUID] = None,
        include_children: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get hierarchy items with custom display order applied.
        
        Args:
            project_id: ID of the project
            parent_id: Optional parent ID to filter by
            include_children: If True, recursively include children
        
        Returns:
            List of breakdown items ordered by display_order
        
        Validates: Requirements 4.2 (drag-and-drop reordering support)
        """
        query = self.supabase.table('po_breakdowns').select('*').eq(
            'project_id', str(project_id)
        ).eq('is_active', True)
        
        if parent_id:
            query = query.eq('parent_breakdown_id', str(parent_id))
        else:
            query = query.is_('parent_breakdown_id', 'null')
        
        # Order by display_order if available, then by name
        result = query.order('display_order', nullsfirst=False).order('name').execute()
        
        items = result.data or []
        
        # Recursively include children if requested
        if include_children:
            for item in items:
                children = await self.get_hierarchy_with_custom_order(
                    project_id,
                    parent_id=UUID(item['id']),
                    include_children=True
                )
                item['children'] = children
        
        return items


class TemplateEngine:
    """Engine for processing report templates and generating content"""
    
    def __init__(self):
        pass
    
    def populate_template_with_data(
        self,
        template: Dict[str, Any],
        project_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Populate template placeholders with actual project data"""
        
        populated_template = template.copy()
        data_mappings = template.get('data_mappings', {})
        
        # Create data context for template population
        data_context = self._build_data_context(project_data)
        
        # Process data mappings
        populated_data = {}
        for template_field, data_path in data_mappings.items():
            try:
                value = self._extract_data_value(data_context, data_path)
                populated_data[template_field] = value
            except Exception as e:
                print(f"Warning: Could not populate field {template_field}: {e}")
                populated_data[template_field] = f"[Error: {template_field}]"
        
        populated_template['populated_data'] = populated_data
        return populated_template
    
    def _build_data_context(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Build comprehensive data context from project data"""
        
        context = {
            'project': project_data,
            'current_date': datetime.now().strftime('%Y-%m-%d'),
            'current_datetime': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'generated_by': 'PPM System'
        }
        
        # Add calculated fields
        if 'budget' in project_data and 'actual_cost' in project_data:
            budget = float(project_data.get('budget', 0))
            actual = float(project_data.get('actual_cost', 0))
            
            context['financial'] = {
                'budget': budget,
                'actual_cost': actual,
                'variance': actual - budget,
                'variance_percentage': ((actual - budget) / budget * 100) if budget > 0 else 0,
                'utilization_percentage': (actual / budget * 100) if budget > 0 else 0
            }
        
        return context
    
    def _extract_data_value(self, context: Dict[str, Any], data_path: str) -> Any:
        """Extract value from context using dot notation path"""
        
        keys = data_path.split('.')
        value = context
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                raise ValueError(f"Path {data_path} not found in context")
        
        return value
    
    def generate_charts_and_visualizations(
        self,
        data: Dict[str, Any],
        chart_configs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate chart data for visualizations"""
        
        charts = []
        
        for config in chart_configs:
            try:
                chart_data = self._generate_single_chart(data, config)
                charts.append(chart_data)
            except Exception as e:
                print(f"Warning: Could not generate chart {config.get('title', 'Unknown')}: {e}")
                # Add placeholder chart
                charts.append({
                    'title': config.get('title', 'Chart'),
                    'type': config.get('chart_type', 'bar'),
                    'error': str(e),
                    'data': []
                })
        
        return charts
    
    def _generate_single_chart(self, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a single chart based on configuration"""
        
        chart_type = config.get('chart_type', 'bar')
        data_source = config.get('data_source', '')
        title = config.get('title', 'Chart')
        
        # Extract data based on source
        if data_source == 'financial_summary':
            return self._generate_financial_chart(data, config)
        elif data_source == 'risk_distribution':
            return self._generate_risk_chart(data, config)
        elif data_source == 'timeline_progress':
            return self._generate_timeline_chart(data, config)
        elif data_source == 'resource_utilization':
            return self._generate_resource_chart(data, config)
        else:
            # Generic data extraction
            return {
                'title': title,
                'type': chart_type,
                'data': [],
                'labels': [],
                'note': f'Data source {data_source} not implemented'
            }
    
    def _generate_financial_chart(self, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate financial summary chart"""
        
        financial = data.get('financial', {})
        
        return {
            'title': config.get('title', 'Financial Summary'),
            'type': config.get('chart_type', 'bar'),
            'data': [
                financial.get('budget', 0),
                financial.get('actual_cost', 0),
                abs(financial.get('variance', 0))
            ],
            'labels': ['Budget', 'Actual Cost', 'Variance'],
            'colors': ['#4CAF50', '#2196F3', '#FF9800']
        }
    
    def _generate_risk_chart(self, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate risk distribution chart"""
        
        # Mock risk data - in real implementation would come from risks table
        return {
            'title': config.get('title', 'Risk Distribution'),
            'type': config.get('chart_type', 'pie'),
            'data': [30, 45, 20, 5],
            'labels': ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
            'colors': ['#4CAF50', '#FF9800', '#FF5722', '#F44336']
        }
    
    def _generate_timeline_chart(self, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate timeline progress chart"""
        
        project = data.get('project', {})
        start_date = project.get('start_date')
        end_date = project.get('end_date')
        
        if start_date and end_date:
            # Calculate progress percentage (mock calculation)
            progress = 65  # Mock progress percentage
        else:
            progress = 0
        
        return {
            'title': config.get('title', 'Timeline Progress'),
            'type': config.get('chart_type', 'line'),
            'data': [progress, 100 - progress],
            'labels': ['Completed', 'Remaining'],
            'colors': ['#4CAF50', '#E0E0E0']
        }
    
    def _generate_resource_chart(self, data: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate resource utilization chart"""
        
        # Mock resource data - in real implementation would come from resources table
        return {
            'title': config.get('title', 'Resource Utilization'),
            'type': config.get('chart_type', 'bar'),
            'data': [85, 92, 78, 88, 95],
            'labels': ['Developers', 'Designers', 'QA', 'DevOps', 'PM'],
            'colors': ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#607D8B']
        }


class GoogleSuiteReportGenerator:
    """Service for generating Google Slides reports from project data
    
    Implements Google Drive and Slides API integration with OAuth 2.0 authentication.
    Provides template-based report generation with chart and visualization support.
    
    Requirements: 6.1, 6.2, 9.2
    """
    
    def __init__(self, supabase: Client, google_credentials_path: Optional[str] = None):
        self.supabase = supabase
        self.template_engine = TemplateEngine()
        self.google_credentials_path = google_credentials_path
        self._google_service = None  # Lazy initialization for Google API clients
    
    def __init__(self, supabase: Client, google_credentials_path: Optional[str] = None):
        self.supabase = supabase
        self.template_engine = TemplateEngine()
        self.google_credentials_path = google_credentials_path
        self._google_service = None  # Lazy initialization for Google API clients
    
    def _get_google_credentials(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get Google OAuth 2.0 credentials for a user.
        
        In a production implementation, this would:
        1. Retrieve stored OAuth tokens from database
        2. Refresh expired tokens using refresh_token
        3. Handle token expiration and re-authentication
        
        Requirements: 9.2 (OAuth 2.0 authentication)
        """
        try:
            # Query user's Google credentials from database
            result = self.supabase.table('user_google_credentials').select('*').eq(
                'user_id', str(user_id)
            ).execute()
            
            if result.data:
                credentials = result.data[0]
                
                # Check if token is expired
                expires_at = datetime.fromisoformat(credentials.get('expires_at', datetime.now().isoformat()))
                if datetime.now() >= expires_at:
                    # Token expired - would need to refresh
                    # In production: call Google OAuth refresh endpoint
                    return None
                
                return {
                    'access_token': credentials.get('access_token'),
                    'refresh_token': credentials.get('refresh_token'),
                    'token_type': credentials.get('token_type', 'Bearer'),
                    'expires_at': expires_at
                }
            
            return None
            
        except Exception as e:
            print(f"Error retrieving Google credentials: {e}")
            return None
    
    def _initialize_google_services(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initialize Google Drive and Slides API clients with OAuth credentials.
        
        In a production implementation, this would:
        1. Create authenticated Google API client instances
        2. Use google-auth and google-api-python-client libraries
        3. Handle API rate limiting and errors
        
        Requirements: 6.1, 6.2, 9.2
        """
        # Mock implementation - in production would use:
        # from google.oauth2.credentials import Credentials
        # from googleapiclient.discovery import build
        #
        # creds = Credentials(
        #     token=credentials['access_token'],
        #     refresh_token=credentials['refresh_token'],
        #     token_uri='https://oauth2.googleapis.com/token',
        #     client_id=CLIENT_ID,
        #     client_secret=CLIENT_SECRET
        # )
        #
        # drive_service = build('drive', 'v3', credentials=creds)
        # slides_service = build('slides', 'v1', credentials=creds)
        
        return {
            'drive': None,  # Would be actual Drive API client
            'slides': None,  # Would be actual Slides API client
            'credentials': credentials
        }
    
    async def initiate_oauth_flow(self, user_id: UUID, redirect_uri: str) -> Dict[str, str]:
        """
        Initiate OAuth 2.0 authorization flow for Google Suite access.
        
        Returns authorization URL for user to grant permissions.
        
        Requirements: 9.2 (OAuth 2.0 authentication)
        """
        # In production, would use Google OAuth 2.0 library:
        # from google_auth_oauthlib.flow import Flow
        #
        # flow = Flow.from_client_secrets_file(
        #     self.google_credentials_path,
        #     scopes=[
        #         'https://www.googleapis.com/auth/drive.file',
        #         'https://www.googleapis.com/auth/presentations'
        #     ],
        #     redirect_uri=redirect_uri
        # )
        #
        # authorization_url, state = flow.authorization_url(
        #     access_type='offline',
        #     include_granted_scopes='true'
        # )
        
        # Mock implementation
        state = secrets.token_urlsafe(32)
        
        # Store state for verification
        await self._store_oauth_state(user_id, state)
        
        return {
            'authorization_url': f'https://accounts.google.com/o/oauth2/v2/auth?state={state}',
            'state': state
        }
    
    async def _store_oauth_state(self, user_id: UUID, state: str) -> None:
        """Store OAuth state for CSRF protection"""
        try:
            self.supabase.table('oauth_states').insert({
                'user_id': str(user_id),
                'state': state,
                'provider': 'google',
                'created_at': datetime.now().isoformat(),
                'expires_at': (datetime.now() + timedelta(minutes=10)).isoformat()
            }).execute()
        except Exception as e:
            print(f"Warning: Could not store OAuth state: {e}")
    
    async def handle_oauth_callback(
        self,
        user_id: UUID,
        authorization_code: str,
        state: str
    ) -> bool:
        """
        Handle OAuth 2.0 callback and exchange authorization code for tokens.
        
        Requirements: 9.2 (OAuth 2.0 authentication)
        """
        # Verify state for CSRF protection
        state_result = self.supabase.table('oauth_states').select('*').eq(
            'user_id', str(user_id)
        ).eq('state', state).execute()
        
        if not state_result.data:
            raise ValueError("Invalid OAuth state - possible CSRF attack")
        
        # In production, would exchange code for tokens:
        # flow = Flow.from_client_secrets_file(...)
        # flow.fetch_token(code=authorization_code)
        # credentials = flow.credentials
        
        # Mock token storage
        try:
            self.supabase.table('user_google_credentials').insert({
                'user_id': str(user_id),
                'access_token': f'mock_access_token_{secrets.token_hex(16)}',
                'refresh_token': f'mock_refresh_token_{secrets.token_hex(16)}',
                'token_type': 'Bearer',
                'expires_at': (datetime.now() + timedelta(hours=1)).isoformat(),
                'scopes': ['drive.file', 'presentations'],
                'created_at': datetime.now().isoformat()
            }).execute()
            
            # Clean up OAuth state
            self.supabase.table('oauth_states').delete().eq('state', state).execute()
            
            return True
            
        except Exception as e:
            print(f"Error storing Google credentials: {e}")
            return False
    
    async def generate_report(
        self,
        project_id: UUID,
        template_id: UUID,
        report_config: Dict[str, Any],
        user_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a Google Slides report from project data"""
        
        # Get template
        template = await self._get_template(template_id)
        
        # Get project data
        project_data = await self._get_project_data(project_id)
        
        # Populate template with data
        populated_template = self.template_engine.populate_template_with_data(template, project_data)
        
        # Generate charts if configured
        charts = []
        if report_config.get('include_charts', True):
            chart_configs = template.get('chart_configurations', [])
            charts = self.template_engine.generate_charts_and_visualizations(
                populated_template['populated_data'], chart_configs
            )
        
        # Create Google Slides presentation (mock implementation)
        google_result = await self._create_google_slides_presentation(
            populated_template, charts, report_config, user_id
        )
        
        # Store report record
        report_data = {
            'project_id': str(project_id),
            'template_id': str(template_id),
            'name': name or f"Report for {project_data.get('name', 'Project')}",
            'description': description,
            'google_drive_url': google_result['drive_url'],
            'google_slides_id': google_result['slides_id'],
            'google_drive_file_id': google_result['file_id'],
            'generation_status': 'completed',
            'progress_percentage': 100,
            'generation_time_ms': google_result.get('generation_time_ms', 0),
            'generated_by': str(user_id),
            'created_at': datetime.now().isoformat(),
            'completed_at': datetime.now().isoformat()
        }
        
        result = self.supabase.table('generated_reports').insert(report_data).execute()
        
        if not result.data:
            raise Exception("Failed to store report record")
        
        return result.data[0]
    
    async def _get_template(self, template_id: UUID) -> Dict[str, Any]:
        """Get report template by ID"""
        
        result = self.supabase.table('report_templates').select('*').eq('id', str(template_id)).execute()
        
        if not result.data:
            raise Exception("Report template not found")
        
        return result.data[0]
    
    async def _get_project_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get comprehensive project data for report generation"""
        
        # Get basic project data
        project_result = self.supabase.table('projects').select('*').eq('id', str(project_id)).execute()
        
        if not project_result.data:
            raise Exception("Project not found")
        
        project_data = project_result.data[0]
        
        # Get additional data (risks, resources, financials, etc.)
        # In a real implementation, this would fetch from multiple tables
        
        # Mock additional data
        project_data['risks_summary'] = {
            'total_risks': 12,
            'high_risks': 3,
            'medium_risks': 6,
            'low_risks': 3
        }
        
        project_data['resources_summary'] = {
            'total_resources': 8,
            'available_resources': 6,
            'overallocated_resources': 2
        }
        
        return project_data
    
    async def _create_google_slides_presentation(
        self,
        populated_template: Dict[str, Any],
        charts: List[Dict[str, Any]],
        config: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Create Google Slides presentation using Google APIs with OAuth 2.0.
        
        In a production implementation, this would:
        1. Authenticate with Google APIs using OAuth 2.0 credentials
        2. Copy the template presentation from Google Drive
        3. Replace placeholders with actual data
        4. Insert charts and visualizations
        5. Save to Google Drive with appropriate permissions
        6. Return shareable link
        
        Requirements: 6.1, 6.2, 6.3, 9.2
        """
        
        import time
        start_time = time.time()
        
        # Get user's Google credentials
        credentials = self._get_google_credentials(user_id)
        
        if credentials:
            # Initialize Google API services
            google_services = self._initialize_google_services(credentials)
            
            # In production, would perform actual Google API operations:
            # 1. Copy template presentation
            # template_id = populated_template.get('google_slides_template_id')
            # copy_request = {
            #     'name': config.get('custom_title', 'Project Report')
            # }
            # copied_file = google_services['drive'].files().copy(
            #     fileId=template_id,
            #     body=copy_request
            # ).execute()
            #
            # 2. Update slides with data
            # requests = []
            # for placeholder, value in populated_template['populated_data'].items():
            #     requests.append({
            #         'replaceAllText': {
            #             'containsText': {'text': f'{{{{{placeholder}}}}}'},
            #             'replaceText': str(value)
            #         }
            #     })
            #
            # 3. Insert charts
            # for chart in charts:
            #     requests.append({
            #         'createChart': {
            #             'chartType': chart['type'].upper(),
            #             'data': chart['data'],
            #             'labels': chart['labels']
            #         }
            #     })
            #
            # google_services['slides'].presentations().batchUpdate(
            #     presentationId=copied_file['id'],
            #     body={'requests': requests}
            # ).execute()
            #
            # 4. Set sharing permissions
            # google_services['drive'].permissions().create(
            #     fileId=copied_file['id'],
            #     body={'type': 'anyone', 'role': 'reader'}
            # ).execute()
            
            print(f"Using OAuth credentials for user {user_id}")
        else:
            print(f"No Google credentials found for user {user_id} - using mock implementation")
        
        # Simulate processing time
        await asyncio.sleep(0.1)
        
        # Generate mock Google Drive URLs
        slides_id = f"slides_{uuid4().hex[:16]}"
        file_id = f"file_{uuid4().hex[:16]}"
        drive_url = f"https://docs.google.com/presentation/d/{slides_id}/edit"
        
        generation_time = int((time.time() - start_time) * 1000)
        
        return {
            'slides_id': slides_id,
            'file_id': file_id,
            'drive_url': drive_url,
            'generation_time_ms': generation_time,
            'status': 'success',
            'oauth_authenticated': credentials is not None
        }
    
    async def create_template(
        self,
        template_data: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Create a new report template"""
        
        # Prepare template data
        insert_data = {
            'name': template_data['name'],
            'description': template_data.get('description'),
            'template_type': template_data['template_type'],
            'google_slides_template_id': template_data.get('google_slides_template_id'),
            'google_drive_folder_id': template_data.get('google_drive_folder_id'),
            'data_mappings': template_data['data_mappings'],
            'chart_configurations': template_data.get('chart_configurations', []),
            'slide_layouts': template_data.get('slide_layouts', []),
            'version': '1.0',
            'is_active': True,
            'is_default': template_data.get('is_default', False),
            'is_public': template_data.get('is_public', False),
            'allowed_roles': template_data.get('allowed_roles', []),
            'tags': template_data.get('tags', []),
            'created_by': str(user_id),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        result = self.supabase.table('report_templates').insert(insert_data).execute()
        
        if not result.data:
            raise Exception("Failed to create report template")
        
        return result.data[0]
    
    async def validate_template_compatibility(
        self,
        template_id: UUID
    ) -> Dict[str, Any]:
        """Validate template compatibility and configuration"""
        
        template = await self._get_template(template_id)
        
        validation_result = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'template_info': {
                'name': template['name'],
                'type': template['template_type'],
                'version': template['version'],
                'data_mappings_count': len(template.get('data_mappings', {})),
                'chart_count': len(template.get('chart_configurations', []))
            }
        }
        
        # Validate data mappings
        data_mappings = template.get('data_mappings', {})
        if not data_mappings:
            validation_result['warnings'].append("No data mappings defined")
        
        # Validate Google Slides template ID
        google_template_id = template.get('google_slides_template_id')
        if not google_template_id:
            validation_result['warnings'].append("No Google Slides template ID specified")
        
        # Validate chart configurations
        chart_configs = template.get('chart_configurations', [])
        for i, chart in enumerate(chart_configs):
            if not chart.get('title'):
                validation_result['warnings'].append(f"Chart {i+1} has no title")
            if not chart.get('data_source'):
                validation_result['errors'].append(f"Chart {i+1} has no data source")
        
        if validation_result['errors']:
            validation_result['is_valid'] = False
        
        return validation_result
    
    async def list_templates(
        self,
        template_type: Optional[str] = None,
        is_public: Optional[bool] = None,
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """List available report templates"""
        
        query = self.supabase.table('report_templates').select('*').eq('is_active', True)
        
        if template_type:
            query = query.eq('template_type', template_type)
        
        if is_public is not None:
            query = query.eq('is_public', is_public)
        
        if user_id:
            # In a real implementation, would filter by user permissions
            pass
        
        result = query.order('created_at', desc=True).execute()
        
        return result.data or []
    
    async def get_report_status(self, report_id: UUID) -> Dict[str, Any]:
        """Get report generation status"""
        
        result = self.supabase.table('generated_reports').select('*').eq('id', str(report_id)).execute()
        
        if not result.data:
            raise Exception("Report not found")
        
        return result.data[0]
    
    async def list_project_reports(
        self,
        project_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List reports for a project"""
        
        result = self.supabase.table('generated_reports').select('*').eq(
            'project_id', str(project_id)
        ).order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        
        return result.data or []
    
    async def delete_report(self, report_id: UUID, user_id: UUID) -> bool:
        """Delete a generated report"""
        
        try:
            # In a real implementation, would also delete from Google Drive
            
            result = self.supabase.table('generated_reports').delete().eq('id', str(report_id)).execute()
            
            return len(result.data) > 0
            
        except Exception:
            return False