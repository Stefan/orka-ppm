"""
Integration Tests for Workflow Template System

Tests the integration between workflow templates, workflow engine, and API endpoints.
"""

import pytest
from uuid import uuid4

from services.workflow_templates import (
    workflow_template_system,
    WorkflowTemplateType
)
from models.workflow import WorkflowStatus, StepType, ApprovalType


class TestWorkflowTemplateIntegration:
    """Integration tests for workflow template system"""
    
    def test_budget_approval_template_complete_flow(self):
        """Test complete flow of budget approval template"""
        # 1. List templates
        templates = workflow_template_system.list_templates()
        assert len(templates) > 0
        
        budget_template = next(
            (t for t in templates if t["template_type"] == WorkflowTemplateType.BUDGET_APPROVAL),
            None
        )
        assert budget_template is not None
        assert budget_template["name"] == "Budget Approval Workflow"
        
        # 2. Get template metadata
        metadata = workflow_template_system.get_template_metadata(
            WorkflowTemplateType.BUDGET_APPROVAL
        )
        assert metadata is not None
        assert metadata["step_count"] == 3
        assert metadata["trigger_count"] == 1
        
        # 3. Customize template
        customizations = {
            "steps": {
                0: {
                    "timeout_hours": 24,
                    "approver_roles": ["finance_manager"]
                }
            },
            "triggers": {
                0: {
                    "threshold_values": {
                        "percentage": 8.0
                    }
                }
            }
        }
        
        customized = workflow_template_system.customize_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations
        )
        assert customized["steps"][0]["timeout_hours"] == 24
        assert customized["steps"][0]["approver_roles"] == ["finance_manager"]
        assert customized["triggers"][0]["threshold_values"]["percentage"] == 8.0
        
        # 4. Instantiate template
        user_id = uuid4()
        workflow = workflow_template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            name="Project X Budget Approval",
            customizations=customizations,
            created_by=user_id
        )
        
        # Verify workflow
        assert workflow.name == "Project X Budget Approval"
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.created_by == user_id
        assert len(workflow.steps) == 3
        assert len(workflow.triggers) == 1
        
        # Verify customizations were applied
        assert workflow.steps[0].timeout_hours == 24
        assert workflow.steps[0].approver_roles == ["finance_manager"]
        assert workflow.triggers[0].threshold_values["percentage"] == 8.0
    
    def test_milestone_approval_template_complete_flow(self):
        """Test complete flow of milestone approval template"""
        # 1. Get template
        template = workflow_template_system.get_template(
            WorkflowTemplateType.MILESTONE_APPROVAL
        )
        assert template is not None
        
        # 2. Validate customizations
        customizations = {
            "steps": {
                0: {"timeout_hours": 12}
            }
        }
        
        is_valid, errors = workflow_template_system.validate_customizations(
            WorkflowTemplateType.MILESTONE_APPROVAL,
            customizations
        )
        assert is_valid is True
        assert len(errors) == 0
        
        # 3. Instantiate with customizations
        workflow = workflow_template_system.instantiate_template(
            WorkflowTemplateType.MILESTONE_APPROVAL,
            customizations=customizations
        )
        
        assert workflow.name == "Milestone Approval Workflow"
        assert len(workflow.steps) == 2
        assert workflow.steps[0].timeout_hours == 12
    
    def test_resource_allocation_template_complete_flow(self):
        """Test complete flow of resource allocation template"""
        # 1. Get metadata
        metadata = workflow_template_system.get_template_metadata(
            WorkflowTemplateType.RESOURCE_ALLOCATION
        )
        assert metadata is not None
        assert "customizable_fields" in metadata["metadata"]
        
        # 2. Customize with multiple fields
        customizations = {
            "name": "Custom Resource Workflow",
            "steps": {
                0: {
                    "timeout_hours": 36,
                    "approver_roles": ["resource_admin"]
                },
                1: {
                    "approval_type": ApprovalType.ANY.value
                }
            }
        }
        
        # 3. Instantiate
        workflow = workflow_template_system.instantiate_template(
            WorkflowTemplateType.RESOURCE_ALLOCATION,
            customizations=customizations
        )
        
        assert workflow.name == "Custom Resource Workflow"
        assert workflow.steps[0].timeout_hours == 36
        assert workflow.steps[0].approver_roles == ["resource_admin"]
        assert workflow.steps[1].approval_type == ApprovalType.ANY
    
    def test_template_validation_catches_errors(self):
        """Test that validation catches invalid customizations"""
        # Invalid step index
        customizations = {
            "steps": {
                99: {"timeout_hours": 24}
            }
        }
        
        is_valid, errors = workflow_template_system.validate_customizations(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations
        )
        
        assert is_valid is False
        assert len(errors) > 0
        assert any("Invalid step index" in error for error in errors)
    
    def test_multiple_workflows_from_same_template(self):
        """Test creating multiple workflows from the same template"""
        workflows = []
        
        for i in range(3):
            workflow = workflow_template_system.instantiate_template(
                WorkflowTemplateType.BUDGET_APPROVAL,
                name=f"Budget Workflow {i}",
                customizations={
                    "steps": {
                        0: {"timeout_hours": 24 + (i * 12)}
                    }
                }
            )
            workflows.append(workflow)
        
        # Verify all workflows are independent
        assert len(workflows) == 3
        assert workflows[0].name != workflows[1].name
        assert workflows[0].steps[0].timeout_hours == 24
        assert workflows[1].steps[0].timeout_hours == 36
        assert workflows[2].steps[0].timeout_hours == 48
    
    def test_template_with_excluded_steps(self):
        """Test template instantiation with excluded steps"""
        # Exclude the executive approval step
        customizations = {
            "excluded_steps": [2]
        }
        
        workflow = workflow_template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        # Should have 2 steps instead of 3
        assert len(workflow.steps) == 2
        
        # Steps should be renumbered
        assert workflow.steps[0].step_order == 0
        assert workflow.steps[1].step_order == 1
        
        # Verify the right steps remain
        assert workflow.steps[0].name == "Project Manager Review"
        assert workflow.steps[1].name == "Portfolio Manager Approval"
    
    def test_all_templates_can_be_instantiated(self):
        """Test that all templates can be successfully instantiated"""
        template_types = [
            WorkflowTemplateType.BUDGET_APPROVAL,
            WorkflowTemplateType.MILESTONE_APPROVAL,
            WorkflowTemplateType.RESOURCE_ALLOCATION
        ]
        
        for template_type in template_types:
            workflow = workflow_template_system.instantiate_template(template_type)
            
            # Basic validation
            assert workflow is not None
            assert workflow.name is not None
            assert len(workflow.steps) > 0
            assert workflow.status == WorkflowStatus.DRAFT
            
            # Verify steps are properly ordered
            for idx, step in enumerate(workflow.steps):
                assert step.step_order == idx
                assert step.step_type == StepType.APPROVAL
                assert len(step.approver_roles) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
