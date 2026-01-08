"""
Service classes for Roche Construction/Engineering PPM Features
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

from roche_construction_models import *


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
    ) -> ShareableURL:
        """Generate a new shareable URL for a project"""
        
        # Create token payload
        token_payload = {
            'project_id': str(project_id),
            'permissions': permissions.dict(),
            'exp': int(expiration.timestamp()),
            'created_by': str(user_id)
        }
        
        # Generate secure token
        token = self.token_manager.generate_secure_token(token_payload)
        
        # Store in database
        url_data = {
            'project_id': str(project_id),
            'token': token,
            'permissions': permissions.dict(),
            'created_by': str(user_id),
            'expires_at': expiration.isoformat(),
            'access_count': 0,
            'is_revoked': False
        }
        
        result = self.supabase.table('shareable_urls').insert(url_data).execute()
        
        if not result.data:
            raise Exception("Failed to create shareable URL")
        
        return ShareableURL(**result.data[0])
    
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
    
    async def list_project_shareable_urls(self, project_id: UUID) -> List[ShareableURL]:
        """List all shareable URLs for a project"""
        result = self.supabase.table('shareable_urls').select('*').eq(
            'project_id', str(project_id)
        ).order('created_at', desc=True).execute()
        
        return [ShareableURL(**url_data) for url_data in result.data]


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


class ScenarioAnalyzer:
    """What-If scenario analysis service"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def create_scenario(
        self,
        base_project_id: UUID,
        scenario_config: ScenarioConfig,
        user_id: UUID,
        base_scenario_id: Optional[UUID] = None
    ) -> ScenarioAnalysis:
        """Create a new what-if scenario"""
        
        # Get base project data
        base_project = await self._get_project_data(base_project_id)
        
        # Calculate impacts
        timeline_impact = await self._calculate_timeline_impact(base_project, scenario_config.parameter_changes)
        cost_impact = await self._calculate_cost_impact(base_project, scenario_config.parameter_changes)
        resource_impact = await self._calculate_resource_impact(base_project, scenario_config.parameter_changes)
        
        # Store scenario
        scenario_data = {
            'project_id': str(base_project_id),
            'name': scenario_config.name,
            'description': scenario_config.description,
            'base_scenario_id': str(base_scenario_id) if base_scenario_id else None,
            'parameter_changes': scenario_config.parameter_changes.dict(),
            'impact_results': {
                'timeline': timeline_impact.dict() if timeline_impact else {},
                'cost': cost_impact.dict() if cost_impact else {},
                'resource': resource_impact.dict() if resource_impact else {}
            },
            'timeline_impact': timeline_impact.dict() if timeline_impact else {},
            'cost_impact': cost_impact.dict() if cost_impact else {},
            'resource_impact': resource_impact.dict() if resource_impact else {},
            'created_by': str(user_id),
            'is_active': True,
            'is_baseline': False
        }
        
        result = self.supabase.table('scenario_analyses').insert(scenario_data).execute()
        
        if not result.data:
            raise Exception("Failed to create scenario")
        
        return ScenarioAnalysis(**result.data[0])
    
    async def _get_project_data(self, project_id: UUID) -> Dict[str, Any]:
        """Get project data for analysis"""
        result = self.supabase.table('projects').select('*').eq('id', str(project_id)).execute()
        if not result.data:
            raise ValueError(f"Project {project_id} not found")
        return result.data[0]
    
    async def _calculate_timeline_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[TimelineImpact]:
        """Calculate timeline impact of parameter changes"""
        
        if not changes.start_date and not changes.end_date:
            return None
        
        # Get original timeline
        original_start = datetime.fromisoformat(base_project.get('start_date', datetime.now().isoformat()))
        original_end = datetime.fromisoformat(base_project.get('end_date', datetime.now().isoformat()))
        original_duration = (original_end - original_start).days
        
        # Calculate new timeline
        new_start = changes.start_date or original_start.date()
        new_end = changes.end_date or original_end.date()
        new_duration = (new_end - new_start).days
        
        return TimelineImpact(
            original_duration=original_duration,
            new_duration=new_duration,
            duration_change=new_duration - original_duration,
            critical_path_affected=abs(new_duration - original_duration) > 7,  # More than a week
            affected_milestones=[]  # Would need milestone data to populate
        )
    
    async def _calculate_cost_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[CostImpact]:
        """Calculate cost impact of parameter changes"""
        
        if not changes.budget:
            return None
        
        original_cost = Decimal(str(base_project.get('budget', 0)))
        new_cost = changes.budget
        cost_change = new_cost - original_cost
        cost_change_percentage = float((cost_change / original_cost * 100)) if original_cost > 0 else 0
        
        return CostImpact(
            original_cost=original_cost,
            new_cost=new_cost,
            cost_change=cost_change,
            cost_change_percentage=cost_change_percentage,
            affected_categories=['budget']  # Would need more detailed cost breakdown
        )
    
    async def _calculate_resource_impact(
        self, 
        base_project: Dict[str, Any], 
        changes: ProjectChanges
    ) -> Optional[ResourceImpact]:
        """Calculate resource impact of parameter changes"""
        
        if not changes.resource_allocations:
            return None
        
        return ResourceImpact(
            utilization_changes=changes.resource_allocations,
            over_allocated_resources=[],
            under_allocated_resources=[],
            new_resource_requirements=[]
        )
    
    async def compare_scenarios(self, scenario_ids: List[UUID]) -> ScenarioComparison:
        """Compare multiple scenarios"""
        
        scenarios = []
        for scenario_id in scenario_ids:
            result = self.supabase.table('scenario_analyses').select('*').eq('id', str(scenario_id)).execute()
            if result.data:
                scenarios.append(ScenarioAnalysis(**result.data[0]))
        
        # Build comparison matrix
        comparison_matrix = {}
        for scenario in scenarios:
            comparison_matrix[str(scenario.id)] = {
                'name': scenario.name,
                'cost_impact': scenario.cost_impact.dict() if scenario.cost_impact else {},
                'timeline_impact': scenario.timeline_impact.dict() if scenario.timeline_impact else {},
                'resource_impact': scenario.resource_impact.dict() if scenario.resource_impact else {}
            }
        
        return ScenarioComparison(
            scenarios=scenarios,
            comparison_matrix=comparison_matrix,
            recommendations=[]  # Would implement recommendation logic
        )


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
    
    def parse_csv_hierarchy(self, csv_data: str, column_mappings: Dict[str, str]) -> List[Dict[str, Any]]:
        """Parse CSV data into hierarchical structure"""
        import csv
        from io import StringIO
        
        # Parse CSV
        csv_reader = csv.DictReader(StringIO(csv_data))
        rows = list(csv_reader)
        
        # Convert to standardized format using column mappings
        parsed_rows = []
        for row in rows:
            parsed_row = {}
            for csv_column, model_field in column_mappings.items():
                if csv_column in row:
                    parsed_row[model_field] = row[csv_column]
            
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
    """Service for generating Google Slides reports from project data"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.template_engine = TemplateEngine()
    
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
            populated_template, charts, report_config
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
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create Google Slides presentation (mock implementation)"""
        
        # In a real implementation, this would:
        # 1. Authenticate with Google APIs
        # 2. Copy the template presentation
        # 3. Replace placeholders with actual data
        # 4. Insert charts and visualizations
        # 5. Save to Google Drive
        # 6. Set appropriate sharing permissions
        
        # Mock implementation
        import time
        start_time = time.time()
        
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
            'status': 'success'
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