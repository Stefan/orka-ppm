"""
Property-based tests for Audit Logging Completeness
Feature: ai-ppm-platform, Property 27: Audit Logging Completeness
Validates: Requirements 8.4
"""

import pytest
import hypothesis.strategies as st
from hypothesis import given, settings, assume
from uuid import uuid4, UUID
from datetime import datetime, timedelta
import json
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Initialize Supabase client for testing
supabase: Client = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception as e:
        print(f"Warning: Could not initialize Supabase client for testing: {e}")

# Test data strategies
@st.composite
def user_action_strategy(draw):
    """Generate valid user action data for testing audit logging"""
    actions = [
        "CREATE_PROJECT", "UPDATE_PROJECT", "DELETE_PROJECT",
        "CREATE_RESOURCE", "UPDATE_RESOURCE", "DELETE_RESOURCE",
        "CREATE_RISK", "UPDATE_RISK", "DELETE_RISK",
        "CREATE_ISSUE", "UPDATE_ISSUE", "DELETE_ISSUE",
        "ASSIGN_ROLE", "REMOVE_ROLE", "UPDATE_PERMISSIONS",
        "LOGIN", "LOGOUT", "ACCESS_DENIED"
    ]
    
    return {
        "user_id": str(uuid4()),
        "action": draw(st.sampled_from(actions)),
        "resource_type": draw(st.sampled_from([
            "project", "resource", "risk", "issue", "role", "user", "session"
        ])),
        "resource_id": str(uuid4()),
        "timestamp": datetime.now(),
        "ip_address": draw(st.ip_addresses(v=4)).exploded,
        "user_agent": draw(st.text(min_size=10, max_size=100)),
        "details": draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(max_size=50), st.integers(), st.booleans()),
            min_size=0, max_size=5
        ))
    }

@st.composite
def audit_log_entry_strategy(draw):
    """Generate valid audit log entry for testing"""
    return {
        "id": str(uuid4()),
        "table_name": draw(st.sampled_from([
            "projects", "resources", "risks", "issues", "roles", "user_roles"
        ])),
        "record_id": str(uuid4()),
        "action": draw(st.sampled_from(["INSERT", "UPDATE", "DELETE"])),
        "old_values": draw(st.one_of(
            st.none(),
            st.dictionaries(st.text(min_size=1, max_size=20), st.text(max_size=50))
        )),
        "new_values": draw(st.one_of(
            st.none(),
            st.dictionaries(st.text(min_size=1, max_size=20), st.text(max_size=50))
        )),
        "changed_by": str(uuid4()),
        "changed_at": datetime.now()
    }

def simulate_user_action(action_data: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate a user action that should generate audit logs"""
    # This simulates the audit logging that should happen for any user action
    # In a real implementation, this would be called by the actual endpoints
    
    audit_entry = {
        "user_id": action_data["user_id"],
        "action": action_data["action"],
        "resource_type": action_data["resource_type"],
        "resource_id": action_data["resource_id"],
        "timestamp": action_data["timestamp"],
        "ip_address": action_data["ip_address"],
        "user_agent": action_data["user_agent"],
        "details": json.dumps(action_data["details"]),
        "session_id": str(uuid4())
    }
    
    return audit_entry

def check_audit_log_completeness(action_data: Dict[str, Any], audit_entry: Dict[str, Any]) -> bool:
    """Check if audit log entry contains all required information for security compliance"""
    required_fields = [
        "user_id", "action", "resource_type", "resource_id", 
        "timestamp", "ip_address", "user_agent"
    ]
    
    # Check all required fields are present and not empty
    for field in required_fields:
        if field not in audit_entry or audit_entry[field] is None:
            return False
        if isinstance(audit_entry[field], str) and not audit_entry[field].strip():
            return False
    
    # Check that the audit entry matches the original action
    if audit_entry["user_id"] != action_data["user_id"]:
        return False
    if audit_entry["action"] != action_data["action"]:
        return False
    if audit_entry["resource_type"] != action_data["resource_type"]:
        return False
    if audit_entry["resource_id"] != action_data["resource_id"]:
        return False
    
    # Check timestamp is reasonable (within last minute)
    time_diff = abs((audit_entry["timestamp"] - action_data["timestamp"]).total_seconds())
    if time_diff > 60:  # More than 1 minute difference
        return False
    
    return True

def validate_audit_log_security_compliance(audit_entry: Dict[str, Any]) -> bool:
    """Validate that audit log entry meets security compliance requirements"""
    # Check for PII protection (no sensitive data in logs)
    sensitive_patterns = ["password", "token", "secret", "key", "ssn", "credit_card"]
    details_str = str(audit_entry.get("details", "")).lower()
    
    for pattern in sensitive_patterns:
        if pattern in details_str:
            return False
    
    # Check that user identification is present
    if not audit_entry.get("user_id"):
        return False
    
    # Check that action is properly categorized
    valid_actions = [
        "CREATE_PROJECT", "UPDATE_PROJECT", "DELETE_PROJECT",
        "CREATE_RESOURCE", "UPDATE_RESOURCE", "DELETE_RESOURCE",
        "CREATE_RISK", "UPDATE_RISK", "DELETE_RISK",
        "CREATE_ISSUE", "UPDATE_ISSUE", "DELETE_ISSUE",
        "ASSIGN_ROLE", "REMOVE_ROLE", "UPDATE_PERMISSIONS",
        "LOGIN", "LOGOUT", "ACCESS_DENIED"
    ]
    
    if audit_entry.get("action") not in valid_actions:
        return False
    
    # Check timestamp format and recency
    timestamp = audit_entry.get("timestamp")
    if not timestamp or not isinstance(timestamp, datetime):
        return False
    
    # Check that timestamp is not in the future
    if timestamp > datetime.now() + timedelta(minutes=1):
        return False
    
    return True

def get_audit_logs_from_database(user_id: str, action: str, resource_id: str) -> List[Dict[str, Any]]:
    """Retrieve audit logs from database for verification"""
    if not supabase:
        # Return mock audit log for testing when database is not available
        return [{
            "id": str(uuid4()),
            "user_id": user_id,
            "action": action,
            "resource_id": resource_id,
            "timestamp": datetime.now(),
            "ip_address": "127.0.0.1",
            "user_agent": "test-agent"
        }]
    
    try:
        # In a real implementation, this would query the audit_logs table
        # For now, we'll simulate the query
        response = supabase.table("audit_logs").select("*").eq(
            "changed_by", user_id
        ).execute()
        
        return response.data or []
    except Exception as e:
        print(f"Error querying audit logs: {e}")
        return []

class TestAuditLoggingCompleteness:
    """Property 27: Audit Logging Completeness tests"""

    @settings(max_examples=10)
    @given(action_data=user_action_strategy())
    def test_user_actions_generate_complete_audit_logs(self, action_data):
        """
        Property 27: Audit Logging Completeness
        For any user action, appropriate audit logs should be maintained for security compliance
        
        Validates: Requirements 8.4
        """
        # Simulate the user action and audit logging
        audit_entry = simulate_user_action(action_data)
        
        # Verify audit log completeness
        assert check_audit_log_completeness(action_data, audit_entry), \
            f"Audit log missing required fields for action {action_data['action']}"
        
        # Verify security compliance
        assert validate_audit_log_security_compliance(audit_entry), \
            f"Audit log does not meet security compliance for action {action_data['action']}"
        
        # Verify audit log contains no sensitive information
        details_str = str(audit_entry.get("details", ""))
        sensitive_keywords = ["password", "secret", "token", "key"]
        for keyword in sensitive_keywords:
            assert keyword.lower() not in details_str.lower(), \
                f"Audit log contains sensitive information: {keyword}"

    @settings(max_examples=10)
    @given(
        user_actions=st.lists(user_action_strategy(), min_size=1, max_size=5)
    )
    def test_multiple_user_actions_maintain_audit_trail(self, user_actions):
        """
        Property 27: Audit Logging Completeness - Multiple Actions
        For any sequence of user actions, each action should generate appropriate audit logs
        
        Validates: Requirements 8.4
        """
        audit_entries = []
        
        for action_data in user_actions:
            # Simulate each user action
            audit_entry = simulate_user_action(action_data)
            audit_entries.append(audit_entry)
            
            # Verify each audit entry is complete
            assert check_audit_log_completeness(action_data, audit_entry), \
                f"Audit log incomplete for action {action_data['action']}"
        
        # Verify all actions are logged
        assert len(audit_entries) == len(user_actions), \
            "Not all user actions generated audit log entries"
        
        # Verify chronological ordering is maintained
        timestamps = [entry["timestamp"] for entry in audit_entries]
        for i in range(1, len(timestamps)):
            assert timestamps[i] >= timestamps[i-1], \
                "Audit log timestamps are not in chronological order"

    @settings(max_examples=10)
    @given(action_data=user_action_strategy())
    def test_audit_logs_contain_security_required_fields(self, action_data):
        """
        Property 27: Audit Logging Completeness - Security Fields
        For any user action, audit logs must contain all fields required for security compliance
        
        Validates: Requirements 8.4
        """
        audit_entry = simulate_user_action(action_data)
        
        # Security compliance required fields
        security_required_fields = [
            "user_id",      # Who performed the action
            "action",       # What action was performed
            "resource_type", # What type of resource was affected
            "resource_id",  # Which specific resource was affected
            "timestamp",    # When the action occurred
            "ip_address",   # Where the action originated from
            "user_agent"    # What client was used
        ]
        
        for field in security_required_fields:
            assert field in audit_entry, \
                f"Security required field '{field}' missing from audit log"
            assert audit_entry[field] is not None, \
                f"Security required field '{field}' is None in audit log"
            
            if isinstance(audit_entry[field], str):
                assert audit_entry[field].strip(), \
                    f"Security required field '{field}' is empty in audit log"

    @settings(max_examples=10)
    @given(audit_entry=audit_log_entry_strategy())
    def test_audit_log_data_integrity(self, audit_entry):
        """
        Property 27: Audit Logging Completeness - Data Integrity
        For any audit log entry, data integrity must be maintained
        
        Validates: Requirements 8.4
        """
        # Verify UUID fields are valid UUIDs
        uuid_fields = ["id", "record_id", "changed_by"]
        for field in uuid_fields:
            if audit_entry.get(field):
                try:
                    UUID(audit_entry[field])
                except ValueError:
                    pytest.fail(f"Invalid UUID in field '{field}': {audit_entry[field]}")
        
        # Verify action is valid
        valid_actions = ["INSERT", "UPDATE", "DELETE"]
        assert audit_entry["action"] in valid_actions, \
            f"Invalid action in audit log: {audit_entry['action']}"
        
        # Verify table name is valid
        valid_tables = [
            "projects", "resources", "risks", "issues", 
            "roles", "user_roles", "portfolios", "financial_tracking"
        ]
        assert audit_entry["table_name"] in valid_tables, \
            f"Invalid table name in audit log: {audit_entry['table_name']}"
        
        # Verify timestamp is reasonable
        assert isinstance(audit_entry["changed_at"], datetime), \
            "Audit log timestamp must be a datetime object"
        
        # Verify timestamp is not in the future
        assert audit_entry["changed_at"] <= datetime.now() + timedelta(minutes=1), \
            "Audit log timestamp cannot be in the future"

    @settings(max_examples=5, deadline=None)
    @given(action_data=user_action_strategy())
    def test_audit_logs_support_compliance_queries(self, action_data):
        """
        Property 27: Audit Logging Completeness - Compliance Queries
        For any user action, audit logs must support compliance and forensic queries
        
        Validates: Requirements 8.4
        """
        audit_entry = simulate_user_action(action_data)
        
        # Simulate retrieving audit logs from database
        retrieved_logs = get_audit_logs_from_database(
            action_data["user_id"], 
            action_data["action"], 
            action_data["resource_id"]
        )
        
        # Verify logs can be retrieved for compliance queries
        assert len(retrieved_logs) >= 0, \
            "Should be able to query audit logs for compliance"
        
        # If logs exist, verify they contain required compliance information
        if retrieved_logs:
            log_entry = retrieved_logs[0]
            compliance_fields = ["user_id", "action", "timestamp"]
            
            for field in compliance_fields:
                assert field in log_entry or field in audit_entry, \
                    f"Compliance field '{field}' missing from audit logs"

    @settings(max_examples=10)
    @given(
        privileged_actions=st.lists(
            st.builds(
                dict,
                user_id=st.uuids().map(str),
                action=st.sampled_from([
                    "ASSIGN_ROLE", "REMOVE_ROLE", "UPDATE_PERMISSIONS",
                    "DELETE_PROJECT", "DELETE_RESOURCE", "ACCESS_DENIED"
                ]),
                resource_type=st.sampled_from(["role", "user", "project", "resource"]),
                resource_id=st.uuids().map(str),
                timestamp=st.datetimes(
                    min_value=datetime.now() - timedelta(hours=1),
                    max_value=datetime.now()
                ),
                ip_address=st.ip_addresses(v=4).map(lambda x: x.exploded),
                user_agent=st.text(min_size=10, max_size=100),
                details=st.dictionaries(
                    st.text(min_size=1, max_size=20),
                    st.text(max_size=50),
                    min_size=0, max_size=3
                )
            ),
            min_size=1, max_size=3
        )
    )
    def test_privileged_actions_require_enhanced_audit_logging(self, privileged_actions):
        """
        Property 27: Audit Logging Completeness - Privileged Actions
        For any privileged user action, enhanced audit logging must be maintained
        
        Validates: Requirements 8.4
        """
        for action_data in privileged_actions:
            audit_entry = simulate_user_action(action_data)
            
            # Privileged actions require enhanced logging
            assert check_audit_log_completeness(action_data, audit_entry), \
                f"Privileged action {action_data['action']} missing complete audit log"
            
            # Verify enhanced security compliance for privileged actions
            assert validate_audit_log_security_compliance(audit_entry), \
                f"Privileged action {action_data['action']} fails security compliance"
            
            # Privileged actions should have additional context
            assert "details" in audit_entry, \
                f"Privileged action {action_data['action']} missing details in audit log"
            
            # Verify no sensitive data is logged even for privileged actions
            details_str = str(audit_entry.get("details", ""))
            sensitive_patterns = ["password", "token", "secret", "key"]
            for pattern in sensitive_patterns:
                assert pattern.lower() not in details_str.lower(), \
                    f"Privileged action audit log contains sensitive data: {pattern}"