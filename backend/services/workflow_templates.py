"""
Workflow Template System

Provides predefined workflow templates for common approval patterns including
budget approval, milestone approval, and resource allocation. Supports template
instantiation and customization.

Requirement 1.5: Support workflow templates for common approval patterns
"""

import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime

from models.workflow import (
    WorkflowDefinition,
    WorkflowStep,
    WorkflowTrigger,
    WorkflowStatus,
    StepType,
    ApprovalType
)

logger = logging.getLogger(__name__)


class WorkflowTemplateType:
    """Workflow template type constants"""
    BUDGET_APPROVAL = "budget_approval"
    MILESTONE_APPROVAL = "milestone_approval"
    RESOURCE_ALLOCATION = "resource_allocation"


class WorkflowTemplateSystem:
    """
    Workflow template system for creating and managing workflow templates.
    
    Provides predefined templates for common approval patterns and supports
    template instantiation with customization options.
    """
    
    def __init__(self):
        """Initialize the workflow template system."""
        self._templates = self._initialize_templates()
    
    def _initialize_templates(self) -> Dict[str, Dict[str, Any]]:
        """
        Initialize predefined workflow templates.
        
        Returns:
            Dict mapping template types to template definitions
        """
        return {
            WorkflowTemplateType.BUDGET_APPROVAL: self._create_budget_approval_template(),
            WorkflowTemplateType.MILESTONE_APPROVAL: self._create_milestone_approval_template(),
            WorkflowTemplateType.RESOURCE_ALLOCATION: self._create_resource_allocation_template()
        }
    
    # ==================== Template Definitions ====================
    
    def _create_budget_approval_template(self) -> Dict[str, Any]:
        """
        Create budget approval workflow template.
        
        This template handles approval workflows for budget changes and variances.
        It includes multiple approval levels based on variance amount.
        
        Returns:
            Budget approval template definition
        """
        return {
            "name": "Budget Approval Workflow",
            "description": "Multi-level approval workflow for budget changes and variances",
            "template_type": WorkflowTemplateType.BUDGET_APPROVAL,
            "steps": [
                {
                    "step_order": 0,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Project Manager Review",
                    "description": "Initial review by project manager",
                    "approvers": [],
                    "approver_roles": ["project_manager"],
                    "approval_type": ApprovalType.ALL.value,
                    "timeout_hours": 48,
                    "conditions": None,
                    "auto_approve_conditions": {
                        "variance_percentage": {"less_than": 5.0}
                    },
                    "notification_template": "budget_approval_pm_notification"
                },
                {
                    "step_order": 1,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Portfolio Manager Approval",
                    "description": "Approval by portfolio manager for significant variances",
                    "approvers": [],
                    "approver_roles": ["portfolio_manager"],
                    "approval_type": ApprovalType.ALL.value,
                    "timeout_hours": 72,
                    "conditions": {
                        "variance_percentage": {"greater_than_or_equal": 5.0}
                    },
                    "notification_template": "budget_approval_portfolio_notification"
                },
                {
                    "step_order": 2,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Executive Approval",
                    "description": "Executive approval for major budget changes",
                    "approvers": [],
                    "approver_roles": ["admin", "executive"],
                    "approval_type": ApprovalType.ANY.value,
                    "timeout_hours": 120,
                    "conditions": {
                        "variance_percentage": {"greater_than_or_equal": 15.0}
                    },
                    "notification_template": "budget_approval_executive_notification"
                }
            ],
            "triggers": [
                {
                    "trigger_type": "budget_change",
                    "conditions": {
                        "variance_type": "cost",
                        "auto_trigger": True
                    },
                    "threshold_values": {
                        "percentage": 5.0,
                        "absolute_amount": 10000.0
                    },
                    "enabled": True
                }
            ],
            "metadata": {
                "category": "financial",
                "priority": "high",
                "sla_hours": 120,
                "escalation_enabled": True,
                "customizable_fields": [
                    "timeout_hours",
                    "approver_roles",
                    "threshold_values",
                    "conditions"
                ]
            }
        }
    
    def _create_milestone_approval_template(self) -> Dict[str, Any]:
        """
        Create milestone approval workflow template.
        
        This template handles approval workflows for project milestone updates
        and completions.
        
        Returns:
            Milestone approval template definition
        """
        return {
            "name": "Milestone Approval Workflow",
            "description": "Approval workflow for project milestone updates and completions",
            "template_type": WorkflowTemplateType.MILESTONE_APPROVAL,
            "steps": [
                {
                    "step_order": 0,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Team Lead Review",
                    "description": "Review by team lead or project coordinator",
                    "approvers": [],
                    "approver_roles": ["project_manager", "team_lead"],
                    "approval_type": ApprovalType.ANY.value,
                    "timeout_hours": 24,
                    "notification_template": "milestone_approval_team_notification"
                },
                {
                    "step_order": 1,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Stakeholder Approval",
                    "description": "Approval by key stakeholders",
                    "approvers": [],
                    "approver_roles": ["portfolio_manager", "stakeholder"],
                    "approval_type": ApprovalType.MAJORITY.value,
                    "timeout_hours": 72,
                    "conditions": {
                        "milestone_type": {"in": ["major", "critical"]},
                        "requires_stakeholder_approval": True
                    },
                    "notification_template": "milestone_approval_stakeholder_notification"
                }
            ],
            "triggers": [
                {
                    "trigger_type": "milestone_update",
                    "conditions": {
                        "status_change": True,
                        "completion_requested": True
                    },
                    "threshold_values": None,
                    "enabled": True
                }
            ],
            "metadata": {
                "category": "project_management",
                "priority": "medium",
                "sla_hours": 72,
                "escalation_enabled": True,
                "customizable_fields": [
                    "timeout_hours",
                    "approver_roles",
                    "approval_type",
                    "conditions"
                ]
            }
        }
    
    def _create_resource_allocation_template(self) -> Dict[str, Any]:
        """
        Create resource allocation workflow template.
        
        This template handles approval workflows for resource allocation changes
        and assignments.
        
        Returns:
            Resource allocation template definition
        """
        return {
            "name": "Resource Allocation Workflow",
            "description": "Approval workflow for resource allocation and assignment changes",
            "template_type": WorkflowTemplateType.RESOURCE_ALLOCATION,
            "steps": [
                {
                    "step_order": 0,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Resource Manager Review",
                    "description": "Review by resource manager",
                    "approvers": [],
                    "approver_roles": ["resource_manager", "project_manager"],
                    "approval_type": ApprovalType.ANY.value,
                    "timeout_hours": 48,
                    "notification_template": "resource_allocation_manager_notification"
                },
                {
                    "step_order": 1,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Department Head Approval",
                    "description": "Approval by department head for cross-department allocations",
                    "approvers": [],
                    "approver_roles": ["department_head", "portfolio_manager"],
                    "approval_type": ApprovalType.ALL.value,
                    "timeout_hours": 72,
                    "conditions": {
                        "allocation_type": {"in": ["cross_department", "external"]},
                        "resource_count": {"greater_than": 3}
                    },
                    "notification_template": "resource_allocation_department_notification"
                },
                {
                    "step_order": 2,
                    "step_type": StepType.APPROVAL.value,
                    "name": "Executive Approval",
                    "description": "Executive approval for high-impact resource changes",
                    "approvers": [],
                    "approver_roles": ["admin", "executive"],
                    "approval_type": ApprovalType.ANY.value,
                    "timeout_hours": 96,
                    "conditions": {
                        "impact_level": {"in": ["high", "critical"]},
                        "cost_impact": {"greater_than": 50000.0}
                    },
                    "notification_template": "resource_allocation_executive_notification"
                }
            ],
            "triggers": [
                {
                    "trigger_type": "resource_allocation",
                    "conditions": {
                        "allocation_change": True,
                        "requires_approval": True
                    },
                    "threshold_values": {
                        "resource_count": 3,
                        "cost_impact": 50000.0
                    },
                    "enabled": True
                }
            ],
            "metadata": {
                "category": "resource_management",
                "priority": "high",
                "sla_hours": 96,
                "escalation_enabled": True,
                "customizable_fields": [
                    "timeout_hours",
                    "approver_roles",
                    "approval_type",
                    "threshold_values",
                    "conditions"
                ]
            }
        }
    
    # ==================== Template Management ====================
    
    def get_template(self, template_type: str) -> Optional[Dict[str, Any]]:
        """
        Get a workflow template by type.
        
        Args:
            template_type: Type of template to retrieve
            
        Returns:
            Template definition or None if not found
        """
        return self._templates.get(template_type)
    
    def list_templates(self) -> List[Dict[str, Any]]:
        """
        List all available workflow templates.
        
        Returns:
            List of template definitions with metadata
        """
        templates = []
        for template_type, template_def in self._templates.items():
            templates.append({
                "template_type": template_type,
                "name": template_def["name"],
                "description": template_def["description"],
                "category": template_def["metadata"]["category"],
                "priority": template_def["metadata"]["priority"],
                "step_count": len(template_def["steps"]),
                "customizable_fields": template_def["metadata"]["customizable_fields"]
            })
        return templates
    
    def get_template_metadata(self, template_type: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific template.
        
        Args:
            template_type: Type of template
            
        Returns:
            Template metadata or None if not found
        """
        template = self.get_template(template_type)
        if not template:
            return None
        
        return {
            "template_type": template_type,
            "name": template["name"],
            "description": template["description"],
            "metadata": template["metadata"],
            "step_count": len(template["steps"]),
            "trigger_count": len(template["triggers"])
        }
    
    # ==================== Template Instantiation ====================
    
    def instantiate_template(
        self,
        template_type: str,
        name: Optional[str] = None,
        customizations: Optional[Dict[str, Any]] = None,
        created_by: Optional[UUID] = None
    ) -> WorkflowDefinition:
        """
        Instantiate a workflow from a template with optional customizations.
        
        Args:
            template_type: Type of template to instantiate
            name: Optional custom name for the workflow (uses template name if not provided)
            customizations: Optional customizations to apply to the template
            created_by: Optional user ID who is creating the workflow
            
        Returns:
            WorkflowDefinition instance
            
        Raises:
            ValueError: If template not found or customizations invalid
        """
        try:
            # Get template
            template = self.get_template(template_type)
            if not template:
                raise ValueError(f"Template type '{template_type}' not found")
            
            # Apply customizations
            workflow_data = self._apply_customizations(template, customizations)
            
            # Override name if provided
            if name:
                workflow_data["name"] = name
            
            # Create workflow steps
            steps = []
            for step_data in workflow_data["steps"]:
                # Filter out conditional steps if conditions not met
                if self._should_include_step(step_data, customizations):
                    step = WorkflowStep(**step_data)
                    steps.append(step)
            
            # Renumber steps to ensure sequential order
            for idx, step in enumerate(steps):
                step.step_order = idx
            
            # Create workflow triggers
            triggers = []
            for trigger_data in workflow_data["triggers"]:
                trigger = WorkflowTrigger(**trigger_data)
                triggers.append(trigger)
            
            # Create workflow definition
            workflow = WorkflowDefinition(
                name=workflow_data["name"],
                description=workflow_data["description"],
                steps=steps,
                triggers=triggers,
                metadata={
                    **workflow_data["metadata"],
                    "template_type": template_type,
                    "instantiated_at": datetime.utcnow().isoformat(),
                    "customizations_applied": customizations is not None
                },
                status=WorkflowStatus.DRAFT,
                created_by=created_by
            )
            
            logger.info(
                f"Instantiated workflow from template '{template_type}' with {len(steps)} steps"
            )
            
            return workflow
            
        except ValueError as e:
            logger.error(f"Validation error instantiating template: {e}")
            raise
        except Exception as e:
            logger.error(f"Error instantiating template '{template_type}': {e}")
            raise RuntimeError(f"Failed to instantiate template: {str(e)}")
    
    def customize_template(
        self,
        template_type: str,
        customizations: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Preview template with customizations applied.
        
        Args:
            template_type: Type of template to customize
            customizations: Customizations to apply
            
        Returns:
            Customized template definition
            
        Raises:
            ValueError: If template not found or customizations invalid
        """
        try:
            template = self.get_template(template_type)
            if not template:
                raise ValueError(f"Template type '{template_type}' not found")
            
            return self._apply_customizations(template, customizations)
            
        except ValueError as e:
            logger.error(f"Validation error customizing template: {e}")
            raise
        except Exception as e:
            logger.error(f"Error customizing template '{template_type}': {e}")
            raise RuntimeError(f"Failed to customize template: {str(e)}")
    
    # ==================== Helper Methods ====================
    
    def _apply_customizations(
        self,
        template: Dict[str, Any],
        customizations: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Apply customizations to a template.
        
        Args:
            template: Template definition
            customizations: Customizations to apply
            
        Returns:
            Customized template definition
        """
        import copy
        
        # Deep copy template to avoid modifying original
        customized = copy.deepcopy(template)
        
        if not customizations:
            return customized
        
        # Get customizable fields from metadata
        customizable_fields = template["metadata"].get("customizable_fields", [])
        
        # Apply global customizations
        if "name" in customizations:
            customized["name"] = customizations["name"]
        
        if "description" in customizations:
            customized["description"] = customizations["description"]
        
        # Apply step-level customizations
        if "steps" in customizations:
            step_customizations = customizations["steps"]
            
            for step_idx, step_custom in step_customizations.items():
                step_index = int(step_idx) if isinstance(step_idx, str) else step_idx
                
                if 0 <= step_index < len(customized["steps"]):
                    step = customized["steps"][step_index]
                    
                    # Apply allowed customizations
                    for field, value in step_custom.items():
                        if field in customizable_fields:
                            step[field] = value
                        else:
                            logger.warning(
                                f"Field '{field}' is not customizable for this template"
                            )
        
        # Apply trigger customizations
        if "triggers" in customizations:
            trigger_customizations = customizations["triggers"]
            
            for trigger_idx, trigger_custom in trigger_customizations.items():
                trigger_index = int(trigger_idx) if isinstance(trigger_idx, str) else trigger_idx
                
                if 0 <= trigger_index < len(customized["triggers"]):
                    trigger = customized["triggers"][trigger_index]
                    
                    # Apply threshold and condition customizations
                    if "threshold_values" in trigger_custom:
                        trigger["threshold_values"] = {
                            **trigger.get("threshold_values", {}),
                            **trigger_custom["threshold_values"]
                        }
                    
                    if "conditions" in trigger_custom:
                        trigger["conditions"] = {
                            **trigger.get("conditions", {}),
                            **trigger_custom["conditions"]
                        }
                    
                    if "enabled" in trigger_custom:
                        trigger["enabled"] = trigger_custom["enabled"]
        
        # Apply metadata customizations
        if "metadata" in customizations:
            customized["metadata"] = {
                **customized["metadata"],
                **customizations["metadata"]
            }
        
        return customized
    
    def _should_include_step(
        self,
        step_data: Dict[str, Any],
        customizations: Optional[Dict[str, Any]]
    ) -> bool:
        """
        Determine if a step should be included based on customizations.
        
        Args:
            step_data: Step definition
            customizations: Applied customizations
            
        Returns:
            True if step should be included, False otherwise
        """
        # If no customizations, include all steps
        if not customizations:
            return True
        
        # Check if step is explicitly excluded
        excluded_steps = customizations.get("excluded_steps", [])
        if step_data["step_order"] in excluded_steps:
            return False
        
        # Check if step has conditions that should exclude it
        step_conditions = step_data.get("conditions")
        if step_conditions and customizations.get("filter_conditional_steps"):
            # This would require context data to evaluate conditions
            # For now, include all conditional steps
            pass
        
        return True
    
    def validate_customizations(
        self,
        template_type: str,
        customizations: Dict[str, Any]
    ) -> tuple[bool, List[str]]:
        """
        Validate customizations for a template.
        
        Args:
            template_type: Type of template
            customizations: Customizations to validate
            
        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []
        
        try:
            template = self.get_template(template_type)
            if not template:
                errors.append(f"Template type '{template_type}' not found")
                return False, errors
            
            customizable_fields = template["metadata"].get("customizable_fields", [])
            
            # Validate step customizations
            if "steps" in customizations:
                step_customizations = customizations["steps"]
                
                for step_idx, step_custom in step_customizations.items():
                    step_index = int(step_idx) if isinstance(step_idx, str) else step_idx
                    
                    if step_index < 0 or step_index >= len(template["steps"]):
                        errors.append(f"Invalid step index: {step_index}")
                        continue
                    
                    # Check for non-customizable fields
                    for field in step_custom.keys():
                        if field not in customizable_fields:
                            errors.append(
                                f"Field '{field}' in step {step_index} is not customizable"
                            )
            
            # Validate trigger customizations
            if "triggers" in customizations:
                trigger_customizations = customizations["triggers"]
                
                for trigger_idx in trigger_customizations.keys():
                    trigger_index = int(trigger_idx) if isinstance(trigger_idx, str) else trigger_idx
                    
                    if trigger_index < 0 or trigger_index >= len(template["triggers"]):
                        errors.append(f"Invalid trigger index: {trigger_index}")
            
            return len(errors) == 0, errors
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
            return False, errors


# Global template system instance
workflow_template_system = WorkflowTemplateSystem()
