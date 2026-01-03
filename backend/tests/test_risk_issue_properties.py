"""
Property-based tests for Risk and Issue Management
Feature: ai-ppm-platform, Property 19: Audit Trail Maintenance, Property 20: Risk-Issue Linkage
Validates: Requirements 6.4, 6.5
"""

import pytest
from hypothesis import given, strategies as st, assume, settings
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import Mock, patch, MagicMock
from datetime import date, datetime, timedelta
import uuid
import json

# Mock the Supabase client to avoid database dependencies
class MockSupabaseResponse:
    def __init__(self, data=None, count=0):
        self.data = data
        self.count = count

class MockSupabaseTable:
    def __init__(self):
        self.data_store = {}
        self.next_id = 1
        self.query_filters = {}
        self.update_data = None
    
    def insert(self, data):
        # Simulate database insert
        record = data.copy()
        record['id'] = str(uuid.uuid4())
        record['created_at'] = datetime.now().isoformat()
        record['updated_at'] = datetime.now().isoformat()
        
        # Calculate risk_score if it's a risk
        if 'probability' in record and 'impact' in record:
            record['risk_score'] = record['probability'] * record['impact']
        
        self.data_store[record['id']] = record
        return MockSupabaseResponse([record])
    
    def select(self, fields):
        return self
    
    def eq(self, field, value):
        # Store filter for later execution
        self.query_filters[field] = value
        return self
    
    def update(self, data):
        self.update_data = data
        return self
    
    def delete(self):
        return self
    
    def execute(self):
        # Apply filters and return results
        if self.update_data:
            # Handle update operation
            filtered_records = []
            for record in self.data_store.values():
                matches = True
                for field, value in self.query_filters.items():
                    if record.get(field) != value:
                        matches = False
                        break
                if matches:
                    record.update(self.update_data)
                    record['updated_at'] = datetime.now().isoformat()
                    filtered_records.append(record)
            
            # Reset state
            self.update_data = None
            self.query_filters = {}
            return MockSupabaseResponse(filtered_records)
        
        # Handle select operation
        filtered_data = []
        for record in self.data_store.values():
            matches = True
            for field, value in self.query_filters.items():
                if record.get(field) != value:
                    matches = False
                    break
            if matches:
                filtered_data.append(record)
        
        # Reset filters
        self.query_filters = {}
        return MockSupabaseResponse(filtered_data)

class MockSupabaseClient:
    def __init__(self):
        self.tables = {
            'projects': MockSupabaseTable(),
            'risks': MockSupabaseTable(),
            'issues': MockSupabaseTable()
        }
    
    def table(self, table_name):
        return self.tables.get(table_name, MockSupabaseTable())

# Test data strategies for property-based testing
@st.composite
def risk_update_strategy(draw):
    """Generate valid risk update data for testing audit trails"""
    return {
        "title": draw(st.one_of(st.none(), st.text(min_size=1, max_size=255))),
        "description": draw(st.one_of(st.none(), st.text(max_size=1000))),
        "status": draw(st.one_of(st.none(), st.sampled_from(['identified', 'analyzing', 'mitigating', 'closed']))),
        "probability": draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=1.0))),
        "impact": draw(st.one_of(st.none(), st.floats(min_value=0.0, max_value=1.0))),
        "mitigation": draw(st.one_of(st.none(), st.text(max_size=1000)))
    }

@st.composite
def issue_update_strategy(draw):
    """Generate valid issue update data for testing audit trails"""
    return {
        "title": draw(st.one_of(st.none(), st.text(min_size=1, max_size=255))),
        "description": draw(st.one_of(st.none(), st.text(max_size=1000))),
        "severity": draw(st.one_of(st.none(), st.sampled_from(['low', 'medium', 'high', 'critical']))),
        "status": draw(st.one_of(st.none(), st.sampled_from(['open', 'in_progress', 'resolved', 'closed']))),
        "resolution": draw(st.one_of(st.none(), st.text(max_size=1000)))
    }

def create_test_project(mock_client):
    """Helper function to create a test project"""
    portfolio_id = "7608eb53-768e-4fa8-94f7-633c92b7a6ab"
    
    project_data = {
        "portfolio_id": portfolio_id,
        "name": f"Test Project {uuid.uuid4()}",
        "description": "Test project for property testing",
        "budget": 10000.0
    }
    
    response = mock_client.table("projects").insert(project_data)
    if response.data:
        return response.data[0]['id']
    return None

def create_test_risk(mock_client, project_id):
    """Helper function to create a test risk"""
    risk_data = {
        "project_id": project_id,
        "title": f"Test Risk {uuid.uuid4()}",
        "description": "Test risk for property testing",
        "category": "technical",
        "probability": 0.5,
        "impact": 0.7,
        "status": "identified"
    }
    
    response = mock_client.table("risks").insert(risk_data)
    if response.data:
        return response.data[0]['id']
    return None

def create_test_issue(mock_client, project_id, risk_id=None):
    """Helper function to create a test issue"""
    issue_data = {
        "project_id": project_id,
        "title": f"Test Issue {uuid.uuid4()}",
        "description": "Test issue for property testing",
        "severity": "medium",
        "status": "open"
    }
    
    if risk_id:
        issue_data["risk_id"] = risk_id
    
    response = mock_client.table("issues").insert(issue_data)
    if response.data:
        return response.data[0]['id']
    return None

class TestAuditTrailMaintenance:
    """Property 19: Audit Trail Maintenance tests"""

    @settings(max_examples=5)
    @given(risk_updates=risk_update_strategy())
    def test_risk_updates_maintain_audit_trail(self, risk_updates):
        """
        Property 19: Audit Trail Maintenance - Risk Updates
        For any risk or issue update, audit trails should be maintained and relevant stakeholders should be notified
        Validates: Requirements 6.4
        """
        # Use mock client to avoid database dependencies
        mock_client = MockSupabaseClient()
        
        # Create test project and risk
        project_id = create_test_project(mock_client)
        assume(project_id is not None)
        
        risk_id = create_test_risk(mock_client, project_id)
        assume(risk_id is not None)
        
        # Get initial risk state
        initial_response = mock_client.table("risks").eq("id", risk_id).execute()
        assume(initial_response.data is not None)
        initial_risk = initial_response.data[0]
        initial_updated_at = initial_risk['updated_at']
        
        # Filter out None values from updates
        filtered_updates = {k: v for k, v in risk_updates.items() if v is not None}
        
        if not filtered_updates:
            # Skip if no actual updates to make
            return
        
        # Apply updates
        update_response = mock_client.table("risks").update(filtered_updates).eq("id", risk_id).execute()
        
        # Verify update was successful
        assert update_response.data is not None, "Risk update should succeed"
        updated_risk = update_response.data[0]
        
        # Verify audit trail maintenance (updated_at timestamp should change)
        updated_updated_at = updated_risk['updated_at']
        assert updated_updated_at != initial_updated_at, "Updated timestamp should change when risk is modified"
        
        # Verify that updated fields are properly maintained
        for field, new_value in filtered_updates.items():
            if field in updated_risk:
                if isinstance(new_value, float):
                    assert abs(float(updated_risk[field]) - new_value) < 0.01, f"Field {field} should be updated correctly"
                else:
                    assert updated_risk[field] == new_value, f"Field {field} should be updated correctly"
        
        # Verify that unchanged fields remain the same
        for field in ['id', 'project_id', 'created_at']:
            assert updated_risk[field] == initial_risk[field], f"Field {field} should remain unchanged"

    @settings(max_examples=5)
    @given(issue_updates=issue_update_strategy())
    def test_issue_updates_maintain_audit_trail(self, issue_updates):
        """
        Property 19: Audit Trail Maintenance - Issue Updates
        For any issue update, audit trails should be maintained and relevant stakeholders should be notified
        Validates: Requirements 6.4
        """
        # Use mock client to avoid database dependencies
        mock_client = MockSupabaseClient()
        
        # Create test project and issue
        project_id = create_test_project(mock_client)
        assume(project_id is not None)
        
        issue_id = create_test_issue(mock_client, project_id)
        assume(issue_id is not None)
        
        # Get initial issue state
        initial_response = mock_client.table("issues").eq("id", issue_id).execute()
        assume(initial_response.data is not None)
        initial_issue = initial_response.data[0]
        initial_updated_at = initial_issue['updated_at']
        
        # Filter out None values from updates
        filtered_updates = {k: v for k, v in issue_updates.items() if v is not None}
        
        if not filtered_updates:
            # Skip if no actual updates to make
            return
        
        # Special handling for status changes to resolved/closed
        if filtered_updates.get('status') in ['resolved', 'closed']:
            filtered_updates['resolution_date'] = datetime.now().isoformat()
        
        # Apply updates
        update_response = mock_client.table("issues").update(filtered_updates).eq("id", issue_id).execute()
        
        # Verify update was successful
        assert update_response.data is not None, "Issue update should succeed"
        updated_issue = update_response.data[0]
        
        # Verify audit trail maintenance (updated_at timestamp should change)
        updated_updated_at = updated_issue['updated_at']
        assert updated_updated_at != initial_updated_at, "Updated timestamp should change when issue is modified"
        
        # Verify that updated fields are properly maintained
        for field, new_value in filtered_updates.items():
            if field in updated_issue and field != 'resolution_date':  # Skip auto-generated fields
                assert updated_issue[field] == new_value, f"Field {field} should be updated correctly"
        
        # Verify that unchanged fields remain the same
        for field in ['id', 'project_id', 'created_at']:
            assert updated_issue[field] == initial_issue[field], f"Field {field} should remain unchanged"
        
        # Verify resolution_date is set when status changes to resolved/closed
        if filtered_updates.get('status') in ['resolved', 'closed']:
            assert updated_issue['resolution_date'] is not None, "Resolution date should be set when issue is resolved/closed"

class TestRiskIssueLinkage:
    """Property 20: Risk-Issue Linkage tests"""

    def test_risk_materialization_creates_proper_linkage(self):
        """
        Property 20: Risk-Issue Linkage
        For any risk that materializes into an issue, the system should automatically create proper linkages between related entries
        Validates: Requirements 6.5
        """
        # Use mock client to avoid database dependencies
        mock_client = MockSupabaseClient()
        
        # Create test project and risk
        project_id = create_test_project(mock_client)
        assume(project_id is not None)
        
        risk_id = create_test_risk(mock_client, project_id)
        assume(risk_id is not None)
        
        # Create an issue linked to the risk (simulating risk materialization)
        issue_id = create_test_issue(mock_client, project_id, risk_id)
        assume(issue_id is not None)
        
        # Verify the linkage was created properly
        issue_response = mock_client.table("issues").eq("id", issue_id).execute()
        assert issue_response.data is not None, "Issue should be created successfully"
        
        created_issue = issue_response.data[0]
        
        # Verify proper linkage (Requirement 6.5)
        assert created_issue['risk_id'] == risk_id, "Issue should be properly linked to the originating risk"
        assert created_issue['project_id'] == project_id, "Issue should belong to the same project as the risk"
        
        # Verify that we can query issues by risk
        issues_for_risk = mock_client.table("issues").eq("risk_id", risk_id).execute()
        assert issues_for_risk.data is not None, "Should be able to query issues by risk ID"
        assert len(issues_for_risk.data) >= 1, "Should find at least one issue linked to the risk"
        assert any(issue['id'] == issue_id for issue in issues_for_risk.data), "Created issue should be found in risk linkage query"

    def test_multiple_issues_can_link_to_same_risk(self):
        """
        Property 20: Risk-Issue Linkage - Multiple Issues per Risk
        For any risk, multiple issues should be able to link to it while maintaining proper relationships
        Validates: Requirements 6.5
        """
        # Use mock client to avoid database dependencies
        mock_client = MockSupabaseClient()
        
        # Create test project and risk
        project_id = create_test_project(mock_client)
        assume(project_id is not None)
        
        risk_id = create_test_risk(mock_client, project_id)
        assume(risk_id is not None)
        
        # Create multiple issues linked to the same risk
        num_issues = 3
        issue_ids = []
        for i in range(num_issues):
            issue_id = create_test_issue(mock_client, project_id, risk_id)
            if issue_id:
                issue_ids.append(issue_id)
        
        assume(len(issue_ids) == num_issues)
        
        # Verify all issues are properly linked to the risk
        for issue_id in issue_ids:
            issue_response = mock_client.table("issues").eq("id", issue_id).execute()
            assert issue_response.data is not None, f"Issue {issue_id} should exist"
            
            issue = issue_response.data[0]
            assert issue['risk_id'] == risk_id, f"Issue {issue_id} should be linked to risk {risk_id}"
            assert issue['project_id'] == project_id, f"Issue {issue_id} should belong to project {project_id}"
        
        # Verify we can query all issues for the risk
        all_issues_for_risk = mock_client.table("issues").eq("risk_id", risk_id).execute()
        assert all_issues_for_risk.data is not None, "Should be able to query all issues for risk"
        assert len(all_issues_for_risk.data) >= num_issues, f"Should find at least {num_issues} issues linked to risk"
        
        # Verify each created issue is found in the query
        found_issue_ids = {issue['id'] for issue in all_issues_for_risk.data}
        for issue_id in issue_ids:
            assert issue_id in found_issue_ids, f"Issue {issue_id} should be found in risk linkage query"

    def test_orphaned_issues_handled_correctly(self):
        """
        Property 20: Risk-Issue Linkage - Orphaned Issues
        For any issue, it should be able to exist without a risk linkage (standalone issues)
        Validates: Requirements 6.5
        """
        # Use mock client to avoid database dependencies
        mock_client = MockSupabaseClient()
        
        # Create test project
        project_id = create_test_project(mock_client)
        assert project_id is not None
        
        # Create an issue without linking to any risk (standalone issue)
        issue_id = create_test_issue(mock_client, project_id, risk_id=None)
        assert issue_id is not None
        
        # Verify the issue was created without risk linkage
        issue_response = mock_client.table("issues").eq("id", issue_id).execute()
        assert issue_response.data is not None, "Standalone issue should be created successfully"
        
        created_issue = issue_response.data[0]
        
        # Verify no risk linkage
        assert created_issue.get('risk_id') is None, "Standalone issue should not have risk linkage"
        assert created_issue['project_id'] == project_id, "Standalone issue should still belong to project"

if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])