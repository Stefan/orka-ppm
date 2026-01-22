"""
Unit Tests for Workflow Template System

Tests for workflow template creation, instantiation, and customization.
"""

import pytest
from uuid import uuid4
from datetime import datetime

from services.workflow_templates import (
    WorkflowTemplateSystem,
    WorkflowTemplateType
)
from models.workflow import (
    WorkflowDefinition,
    WorkflowStatus,
    StepType,
    ApprovalType
)


class TestWorkflowTemplateSystem:
    """Test suite for WorkflowTemplateSystem"""
    
    @pytest.fixture
    def template_system(self):
        """Create a workflow template system instance"""
        return WorkflowTemplateSystem()
    
    # ==================== Template Retrieval Tests ====================
    
    def test_get_budget_approval_template(self, template_system):
        """Test retrieving budget approval template"""
        template = template_system.get_template(WorkflowTemplateType.BUDGET_APPROVAL)
        
        assert template is not None
        assert template["name"] == "Budget Approval Workflow"
        assert template["template_type"] == WorkflowTemplateType.BUDGET_APPROVAL
        assert len(template["steps"]) == 3
        assert len(template["triggers"]) == 1
        assert template["metadata"]["category"] == "financial"
    
    def test_get_milestone_approval_template(self, template_system):
        """Test retrieving milestone approval template"""
        template = template_system.get_template(WorkflowTemplateType.MILESTONE_APPROVAL)
        
        assert template is not None
        assert template["name"] == "Milestone Approval Workflow"
        assert template["template_type"] == WorkflowTemplateType.MILESTONE_APPROVAL
        assert len(template["steps"]) == 2
        assert template["metadata"]["category"] == "project_management"
    
    def test_get_resource_allocation_template(self, template_system):
        """Test retrieving resource allocation template"""
        template = template_system.get_template(WorkflowTemplateType.RESOURCE_ALLOCATION)
        
        assert template is not None
        assert template["name"] == "Resource Allocation Workflow"
        assert template["template_type"] == WorkflowTemplateType.RESOURCE_ALLOCATION
        assert len(template["steps"]) == 3
        assert template["metadata"]["category"] == "resource_management"
    
    def test_get_nonexistent_template(self, template_system):
        """Test retrieving non-existent template returns None"""
        template = template_system.get_template("nonexistent_template")
        assert template is None
    
    def test_list_templates(self, template_system):
        """Test listing all available templates"""
        templates = template_system.list_templates()
        
        assert len(templates) == 3
        assert all("template_type" in t for t in templates)
        assert all("name" in t for t in templates)
        assert all("description" in t for t in templates)
        assert all("step_count" in t for t in templates)
    
    def test_get_template_metadata(self, template_system):
        """Test retrieving template metadata"""
        metadata = template_system.get_template_metadata(WorkflowTemplateType.BUDGET_APPROVAL)
        
        assert metadata is not None
        assert metadata["template_type"] == WorkflowTemplateType.BUDGET_APPROVAL
        assert metadata["name"] == "Budget Approval Workflow"
        assert "metadata" in metadata
        assert metadata["step_count"] == 3
        assert metadata["trigger_count"] == 1
    
    # ==================== Template Instantiation Tests ====================
    
    def test_instantiate_budget_approval_template(self, template_system):
        """Test instantiating budget approval template"""
        user_id = uuid4()
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            created_by=user_id
        )
        
        assert isinstance(workflow, WorkflowDefinition)
        assert workflow.name == "Budget Approval Workflow"
        assert len(workflow.steps) == 3
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.created_by == user_id
        assert workflow.metadata["template_type"] == WorkflowTemplateType.BUDGET_APPROVAL
    
    def test_instantiate_with_custom_name(self, template_system):
        """Test instantiating template with custom name"""
        custom_name = "Custom Budget Workflow"
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            name=custom_name
        )
        
        assert workflow.name == custom_name
    
    def test_instantiate_milestone_approval_template(self, template_system):
        """Test instantiating milestone approval template"""
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.MILESTONE_APPROVAL
        )
        
        assert isinstance(workflow, WorkflowDefinition)
        assert workflow.name == "Milestone Approval Workflow"
        assert len(workflow.steps) == 2
        assert all(step.step_type == StepType.APPROVAL for step in workflow.steps)
    
    def test_instantiate_resource_allocation_template(self, template_system):
        """Test instantiating resource allocation template"""
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.RESOURCE_ALLOCATION
        )
        
        assert isinstance(workflow, WorkflowDefinition)
        assert workflow.name == "Resource Allocation Workflow"
        assert len(workflow.steps) == 3
        assert len(workflow.triggers) == 1
    
    def test_instantiate_nonexistent_template_raises_error(self, template_system):
        """Test instantiating non-existent template raises ValueError"""
        with pytest.raises(ValueError, match="Template type .* not found"):
            template_system.instantiate_template("nonexistent_template")
    
    def test_instantiated_workflow_has_sequential_steps(self, template_system):
        """Test instantiated workflow has properly ordered steps"""
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL
        )
        
        step_orders = [step.step_order for step in workflow.steps]
        assert step_orders == list(range(len(workflow.steps)))
    
    # ==================== Template Customization Tests ====================
    
    def test_customize_step_timeout(self, template_system):
        """Test customizing step timeout hours"""
        customizations = {
            "steps": {
                0: {"timeout_hours": 24}
            }
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        assert workflow.steps[0].timeout_hours == 24
    
    def test_customize_approver_roles(self, template_system):
        """Test customizing approver roles"""
        customizations = {
            "steps": {
                0: {"approver_roles": ["custom_role", "another_role"]}
            }
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.MILESTONE_APPROVAL,
            customizations=customizations
        )
        
        assert workflow.steps[0].approver_roles == ["custom_role", "another_role"]
    
    def test_customize_approval_type(self, template_system):
        """Test customizing approval type"""
        customizations = {
            "steps": {
                0: {"approval_type": ApprovalType.MAJORITY.value}
            }
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.RESOURCE_ALLOCATION,
            customizations=customizations
        )
        
        assert workflow.steps[0].approval_type == ApprovalType.MAJORITY
    
    def test_customize_trigger_thresholds(self, template_system):
        """Test customizing trigger threshold values"""
        customizations = {
            "triggers": {
                0: {
                    "threshold_values": {
                        "percentage": 15.0,
                        "absolute_amount": 25000.0
                    }
                }
            }
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        assert workflow.triggers[0].threshold_values["percentage"] == 15.0
        assert workflow.triggers[0].threshold_values["absolute_amount"] == 25000.0
    
    def test_customize_workflow_name_and_description(self, template_system):
        """Test customizing workflow name and description"""
        customizations = {
            "name": "Custom Workflow Name",
            "description": "Custom workflow description"
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        assert workflow.name == "Custom Workflow Name"
        assert workflow.description == "Custom workflow description"
    
    def test_customize_template_preview(self, template_system):
        """Test previewing template with customizations"""
        customizations = {
            "steps": {
                0: {"timeout_hours": 36}
            }
        }
        
        customized = template_system.customize_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations
        )
        
        assert customized["steps"][0]["timeout_hours"] == 36
        assert customized["name"] == "Budget Approval Workflow"  # Original name preserved
    
    def test_exclude_steps_customization(self, template_system):
        """Test excluding steps during instantiation"""
        customizations = {
            "excluded_steps": [2]  # Exclude executive approval step
        }
        
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        # Should have 2 steps instead of 3
        assert len(workflow.steps) == 2
        # Steps should be renumbered sequentially
        assert [s.step_order for s in workflow.steps] == [0, 1]
    
    # ==================== Validation Tests ====================
    
    def test_validate_valid_customizations(self, template_system):
        """Test validating valid customizations"""
        customizations = {
            "steps": {
                0: {"timeout_hours": 48}
            }
        }
        
        is_valid, errors = template_system.validate_customizations(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations
        )
        
        assert is_valid is True
        assert len(errors) == 0
    
    def test_validate_invalid_step_index(self, template_system):
        """Test validating customizations with invalid step index"""
        customizations = {
            "steps": {
                99: {"timeout_hours": 48}  # Invalid step index
            }
        }
        
        is_valid, errors = template_system.validate_customizations(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations
        )
        
        assert is_valid is False
        assert len(errors) > 0
        assert any("Invalid step index" in error for error in errors)
    
    def test_validate_nonexistent_template(self, template_system):
        """Test validating customizations for non-existent template"""
        customizations = {"steps": {0: {"timeout_hours": 48}}}
        
        is_valid, errors = template_system.validate_customizations(
            "nonexistent_template",
            customizations
        )
        
        assert is_valid is False
        assert len(errors) > 0
        assert any("not found" in error for error in errors)
    
    # ==================== Template Structure Tests ====================
    
    def test_budget_approval_template_structure(self, template_system):
        """Test budget approval template has correct structure"""
        template = template_system.get_template(WorkflowTemplateType.BUDGET_APPROVAL)
        
        # Check first step (Project Manager)
        assert template["steps"][0]["name"] == "Project Manager Review"
        assert "project_manager" in template["steps"][0]["approver_roles"]
        assert template["steps"][0]["approval_type"] == ApprovalType.ALL.value
        
        # Check second step (Portfolio Manager)
        assert template["steps"][1]["name"] == "Portfolio Manager Approval"
        assert "portfolio_manager" in template["steps"][1]["approver_roles"]
        assert template["steps"][1]["conditions"] is not None
        
        # Check third step (Executive)
        assert template["steps"][2]["name"] == "Executive Approval"
        assert template["steps"][2]["approval_type"] == ApprovalType.ANY.value
    
    def test_milestone_approval_template_structure(self, template_system):
        """Test milestone approval template has correct structure"""
        template = template_system.get_template(WorkflowTemplateType.MILESTONE_APPROVAL)
        
        # Check first step
        assert template["steps"][0]["name"] == "Team Lead Review"
        assert template["steps"][0]["approval_type"] == ApprovalType.ANY.value
        
        # Check second step
        assert template["steps"][1]["name"] == "Stakeholder Approval"
        assert template["steps"][1]["approval_type"] == ApprovalType.MAJORITY.value
        assert template["steps"][1]["conditions"] is not None
    
    def test_resource_allocation_template_structure(self, template_system):
        """Test resource allocation template has correct structure"""
        template = template_system.get_template(WorkflowTemplateType.RESOURCE_ALLOCATION)
        
        # Check all steps have proper structure
        assert all("step_order" in step for step in template["steps"])
        assert all("name" in step for step in template["steps"])
        assert all("approver_roles" in step for step in template["steps"])
        
        # Check triggers
        assert template["triggers"][0]["trigger_type"] == "resource_allocation"
    
    def test_all_templates_have_required_metadata(self, template_system):
        """Test all templates have required metadata fields"""
        required_fields = ["category", "priority", "sla_hours", "customizable_fields"]
        
        for template_type in [
            WorkflowTemplateType.BUDGET_APPROVAL,
            WorkflowTemplateType.MILESTONE_APPROVAL,
            WorkflowTemplateType.RESOURCE_ALLOCATION
        ]:
            template = template_system.get_template(template_type)
            metadata = template["metadata"]
            
            for field in required_fields:
                assert field in metadata, f"Template {template_type} missing {field}"
    
    def test_template_steps_have_notification_templates(self, template_system):
        """Test template steps have notification templates defined"""
        for template_type in [
            WorkflowTemplateType.BUDGET_APPROVAL,
            WorkflowTemplateType.MILESTONE_APPROVAL,
            WorkflowTemplateType.RESOURCE_ALLOCATION
        ]:
            template = template_system.get_template(template_type)
            
            for step in template["steps"]:
                assert "notification_template" in step
                assert step["notification_template"] is not None


class TestTemplateIntegration:
    """Integration tests for workflow template system"""
    
    @pytest.fixture
    def template_system(self):
        """Create a workflow template system instance"""
        return WorkflowTemplateSystem()
    
    def test_create_workflow_from_template_end_to_end(self, template_system):
        """Test complete workflow creation from template"""
        # Instantiate template
        user_id = uuid4()
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            name="Project X Budget Approval",
            created_by=user_id
        )
        
        # Verify workflow is valid
        assert isinstance(workflow, WorkflowDefinition)
        assert workflow.name == "Project X Budget Approval"
        assert workflow.created_by == user_id
        assert workflow.status == WorkflowStatus.DRAFT
        
        # Verify steps are properly configured
        assert len(workflow.steps) > 0
        for idx, step in enumerate(workflow.steps):
            assert step.step_order == idx
            assert step.step_type == StepType.APPROVAL
            assert len(step.approver_roles) > 0
        
        # Verify triggers are configured
        assert len(workflow.triggers) > 0
        for trigger in workflow.triggers:
            assert trigger.trigger_type is not None
            assert trigger.enabled is True
    
    def test_customize_and_instantiate_workflow(self, template_system):
        """Test customizing and instantiating a workflow"""
        # Define customizations
        customizations = {
            "name": "Custom Budget Workflow",
            "steps": {
                0: {
                    "timeout_hours": 24,
                    "approver_roles": ["finance_manager"]
                },
                1: {
                    "timeout_hours": 48
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
        
        # Instantiate with customizations
        workflow = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            customizations=customizations
        )
        
        # Verify customizations were applied
        assert workflow.name == "Custom Budget Workflow"
        assert workflow.steps[0].timeout_hours == 24
        assert workflow.steps[0].approver_roles == ["finance_manager"]
        assert workflow.steps[1].timeout_hours == 48
        assert workflow.triggers[0].threshold_values["percentage"] == 8.0
    
    def test_multiple_template_instantiations_are_independent(self, template_system):
        """Test multiple instantiations don't affect each other"""
        # Create first workflow
        workflow1 = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            name="Workflow 1"
        )
        
        # Create second workflow with customizations
        customizations = {
            "steps": {
                0: {"timeout_hours": 12}
            }
        }
        workflow2 = template_system.instantiate_template(
            WorkflowTemplateType.BUDGET_APPROVAL,
            name="Workflow 2",
            customizations=customizations
        )
        
        # Verify they are independent
        assert workflow1.name != workflow2.name
        assert workflow1.steps[0].timeout_hours != workflow2.steps[0].timeout_hours
        
        # Original template should be unchanged
        template = template_system.get_template(WorkflowTemplateType.BUDGET_APPROVAL)
        assert template["steps"][0]["timeout_hours"] == 48  # Original value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
