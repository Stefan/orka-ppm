"""
Property-based tests for database connectivity validation.

Feature: pre-startup-testing
Property 8: Database Connection Validation
Property 9: Database Object Existence Checking  
Property 10: Database Permission Testing
"""

import pytest
import os
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from hypothesis import given, strategies as st, settings, HealthCheck
from typing import Dict, Any, List

from .database_connectivity_checker import DatabaseConnectivityChecker
from .models import ValidationConfiguration, ValidationStatus, Severity


class TestDatabaseConnectivityProperties:
    """Property-based tests for database connectivity validation."""
    
    def create_checker(self):
        """Create a database connectivity checker instance."""
        config = ValidationConfiguration(
            timeout_seconds=30,
            parallel_execution=False,  # Disable for testing
            development_mode=True
        )
        return DatabaseConnectivityChecker(config)
    
    @given(
        supabase_url=st.one_of(
            st.none(),
            st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_characters='\x00')),
            st.just("https://test.supabase.co"),
            st.just("invalid-url")
        ),
        supabase_key=st.one_of(
            st.none(),
            st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_characters='\x00')),
            st.just("valid-key-format")
        )
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_8_database_connection_validation(self, supabase_url, supabase_key):
        """
        Property 8: Database Connection Validation
        For any database connectivity test, Supabase connection verification with credential validation must be performed.
        **Validates: Requirements 3.1**
        """
        checker = self.create_checker()
        
        # Mock environment variables
        with patch.dict(os.environ, {
            'SUPABASE_URL': supabase_url or '',
            'SUPABASE_ANON_KEY': supabase_key or ''
        }, clear=False):
            
            # Mock Supabase client creation and connection test
            with patch('pre_startup_testing.database_connectivity_checker.create_client') as mock_create_client:
                mock_client = Mock()
                mock_table = Mock()
                mock_response = Mock()
                mock_response.data = [{"count": 1}]
                
                mock_table.select.return_value.limit.return_value.execute.return_value = mock_response
                mock_client.table.return_value = mock_table
                mock_create_client.return_value = mock_client
                
                # Test connection validation
                result = await checker.test_supabase_connection()
                
                # Property: Connection validation must always be performed
                assert result is not None
                assert hasattr(result, 'test_name')
                assert hasattr(result, 'status')
                assert hasattr(result, 'message')
                assert result.test_name == "supabase_connection"
                
                # Property: Missing credentials must be detected
                if not supabase_url:
                    assert result.status == ValidationStatus.FAIL
                    assert "SUPABASE_URL" in result.message
                    assert result.severity == Severity.CRITICAL
                elif not supabase_key:
                    assert result.status == ValidationStatus.FAIL
                    assert "SUPABASE_ANON_KEY" in result.message
                    assert result.severity == Severity.CRITICAL
                else:
                    # With valid credentials, connection should be attempted
                    if supabase_url and supabase_key:
                        mock_create_client.assert_called_once_with(supabase_url, supabase_key)
    
    @given(
        table_names=st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
            min_size=1,
            max_size=10
        ),
        connection_available=st.booleans()
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_9_database_object_existence_checking(self, table_names, connection_available):
        """
        Property 9: Database Object Existence Checking
        For any required database object (table, function), existence and accessibility verification must be performed.
        **Validates: Requirements 3.2, 3.3**
        """
        checker = self.create_checker()
        
        # Set up mock client based on connection availability
        if connection_available:
            mock_client = Mock()
            checker.supabase_client = mock_client
        else:
            checker.supabase_client = None
        
        # Override critical tables for testing
        original_tables = checker.critical_tables
        checker.critical_tables = table_names
        
        try:
            # Mock table responses
            if connection_available:
                mock_table = Mock()
                mock_response = Mock()
                mock_response.data = [{"count": 1}]
                mock_table.select.return_value.limit.return_value.execute.return_value = mock_response
                mock_client.table.return_value = mock_table
            
            # Test table existence checking
            results = await checker.check_critical_tables()
            
            # Property: All specified tables must be checked
            if not connection_available:
                assert len(results) == 1
                assert results[0].status == ValidationStatus.SKIP
            else:
                assert len(results) == len(table_names)
                
                # Property: Each table must have a corresponding result
                result_names = [result.test_name for result in results]
                for table_name in table_names:
                    expected_test_name = f"table_existence_{table_name}"
                    assert expected_test_name in result_names
                
                # Property: Each result must have required attributes
                for result in results:
                    assert hasattr(result, 'test_name')
                    assert hasattr(result, 'status')
                    assert hasattr(result, 'message')
                    assert hasattr(result, 'details')
                    assert 'table_name' in result.details
                    
                    # Property: Table name must be preserved in details
                    table_name = result.details['table_name']
                    assert table_name in table_names
        
        finally:
            # Restore original tables
            checker.critical_tables = original_tables
    
    @given(
        function_names=st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_')),
            min_size=1,
            max_size=5
        ),
        connection_available=st.booleans(),
        function_responses=st.lists(
            st.one_of(
                st.just([{"test_value": 1}]),  # Valid response
                st.just([]),  # Empty response
                st.just(None)  # Null response
            ),
            min_size=1,
            max_size=5
        )
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_property_10_database_permission_testing(self, function_names, connection_available, function_responses):
        """
        Property 10: Database Permission Testing
        For any database connectivity test, both read and write operations must be tested to verify permissions.
        **Validates: Requirements 3.5**
        """
        checker = self.create_checker()
        
        # Set up mock client based on connection availability
        if connection_available:
            mock_client = Mock()
            checker.supabase_client = mock_client
        else:
            checker.supabase_client = None
        
        # Override required functions for testing
        original_functions = checker.required_functions
        checker.required_functions = function_names[:len(function_responses)]
        
        try:
            if connection_available:
                # Mock function call responses
                def mock_rpc_side_effect(function_name, *args, **kwargs):
                    mock_response = Mock()
                    function_index = checker.required_functions.index(function_name) if function_name in checker.required_functions else 0
                    response_index = min(function_index, len(function_responses) - 1)
                    mock_response.data = function_responses[response_index]
                    mock_response.execute.return_value = mock_response
                    return mock_response
                
                mock_client.rpc.side_effect = mock_rpc_side_effect
            
            # Test function validation
            results = await checker.validate_database_functions()
            
            # Property: Function validation must be performed when connection is available
            if not connection_available:
                assert len(results) == 1
                assert results[0].status == ValidationStatus.SKIP
            else:
                # Property: Each function must be tested
                assert len(results) == len(checker.required_functions)
                
                # Property: Each result must correspond to a function
                result_names = [result.test_name for result in results]
                for function_name in checker.required_functions:
                    expected_test_name = f"function_existence_{function_name}"
                    assert expected_test_name in result_names
                
                # Property: Function validation results must have proper structure
                for result in results:
                    assert hasattr(result, 'test_name')
                    assert hasattr(result, 'status')
                    assert hasattr(result, 'message')
                    assert hasattr(result, 'details')
                    assert 'function_name' in result.details
                    
                    # Property: Function name must be preserved
                    function_name = result.details['function_name']
                    assert function_name in checker.required_functions
            
            # Test permission validation
            permission_results = await checker.test_permissions()
            
            # Property: Permission testing must always be attempted when connection is available
            if not connection_available:
                assert len(permission_results) == 1
                assert permission_results[0].status == ValidationStatus.SKIP
            else:
                # Property: Both read and write permissions must be tested
                test_names = [result.test_name for result in permission_results]
                assert "read_permissions" in test_names
                assert "write_permissions" in test_names
                
                # Property: Each permission test must have proper structure
                for result in permission_results:
                    assert hasattr(result, 'test_name')
                    assert hasattr(result, 'status')
                    assert hasattr(result, 'message')
                    assert hasattr(result, 'details')
                    assert 'operation' in result.details
                    
                    # Property: Operation type must be specified
                    operation = result.details['operation']
                    assert operation in ['read', 'write']
        
        finally:
            # Restore original functions
            checker.required_functions = original_functions
    
    @given(
        error_messages=st.lists(
            st.one_of(
                st.just("Connection timeout"),
                st.just("Permission denied"),
                st.just("Table does not exist"),
                st.just("Function does not exist"),
                st.just("Invalid API key"),
                st.just("Network error"),
                st.just("Syntax error in query")
            ),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_error_guidance_completeness(self, error_messages):
        """
        Test that error guidance is provided for all error types.
        This ensures the enhanced error handling works correctly.
        """
        checker = self.create_checker()
        
        for error_message in error_messages:
            # Property: Error guidance must always be provided
            guidance = checker.get_database_error_guidance("auto_detect", error_message)
            
            assert isinstance(guidance, list)
            assert len(guidance) > 0
            
            # Property: Guidance must contain actionable steps
            assert any(step.strip().startswith(('1.', '2.', '3.', '4.', '5.')) for step in guidance)
            
            # Property: Each guidance step must be non-empty
            for step in guidance:
                assert isinstance(step, str)
                assert len(step.strip()) > 0
    
    @given(
        component_names=st.lists(
            st.one_of(
                st.just("execute_sql"),
                st.just("user_profiles"),
                st.just("portfolios"),
                st.just("financial_tracking"),
                st.text(min_size=1, max_size=50)
            ),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_fallback_suggestions_completeness(self, component_names):
        """
        Test that fallback suggestions are provided for all components.
        This ensures comprehensive error recovery guidance.
        """
        checker = self.create_checker()
        
        for component_name in component_names:
            # Property: Fallback suggestions must always be provided
            suggestions = checker.suggest_fallback_options(component_name)
            
            assert isinstance(suggestions, list)
            assert len(suggestions) > 0
            
            # Property: Suggestions must contain actionable steps
            assert any(step.strip().startswith(('1.', '2.', '3.', '4.', '5.')) for step in suggestions)
            
            # Property: Each suggestion must be non-empty
            for suggestion in suggestions:
                assert isinstance(suggestion, str)
                assert len(suggestion.strip()) > 0
                
            # Property: Component name must be mentioned in suggestions
            suggestions_text = ' '.join(suggestions).lower()
            assert component_name.lower() in suggestions_text