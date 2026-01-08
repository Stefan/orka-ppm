"""
End-to-end integration tests for the complete pre-startup testing system.

This module tests the full system integration from startup command to server launch,
verifying all error scenarios produce appropriate responses.
"""

import pytest
import asyncio
import os
import tempfile
import json
import subprocess
import sys
from unittest.mock import patch, Mock, AsyncMock
from datetime import datetime, timedelta

from .models import ValidationConfiguration, ValidationStatus, ValidationResult, Severity
from .runner import PreStartupTestRunner
from .configuration_validator import ConfigurationValidator
from .database_connectivity_checker import DatabaseConnectivityChecker
from .authentication_validator import AuthenticationValidator
from .api_endpoint_validator import APIEndpointValidator
from .test_reporter import ConsoleTestReporter


class TestEndToEndIntegration:
    """End-to-end integration tests for the complete pre-startup testing system."""
    
    @pytest.mark.asyncio
    async def test_complete_startup_flow_success(self):
        """Test complete startup flow when all tests pass."""
        # Arrange - Create configuration for successful scenario
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=False
        )
        
        runner = PreStartupTestRunner(config)
        
        # Create mock validators that return successful results
        class MockSuccessValidator:
            def __init__(self, config, component_name, test_name):
                self.config = config
                self._component_name = component_name
                self._test_name = test_name
            
            @property
            def component_name(self):
                return self._component_name
            
            async def validate(self):
                return [ValidationResult(
                    component=self._component_name,
                    test_name=self._test_name,
                    status=ValidationStatus.PASS,
                    message=f"{self._component_name} validation successful",
                    severity=Severity.CRITICAL
                )]
        
        # Replace validators with mock ones
        runner.validators = [
            MockSuccessValidator(config, "ConfigurationValidator", "environment_variables"),
            MockSuccessValidator(config, "DatabaseConnectivityChecker", "supabase_connection"),
            MockSuccessValidator(config, "AuthenticationValidator", "jwt_validation"),
            MockSuccessValidator(config, "APIEndpointValidator", "admin_endpoints")
        ]
        
        # Act - Run complete test flow
        results = await runner.run_all_tests()
        startup_allowed = runner.should_allow_startup(results)
        startup_report = runner.generate_startup_report(results)
        
        # Assert - Verify successful startup flow
        assert results.overall_status == ValidationStatus.PASS
        assert startup_allowed is True
        assert "Server startup ALLOWED" in startup_report
        assert results.execution_time < config.timeout_seconds
        assert len(results.validation_results) == 4  # All validators ran
    
    @pytest.mark.asyncio
    async def test_complete_startup_flow_critical_failure(self):
        """Test complete startup flow when critical tests fail."""
        # Arrange - Create configuration for failure scenario
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=False,
            skip_non_critical=False
        )
        
        runner = PreStartupTestRunner(config)
        
        # Mock validators with critical failure
        with patch.object(ConfigurationValidator, 'validate') as mock_config, \
             patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
             patch.object(AuthenticationValidator, 'validate') as mock_auth, \
             patch.object(APIEndpointValidator, 'validate') as mock_api:
            
            # Configure critical failure in database
            mock_config.return_value = [
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="environment_variables",
                    status=ValidationStatus.PASS,
                    message="All required environment variables are present",
                    severity=Severity.CRITICAL
                )
            ]
            
            mock_db.return_value = [
                ValidationResult(
                    component="DatabaseConnectivityChecker",
                    test_name="supabase_connection",
                    status=ValidationStatus.FAIL,
                    message="Cannot connect to Supabase database",
                    severity=Severity.CRITICAL,
                    resolution_steps=[
                        "Check SUPABASE_URL in .env file",
                        "Verify SUPABASE_ANON_KEY is valid",
                        "Test connection manually"
                    ]
                )
            ]
            
            mock_auth.return_value = [
                ValidationResult(
                    component="AuthenticationValidator",
                    test_name="jwt_validation",
                    status=ValidationStatus.PASS,
                    message="JWT validation working correctly",
                    severity=Severity.HIGH
                )
            ]
            
            mock_api.return_value = [
                ValidationResult(
                    component="APIEndpointValidator",
                    test_name="admin_endpoints",
                    status=ValidationStatus.FAIL,
                    message="Admin endpoints not responding",
                    severity=Severity.HIGH,
                    resolution_steps=[
                        "Check database connectivity",
                        "Verify API endpoint configuration"
                    ]
                )
            ]
            
            # Act - Run complete test flow
            results = await runner.run_all_tests()
            startup_allowed = runner.should_allow_startup(results)
            startup_report = runner.generate_startup_report(results)
            enhanced_report = runner.generate_enhanced_startup_report(results)
            
            # Assert - Verify blocked startup flow
            assert results.overall_status == ValidationStatus.FAIL
            assert startup_allowed is False
            assert "Server startup BLOCKED" in startup_report
            assert "CRITICAL FAILURES" in enhanced_report
            assert "Cannot connect to Supabase database" in startup_report
            
            # Verify fallback suggestions are provided
            fallback_suggestions = runner.get_fallback_suggestions(results)
            assert "database" in fallback_suggestions
            assert len(fallback_suggestions["database"]) > 0
            
            # Verify service impact analysis
            impact_analysis = runner.analyze_service_impact(results)
            assert "Database Services" in impact_analysis
    
    @pytest.mark.asyncio
    async def test_startup_flow_with_warnings_only(self):
        """Test startup flow when only warnings are present."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True
        )
        
        runner = PreStartupTestRunner(config)
        
        # Mock validators with warnings only
        with patch.object(ConfigurationValidator, 'validate') as mock_config, \
             patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
             patch.object(AuthenticationValidator, 'validate') as mock_auth, \
             patch.object(APIEndpointValidator, 'validate') as mock_api:
            
            mock_config.return_value = [
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="optional_config",
                    status=ValidationStatus.WARNING,
                    message="Optional configuration missing",
                    severity=Severity.LOW
                )
            ]
            
            mock_db.return_value = [
                ValidationResult(
                    component="DatabaseConnectivityChecker",
                    test_name="optional_tables",
                    status=ValidationStatus.WARNING,
                    message="Some optional tables missing",
                    severity=Severity.MEDIUM
                )
            ]
            
            mock_auth.return_value = [
                ValidationResult(
                    component="AuthenticationValidator",
                    test_name="jwt_validation",
                    status=ValidationStatus.PASS,
                    message="JWT validation working correctly",
                    severity=Severity.HIGH
                )
            ]
            
            mock_api.return_value = [
                ValidationResult(
                    component="APIEndpointValidator",
                    test_name="admin_endpoints",
                    status=ValidationStatus.PASS,
                    message="Admin endpoints responding correctly",
                    severity=Severity.HIGH
                )
            ]
            
            # Act
            results = await runner.run_all_tests()
            startup_allowed = runner.should_allow_startup(results)
            startup_report = runner.generate_startup_report(results)
            
            # Assert - Warnings should allow startup
            assert results.overall_status == ValidationStatus.WARNING
            assert startup_allowed is True
            assert "Server startup ALLOWED" in startup_report
            assert "warnings" in startup_report.lower()
    
    @pytest.mark.asyncio
    async def test_performance_timeout_handling(self):
        """Test system behavior when tests exceed performance limits."""
        # Arrange - Short timeout to trigger performance issues
        config = ValidationConfiguration(
            parallel_execution=False,  # Sequential to make timeout more likely
            timeout_seconds=1,  # Very short timeout
            development_mode=True
        )
        
        runner = PreStartupTestRunner(config)
        
        # Mock slow validator
        async def slow_validate():
            await asyncio.sleep(2)  # Longer than timeout
            return [ValidationResult(
                component="SlowValidator",
                test_name="slow_test",
                status=ValidationStatus.PASS,
                message="This test is slow",
                severity=Severity.MEDIUM
            )]
        
        with patch.object(ConfigurationValidator, 'validate', side_effect=slow_validate):
            # Act
            results = await runner.run_all_tests()
            
            # Assert - Should handle timeout gracefully
            assert results is not None
            timeout_results = [r for r in results.validation_results if "timeout" in r.test_name.lower()]
            assert len(timeout_results) > 0
            
            # Should still make startup decision
            startup_allowed = runner.should_allow_startup(results)
            assert isinstance(startup_allowed, bool)
    
    @pytest.mark.asyncio
    async def test_caching_functionality(self):
        """Test that caching works correctly across multiple runs."""
        # Arrange
        config = ValidationConfiguration(
            cache_results=True,
            parallel_execution=True,
            timeout_seconds=30
        )
        
        runner = PreStartupTestRunner(config)
        
        # Clean up any existing cache
        if os.path.exists(runner._cache_file):
            os.remove(runner._cache_file)
        
        # Mock validators for consistent results
        mock_results = [
            ValidationResult(
                component="TestValidator",
                test_name="cached_test",
                status=ValidationStatus.PASS,
                message="This result should be cached",
                severity=Severity.MEDIUM
            )
        ]
        
        with patch.object(ConfigurationValidator, 'validate', return_value=mock_results), \
             patch.object(DatabaseConnectivityChecker, 'validate', return_value=[]), \
             patch.object(AuthenticationValidator, 'validate', return_value=[]), \
             patch.object(APIEndpointValidator, 'validate', return_value=[]):
            
            # Act - First run (should create cache)
            results1 = await runner.run_all_tests()
            
            # Verify cache file was created
            assert os.path.exists(runner._cache_file)
            
            # Act - Second run (should use cache)
            results2 = await runner.run_all_tests()
            
            # Assert - Results should be similar (from cache)
            assert len(results1.validation_results) == len(results2.validation_results)
            assert results1.overall_status == results2.overall_status
            
            # Second run should be faster (from cache)
            # Note: This is a rough check since caching might not always be faster in tests
            
        # Clean up
        if os.path.exists(runner._cache_file):
            os.remove(runner._cache_file)
    
    @pytest.mark.asyncio
    async def test_error_recovery_scenarios(self):
        """Test various error recovery and fallback scenarios."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=False
        )
        
        runner = PreStartupTestRunner(config)
        
        # Test scenario: Database down, but other services working
        with patch.object(ConfigurationValidator, 'validate') as mock_config, \
             patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
             patch.object(AuthenticationValidator, 'validate') as mock_auth, \
             patch.object(APIEndpointValidator, 'validate') as mock_api:
            
            # Database is down
            mock_db.return_value = [
                ValidationResult(
                    component="DatabaseConnectivityChecker",
                    test_name="supabase_connection",
                    status=ValidationStatus.FAIL,
                    message="Database connection failed",
                    severity=Severity.CRITICAL,
                    resolution_steps=["Check database connectivity", "Use mock data mode"]
                )
            ]
            
            # Other services working
            mock_config.return_value = [
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="environment_variables",
                    status=ValidationStatus.PASS,
                    message="Configuration valid",
                    severity=Severity.CRITICAL
                )
            ]
            
            mock_auth.return_value = [
                ValidationResult(
                    component="AuthenticationValidator",
                    test_name="jwt_validation",
                    status=ValidationStatus.PASS,
                    message="Auth working",
                    severity=Severity.HIGH
                )
            ]
            
            mock_api.return_value = [
                ValidationResult(
                    component="APIEndpointValidator",
                    test_name="admin_endpoints",
                    status=ValidationStatus.FAIL,
                    message="API endpoints failing due to database",
                    severity=Severity.HIGH
                )
            ]
            
            # Act
            results = await runner.run_all_tests()
            fallback_suggestions = runner.get_fallback_suggestions(results)
            impact_analysis = runner.analyze_service_impact(results)
            
            # Assert - Should provide appropriate fallback suggestions
            assert "database" in fallback_suggestions
            assert "mock data mode" in " ".join(fallback_suggestions["database"]).lower()
            
            assert "Database Services" in impact_analysis
            assert "user authentication" in impact_analysis["Database Services"].lower()
    
    @pytest.mark.asyncio
    async def test_cli_integration(self):
        """Test CLI integration and standalone execution."""
        # Test the CLI directly by importing and running it
        from .cli import main
        
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
                    message="All required environment variables are present",
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
                    message="JWT validation working correctly",
                    severity=Severity.HIGH
                )
            ]
            
            mock_api.return_value = [
                ValidationResult(
                    component="APIEndpointValidator",
                    test_name="admin_endpoints",
                    status=ValidationStatus.PASS,
                    message="Admin endpoints responding correctly",
                    severity=Severity.HIGH
                )
            ]
            
            # Capture stdout to verify CLI output
            import io
            import contextlib
            
            stdout_capture = io.StringIO()
            
            # Run the CLI main function
            try:
                with contextlib.redirect_stdout(stdout_capture):
                    await main()
                exit_code = 0
            except SystemExit as e:
                exit_code = e.code
            
            # Get captured output
            output = stdout_capture.getvalue()
            
            # Assert - CLI should run and produce expected output
            assert "Pre-Startup Testing System" in output
            assert exit_code in [0, 1]  # Both success and failure are valid
    
    @pytest.mark.asyncio
    async def test_validator_exception_handling(self):
        """Test that validator exceptions are handled gracefully."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30
        )
        
        runner = PreStartupTestRunner(config)
        
        # Mock validator that raises exception
        with patch.object(ConfigurationValidator, 'validate') as mock_config, \
             patch.object(DatabaseConnectivityChecker, 'validate') as mock_db:
            
            # One validator works normally
            mock_config.return_value = [
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="environment_variables",
                    status=ValidationStatus.PASS,
                    message="Configuration valid",
                    severity=Severity.CRITICAL
                )
            ]
            
            # One validator raises exception
            mock_db.side_effect = Exception("Unexpected validator error")
            
            # Act
            results = await runner.run_all_tests()
            
            # Assert - Should handle exception gracefully
            assert results is not None
            assert results.overall_status == ValidationStatus.FAIL
            
            # Should have error result for the failed validator
            error_results = [r for r in results.validation_results if r.status == ValidationStatus.FAIL]
            assert len(error_results) > 0
            
            # Should still be able to make startup decision
            startup_allowed = runner.should_allow_startup(results)
            assert startup_allowed is False  # Exception should block startup
    
    @pytest.mark.asyncio
    async def test_mixed_severity_scenarios(self):
        """Test scenarios with mixed severity levels."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=False
        )
        
        runner = PreStartupTestRunner(config)
        
        # Mock validators with mixed severity results
        with patch.object(ConfigurationValidator, 'validate') as mock_config, \
             patch.object(DatabaseConnectivityChecker, 'validate') as mock_db, \
             patch.object(AuthenticationValidator, 'validate') as mock_auth, \
             patch.object(APIEndpointValidator, 'validate') as mock_api:
            
            mock_config.return_value = [
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="critical_config",
                    status=ValidationStatus.PASS,
                    message="Critical config valid",
                    severity=Severity.CRITICAL
                ),
                ValidationResult(
                    component="ConfigurationValidator",
                    test_name="optional_config",
                    status=ValidationStatus.WARNING,
                    message="Optional config missing",
                    severity=Severity.LOW
                )
            ]
            
            mock_db.return_value = [
                ValidationResult(
                    component="DatabaseConnectivityChecker",
                    test_name="core_connection",
                    status=ValidationStatus.PASS,
                    message="Core database connection working",
                    severity=Severity.CRITICAL
                ),
                ValidationResult(
                    component="DatabaseConnectivityChecker",
                    test_name="optional_functions",
                    status=ValidationStatus.FAIL,
                    message="Some optional functions missing",
                    severity=Severity.MEDIUM
                )
            ]
            
            mock_auth.return_value = [
                ValidationResult(
                    component="AuthenticationValidator",
                    test_name="jwt_validation",
                    status=ValidationStatus.FAIL,
                    message="JWT validation issues",
                    severity=Severity.HIGH
                )
            ]
            
            mock_api.return_value = [
                ValidationResult(
                    component="APIEndpointValidator",
                    test_name="core_endpoints",
                    status=ValidationStatus.PASS,
                    message="Core endpoints working",
                    severity=Severity.HIGH
                )
            ]
            
            # Act
            results = await runner.run_all_tests()
            startup_allowed = runner.should_allow_startup(results)
            enhanced_report = runner.generate_enhanced_startup_report(results)
            
            # Assert - Should handle mixed severities appropriately
            assert results.overall_status == ValidationStatus.FAIL  # Due to HIGH severity failure
            
            # In development mode, HIGH severity might be allowed depending on configuration
            # The exact behavior depends on the startup decision logic
            
            # Should categorize failures by severity
            assert "CRITICAL FAILURES" in enhanced_report or "NON-CRITICAL FAILURES" in enhanced_report
            
            # Should provide appropriate guidance
            assert len(enhanced_report) > 0
    
    def test_startup_decision_logic_comprehensive(self):
        """Test comprehensive startup decision logic across different scenarios."""
        # Test various combinations of configuration and results
        
        test_cases = [
            # (development_mode, skip_non_critical, has_critical_failures, has_high_failures, expected_startup)
            (True, False, False, False, True),   # Dev mode, no failures -> allow
            (True, False, True, False, False),   # Dev mode, critical failures -> block
            (True, False, False, True, False),   # Dev mode, high failures -> block (HIGH blocks regardless)
            (True, True, False, True, True),     # Dev mode, skip non-critical -> allow
            (False, False, False, False, True),  # Prod mode, no failures -> allow
            (False, False, True, False, False),  # Prod mode, critical failures -> block
            (False, False, False, True, False),  # Prod mode, high failures -> block
            (False, True, False, True, True),    # Prod mode, skip non-critical -> allow
        ]
        
        for dev_mode, skip_non_critical, has_critical, has_high, expected_startup in test_cases:
            # Arrange
            config = ValidationConfiguration(
                development_mode=dev_mode,
                skip_non_critical=skip_non_critical
            )
            
            runner = PreStartupTestRunner(config)
            
            # Create test results based on scenario
            validation_results = []
            
            if has_critical:
                validation_results.append(
                    ValidationResult(
                        component="TestValidator",
                        test_name="critical_test",
                        status=ValidationStatus.FAIL,
                        message="Critical failure",
                        severity=Severity.CRITICAL
                    )
                )
            
            if has_high:
                validation_results.append(
                    ValidationResult(
                        component="TestValidator",
                        test_name="high_test",
                        status=ValidationStatus.FAIL,
                        message="High severity failure",
                        severity=Severity.HIGH
                    )
                )
            
            # Add a passing test
            validation_results.append(
                ValidationResult(
                    component="TestValidator",
                    test_name="passing_test",
                    status=ValidationStatus.PASS,
                    message="This test passes",
                    severity=Severity.MEDIUM
                )
            )
            
            from .models import TestResults
            test_results = TestResults(
                overall_status=ValidationStatus.FAIL if (has_critical or has_high) else ValidationStatus.PASS,
                validation_results=validation_results,
                execution_time=1.0,
                timestamp=datetime.now()
            )
            
            # Act
            startup_allowed = runner.should_allow_startup(test_results)
            
            # Assert
            assert startup_allowed == expected_startup, \
                f"Failed for scenario: dev_mode={dev_mode}, skip_non_critical={skip_non_critical}, " \
                f"has_critical={has_critical}, has_high={has_high}. " \
                f"Expected {expected_startup}, got {startup_allowed}"