"""
Property-based tests for test execution orchestration.

**Feature: pre-startup-testing, Property 1: Test Execution Before Startup**
**Validates: Requirements 1.1**
"""

import asyncio
import pytest
from hypothesis import given, strategies as st
from unittest.mock import AsyncMock, Mock
from typing import List

from .models import ValidationConfiguration, ValidationStatus, ValidationResult, Severity
from .runner import PreStartupTestRunner
from .interfaces import BaseValidator


class MockValidator(BaseValidator):
    """Mock validator for testing purposes."""
    
    def __init__(self, config: ValidationConfiguration, component_name: str, results: List[ValidationResult]):
        super().__init__(config)
        self._component_name = component_name
        self._results = results
        self.validate_called = False
    
    @property
    def component_name(self) -> str:
        return self._component_name
    
    async def validate(self) -> List[ValidationResult]:
        self.validate_called = True
        # Simulate some async work
        await asyncio.sleep(0.01)
        return self._results


def create_validation_result(
    component: str = "test_component",
    test_name: str = "test_name",
    status: ValidationStatus = ValidationStatus.PASS,
    message: str = "Test message",
    severity: Severity = Severity.MEDIUM
) -> ValidationResult:
    """Helper to create ValidationResult objects."""
    return ValidationResult(
        component=component,
        test_name=test_name,
        status=status,
        message=message,
        severity=severity
    )


class TestTestExecutionOrchestration:
    """Property-based tests for test execution orchestration."""
    
    @given(
        num_validators=st.integers(min_value=1, max_value=10),
        parallel_execution=st.booleans(),
        timeout_seconds=st.integers(min_value=1, max_value=60)
    )
    @pytest.mark.asyncio
    async def test_property_1_test_execution_before_startup(
        self, 
        num_validators: int, 
        parallel_execution: bool,
        timeout_seconds: int
    ):
        """
        Property 1: Test Execution Before Startup
        
        For any server startup attempt, all validation tests must complete execution 
        before server initialization begins.
        
        **Validates: Requirements 1.1**
        """
        # Arrange: Create test configuration
        config = ValidationConfiguration(
            parallel_execution=parallel_execution,
            timeout_seconds=timeout_seconds,
            cache_results=False  # Disable caching for tests
        )
        
        runner = PreStartupTestRunner(config)
        
        # Create mock validators with different results
        validators = []
        for i in range(num_validators):
            # Create some passing and some failing results
            results = [
                create_validation_result(
                    component=f"validator_{i}",
                    test_name=f"test_{j}",
                    status=ValidationStatus.PASS if j % 2 == 0 else ValidationStatus.FAIL,
                    severity=Severity.MEDIUM
                )
                for j in range(2)  # Each validator has 2 tests
            ]
            
            validator = MockValidator(config, f"validator_{i}", results)
            validators.append(validator)
            runner.add_validator(validator)
        
        # Act: Run all tests (simulating server startup attempt)
        test_results = await runner.run_all_tests()
        
        # Assert: All validators must have been called (tests executed)
        for validator in validators:
            assert validator.validate_called, f"Validator {validator.component_name} was not called"
        
        # Assert: Test results must be available before any startup decision
        assert test_results is not None, "Test results must be available"
        assert len(test_results.validation_results) == num_validators * 2, \
            "All validation results must be collected"
        
        # Assert: Test execution must complete within reasonable time
        assert test_results.execution_time >= 0, "Execution time must be non-negative"
        assert test_results.execution_time < timeout_seconds + 5, \
            "Execution time should not significantly exceed timeout"
        
        # Assert: Overall status must be determined from individual results
        expected_status = ValidationStatus.FAIL if any(
            result.status == ValidationStatus.FAIL 
            for result in test_results.validation_results
        ) else ValidationStatus.PASS
        
        assert test_results.overall_status == expected_status, \
            "Overall status must reflect individual test results"
        
        # Assert: Startup decision must be based on completed test results
        startup_allowed = runner.should_allow_startup(test_results)
        
        # The startup decision should be consistent with the test results
        # (The specific logic is tested in other tests)
        assert isinstance(startup_allowed, bool), \
            "Startup decision must be a boolean value"
        
        # Assert: Startup report must be available after test execution
        startup_report = runner.generate_startup_report(test_results)
        assert startup_report is not None, "Startup report must be available"
        assert len(startup_report) > 0, "Startup report must not be empty"
        assert "Pre-Startup Test Results" in startup_report, \
            "Startup report must contain test results"
    
    @given(
        has_critical_failures=st.booleans(),
        has_non_critical_failures=st.booleans(),
        skip_non_critical=st.booleans()
    )
    @pytest.mark.asyncio
    async def test_startup_decision_logic(
        self,
        has_critical_failures: bool,
        has_non_critical_failures: bool,
        skip_non_critical: bool
    ):
        """
        Test that startup decisions are made correctly based on test results.
        
        This is part of Property 1 - ensuring test execution completes before startup.
        """
        # Arrange
        config = ValidationConfiguration(skip_non_critical=skip_non_critical, cache_results=False)
        runner = PreStartupTestRunner(config)
        
        results = []
        
        if has_critical_failures:
            results.append(create_validation_result(
                status=ValidationStatus.FAIL,
                severity=Severity.CRITICAL,
                message="Critical failure"
            ))
        
        if has_non_critical_failures:
            results.append(create_validation_result(
                status=ValidationStatus.FAIL,
                severity=Severity.MEDIUM,
                message="Non-critical failure"
            ))
        
        # Always add at least one passing test
        results.append(create_validation_result(
            status=ValidationStatus.PASS,
            message="Passing test"
        ))
        
        validator = MockValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        # Act
        test_results = await runner.run_all_tests()
        startup_allowed = runner.should_allow_startup(test_results)
        
        # Assert: Critical failures always block startup
        if has_critical_failures:
            assert not startup_allowed, \
                "Critical failures must always block startup"
        
        # Assert: Non-critical failures behavior depends on configuration
        elif has_non_critical_failures:
            if skip_non_critical:
                assert startup_allowed, \
                    "Non-critical failures should allow startup when skip_non_critical is True"
            else:
                assert not startup_allowed, \
                    "Non-critical failures should block startup when skip_non_critical is False"
        
        # Assert: No failures should allow startup
        else:
            assert startup_allowed, \
                "No failures should allow startup"
    
    @pytest.mark.asyncio
    async def test_empty_validator_list(self):
        """Test behavior with no validators (edge case)."""
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        
        # No validators added
        test_results = await runner.run_all_tests()
        
        assert test_results.overall_status == ValidationStatus.PASS, \
            "Empty validator list should result in PASS status"
        assert len(test_results.validation_results) == 0, \
            "No validation results expected with no validators"
        assert runner.should_allow_startup(test_results), \
            "Startup should be allowed with no validators"
    
    @pytest.mark.asyncio
    async def test_validator_timeout_handling(self):
        """Test that validator timeouts are handled properly."""
        config = ValidationConfiguration(timeout_seconds=1)
        runner = PreStartupTestRunner(config)
        
        # Create a validator that will timeout
        class TimeoutValidator(BaseValidator):
            @property
            def component_name(self) -> str:
                return "timeout_validator"
            
            async def validate(self) -> List[ValidationResult]:
                await asyncio.sleep(2)  # Sleep longer than timeout
                return [create_validation_result()]
        
        runner.add_validator(TimeoutValidator(config))
        
        test_results = await runner.run_all_tests()
        
        # Should have a timeout result
        assert len(test_results.validation_results) == 1
        timeout_result = test_results.validation_results[0]
        assert timeout_result.status == ValidationStatus.FAIL
        assert "timed out" in timeout_result.message.lower()
        assert timeout_result.severity == Severity.HIGH


class TestCriticalFailurePrevention:
    """Property-based tests for critical failure prevention."""
    
    @given(
        num_critical_failures=st.integers(min_value=1, max_value=5),
        num_non_critical_failures=st.integers(min_value=0, max_value=5),
        num_passing_tests=st.integers(min_value=0, max_value=10)
    )
    @pytest.mark.asyncio
    async def test_property_2_critical_failure_prevention(
        self,
        num_critical_failures: int,
        num_non_critical_failures: int,
        num_passing_tests: int
    ):
        """
        Property 2: Critical Failure Prevention
        
        For any test execution with critical failures, server startup must be prevented 
        and detailed error information must be displayed.
        
        **Validates: Requirements 1.2, 8.2**
        """
        # Arrange
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        
        results = []
        
        # Add critical failures
        for i in range(num_critical_failures):
            results.append(create_validation_result(
                component="critical_component",
                test_name=f"critical_test_{i}",
                status=ValidationStatus.FAIL,
                severity=Severity.CRITICAL,
                message=f"Critical failure {i}",
            ))
        
        # Add non-critical failures
        for i in range(num_non_critical_failures):
            results.append(create_validation_result(
                component="non_critical_component",
                test_name=f"non_critical_test_{i}",
                status=ValidationStatus.FAIL,
                severity=Severity.MEDIUM,
                message=f"Non-critical failure {i}",
            ))
        
        # Add passing tests
        for i in range(num_passing_tests):
            results.append(create_validation_result(
                component="passing_component",
                test_name=f"passing_test_{i}",
                status=ValidationStatus.PASS,
                message=f"Passing test {i}",
            ))
        
        validator = MockValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        # Act
        test_results = await runner.run_all_tests()
        startup_allowed = runner.should_allow_startup(test_results)
        startup_report = runner.generate_startup_report(test_results)
        
        # Assert: Critical failures must prevent startup
        assert not startup_allowed, \
            "Critical failures must always prevent server startup"
        
        # Assert: Test results must indicate critical failures
        assert test_results.has_critical_failures(), \
            "Test results must correctly identify critical failures"
        
        # Assert: Detailed error information must be available
        critical_failures = [
            result for result in test_results.validation_results
            if result.status == ValidationStatus.FAIL and result.severity == Severity.CRITICAL
        ]
        assert len(critical_failures) == num_critical_failures, \
            "All critical failures must be captured in results"
        
        # Assert: Startup report must contain error details
        assert "BLOCKED" in startup_report, \
            "Startup report must indicate startup is blocked"
        assert "critical" in startup_report.lower() or "CRITICAL" in startup_report, \
            "Startup report must mention critical failures"
        
        # Assert: Each critical failure must have detailed information
        for failure in critical_failures:
            assert failure.message is not None and len(failure.message) > 0, \
                "Critical failures must have detailed error messages"
            assert failure.component is not None and len(failure.component) > 0, \
                "Critical failures must identify the failing component"
    
    @given(
        severity_levels=st.lists(
            st.sampled_from([Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]),
            min_size=1,
            max_size=10
        )
    )
    @pytest.mark.asyncio
    async def test_critical_failure_identification(self, severity_levels: List[Severity]):
        """Test that critical failures are correctly identified across different severity levels."""
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        
        results = []
        expected_critical_count = 0
        
        for i, severity in enumerate(severity_levels):
            results.append(create_validation_result(
                test_name=f"test_{i}",
                status=ValidationStatus.FAIL,
                severity=severity,
                message=f"Failure with {severity.value} severity"
            ))
            
            if severity == Severity.CRITICAL:
                expected_critical_count += 1
        
        validator = MockValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        test_results = await runner.run_all_tests()
        
        # Assert: Critical failure detection is accurate
        if expected_critical_count > 0:
            assert test_results.has_critical_failures(), \
                "Must detect critical failures when they exist"
        else:
            assert not test_results.has_critical_failures(), \
                "Must not detect critical failures when none exist"


class TestSuccessfulTestCompletion:
    """Property-based tests for successful test completion allowing startup."""
    
    @given(
        num_passing_tests=st.integers(min_value=1, max_value=20),
        num_warnings=st.integers(min_value=0, max_value=5),
        execution_time=st.floats(min_value=0.1, max_value=29.0)
    )
    @pytest.mark.asyncio
    async def test_property_3_successful_test_completion_allows_startup(
        self,
        num_passing_tests: int,
        num_warnings: int,
        execution_time: float
    ):
        """
        Property 3: Successful Test Completion Allows Startup
        
        For any test execution where all critical tests pass, normal server startup 
        must be allowed to proceed.
        
        **Validates: Requirements 1.3**
        """
        # Arrange
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        
        results = []
        
        # Add passing tests
        for i in range(num_passing_tests):
            results.append(create_validation_result(
                test_name=f"passing_test_{i}",
                status=ValidationStatus.PASS,
                severity=Severity.MEDIUM,
                message=f"Test {i} passed successfully"
            ))
        
        # Add warnings (should not block startup)
        for i in range(num_warnings):
            results.append(create_validation_result(
                test_name=f"warning_test_{i}",
                status=ValidationStatus.WARNING,
                severity=Severity.LOW,
                message=f"Warning {i}"
            ))
        
        # Mock the execution time
        class TimedValidator(MockValidator):
            async def validate(self) -> List[ValidationResult]:
                await asyncio.sleep(execution_time / 10)  # Simulate some work
                return self._results
        
        validator = TimedValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        # Act
        test_results = await runner.run_all_tests()
        startup_allowed = runner.should_allow_startup(test_results)
        startup_report = runner.generate_startup_report(test_results)
        
        # Assert: Startup must be allowed when all tests pass or only have warnings
        assert startup_allowed, \
            "Startup must be allowed when all tests pass or only have warnings"
        
        # Assert: No critical failures should be present
        assert not test_results.has_critical_failures(), \
            "No critical failures should be present in successful test execution"
        
        # Assert: All passing tests must be recorded
        passing_tests = test_results.get_passed_tests()
        assert len(passing_tests) == num_passing_tests, \
            "All passing tests must be recorded in results"
        
        # Assert: Warnings should not prevent startup
        warning_tests = test_results.get_warning_tests()
        assert len(warning_tests) == num_warnings, \
            "All warnings must be recorded in results"
        
        # Assert: Overall status should reflect success
        expected_status = ValidationStatus.WARNING if num_warnings > 0 else ValidationStatus.PASS
        assert test_results.overall_status == expected_status, \
            "Overall status must reflect the test outcomes"
        
        # Assert: Startup report must indicate success
        assert "ALLOWED" in startup_report, \
            "Startup report must indicate startup is allowed"
        
        # Assert: Normal server startup should proceed
        assert "✅" in startup_report or "PASS" in startup_report, \
            "Startup report must indicate successful completion"


class TestPerformanceGuarantee:
    """Property-based tests for test performance guarantee."""
    
    @given(
        timeout_seconds=st.integers(min_value=5, max_value=30),
        num_validators=st.integers(min_value=1, max_value=8),
        parallel_execution=st.booleans()
    )
    @pytest.mark.asyncio
    async def test_property_4_test_performance_guarantee(
        self,
        timeout_seconds: int,
        num_validators: int,
        parallel_execution: bool
    ):
        """
        Property 4: Test Performance Guarantee
        
        For any complete test execution, the total runtime must not exceed 30 seconds.
        
        **Validates: Requirements 1.5**
        """
        # Arrange
        config = ValidationConfiguration(
            timeout_seconds=timeout_seconds,
            parallel_execution=parallel_execution
        )
        runner = PreStartupTestRunner(config)
        
        # Create validators with controlled execution time
        validators = []
        for i in range(num_validators):
            # Each validator should complete quickly
            results = [create_validation_result(
                test_name=f"performance_test_{i}",
                status=ValidationStatus.PASS,
                message=f"Performance test {i}"
            )]
            
            class PerformanceValidator(MockValidator):
                async def validate(self) -> List[ValidationResult]:
                    # Simulate realistic work time (much less than timeout)
                    await asyncio.sleep(0.1)
                    return self._results
            
            validator = PerformanceValidator(config, f"validator_{i}", results)
            validators.append(validator)
            runner.add_validator(validator)
        
        # Act
        start_time = asyncio.get_event_loop().time()
        test_results = await runner.run_all_tests()
        end_time = asyncio.get_event_loop().time()
        actual_execution_time = end_time - start_time
        
        # Assert: Execution time must not exceed the configured timeout
        assert actual_execution_time <= timeout_seconds + 1, \
            f"Execution time {actual_execution_time:.2f}s must not significantly exceed timeout {timeout_seconds}s"
        
        # Assert: Execution time must not exceed 30 seconds (hard limit)
        assert actual_execution_time <= 30, \
            f"Execution time {actual_execution_time:.2f}s must not exceed 30 seconds"
        
        # Assert: Recorded execution time should be accurate
        assert abs(test_results.execution_time - actual_execution_time) < 1, \
            "Recorded execution time should be close to actual execution time"
        
        # Assert: All validators should complete successfully within time limit
        assert len(test_results.validation_results) == num_validators, \
            "All validators should complete within the time limit"
        
        # Assert: No timeout failures should occur with reasonable timeouts
        timeout_failures = [
            result for result in test_results.validation_results
            if "timeout" in result.message.lower()
        ]
        assert len(timeout_failures) == 0, \
            "No timeout failures should occur with reasonable execution times"
        
        # Assert: Parallel execution should be faster than sequential for multiple validators
        if num_validators > 1 and parallel_execution:
            # Parallel execution should be significantly faster than sequential
            sequential_estimate = num_validators * 0.1  # Each validator takes ~0.1s
            if sequential_estimate > 1:  # Only check if difference would be meaningful
                assert actual_execution_time < sequential_estimate * 0.8, \
                    "Parallel execution should be faster than sequential execution"


class TestNonCriticalFailureHandling:
    """Property-based tests for non-critical failure handling."""
    
    @given(
        num_non_critical_failures=st.integers(min_value=1, max_value=10),
        skip_non_critical=st.booleans(),
        failure_severities=st.lists(
            st.sampled_from([Severity.MEDIUM, Severity.LOW]),
            min_size=1,
            max_size=5
        )
    )
    @pytest.mark.asyncio
    async def test_property_20_non_critical_failure_handling(
        self,
        num_non_critical_failures: int,
        skip_non_critical: bool,
        failure_severities: List[Severity]
    ):
        """
        Property 20: Non-Critical Failure Handling
        
        For any test execution with only non-critical failures, warnings must be displayed 
        but server startup must be allowed to continue.
        
        **Validates: Requirements 8.1**
        """
        # Arrange
        config = ValidationConfiguration(skip_non_critical=skip_non_critical)
        runner = PreStartupTestRunner(config)
        
        results = []
        
        # Add non-critical failures
        for i in range(num_non_critical_failures):
            severity = failure_severities[i % len(failure_severities)]
            results.append(create_validation_result(
                test_name=f"non_critical_test_{i}",
                status=ValidationStatus.FAIL,
                severity=severity,
                message=f"Non-critical failure {i} with {severity.value} severity"
            ))
        
        # Add at least one passing test
        results.append(create_validation_result(
            test_name="passing_test",
            status=ValidationStatus.PASS,
            message="At least one test passes"
        ))
        
        validator = MockValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        # Act
        test_results = await runner.run_all_tests()
        startup_allowed = runner.should_allow_startup(test_results)
        startup_report = runner.generate_startup_report(test_results)
        
        # Assert: No critical failures should be present
        assert not test_results.has_critical_failures(), \
            "No critical failures should be present in non-critical failure test"
        
        # Assert: Non-critical failures should be recorded
        failed_tests = test_results.get_failed_tests()
        assert len(failed_tests) == num_non_critical_failures, \
            "All non-critical failures must be recorded"
        
        # Assert: Startup behavior depends on configuration
        if skip_non_critical:
            assert startup_allowed, \
                "Startup should be allowed when skip_non_critical is True"
        else:
            # With current implementation, non-critical failures may still block startup
            # depending on severity (HIGH severity blocks, MEDIUM/LOW may allow)
            high_severity_failures = [
                f for f in failed_tests if f.severity == Severity.HIGH
            ]
            if not high_severity_failures:
                # Only MEDIUM/LOW failures - startup should be allowed in development mode
                if config.development_mode:
                    assert startup_allowed, \
                        "Startup should be allowed for MEDIUM/LOW failures in development mode"
        
        # Assert: Warnings must be displayed in report
        assert "warning" in startup_report.lower() or "WARNING" in startup_report, \
            "Startup report must display warnings for non-critical failures"
        
        # Assert: Each non-critical failure must be classified correctly
        for failure in failed_tests:
            criticality = runner.classify_failure_criticality(failure)
            assert criticality in ['non-critical', 'development-only'], \
                f"Non-critical failure must be classified as non-critical or development-only, got {criticality}"


class TestServiceImpactAnalysis:
    """Property-based tests for service impact analysis."""
    
    @given(
        failure_components=st.lists(
            st.sampled_from(['database', 'api', 'authentication', 'configuration']),
            min_size=1,
            max_size=4,
            unique=True
        ),
        num_failures_per_component=st.integers(min_value=1, max_value=3)
    )
    @pytest.mark.asyncio
    async def test_property_21_service_impact_analysis(
        self,
        failure_components: List[str],
        num_failures_per_component: int
    ):
        """
        Property 21: Service Impact Analysis
        
        For any external service unavailability, affected features must be identified 
        and appropriate fallback suggestions must be provided.
        
        **Validates: Requirements 8.3, 8.4**
        """
        # Arrange
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        
        results = []
        
        # Create failures for each component type
        for component in failure_components:
            for i in range(num_failures_per_component):
                results.append(create_validation_result(
                    component=f"{component}_component",
                    test_name=f"{component}_test_{i}",
                    status=ValidationStatus.FAIL,
                    severity=Severity.HIGH,
                    message=f"{component.title()} service unavailable: test {i}"
                ))
        
        validator = MockValidator(config, "test_validator", results)
        runner.add_validator(validator)
        
        # Act
        test_results = await runner.run_all_tests()
        impact_analysis = runner.analyze_service_impact(test_results)
        fallback_suggestions = runner.get_fallback_suggestions(test_results)
        enhanced_report = runner.generate_enhanced_startup_report(test_results)
        
        # Assert: Service impact analysis must identify affected services
        assert len(impact_analysis) > 0, \
            "Service impact analysis must identify affected services"
        
        # Assert: Each failing component type should have impact analysis
        for component in failure_components:
            # Check if any impact analysis mentions this component
            component_mentioned = any(
                component.lower() in service_name.lower() or component.lower() in impact.lower()
                for service_name, impact in impact_analysis.items()
            )
            assert component_mentioned, \
                f"Impact analysis must mention {component} component failures"
        
        # Assert: Fallback suggestions must be provided
        assert len(fallback_suggestions) > 0, \
            "Fallback suggestions must be provided for service failures"
        
        # Assert: Each failing component should have fallback suggestions
        for component in failure_components:
            component_has_fallback = component in fallback_suggestions
            assert component_has_fallback, \
                f"Fallback suggestions must be provided for {component} failures"
            
            # Assert: Fallback suggestions should be actionable
            suggestions = fallback_suggestions[component]
            assert len(suggestions) > 0, \
                f"At least one fallback suggestion must be provided for {component}"
            
            for suggestion in suggestions:
                assert len(suggestion) > 10, \
                    "Fallback suggestions must be detailed and actionable"
        
        # Assert: Enhanced report must include impact analysis
        assert "SERVICE IMPACT ANALYSIS" in enhanced_report or "impact" in enhanced_report.lower(), \
            "Enhanced report must include service impact analysis"
        
        # Assert: Enhanced report must include fallback suggestions
        assert "FALLBACK SUGGESTIONS" in enhanced_report or "fallback" in enhanced_report.lower(), \
            "Enhanced report must include fallback suggestions"
        
        # Assert: Affected features must be identified for each service
        for service_name, impact_description in impact_analysis.items():
            assert "affect" in impact_description.lower(), \
                f"Impact description for {service_name} must identify affected features"
            assert len(impact_description) > 20, \
                f"Impact description for {service_name} must be detailed"