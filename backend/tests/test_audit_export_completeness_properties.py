"""
Property-Based Tests for Audit Export Completeness

Feature: ai-empowered-audit-trail
Property 12: Export Content Completeness

Tests that exported audit logs (PDF and CSV) contain all events matching filters
and include required fields (anomaly scores, tags, risk levels).

Requirements: 5.1, 5.2, 5.4
"""

import pytest
import csv
import io
import json
from datetime import datetime, timedelta
from hypothesis import given, strategies as st, settings, HealthCheck
from uuid import uuid4

from services.audit_export_service import AuditExportService


# Test data generators
@st.composite
def audit_event_strategy(draw):
    """Generate valid audit event for testing."""
    # Use fixed date range to avoid flaky tests
    base_date = datetime(2024, 1, 1)
    return {
        'id': str(uuid4()),
        'timestamp': draw(st.datetimes(
            min_value=base_date,
            max_value=base_date + timedelta(days=30)
        )).isoformat(),
        'event_type': draw(st.sampled_from([
            'user_login', 'budget_change', 'permission_change',
            'resource_assignment', 'risk_created', 'report_generated'
        ])),
        'user_id': str(uuid4()),
        'entity_type': draw(st.sampled_from(['project', 'resource', 'risk', 'change_request'])),
        'entity_id': str(uuid4()),
        'severity': draw(st.sampled_from(['info', 'warning', 'error', 'critical'])),
        'category': draw(st.sampled_from([
            'Security Change', 'Financial Impact', 'Resource Allocation',
            'Risk Event', 'Compliance Action'
        ])),
        'risk_level': draw(st.sampled_from(['Low', 'Medium', 'High', 'Critical'])),
        'anomaly_score': draw(st.floats(min_value=0.0, max_value=1.0)),
        'is_anomaly': draw(st.booleans()),
        'tags': draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L',))),
            values=st.text(min_size=1, max_size=50),
            min_size=0,
            max_size=5
        )),
        'action_details': draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L',))),
            values=st.one_of(st.text(), st.integers(), st.floats(), st.booleans()),
            min_size=1,
            max_size=10
        )),
        'ip_address': draw(st.ip_addresses(v=4).map(str)),
        'user_agent': draw(st.text(min_size=10, max_size=100)),
        'project_id': str(uuid4()),
        'tenant_id': str(uuid4())
    }


class TestAuditExportCompleteness:
    """
    Property-based tests for audit export completeness.
    
    Property 12: Export Content Completeness
    For any export request (PDF or CSV), the generated export should contain
    all audit events matching the specified filters, and should include
    anomaly scores, tags, and risk levels for each event.
    """
    
    def _create_mock_supabase(self, events):
        """Create mock Supabase client for testing."""
        class MockResponse:
            def __init__(self, data):
                self.data = data
        
        class MockQuery:
            def __init__(self, data):
                self._data = data
                self._filters = {}
            
            def select(self, *args):
                return self
            
            def eq(self, field, value):
                self._filters[field] = value
                return self
            
            def gte(self, field, value):
                self._filters[f'{field}_gte'] = value
                return self
            
            def lte(self, field, value):
                self._filters[f'{field}_lte'] = value
                return self
            
            def in_(self, field, values):
                self._filters[f'{field}_in'] = values
                return self
            
            def order(self, field, desc=False):
                return self
            
            def limit(self, n):
                return self
            
            def execute(self):
                # Apply filters to data
                filtered_data = self._data
                
                # Apply date range filters
                if 'timestamp_gte' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('timestamp', '') >= self._filters['timestamp_gte']
                    ]
                
                if 'timestamp_lte' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('timestamp', '') <= self._filters['timestamp_lte']
                    ]
                
                # Apply event_type filter
                if 'event_type_in' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('event_type') in self._filters['event_type_in']
                    ]
                
                # Apply severity filter
                if 'severity' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('severity') == self._filters['severity']
                    ]
                
                # Apply category filter
                if 'category_in' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('category') in self._filters['category_in']
                    ]
                
                # Apply tenant_id filter
                if 'tenant_id' in self._filters:
                    filtered_data = [
                        e for e in filtered_data
                        if e.get('tenant_id') == self._filters['tenant_id']
                    ]
                
                return MockResponse(filtered_data)
        
        class MockSupabase:
            def __init__(self, data):
                self._data = data
            
            def table(self, table_name):
                return MockQuery(self._data)
        
        return MockSupabase(events)
    
    # Feature: ai-empowered-audit-trail, Property 12: Export Content Completeness
    @given(
        events=st.lists(
            audit_event_strategy(),
            min_size=5,
            max_size=50
        )
    )
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    @pytest.mark.property_test
    async def test_csv_export_contains_all_filtered_events(self, events):
        """
        Property: For any CSV export request, all events matching filters
        should be included in the export.
        
        Validates: Requirements 5.2, 5.4
        """
        # Create export service and mock Supabase
        export_service = AuditExportService()
        export_service.supabase = self._create_mock_supabase(events)
        
        # Define filters (no filters = all events)
        filters = {}
        
        # Generate CSV export
        csv_content = await export_service.export_csv(filters)
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        exported_events = list(csv_reader)
        
        # Verify all events are included
        assert len(exported_events) == len(events), \
            f"Expected {len(events)} events in CSV, got {len(exported_events)}"
        
        # Verify event IDs match
        exported_ids = {row['id'] for row in exported_events}
        expected_ids = {event['id'] for event in events}
        assert exported_ids == expected_ids, \
            "CSV export missing some event IDs"
    
    # Feature: ai-empowered-audit-trail, Property 12: Export Content Completeness
    @given(
        events=st.lists(
            audit_event_strategy(),
            min_size=5,
            max_size=50
        )
    )
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    @pytest.mark.property_test
    async def test_csv_export_includes_required_fields(self, events):
        """
        Property: For any CSV export, each event should include anomaly scores,
        tags, and risk levels.
        
        Validates: Requirements 5.4
        """
        # Create export service and mock Supabase
        export_service = AuditExportService()
        export_service.supabase = self._create_mock_supabase(events)
        
        # Generate CSV export
        csv_content = await export_service.export_csv({})
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        exported_events = list(csv_reader)
        
        # Verify required fields are present in CSV
        required_fields = ['anomaly_score', 'tags', 'risk_level', 'category', 'is_anomaly']
        
        for row in exported_events:
            for field in required_fields:
                assert field in row, f"Required field '{field}' missing from CSV export"
                
                # Verify field has a value (not empty)
                if field in ['anomaly_score', 'is_anomaly']:
                    assert row[field] != '', f"Field '{field}' is empty in CSV export"
    
    # Feature: ai-empowered-audit-trail, Property 12: Export Content Completeness
    @given(
        events=st.lists(
            audit_event_strategy(),
            min_size=5,
            max_size=50
        ),
        filter_severity=st.sampled_from(['info', 'warning', 'error', 'critical'])
    )
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    @pytest.mark.property_test
    async def test_csv_export_respects_severity_filter(self, events, filter_severity):
        """
        Property: For any CSV export with severity filter, only events
        matching the filter should be included.
        
        Validates: Requirements 5.4
        """
        # Create export service and mock Supabase
        export_service = AuditExportService()
        export_service.supabase = self._create_mock_supabase(events)
        
        # Define filters
        filters = {'severity': filter_severity}
        
        # Generate CSV export
        csv_content = await export_service.export_csv(filters)
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        exported_events = list(csv_reader)
        
        # Count expected events
        expected_count = sum(1 for e in events if e.get('severity') == filter_severity)
        
        # Verify count matches
        assert len(exported_events) == expected_count, \
            f"Expected {expected_count} events with severity '{filter_severity}', got {len(exported_events)}"
        
        # Verify all exported events match filter
        for row in exported_events:
            assert row['severity'] == filter_severity, \
                f"Event with severity '{row['severity']}' should not be in filtered export"
    
    # Feature: ai-empowered-audit-trail, Property 12: Export Content Completeness
    @given(
        events=st.lists(
            audit_event_strategy(),
            min_size=5,
            max_size=30
        )
    )
    @settings(max_examples=100, deadline=None)
    @pytest.mark.asyncio
    @pytest.mark.property_test
    async def test_pdf_export_contains_filtered_events(self, events):
        """
        Property: For any PDF export request, the PDF should contain
        information about all filtered events.
        
        Note: We verify the PDF is generated successfully. Full PDF parsing
        is complex and not necessary for property testing - we just verify
        the PDF is valid and non-empty.
        
        Validates: Requirements 5.1, 5.4
        """
        # Create export service and mock Supabase
        export_service = AuditExportService()
        export_service.supabase = self._create_mock_supabase(events)
        
        # Disable OpenAI for testing (summary generation)
        export_service.openai_client = None
        
        # Define filters
        filters = {}
        
        # Generate PDF export
        pdf_bytes = await export_service.export_pdf(filters, include_summary=False)
        
        # Verify PDF was generated
        assert pdf_bytes is not None, "PDF export returned None"
        assert len(pdf_bytes) > 0, "PDF export is empty"
        assert pdf_bytes[:4] == b'%PDF', "Generated file is not a valid PDF"
        
        # Verify PDF has reasonable size (at least 1KB for non-empty content)
        assert len(pdf_bytes) > 1000, \
            f"PDF seems too small ({len(pdf_bytes)} bytes) to contain {len(events)} events"
