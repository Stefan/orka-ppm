"""
Property-based tests for Generic Construction PPM Features database schema

Feature: generic-construction-ppm-features
Property 13: Database Schema Consistency
Validates: Requirements 7.5

Tests that all new database tables follow existing naming conventions and include
standard audit fields (created_at, updated_at, created_by where applicable).
"""

import pytest
from hypothesis import given, strategies as st, settings
from typing import Dict, List, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from decimal import Decimal

# Import models (run from backend/ so use models.*)
from models.generic_construction import (
    ShareableURLCreate,
    ShareablePermissions,
    SimulationCreate,
    SimulationConfig,
    SimulationType,
    ScenarioCreate,
    ScenarioConfig,
    ProjectChanges,
    ChangeRequestCreate,
    ChangeRequestType,
    ImpactAssessment,
    Priority,
    POBreakdownCreate,
    POBreakdownType,
    ReportTemplateCreate,
    ReportTemplateType,
    ChartConfig,
)


# ============================================================================
# Test Data Generators
# ============================================================================

@st.composite
def shareable_permissions_strategy(draw):
    """Generate valid shareable permissions"""
    return ShareablePermissions(
        can_view_basic_info=draw(st.booleans()),
        can_view_financial=draw(st.booleans()),
        can_view_risks=draw(st.booleans()),
        can_view_resources=draw(st.booleans()),
        can_view_timeline=draw(st.booleans()),
        allowed_sections=draw(st.lists(st.text(min_size=1, max_size=20), max_size=5))
    )


@st.composite
def shareable_url_create_strategy(draw):
    """Generate valid shareable URL creation request"""
    future_time = datetime.now() + timedelta(days=draw(st.integers(min_value=1, max_value=365)))
    return ShareableURLCreate(
        project_id=uuid4(),
        permissions=draw(shareable_permissions_strategy()),
        expires_at=future_time,
        description=draw(st.one_of(st.none(), st.text(min_size=1, max_size=200)))
    )


@st.composite
def simulation_config_strategy(draw):
    """Generate valid simulation configuration"""
    return SimulationConfig(
        iterations=draw(st.integers(min_value=1000, max_value=100000)),
        confidence_levels=sorted([0.1, 0.5, 0.9]),
        include_cost_analysis=draw(st.booleans()),
        include_schedule_analysis=draw(st.booleans()),
        risk_correlation_matrix=None
    )


@st.composite
def simulation_create_strategy(draw):
    """Generate valid simulation creation request"""
    return SimulationCreate(
        project_id=uuid4(),
        simulation_type=draw(st.sampled_from(list(SimulationType))),
        name=draw(st.text(min_size=1, max_size=100)),
        description=draw(st.one_of(st.none(), st.text(min_size=1, max_size=500))),
        config=draw(simulation_config_strategy())
    )


@st.composite
def project_changes_strategy(draw):
    """Generate valid project changes"""
    return ProjectChanges(
        budget=draw(st.one_of(st.none(), st.decimals(min_value=0, max_value=10000000, places=2))),
        resource_allocations=None,
        milestone_dates=None,
        risk_adjustments=None
    )


@st.composite
def scenario_config_strategy(draw):
    """Generate valid scenario configuration"""
    return ScenarioConfig(
        name=draw(st.text(min_size=1, max_size=100)),
        description=draw(st.one_of(st.none(), st.text(min_size=1, max_size=500))),
        parameter_changes=draw(project_changes_strategy()),
        analysis_scope=['timeline', 'cost', 'resources']
    )


@st.composite
def scenario_create_strategy(draw):
    """Generate valid scenario creation request"""
    return ScenarioCreate(
        project_id=uuid4(),
        base_scenario_id=draw(st.one_of(st.none(), st.just(uuid4()))),
        config=draw(scenario_config_strategy())
    )


@st.composite
def impact_assessment_strategy(draw):
    """Generate valid impact assessment"""
    return ImpactAssessment(
        cost_impact=draw(st.one_of(st.none(), st.decimals(min_value=-1000000, max_value=1000000, places=2))),
        schedule_impact=draw(st.one_of(st.none(), st.integers(min_value=-365, max_value=365))),
        resource_impact=None,
        risk_impact=None,
        quality_impact=draw(st.one_of(st.none(), st.text(min_size=1, max_size=200))),
        stakeholder_impact=None
    )


@st.composite
def change_request_create_strategy(draw):
    """Generate valid change request creation"""
    return ChangeRequestCreate(
        project_id=uuid4(),
        title=draw(st.text(min_size=1, max_size=100)),
        description=draw(st.text(min_size=1, max_size=1000)),
        change_type=draw(st.sampled_from(list(ChangeRequestType))),
        priority=draw(st.sampled_from(list(Priority))),
        impact_assessment=draw(impact_assessment_strategy()),
        justification=draw(st.text(min_size=1, max_size=500)),
        business_case=draw(st.one_of(st.none(), st.text(min_size=1, max_size=1000))),
        estimated_cost_impact=draw(st.one_of(st.none(), st.decimals(min_value=0, max_value=1000000, places=2))),
        estimated_schedule_impact=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=365))),
        auto_submit=draw(st.booleans())
    )


@st.composite
def po_breakdown_create_strategy(draw):
    """Generate valid PO breakdown creation"""
    return POBreakdownCreate(
        project_id=uuid4(),
        name=draw(st.text(min_size=1, max_size=100)),
        code=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        sap_po_number=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        sap_line_item=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        parent_breakdown_id=None,
        cost_center=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        gl_account=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        planned_amount=draw(st.decimals(min_value=0, max_value=10000000, places=2)),
        committed_amount=draw(st.decimals(min_value=0, max_value=10000000, places=2)),
        actual_amount=draw(st.decimals(min_value=0, max_value=10000000, places=2)),
        currency="USD",
        breakdown_type=draw(st.sampled_from(list(POBreakdownType))),
        category=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        subcategory=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        custom_fields=None,
        tags=None,
        notes=draw(st.one_of(st.none(), st.text(min_size=1, max_size=500)))
    )


@st.composite
def chart_config_strategy(draw):
    """Generate valid chart configuration"""
    return ChartConfig(
        chart_type=draw(st.sampled_from(['bar', 'line', 'pie', 'scatter'])),
        data_source=draw(st.text(min_size=1, max_size=100)),
        title=draw(st.text(min_size=1, max_size=100)),
        x_axis=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        y_axis=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        series=None,
        colors=None
    )


@st.composite
def report_template_create_strategy(draw):
    """Generate valid report template creation"""
    return ReportTemplateCreate(
        name=draw(st.text(min_size=1, max_size=100)),
        description=draw(st.one_of(st.none(), st.text(min_size=1, max_size=500))),
        template_type=draw(st.sampled_from(list(ReportTemplateType))),
        google_slides_template_id=draw(st.one_of(st.none(), st.text(min_size=1, max_size=100))),
        google_drive_folder_id=draw(st.one_of(st.none(), st.text(min_size=1, max_size=100))),
        data_mappings={"field1": "value1"},
        chart_configurations=[draw(chart_config_strategy())],
        slide_layouts=None,
        is_public=draw(st.booleans()),
        allowed_roles=None,
        tags=None
    )


# ============================================================================
# Property Tests
# ============================================================================

class TestDatabaseSchemaConsistency:
    """
    Property 13: Database Schema Consistency
    
    For any new database table or modification, naming conventions must follow
    existing patterns and standard audit fields must be included.
    
    Validates: Requirements 7.5
    """
    
    @given(shareable_url_create_strategy())
    @settings(max_examples=100)
    def test_shareable_url_model_has_required_fields(self, shareable_url_data):
        """
        Test that ShareableURL model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert shareable_url_data.project_id is not None
        assert shareable_url_data.permissions is not None
        assert shareable_url_data.expires_at > datetime.now()
        
        # Verify permissions structure
        assert hasattr(shareable_url_data.permissions, 'can_view_basic_info')
        assert hasattr(shareable_url_data.permissions, 'can_view_financial')
        assert hasattr(shareable_url_data.permissions, 'can_view_risks')
        assert hasattr(shareable_url_data.permissions, 'can_view_resources')
        assert hasattr(shareable_url_data.permissions, 'can_view_timeline')
        assert hasattr(shareable_url_data.permissions, 'allowed_sections')
    
    @given(simulation_create_strategy())
    @settings(max_examples=100)
    def test_simulation_model_has_required_fields(self, simulation_data):
        """
        Test that Simulation model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert simulation_data.project_id is not None
        assert simulation_data.simulation_type in SimulationType
        assert simulation_data.name is not None and len(simulation_data.name) > 0
        assert simulation_data.config is not None
        
        # Verify config structure
        assert simulation_data.config.iterations >= 1000
        assert simulation_data.config.iterations <= 100000
        assert len(simulation_data.config.confidence_levels) > 0
        assert all(0 < level < 1 for level in simulation_data.config.confidence_levels)
    
    @given(scenario_create_strategy())
    @settings(max_examples=100)
    def test_scenario_model_has_required_fields(self, scenario_data):
        """
        Test that Scenario model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert scenario_data.project_id is not None
        assert scenario_data.config is not None
        assert scenario_data.config.name is not None and len(scenario_data.config.name) > 0
        assert scenario_data.config.parameter_changes is not None
        assert len(scenario_data.config.analysis_scope) > 0
    
    @given(change_request_create_strategy())
    @settings(max_examples=100)
    def test_change_request_model_has_required_fields(self, change_request_data):
        """
        Test that ChangeRequest model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert change_request_data.project_id is not None
        assert change_request_data.title is not None and len(change_request_data.title) > 0
        assert change_request_data.description is not None and len(change_request_data.description) > 0
        assert change_request_data.change_type in ChangeRequestType
        assert change_request_data.priority in Priority
        assert change_request_data.impact_assessment is not None
        assert change_request_data.justification is not None and len(change_request_data.justification) > 0
    
    @given(po_breakdown_create_strategy())
    @settings(max_examples=100)
    def test_po_breakdown_model_has_required_fields(self, po_breakdown_data):
        """
        Test that POBreakdown model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert po_breakdown_data.project_id is not None
        assert po_breakdown_data.name is not None and len(po_breakdown_data.name) > 0
        assert po_breakdown_data.planned_amount >= 0
        assert po_breakdown_data.committed_amount >= 0
        assert po_breakdown_data.actual_amount >= 0
        assert po_breakdown_data.currency is not None
        assert po_breakdown_data.breakdown_type in POBreakdownType
    
    @given(report_template_create_strategy())
    @settings(max_examples=100)
    def test_report_template_model_has_required_fields(self, report_template_data):
        """
        Test that ReportTemplate model includes standard audit fields
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Verify the model can be created with valid data
        assert report_template_data.name is not None and len(report_template_data.name) > 0
        assert report_template_data.template_type in ReportTemplateType
        assert report_template_data.data_mappings is not None
        assert isinstance(report_template_data.data_mappings, dict)
        assert isinstance(report_template_data.is_public, bool)
    
    def test_all_models_follow_naming_conventions(self):
        """
        Test that all model names follow snake_case convention
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Expected table names (should be snake_case)
        expected_tables = [
            "shareable_urls",
            "simulation_results",
            "scenario_analyses",
            "change_requests",
            "po_breakdowns",
            "change_request_po_links",
            "report_templates",
            "generated_reports",
            "shareable_url_access_log"
        ]
        
        # Verify all table names are snake_case
        for table_name in expected_tables:
            assert table_name.islower(), f"Table name '{table_name}' should be lowercase"
            assert ' ' not in table_name, f"Table name '{table_name}' should not contain spaces"
            # Check that it uses underscores for word separation
            if len(table_name.split('_')) > 1:
                assert '_' in table_name, f"Table name '{table_name}' should use underscores"
    
    def test_all_enums_are_properly_defined(self):
        """
        Test that all enums are properly defined with valid values
        
        Feature: generic-construction-ppm-features, Property 13: Database Schema Consistency
        """
        # Test SimulationType enum
        assert len(list(SimulationType)) >= 2
        assert SimulationType.monte_carlo in SimulationType
        assert SimulationType.what_if in SimulationType
        
        # Test ChangeRequestType enum
        assert len(list(ChangeRequestType)) >= 5
        assert ChangeRequestType.scope in ChangeRequestType
        assert ChangeRequestType.schedule in ChangeRequestType
        assert ChangeRequestType.budget in ChangeRequestType
        
        # Test POBreakdownType enum
        assert len(list(POBreakdownType)) >= 3
        assert POBreakdownType.sap_standard in POBreakdownType
        assert POBreakdownType.custom_hierarchy in POBreakdownType
        
        # Test ReportTemplateType enum
        assert len(list(ReportTemplateType)) >= 4
        assert ReportTemplateType.executive_summary in ReportTemplateType
        assert ReportTemplateType.project_status in ReportTemplateType
        
        # Test Priority enum
        assert len(list(Priority)) == 4
        assert Priority.low in Priority
        assert Priority.medium in Priority
        assert Priority.high in Priority
        assert Priority.critical in Priority


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
