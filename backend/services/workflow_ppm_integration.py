"""
Workflow PPM System Integration

Provides automatic workflow triggers for PPM system events including:
- Budget changes and variance thresholds
- Project milestone updates
- Resource allocation changes
- Risk management integration

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from decimal import Decimal

from config.database import supabase
from services.workflow_engine_core import WorkflowEngineCore
from services.workflow_templates import workflow_template_system, WorkflowTemplateType

logger = logging.getLogger(__name__)


class WorkflowPPMIntegration:
    """
    Service for integrating workflow engine with PPM system features.
    
    Provides automatic workflow triggers for:
    - Budget changes exceeding thresholds
    - Project milestone updates
    - Resource allocation changes
    - Risk management events
    """
    
    def __init__(self):
        """Initialize the PPM integration service."""
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        self.workflow_engine = WorkflowEngineCore(self.db)
    
    # ==================== Budget Change Triggers ====================
    
    async def monitor_budget_changes(
        self,
        project_id: str,
        old_budget: Decimal,
        new_budget: Decimal,
        variance_threshold_percent: float = 10.0,
        initiated_by: UUID = None
    ) -> Optional[str]:
        """
        Monitor budget changes and trigger approval workflows if thresholds exceeded.
        
        Args:
            project_id: Project ID
            old_budget: Previous budget amount
            new_budget: New budget amount
            variance_threshold_percent: Threshold percentage for triggering workflow
            initiated_by: User who initiated the change
            
        Returns:
            Optional workflow instance ID if workflow was triggered
            
        Requirements: 7.1, 7.4
        """
        try:
            # Calculate variance
            if old_budget == 0:
                variance_percent = 100.0 if new_budget > 0 else 0.0
            else:
                variance_percent = abs((new_budget - old_budget) / old_budget * 100)
            
            variance_amount = abs(new_budget - old_budget)
            
            # Check if variance exceeds threshold
            if variance_percent < variance_threshold_percent:
                logger.info(
                    f"Budget change for project {project_id} below threshold: "
                    f"{variance_percent:.2f}% < {variance_threshold_percent}%"
                )
                return None
            
            logger.info(
                f"Budget change for project {project_id} exceeds threshold: "
                f"{variance_percent:.2f}% >= {variance_threshold_percent}%"
            )
            
            # Get project details
            project_result = self.db.table("projects").select("*").eq("id", project_id).execute()
            
            if not project_result.data:
                logger.error(f"Project {project_id} not found")
                return None
            
            project = project_result.data[0]
            
            # Get or create budget approval workflow template
            workflow_template = workflow_template_system.get_template(
                WorkflowTemplateType.BUDGET_APPROVAL
            )
            
            if not workflow_template:
                logger.error("Budget approval workflow template not found")
                return None
            
            # Customize template for this project
            customized_workflow = workflow_template_system.customize_template(
                template_type=WorkflowTemplateType.BUDGET_APPROVAL,
                customizations={
                    "name": f"Budget Approval - {project.get('name', 'Project')}",
                    "description": f"Budget change approval for variance of {variance_percent:.2f}%"
                }
            )
            
            # Create workflow instance
            instance_id = await self.workflow_engine.create_workflow_instance(
                workflow_definition=customized_workflow,
                entity_type="financial_tracking",
                entity_id=UUID(project_id),
                initiated_by=initiated_by or UUID(project.get("created_by")),
                context={
                    "project_id": project_id,
                    "project_name": project.get("name"),
                    "old_budget": str(old_budget),
                    "new_budget": str(new_budget),
                    "variance_amount": str(variance_amount),
                    "variance_percent": variance_percent,
                    "threshold_percent": variance_threshold_percent,
                    "trigger_type": "budget_change"
                }
            )
            
            logger.info(
                f"Created budget approval workflow instance {instance_id} "
                f"for project {project_id}"
            )
            
            return str(instance_id)
            
        except Exception as e:
            logger.error(f"Error monitoring budget changes for project {project_id}: {e}")
            return None
    
    async def check_budget_variance_thresholds(
        self,
        organization_id: str,
        threshold_percent: float = 10.0
    ) -> List[Dict[str, Any]]:
        """
        Check all projects for budget variances exceeding thresholds.
        
        Args:
            organization_id: Organization ID to check
            threshold_percent: Variance threshold percentage
            
        Returns:
            List of projects with variances exceeding threshold
            
        Requirements: 7.1, 7.4
        """
        try:
            # Get all projects for organization
            projects_result = self.db.table("projects").select(
                "*, financial_tracking(*)"
            ).eq("organization_id", organization_id).execute()
            
            projects_exceeding_threshold = []
            
            for project in projects_result.data:
                # Get financial tracking data
                financial_data = project.get("financial_tracking", [])
                
                if not financial_data:
                    continue
                
                # Get latest budget data
                latest_financial = financial_data[0] if financial_data else None
                
                if not latest_financial:
                    continue
                
                # Calculate variance
                budget = Decimal(str(latest_financial.get("budget", 0)))
                actual = Decimal(str(latest_financial.get("actual_cost", 0)))
                
                if budget == 0:
                    continue
                
                variance_percent = abs((actual - budget) / budget * 100)
                
                if variance_percent >= threshold_percent:
                    projects_exceeding_threshold.append({
                        "project_id": project["id"],
                        "project_name": project.get("name"),
                        "budget": str(budget),
                        "actual": str(actual),
                        "variance_percent": float(variance_percent),
                        "requires_approval": True
                    })
            
            return projects_exceeding_threshold
            
        except Exception as e:
            logger.error(f"Error checking budget variance thresholds: {e}")
            return []
    
    # ==================== Milestone Triggers ====================
    
    async def trigger_milestone_approval(
        self,
        milestone_id: str,
        project_id: str,
        milestone_type: str,
        initiated_by: UUID
    ) -> Optional[str]:
        """
        Trigger approval workflow for milestone updates.
        
        Args:
            milestone_id: Milestone ID
            project_id: Project ID
            milestone_type: Type of milestone
            initiated_by: User who initiated the change
            
        Returns:
            Optional workflow instance ID if workflow was triggered
            
        Requirements: 7.2
        """
        try:
            # Get milestone details
            milestone_result = self.db.table("milestones").select("*").eq(
                "id", milestone_id
            ).execute()
            
            if not milestone_result.data:
                logger.error(f"Milestone {milestone_id} not found")
                return None
            
            milestone = milestone_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select("*").eq("id", project_id).execute()
            
            if not project_result.data:
                logger.error(f"Project {project_id} not found")
                return None
            
            project = project_result.data[0]
            
            # Get milestone approval workflow template
            workflow_template = workflow_template_system.get_template(
                WorkflowTemplateType.MILESTONE_APPROVAL
            )
            
            if not workflow_template:
                logger.error("Milestone approval workflow template not found")
                return None
            
            # Customize template
            customized_workflow = workflow_template_system.customize_template(
                template_type=WorkflowTemplateType.MILESTONE_APPROVAL,
                customizations={
                    "name": f"Milestone Approval - {milestone.get('name', 'Milestone')}",
                    "description": f"Approval for {milestone_type} milestone update"
                }
            )
            
            # Create workflow instance
            instance_id = await self.workflow_engine.create_workflow_instance(
                workflow_definition=customized_workflow,
                entity_type="milestone",
                entity_id=UUID(milestone_id),
                initiated_by=initiated_by,
                context={
                    "milestone_id": milestone_id,
                    "milestone_name": milestone.get("name"),
                    "milestone_type": milestone_type,
                    "project_id": project_id,
                    "project_name": project.get("name"),
                    "trigger_type": "milestone_update"
                }
            )
            
            logger.info(
                f"Created milestone approval workflow instance {instance_id} "
                f"for milestone {milestone_id}"
            )
            
            return str(instance_id)
            
        except Exception as e:
            logger.error(f"Error triggering milestone approval for {milestone_id}: {e}")
            return None
    
    # ==================== Resource Allocation Triggers ====================
    
    async def trigger_resource_allocation_approval(
        self,
        allocation_id: str,
        resource_id: str,
        project_id: str,
        allocation_percentage: float,
        initiated_by: UUID
    ) -> Optional[str]:
        """
        Trigger approval workflow for resource allocation changes.
        
        Args:
            allocation_id: Resource allocation ID
            resource_id: Resource ID
            project_id: Project ID
            allocation_percentage: Percentage of resource allocation
            initiated_by: User who initiated the change
            
        Returns:
            Optional workflow instance ID if workflow was triggered
            
        Requirements: 7.3
        """
        try:
            # Determine if approval is needed based on allocation percentage
            # High allocation (>50%) requires approval
            if allocation_percentage <= 50.0:
                logger.info(
                    f"Resource allocation {allocation_id} below approval threshold: "
                    f"{allocation_percentage}% <= 50%"
                )
                return None
            
            # Get resource details
            resource_result = self.db.table("resources").select("*").eq(
                "id", resource_id
            ).execute()
            
            if not resource_result.data:
                logger.error(f"Resource {resource_id} not found")
                return None
            
            resource = resource_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select("*").eq("id", project_id).execute()
            
            if not project_result.data:
                logger.error(f"Project {project_id} not found")
                return None
            
            project = project_result.data[0]
            
            # Get resource allocation workflow template
            workflow_template = workflow_template_system.get_template(
                WorkflowTemplateType.RESOURCE_ALLOCATION
            )
            
            if not workflow_template:
                logger.error("Resource allocation workflow template not found")
                return None
            
            # Customize template
            customized_workflow = workflow_template_system.customize_template(
                template_type=WorkflowTemplateType.RESOURCE_ALLOCATION,
                customizations={
                    "name": f"Resource Allocation - {resource.get('name', 'Resource')}",
                    "description": f"Approval for {allocation_percentage}% allocation"
                }
            )
            
            # Create workflow instance
            instance_id = await self.workflow_engine.create_workflow_instance(
                workflow_definition=customized_workflow,
                entity_type="resource_allocation",
                entity_id=UUID(allocation_id),
                initiated_by=initiated_by,
                context={
                    "allocation_id": allocation_id,
                    "resource_id": resource_id,
                    "resource_name": resource.get("name"),
                    "project_id": project_id,
                    "project_name": project.get("name"),
                    "allocation_percentage": allocation_percentage,
                    "trigger_type": "resource_allocation"
                }
            )
            
            logger.info(
                f"Created resource allocation workflow instance {instance_id} "
                f"for allocation {allocation_id}"
            )
            
            return str(instance_id)
            
        except Exception as e:
            logger.error(f"Error triggering resource allocation approval: {e}")
            return None
    
    # ==================== Risk Management Integration ====================
    
    async def trigger_risk_based_approval(
        self,
        risk_id: str,
        project_id: str,
        risk_level: str,
        change_type: str,
        initiated_by: UUID
    ) -> Optional[str]:
        """
        Trigger approval workflow for high-risk changes.
        
        Args:
            risk_id: Risk ID
            project_id: Project ID
            risk_level: Risk level (low, medium, high, critical)
            change_type: Type of change requiring approval
            initiated_by: User who initiated the change
            
        Returns:
            Optional workflow instance ID if workflow was triggered
            
        Requirements: 7.5
        """
        try:
            # Only trigger for high and critical risks
            if risk_level.lower() not in ["high", "critical"]:
                logger.info(
                    f"Risk {risk_id} level {risk_level} below approval threshold"
                )
                return None
            
            # Get risk details
            risk_result = self.db.table("risks").select("*").eq("id", risk_id).execute()
            
            if not risk_result.data:
                logger.error(f"Risk {risk_id} not found")
                return None
            
            risk = risk_result.data[0]
            
            # Get project details
            project_result = self.db.table("projects").select("*").eq("id", project_id).execute()
            
            if not project_result.data:
                logger.error(f"Project {project_id} not found")
                return None
            
            project = project_result.data[0]
            
            # Get appropriate workflow template based on change type
            # For now, use budget approval template as a generic approval workflow
            workflow_template = workflow_template_system.get_template(
                WorkflowTemplateType.BUDGET_APPROVAL
            )
            
            if not workflow_template:
                logger.error("Workflow template not found for risk-based approval")
                return None
            
            # Customize template
            customized_workflow = workflow_template_system.customize_template(
                template_type=WorkflowTemplateType.BUDGET_APPROVAL,
                customizations={
                    "name": f"Risk Approval - {risk.get('title', 'High Risk Change')}",
                    "description": f"Approval required for {risk_level} risk {change_type}"
                }
            )
            
            # Create workflow instance
            instance_id = await self.workflow_engine.create_workflow_instance(
                workflow_definition=customized_workflow,
                entity_type="risk",
                entity_id=UUID(risk_id),
                initiated_by=initiated_by,
                context={
                    "risk_id": risk_id,
                    "risk_title": risk.get("title"),
                    "risk_level": risk_level,
                    "change_type": change_type,
                    "project_id": project_id,
                    "project_name": project.get("name"),
                    "trigger_type": "risk_based"
                }
            )
            
            logger.info(
                f"Created risk-based approval workflow instance {instance_id} "
                f"for risk {risk_id}"
            )
            
            return str(instance_id)
            
        except Exception as e:
            logger.error(f"Error triggering risk-based approval for {risk_id}: {e}")
            return None
    
    # ==================== Integration Helper Methods ====================
    
    async def get_active_workflows_for_entity(
        self,
        entity_type: str,
        entity_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all active workflow instances for a specific entity.
        
        Args:
            entity_type: Type of entity
            entity_id: Entity ID
            
        Returns:
            List of active workflow instances
        """
        try:
            result = self.db.table("workflow_instances").select("*").eq(
                "entity_type", entity_type
            ).eq("entity_id", entity_id).in_(
                "status", ["pending", "in_progress"]
            ).execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error getting active workflows for {entity_type}/{entity_id}: {e}")
            return []
    
    async def cancel_workflows_for_entity(
        self,
        entity_type: str,
        entity_id: str,
        reason: str = "Entity deleted or cancelled"
    ) -> int:
        """
        Cancel all active workflows for a specific entity.
        
        Args:
            entity_type: Type of entity
            entity_id: Entity ID
            reason: Reason for cancellation
            
        Returns:
            Number of workflows cancelled
        """
        try:
            active_workflows = await self.get_active_workflows_for_entity(
                entity_type, entity_id
            )
            
            cancelled_count = 0
            
            for workflow in active_workflows:
                try:
                    # Update workflow status to cancelled
                    self.db.table("workflow_instances").update({
                        "status": "cancelled",
                        "completed_at": datetime.utcnow().isoformat(),
                        "data": {
                            **workflow.get("data", {}),
                            "cancellation_reason": reason
                        }
                    }).eq("id", workflow["id"]).execute()
                    
                    cancelled_count += 1
                    logger.info(f"Cancelled workflow instance {workflow['id']}")
                    
                except Exception as e:
                    logger.error(f"Error cancelling workflow {workflow['id']}: {e}")
            
            return cancelled_count
            
        except Exception as e:
            logger.error(f"Error cancelling workflows for {entity_type}/{entity_id}: {e}")
            return 0


# Global instance
workflow_ppm_integration = WorkflowPPMIntegration()
