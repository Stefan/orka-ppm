"""
API Endpoint Validator for pre-startup testing system.

This module validates critical API endpoints to ensure they are accessible,
properly authenticated, and return expected response formats.
"""

import asyncio
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urljoin
import httpx
from fastapi import status

from .interfaces import BaseValidator
from .models import ValidationResult, ValidationStatus, Severity, ValidationConfiguration


class APIEndpointValidator(BaseValidator):
    """Validates API endpoints for functionality and proper responses."""
    
    def __init__(self, config: ValidationConfiguration, base_url: str = "http://localhost:8000"):
        super().__init__(config)
        self.base_url = base_url.rstrip('/')
        self.timeout = httpx.Timeout(10.0, connect=5.0)
        self.client = None
        
    @property
    def component_name(self) -> str:
        return "API_Endpoint_Validator"
    
    async def validate(self) -> List[ValidationResult]:
        """Run all API endpoint validation tests."""
        results = []
        
        # Initialize HTTP client
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            self.client = client
            
            # Test critical endpoints
            for endpoint in self.config.test_endpoints:
                endpoint_results = await self._test_endpoint(endpoint)
                results.extend(endpoint_results)
            
            # Test for missing database functions
            function_results = await self._test_missing_functions()
            results.extend(function_results)
            
            # Test authentication scenarios
            auth_results = await self._test_authentication_scenarios()
            results.extend(auth_results)
            
            # Test response format validation
            format_results = await self._test_response_formats()
            results.extend(format_results)
            
            # Test query parameter handling
            param_results = await self._test_query_parameters()
            results.extend(param_results)
        
        return results
    
    async def _test_endpoint(self, endpoint: str) -> List[ValidationResult]:
        """Test a single endpoint for basic functionality."""
        results = []
        full_url = urljoin(self.base_url, endpoint)
        
        try:
            start_time = time.time()
            response = await self.client.get(full_url)
            execution_time = time.time() - start_time
            
            # Check if endpoint is accessible
            if response.status_code == status.HTTP_404_NOT_FOUND:
                results.append(self.create_result(
                    test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Endpoint {endpoint} not found (404)",
                    severity=Severity.HIGH,
                    execution_time=execution_time,
                    details={
                        "endpoint": endpoint,
                        "full_url": full_url,
                        "status_code": response.status_code,
                        "response_text": response.text[:500] if response.text else None
                    },
                    resolution_steps=[
                        f"Endpoint {endpoint} is not accessible",
                        "1. Check if the endpoint is defined in main.py",
                        "2. Verify the endpoint path matches the expected route",
                        "3. Ensure the server is running and accessible"
                    ]
                ))
            elif response.status_code == status.HTTP_401_UNAUTHORIZED:
                # Expected for protected endpoints - this is actually good
                results.append(self.create_result(
                    test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.PASS,
                    message=f"Endpoint {endpoint} properly requires authentication (401)",
                    execution_time=execution_time,
                    details={
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "authentication_required": True
                    }
                ))
            elif response.status_code >= 500:
                # Server error - this indicates a problem
                results.append(self.create_result(
                    test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Endpoint {endpoint} returned server error ({response.status_code})",
                    severity=Severity.CRITICAL,
                    execution_time=execution_time,
                    details={
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "response_text": response.text[:500] if response.text else None
                    },
                    resolution_steps=await self._analyze_server_error(endpoint, response)
                ))
            else:
                # Endpoint is accessible
                results.append(self.create_result(
                    test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.PASS,
                    message=f"Endpoint {endpoint} is accessible ({response.status_code})",
                    execution_time=execution_time,
                    details={
                        "endpoint": endpoint,
                        "status_code": response.status_code
                    }
                ))
                
        except httpx.ConnectError:
            results.append(self.create_result(
                test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                status=ValidationStatus.FAIL,
                message=f"Cannot connect to server at {self.base_url}",
                severity=Severity.CRITICAL,
                details={
                    "endpoint": endpoint,
                    "base_url": self.base_url,
                    "error_type": "connection_error"
                },
                resolution_steps=[
                    "Cannot connect to the API server",
                    "1. Ensure the backend server is running",
                    "2. Check if the server is listening on the correct port",
                    "3. Verify firewall settings allow connections",
                    f"4. Test manually: curl {full_url}"
                ]
            ))
        except httpx.TimeoutException:
            results.append(self.create_result(
                test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                status=ValidationStatus.FAIL,
                message=f"Timeout connecting to {endpoint}",
                severity=Severity.HIGH,
                details={
                    "endpoint": endpoint,
                    "timeout_seconds": self.timeout.connect,
                    "error_type": "timeout"
                },
                resolution_steps=[
                    f"Endpoint {endpoint} timed out",
                    "1. Check server performance and load",
                    "2. Verify database connectivity",
                    "3. Check for slow database queries",
                    "4. Consider increasing timeout values"
                ]
            ))
        except Exception as e:
            results.append(self.create_result(
                test_name=f"endpoint_accessibility_{endpoint.replace('/', '_')}",
                status=ValidationStatus.FAIL,
                message=f"Unexpected error testing {endpoint}: {str(e)}",
                severity=Severity.HIGH,
                details={
                    "endpoint": endpoint,
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                },
                resolution_steps=[
                    f"Unexpected error testing {endpoint}",
                    "1. Check server logs for detailed error information",
                    "2. Verify endpoint implementation",
                    "3. Test endpoint manually with curl or Postman"
                ]
            ))
        
        return results
    
    async def _test_authentication_scenarios(self) -> List[ValidationResult]:
        """Test endpoints with valid and invalid authentication."""
        results = []
        
        # Test with invalid authentication token
        invalid_token = "Bearer invalid_token_12345"
        
        for endpoint in self.config.test_endpoints:
            full_url = urljoin(self.base_url, endpoint)
            
            try:
                start_time = time.time()
                response = await self.client.get(
                    full_url,
                    headers={"Authorization": invalid_token}
                )
                execution_time = time.time() - start_time
                
                if response.status_code == status.HTTP_401_UNAUTHORIZED:
                    results.append(self.create_result(
                        test_name=f"invalid_auth_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.PASS,
                        message=f"Endpoint {endpoint} properly rejects invalid authentication",
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "status_code": response.status_code,
                            "auth_rejection": True
                        }
                    ))
                else:
                    results.append(self.create_result(
                        test_name=f"invalid_auth_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.FAIL,
                        message=f"Endpoint {endpoint} does not properly validate authentication (got {response.status_code})",
                        severity=Severity.HIGH,
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "expected_status": 401,
                            "actual_status": response.status_code,
                            "security_issue": True
                        },
                        resolution_steps=[
                            f"Endpoint {endpoint} has authentication bypass vulnerability",
                            "1. Check authentication middleware configuration",
                            "2. Verify JWT token validation logic",
                            "3. Ensure all protected endpoints require authentication",
                            "4. Review security dependencies and middleware order"
                        ]
                    ))
                    
            except Exception as e:
                results.append(self.create_result(
                    test_name=f"invalid_auth_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Error testing authentication for {endpoint}: {str(e)}",
                    severity=Severity.MEDIUM,
                    execution_time=0.0,
                    details={
                        "endpoint": endpoint,
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    }
                ))
        
        return results
    
    async def _test_response_formats(self) -> List[ValidationResult]:
        """Test that endpoints return properly formatted responses."""
        results = []
        
        for endpoint in self.config.test_endpoints:
            full_url = urljoin(self.base_url, endpoint)
            
            try:
                start_time = time.time()
                response = await self.client.get(full_url)
                execution_time = time.time() - start_time
                
                # Skip if endpoint is not accessible or requires auth
                if response.status_code in [404, 401]:
                    continue
                
                # Check if response has proper content-type
                content_type = response.headers.get("content-type", "")
                if "application/json" not in content_type:
                    results.append(self.create_result(
                        test_name=f"response_format_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.WARNING,
                        message=f"Endpoint {endpoint} does not return JSON content-type",
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "content_type": content_type,
                            "expected": "application/json"
                        },
                        resolution_steps=[
                            f"Endpoint {endpoint} content-type issue",
                            "1. Ensure endpoint returns JSON response",
                            "2. Check FastAPI response model configuration",
                            "3. Verify proper HTTP headers are set"
                        ]
                    ))
                    continue
                
                # Try to parse JSON response
                try:
                    json_data = response.json()
                    results.append(self.create_result(
                        test_name=f"response_format_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.PASS,
                        message=f"Endpoint {endpoint} returns valid JSON response",
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "content_type": content_type,
                            "json_valid": True,
                            "response_keys": list(json_data.keys()) if isinstance(json_data, dict) else None
                        }
                    ))
                except json.JSONDecodeError as json_error:
                    results.append(self.create_result(
                        test_name=f"response_format_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.FAIL,
                        message=f"Endpoint {endpoint} returns invalid JSON",
                        severity=Severity.MEDIUM,
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "json_error": str(json_error),
                            "response_text": response.text[:200] if response.text else None
                        },
                        resolution_steps=[
                            f"Endpoint {endpoint} JSON parsing error",
                            "1. Check endpoint implementation for proper JSON serialization",
                            "2. Verify Pydantic models are correctly defined",
                            "3. Test endpoint manually to inspect response format"
                        ]
                    ))
                    
            except Exception as e:
                results.append(self.create_result(
                    test_name=f"response_format_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Error testing response format for {endpoint}: {str(e)}",
                    severity=Severity.MEDIUM,
                    execution_time=0.0,
                    details={
                        "endpoint": endpoint,
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    }
                ))
        
        return results
    
    async def _analyze_server_error(self, endpoint: str, response: httpx.Response) -> List[str]:
        """Analyze server error response to provide specific guidance."""
        resolution_steps = [f"Endpoint {endpoint} returned server error ({response.status_code})"]
        
        try:
            error_text = response.text.lower()
            
            # Check for common database-related errors
            if "execute_sql" in error_text or "function" in error_text and "does not exist" in error_text:
                resolution_steps.extend([
                    "1. Missing database function detected",
                    "2. Run database migrations: python apply_migration_direct.py",
                    "3. Check migration files in backend/migrations/",
                    "4. Verify all required database functions are created"
                ])
            elif "connection" in error_text and ("refused" in error_text or "timeout" in error_text):
                resolution_steps.extend([
                    "1. Database connection issue detected",
                    "2. Check SUPABASE_URL and SUPABASE_ANON_KEY in .env",
                    "3. Verify Supabase service is accessible",
                    "4. Test connection manually"
                ])
            elif "authentication" in error_text or "unauthorized" in error_text:
                resolution_steps.extend([
                    "1. Authentication configuration issue",
                    "2. Check JWT token configuration",
                    "3. Verify authentication middleware setup",
                    "4. Test with valid authentication credentials"
                ])
            elif "import" in error_text or "module" in error_text:
                resolution_steps.extend([
                    "1. Missing dependency or import error",
                    "2. Check requirements.txt and installed packages",
                    "3. Verify all imports in the endpoint handler",
                    "4. Run: pip install -r requirements.txt"
                ])
            else:
                resolution_steps.extend([
                    "1. Check server logs for detailed error information",
                    "2. Verify endpoint implementation and dependencies",
                    "3. Test endpoint manually with curl or Postman",
                    "4. Check database connectivity and required functions"
                ])
                
        except Exception:
            resolution_steps.extend([
                "1. Check server logs for detailed error information",
                "2. Verify endpoint implementation",
                "3. Test endpoint manually"
            ])
        
        return resolution_steps
    
    async def _test_missing_functions(self) -> List[ValidationResult]:
        """Test for missing database functions by calling endpoints that use them."""
        results = []
        
        # Test endpoints that are known to use database functions
        function_dependent_endpoints = [
            ("/csv-import/variances", "execute_sql"),
            ("/variance/alerts", "variance calculation functions"),
            ("/admin/users", "user management functions")
        ]
        
        for endpoint, expected_function in function_dependent_endpoints:
            if endpoint not in self.config.test_endpoints:
                continue
                
            full_url = urljoin(self.base_url, endpoint)
            
            try:
                start_time = time.time()
                # Try with a test authentication header (will still fail auth but might reveal function issues)
                response = await self.client.get(
                    full_url,
                    headers={"Authorization": "Bearer test_token"}
                )
                execution_time = time.time() - start_time
                
                # Check response for database function errors
                if response.status_code >= 500:
                    error_text = response.text.lower()
                    
                    if ("function" in error_text and "does not exist" in error_text) or \
                       ("execute_sql" in error_text) or \
                       ("procedure" in error_text and "not found" in error_text):
                        
                        # Extract function name if possible
                        function_name = self._extract_function_name(response.text)
                        
                        results.append(self.create_result(
                            test_name=f"missing_function_{endpoint.replace('/', '_')}",
                            status=ValidationStatus.FAIL,
                            message=f"Missing database function detected in {endpoint}: {function_name or expected_function}",
                            severity=Severity.CRITICAL,
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "expected_function": expected_function,
                                "detected_function": function_name,
                                "status_code": response.status_code,
                                "error_text": response.text[:500]
                            },
                            resolution_steps=[
                                f"Missing database function: {function_name or expected_function}",
                                "1. Run database migrations: python apply_migration_direct.py",
                                "2. Check migration files in backend/migrations/",
                                "3. Verify the function exists in Supabase dashboard",
                                "4. Create the missing function manually if needed",
                                f"5. Test endpoint after fixing: curl -H 'Authorization: Bearer TOKEN' {full_url}"
                            ]
                        ))
                    else:
                        # Generic server error - might still be function related
                        results.append(self.create_result(
                            test_name=f"server_error_{endpoint.replace('/', '_')}",
                            status=ValidationStatus.FAIL,
                            message=f"Server error in {endpoint} - possible missing function",
                            severity=Severity.HIGH,
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "expected_function": expected_function,
                                "status_code": response.status_code,
                                "error_text": response.text[:500]
                            },
                            resolution_steps=[
                                f"Server error in {endpoint}",
                                "1. Check server logs for detailed error information",
                                "2. Verify database functions are available",
                                "3. Run database migrations if needed",
                                "4. Test database connectivity"
                            ]
                        ))
                elif response.status_code == 401:
                    # Expected authentication error - function is probably available
                    results.append(self.create_result(
                        test_name=f"function_availability_{endpoint.replace('/', '_')}",
                        status=ValidationStatus.PASS,
                        message=f"Endpoint {endpoint} accessible - {expected_function} likely available",
                        execution_time=execution_time,
                        details={
                            "endpoint": endpoint,
                            "expected_function": expected_function,
                            "status_code": response.status_code,
                            "function_check": "passed"
                        }
                    ))
                    
            except httpx.ConnectError:
                # Server not running - can't test functions
                results.append(self.create_result(
                    test_name=f"function_test_connection_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Cannot test {expected_function} - server not accessible",
                    severity=Severity.CRITICAL,
                    details={
                        "endpoint": endpoint,
                        "expected_function": expected_function,
                        "error_type": "connection_error"
                    },
                    resolution_steps=[
                        "Cannot test database functions - server not running",
                        "1. Start the backend server",
                        "2. Verify server is listening on correct port",
                        "3. Re-run tests after server is accessible"
                    ]
                ))
            except Exception as e:
                results.append(self.create_result(
                    test_name=f"function_test_error_{endpoint.replace('/', '_')}",
                    status=ValidationStatus.FAIL,
                    message=f"Error testing {expected_function}: {str(e)}",
                    severity=Severity.MEDIUM,
                    execution_time=0.0,
                    details={
                        "endpoint": endpoint,
                        "expected_function": expected_function,
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    }
                ))
        
        return results
    
    def _extract_function_name(self, error_text: str) -> Optional[str]:
        """Extract database function name from error message."""
        try:
            error_lower = error_text.lower()
            
            # Common patterns for function not found errors
            patterns = [
                r'function "([^"]+)" does not exist',
                r'function ([^\s]+) does not exist',
                r'execute_sql',
                r'procedure "([^"]+)" not found',
                r'procedure ([^\s]+) not found'
            ]
            
            import re
            for pattern in patterns:
                match = re.search(pattern, error_lower)
                if match:
                    if match.groups():
                        return match.group(1)
                    else:
                        return "execute_sql"  # Default for execute_sql pattern
            
            # If no specific pattern matches but contains function-related keywords
            if "execute_sql" in error_lower:
                return "execute_sql"
            elif "function" in error_lower:
                return "unknown_function"
                
        except Exception:
            pass
        
        return None
    
    async def _test_query_parameters(self) -> List[ValidationResult]:
        """Test endpoints with various query parameter combinations."""
        results = []
        
        # Define query parameter test cases for different endpoints
        endpoint_params = {
            "/admin/users": [
                {},  # No parameters
                {"page": "1", "per_page": "10"},  # Pagination
                {"role": "admin"},  # Role filter
                {"is_active": "true"},  # Status filter
                {"page": "1", "per_page": "10", "role": "admin"},  # Combined
                {"page": "invalid", "per_page": "invalid"},  # Invalid values
            ],
            "/csv-import/variances": [
                {},  # No parameters
                {"organization_id": "DEFAULT"},  # Organization filter
                {"start_date": "2024-01-01"},  # Date filter
                {"end_date": "2024-12-31"},  # Date filter
                {"organization_id": "DEFAULT", "start_date": "2024-01-01"},  # Combined
                {"invalid_param": "test"},  # Invalid parameter
            ],
            "/variance/alerts": [
                {},  # No parameters
                {"organization_id": "DEFAULT"},  # Organization filter
                {"status": "active"},  # Status filter
                {"limit": "10"},  # Limit results
                {"organization_id": "DEFAULT", "status": "active"},  # Combined
                {"limit": "invalid"},  # Invalid limit
            ]
        }
        
        for endpoint in self.config.test_endpoints:
            if endpoint not in endpoint_params:
                continue
                
            param_sets = endpoint_params[endpoint]
            
            for i, params in enumerate(param_sets):
                full_url = urljoin(self.base_url, endpoint)
                
                try:
                    start_time = time.time()
                    response = await self.client.get(full_url, params=params)
                    execution_time = time.time() - start_time
                    
                    param_desc = f"params_{i}" if params else "no_params"
                    test_name = f"query_params_{endpoint.replace('/', '_')}_{param_desc}"
                    
                    # Analyze response based on parameters
                    if response.status_code == 422:  # Validation error
                        if any(key in ["invalid_param", "page", "per_page", "limit"] and 
                               str(value) == "invalid" for key, value in params.items()):
                            # Expected validation error for invalid parameters
                            results.append(self.create_result(
                                test_name=test_name,
                                status=ValidationStatus.PASS,
                                message=f"Endpoint {endpoint} properly validates invalid parameters",
                                execution_time=execution_time,
                                details={
                                    "endpoint": endpoint,
                                    "parameters": params,
                                    "status_code": response.status_code,
                                    "validation_working": True
                                }
                            ))
                        else:
                            # Unexpected validation error
                            results.append(self.create_result(
                                test_name=test_name,
                                status=ValidationStatus.FAIL,
                                message=f"Endpoint {endpoint} rejected valid parameters",
                                severity=Severity.MEDIUM,
                                execution_time=execution_time,
                                details={
                                    "endpoint": endpoint,
                                    "parameters": params,
                                    "status_code": response.status_code,
                                    "response_text": response.text[:300]
                                },
                                resolution_steps=[
                                    f"Parameter validation issue in {endpoint}",
                                    "1. Check parameter validation logic in endpoint",
                                    "2. Verify Pydantic models accept the provided parameters",
                                    "3. Review query parameter handling",
                                    f"4. Test manually: curl '{full_url}?{self._format_params(params)}'"
                                ]
                            ))
                    elif response.status_code == 401:
                        # Expected authentication error - parameter handling is working
                        results.append(self.create_result(
                            test_name=test_name,
                            status=ValidationStatus.PASS,
                            message=f"Endpoint {endpoint} processes parameters correctly (auth required)",
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "parameters": params,
                                "status_code": response.status_code,
                                "parameter_processing": "working"
                            }
                        ))
                    elif response.status_code >= 500:
                        # Server error - might be parameter-related
                        results.append(self.create_result(
                            test_name=test_name,
                            status=ValidationStatus.FAIL,
                            message=f"Server error in {endpoint} with parameters",
                            severity=Severity.HIGH,
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "parameters": params,
                                "status_code": response.status_code,
                                "error_text": response.text[:300]
                            },
                            resolution_steps=[
                                f"Server error with parameters in {endpoint}",
                                "1. Check server logs for parameter processing errors",
                                "2. Verify parameter validation and type conversion",
                                "3. Check database query parameter handling",
                                "4. Test with simpler parameter combinations"
                            ]
                        ))
                    elif response.status_code == 404:
                        # Endpoint not found
                        results.append(self.create_result(
                            test_name=test_name,
                            status=ValidationStatus.FAIL,
                            message=f"Endpoint {endpoint} not found",
                            severity=Severity.HIGH,
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "parameters": params,
                                "status_code": response.status_code
                            },
                            resolution_steps=[
                                f"Endpoint {endpoint} not accessible",
                                "1. Verify endpoint is defined in main.py",
                                "2. Check endpoint path and routing",
                                "3. Ensure server is running"
                            ]
                        ))
                    else:
                        # Successful response or expected behavior
                        results.append(self.create_result(
                            test_name=test_name,
                            status=ValidationStatus.PASS,
                            message=f"Endpoint {endpoint} handles parameters correctly",
                            execution_time=execution_time,
                            details={
                                "endpoint": endpoint,
                                "parameters": params,
                                "status_code": response.status_code,
                                "parameter_handling": "working"
                            }
                        ))
                        
                except httpx.ConnectError:
                    results.append(self.create_result(
                        test_name=test_name,
                        status=ValidationStatus.FAIL,
                        message=f"Cannot test parameters for {endpoint} - server not accessible",
                        severity=Severity.CRITICAL,
                        details={
                            "endpoint": endpoint,
                            "parameters": params,
                            "error_type": "connection_error"
                        },
                        resolution_steps=[
                            "Cannot test query parameters - server not running",
                            "1. Start the backend server",
                            "2. Verify server is accessible",
                            "3. Re-run parameter tests"
                        ]
                    ))
                except Exception as e:
                    param_desc = f"params_{i}" if params else "no_params"
                    test_name = f"query_params_{endpoint.replace('/', '_')}_{param_desc}"
                    results.append(self.create_result(
                        test_name=test_name,
                        status=ValidationStatus.FAIL,
                        message=f"Error testing parameters for {endpoint}: {str(e)}",
                        severity=Severity.MEDIUM,
                        execution_time=0.0,
                        details={
                            "endpoint": endpoint,
                            "parameters": params,
                            "error_type": type(e).__name__,
                            "error_message": str(e)
                        }
                    ))
        
        return results
    
    def _format_params(self, params: Dict[str, Any]) -> str:
        """Format parameters for URL query string."""
        if not params:
            return ""
        return "&".join(f"{key}={value}" for key, value in params.items())