"""
Property-Based Tests for Workflow PPM Integration

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

Property 22: Automatic Trigger Reliability
For any PPM event meeting trigger conditions, workflows must be initiated
automatically and reliably without omission.

Property 23: PPM System Integration Consistency
For any workflow triggered by PPM events, the workflow context must accurately
reflect the triggering event and maintain data consistency with the PPM system.

This test suite uses Hypothesis to generate random PPM events and verify
that workflow triggers work correctly and consistently.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import datetime
from uuid import uuid4, UUID
from unittest.mock import Mock, AsyncMock, patch
from decimal import Decimal

from services.workflow_ppm_integration import WorkflowPPMIntegration


# ==================== Hypothesis Strategies ====================

@st.composite
def budget_change_strategy(draw):
    """Generate valid budget change scenarios"""
    old_budget = draw(st.decimals(
        min_value=Decimal("1000"),
        max_value=Decimal("10000000"),
        places=2
    ))
    
    # Generate variance between -50% and +100%
    variance_factor = draw(st.floats(min_value=0.5, max_value=2.0))
    new_budget = old_budget * Decimal(str(variance_factor))
    
    return {
        "project_id": str(uuid4()),
        "old_budget": old_budget,
        "new_budget": new_budget,
        "variance_threshold_percent": draw(st.floats(min_value=5.0, max_value=25.0)),
        "initiated_by": uuid4()
    }


@st.composite
def milestone_event_strategy(draw):
    """Generate valid milestone event scenarios"""
    return {
        "milestone_id": str(uuid4()),
        "project_id": str(uuid4()),
        "milestone_type": draw(st.sampled_from([
            "project_start", "phase_completion", "deliverable",
            "review_point", "project_end"
        ])),
        "initiated_by": uuid4()
    }


@st.composite
def resource_allocation_strategy(draw):
    """Generate valid resource allocation scenarios"""
    return {
        "allocation_id": str(uuid4()),
        "resource_id": str(uuid4()),
        "project_id": str(uuid4()),
        "allocation_percentage": draw(st.floats(min_value=0.0, max_value=100.0)),
        "initiated_by": uuid4()
    }


@st.composite
def risk_event_strategy(draw):
    """Generate valid risk event scenarios"""
    return {
        "risk_id": str(uuid4()),
        "project_id": str(uuid4()),
        "risk_level": draw(st.sampled_from(["low", "medium", "high", "critical"])),
        "change_type": draw(st.sampled_from([
            "scope_change", "schedule_change", "budget_change",
            "resource_change", "quality_change"
        ])),
        "initiated_by": uuid4()
    }


# ==================== Property Tests ====================

class TestWorkflowAutomaticTriggerReliability:
    """
    Property-Based Tests for Automatic Workflow Triggers
    
    Feature: workflow-engine, Property 22: Automatic Trigger Reliability
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @pytest.fixture
    def ppm_integration(self, mock_db):
        """Create PPM integration service with mock database"""
        with patch('services.workflow_ppm_integration.supabase', mock_db):
            return WorkflowPPMIntegration()
    
    @given(budget_data=budget_change_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_budget_trigger_threshold_reliability(
        self,
        budget_data,
        mock_db
    ):
        """
        Property 22.1: Budget workflows must trigger reliably when thresholds exceeded
        
        For any budget change exceeding the threshold, a workflow must be
        initiated automatically.
        
        **Validates: Requirements 7.1, 7.4**
        """
        # Calculate expected variance
        old_budget = budget_data["old_budget"]
        new_budget = budget_data["new_budget"]
        threshold = budget_data["variance_threshold_percent"]
        
        if old_budget == 0:
            variance_percent = 100.0 if new_budget > 0 else 0.0
        else:
            variance_percent = abs((new_budget - old_budget) / old_budget * 100)
        
        # Mock database responses
        mock_project = {
            "id": budget_data["project_id"],
            "name": "Test Project",
            "created_by": str(uuid4())
        }
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        # Mock workflow template
        mock_template = Mock()
        mock_template.name = "Budget Approval"
        mock_template.steps = []
        
        # Mock workflow engine
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(return_value=uuid4())
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_project_result
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            result = await service.monitor_budget_changes(
                project_id=budget_data["project_id"],
                old_budget=old_budget,
                new_budget=new_budget,
                variance_threshold_percent=threshold,
                initiated_by=budget_data["initiated_by"]
            )
        
        # Property: Workflow must be triggered if and only if variance exceeds threshold
        if variance_percent >= threshold:
            assert result is not None, \
                f"Workflow should be triggered: variance={variance_percent:.2f}% >= threshold={threshold}%"
            assert mock_engine.create_workflow_instance.called, \
                "Workflow engine should be called when threshold exceeded"
        else:
            assert result is None, \
                f"Workflow should not be triggered: variance={variance_percent:.2f}% < threshold={threshold}%"
    
    @given(milestone_data=milestone_event_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_milestone_trigger_reliability(
        self,
        milestone_data,
        mock_db
    ):
        """
        Property 22.2: Milestone workflows must trigger reliably for updates
        
        For any milestone update event, a workflow must be initiated if
        configured for that milestone type.
        
        **Validates: Requirements 7.2**
        """
        # Mock database responses
        mock_milestone = {
            "id": milestone_data["milestone_id"],
            "name": "Test Milestone",
            "type": milestone_data["milestone_type"]
        }
        
        mock_project = {
            "id": milestone_data["project_id"],
            "name": "Test Project"
        }
        
        mock_milestone_result = Mock()
        mock_milestone_result.data = [mock_milestone]
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        # Mock workflow template
        mock_template = Mock()
        mock_template.name = "Milestone Approval"
        mock_template.steps = []
        
        # Mock workflow engine
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(return_value=uuid4())
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            # Set up mock to return different results based on table
            def mock_table_select(table_name):
                table_mock = Mock()
                if table_name == "milestones":
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_milestone_result
                else:  # projects
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_project_result
                return table_mock
            
            mock_db.table.side_effect = lambda name: mock_table_select(name)
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            result = await service.trigger_milestone_approval(
                milestone_id=milestone_data["milestone_id"],
                project_id=milestone_data["project_id"],
                milestone_type=milestone_data["milestone_type"],
                initiated_by=milestone_data["initiated_by"]
            )
        
        # Property: Workflow must be triggered for milestone updates
        assert result is not None, "Workflow should be triggered for milestone update"
        assert mock_engine.create_workflow_instance.called, \
            "Workflow engine should be called for milestone update"
    
    @given(resource_data=resource_allocation_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_resource_allocation_trigger_threshold(
        self,
        resource_data,
        mock_db
    ):
        """
        Property 22.3: Resource allocation workflows must trigger based on impact
        
        For any resource allocation change, a workflow must be initiated if
        the allocation percentage exceeds the threshold (>50%).
        
        **Validates: Requirements 7.3**
        """
        allocation_percentage = resource_data["allocation_percentage"]
        
        # Mock database responses
        mock_resource = {
            "id": resource_data["resource_id"],
            "name": "Test Resource"
        }
        
        mock_project = {
            "id": resource_data["project_id"],
            "name": "Test Project"
        }
        
        mock_resource_result = Mock()
        mock_resource_result.data = [mock_resource]
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        # Mock workflow template
        mock_template = Mock()
        mock_template.name = "Resource Allocation"
        mock_template.steps = []
        
        # Mock workflow engine
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(return_value=uuid4())
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            # Set up mock to return different results based on table
            def mock_table_select(table_name):
                table_mock = Mock()
                if table_name == "resources":
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_resource_result
                else:  # projects
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_project_result
                return table_mock
            
            mock_db.table.side_effect = lambda name: mock_table_select(name)
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            result = await service.trigger_resource_allocation_approval(
                allocation_id=resource_data["allocation_id"],
                resource_id=resource_data["resource_id"],
                project_id=resource_data["project_id"],
                allocation_percentage=allocation_percentage,
                initiated_by=resource_data["initiated_by"]
            )
        
        # Property: Workflow must be triggered if and only if allocation > 50%
        if allocation_percentage > 50.0:
            assert result is not None, \
                f"Workflow should be triggered: allocation={allocation_percentage}% > 50%"
            assert mock_engine.create_workflow_instance.called, \
                "Workflow engine should be called for high allocation"
        else:
            assert result is None, \
                f"Workflow should not be triggered: allocation={allocation_percentage}% <= 50%"
    
    @given(risk_data=risk_event_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_risk_based_trigger_reliability(
        self,
        risk_data,
        mock_db
    ):
        """
        Property 22.4: Risk-based workflows must trigger for high-risk changes
        
        For any high or critical risk event, a workflow must be initiated
        automatically.
        
        **Validates: Requirements 7.5**
        """
        risk_level = risk_data["risk_level"]
        
        # Mock database responses
        mock_risk = {
            "id": risk_data["risk_id"],
            "title": "Test Risk",
            "level": risk_level
        }
        
        mock_project = {
            "id": risk_data["project_id"],
            "name": "Test Project"
        }
        
        mock_risk_result = Mock()
        mock_risk_result.data = [mock_risk]
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        # Mock workflow template
        mock_template = Mock()
        mock_template.name = "Risk Approval"
        mock_template.steps = []
        
        # Mock workflow engine
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(return_value=uuid4())
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            # Set up mock to return different results based on table
            def mock_table_select(table_name):
                table_mock = Mock()
                if table_name == "risks":
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_risk_result
                else:  # projects
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_project_result
                return table_mock
            
            mock_db.table.side_effect = lambda name: mock_table_select(name)
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            result = await service.trigger_risk_based_approval(
                risk_id=risk_data["risk_id"],
                project_id=risk_data["project_id"],
                risk_level=risk_level,
                change_type=risk_data["change_type"],
                initiated_by=risk_data["initiated_by"]
            )
        
        # Property: Workflow must be triggered if and only if risk is high or critical
        if risk_level.lower() in ["high", "critical"]:
            assert result is not None, \
                f"Workflow should be triggered for {risk_level} risk"
            assert mock_engine.create_workflow_instance.called, \
                "Workflow engine should be called for high/critical risk"
        else:
            assert result is None, \
                f"Workflow should not be triggered for {risk_level} risk"


class TestWorkflowPPMIntegrationConsistency:
    """
    Property-Based Tests for PPM Integration Data Consistency
    
    Feature: workflow-engine, Property 23: PPM System Integration Consistency
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client"""
        db = Mock()
        db.table = Mock(return_value=Mock())
        return db
    
    @given(budget_data=budget_change_strategy())
    @settings(
        max_examples=50,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_budget_workflow_context_accuracy(
        self,
        budget_data,
        mock_db
    ):
        """
        Property 23.1: Budget workflow context must accurately reflect trigger event
        
        For any budget-triggered workflow, the workflow context must contain
        accurate budget data matching the triggering event.
        
        **Validates: Requirements 7.1, 7.4**
        """
        # Ensure variance exceeds threshold
        assume(abs((budget_data["new_budget"] - budget_data["old_budget"]) / budget_data["old_budget"] * 100) >= budget_data["variance_threshold_percent"])
        
        # Mock database responses
        mock_project = {
            "id": budget_data["project_id"],
            "name": "Test Project",
            "created_by": str(uuid4())
        }
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        # Mock workflow template
        mock_template = Mock()
        mock_template.name = "Budget Approval"
        mock_template.steps = []
        
        # Capture workflow context
        captured_context = {}
        
        async def capture_context(*args, **kwargs):
            captured_context.update(kwargs.get("context", {}))
            return uuid4()
        
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(side_effect=capture_context)
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_project_result
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            await service.monitor_budget_changes(
                project_id=budget_data["project_id"],
                old_budget=budget_data["old_budget"],
                new_budget=budget_data["new_budget"],
                variance_threshold_percent=budget_data["variance_threshold_percent"],
                initiated_by=budget_data["initiated_by"]
            )
        
        # Property: Context must contain accurate budget data
        assert "old_budget" in captured_context, "Context must include old_budget"
        assert "new_budget" in captured_context, "Context must include new_budget"
        assert "variance_amount" in captured_context, "Context must include variance_amount"
        assert "variance_percent" in captured_context, "Context must include variance_percent"
        assert "trigger_type" in captured_context, "Context must include trigger_type"
        
        # Verify accuracy
        assert captured_context["old_budget"] == str(budget_data["old_budget"]), \
            "Old budget in context must match input"
        assert captured_context["new_budget"] == str(budget_data["new_budget"]), \
            "New budget in context must match input"
        assert captured_context["trigger_type"] == "budget_change", \
            "Trigger type must be budget_change"
    
    @given(
        milestone_data=milestone_event_strategy(),
        resource_data=resource_allocation_strategy()
    )
    @settings(
        max_examples=30,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_workflow_entity_type_consistency(
        self,
        milestone_data,
        resource_data,
        mock_db
    ):
        """
        Property 23.2: Workflow entity types must match triggering PPM entity
        
        For any PPM-triggered workflow, the entity_type must correctly
        identify the type of PPM entity that triggered it.
        
        **Validates: Requirements 7.2, 7.3**
        """
        # Test milestone trigger
        mock_milestone = {
            "id": milestone_data["milestone_id"],
            "name": "Test Milestone"
        }
        
        mock_project = {
            "id": milestone_data["project_id"],
            "name": "Test Project"
        }
        
        mock_milestone_result = Mock()
        mock_milestone_result.data = [mock_milestone]
        
        mock_project_result = Mock()
        mock_project_result.data = [mock_project]
        
        mock_template = Mock()
        mock_template.name = "Milestone Approval"
        mock_template.steps = []
        
        # Capture entity type
        captured_entity_type = {}
        
        async def capture_entity_type(*args, **kwargs):
            captured_entity_type["type"] = kwargs.get("entity_type")
            captured_entity_type["id"] = kwargs.get("entity_id")
            return uuid4()
        
        mock_engine = Mock()
        mock_engine.create_workflow_instance = AsyncMock(side_effect=capture_entity_type)
        
        with patch('services.workflow_ppm_integration.supabase', mock_db), \
             patch('services.workflow_ppm_integration.workflow_template_system') as mock_template_system, \
             patch('services.workflow_ppm_integration.WorkflowEngineCore', return_value=mock_engine):
            
            def mock_table_select(table_name):
                table_mock = Mock()
                if table_name == "milestones":
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_milestone_result
                else:
                    table_mock.select.return_value.eq.return_value.execute.return_value = mock_project_result
                return table_mock
            
            mock_db.table.side_effect = lambda name: mock_table_select(name)
            mock_template_system.get_template.return_value = mock_template
            mock_template_system.customize_template.return_value = mock_template
            
            service = WorkflowPPMIntegration()
            
            await service.trigger_milestone_approval(
                milestone_id=milestone_data["milestone_id"],
                project_id=milestone_data["project_id"],
                milestone_type=milestone_data["milestone_type"],
                initiated_by=milestone_data["initiated_by"]
            )
        
        # Property: Entity type must be "milestone" for milestone triggers
        assert captured_entity_type["type"] == "milestone", \
            "Entity type must be 'milestone' for milestone-triggered workflows"
        assert str(captured_entity_type["id"]) == milestone_data["milestone_id"], \
            "Entity ID must match milestone ID"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--hypothesis-show-statistics"])
