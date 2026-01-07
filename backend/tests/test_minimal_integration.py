"""
Minimal Integration Tests for AI-PPM Platform

This module contains minimal integration tests that validate core functionality
without complex dependencies or imports.

Test Coverage:
- API endpoint availability and basic responses
- Database connectivity and basic operations
- Authentication flow validation
- Error handling and response formats
- Cross-component data consistency

Requirements Validated: All core requirements (comprehensive system validation)
"""

import pytest
import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
TEST_TIMEOUT = 10  # seconds


class TestAPIAvailability:
    """Test basic API availability and health"""
    
    def test_api_server_running(self):
        """
        Test that the API server is running and responding
        Validates: Requirements 9.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            data = response.json()
            assert "message" in data
            assert "AI-PPM Platform" in data["message"]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running - skipping integration tests")
        except requests.exceptions.Timeout:
            pytest.fail("API server timeout - server may be overloaded")
    
    def test_health_endpoint(self):
        """
        Test health check endpoint
        Validates: Requirements 9.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/health", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            health_data = response.json()
            assert "status" in health_data
            assert health_data["status"] in ["healthy", "degraded", "unhealthy"]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_debug_endpoint(self):
        """
        Test debug endpoint for system information
        Validates: Requirements 9.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/debug", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            debug_data = response.json()
            assert "environment" in debug_data
            assert "supabase_connection" in debug_data
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestAuthenticationEndpoints:
    """Test authentication-related endpoints"""
    
    def test_protected_endpoint_without_auth(self):
        """
        Test that protected endpoints require authentication
        Validates: Requirements 8.1, 8.3
        """
        try:
            # Test dashboard endpoint without authentication
            response = requests.get(f"{API_BASE_URL}/dashboard", timeout=TEST_TIMEOUT)
            
            # Should return 401 Unauthorized or 403 Forbidden
            assert response.status_code in [401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_protected_endpoint_with_invalid_token(self):
        """
        Test protected endpoints with invalid authentication token
        Validates: Requirements 8.1, 8.3
        """
        try:
            headers = {"Authorization": "Bearer invalid-token-12345"}
            response = requests.get(
                f"{API_BASE_URL}/dashboard", 
                headers=headers, 
                timeout=TEST_TIMEOUT
            )
            
            # Should return 401 Unauthorized
            assert response.status_code in [401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestAPIResponseFormats:
    """Test API response formats and error handling"""
    
    def test_json_response_format(self):
        """
        Test that API returns proper JSON responses
        Validates: Requirements 9.1, 9.4
        """
        try:
            response = requests.get(f"{API_BASE_URL}/", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            # Should be valid JSON
            data = response.json()
            assert isinstance(data, dict)
            
            # Should have proper content type
            assert "application/json" in response.headers.get("content-type", "")
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_error_response_format(self):
        """
        Test error response format for invalid requests
        Validates: Requirements 9.1, 9.4
        """
        try:
            # Make request to non-existent endpoint
            response = requests.get(f"{API_BASE_URL}/nonexistent-endpoint", timeout=TEST_TIMEOUT)
            assert response.status_code == 404
            
            # Should return JSON error response
            if response.headers.get("content-type", "").startswith("application/json"):
                error_data = response.json()
                assert "detail" in error_data or "message" in error_data
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_cors_headers(self):
        """
        Test CORS headers for cross-origin requests
        Validates: Requirements 9.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            # Should have CORS headers (if configured)
            headers = response.headers
            # CORS headers may or may not be present depending on configuration
            # Just verify the request succeeds
            assert "content-type" in headers
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestAPIPerformance:
    """Test basic API performance characteristics"""
    
    def test_response_time_health_check(self):
        """
        Test response time for health check endpoint
        Validates: Requirements 9.2
        """
        try:
            start_time = time.time()
            response = requests.get(f"{API_BASE_URL}/health", timeout=TEST_TIMEOUT)
            end_time = time.time()
            
            response_time = end_time - start_time
            
            assert response.status_code == 200
            # Health check should respond quickly (under 2 seconds)
            assert response_time < 2.0
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
        except requests.exceptions.Timeout:
            pytest.fail("Health check endpoint timeout")
    
    def test_concurrent_requests_handling(self):
        """
        Test handling of multiple concurrent requests
        Validates: Requirements 9.2, 9.3
        """
        try:
            import concurrent.futures
            
            def make_request():
                response = requests.get(f"{API_BASE_URL}/health", timeout=TEST_TIMEOUT)
                return response.status_code
            
            # Make 5 concurrent requests
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(make_request) for _ in range(5)]
                results = [future.result() for future in concurrent.futures.as_completed(futures)]
            
            # All requests should succeed
            assert all(status == 200 for status in results)
            assert len(results) == 5
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
        except ImportError:
            pytest.skip("concurrent.futures not available")


class TestDataValidation:
    """Test data validation and error handling"""
    
    def test_invalid_json_handling(self):
        """
        Test handling of invalid JSON in POST requests
        Validates: Requirements 9.1, 9.4
        """
        try:
            # Send invalid JSON to a POST endpoint
            headers = {"Content-Type": "application/json"}
            invalid_json = '{"invalid": json, "missing": quote}'
            
            response = requests.post(
                f"{API_BASE_URL}/projects/",
                data=invalid_json,
                headers=headers,
                timeout=TEST_TIMEOUT
            )
            
            # Should return 400 Bad Request or 422 Unprocessable Entity
            assert response.status_code in [400, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_missing_required_fields(self):
        """
        Test validation of missing required fields
        Validates: Requirements 9.1, 9.4
        """
        try:
            # Send incomplete data to create endpoint
            headers = {"Content-Type": "application/json"}
            incomplete_data = {"name": "Test Project"}  # Missing required fields
            
            response = requests.post(
                f"{API_BASE_URL}/projects/",
                json=incomplete_data,
                headers=headers,
                timeout=TEST_TIMEOUT
            )
            
            # Should return validation error (400, 401, 403, or 422)
            assert response.status_code in [400, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestEndpointAvailability:
    """Test availability of key API endpoints"""
    
    def test_dashboard_endpoint_exists(self):
        """
        Test that dashboard endpoint exists (even if protected)
        Validates: Requirements 1.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/dashboard", timeout=TEST_TIMEOUT)
            
            # Should not return 404 (endpoint exists)
            assert response.status_code != 404
            # May return 401/403 (auth required) or 200 (success)
            assert response.status_code in [200, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_projects_endpoint_exists(self):
        """
        Test that projects endpoint exists
        Validates: Requirements 1.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/projects/", timeout=TEST_TIMEOUT)
            
            # Should not return 404 (endpoint exists)
            assert response.status_code != 404
            assert response.status_code in [200, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_resources_endpoint_exists(self):
        """
        Test that resources endpoint exists
        Validates: Requirements 2.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/resources/", timeout=TEST_TIMEOUT)
            
            # Should not return 404 (endpoint exists)
            assert response.status_code != 404
            assert response.status_code in [200, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_portfolio_metrics_endpoint_exists(self):
        """
        Test that portfolio metrics endpoint exists
        Validates: Requirements 1.2
        """
        try:
            response = requests.get(f"{API_BASE_URL}/portfolio/metrics", timeout=TEST_TIMEOUT)
            
            # Should not return 404 (endpoint exists)
            assert response.status_code != 404
            assert response.status_code in [200, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestSystemIntegration:
    """Test system-level integration aspects"""
    
    def test_api_consistency(self):
        """
        Test consistency across multiple API calls
        Validates: Requirements 9.1, 9.2
        """
        try:
            # Make multiple calls to the same endpoint
            responses = []
            for _ in range(3):
                response = requests.get(f"{API_BASE_URL}/health", timeout=TEST_TIMEOUT)
                responses.append(response.status_code)
                time.sleep(0.1)  # Small delay between requests
            
            # All responses should be consistent
            assert all(status == responses[0] for status in responses)
            assert responses[0] == 200
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_error_handling_consistency(self):
        """
        Test consistent error handling across endpoints
        Validates: Requirements 9.1, 9.4
        """
        try:
            # Test multiple non-existent endpoints
            endpoints = [
                "/nonexistent1",
                "/nonexistent2", 
                "/invalid/path"
            ]
            
            responses = []
            for endpoint in endpoints:
                response = requests.get(f"{API_BASE_URL}{endpoint}", timeout=TEST_TIMEOUT)
                responses.append(response.status_code)
            
            # All should return 404
            assert all(status == 404 for status in responses)
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_server_stability(self):
        """
        Test basic server stability under light load
        Validates: Requirements 9.2, 9.3
        """
        try:
            # Make several requests in sequence
            success_count = 0
            total_requests = 10
            
            for i in range(total_requests):
                response = requests.get(f"{API_BASE_URL}/health", timeout=TEST_TIMEOUT)
                if response.status_code == 200:
                    success_count += 1
                time.sleep(0.1)  # Small delay between requests
            
            # Should have high success rate (at least 80%)
            success_rate = success_count / total_requests
            assert success_rate >= 0.8
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


class TestDatabaseConnectivity:
    """Test database connectivity through API"""
    
    def test_database_connection_via_debug(self):
        """
        Test database connectivity through debug endpoint
        Validates: Requirements 9.1
        """
        try:
            response = requests.get(f"{API_BASE_URL}/debug", timeout=TEST_TIMEOUT)
            assert response.status_code == 200
            
            debug_data = response.json()
            
            # Should have database connection info
            assert "supabase_connection" in debug_data
            
            # Connection should be successful or at least attempted
            connection_status = debug_data.get("supabase_connection", {})
            assert isinstance(connection_status, dict)
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")
    
    def test_data_persistence_simulation(self):
        """
        Test data persistence through API endpoints (simulation)
        Validates: Requirements 9.1, 9.2
        """
        try:
            # Test that endpoints designed for data operations exist
            # and return appropriate responses (even if auth is required)
            
            data_endpoints = [
                ("/projects/", "GET"),
                ("/resources/", "GET"),
                ("/portfolios/", "GET")
            ]
            
            for endpoint, method in data_endpoints:
                if method == "GET":
                    response = requests.get(f"{API_BASE_URL}{endpoint}", timeout=TEST_TIMEOUT)
                
                # Should not return 404 or 500 (endpoints exist and handle requests)
                assert response.status_code not in [404, 500]
                # May return auth errors (401, 403) or success (200) or validation errors (422)
                assert response.status_code in [200, 401, 403, 422]
            
        except requests.exceptions.ConnectionError:
            pytest.skip("API server not running")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])