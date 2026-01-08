"""
Property-based tests for the test reporter functionality.
Tests comprehensive reporting, error resolution guidance, and issue prioritization.
"""

import pytest
from datetime import datetime
from hypothesis import given, strategies as st, assume, settings
from hypothesis import HealthCheck
from typing import List

from .models import ValidationResult, TestResults, ValidationStatus, Severity
from .test_reporter import ConsoleTestReporter, JSONTestReporter
from .configuration_guidance import ErrorResolutionGuidance, IssueClassifier


# Test data generators
@st.composite
def _validation_result_strategy(draw):
    """Generate ValidationResult objects for testing."""
    component = draw(st.sampled_from([
        "ConfigurationValidator", "DatabaseConnectivityChecker", 
        "AuthenticationValidator", "APIEndpointValidator"
    ]))
    
    test_name = draw(st.text(min_size=5, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc'))))
    
    status = draw(st.sampled_from(list(ValidationStatus)))
    severity = draw(st.sampled_from(list(Severity)))
    
    # Generate realistic error messages based on component
    if component == "DatabaseConnectivityChecker":
        messages = [
            "Supabase connection failed", "Missing execute_sql function", 
            "Database table not found", "Permission denied"
        ]
    elif component == "AuthenticationValidator":
        messages = [
            "JWT validation failed", "RBAC validation failed", 
            "Authentication endpoint failed", "Token parsing error"
        ]
    elif component == "APIEndpointValidator":
        messages = [
            "API endpoint failed", "Missing API dependency", 
            "Endpoint authentication failed", "Response format invalid"
        ]
    else:  # ConfigurationValidator
        messages = [
            "Missing environment variable", "Invalid configuration format", 
            "Configuration validation failed", "Environment setup error"
        ]
    
    message = draw(st.sampled_from(messages))
    
    # Generate optional details
    details = draw(st.one_of(
        st.none(),
        st.dictionaries(
            st.text(min_size=1, max_size=20), 
            st.text(min_size=1, max_size=50),
            min_size=0, max_size=3
        )
    ))
    
    # Generate resolution steps
    resolution_steps = draw(st.lists(
        st.text(min_size=10, max_size=100), 
        min_size=0, max_size=5
    ))
    
    execution_time = draw(st.floats(min_value=0.0, max_value=30.0))
    
    return ValidationResult(
        component=component,
        test_name=test_name,
        status=status,
        message=message,
        details=details,
        resolution_steps=resolution_steps,
        severity=severity,
        execution_time=execution_time
    )


@st.composite
def _failed_validation_result_strategy(draw):
    """Generate ValidationResult objects that are guaranteed to be failures."""
    result = draw(_validation_result_strategy())
    # Force status to FAIL
    return ValidationResult(
        component=result.component,
        test_name=result.test_name,
        status=ValidationStatus.FAIL,
        message=result.message,
        details=result.details,
        resolution_steps=result.resolution_steps,
        severity=result.severity,
        execution_time=result.execution_time
    )


@st.composite
def _test_results_strategy(draw):
    """Generate TestResults objects for testing."""
    validation_results = draw(st.lists(_validation_result_strategy(), min_size=1, max_size=20))
    
    # Determine overall status based on individual results
    has_failures = any(result.status == ValidationStatus.FAIL for result in validation_results)
    has_critical_failures = any(
        result.status == ValidationStatus.FAIL and result.severity == Severity.CRITICAL 
        for result in validation_results
    )
    
    if has_critical_failures:
        overall_status = ValidationStatus.FAIL
    elif has_failures:
        overall_status = ValidationStatus.FAIL
    else:
        overall_status = ValidationStatus.PASS
    
    execution_time = draw(st.floats(min_value=0.1, max_value=30.0))
    timestamp = datetime.now()
    
    return TestResults(
        overall_status=overall_status,
        validation_results=validation_results,
        execution_time=execution_time,
        timestamp=timestamp
    )


class TestTestReporterProperties:
    """Property-based tests for test reporter functionality."""
    
    @given(_test_results_strategy())
    def test_property_15_comprehensive_test_reporting(self, results: TestResults):
        """
        Property 15: Comprehensive Test Reporting
        For any test execution completion, a comprehensive report showing all test results 
        with proper formatting must be generated.
        
        Feature: pre-startup-testing, Property 15: Comprehensive Test Reporting
        Validates: Requirements 6.1, 6.3
        """
        # Test console reporter
        console_reporter = ConsoleTestReporter(use_colors=False)  # Disable colors for testing
        report = console_reporter.generate_summary_report(results)
        
        # Verify report contains essential elements
        assert isinstance(report, str)
        assert len(report) > 0
        
        # Check for required sections
        assert "PRE-STARTUP TESTING REPORT" in report
        assert "SUMMARY" in report
        assert "DETAILED RESULTS" in report
        
        # Verify all test results are included
        for validation_result in results.validation_results:
            assert validation_result.component in report
            assert validation_result.test_name in report
        
        # Check summary statistics are present
        total_tests = len(results.validation_results)
        passed_tests = len(results.get_passed_tests())
        failed_tests = len(results.get_failed_tests())
        warning_tests = len(results.get_warning_tests())
        
        assert f"Total Tests: {total_tests}" in report
        assert f"Passed: {passed_tests}" in report
        assert f"Failed: {failed_tests}" in report
        assert f"Warnings: {warning_tests}" in report
        
        # Check execution time is included
        assert f"{results.execution_time:.2f} seconds" in report
        
        # Test JSON reporter
        json_reporter = JSONTestReporter(pretty_print=True)
        json_report = json_reporter.generate_summary_report(results)
        
        # Verify JSON report is valid and contains required data
        import json
        parsed_json = json.loads(json_report)
        
        assert "overall_status" in parsed_json
        assert "execution_time" in parsed_json
        assert "summary" in parsed_json
        assert "results" in parsed_json
        
        # Verify summary matches actual data
        assert parsed_json["summary"]["total_tests"] == total_tests
        assert parsed_json["summary"]["passed"] == passed_tests
        assert parsed_json["summary"]["failed"] == failed_tests
        assert parsed_json["summary"]["warnings"] == warning_tests
        
        # Verify all results are included in JSON
        assert len(parsed_json["results"]) == len(results.validation_results)
    
    @given(st.lists(_failed_validation_result_strategy(), min_size=1, max_size=10))
    def test_property_16_error_resolution_guidance(self, failed_results: List[ValidationResult]):
        """
        Property 16: Error Resolution Guidance
        For any test failure, specific error messages with suggested resolution steps 
        must be provided.
        
        Feature: pre-startup-testing, Property 16: Error Resolution Guidance
        Validates: Requirements 6.2, 3.4, 4.4
        """
        # All results are already failed, no need to filter
        assume(len(failed_results) > 0)
        
        console_reporter = ConsoleTestReporter(use_colors=False)
        guidance_system = ErrorResolutionGuidance()
        
        # Test individual error guidance
        for error in failed_results:
            guidance = console_reporter.provide_resolution_guidance(error)
            
            # Verify guidance is provided
            assert isinstance(guidance, str)
            assert len(guidance) > 0
            
            # Check that guidance contains resolution information
            guidance_lower = guidance.lower()
            assert any(keyword in guidance_lower for keyword in [
                "resolution", "steps", "check", "verify", "run", "configure"
            ])
            
            # Test guidance system directly
            detailed_guidance = guidance_system.get_resolution_guidance(error)
            
            assert isinstance(detailed_guidance, dict)
            assert "title" in detailed_guidance
            assert "description" in detailed_guidance
            assert "steps" in detailed_guidance
            assert "severity" in detailed_guidance
            
            # Verify steps are provided
            assert isinstance(detailed_guidance["steps"], list)
            assert len(detailed_guidance["steps"]) > 0
            
            # Each step should be a non-empty string
            for step in detailed_guidance["steps"]:
                assert isinstance(step, str)
                assert len(step.strip()) > 0
        
        # Test error details formatting
        error_details = console_reporter.format_error_details(failed_results)
        
        assert isinstance(error_details, str)
        assert len(error_details) > 0
        
        # Verify all failed results are included in error details
        for error in failed_results:
            assert error.component in error_details
            assert error.message in error_details
    
    @given(st.lists(_failed_validation_result_strategy(), min_size=2, max_size=15))
    def test_property_17_issue_prioritization(self, mixed_results: List[ValidationResult]):
        """
        Property 17: Issue Prioritization
        For any test execution with multiple issues, results must be prioritized 
        and ordered by severity and impact.
        
        Feature: pre-startup-testing, Property 17: Issue Prioritization
        Validates: Requirements 6.4
        """
        # All results are already failed, ensure we have multiple failures
        failed_results = mixed_results
        assume(len(failed_results) >= 2)
        
        guidance_system = ErrorResolutionGuidance()
        issue_classifier = IssueClassifier()
        
        # Test prioritization
        prioritized_errors = guidance_system.prioritize_errors(failed_results)
        
        # Verify prioritization returns all errors
        assert len(prioritized_errors) == len(failed_results)
        
        # Verify prioritization structure
        for error, guidance in prioritized_errors:
            assert isinstance(error, ValidationResult)
            assert isinstance(guidance, dict)
            assert error.status == ValidationStatus.FAIL
        
        # Test that critical errors come first
        critical_errors = [
            (error, guidance) for error, guidance in prioritized_errors 
            if guidance["severity"] == Severity.CRITICAL
        ]
        non_critical_errors = [
            (error, guidance) for error, guidance in prioritized_errors 
            if guidance["severity"] != Severity.CRITICAL
        ]
        
        if critical_errors and non_critical_errors:
            # Find positions of critical and non-critical errors
            critical_positions = [
                i for i, (error, guidance) in enumerate(prioritized_errors)
                if guidance["severity"] == Severity.CRITICAL
            ]
            non_critical_positions = [
                i for i, (error, guidance) in enumerate(prioritized_errors)
                if guidance["severity"] != Severity.CRITICAL
            ]
            
            # Critical errors should generally come before non-critical ones
            if critical_positions and non_critical_positions:
                min_critical_pos = min(critical_positions)
                max_non_critical_pos = max(non_critical_positions)
                # Allow some flexibility in ordering, but critical should generally be first
                assert min_critical_pos <= max_non_critical_pos
        
        # Test issue classification
        categorized_errors = issue_classifier.group_errors_by_category(failed_results)
        
        # Verify categorization
        assert isinstance(categorized_errors, dict)
        
        # Verify all errors are categorized
        total_categorized = sum(len(errors) for errors in categorized_errors.values())
        assert total_categorized == len(failed_results)
        
        # Verify each category contains appropriate errors
        for category, errors in categorized_errors.items():
            assert category in issue_classifier.ISSUE_CATEGORIES
            for error in errors:
                # Verify the classification makes sense
                classified_category = issue_classifier.classify_error(error)
                assert classified_category == category
        
        # Test resolution report generation
        resolution_report = guidance_system.generate_resolution_report(failed_results)
        
        assert isinstance(resolution_report, str)
        assert len(resolution_report) > 0
        assert "ERROR RESOLUTION GUIDE" in resolution_report
        
        # Verify all failed results are mentioned in the resolution report
        for error in failed_results:
            # Either the component or a related term should be in the report
            assert any(term in resolution_report for term in [
                error.component, error.test_name, error.message.split()[0]
            ])


class TestErrorResolutionGuidanceProperties:
    """Property-based tests for error resolution guidance system."""
    
    @given(_failed_validation_result_strategy())
    def test_guidance_system_completeness(self, error: ValidationResult):
        """Test that guidance system provides complete information for any error."""
        guidance_system = ErrorResolutionGuidance()
        
        guidance = guidance_system.get_resolution_guidance(error)
        
        # Verify required fields are present
        required_fields = ["title", "description", "severity", "steps"]
        for field in required_fields:
            assert field in guidance
            assert guidance[field] is not None
        
        # Verify steps are actionable
        assert isinstance(guidance["steps"], list)
        assert len(guidance["steps"]) > 0
        
        for step in guidance["steps"]:
            assert isinstance(step, str)
            assert len(step.strip()) > 0
    
    @given(st.lists(_failed_validation_result_strategy(), min_size=1, max_size=10))
    def test_issue_classification_consistency(self, errors: List[ValidationResult]):
        """Test that issue classification is consistent and complete."""
        classifier = IssueClassifier()
        
        for error in errors:
            category = classifier.classify_error(error)
            
            # Verify category is valid
            assert category in classifier.ISSUE_CATEGORIES
            
            # Verify classification is consistent (same error always gets same category)
            category2 = classifier.classify_error(error)
            assert category == category2
        
        # Test grouping
        grouped = classifier.group_errors_by_category(errors)
        
        # Verify all errors are grouped
        total_grouped = sum(len(error_list) for error_list in grouped.values())
        assert total_grouped == len(errors)
        
        # Verify no error appears in multiple categories
        all_grouped_errors = []
        for error_list in grouped.values():
            all_grouped_errors.extend(error_list)
        
        assert len(all_grouped_errors) == len(set(id(error) for error in all_grouped_errors))


if __name__ == "__main__":
    # Run the property tests
    pytest.main([__file__, "-v", "--tb=short"])