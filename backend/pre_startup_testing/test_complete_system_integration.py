"""
Complete system integration tests for the pre-startup testing system.

This module tests the complete startup flow with real FastAPI application,
various failure scenarios and recovery mechanisms, and validates performance
under different system loads.

Requirements tested: 1.1, 1.2, 1.3, 1.5
"""

import pytest
import asyncio
import os
import tempfile
import json
import subprocess
import sys
import time
import threading
import signal
from unittest.mock import patch, Mock, AsyncMock, MagicMock
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Dict, Any, List

# FastAPI imports for real application testing
try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import uvicorn
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

from .models import ValidationConfiguration, ValidationStatus, ValidationResult, Severity, TestResults
from .runner import PreStartupTestRunner
from .configuration_validator import ConfigurationValidator
from .database_connectivity_checker import DatabaseConnectivityChecker
from .authentication_validator import AuthenticationValidator
from .api_endpoint_validator import APIEndpointValidator
from .test_reporter import ConsoleTestReporter
from .fastapi_integration import FastAPIPreStartupIntegration, integrate_pre_startup_testing
from .cli import PreStartupTestCLI, main as cli_main


class TestCompleteSystemIntegration:
    """Complete system integration tests for the pre-startup testing system."""
    
    @pytest.mark.asyncio
    async def test_complete_startup_flow_with_real_fastapi_app(self):
        """Test complete startup flow with real FastAPI application."""
        if not FASTAPI_AVAILABLE:
            pytest.skip("FastAPI not available for testing")
        
        # Create a minimal FastAPI application for testing
        app = FastAPI(title="Test App for Pre-Startup Testing")
        
        @app.get("/health")
        async def health_check():
            return {"status": "healthy"}
        
        @app.get("/admin/users")
        async def admin_users():
            return {"users": []}
        
        # Integrate pre-startup testing
        integration = integrate_pre_startup_testing(app, "http://localhost:8000")
        
        # Test that integration was successful
        assert integration is not None
        assert integration.app == app
        assert integration.base_url == "http://localhost:8000"
        assert isinstance(integration.config, ValidationConfiguration)
        assert isinstance(integration.runner, PreStartupTestRunner)
        
        # Test lifespan handler creation
        lifespan_handler = integration.create_lifespan_handler()
        assert lifespan_handler is not None
        
        # Mock the test execution to avoid real system dependencies
        with patch.object(integration.runner, 'run_all_tests') as mock_run_tests, \
             patch.object(integration.runner, 'should_allow_startup') as mock_should_allow:
            
            # Configure successful test scenario
            mock_results = TestResults(
                overall_status=ValidationStatus.PASS,
                validation_results=[
                    ValidationResult(
                        component="TestValidator",
                        test_name="integration_test",
                        status=ValidationStatus.PASS,
                        message="Integration test passed",
                        severity=Severity.MEDIUM
                    )
                ],
                execution_time=1.5,
                timestamp=datetime.now()
            )
            
            mock_run_tests.return_value = mock_results
            mock_should_allow.return_value = True
            
            # Test the lifespan handler
            async with lifespan_handler(app):
                # If we reach here, startup was allowed
                assert mock_run_tests.called
                assert mock_should_allow.called
                
                # Verify the app is properly configured
                assert app.title == "Test App for Pre-Startup Testing"
    
    @pytest.mark.asyncio
    async def test_startup_flow_with_critical_failures(self):
        """Test startup flow when critical failures should block startup."""
        if not FASTAPI_AVAILABLE:
            pytest.skip("FastAPI not available for testing")
        
        app = FastAPI(title="Test App - Critical Failures")
        integration = FastAPIPreStartupIntegration(app, "http://localhost:8000")
        
        # Mock critical failure scenario
        with patch.object(integration.runner, 'run_all_tests') as mock_run_tests, \
             patch.object(integration.runner, 'should_allow_startup') as mock_should_allow:
            
            # Configure critical failure scenario
            mock_results = TestResults(
                overall_status=ValidationStatus.FAIL,
                validation_results=[
                    ValidationResult(
                        component="DatabaseConnectivityChecker",
                        test_name="supabase_connection",
                        status=ValidationStatus.FAIL,
                        message="Cannot connect to Supabase database",
                        severity=Severity.CRITICAL,
                        resolution_steps=[
                            "Check SUPABASE_URL in .env file",
                            "Verify SUPABASE_ANON_KEY is valid"
                        ]
                    )
                ],
                execution_time=2.0,
                timestamp=datetime.now()
            )
            
            mock_run_tests.return_value = mock_results
            mock_should_allow.return_value = False  # Critical failure blocks startup
            
            # Test that startup is blocked
            startup_allowed = await integration.run_pre_startup_tests()
            assert startup_allowed is False
            assert mock_run_tests.called
            assert mock_should_allow.called
    
    @pytest.mark.asyncio
    async def test_performance_under_different_loads(self):
        """Test system performance under different loads and configurations."""
        # Test different configuration scenarios for performance
        test_scenarios = [
            # (parallel, timeout, expected_max_time, description)
            (True, 30, 15, "Parallel execution with normal timeout"),
            (False, 30, 25, "Sequential execution with normal timeout"),
            (True, 10, 8, "Parallel execution with short timeout"),
            (False, 10, 8, "Sequential execution with short timeout"),
        ]
        
        for parallel, timeout, expected_max_time, description in test_scenarios:
            config = ValidationConfiguration(
                parallel_execution=parallel,
                timeout_seconds=timeout,
                development_mode=True,
                skip_non_critical=True,  # Allow startup to focus on performance
                cache_results=False  # Disable cache to test real performance
            )
            
            runner = PreStartupTestRunner(config)
            
            # Mock validators to simulate different execution times
            class MockPerformanceValidator:
                def __init__(self, component_name, execution_time):
                    self.component_name = component_name
                    self._execution_time = execution_time
                
                async def validate(self):
                    await asyncio.sleep(self._execution_time)
                    return [ValidationResult(
                        component=self.component_name,
                        test_name="performance_test",
                        status=ValidationStatus.PASS,
                        message=f"Performance test completed in {self._execution_time}s",
                        severity=Severity.MEDIUM,
                        execution_time=self._execution_time
                    )]
            
            # Add validators with different execution times
            runner.validators = [
                MockPerformanceValidator("FastValidator", 0.5),
                MockPerformanceValidator("MediumValidator", 2.0),
                MockPerformanceValidator("SlowValidator", 3.0),
                MockPerformanceValidator("VariableValidator", 1.5)
            ]
            
            # Measure execution time
            start_time = time.time()
            results = await runner.run_all_tests()
            actual_time = time.time() - start_time
            
            # Verify performance expectations
            assert results is not None, f"Failed scenario: {description}"
            assert actual_time <= expected_max_time, \
                f"Performance test failed for {description}: {actual_time:.2f}s > {expected_max_time}s"
            
            # Verify all validators ran
            assert len(results.validation_results) == 4, f"Not all validators ran for {description}"
            
            # Verify startup decision can be made
            startup_allowed = runner.should_allow_startup(results)
            assert isinstance(startup_allowed, bool), f"Startup decision failed for {description}"
    
    @pytest.mark.asyncio
    async def test_failure_recovery_scenarios(self):
        """Test various failure scenarios and recovery mechanisms."""
        recovery_scenarios = [
            {
                "name": "Database down, other services working",
                "failures": {
                    "DatabaseConnectivityChecker": [
                        ValidationResult(
                            component="DatabaseConnectivityChecker",
                            test_name="supabase_connection",
                            status=ValidationStatus.FAIL,
                            message="Database connection failed",
                            severity=Severity.CRITICAL,
                            resolution_steps=["Check database connectivity", "Use mock data mode"]
                        )
                    ]
                },
                "expected_fallbacks": ["database"],
                "expected_impact": ["Database Services"]
            },
            {
                "name": "Authentication system failure",
                "failures": {
                    "AuthenticationValidator": [
                        ValidationResult(
                            component="AuthenticationValidator",
                            test_name="jwt_validation",
                            status=ValidationStatus.FAIL,
                            message="JWT validation failed",
                            severity=Severity.HIGH,
                            resolution_steps=["Check JWT configuration", "Use development auth"]
                        )
                    ]
                },
                "expected_fallbacks": ["authentication"],
                "expected_impact": ["Authentication Services"]
            },
            {
                "name": "Multiple service failures",
                "failures": {
                    "DatabaseConnectivityChecker": [
                        ValidationResult(
                            component="DatabaseConnectivityChecker",
                            test_name="supabase_connection",
                            status=ValidationStatus.FAIL,
                            message="Database connection failed",
                            severity=Severity.CRITICAL
                        )
                    ],
                    "APIEndpointValidator": [
                        ValidationResult(
                            component="APIEndpointValidator",
                            test_name="admin_endpoints",
                            status=ValidationStatus.FAIL,
                            message="API endpoints failing",
                            severity=Severity.HIGH
                        )
                    ]
                },
                "expected_fallbacks": ["database", "api"],
                "expected_impact": ["Database Services", "API Services"]
            }
        ]
        
        for scenario in recovery_scenarios:
            config = ValidationConfiguration(
                parallel_execution=True,
                timeout_seconds=30,
                development_mode=True,
                skip_non_critical=False
            )
            
            runner = PreStartupTestRunner(config)
            
            # Create test results with the specified failures
            all_validation_results = []
            
            # Add successful results for non-failing components
            successful_components = ["ConfigurationValidator"]
            for component in successful_components:
                if component not in scenario["failures"]:
                    all_validation_results.append(
                        ValidationResult(
                            component=component,
                            test_name="success_test",
                            status=ValidationStatus.PASS,
                            message=f"{component} working correctly",
                            severity=Severity.MEDIUM
                        )
                    )
            
            # Add failure results
            for component, failures in scenario["failures"].items():
                all_validation_results.extend(failures)
            
            # Create test results
            test_results = TestResults(
                overall_status=ValidationStatus.FAIL,
                validation_results=all_validation_results,
                execution_time=2.0,
                timestamp=datetime.now()
            )
            
            # Test fallback suggestions
            fallback_suggestions = runner.get_fallback_suggestions(test_results)
            for expected_fallback in scenario["expected_fallbacks"]:
                assert expected_fallback in fallback_suggestions, \
                    f"Missing fallback '{expected_fallback}' for scenario '{scenario['name']}'"
                assert len(fallback_suggestions[expected_fallback]) > 0, \
                    f"Empty fallback suggestions for '{expected_fallback}' in scenario '{scenario['name']}'"
            
            # Test service impact analysis
            impact_analysis = runner.analyze_service_impact(test_results)
            for expected_impact in scenario["expected_impact"]:
                assert expected_impact in impact_analysis, \
                    f"Missing impact analysis for '{expected_impact}' in scenario '{scenario['name']}'"
                assert len(impact_analysis[expected_impact]) > 0, \
                    f"Empty impact analysis for '{expected_impact}' in scenario '{scenario['name']}'"
            
            # Test failure criticality classification
            for result in test_results.get_failed_tests():
                criticality = runner.classify_failure_criticality(result)
                assert criticality in ['critical', 'non-critical', 'development-only'], \
                    f"Invalid criticality '{criticality}' for scenario '{scenario['name']}'"
    
    @pytest.mark.asyncio
    async def test_cli_integration_comprehensive(self):
        """Test comprehensive CLI integration with various command-line options."""
        cli = PreStartupTestCLI()
        
        # Test different CLI scenarios
        cli_scenarios = [
            {
                "args": ["--critical-only", "--json", "--quiet"],
                "expected_keys": ["status", "startup_allowed", "exit_code", "summary"]
            },
            {
                "args": ["--skip-tests", "--json"],
                "expected_status": "skipped"
            },
            {
                "args": ["--dev-mode", "--timeout", "10", "--json"],
                "expected_keys": ["status", "execution_time"]
            },
            {
                "args": ["--no-parallel", "--no-cache", "--json"],
                "expected_keys": ["status", "test_results"]
            }
        ]
        
        for scenario in cli_scenarios:
            # Mock sys.argv to simulate command-line arguments
            original_argv = sys.argv.copy()
            try:
                sys.argv = ["test_cli"] + scenario["args"]
                
                # Mock the validators to avoid real system dependencies
                with patch.object(ConfigurationValidator, 'validate') as mock_config, \
                     patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
                     patch.object(AuthenticationValidator, 'validate') as mock_auth, \
                     patch.object(APIEndpointValidator, 'validate') as mock_api:
                    
                    # Configure successful responses
                    mock_config.return_value = [
                        ValidationResult(
                            component="ConfigurationValidator",
                            test_name="environment_variables",
                            status=ValidationStatus.PASS,
                            message="Configuration valid",
                            severity=Severity.CRITICAL
                        )
                    ]
                    
                    mock_db.return_value = [
                        ValidationResult(
                            component="DatabaseConnectivityChecker",
                            test_name="supabase_connection",
                            status=ValidationStatus.PASS,
                            message="Database connection successful",
                            severity=Severity.CRITICAL
                        )
                    ]
                    
                    mock_auth.return_value = [
                        ValidationResult(
                            component="AuthenticationValidator",
                            test_name="jwt_validation",
                            status=ValidationStatus.PASS,
                            message="JWT validation working",
                            severity=Severity.HIGH
                        )
                    ]
                    
                    mock_api.return_value = [
                        ValidationResult(
                            component="APIEndpointValidator",
                            test_name="admin_endpoints",
                            status=ValidationStatus.PASS,
                            message="Admin endpoints responding",
                            severity=Severity.HIGH
                        )
                    ]
                    
                    # Parse arguments and run tests
                    args = cli.parser.parse_args(scenario["args"])
                    result = await cli.run_tests(args)
                    
                    # Verify expected results
                    assert result is not None, f"CLI failed for args: {scenario['args']}"
                    assert isinstance(result, dict), f"CLI result not dict for args: {scenario['args']}"
                    
                    if "expected_status" in scenario:
                        assert result.get("status") == scenario["expected_status"], \
                            f"Wrong status for args {scenario['args']}: expected {scenario['expected_status']}, got {result.get('status')}"
                    
                    if "expected_keys" in scenario:
                        for key in scenario["expected_keys"]:
                            assert key in result, \
                                f"Missing key '{key}' in result for args: {scenario['args']}"
                    
                    # Verify exit code is valid
                    assert "exit_code" in result, f"Missing exit_code for args: {scenario['args']}"
                    assert result["exit_code"] in [0, 1], f"Invalid exit_code for args: {scenario['args']}"
            
            finally:
                sys.argv = original_argv
    
    @pytest.mark.asyncio
    async def test_system_load_and_stress_testing(self):
        """Test system behavior under various load conditions."""
        # Test concurrent execution scenarios
        load_scenarios = [
            {
                "name": "Light load - 2 concurrent tests",
                "concurrent_tests": 2,
                "validator_count": 4,
                "expected_max_time": 10
            },
            {
                "name": "Medium load - 4 concurrent tests",
                "concurrent_tests": 4,
                "validator_count": 8,
                "expected_max_time": 15
            },
            {
                "name": "Heavy load - 8 concurrent tests",
                "concurrent_tests": 8,
                "validator_count": 12,
                "expected_max_time": 25
            }
        ]
        
        for scenario in load_scenarios:
            config = ValidationConfiguration(
                parallel_execution=True,
                timeout_seconds=30,
                max_concurrent_tests=scenario["concurrent_tests"],
                development_mode=True,
                skip_non_critical=True,
                cache_results=False
            )
            
            runner = PreStartupTestRunner(config)
            
            # Create multiple validators to simulate load
            class MockLoadValidator:
                def __init__(self, validator_id):
                    self.component_name = f"LoadValidator_{validator_id}"
                    self.validator_id = validator_id
                
                async def validate(self):
                    # Simulate variable processing time
                    processing_time = 0.5 + (self.validator_id % 3) * 0.5
                    await asyncio.sleep(processing_time)
                    
                    return [ValidationResult(
                        component=self.component_name,
                        test_name="load_test",
                        status=ValidationStatus.PASS,
                        message=f"Load test {self.validator_id} completed",
                        severity=Severity.MEDIUM,
                        execution_time=processing_time
                    )]
            
            # Add validators for load testing
            runner.validators = [
                MockLoadValidator(i) for i in range(scenario["validator_count"])
            ]
            
            # Measure execution under load
            start_time = time.time()
            results = await runner.run_all_tests()
            execution_time = time.time() - start_time
            
            # Verify load handling
            assert results is not None, f"Load test failed for scenario: {scenario['name']}"
            assert execution_time <= scenario["expected_max_time"], \
                f"Load test exceeded time limit for {scenario['name']}: {execution_time:.2f}s > {scenario['expected_max_time']}s"
            
            # Verify all validators completed
            assert len(results.validation_results) == scenario["validator_count"], \
                f"Not all validators completed for {scenario['name']}"
            
            # Verify system remained responsive
            startup_decision_start = time.time()
            startup_allowed = runner.should_allow_startup(results)
            startup_decision_time = time.time() - startup_decision_start
            
            assert startup_decision_time < 1.0, \
                f"Startup decision too slow under load for {scenario['name']}: {startup_decision_time:.2f}s"
            assert isinstance(startup_allowed, bool), \
                f"Invalid startup decision for {scenario['name']}"
    
    @pytest.mark.asyncio
    async def test_real_system_error_handling(self):
        """Test error handling with real system conditions."""
        # Test various error conditions that can occur in real systems
        error_scenarios = [
            {
                "name": "Validator timeout",
                "error_type": "timeout",
                "timeout": 1,  # Very short timeout
                "expected_status": ValidationStatus.FAIL
            },
            {
                "name": "Validator exception",
                "error_type": "exception",
                "timeout": 30,
                "expected_status": ValidationStatus.FAIL
            },
            {
                "name": "Mixed success and failure",
                "error_type": "mixed",
                "timeout": 30,
                "expected_status": ValidationStatus.FAIL
            }
        ]
        
        for scenario in error_scenarios:
            config = ValidationConfiguration(
                parallel_execution=True,
                timeout_seconds=scenario["timeout"],
                development_mode=True,
                skip_non_critical=False
            )
            
            runner = PreStartupTestRunner(config)
            
            # Create validators that simulate different error conditions
            class MockErrorValidator:
                def __init__(self, component_name, error_type):
                    self.component_name = component_name
                    self.error_type = error_type
                
                async def validate(self):
                    if self.error_type == "timeout":
                        await asyncio.sleep(5)  # Longer than timeout
                        return [ValidationResult(
                            component=self.component_name,
                            test_name="timeout_test",
                            status=ValidationStatus.PASS,
                            message="Should not reach here",
                            severity=Severity.MEDIUM
                        )]
                    elif self.error_type == "exception":
                        raise Exception(f"Simulated error in {self.component_name}")
                    elif self.error_type == "success":
                        return [ValidationResult(
                            component=self.component_name,
                            test_name="success_test",
                            status=ValidationStatus.PASS,
                            message="Test passed successfully",
                            severity=Severity.MEDIUM
                        )]
                    elif self.error_type == "failure":
                        return [ValidationResult(
                            component=self.component_name,
                            test_name="failure_test",
                            status=ValidationStatus.FAIL,
                            message="Test failed as expected",
                            severity=Severity.HIGH
                        )]
            
            # Configure validators based on scenario
            if scenario["error_type"] == "timeout":
                runner.validators = [MockErrorValidator("TimeoutValidator", "timeout")]
            elif scenario["error_type"] == "exception":
                runner.validators = [MockErrorValidator("ExceptionValidator", "exception")]
            elif scenario["error_type"] == "mixed":
                runner.validators = [
                    MockErrorValidator("SuccessValidator", "success"),
                    MockErrorValidator("FailureValidator", "failure"),
                    MockErrorValidator("ExceptionValidator", "exception")
                ]
            
            # Run tests and verify error handling
            results = await runner.run_all_tests()
            
            assert results is not None, f"Error handling failed for scenario: {scenario['name']}"
            assert results.overall_status == scenario["expected_status"], \
                f"Wrong overall status for {scenario['name']}: expected {scenario['expected_status']}, got {results.overall_status}"
            
            # Verify error results are properly recorded
            if scenario["error_type"] in ["timeout", "exception"]:
                error_results = [r for r in results.validation_results if r.status == ValidationStatus.FAIL]
                assert len(error_results) > 0, f"No error results recorded for {scenario['name']}"
            
            # Verify system can still make startup decision
            startup_allowed = runner.should_allow_startup(results)
            assert isinstance(startup_allowed, bool), f"Startup decision failed for {scenario['name']}"
            
            # Verify reports can be generated despite errors
            basic_report = runner.generate_startup_report(results)
            enhanced_report = runner.generate_enhanced_startup_report(results)
            
            assert isinstance(basic_report, str), f"Basic report generation failed for {scenario['name']}"
            assert isinstance(enhanced_report, str), f"Enhanced report generation failed for {scenario['name']}"
            assert len(basic_report) > 0, f"Empty basic report for {scenario['name']}"
            assert len(enhanced_report) > 0, f"Empty enhanced report for {scenario['name']}"
    
    @pytest.mark.asyncio
    async def test_caching_and_performance_optimization(self):
        """Test caching mechanisms and performance optimizations."""
        # Test caching behavior
        config = ValidationConfiguration(
            cache_results=True,
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner = PreStartupTestRunner(config)
        
        # Clean up any existing cache
        if os.path.exists(runner._cache_file):
            os.remove(runner._cache_file)
        
        # Mock validators for consistent results
        class MockCacheValidator:
            def __init__(self, component_name):
                self.component_name = component_name
                self.call_count = 0
            
            async def validate(self):
                self.call_count += 1
                await asyncio.sleep(0.1)  # Small delay to measure caching effect
                return [ValidationResult(
                    component=self.component_name,
                    test_name="cache_test",
                    status=ValidationStatus.PASS,
                    message=f"Cache test call #{self.call_count}",
                    severity=Severity.MEDIUM,
                    execution_time=0.1
                )]
        
        validators = [
            MockCacheValidator("CacheValidator1"),
            MockCacheValidator("CacheValidator2"),
            MockCacheValidator("CacheValidator3")
        ]
        runner.validators = validators
        
        # First run - should create cache
        start_time = time.time()
        results1 = await runner.run_all_tests()
        first_run_time = time.time() - start_time
        
        # Verify cache file was created
        assert os.path.exists(runner._cache_file), "Cache file was not created"
        
        # Verify all validators were called
        assert all(v.call_count == 1 for v in validators), "Not all validators were called on first run"
        
        # Second run - should potentially use cache (depending on implementation)
        start_time = time.time()
        results2 = await runner.run_all_tests()
        second_run_time = time.time() - start_time
        
        # Verify results are consistent
        assert results1 is not None and results2 is not None, "Cache test runs failed"
        assert len(results1.validation_results) == len(results2.validation_results), "Inconsistent result counts"
        
        # Test cache invalidation by changing configuration
        config_changed = ValidationConfiguration(
            cache_results=True,
            parallel_execution=False,  # Changed configuration
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner_changed = PreStartupTestRunner(config_changed)
        runner_changed.validators = [MockCacheValidator("ChangedValidator")]
        
        # Should not use cache due to configuration change
        results3 = await runner_changed.run_all_tests()
        assert results3 is not None, "Cache invalidation test failed"
        
        # Clean up cache
        if os.path.exists(runner._cache_file):
            os.remove(runner._cache_file)
        if os.path.exists(runner_changed._cache_file):
            os.remove(runner_changed._cache_file)
    
    def test_configuration_variations_comprehensive(self):
        """Test comprehensive configuration variations and their effects."""
        # Test various configuration combinations
        config_variations = [
            {
                "name": "Development mode with parallel execution",
                "config": ValidationConfiguration(
                    development_mode=True,
                    parallel_execution=True,
                    skip_non_critical=True,
                    timeout_seconds=30
                ),
                "expected_behavior": "lenient"
            },
            {
                "name": "Production mode with sequential execution",
                "config": ValidationConfiguration(
                    development_mode=False,
                    parallel_execution=False,
                    skip_non_critical=False,
                    timeout_seconds=60
                ),
                "expected_behavior": "strict"
            },
            {
                "name": "Fast execution mode",
                "config": ValidationConfiguration(
                    development_mode=True,
                    parallel_execution=True,
                    skip_non_critical=True,
                    timeout_seconds=10,
                    cache_results=True
                ),
                "expected_behavior": "fast"
            },
            {
                "name": "Comprehensive testing mode",
                "config": ValidationConfiguration(
                    development_mode=False,
                    parallel_execution=True,
                    skip_non_critical=False,
                    timeout_seconds=120,
                    cache_results=False
                ),
                "expected_behavior": "comprehensive"
            }
        ]
        
        for variation in config_variations:
            config = variation["config"]
            runner = PreStartupTestRunner(config)
            
            # Verify configuration was applied correctly
            assert runner.config == config, f"Configuration not applied for {variation['name']}"
            
            # Test startup decision logic with different failure scenarios
            test_results_scenarios = [
                # No failures
                TestResults(
                    overall_status=ValidationStatus.PASS,
                    validation_results=[
                        ValidationResult(
                            component="TestValidator",
                            test_name="success_test",
                            status=ValidationStatus.PASS,
                            message="Test passed",
                            severity=Severity.MEDIUM
                        )
                    ],
                    execution_time=1.0,
                    timestamp=datetime.now()
                ),
                # Critical failure
                TestResults(
                    overall_status=ValidationStatus.FAIL,
                    validation_results=[
                        ValidationResult(
                            component="TestValidator",
                            test_name="critical_failure",
                            status=ValidationStatus.FAIL,
                            message="Critical test failed",
                            severity=Severity.CRITICAL
                        )
                    ],
                    execution_time=1.0,
                    timestamp=datetime.now()
                ),
                # High severity failure
                TestResults(
                    overall_status=ValidationStatus.FAIL,
                    validation_results=[
                        ValidationResult(
                            component="TestValidator",
                            test_name="high_failure",
                            status=ValidationStatus.FAIL,
                            message="High severity test failed",
                            severity=Severity.HIGH
                        )
                    ],
                    execution_time=1.0,
                    timestamp=datetime.now()
                ),
                # Medium severity failure
                TestResults(
                    overall_status=ValidationStatus.FAIL,
                    validation_results=[
                        ValidationResult(
                            component="TestValidator",
                            test_name="medium_failure",
                            status=ValidationStatus.FAIL,
                            message="Medium severity test failed",
                            severity=Severity.MEDIUM
                        )
                    ],
                    execution_time=1.0,
                    timestamp=datetime.now()
                )
            ]
            
            for i, test_results in enumerate(test_results_scenarios):
                startup_allowed = runner.should_allow_startup(test_results)
                
                # Verify startup decision is appropriate for configuration
                if variation["expected_behavior"] == "lenient":
                    # Development mode should be more permissive
                    if test_results.overall_status == ValidationStatus.PASS:
                        assert startup_allowed, f"Lenient mode should allow startup for passing tests in {variation['name']}"
                elif variation["expected_behavior"] == "strict":
                    # Production mode should be more restrictive
                    if test_results.overall_status == ValidationStatus.FAIL:
                        critical_failures = [r for r in test_results.validation_results 
                                           if r.status == ValidationStatus.FAIL and r.severity == Severity.CRITICAL]
                        if critical_failures:
                            assert not startup_allowed, f"Strict mode should block startup for critical failures in {variation['name']}"
                
                # All configurations should handle the decision gracefully
                assert isinstance(startup_allowed, bool), \
                    f"Invalid startup decision type for {variation['name']}, scenario {i}"
    
    @pytest.mark.asyncio
    async def test_end_to_end_workflow_integration(self):
        """Test complete end-to-end workflow integration."""
        # This test simulates the complete workflow from CLI invocation to server startup
        
        # Test CLI -> Runner -> Validators -> Reporter -> Decision workflow
        cli = PreStartupTestCLI()
        
        # Mock environment for consistent testing
        test_env = {
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_ANON_KEY": "test_key_123",
            "OPENAI_API_KEY": "test_openai_key",
            "ENVIRONMENT": "development"
        }
        
        with patch.dict(os.environ, test_env):
            # Test complete workflow with mocked validators
            with patch.object(ConfigurationValidator, 'validate') as mock_config, \
                 patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
                 patch.object(AuthenticationValidator, 'validate') as mock_auth, \
                 patch.object(APIEndpointValidator, 'validate') as mock_api:
                
                # Configure realistic test scenario
                mock_config.return_value = [
                    ValidationResult(
                        component="ConfigurationValidator",
                        test_name="environment_variables",
                        status=ValidationStatus.PASS,
                        message="All required environment variables present",
                        severity=Severity.CRITICAL,
                        execution_time=0.1
                    )
                ]
                
                mock_db.return_value = [
                    ValidationResult(
                        component="DatabaseConnectivityChecker",
                        test_name="supabase_connection",
                        status=ValidationStatus.PASS,
                        message="Database connection successful",
                        severity=Severity.CRITICAL,
                        execution_time=0.5
                    ),
                    ValidationResult(
                        component="DatabaseConnectivityChecker",
                        test_name="required_tables",
                        status=ValidationStatus.WARNING,
                        message="Some optional tables missing",
                        severity=Severity.MEDIUM,
                        execution_time=0.2
                    )
                ]
                
                mock_auth.return_value = [
                    ValidationResult(
                        component="AuthenticationValidator",
                        test_name="jwt_validation",
                        status=ValidationStatus.PASS,
                        message="JWT validation working correctly",
                        severity=Severity.HIGH,
                        execution_time=0.3
                    )
                ]
                
                mock_api.return_value = [
                    ValidationResult(
                        component="APIEndpointValidator",
                        test_name="admin_endpoints",
                        status=ValidationStatus.PASS,
                        message="Admin endpoints responding correctly",
                        severity=Severity.HIGH,
                        execution_time=0.8
                    ),
                    ValidationResult(
                        component="APIEndpointValidator",
                        test_name="variance_endpoints",
                        status=ValidationStatus.PASS,
                        message="Variance endpoints responding correctly",
                        severity=Severity.MEDIUM,
                        execution_time=0.6
                    )
                ]
                
                # Test different CLI invocation scenarios
                cli_test_scenarios = [
                    {
                        "args": ["--json", "--quiet"],
                        "expected_startup": True,
                        "expected_exit_code": 0
                    },
                    {
                        "args": ["--critical-only", "--json"],
                        "expected_startup": True,
                        "expected_exit_code": 0
                    },
                    {
                        "args": ["--dev-mode", "--verbose"],
                        "expected_startup": True,
                        "expected_exit_code": 0
                    }
                ]
                
                for scenario in cli_test_scenarios:
                    # Mock sys.argv
                    original_argv = sys.argv.copy()
                    try:
                        sys.argv = ["test_cli"] + scenario["args"]
                        args = cli.parser.parse_args(scenario["args"])
                        
                        # Run complete workflow
                        result = await cli.run_tests(args)
                        
                        # Verify end-to-end results
                        assert result is not None, f"End-to-end test failed for args: {scenario['args']}"
                        assert result.get("startup_allowed") == scenario["expected_startup"], \
                            f"Wrong startup decision for args: {scenario['args']}"
                        assert result.get("exit_code") == scenario["expected_exit_code"], \
                            f"Wrong exit code for args: {scenario['args']}"
                        
                        # Verify all components were involved (except for critical-only mode)
                        if "--json" in scenario["args"] and result.get("status") == "completed":
                            assert "test_results" in result, f"Missing test results for args: {scenario['args']}"
                            test_results = result["test_results"]
                            
                            # Should have results from validators (critical-only may have fewer)
                            components = {r["component"] for r in test_results}
                            if "--critical-only" in scenario["args"]:
                                # Critical-only mode may only include critical validators
                                assert len(components) >= 1, f"No validator results for critical-only args: {scenario['args']}"
                            else:
                                # Regular mode should have results from all validators
                                expected_components = {
                                    "ConfigurationValidator",
                                    "DatabaseConnectivityChecker", 
                                    "AuthenticationValidator",
                                    "APIEndpointValidator"
                                }
                                assert expected_components.issubset(components), \
                                    f"Missing validator results for args: {scenario['args']}"
                    
                    finally:
                        sys.argv = original_argv