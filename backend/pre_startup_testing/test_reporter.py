"""
Test reporter implementation for the pre-startup testing system.
Provides comprehensive reporting with color coding and clear formatting.
"""

import json
from datetime import datetime
from typing import Dict, List
from .interfaces import TestReporter
from .models import ValidationResult, TestResults, ValidationStatus, Severity, ERROR_RESOLUTION_MAP
from .configuration_guidance import ErrorResolutionGuidance, IssueClassifier


class ConsoleTestReporter(TestReporter):
    """Console-based test reporter with color coding and clear formatting."""
    
    # ANSI color codes for console output
    COLORS = {
        'PASS': '\033[92m',      # Green
        'FAIL': '\033[91m',      # Red
        'WARNING': '\033[93m',   # Yellow
        'SKIP': '\033[94m',      # Blue
        'CRITICAL': '\033[95m',  # Magenta
        'HIGH': '\033[91m',      # Red
        'MEDIUM': '\033[93m',    # Yellow
        'LOW': '\033[96m',       # Cyan
        'RESET': '\033[0m',      # Reset
        'BOLD': '\033[1m',       # Bold
        'UNDERLINE': '\033[4m'   # Underline
    }
    
    # Status symbols for visual clarity
    SYMBOLS = {
        ValidationStatus.PASS: '✓',
        ValidationStatus.FAIL: '✗',
        ValidationStatus.WARNING: '⚠',
        ValidationStatus.SKIP: '○'
    }
    
    def __init__(self, use_colors: bool = True):
        """Initialize the console reporter.
        
        Args:
            use_colors: Whether to use ANSI color codes in output
        """
        self.use_colors = use_colors
        if not use_colors:
            # Disable colors by setting all to empty string
            self.COLORS = {key: '' for key in self.COLORS}
        
        # Initialize guidance and classification systems
        self.guidance_system = ErrorResolutionGuidance()
        self.issue_classifier = IssueClassifier()
    
    def generate_summary_report(self, results: TestResults) -> str:
        """Generate a comprehensive summary report of test results.
        
        Args:
            results: TestResults object containing all validation results
            
        Returns:
            Formatted string report with color coding and clear structure
        """
        lines = []
        
        # Header with overall status
        lines.append(self._format_header(results))
        lines.append("")
        
        # Summary statistics
        lines.append(self._format_summary_stats(results))
        lines.append("")
        
        # Detailed results by component
        lines.append(self._format_detailed_results(results))
        
        # Error details if any failures
        failed_tests = results.get_failed_tests()
        if failed_tests:
            lines.append("")
            lines.append(self._format_section_header("ERROR DETAILS"))
            lines.append(self.format_error_details(failed_tests))
        
        # Warnings if any
        warning_tests = results.get_warning_tests()
        if warning_tests:
            lines.append("")
            lines.append(self._format_section_header("WARNINGS"))
            lines.append(self._format_warnings(warning_tests))
        
        # Footer with execution time
        lines.append("")
        lines.append(self._format_footer(results))
        
        return "\n".join(lines)
    
    def format_error_details(self, errors: List[ValidationResult]) -> str:
        """Format detailed error information with resolution guidance.
        
        Args:
            errors: List of ValidationResult objects with FAIL status
            
        Returns:
            Formatted string with error details and resolution steps
        """
        if not errors:
            return "No errors to display."
        
        lines = []
        
        # Use the guidance system to prioritize errors
        prioritized_errors = self.guidance_system.prioritize_errors(errors)
        
        # Group errors by category for better organization
        categorized_errors = self.issue_classifier.group_errors_by_category(errors)
        
        # Display errors by category
        for category_key, category_errors in categorized_errors.items():
            if not category_errors:
                continue
                
            category_info = self.issue_classifier.ISSUE_CATEGORIES[category_key]
            lines.append(f"{self.COLORS['BOLD']}{category_info['name']}{self.COLORS['RESET']}")
            lines.append(f"{category_info['description']}")
            lines.append("")
            
            # Find prioritized errors in this category
            category_prioritized = [
                (error, guidance) for error, guidance in prioritized_errors 
                if error in category_errors
            ]
            
            for i, (error, guidance) in enumerate(category_prioritized, 1):
                lines.append(self._format_error_item_with_guidance(i, error, guidance))
                lines.append("")
        
        return "\n".join(lines)
    
    def provide_resolution_guidance(self, error: ValidationResult) -> str:
        """Provide specific resolution guidance for an error.
        
        Args:
            error: ValidationResult object with FAIL status
            
        Returns:
            Formatted string with resolution steps
        """
        guidance = self.guidance_system.get_resolution_guidance(error)
        
        lines = []
        
        # Add title and description
        lines.append(f"{self.COLORS['BOLD']}{guidance['title']}{self.COLORS['RESET']}")
        lines.append(f"Description: {guidance['description']}")
        lines.append("")
        
        # Add resolution steps
        lines.append("Resolution Steps:")
        for step in guidance['steps']:
            lines.append(f"  {step}")
        
        # Add documentation links if available
        if guidance['documentation_links']:
            lines.append("")
            lines.append("Documentation:")
            for link in guidance['documentation_links']:
                lines.append(f"  • {link}")
        
        # Add configuration files if available
        if guidance['config_files']:
            lines.append("")
            lines.append("Configuration Files to Check:")
            for config_file in guidance['config_files']:
                lines.append(f"  • {config_file}")
        
        return "\n".join(lines)
    
    def create_machine_readable_output(self, results: TestResults) -> dict:
        """Create machine-readable JSON output for CI/CD systems.
        
        Args:
            results: TestResults object containing all validation results
            
        Returns:
            Dictionary suitable for JSON serialization
        """
        return {
            "timestamp": results.timestamp.isoformat(),
            "overall_status": results.overall_status.value,
            "execution_time": results.execution_time,
            "summary": {
                "total_tests": len(results.validation_results),
                "passed": len(results.get_passed_tests()),
                "failed": len(results.get_failed_tests()),
                "warnings": len(results.get_warning_tests()),
                "critical_failures": results.has_critical_failures()
            },
            "results": [
                {
                    "component": result.component,
                    "test_name": result.test_name,
                    "status": result.status.value,
                    "severity": result.severity.value,
                    "message": result.message,
                    "execution_time": result.execution_time,
                    "details": result.details,
                    "resolution_steps": result.resolution_steps
                }
                for result in results.validation_results
            ]
        }
    
    def _format_header(self, results: TestResults) -> str:
        """Format the report header with overall status."""
        status_color = self._get_status_color(results.overall_status)
        symbol = self.SYMBOLS.get(results.overall_status, '?')
        
        header = f"{self.COLORS['BOLD']}PRE-STARTUP TESTING REPORT{self.COLORS['RESET']}"
        status_line = f"{status_color}{symbol} Overall Status: {results.overall_status.value.upper()}{self.COLORS['RESET']}"
        
        return f"{header}\n{status_line}"
    
    def _format_summary_stats(self, results: TestResults) -> str:
        """Format summary statistics."""
        total = len(results.validation_results)
        passed = len(results.get_passed_tests())
        failed = len(results.get_failed_tests())
        warnings = len(results.get_warning_tests())
        
        lines = [
            f"{self.COLORS['BOLD']}SUMMARY{self.COLORS['RESET']}",
            f"Total Tests: {total}",
            f"{self.COLORS['PASS']}Passed: {passed}{self.COLORS['RESET']}",
            f"{self.COLORS['FAIL']}Failed: {failed}{self.COLORS['RESET']}",
            f"{self.COLORS['WARNING']}Warnings: {warnings}{self.COLORS['RESET']}"
        ]
        
        if results.has_critical_failures():
            lines.append(f"{self.COLORS['CRITICAL']}⚠ CRITICAL FAILURES DETECTED{self.COLORS['RESET']}")
        
        return "\n".join(lines)
    
    def _format_detailed_results(self, results: TestResults) -> str:
        """Format detailed results grouped by component."""
        lines = [f"{self.COLORS['BOLD']}DETAILED RESULTS{self.COLORS['RESET']}"]
        
        # Group results by component
        by_component = {}
        for result in results.validation_results:
            if result.component not in by_component:
                by_component[result.component] = []
            by_component[result.component].append(result)
        
        # Format each component's results
        for component, component_results in by_component.items():
            lines.append(f"\n{self.COLORS['UNDERLINE']}{component}{self.COLORS['RESET']}")
            
            for result in component_results:
                status_color = self._get_status_color(result.status)
                symbol = self.SYMBOLS.get(result.status, '?')
                
                # Add severity indicator for failures
                severity_indicator = ""
                if result.status == ValidationStatus.FAIL:
                    severity_color = self._get_severity_color(result.severity)
                    severity_indicator = f" {severity_color}[{result.severity.value.upper()}]{self.COLORS['RESET']}"
                
                time_info = f" ({result.execution_time:.2f}s)" if result.execution_time > 0 else ""
                
                lines.append(f"  {status_color}{symbol} {result.test_name}{severity_indicator}{self.COLORS['RESET']}{time_info}")
                
                # Add message if not just a simple pass
                if result.status != ValidationStatus.PASS or result.message != "Test passed":
                    lines.append(f"    {result.message}")
        
        return "\n".join(lines)
    
    def _format_error_item(self, index: int, error: ValidationResult) -> str:
        """Format a single error item with details."""
        severity_color = self._get_severity_color(error.severity)
        
        lines = [
            f"{self.COLORS['BOLD']}{index}. {error.component} - {error.test_name}{self.COLORS['RESET']}",
            f"   {severity_color}Severity: {error.severity.value.upper()}{self.COLORS['RESET']}",
            f"   Message: {error.message}"
        ]
        
        # Add details if available
        if error.details:
            lines.append("   Details:")
            for key, value in error.details.items():
                lines.append(f"     {key}: {value}")
        
        # Add resolution guidance
        guidance = self.provide_resolution_guidance(error)
        if guidance:
            lines.append("   Resolution:")
            for line in guidance.split('\n'):
                if line.strip():
                    lines.append(f"     {line}")
        
        return "\n".join(lines)
    
    def _format_error_item_with_guidance(self, index: int, error: ValidationResult, guidance: Dict[str, any]) -> str:
        """Format a single error item with comprehensive guidance."""
        severity_color = self._get_severity_color(guidance['severity'])
        
        lines = [
            f"{self.COLORS['BOLD']}{index}. {guidance['title']}{self.COLORS['RESET']}",
            f"   Component: {error.component} - {error.test_name}",
            f"   {severity_color}Severity: {guidance['severity'].value.upper()}{self.COLORS['RESET']}",
            f"   Message: {error.message}"
        ]
        
        # Add error details if available
        if error.details:
            lines.append("   Details:")
            for key, value in error.details.items():
                lines.append(f"     {key}: {value}")
        
        # Add resolution steps
        lines.append("   Resolution Steps:")
        for step in guidance['steps']:
            lines.append(f"     {step}")
        
        # Add documentation links if available
        if guidance['documentation_links']:
            lines.append("   Documentation:")
            for link in guidance['documentation_links']:
                lines.append(f"     • {link}")
        
        # Add configuration files if available
        if guidance['config_files']:
            lines.append("   Configuration Files:")
            for config_file in guidance['config_files']:
                lines.append(f"     • {config_file}")
        
        return "\n".join(lines)
    
    def _format_warnings(self, warnings: List[ValidationResult]) -> str:
        """Format warning messages."""
        lines = []
        for warning in warnings:
            lines.append(f"{self.COLORS['WARNING']}⚠ {warning.component} - {warning.test_name}{self.COLORS['RESET']}")
            lines.append(f"  {warning.message}")
            if warning.resolution_steps:
                lines.append("  Suggestions:")
                for step in warning.resolution_steps:
                    lines.append(f"    • {step}")
            lines.append("")
        
        return "\n".join(lines)
    
    def _format_footer(self, results: TestResults) -> str:
        """Format the report footer."""
        return (f"{self.COLORS['BOLD']}Execution completed in {results.execution_time:.2f} seconds "
                f"at {results.timestamp.strftime('%Y-%m-%d %H:%M:%S')}{self.COLORS['RESET']}")
    
    def _format_section_header(self, title: str) -> str:
        """Format a section header."""
        return f"{self.COLORS['BOLD']}{self.COLORS['UNDERLINE']}{title}{self.COLORS['RESET']}"
    
    def _format_resolution_steps(self, steps: List[str]) -> str:
        """Format resolution steps."""
        return "\n".join(steps)
    
    def _get_status_color(self, status: ValidationStatus) -> str:
        """Get color code for a validation status."""
        return self.COLORS.get(status.name, self.COLORS['RESET'])
    
    def _get_severity_color(self, severity: Severity) -> str:
        """Get color code for a severity level."""
        return self.COLORS.get(severity.name, self.COLORS['RESET'])
    
    def _severity_priority(self, severity: Severity) -> int:
        """Get numeric priority for severity (higher = more severe)."""
        priority_map = {
            Severity.CRITICAL: 4,
            Severity.HIGH: 3,
            Severity.MEDIUM: 2,
            Severity.LOW: 1
        }
        return priority_map.get(severity, 0)


class JSONTestReporter(TestReporter):
    """JSON-based test reporter for machine-readable output."""
    
    def __init__(self, pretty_print: bool = False):
        """Initialize the JSON reporter.
        
        Args:
            pretty_print: Whether to format JSON output with indentation
        """
        self.pretty_print = pretty_print
    
    def generate_summary_report(self, results: TestResults) -> str:
        """Generate JSON summary report."""
        data = self.create_machine_readable_output(results)
        
        if self.pretty_print:
            return json.dumps(data, indent=2, default=str)
        else:
            return json.dumps(data, default=str)
    
    def format_error_details(self, errors: List[ValidationResult]) -> str:
        """Format errors as JSON."""
        error_data = [
            {
                "component": error.component,
                "test_name": error.test_name,
                "severity": error.severity.value,
                "message": error.message,
                "details": error.details,
                "resolution_steps": error.resolution_steps
            }
            for error in errors
        ]
        
        if self.pretty_print:
            return json.dumps({"errors": error_data}, indent=2)
        else:
            return json.dumps({"errors": error_data})
    
    def provide_resolution_guidance(self, error: ValidationResult) -> str:
        """Provide resolution guidance as JSON."""
        guidance_data = {
            "error": {
                "component": error.component,
                "test_name": error.test_name,
                "message": error.message
            },
            "resolution_steps": error.resolution_steps
        }
        
        if self.pretty_print:
            return json.dumps(guidance_data, indent=2)
        else:
            return json.dumps(guidance_data)
    
    def create_machine_readable_output(self, results: TestResults) -> dict:
        """Create machine-readable output (same as ConsoleTestReporter)."""
        return {
            "timestamp": results.timestamp.isoformat(),
            "overall_status": results.overall_status.value,
            "execution_time": results.execution_time,
            "summary": {
                "total_tests": len(results.validation_results),
                "passed": len(results.get_passed_tests()),
                "failed": len(results.get_failed_tests()),
                "warnings": len(results.get_warning_tests()),
                "critical_failures": results.has_critical_failures()
            },
            "results": [
                {
                    "component": result.component,
                    "test_name": result.test_name,
                    "status": result.status.value,
                    "severity": result.severity.value,
                    "message": result.message,
                    "execution_time": result.execution_time,
                    "details": result.details,
                    "resolution_steps": result.resolution_steps
                }
                for result in results.validation_results
            ]
        }