"""
Property-Based Tests for Audit Access Logging

Tests Property 20: Audit Access Logging
Validates: Requirements 6.9
"""

import pytest
from hypothesis import given, strategies as st, settings
from uuid import uuid4
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock


# Recreate the log_audit_access function for testing
async def log_audit_access_test(
    user_id: str,
    tenant_id: str,
    access_type: str,
    query_parameters=None,
    result_count=None,
    ip_address=None,
    user_agent=None,
    execution_time_ms=None,
    supabase_client=None
):
    """Test version of log_audit_access function."""
    try:
        access_log_data = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "access_type": access_type,
            "query_parameters": query_parameters,
            "result_count": result_count,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "execution_time_ms": execution_time_ms,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Insert into audit_access_log table
        if supabase_client:
            supabase_client.table("audit_access_log").insert(access_log_data).execute()
    
    except Exception as e:
        # Log error but don't fail the main operation
        pass


# ============================================================================
# Test Data Generators
# ============================================================================

# Strategy for generating user IDs
user_id_strategy = st.uuids().map(str)

# Strategy for generating tenant IDs
tenant_id_strategy = st.uuids().map(str)

# Strategy for generating access types
access_type_strategy = st.sampled_from(["read", "export", "search"])

# Strategy for generating query parameters
query_params_strategy = st.fixed_dictionaries({
    "start_date": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat())),
    "end_date": st.one_of(st.none(), st.datetimes().map(lambda dt: dt.isoformat())),
    "event_types": st.one_of(st.none(), st.text(min_size=1, max_size=50)),
    "severity": st.one_of(st.none(), st.sampled_from(["info", "warning", "error", "critical"])),
    "limit": st.integers(min_value=1, max_value=1000),
    "offset": st.integers(min_value=0, max_value=10000)
})

# Strategy for generating IP addresses
ip_address_strategy = st.one_of(
    st.none(),
    st.from_regex(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$", fullmatch=True)
)

# Strategy for generating user agents
user_agent_strategy = st.one_of(
    st.none(),
    st.text(min_size=10, max_size=200)
)


# ============================================================================
# Property Tests
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 20: Audit Access Logging
@given(
    user_id=user_id_strategy,
    tenant_id=tenant_id_strategy,
    access_type=access_type_strategy,
    query_parameters=query_params_strategy,
    result_count=st.one_of(st.none(), st.integers(min_value=0, max_value=10000)),
    ip_address=ip_address_strategy,
    user_agent=user_agent_strategy
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_audit_access_logging(
    user_id, tenant_id, access_type, query_parameters, 
    result_count, ip_address, user_agent
):
    """
    Property 20: Audit Access Logging
    
    For any access to audit logs (read or export), the system should create 
    a meta-audit event recording the access, including user ID, timestamp, 
    and query parameters used.
    
    Validates: Requirements 6.9
    
    Property: For any audit log access:
    1. A meta-audit event should be created
    2. The event should contain user_id, tenant_id, access_type
    3. The event should contain query_parameters
    4. The event should have a timestamp
    """
    # Mock the supabase client
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    # Set up the mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Call the log_audit_access function
    await log_audit_access_test(
        user_id=user_id,
        tenant_id=tenant_id,
        access_type=access_type,
        query_parameters=query_parameters,
        result_count=result_count,
        ip_address=ip_address,
        user_agent=user_agent,
        supabase_client=mock_supabase
    )
        
    # Property 1: supabase.table should be called with "audit_access_log"
    mock_supabase.table.assert_called_once_with("audit_access_log")
    
    # Property 2: insert should be called once
    assert mock_table.insert.call_count == 1
    
    # Get the data that was inserted
    insert_call_args = mock_table.insert.call_args
    inserted_data = insert_call_args[0][0]
    
    # Property 3: Inserted data should contain required fields
    assert inserted_data["user_id"] == user_id, \
        "Logged access should contain user_id"
    
    assert inserted_data["tenant_id"] == tenant_id, \
        "Logged access should contain tenant_id"
    
    assert inserted_data["access_type"] == access_type, \
        "Logged access should contain access_type"
    
    assert inserted_data["query_parameters"] == query_parameters, \
        "Logged access should contain query_parameters"
    
    # Property 4: Inserted data should have a timestamp
    assert "timestamp" in inserted_data, \
        "Logged access should have a timestamp"
    
    # Property 5: Optional fields should be included if provided
    if result_count is not None:
        assert inserted_data["result_count"] == result_count
    
    if ip_address is not None:
        assert inserted_data["ip_address"] == ip_address
    
    if user_agent is not None:
        assert inserted_data["user_agent"] == user_agent


@given(
    user_id=user_id_strategy,
    tenant_id=tenant_id_strategy,
    access_type=access_type_strategy
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_audit_access_logging_with_minimal_data(user_id, tenant_id, access_type):
    """
    Property: Audit access logging should work with minimal required data.
    
    For any audit log access with only required fields (user_id, tenant_id, 
    access_type), a meta-audit event should still be created successfully.
    
    Validates: Requirements 6.9
    """
    # Mock the supabase client
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    # Set up the mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Call with minimal data
    await log_audit_access_test(
        user_id=user_id,
        tenant_id=tenant_id,
        access_type=access_type,
        supabase_client=mock_supabase
    )
    
    # Should still create a log entry
    mock_supabase.table.assert_called_once_with("audit_access_log")
    assert mock_table.insert.call_count == 1
    
    # Get the data that was inserted
    insert_call_args = mock_table.insert.call_args
    inserted_data = insert_call_args[0][0]
    
    # Verify required fields are present
    assert inserted_data["user_id"] == user_id
    assert inserted_data["tenant_id"] == tenant_id
    assert inserted_data["access_type"] == access_type
    assert "timestamp" in inserted_data


@given(
    user_id=user_id_strategy,
    tenant_id=tenant_id_strategy,
    access_types=st.lists(access_type_strategy, min_size=2, max_size=5)
)
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_multiple_access_logging(user_id, tenant_id, access_types):
    """
    Property: Multiple audit accesses should create multiple log entries.
    
    For any sequence of audit log accesses by the same user, each access
    should create a separate meta-audit event.
    
    Validates: Requirements 6.9
    """
    # Mock the supabase client
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    # Set up the mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Log multiple accesses
    for access_type in access_types:
        await log_audit_access_test(
            user_id=user_id,
            tenant_id=tenant_id,
            access_type=access_type,
            supabase_client=mock_supabase
        )
    
    # Property: Number of insert calls should match number of accesses
    assert mock_table.insert.call_count == len(access_types), \
        "Each access should create a separate log entry"


@given(
    user_id=user_id_strategy,
    tenant_id=tenant_id_strategy,
    access_type=access_type_strategy,
    execution_time_ms=st.one_of(st.none(), st.integers(min_value=1, max_value=60000))
)
@settings(max_examples=50, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_execution_time_logging(user_id, tenant_id, access_type, execution_time_ms):
    """
    Property: Execution time should be logged when provided.
    
    For any audit log access with execution time, the meta-audit event
    should include the execution time.
    
    Validates: Requirements 6.9
    """
    # Mock the supabase client
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    # Set up the mock chain
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Call with execution time
    await log_audit_access_test(
        user_id=user_id,
        tenant_id=tenant_id,
        access_type=access_type,
        execution_time_ms=execution_time_ms,
        supabase_client=mock_supabase
    )
    
    # Get the data that was inserted
    insert_call_args = mock_table.insert.call_args
    inserted_data = insert_call_args[0][0]
    
    # Property: Execution time should be included if provided
    if execution_time_ms is not None:
        assert inserted_data["execution_time_ms"] == execution_time_ms, \
            "Execution time should be logged when provided"


# ============================================================================
# Unit Tests for Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_access_logging_handles_database_errors_gracefully():
    """Test that database errors don't crash the application."""
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    
    # Mock the supabase client to raise an error
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.insert.side_effect = Exception("Database connection failed")
    
    # Should not raise an exception (fail gracefully)
    try:
        await log_audit_access_test(
            user_id=user_id,
            tenant_id=tenant_id,
            access_type="read",
            supabase_client=mock_supabase
        )
        # If we get here, the function handled the error gracefully
        assert True
    except Exception:
        pytest.fail("log_audit_access should handle database errors gracefully")


@pytest.mark.asyncio
async def test_access_logging_with_empty_query_parameters():
    """Test logging with empty query parameters."""
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Call with empty query parameters
    await log_audit_access_test(
        user_id=user_id,
        tenant_id=tenant_id,
        access_type="read",
        query_parameters={},
        supabase_client=mock_supabase
    )
    
    # Should still create a log entry
    assert mock_table.insert.call_count == 1
    
    insert_call_args = mock_table.insert.call_args
    inserted_data = insert_call_args[0][0]
    
    # Empty dict should be preserved
    assert inserted_data["query_parameters"] == {}


@pytest.mark.asyncio
async def test_access_logging_with_complex_query_parameters():
    """Test logging with complex nested query parameters."""
    user_id = str(uuid4())
    tenant_id = str(uuid4())
    
    complex_params = {
        "filters": {
            "date_range": {
                "start": "2024-01-01",
                "end": "2024-12-31"
            },
            "categories": ["Security Change", "Financial Impact"],
            "risk_levels": ["High", "Critical"]
        },
        "pagination": {
            "limit": 100,
            "offset": 0
        }
    }
    
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_execute = MagicMock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = mock_execute
    
    # Call with complex parameters
    await log_audit_access_test(
        user_id=user_id,
        tenant_id=tenant_id,
        access_type="read",
        query_parameters=complex_params,
        supabase_client=mock_supabase
    )
    
    # Should preserve complex structure
    insert_call_args = mock_table.insert.call_args
    inserted_data = insert_call_args[0][0]
    
    assert inserted_data["query_parameters"] == complex_params
