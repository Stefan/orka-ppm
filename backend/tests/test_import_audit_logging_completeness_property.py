"""
Property-Based Test for Audit Logging Completeness
Feature: project-import-mvp
Property 12: Audit logging completeness

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

Requirements 5.1: WHEN an import operation begins, THE Audit_Logger SHALL record 
the user identity, timestamp, and import method

Requirements 5.2: WHEN an import operation completes successfully, THE Audit_Logger 
SHALL record the number of projects imported

Requirements 5.3: WHEN an import operation fails, THE Audit_Logger SHALL record 
the failure reason

Requirements 5.4: THE Audit_Logger SHALL persist all audit records to the database
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.audit_service import AuditService


# Strategy for generating valid user IDs
@st.composite
def user_id_strategy(draw):
    """Generate valid user IDs (UUID strings)."""
    return str(uuid4())


# Strategy for generating import methods
@st.composite
def import_method_strategy(draw):
    """Generate valid import methods."""
    return draw(st.sampled_from(["json", "csv"]))


# Strategy for generating record counts
@st.composite
def record_count_strategy(draw):
    """Generate valid record counts for imports."""
    return draw(st.integers(min_value=1, max_value=1000))


# Strategy for generating import outcomes
@st.composite
def import_outcome_strategy(draw):
    """Generate import outcomes (success or failure with optional error message)."""
    success = draw(st.booleans())
    imported_count = draw(st.integers(min_value=0, max_value=1000))
    
    if success:
        # Successful imports should have imported_count > 0
        imported_count = max(1, imported_count)
        error_message = None
    else:
        # Failed imports have 0 imported and an error message
        imported_count = 0
        error_message = draw(st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=('L', 'N', 'P', 'S', 'Z'),
            blacklist_characters='\x00'
        )).filter(lambda x: x.strip()))
    
    return {
        "success": success,
        "imported_count": imported_count,
        "error_message": error_message
    }


# Combined strategy for complete import operation
@st.composite
def import_operation_strategy(draw):
    """Generate complete import operation data for testing audit logging."""
    return {
        "user_id": draw(user_id_strategy()),
        "import_method": draw(import_method_strategy()),
        "record_count": draw(record_count_strategy()),
        "outcome": draw(import_outcome_strategy())
    }


class TestAuditLoggingCompletenessProperty:
    """
    Property-based tests for audit logging completeness.
    
    Property 12: Audit logging completeness
    **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client that tracks all operations."""
        db = Mock()
        
        # Track all insert and update calls
        db.inserted_records = []
        db.updated_records = []
        
        # Mock table method
        mock_table = Mock()
        db.table = Mock(return_value=mock_table)
        
        # Mock insert operation
        def mock_insert(record):
            db.inserted_records.append(record)
            mock_response = Mock()
            mock_response.execute = Mock(return_value=Mock(data=[record]))
            return mock_response
        
        mock_table.insert = mock_insert
        
        # Mock select operation for fetching existing records
        def mock_select(columns):
            mock_chain = Mock()
            def mock_eq(field, value):
                mock_exec = Mock()
                # Return the last inserted record if any
                if db.inserted_records:
                    last_record = db.inserted_records[-1]
                    mock_exec.execute = Mock(return_value=Mock(data=[last_record]))
                else:
                    mock_exec.execute = Mock(return_value=Mock(data=[]))
                return mock_exec
            mock_chain.eq = mock_eq
            return mock_chain
        
        mock_table.select = mock_select
        
        # Mock update operation
        def mock_update(data):
            mock_chain = Mock()
            def mock_eq(field, value):
                db.updated_records.append({"data": data, "filter": {field: value}})
                mock_exec = Mock()
                mock_exec.execute = Mock(return_value=Mock(data=[data]))
                return mock_exec
            mock_chain.eq = mock_eq
            return mock_chain
        
        mock_table.update = mock_update
        
        return db
    
    @pytest.fixture
    def audit_service(self, mock_db):
        """Create an AuditService instance with mock database."""
        return AuditService(db_session=mock_db)
    
    @given(operation=import_operation_strategy())
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    @pytest.mark.asyncio
    async def test_property_12_audit_logging_completeness(
        self, 
        operation, 
        audit_service, 
        mock_db
    ):
        """
        Property 12: Audit logging completeness
        
        **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
        
        For any import operation (successful or failed), the Audit_Logger should 
        create a database record containing the user identity, timestamp, import 
        method, record count, success status, and (if failed) error message.
        """
        user_id = operation["user_id"]
        import_method = operation["import_method"]
        record_count = operation["record_count"]
        outcome = operation["outcome"]
        
        # Clear previous records
        mock_db.inserted_records.clear()
        mock_db.updated_records.clear()
        
        # Step 1: Log import start (Requirement 5.1)
        audit_id = await audit_service.log_import_start(
            user_id=user_id,
            import_method=import_method,
            record_count=record_count
        )
        
        # Verify audit_id is returned
        assert audit_id is not None, "Audit ID should be returned from log_import_start"
        assert isinstance(audit_id, str), "Audit ID should be a string"
        
        # Verify start record was inserted (Requirement 5.4)
        assert len(mock_db.inserted_records) == 1, (
            "Exactly one audit record should be inserted on import start"
        )
        
        start_record = mock_db.inserted_records[0]
        
        # Verify user identity is recorded (Requirement 5.1)
        assert "user_id" in start_record, "Audit record must contain user_id"
        assert start_record["user_id"] == user_id, (
            f"User ID mismatch: expected {user_id}, got {start_record['user_id']}"
        )
        
        # Verify timestamp is recorded (Requirement 5.1)
        assert "timestamp" in start_record, "Audit record must contain timestamp"
        assert start_record["timestamp"] is not None, "Timestamp must not be None"
        
        # Verify import method is recorded (Requirement 5.1)
        assert "action_details" in start_record, "Audit record must contain action_details"
        action_details = json.loads(start_record["action_details"])
        assert "import_method" in action_details, "action_details must contain import_method"
        assert action_details["import_method"] == import_method, (
            f"Import method mismatch: expected {import_method}, "
            f"got {action_details['import_method']}"
        )
        
        # Verify record count is recorded (Requirement 5.1)
        assert "record_count" in action_details, "action_details must contain record_count"
        assert action_details["record_count"] == record_count, (
            f"Record count mismatch: expected {record_count}, "
            f"got {action_details['record_count']}"
        )
        
        # Step 2: Log import completion (Requirements 5.2, 5.3)
        await audit_service.log_import_complete(
            audit_id=audit_id,
            success=outcome["success"],
            imported_count=outcome["imported_count"],
            error_message=outcome["error_message"]
        )
        
        # Verify completion record was updated (Requirement 5.4)
        assert len(mock_db.updated_records) == 1, (
            "Exactly one audit record should be updated on import completion"
        )
        
        update_record = mock_db.updated_records[0]
        update_data = update_record["data"]
        
        # Verify success status is recorded
        assert "success" in update_data, "Update must contain success status"
        assert update_data["success"] == outcome["success"], (
            f"Success status mismatch: expected {outcome['success']}, "
            f"got {update_data['success']}"
        )
        
        # Verify completion timestamp is recorded
        assert "completed_at" in update_data, "Update must contain completed_at timestamp"
        assert update_data["completed_at"] is not None, "completed_at must not be None"
        
        # Verify action_details contains imported_count (Requirement 5.2)
        assert "action_details" in update_data, "Update must contain action_details"
        updated_details = json.loads(update_data["action_details"])
        assert "imported_count" in updated_details, (
            "Updated action_details must contain imported_count"
        )
        assert updated_details["imported_count"] == outcome["imported_count"], (
            f"Imported count mismatch: expected {outcome['imported_count']}, "
            f"got {updated_details['imported_count']}"
        )
        
        # Verify error message is recorded for failed imports (Requirement 5.3)
        if not outcome["success"]:
            assert "error_message" in updated_details or "error_message" in update_data, (
                "Failed import must record error_message"
            )
            recorded_error = updated_details.get("error_message") or update_data.get("error_message")
            assert recorded_error == outcome["error_message"], (
                f"Error message mismatch: expected '{outcome['error_message']}', "
                f"got '{recorded_error}'"
            )


class TestAuditLoggingCompletenessEdgeCases:
    """
    Additional edge case tests for audit logging completeness.
    These complement the property-based tests with specific scenarios.
    """
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database client."""
        db = Mock()
        db.inserted_records = []
        db.updated_records = []
        
        mock_table = Mock()
        db.table = Mock(return_value=mock_table)
        
        def mock_insert(record):
            db.inserted_records.append(record)
            mock_response = Mock()
            mock_response.execute = Mock(return_value=Mock(data=[record]))
            return mock_response
        
        mock_table.insert = mock_insert
        
        def mock_select(columns):
            mock_chain = Mock()
            def mock_eq(field, value):
                mock_exec = Mock()
                if db.inserted_records:
                    mock_exec.execute = Mock(return_value=Mock(data=[db.inserted_records[-1]]))
                else:
                    mock_exec.execute = Mock(return_value=Mock(data=[]))
                return mock_exec
            mock_chain.eq = mock_eq
            return mock_chain
        
        mock_table.select = mock_select
        
        def mock_update(data):
            mock_chain = Mock()
            def mock_eq(field, value):
                db.updated_records.append({"data": data, "filter": {field: value}})
                mock_exec = Mock()
                mock_exec.execute = Mock(return_value=Mock(data=[data]))
                return mock_exec
            mock_chain.eq = mock_eq
            return mock_chain
        
        mock_table.update = mock_update
        
        return db
    
    @pytest.fixture
    def audit_service(self, mock_db):
        """Create an AuditService instance with mock database."""
        return AuditService(db_session=mock_db)
    
    @pytest.mark.asyncio
    async def test_successful_import_records_all_fields(self, audit_service, mock_db):
        """Test that successful imports record all required fields."""
        user_id = str(uuid4())
        import_method = "json"
        record_count = 5
        imported_count = 5
        
        audit_id = await audit_service.log_import_start(
            user_id=user_id,
            import_method=import_method,
            record_count=record_count
        )
        
        await audit_service.log_import_complete(
            audit_id=audit_id,
            success=True,
            imported_count=imported_count
        )
        
        # Verify all required fields are present
        start_record = mock_db.inserted_records[0]
        assert start_record["user_id"] == user_id
        assert start_record["timestamp"] is not None
        
        action_details = json.loads(start_record["action_details"])
        assert action_details["import_method"] == import_method
        assert action_details["record_count"] == record_count
        
        update_data = mock_db.updated_records[0]["data"]
        assert update_data["success"] is True
        
        updated_details = json.loads(update_data["action_details"])
        assert updated_details["imported_count"] == imported_count
    
    @pytest.mark.asyncio
    async def test_failed_import_records_error_message(self, audit_service, mock_db):
        """Test that failed imports record the error message."""
        user_id = str(uuid4())
        import_method = "csv"
        record_count = 10
        error_message = "Validation failed for 3 records"
        
        audit_id = await audit_service.log_import_start(
            user_id=user_id,
            import_method=import_method,
            record_count=record_count
        )
        
        await audit_service.log_import_complete(
            audit_id=audit_id,
            success=False,
            imported_count=0,
            error_message=error_message
        )
        
        update_data = mock_db.updated_records[0]["data"]
        assert update_data["success"] is False
        
        # Error message should be recorded
        updated_details = json.loads(update_data["action_details"])
        assert updated_details.get("error_message") == error_message or \
               update_data.get("error_message") == error_message
    
    @pytest.mark.asyncio
    async def test_csv_import_method_recorded(self, audit_service, mock_db):
        """Test that CSV import method is correctly recorded."""
        audit_id = await audit_service.log_import_start(
            user_id=str(uuid4()),
            import_method="csv",
            record_count=100
        )
        
        start_record = mock_db.inserted_records[0]
        action_details = json.loads(start_record["action_details"])
        assert action_details["import_method"] == "csv"
    
    @pytest.mark.asyncio
    async def test_json_import_method_recorded(self, audit_service, mock_db):
        """Test that JSON import method is correctly recorded."""
        audit_id = await audit_service.log_import_start(
            user_id=str(uuid4()),
            import_method="json",
            record_count=50
        )
        
        start_record = mock_db.inserted_records[0]
        action_details = json.loads(start_record["action_details"])
        assert action_details["import_method"] == "json"
    
    @pytest.mark.asyncio
    async def test_large_record_count_recorded(self, audit_service, mock_db):
        """Test that large record counts are correctly recorded."""
        large_count = 10000
        
        audit_id = await audit_service.log_import_start(
            user_id=str(uuid4()),
            import_method="csv",
            record_count=large_count
        )
        
        start_record = mock_db.inserted_records[0]
        action_details = json.loads(start_record["action_details"])
        assert action_details["record_count"] == large_count
    
    @pytest.mark.asyncio
    async def test_audit_id_is_unique(self, audit_service, mock_db):
        """Test that each audit operation gets a unique ID."""
        audit_ids = set()
        
        for _ in range(5):
            audit_id = await audit_service.log_import_start(
                user_id=str(uuid4()),
                import_method="json",
                record_count=1
            )
            audit_ids.add(audit_id)
        
        assert len(audit_ids) == 5, "Each audit operation should have a unique ID"
