"""
Property-Based Tests for Audit RAG Agent Summary Generation
Tests Property 7 from the design document
"""

import pytest
import uuid
from datetime import datetime, timedelta
from hypothesis import given, strategies as st, settings
from hypothesis import HealthCheck
import sys
import os

# Add backend to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from services.audit_rag_agent import AuditRAGAgent
from unittest.mock import Mock, AsyncMock, patch


# ============================================================================
# Test Data Generators
# ============================================================================

@st.composite
def audit_event_in_timewindow_strategy(draw, start_time, end_time):
    """Generate audit events within a specific time window"""
    # Generate timestamp within the time window
    time_delta = (end_time - start_time).total_seconds()
    random_seconds = draw(st.floats(min_value=0, max_value=time_delta))
    timestamp = start_time + timedelta(seconds=random_seconds)
    
    return {
        "id": str(uuid.uuid4()),
        "event_type": draw(st.sampled_from([
            "user_login", "budget_change", "permission_change",
            "resource_assignment", "risk_created", "report_generated"
        ])),
        "user_id": str(uuid.uuid4()),
        "entity_type": draw(st.sampled_from(["project", "resource", "risk", "change_request"])),
        "entity_id": str(uuid.uuid4()),
        "action_details": draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=("Lu", "Ll"))),
            values=st.one_of(st.text(max_size=20), st.integers())
        )),
        "severity": draw(st.sampled_from(["info", "warning", "error", "critical"])),
        "timestamp": timestamp.isoformat(),
        "category": draw(st.sampled_from([
            "Security Change", "Financial Impact", "Resource Allocation",
            "Risk Event", "Compliance Action"
        ])),
        "risk_level": draw(st.sampled_from(["Low", "Medium", "High", "Critical"])),
        "tenant_id": str(uuid.uuid4()),
        "is_anomaly": draw(st.booleans()),
        "tags": {}
    }


# ============================================================================
# Property 7: Summary Time Window Correctness
# ============================================================================

# Feature: ai-empowered-audit-trail, Property 7: Summary Time Window Correctness
@given(
    time_period=st.sampled_from(["daily", "weekly", "monthly"]),
    num_events=st.integers(min_value=5, max_value=50)
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_property_7_summary_time_window_correctness(time_period, num_events):
    """
    Property 7: Summary Time Window Correctness
    
    For any summary request (daily, weekly, monthly), all events included in the summary 
    should have timestamps within the specified time window (24 hours for daily, 7 days 
    for weekly, 30 days for monthly from the request time), and the summary should include 
    statistics for total events, critical changes, budget updates, and security events.
    
    Validates: Requirements 3.6, 3.7, 3.8, 3.9
    """
    tenant_id = str(uuid.uuid4())
    
    # Calculate expected time window
    end_time = datetime.now()
    if time_period == "daily":
        start_time = end_time - timedelta(days=1)
        expected_hours = 24
    elif time_period == "weekly":
        start_time = end_time - timedelta(days=7)
        expected_hours = 24 * 7
    else:  # monthly
        start_time = end_time - timedelta(days=30)
        expected_hours = 24 * 30
    
    # Generate events within the time window
    events_in_window = []
    for _ in range(num_events):
        # Generate random timestamp within window
        time_delta_seconds = (end_time - start_time).total_seconds()
        random_seconds = (hash(str(uuid.uuid4())) % int(time_delta_seconds))
        timestamp = start_time + timedelta(seconds=random_seconds)
        
        event = {
            "id": str(uuid.uuid4()),
            "event_type": ["user_login", "budget_change", "permission_change"][hash(str(uuid.uuid4())) % 3],
            "user_id": str(uuid.uuid4()),
            "entity_type": "project",
            "entity_id": str(uuid.uuid4()),
            "action_details": {},
            "severity": ["info", "warning", "error", "critical"][hash(str(uuid.uuid4())) % 4],
            "timestamp": timestamp.isoformat(),
            "category": ["Security Change", "Financial Impact", "Resource Allocation"][hash(str(uuid.uuid4())) % 3],
            "risk_level": "Low",
            "tenant_id": tenant_id,
            "is_anomaly": False,
            "tags": {}
        }
        events_in_window.append(event)
    
    # Mock Supabase client
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_lte = Mock()
    mock_execute = Mock()
    
    # Chain the mocks
    mock_execute.data = events_in_window
    mock_lte.execute = Mock(return_value=mock_execute)
    mock_gte.lte = Mock(return_value=mock_lte)
    mock_eq.gte = Mock(return_value=mock_gte)
    mock_select.eq = Mock(return_value=mock_eq)
    mock_table.select = Mock(return_value=mock_select)
    mock_supabase.table = Mock(return_value=mock_table)
    
    # Mock OpenAI client
    mock_openai = Mock()
    mock_chat = Mock()
    mock_completions = Mock()
    
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = "This is a test summary of audit events."
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    
    mock_completions.create = Mock(return_value=mock_response)
    mock_chat.completions = mock_completions
    mock_openai.chat = mock_chat
    
    # Create agent
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Generate summary
    summary = await agent.generate_summary(time_period, tenant_id=tenant_id)
    
    # Verify summary structure
    assert "period" in summary, "Summary should include period"
    assert summary["period"] == time_period, f"Period should be {time_period}"
    
    assert "start_date" in summary, "Summary should include start_date"
    assert "end_date" in summary, "Summary should include end_date"
    
    # Parse dates
    summary_start = datetime.fromisoformat(summary["start_date"])
    summary_end = datetime.fromisoformat(summary["end_date"])
    
    # Verify time window is correct (within 1 minute tolerance for test execution time)
    time_window_hours = (summary_end - summary_start).total_seconds() / 3600
    assert abs(time_window_hours - expected_hours) < 1, \
        f"Time window should be approximately {expected_hours} hours, got {time_window_hours}"
    
    # Verify all required statistics are present
    assert "total_events" in summary, "Summary should include total_events"
    assert "critical_changes" in summary, "Summary should include critical_changes"
    assert "budget_updates" in summary, "Summary should include budget_updates"
    assert "security_events" in summary, "Summary should include security_events"
    assert "anomalies_detected" in summary, "Summary should include anomalies_detected"
    assert "top_users" in summary, "Summary should include top_users"
    assert "top_event_types" in summary, "Summary should include top_event_types"
    assert "category_breakdown" in summary, "Summary should include category_breakdown"
    assert "ai_insights" in summary, "Summary should include ai_insights"
    
    # Verify statistics are calculated correctly
    assert summary["total_events"] == len(events_in_window), \
        f"total_events should be {len(events_in_window)}, got {summary['total_events']}"
    
    # Verify critical changes count
    expected_critical = sum(1 for e in events_in_window if e.get("severity") == "critical")
    assert summary["critical_changes"] == expected_critical, \
        f"critical_changes should be {expected_critical}, got {summary['critical_changes']}"
    
    # Verify budget updates count
    expected_budget = sum(1 for e in events_in_window if "budget" in e.get("event_type", "").lower())
    assert summary["budget_updates"] == expected_budget, \
        f"budget_updates should be {expected_budget}, got {summary['budget_updates']}"
    
    # Verify security events count
    expected_security = sum(1 for e in events_in_window if e.get("category") == "Security Change")
    assert summary["security_events"] == expected_security, \
        f"security_events should be {expected_security}, got {summary['security_events']}"
    
    # Verify anomalies count
    expected_anomalies = sum(1 for e in events_in_window if e.get("is_anomaly"))
    assert summary["anomalies_detected"] == expected_anomalies, \
        f"anomalies_detected should be {expected_anomalies}, got {summary['anomalies_detected']}"
    
    # Verify AI insights is a non-empty string
    assert isinstance(summary["ai_insights"], str), "ai_insights should be a string"
    assert len(summary["ai_insights"]) > 0, "ai_insights should not be empty"


# ============================================================================
# Edge Case Tests
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.property_test
async def test_summary_generation_empty_events():
    """Test summary generation with no events in time window"""
    tenant_id = str(uuid.uuid4())
    
    # Mock Supabase to return empty events
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_lte = Mock()
    mock_execute = Mock()
    
    mock_execute.data = []
    mock_lte.execute = Mock(return_value=mock_execute)
    mock_gte.lte = Mock(return_value=mock_lte)
    mock_eq.gte = Mock(return_value=mock_gte)
    mock_select.eq = Mock(return_value=mock_eq)
    mock_table.select = Mock(return_value=mock_select)
    mock_supabase.table = Mock(return_value=mock_table)
    
    # Mock OpenAI
    mock_openai = Mock()
    mock_chat = Mock()
    mock_completions = Mock()
    
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = "No events in this period."
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    
    mock_completions.create = Mock(return_value=mock_response)
    mock_chat.completions = mock_completions
    mock_openai.chat = mock_chat
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    summary = await agent.generate_summary("daily", tenant_id=tenant_id)
    
    assert summary["total_events"] == 0, "Should have 0 total events"
    assert summary["critical_changes"] == 0, "Should have 0 critical changes"
    assert summary["budget_updates"] == 0, "Should have 0 budget updates"
    assert summary["security_events"] == 0, "Should have 0 security events"


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_summary_generation_invalid_period():
    """Test summary generation with invalid time period"""
    tenant_id = str(uuid.uuid4())
    
    mock_supabase = Mock()
    mock_openai = Mock()
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Should raise ValueError for invalid period
    with pytest.raises(ValueError, match="Invalid time period"):
        await agent.generate_summary("invalid_period", tenant_id=tenant_id)


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_summary_generation_missing_tenant_id():
    """Test that summary generation requires tenant_id"""
    mock_supabase = Mock()
    mock_openai = Mock()
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    # Should raise ValueError when tenant_id is missing
    with pytest.raises(ValueError, match="Tenant ID is required"):
        await agent.generate_summary("daily", tenant_id=None)


@pytest.mark.asyncio
@pytest.mark.property_test
async def test_summary_statistics_consistency():
    """Test that summary statistics are internally consistent"""
    tenant_id = str(uuid.uuid4())
    
    # Create events with known characteristics
    events = [
        {
            "id": str(uuid.uuid4()),
            "event_type": "budget_change",
            "user_id": "user1",
            "entity_type": "project",
            "entity_id": str(uuid.uuid4()),
            "action_details": {},
            "severity": "critical",
            "timestamp": datetime.now().isoformat(),
            "category": "Financial Impact",
            "risk_level": "High",
            "tenant_id": tenant_id,
            "is_anomaly": True,
            "tags": {}
        },
        {
            "id": str(uuid.uuid4()),
            "event_type": "permission_change",
            "user_id": "user2",
            "entity_type": "project",
            "entity_id": str(uuid.uuid4()),
            "action_details": {},
            "severity": "warning",
            "timestamp": datetime.now().isoformat(),
            "category": "Security Change",
            "risk_level": "Medium",
            "tenant_id": tenant_id,
            "is_anomaly": False,
            "tags": {}
        }
    ]
    
    # Mock Supabase
    mock_supabase = Mock()
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_gte = Mock()
    mock_lte = Mock()
    mock_execute = Mock()
    
    mock_execute.data = events
    mock_lte.execute = Mock(return_value=mock_execute)
    mock_gte.lte = Mock(return_value=mock_lte)
    mock_eq.gte = Mock(return_value=mock_gte)
    mock_select.eq = Mock(return_value=mock_eq)
    mock_table.select = Mock(return_value=mock_select)
    mock_supabase.table = Mock(return_value=mock_table)
    
    # Mock OpenAI
    mock_openai = Mock()
    mock_chat = Mock()
    mock_completions = Mock()
    
    mock_response = Mock()
    mock_choice = Mock()
    mock_message = Mock()
    mock_message.content = "Summary of events."
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    
    mock_completions.create = Mock(return_value=mock_response)
    mock_chat.completions = mock_completions
    mock_openai.chat = mock_chat
    
    agent = AuditRAGAgent(mock_supabase, "test-api-key")
    agent.openai_client = mock_openai
    
    summary = await agent.generate_summary("daily", tenant_id=tenant_id)
    
    # Verify statistics match expected values
    assert summary["total_events"] == 2
    assert summary["critical_changes"] == 1  # One critical event
    assert summary["budget_updates"] == 1  # One budget_change event
    assert summary["security_events"] == 1  # One Security Change category
    assert summary["anomalies_detected"] == 1  # One anomaly
    
    # Verify category breakdown
    assert "Financial Impact" in summary["category_breakdown"]
    assert summary["category_breakdown"]["Financial Impact"] == 1
    assert "Security Change" in summary["category_breakdown"]
    assert summary["category_breakdown"]["Security Change"] == 1
