#!/usr/bin/env python3
"""
Property-based tests for migration verification error reporting

**Feature: user-synchronization, Property 15: Migration Verification Error Reporting**
**Validates: Requirements 5.5**
"""

import pytest
from hypothesis import given, strategies as st, settings
from typing import List, Dict, Any
from unittest.mock import Mock, patch, MagicMock
from user_management_migration_verifier import (
    UserManagementMigrationVerifier, 
    MigrationStatus, 
    MigrationError
)

class TestMigrationVerificationErrorReporting:
    """Test migration verification error reporting properties"""
    
    def setup_method(self):
        """Setup test environment"""
        # Mock the Supabase client to avoid real database connections
        with patch('user_management_migration_verifier.create_client'):
            self.verifier = UserManagementMigrationVerifier()
            self.verifier.supabase = Mock()
            # Ensure clean state for each test
            self.verifier.errors = []
            self.verifier.detailed_errors = []
    
    @given(
        table_name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
        error_message=st.text(min_size=1, max_size=200)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_15_migration_verification_error_reporting(self, table_name: str, error_message: str):
        """
        Property 15: Migration Verification Error Reporting
        
        For any migration verification failure, the system should provide detailed 
        error information describing what failed
        
        **Validates: Requirements 5.5**
        """
        # Setup: Mock a table verification failure
        mock_exception = Exception(error_message)
        self.verifier.supabase.table.return_value.select.return_value.limit.return_value.execute.side_effect = mock_exception
        
        # Action: Attempt to verify table exists
        result = self.verifier.verify_table_exists(table_name)
        
        # Verification: Should return False for failed verification
        assert result is False, f"Expected table verification to fail for table '{table_name}'"
        
        # Verification: Should have detailed error information
        assert len(self.verifier.detailed_errors) > 0, "Expected detailed errors to be recorded"
        
        # Get the error that was added
        error = self.verifier.detailed_errors[-1]  # Most recent error
        
        # Verify error contains required information
        assert error.component_type == "table", f"Expected component_type 'table', got '{error.component_type}'"
        assert error.component_name == table_name, f"Expected component_name '{table_name}', got '{error.component_name}'"
        assert error.error_type in ["missing", "access_denied", "unknown"], f"Expected valid error_type, got '{error.error_type}'"
        assert len(error.error_message) > 0, "Expected non-empty error message"
        assert len(error.suggested_fix) > 0, "Expected non-empty suggested fix"
        assert error.severity in ["critical", "warning", "info"], f"Expected valid severity, got '{error.severity}'"
        
        # Verify error message contains original error information
        assert error_message in error.error_message or "does not exist" in error.error_message or "permission denied" in error.error_message, \
            "Expected error message to contain relevant information about the failure"
    
    @given(
        function_name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
        error_scenario=st.sampled_from(["function_missing", "permission_denied", "unknown_error"])
    )
    @settings(max_examples=50, deadline=None)
    def test_function_verification_error_reporting(self, function_name: str, error_scenario: str):
        """Test that function verification failures provide detailed error information"""
        # Setup different error scenarios
        if error_scenario == "function_missing":
            error_msg = f"function {function_name}() does not exist"
        elif error_scenario == "permission_denied":
            error_msg = "permission denied for function"
        else:
            error_msg = "unknown database error"
        
        # Mock both RPC calls to fail
        self.verifier.supabase.rpc.side_effect = Exception(error_msg)
        
        # Action: Attempt to verify function exists
        result = self.verifier.verify_function_exists(function_name)
        
        # Verification: Should return False and have detailed error
        assert result is False, f"Expected function verification to fail for function '{function_name}'"
        assert len(self.verifier.detailed_errors) > 0, "Expected detailed errors to be recorded"
        
        # Get the function-related error
        function_errors = [e for e in self.verifier.detailed_errors if e.component_type == "function"]
        assert len(function_errors) > 0, "Expected at least one function-related error"
        
        error = function_errors[-1]  # Most recent function error
        assert error.component_name == function_name, f"Expected function name '{function_name}', got '{error.component_name}'"
        assert len(error.suggested_fix) > 0, "Expected suggested fix for function error"
    
    @given(
        component_types=st.lists(
            st.sampled_from(["table", "function", "trigger", "index", "policy"]),
            min_size=1, max_size=5, unique=True
        ),
        severities=st.lists(
            st.sampled_from(["critical", "warning", "info"]),
            min_size=1, max_size=3
        )
    )
    @settings(max_examples=30, deadline=None)
    def test_error_categorization_and_reporting(self, component_types: List[str], severities: List[str]):
        """Test that errors are properly categorized by type and severity"""
        # Ensure clean state for this test
        self.verifier.errors = []
        self.verifier.detailed_errors = []
        
        # Setup: Add various types of errors
        for i, component_type in enumerate(component_types):
            severity = severities[i % len(severities)]
            self.verifier._add_detailed_error(
                component_type=component_type,
                component_name=f"test_{component_type}_{i}",
                error_type="test_error",
                error_message=f"Test error for {component_type}",
                suggested_fix=f"Fix the {component_type} issue",
                severity=severity
            )
        
        # Verification: All errors should be recorded
        assert len(self.verifier.detailed_errors) == len(component_types), \
            f"Expected {len(component_types)} errors, got {len(self.verifier.detailed_errors)}"
        
        # Verification: Each error should have proper structure
        for error in self.verifier.detailed_errors:
            assert error.component_type in component_types, f"Unexpected component type: {error.component_type}"
            assert error.severity in severities, f"Unexpected severity: {error.severity}"
            assert len(error.error_message) > 0, "Expected non-empty error message"
            assert len(error.suggested_fix) > 0, "Expected non-empty suggested fix"
            assert error.component_name.startswith("test_"), "Expected test component name"
        
        # Verification: Errors should be categorizable by severity
        critical_errors = [e for e in self.verifier.detailed_errors if e.severity == "critical"]
        warning_errors = [e for e in self.verifier.detailed_errors if e.severity == "warning"]
        info_errors = [e for e in self.verifier.detailed_errors if e.severity == "info"]
        
        total_by_severity = len(critical_errors) + len(warning_errors) + len(info_errors)
        assert total_by_severity == len(self.verifier.detailed_errors), \
            "All errors should be categorized by severity"
    
    @given(
        num_errors=st.integers(min_value=1, max_value=10),
        include_critical=st.booleans(),
        include_warnings=st.booleans(),
        include_info=st.booleans()
    )
    @settings(max_examples=50, deadline=None)
    def test_migration_status_includes_detailed_errors(self, num_errors: int, include_critical: bool, include_warnings: bool, include_info: bool):
        """Test that migration status includes all detailed error information"""
        # Ensure clean state for this test
        self.verifier.errors = []
        self.verifier.detailed_errors = []
        
        # Ensure at least one severity type is included
        if not (include_critical or include_warnings or include_info):
            include_critical = True
        
        # Setup: Add errors of different severities
        severities = []
        if include_critical:
            severities.append("critical")
        if include_warnings:
            severities.append("warning")
        if include_info:
            severities.append("info")
        
        for i in range(num_errors):
            severity = severities[i % len(severities)]
            self.verifier._add_detailed_error(
                component_type="table",
                component_name=f"test_table_{i}",
                error_type="test_error",
                error_message=f"Test error {i}",
                suggested_fix=f"Fix error {i}",
                severity=severity
            )
        
        # Mock the verification to return a status
        with patch.object(self.verifier, 'verify_table_exists', return_value=False), \
             patch.object(self.verifier, 'verify_table_structure', return_value=False), \
             patch.object(self.verifier, 'verify_function_exists', return_value=False), \
             patch.object(self.verifier, 'verify_trigger_exists', return_value=False), \
             patch.object(self.verifier, 'verify_index_exists', return_value=False), \
             patch.object(self.verifier, 'verify_rls_enabled', return_value=False):
            
            # Suppress print output during test
            with patch('builtins.print'):
                status = self.verifier.verify_migration_status()
        
        # Verification: Status should include all detailed errors
        assert len(status.detailed_errors) >= num_errors, \
            f"Expected at least {num_errors} detailed errors in status, got {len(status.detailed_errors)}"
        
        # Verification: Status should not pass if there are critical errors
        if include_critical:
            critical_errors_in_status = [e for e in status.detailed_errors if e.severity == "critical"]
            if critical_errors_in_status:
                assert not status.verification_passed, \
                    "Migration status should not pass when critical errors are present"
        
        # Verification: All errors should have required fields
        for error in status.detailed_errors:
            assert hasattr(error, 'component_type'), "Error should have component_type"
            assert hasattr(error, 'component_name'), "Error should have component_name"
            assert hasattr(error, 'error_type'), "Error should have error_type"
            assert hasattr(error, 'error_message'), "Error should have error_message"
            assert hasattr(error, 'suggested_fix'), "Error should have suggested_fix"
            assert hasattr(error, 'severity'), "Error should have severity"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])