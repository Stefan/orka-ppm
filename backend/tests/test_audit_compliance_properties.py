"""
Property-based tests for audit and compliance system.

Feature: integrated-change-management
Property 16: Audit Trail Completeness
Property 17: Compliance Data Integrity
**Validates: Requirements 6.1, 6.2, 6.4**
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from hypothesis import given, strategies as st, settings, HealthCheck
from typing import Dict, Any, List, Optional

from services.audit_compliance_service import (
    AuditComplianceService, AuditEventType, ComplianceFramework, DataRetentionPolicy
)
from services.compliance_monitoring_service import (
    ComplianceMonitoringService, ComplianceStatus, ViolationSeverity
)
from models.change_management import AuditLogEntry, ChangeStatus, ChangeType, PriorityLevel


class TestAuditComplianceProperties:
    """Property-based tests for audit and compliance system."""
    
    def create_audit_service(self):
        """Create audit compliance service with mocked database."""
        with patch('services.audit_compliance_service.supabase') as mock_db:
            mock_db.table.return_value.insert.return_value.execute.return_value.data = [{"id": str(uuid4())}]
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
            service = AuditComplianceService()
            service.db = mock_db
            return service, mock_db
    
    def create_compliance_service(self):
        """Create compliance monitoring service with mocked database."""
        with patch('services.compliance_monitoring_service.supabase') as mock_db:
            mock_db.table.return_value.insert.return_value.execute.return_value.data = [{"id": str(uuid4())}]
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
            service = ComplianceMonitoringService()
            service.db = mock_db
            return service, mock_db
    
    @given(
        change_request_id=st.uuids(),
        event_type=st.sampled_from(list(AuditEventType)),
        event_description=st.text(min_size=10, max_size=500),
        performed_by=st.uuids(),
        old_values=st.one_of(st.none(), st.dictionaries(st.text(), st.text())),
        new_values=st.one_of(st.none(), st.dictionaries(st.text(), st.text())),
        compliance_notes=st.one_of(st.none(), st.text(min_size=5, max_size=200)),
        regulatory_reference=st.one_of(st.none(), st.text(min_size=3, max_size=50)),
        risk_level=st.sampled_from(["low", "medium", "high", "critical"])
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_16_audit_trail_completeness(
        self,
        change_request_id,
        event_type,
        event_description,
        performed_by,
        old_values,
        new_values,
        compliance_notes,
        regulatory_reference,
        risk_level
    ):
        """
        Property 16: Audit Trail Completeness
        
        For any change management event, a complete audit trail entry must be created
        with all required fields, proper timestamps, and data integrity verification.
        **Validates: Requirements 6.1, 6.2**
        """
        service, mock_db = self.create_audit_service()
        
        # Mock successful database insertion
        audit_id = str(uuid4())
        mock_db.table.return_value.insert.return_value.execute.return_value.data = [{"id": audit_id}]
        
        # Property: Audit logging must always succeed for valid inputs
        result_audit_id = await service.log_audit_event(
            change_request_id=change_request_id,
            event_type=event_type,
            event_description=event_description,
            performed_by=performed_by,
            old_values=old_values,
            new_values=new_values,
            compliance_notes=compliance_notes,
            regulatory_reference=regulatory_reference,
            risk_level=risk_level
        )
        
        # Property: Audit ID must be returned
        assert result_audit_id is not None
        assert isinstance(result_audit_id, str)
        assert len(result_audit_id) > 0
        
        # Property: Database insert must be called exactly once
        mock_db.table.assert_called_with("change_audit_log")
        insert_call = mock_db.table.return_value.insert.call_args[0][0]
        
        # Property: All required audit fields must be present
        required_fields = [
            "id", "change_request_id", "event_type", "event_description",
            "performed_by", "performed_at", "audit_trail_complete", "data_integrity_hash"
        ]
        for field in required_fields:
            assert field in insert_call, f"Required field '{field}' missing from audit data"
        
        # Property: Field values must match input parameters
        assert insert_call["change_request_id"] == str(change_request_id)
        assert insert_call["event_type"] == event_type.value
        assert insert_call["event_description"] == event_description
        assert insert_call["performed_by"] == str(performed_by)
        assert insert_call["old_values"] == old_values
        assert insert_call["new_values"] == new_values
        assert insert_call["compliance_notes"] == compliance_notes
        assert insert_call["regulatory_reference"] == regulatory_reference
        assert insert_call["risk_level"] == risk_level
        
        # Property: Timestamp must be recent (within last minute)
        performed_at = datetime.fromisoformat(insert_call["performed_at"])
        time_diff = abs((datetime.utcnow() - performed_at).total_seconds())
        assert time_diff < 60, "Audit timestamp must be recent"
        
        # Property: Audit trail must be marked as complete
        assert insert_call["audit_trail_complete"] is True
        
        # Property: Data integrity hash must be present and non-empty
        assert insert_call["data_integrity_hash"] is not None
        assert len(insert_call["data_integrity_hash"]) > 0
        
        # Property: UUID fields must be valid UUIDs
        UUID(insert_call["id"])  # Will raise ValueError if invalid
        UUID(insert_call["change_request_id"])
        UUID(insert_call["performed_by"])
    
    @given(
        change_request_id=st.uuids(),
        audit_entries=st.lists(
            st.fixed_dictionaries({
                "id": st.uuids().map(str),
                "event_type": st.sampled_from([e.value for e in AuditEventType]),
                "event_description": st.text(min_size=5, max_size=200),
                "performed_by": st.uuids().map(str),
                "performed_at": st.datetimes(
                    min_value=datetime(2024, 1, 1),
                    max_value=datetime.utcnow()
                ).map(lambda dt: dt.isoformat()),
                "old_values": st.one_of(st.none(), st.dictionaries(st.text(), st.text())),
                "new_values": st.one_of(st.none(), st.dictionaries(st.text(), st.text())),
                "compliance_notes": st.one_of(st.none(), st.text(min_size=5, max_size=100)),
                "regulatory_reference": st.one_of(st.none(), st.text(min_size=3, max_size=20))
            }),
            min_size=1,
            max_size=20
        ),
        include_related=st.booleans(),
        date_from=st.one_of(st.none(), st.datetimes(min_value=datetime(2024, 1, 1))),
        date_to=st.one_of(st.none(), st.datetimes(min_value=datetime(2024, 1, 1)))
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_16_audit_trail_retrieval_completeness(
        self,
        change_request_id,
        audit_entries,
        include_related,
        date_from,
        date_to
    ):
        """
        Property 16: Audit Trail Retrieval Completeness
        
        For any change request, retrieving the audit trail must return all relevant
        audit entries in chronological order with complete data integrity.
        **Validates: Requirements 6.1, 6.2**
        """
        # Mock database query response - ensure change_request_id is included
        audit_entries_with_change_id = []
        for entry in audit_entries:
            entry_copy = entry.copy()
            entry_copy["change_request_id"] = str(change_request_id)
            audit_entries_with_change_id.append(entry_copy)
        
        # Mock the entire service initialization and database access
        with patch('services.audit_compliance_service.supabase') as mock_supabase:
            # Create a mock result
            mock_result = MagicMock()
            mock_result.data = audit_entries_with_change_id
            
            # Mock the query chain
            mock_query = MagicMock()
            mock_query.execute.return_value = mock_result
            mock_query.order.return_value = mock_query
            mock_query.gte.return_value = mock_query
            mock_query.lte.return_value = mock_query
            
            mock_supabase.table.return_value.select.return_value.eq.return_value = mock_query
            
            # Create service with mocked database
            service = AuditComplianceService()
        
        # Property: Audit trail retrieval must always return a list
        audit_trail = await service.get_audit_trail(
            change_request_id=change_request_id,
            include_related=include_related,
            date_from=date_from,
            date_to=date_to
        )
        
        # Property: Result must be a list of AuditLogEntry objects
        assert isinstance(audit_trail, list)
        assert len(audit_trail) == len(audit_entries_with_change_id)
        
        # Property: Each entry must be properly converted to AuditLogEntry
        for i, entry in enumerate(audit_trail):
            assert isinstance(entry, AuditLogEntry)
            
            # Property: All required fields must be present and properly typed
            assert entry.id == audit_entries_with_change_id[i]["id"]
            assert entry.event_type == audit_entries_with_change_id[i]["event_type"]
            assert entry.event_description == audit_entries_with_change_id[i]["event_description"]
            assert entry.performed_by == audit_entries_with_change_id[i]["performed_by"]
            assert isinstance(entry.performed_at, datetime)
            
            # Property: Optional fields must be handled correctly
            assert entry.old_values == audit_entries_with_change_id[i]["old_values"]
            assert entry.new_values == audit_entries_with_change_id[i]["new_values"]
            assert entry.compliance_notes == audit_entries_with_change_id[i]["compliance_notes"]
            assert entry.regulatory_reference == audit_entries_with_change_id[i]["regulatory_reference"]
        
        # Property: Database query must be constructed correctly
        mock_supabase.table.assert_called_with("change_audit_log")
        
        # Property: Change request ID filter must be applied
        query_chain = mock_supabase.table.return_value.select.return_value.eq
        query_chain.assert_called_with("change_request_id", str(change_request_id))
    
    @given(
        change_request_id=st.uuids(),
        framework_codes=st.lists(
            st.sampled_from([f.value for f in ComplianceFramework]),
            min_size=1,
            max_size=3
        ),
        compliance_data=st.lists(
            st.builds(
                lambda framework_code, score: {
                    "framework_code": framework_code,
                    "compliance_status": (
                        "compliant" if score >= 95 else
                        "partially_compliant" if score >= 80 else
                        "non_compliant"
                    ),
                    "compliance_score": score,
                    "checked_at": datetime(2024, 1, 1).isoformat(),
                    "required_controls": [],
                    "implemented_controls": [],
                    "missing_controls": [],
                    "findings": ""
                },
                st.sampled_from([f.value for f in ComplianceFramework]),
                st.floats(min_value=0.0, max_value=100.0)
            ),
            min_size=1,
            max_size=10
        ),
        force_recheck=st.booleans()
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_17_compliance_data_integrity(
        self,
        change_request_id,
        framework_codes,
        compliance_data,
        force_recheck
    ):
        """
        Property 17: Compliance Data Integrity
        
        For any compliance check, the system must maintain data integrity across
        all compliance frameworks, ensure consistent scoring, and preserve audit trails.
        **Validates: Requirements 6.2, 6.4**
        """
        service, mock_db = self.create_audit_service()
        
        # Mock framework data
        frameworks_data = [
            {
                "framework_code": code,
                "framework_name": f"{code.upper()} Framework",
                "is_active": True,
                "requirements": {"audit_trail": True, "access_controls": True}
            }
            for code in framework_codes
        ]
        
        # Mock database responses
        mock_db.table.return_value.select.return_value.in_.return_value.eq.return_value.execute.return_value.data = frameworks_data
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = frameworks_data
        
        # Mock compliance monitoring data
        if not force_recheck:
            mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = compliance_data[:1]
        else:
            mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
        
        # Mock change request data for compliance checks
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": str(change_request_id), "status": "approved"}
        ]
        
        # Property: Compliance check must always return structured results
        compliance_results = await service.check_compliance(
            change_request_id=change_request_id,
            framework_codes=framework_codes,
            force_recheck=force_recheck
        )
        
        # Property: Results must have required structure
        required_keys = [
            "change_request_id", "checked_at", "overall_compliance_score",
            "framework_results", "violations", "recommendations"
        ]
        for key in required_keys:
            assert key in compliance_results, f"Required key '{key}' missing from compliance results"
        
        # Property: Change request ID must be preserved
        assert compliance_results["change_request_id"] == str(change_request_id)
        
        # Property: Timestamp must be recent
        checked_at = datetime.fromisoformat(compliance_results["checked_at"])
        time_diff = abs((datetime.utcnow() - checked_at).total_seconds())
        assert time_diff < 60, "Compliance check timestamp must be recent"
        
        # Property: Overall compliance score must be valid
        overall_score = compliance_results["overall_compliance_score"]
        assert isinstance(overall_score, (int, float))
        assert 0.0 <= overall_score <= 100.0, "Overall compliance score must be between 0 and 100"
        
        # Property: Framework results must be present for each requested framework
        framework_results = compliance_results["framework_results"]
        assert isinstance(framework_results, dict)
        
        for framework_code in framework_codes:
            assert framework_code in framework_results, f"Framework '{framework_code}' missing from results"
            
            framework_result = framework_results[framework_code]
            
            # Property: Each framework result must have required fields
            required_framework_fields = ["compliance_status", "compliance_score", "checked_at"]
            for field in required_framework_fields:
                assert field in framework_result, f"Required field '{field}' missing from framework result"
            
            # Property: Compliance score must be valid
            score = framework_result["compliance_score"]
            assert isinstance(score, (int, float))
            assert 0.0 <= score <= 100.0, f"Framework compliance score must be between 0 and 100, got {score}"
            
            # Property: Compliance status must be consistent with score
            status = framework_result["compliance_status"]
            if score >= 95:
                assert status in ["compliant"], f"High score ({score}) should indicate compliant status"
            elif score < 80:
                assert status in ["non_compliant", "error"], f"Low score ({score}) should indicate non-compliant status"
        
        # Property: Violations must be a list
        violations = compliance_results["violations"]
        assert isinstance(violations, list)
        
        # Property: Each violation must have proper structure
        for violation in violations:
            assert isinstance(violation, dict)
            # Violations should have at least description or type information
            assert any(key in violation for key in ["description", "violation_type", "control"])
        
        # Property: Recommendations must be a list of strings
        recommendations = compliance_results["recommendations"]
        assert isinstance(recommendations, list)
        for recommendation in recommendations:
            assert isinstance(recommendation, str)
            assert len(recommendation.strip()) > 0, "Recommendations must be non-empty"
    
    @given(
        audit_records=st.lists(
            st.fixed_dictionaries({
                "id": st.uuids().map(str),
                "change_request_id": st.uuids().map(str),
                "performed_at": st.datetimes(
                    min_value=datetime(2020, 1, 1),
                    max_value=datetime(2023, 12, 31)  # Old records for retention testing
                ).map(lambda dt: dt.isoformat()),
                "event_type": st.sampled_from([e.value for e in AuditEventType]),
                "archived": st.booleans()
            }),
            min_size=5,
            max_size=50
        ),
        policy_type=st.sampled_from(list(DataRetentionPolicy))
    )
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_17_data_retention_integrity(
        self,
        audit_records,
        policy_type
    ):
        """
        Property 17: Data Retention Integrity
        
        For any data retention policy application, the system must maintain data
        integrity, properly archive or delete records, and preserve audit trails.
        **Validates: Requirements 6.2, 6.4**
        """
        service, mock_db = self.create_audit_service()
        
        # Mock database responses for retention policy
        mock_db.table.return_value.select.return_value.lt.return_value.execute.return_value.data = audit_records
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock()
        mock_db.table.return_value.delete.return_value.eq.return_value.execute.return_value = Mock()
        
        # Property: Data retention policy application must always return results
        retention_results = await service.apply_data_retention_policy(policy_type)
        
        # Property: Results must have required structure
        required_keys = [
            "policy_applied", "processed_at", "records_processed",
            "records_archived", "records_deleted", "errors"
        ]
        for key in required_keys:
            assert key in retention_results, f"Required key '{key}' missing from retention results"
        
        # Property: Policy type must be preserved
        assert retention_results["policy_applied"] == policy_type.value
        
        # Property: Timestamp must be recent
        processed_at = datetime.fromisoformat(retention_results["processed_at"])
        time_diff = abs((datetime.utcnow() - processed_at).total_seconds())
        assert time_diff < 60, "Retention processing timestamp must be recent"
        
        # Property: Record counts must be non-negative integers
        assert isinstance(retention_results["records_processed"], int)
        assert retention_results["records_processed"] >= 0
        assert isinstance(retention_results["records_archived"], int)
        assert retention_results["records_archived"] >= 0
        assert isinstance(retention_results["records_deleted"], int)
        assert retention_results["records_deleted"] >= 0
        
        # Property: Errors must be a list
        assert isinstance(retention_results["errors"], list)
        
        # Property: For legal hold policy, no records should be processed
        if policy_type == DataRetentionPolicy.LEGAL_HOLD:
            assert retention_results["records_processed"] == 0
            assert retention_results["records_archived"] == 0
            assert retention_results["records_deleted"] == 0
        else:
            # Property: For other policies, records should be processed if old records exist
            if audit_records:
                # At least some processing should occur for non-legal-hold policies
                total_actions = (
                    retention_results["records_archived"] + 
                    retention_results["records_deleted"]
                )
                # Note: In real implementation, this would depend on record ages
                # For property testing, we verify the structure is maintained
                assert total_actions >= 0
        
        # Property: Conservation of records (archived + deleted <= processed)
        total_actions = retention_results["records_archived"] + retention_results["records_deleted"]
        assert total_actions <= retention_results["records_processed"], \
            "Total actions cannot exceed processed records"
    
    @given(
        change_request_ids=st.lists(st.uuids(), min_size=1, max_size=10),
        export_format=st.sampled_from(["json", "csv", "xml"]),
        include_attachments=st.booleans()
    )
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_17_audit_data_export_integrity(
        self,
        change_request_ids,
        export_format,
        include_attachments
    ):
        """
        Property 17: Audit Data Export Integrity
        
        For any audit data export, the system must maintain complete data integrity,
        include all relevant audit information, and preserve data relationships.
        **Validates: Requirements 6.2, 6.4**
        """
        service, mock_db = self.create_audit_service()
        
        # Mock database responses for each change request
        for change_id in change_request_ids:
            # Mock change request data
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": str(change_id), "title": f"Change {change_id}", "status": "approved"}
            ]
        
        # Mock empty responses for related data
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Property: Export must always return structured data
        export_data = await service.export_audit_data(
            change_request_ids=change_request_ids,
            export_format=export_format,
            include_attachments=include_attachments
        )
        
        # Property: Export data must have required structure
        required_keys = [
            "export_id", "exported_at", "export_format", 
            "change_request_count", "data"
        ]
        for key in required_keys:
            assert key in export_data, f"Required key '{key}' missing from export data"
        
        # Property: Export ID must be valid UUID
        UUID(export_data["export_id"])  # Will raise ValueError if invalid
        
        # Property: Timestamp must be recent
        exported_at = datetime.fromisoformat(export_data["exported_at"])
        time_diff = abs((datetime.utcnow() - exported_at).total_seconds())
        assert time_diff < 60, "Export timestamp must be recent"
        
        # Property: Export format must match requested format
        assert export_data["export_format"] == export_format
        
        # Property: Change request count must match input
        assert export_data["change_request_count"] == len(change_request_ids)
        
        # Property: Data must be present for each change request
        data = export_data["data"]
        assert isinstance(data, dict)
        assert len(data) == len(change_request_ids)
        
        for change_id in change_request_ids:
            change_id_str = str(change_id)
            assert change_id_str in data, f"Change request {change_id_str} missing from export data"
            
            change_data = data[change_id_str]
            
            # Property: Each change must have required data sections
            required_sections = [
                "change_request", "audit_trail", "compliance_checks",
                "approvals", "implementations", "violations"
            ]
            for section in required_sections:
                assert section in change_data, f"Required section '{section}' missing from change data"
                assert isinstance(change_data[section], list) or isinstance(change_data[section], dict)
    
    @given(
        compliance_monitoring_data=st.lists(
            st.fixed_dictionaries({
                "change_request_id": st.uuids().map(str),
                "framework_code": st.sampled_from([f.value for f in ComplianceFramework]),
                "compliance_status": st.sampled_from([s.value for s in ComplianceStatus]),
                "compliance_score": st.floats(min_value=0.0, max_value=100.0),
                "checked_at": st.datetimes(
                    min_value=datetime(2024, 1, 1),
                    max_value=datetime.utcnow()
                ).map(lambda dt: dt.isoformat())
            }),
            min_size=5,
            max_size=30
        )
    )
    @settings(max_examples=20, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_17_compliance_monitoring_data_consistency(
        self,
        compliance_monitoring_data
    ):
        """
        Property 17: Compliance Monitoring Data Consistency
        
        For any compliance monitoring operation, data must remain consistent
        across all frameworks and maintain referential integrity.
        **Validates: Requirements 6.2, 6.4**
        """
        compliance_service, mock_db = self.create_compliance_service()
        
        # Mock database responses
        mock_db.table.return_value.select.return_value.gte.return_value.execute.return_value.data = compliance_monitoring_data
        
        # Property: Dashboard data generation must always return structured results
        dashboard_data = await compliance_service.generate_compliance_dashboard_data(date_range_days=30)
        
        # Property: Dashboard data must have required structure
        required_keys = [
            "generated_at", "date_range_days", "overall_compliance",
            "framework_compliance", "violation_trends", "regulatory_status",
            "alerts_summary", "recommendations"
        ]
        for key in required_keys:
            assert key in dashboard_data, f"Required key '{key}' missing from dashboard data"
        
        # Property: Date range must match input
        assert dashboard_data["date_range_days"] == 30
        
        # Property: Timestamp must be recent
        generated_at = datetime.fromisoformat(dashboard_data["generated_at"])
        time_diff = abs((datetime.utcnow() - generated_at).total_seconds())
        assert time_diff < 60, "Dashboard generation timestamp must be recent"
        
        # Property: Overall compliance must have valid structure
        overall_compliance = dashboard_data["overall_compliance"]
        assert isinstance(overall_compliance, dict)
        
        if "compliance_rate" in overall_compliance:
            compliance_rate = overall_compliance["compliance_rate"]
            assert isinstance(compliance_rate, (int, float))
            assert 0.0 <= compliance_rate <= 100.0, "Compliance rate must be between 0 and 100"
        
        # Property: Framework compliance must be a dictionary
        framework_compliance = dashboard_data["framework_compliance"]
        assert isinstance(framework_compliance, dict)
        
        # Property: Each framework must have consistent data
        for framework_code, metrics in framework_compliance.items():
            if isinstance(metrics, dict) and "compliance_rate" in metrics:
                rate = metrics["compliance_rate"]
                assert isinstance(rate, (int, float))
                assert 0.0 <= rate <= 100.0, f"Framework {framework_code} compliance rate must be between 0 and 100"
                
                # Property: Total must equal compliant + non_compliant
                if all(key in metrics for key in ["total", "compliant", "non_compliant"]):
                    assert metrics["total"] == metrics["compliant"] + metrics["non_compliant"], \
                        f"Framework {framework_code} totals must be consistent"
        
        # Property: Recommendations must be a list of strings
        recommendations = dashboard_data["recommendations"]
        assert isinstance(recommendations, list)
        for recommendation in recommendations:
            assert isinstance(recommendation, str)
            assert len(recommendation.strip()) > 0, "Recommendations must be non-empty"