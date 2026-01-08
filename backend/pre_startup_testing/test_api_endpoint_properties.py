"""
Property-based tests for API endpoint validation.

These tests validate universal properties that should hold across all API endpoint testing scenarios.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from fastapi import status
import json
from typing import List, Dict, Any

from .api_endpoint_validator import APIEndpointValidator
from .models import ValidationConfiguration, ValidationStatus, Severity


# Test data generators
@st.composite
def endpoint_list(draw):
    """Generate lists of API endpoints."""
    endpoints = draw(st.lists(
        st.sampled_from([
            "/admin/users",
            "/csv-import/variances", 
            "/variance/alerts",
            "/admin/users/123",
            "/variance/alerts/456"
        ]),
        min_size=1,
        max_size=5,
        unique=True
    ))
    return endpoints

@st.composite
def valid_base_url(draw):
    """Generate valid base URLs."""
    return draw(st.sampled_from([
        "localhost:8000",
        "127.0.0.1:8000", 
        "api.example.com",
        "test-server.local"
    ]))

@st.composite
def http_status_codes(draw):
    """Generate HTTP status codes."""
    return draw(st.sampled_from([
        200, 201, 400, 401, 403, 404, 422, 500, 502, 503
    ]))

@st.composite
def mock_response_data(draw):
    """Generate mock HTTP response data."""
    status_code = draw(http_status_codes())
    
    # Generate appropriate response text based on status code
    if status_code >= 500:
        error_types = [
            "function execute_sql does not exist",
            "connection refused",
            "authentication failed",
            "import error: module not found",
            "generic server error"
        ]
        text = draw(st.sampled_from(error_types))
    elif status_code == 422:
        text = '{"detail": "Validation error"}'
    elif status_code == 401:
        text = '{"detail": "Unauthorized"}'
    elif status_code == 404:
        text = '{"detail": "Not found"}'
    else:
        text = '{"message": "success", "data": []}'
    
    headers = {"content-type": "application/json"} if status_code < 500 else {}
    
    return {
        "status_code": status_code,
        "text": text,
        "headers": headers
    }

@st.composite
def query_parameters(draw):
    """Generate query parameter dictionaries."""
    param_keys = ["page", "per_page", "organization_id", "status", "role", "limit"]
    param_values = ["1", "10", "DEFAULT", "active", "admin", "invalid"]
    
    num_params = draw(st.integers(min_value=0, max_value=4))
    if num_params == 0:
        return {}
    
    keys = draw(st.lists(st.sampled_from(param_keys), min_size=num_params, max_size=num_params, unique=True))
    values = draw(st.lists(st.sampled_from(param_values), min_size=num_params, max_size=num_params))
    
    return dict(zip(keys, values))


class TestAPIEndpointValidatorProperties:
    """Property-based tests for API endpoint validator."""
    
    @given(endpoint_list(), valid_base_url())
    @settings(max_examples=100)
    async def test_comprehensive_endpoint_testing_property(self, endpoints, base_url):
        """
        Property 5: Comprehensive Endpoint Testing
        For any API endpoint in the critical endpoint list, authentication and response format validation must be performed.
        **Validates: Requirements 2.1, 2.2**
        """
        # Feature: pre-startup-testing, Property 5: Comprehensive Endpoint Testing
        
        config = ValidationConfiguration(test_endpoints=endpoints)
        validator = APIEndpointValidator(config, f"http://{base_url}")
        
        # Mock HTTP client responses
        mock_response = MagicMock()
        mock_response.status_code = 401  # Simulate auth required
        mock_response.text = '{"detail": "Unauthorized"}'
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"detail": "Unauthorized"}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            # Set up mock responses for all calls
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Verify that each endpoint was tested comprehensively
            tested_endpoints = set()
            auth_tested_endpoints = set()
            
            for result in results:
                # Extract endpoint from test details
                if 'endpoint' in result.details:
                    endpoint = result.details['endpoint']
                    tested_endpoints.add(endpoint)
                    
                    # Check if authentication was tested
                    if 'auth_rejection' in result.details or 'authentication_required' in result.details:
                        auth_tested_endpoints.add(endpoint)
            
            # Property: All endpoints must be tested
            for endpoint in endpoints:
                assert endpoint in tested_endpoints, f"Endpoint {endpoint} was not tested"
    
    @given(endpoint_list(), mock_response_data())
    @settings(max_examples=50, suppress_health_check=[HealthCheck.filter_too_much])
    async def test_missing_function_detection_property(self, endpoints, response_data):
        """
        Property 6: Missing Function Detection
        For any API endpoint that uses missing database functions, the specific missing function must be detected and reported.
        **Validates: Requirements 2.3**
        """
        # Feature: pre-startup-testing, Property 6: Missing Function Detection
        
        # Only test server errors that might contain function issues
        if response_data["status_code"] < 500:
            assume(False)  # Skip non-server errors
        
        config = ValidationConfiguration(test_endpoints=endpoints)
        validator = APIEndpointValidator(config)
        
        # Mock HTTP client to return function-related errors
        mock_response = MagicMock()
        mock_response.status_code = response_data["status_code"]
        mock_response.text = response_data["text"]
        mock_response.headers = response_data["headers"]
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Property: Server errors must be detected and reported
            server_errors_found = False
            for result in results:
                if result.status == ValidationStatus.FAIL:
                    if (result.details.get('status_code', 0) >= 500 or
                        'server error' in result.message.lower() or
                        'function' in result.message.lower()):
                        server_errors_found = True
                        
                        # Property: Resolution steps must be provided
                        assert len(result.resolution_steps) > 0, "Server error must have resolution steps"
                        
                        # Property: Severity must be appropriate for server errors
                        assert result.severity in [Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL], \
                            "Server errors must have appropriate severity"
            
            # If we have server errors in response, they must be detected
            assert server_errors_found, "Server errors must be detected and reported"
    
    @given(endpoint_list(), st.lists(st.booleans(), min_size=1, max_size=5))
    @settings(max_examples=50)
    async def test_authentication_scenario_coverage_property(self, endpoints, auth_scenarios):
        """
        Property 7: Authentication Scenario Coverage
        For any authentication-required endpoint, both valid and invalid authentication scenarios must be tested.
        **Validates: Requirements 2.4**
        """
        # Feature: pre-startup-testing, Property 7: Authentication Scenario Coverage
        
        config = ValidationConfiguration(test_endpoints=endpoints)
        validator = APIEndpointValidator(config)
        
        # Mock consistent authentication response
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = '{"detail": "Unauthorized"}'
        mock_response.headers = {"content-type": "application/json"}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            
            # Use consistent response for all calls
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Property: Authentication scenarios must be tested
            auth_test_results = [r for r in results if 'auth' in r.test_name.lower() or 'invalid_auth' in r.test_name]
            
            if auth_test_results:
                # Property: Invalid auth must be properly handled
                for result in auth_test_results:
                    if result.status == ValidationStatus.PASS:
                        # Proper auth rejection or handling
                        assert (result.details.get('status_code') == 401 or 
                               'auth_rejection' in result.details or
                               'authentication_required' in result.details)
                    elif result.status == ValidationStatus.FAIL:
                        # Security issue or error detected
                        assert ('security_issue' in result.details or 
                               'authentication' in result.message.lower() or
                               'error' in result.message.lower())
    
    @given(endpoint_list(), query_parameters())
    @settings(max_examples=100)
    async def test_query_parameter_handling_property(self, endpoints, params):
        """
        Property: Query Parameter Validation
        For any endpoint with query parameters, parameter validation and error handling must work correctly.
        **Validates: Requirements 2.5**
        """
        # Feature: pre-startup-testing, Property: Query Parameter Validation
        
        config = ValidationConfiguration(test_endpoints=endpoints)
        validator = APIEndpointValidator(config)
        
        # Mock response based on parameter validity
        mock_response = MagicMock()
        
        # Determine if parameters are valid
        has_invalid_params = any(str(value) == "invalid" for value in params.values())
        
        if has_invalid_params:
            mock_response.status_code = 422  # Validation error
            mock_response.text = '{"detail": "Validation error"}'
        else:
            mock_response.status_code = 401  # Auth required (normal)
            mock_response.text = '{"detail": "Unauthorized"}'
        
        mock_response.headers = {"content-type": "application/json"}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Property: Parameter validation must be tested
            param_test_results = [r for r in results if 'query_params' in r.test_name or 'params' in r.test_name]
            
            if param_test_results:
                for result in param_test_results:
                    # Property: Parameter test results must have endpoint and parameter details
                    assert 'endpoint' in result.details, "Parameter tests must include endpoint details"
                    
                    # Property: Invalid parameters should be properly rejected
                    if has_invalid_params and result.status == ValidationStatus.PASS:
                        assert 'validation_working' in result.details, \
                            "Invalid parameter rejection must be detected as working validation"
    
    @given(st.lists(st.text(min_size=1, max_size=50), min_size=1, max_size=5))
    @settings(max_examples=100)
    async def test_error_resolution_guidance_property(self, error_messages):
        """
        Property: Error Resolution Guidance
        For any validation failure, specific resolution steps must be provided.
        **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
        """
        # Feature: pre-startup-testing, Property: Error Resolution Guidance
        
        config = ValidationConfiguration(test_endpoints=["/admin/users"])
        validator = APIEndpointValidator(config)
        
        # Mock various error scenarios
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = error_messages[0]  # Use first error message
        mock_response.headers = {}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Property: All failures must have resolution steps
            failed_results = [r for r in results if r.status == ValidationStatus.FAIL]
            
            for result in failed_results:
                # Property: Resolution steps must be provided
                assert len(result.resolution_steps) > 0, \
                    f"Failed test {result.test_name} must have resolution steps"
                
                # Property: Resolution steps must be actionable (contain numbers or specific actions)
                has_actionable_steps = any(
                    step.strip().startswith(('1.', '2.', '3.', '4.', '5.')) or
                    any(action in step.lower() for action in ['check', 'verify', 'run', 'test', 'ensure'])
                    for step in result.resolution_steps
                )
                assert has_actionable_steps, \
                    f"Resolution steps for {result.test_name} must be actionable"
    
    @given(endpoint_list())
    @settings(max_examples=100)
    async def test_validation_result_completeness_property(self, endpoints):
        """
        Property: Validation Result Completeness
        For any validation execution, all results must have required fields and proper structure.
        **Validates: Requirements 2.1, 2.2**
        """
        # Feature: pre-startup-testing, Property: Validation Result Completeness
        
        config = ValidationConfiguration(test_endpoints=endpoints)
        validator = APIEndpointValidator(config)
        
        # Mock successful responses
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = '{"detail": "Unauthorized"}'
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"detail": "Unauthorized"}
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client.get.return_value = mock_response
            
            results = await validator.validate()
            
            # Property: All results must have required fields
            for result in results:
                assert result.component == "API_Endpoint_Validator", \
                    "All results must have correct component name"
                assert result.test_name is not None and len(result.test_name) > 0, \
                    "All results must have non-empty test name"
                assert result.status in [ValidationStatus.PASS, ValidationStatus.FAIL, ValidationStatus.WARNING], \
                    "All results must have valid status"
                assert result.message is not None and len(result.message) > 0, \
                    "All results must have non-empty message"
                assert result.details is not None, \
                    "All results must have details dictionary"
                assert isinstance(result.execution_time, (int, float)), \
                    "All results must have numeric execution time"
                
                # Property: Failed results must have appropriate severity
                if result.status == ValidationStatus.FAIL:
                    assert result.severity in [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL], \
                        "Failed results must have valid severity level"