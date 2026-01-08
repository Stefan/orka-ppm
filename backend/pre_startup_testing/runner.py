"""
Pre-startup test runner implementation.
"""

import asyncio
import time
import hashlib
import json
import os
from datetime import datetime
from typing import List, Dict, Type, Optional

from .interfaces import BaseValidator, TestRunner
from .models import TestResults, ValidationStatus, ValidationResult, ValidationConfiguration, Severity
from .configuration_validator import ConfigurationValidator
from .database_connectivity_checker import DatabaseConnectivityChecker
from .authentication_validator import AuthenticationValidator
from .api_endpoint_validator import APIEndpointValidator
from .test_reporter import ConsoleTestReporter


class PreStartupTestRunner(TestRunner):
    """
    Orchestrates all validation tests and controls server startup flow.
    
    This class provides:
    - Parallel execution of all validators
    - Test result aggregation and startup decision logic
    - Performance optimization and caching
    - Error recovery and fallback handling
    """
    
    def __init__(self, config: ValidationConfiguration):
        self.config = config
        self.validators: List[BaseValidator] = []
        self._validator_registry: Dict[str, Type[BaseValidator]] = {}
        self.reporter = ConsoleTestReporter()
        self._cache_file = ".pre_startup_test_cache.json"
        
        # Register all available validators
        self._register_default_validators()
    
    def _register_default_validators(self):
        """Register all default validator classes."""
        self._validator_registry = {
            'ConfigurationValidator': ConfigurationValidator,
            'DatabaseConnectivityChecker': DatabaseConnectivityChecker,
            'AuthenticationValidator': AuthenticationValidator,
            'APIEndpointValidator': APIEndpointValidator
        }
    
    def initialize_validators(self, base_url: str = "http://localhost:8000"):
        """Initialize all validators with the current configuration.
        
        Args:
            base_url: Base URL for API endpoint testing
        """
        self.validators = [
            ConfigurationValidator(self.config),
            DatabaseConnectivityChecker(self.config),
            AuthenticationValidator(self.config),
            APIEndpointValidator(self.config, base_url)
        ]
    
    def register_validator(self, validator_class: Type[BaseValidator]):
        """Register a validator class for use in testing."""
        self._validator_registry[validator_class.__name__] = validator_class
    
    def add_validator(self, validator: BaseValidator):
        """Add a validator instance to the test runner."""
        self.validators.append(validator)
    
    async def run_all_tests(self) -> TestResults:
        """
        Run all validation tests in parallel or sequential mode.
        
        Returns:
            TestResults object containing all validation outcomes.
        """
        start_time = time.time()
        timestamp = datetime.now()
        
        # Check cache if enabled
        if self.config.cache_results:
            cached_results = await self._get_cached_results()
            if cached_results:
                return cached_results
        
        # Initialize validators if not already done
        if not self.validators:
            self.initialize_validators()
        
        # Run tests based on configuration
        if self.config.parallel_execution:
            validation_results = await self._run_tests_parallel()
        else:
            validation_results = await self._run_tests_sequential()
        
        execution_time = time.time() - start_time
        
        # Determine overall status
        overall_status = self._determine_overall_status(validation_results)
        
        # Create test results
        results = TestResults(
            overall_status=overall_status,
            validation_results=validation_results,
            execution_time=execution_time,
            timestamp=timestamp
        )
        
        # Cache results if enabled
        if self.config.cache_results:
            await self._cache_results(results)
        
        return results
    
    async def run_critical_tests_only(self) -> TestResults:
        """
        Run only tests marked as critical severity.
        
        Returns:
            TestResults object containing critical test outcomes.
        """
        # Run all tests first
        all_results = await self.run_all_tests()
        
        # Filter to only critical results
        critical_results = [
            result for result in all_results.validation_results
            if result.severity == Severity.CRITICAL or 
               (result.status == ValidationStatus.FAIL and result.severity in [Severity.CRITICAL, Severity.HIGH])
        ]
        
        return TestResults(
            overall_status=self._determine_overall_status(critical_results),
            validation_results=critical_results,
            execution_time=all_results.execution_time,
            timestamp=all_results.timestamp
        )
    
    def should_allow_startup(self, results: TestResults) -> bool:
        """
        Determine if server startup should be allowed based on test results.
        
        Args:
            results: TestResults object from test execution
            
        Returns:
            True if startup should be allowed, False otherwise
        """
        # Block startup if there are critical failures
        if results.has_critical_failures():
            return False
        
        # Allow startup if configured to skip non-critical failures
        if self.config.skip_non_critical:
            return True
        
        # Check for high severity failures that should block startup
        high_severity_failures = [
            result for result in results.get_failed_tests()
            if result.severity in [Severity.CRITICAL, Severity.HIGH]
        ]
        
        if high_severity_failures:
            return False
        
        # If skip_non_critical is False, check for any failures
        failed_tests = results.get_failed_tests()
        if failed_tests and not self.config.skip_non_critical:
            # In development mode, allow startup with only medium/low failures
            if self.config.development_mode:
                # Only allow if all failures are medium or low severity
                medium_low_failures = [
                    result for result in failed_tests
                    if result.severity in [Severity.MEDIUM, Severity.LOW]
                ]
                return len(medium_low_failures) == len(failed_tests)
            else:
                # In production mode, block startup for any failures
                return False
        
        # Allow startup if no failures
        return True
    
    def generate_startup_report(self, results: TestResults) -> str:
        """
        Generate a report for startup decision.
        
        Args:
            results: TestResults object from test execution
            
        Returns:
            Formatted string report
        """
        lines = []
        lines.append("=== Pre-Startup Test Results ===")
        lines.append(f"Overall Status: {results.overall_status.value.upper()}")
        lines.append(f"Execution Time: {results.execution_time:.2f}s")
        lines.append(f"Timestamp: {results.timestamp.isoformat()}")
        lines.append("")
        
        # Summary counts
        passed = len(results.get_passed_tests())
        failed = len(results.get_failed_tests())
        warnings = len(results.get_warning_tests())
        
        lines.append(f"Tests: {passed} passed, {failed} failed, {warnings} warnings")
        lines.append("")
        
        # Show failures if any
        if failed > 0:
            lines.append("FAILURES:")
            for result in results.get_failed_tests():
                lines.append(f"  ❌ {result.component}.{result.test_name}: {result.message}")
                if result.resolution_steps:
                    for step in result.resolution_steps:
                        lines.append(f"     {step}")
            lines.append("")
        
        # Show warnings if any
        if warnings > 0:
            lines.append("WARNINGS:")
            for result in results.get_warning_tests():
                lines.append(f"  ⚠️  {result.component}.{result.test_name}: {result.message}")
            lines.append("")
        
        # Startup decision
        if self.should_allow_startup(results):
            lines.append("✅ Server startup ALLOWED")
        else:
            lines.append("❌ Server startup BLOCKED")
            lines.append("Fix the above issues before starting the server.")
        
        return "\n".join(lines)
    
    async def _run_tests_parallel(self) -> List[ValidationResult]:
        """Run all validators in parallel with performance monitoring."""
        if not self.validators:
            return []
        
        # Create semaphore to limit concurrent tests
        semaphore = asyncio.Semaphore(self.config.max_concurrent_tests)
        
        # Performance monitoring
        start_time = time.time()
        performance_timeout = self.config.timeout_seconds * 0.8  # Use 80% of timeout for individual tests
        
        async def run_validator_with_semaphore(validator: BaseValidator):
            async with semaphore:
                validator_start = time.time()
                try:
                    # Run with performance monitoring
                    results = await asyncio.wait_for(
                        validator.validate(),
                        timeout=performance_timeout
                    )
                    
                    # Add execution time to each result
                    validator_time = time.time() - validator_start
                    for result in results:
                        if result.execution_time == 0.0:
                            result.execution_time = validator_time / len(results)
                    
                    return results
                    
                except asyncio.TimeoutError:
                    return [ValidationResult(
                        component=validator.component_name,
                        test_name="performance_timeout",
                        status=ValidationStatus.FAIL,
                        message=f"Validator timed out after {performance_timeout:.1f}s (performance limit)",
                        severity=Severity.HIGH,
                        execution_time=performance_timeout,
                        resolution_steps=[
                            f"Validator {validator.component_name} exceeded performance limit",
                            "1. Check for slow database queries or network calls",
                            "2. Optimize validator implementation",
                            "3. Consider increasing timeout if necessary",
                            "4. Review system performance and resources"
                        ]
                    )]
                except Exception as e:
                    return [ValidationResult(
                        component=validator.component_name,
                        test_name="validator_exception",
                        status=ValidationStatus.FAIL,
                        message=f"Validator raised exception: {str(e)}",
                        severity=Severity.HIGH,
                        execution_time=time.time() - validator_start
                    )]
        
        # Run all validators concurrently
        validator_results = await asyncio.gather(
            *[run_validator_with_semaphore(validator) for validator in self.validators],
            return_exceptions=True
        )
        
        # Check overall performance
        total_time = time.time() - start_time
        if total_time > self.config.timeout_seconds:
            # Add performance warning
            performance_warning = ValidationResult(
                component="Performance Monitor",
                test_name="overall_performance",
                status=ValidationStatus.WARNING,
                message=f"Test execution took {total_time:.1f}s, exceeding {self.config.timeout_seconds}s limit",
                severity=Severity.MEDIUM,
                execution_time=total_time,
                resolution_steps=[
                    "Test execution exceeded performance target",
                    "1. Enable parallel execution if not already enabled",
                    "2. Reduce number of concurrent tests if system is overloaded",
                    "3. Optimize slow validators",
                    "4. Consider caching results for faster subsequent runs"
                ]
            )
        
        # Flatten results
        all_results = []
        for result_list in validator_results:
            if isinstance(result_list, list):
                all_results.extend(result_list)
            else:
                # Handle exceptions that weren't caught above
                all_results.append(ValidationResult(
                    component="unknown",
                    test_name="unexpected_exception",
                    status=ValidationStatus.FAIL,
                    message=f"Unexpected error: {str(result_list)}",
                    severity=Severity.HIGH
                ))
        
        # Add performance warning if needed
        if total_time > self.config.timeout_seconds:
            all_results.append(performance_warning)
        
        return all_results
    
    async def _run_tests_sequential(self) -> List[ValidationResult]:
        """Run all validators sequentially with performance monitoring."""
        all_results = []
        start_time = time.time()
        
        for validator in self.validators:
            validator_start = time.time()
            try:
                results = await asyncio.wait_for(
                    validator.validate(),
                    timeout=self.config.timeout_seconds
                )
                
                # Add execution time to each result
                validator_time = time.time() - validator_start
                for result in results:
                    if result.execution_time == 0.0:
                        result.execution_time = validator_time / len(results)
                
                all_results.extend(results)
                
                # Check if we're approaching the overall timeout
                elapsed_time = time.time() - start_time
                if elapsed_time > self.config.timeout_seconds * 0.8:
                    # Add warning about approaching timeout
                    all_results.append(ValidationResult(
                        component="Performance Monitor",
                        test_name="sequential_performance_warning",
                        status=ValidationStatus.WARNING,
                        message=f"Sequential execution approaching timeout limit ({elapsed_time:.1f}s elapsed)",
                        severity=Severity.MEDIUM,
                        execution_time=elapsed_time,
                        resolution_steps=[
                            "Sequential execution is slow",
                            "1. Enable parallel execution for better performance",
                            "2. Optimize slow validators",
                            "3. Consider running only critical tests first"
                        ]
                    ))
                    break
                    
            except asyncio.TimeoutError:
                all_results.append(ValidationResult(
                    component=validator.component_name,
                    test_name="timeout",
                    status=ValidationStatus.FAIL,
                    message=f"Validator timed out after {self.config.timeout_seconds}s",
                    severity=Severity.HIGH,
                    execution_time=self.config.timeout_seconds
                ))
            except Exception as e:
                all_results.append(ValidationResult(
                    component=validator.component_name,
                    test_name="exception",
                    status=ValidationStatus.FAIL,
                    message=f"Validator raised exception: {str(e)}",
                    severity=Severity.HIGH,
                    execution_time=time.time() - validator_start
                ))
        
        return all_results
    
    def _determine_overall_status(self, validation_results: List[ValidationResult]) -> ValidationStatus:
        """Determine overall test status from individual results."""
        if not validation_results:
            return ValidationStatus.PASS
        
        # If any test failed, overall status is FAIL
        if any(result.status == ValidationStatus.FAIL for result in validation_results):
            return ValidationStatus.FAIL
        
        # If any test has warnings, overall status is WARNING
        if any(result.status == ValidationStatus.WARNING for result in validation_results):
            return ValidationStatus.WARNING
        
        # If all tests passed or were skipped
        return ValidationStatus.PASS
    
    async def _get_cached_results(self) -> Optional[TestResults]:
        """Get cached test results if they are still valid."""
        try:
            if not os.path.exists(self._cache_file):
                return None
            
            with open(self._cache_file, 'r') as f:
                cache_data = json.load(f)
            
            # Check if cache is still valid (based on configuration hash)
            current_config_hash = self._get_configuration_hash()
            if cache_data.get('config_hash') != current_config_hash:
                return None
            
            # Check cache age (max 5 minutes)
            cache_timestamp = datetime.fromisoformat(cache_data['timestamp'])
            if (datetime.now() - cache_timestamp).total_seconds() > 300:
                return None
            
            # Reconstruct TestResults from cache
            validation_results = []
            for result_data in cache_data['validation_results']:
                validation_results.append(ValidationResult(
                    component=result_data['component'],
                    test_name=result_data['test_name'],
                    status=ValidationStatus(result_data['status']),
                    message=result_data['message'],
                    details=result_data.get('details'),
                    resolution_steps=result_data.get('resolution_steps', []),
                    severity=Severity(result_data['severity']),
                    execution_time=result_data.get('execution_time', 0.0)
                ))
            
            return TestResults(
                overall_status=ValidationStatus(cache_data['overall_status']),
                validation_results=validation_results,
                execution_time=cache_data['execution_time'],
                timestamp=cache_timestamp
            )
            
        except Exception:
            # If cache reading fails, just return None to run fresh tests
            return None
    
    async def _cache_results(self, results: TestResults):
        """Cache test results for future use."""
        try:
            cache_data = {
                'timestamp': results.timestamp.isoformat(),
                'config_hash': self._get_configuration_hash(),
                'overall_status': results.overall_status.value,
                'execution_time': results.execution_time,
                'validation_results': [
                    {
                        'component': result.component,
                        'test_name': result.test_name,
                        'status': result.status.value,
                        'message': result.message,
                        'details': result.details,
                        'resolution_steps': result.resolution_steps,
                        'severity': result.severity.value,
                        'execution_time': result.execution_time
                    }
                    for result in results.validation_results
                ]
            }
            
            with open(self._cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
                
        except Exception:
            # If caching fails, just continue without caching
            pass
    
    def _get_configuration_hash(self) -> str:
        """Generate a hash of the current configuration to detect changes."""
        # Include relevant environment variables and config settings
        config_data = {
            'SUPABASE_URL': os.getenv('SUPABASE_URL'),
            'SUPABASE_ANON_KEY': os.getenv('SUPABASE_ANON_KEY'),
            'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
            'test_endpoints': self.config.test_endpoints,
            'timeout_seconds': self.config.timeout_seconds,
            'development_mode': self.config.development_mode
        }
        
        config_str = json.dumps(config_data, sort_keys=True)
        return hashlib.md5(config_str.encode()).hexdigest()
    
    def get_fallback_suggestions(self, results: TestResults) -> Dict[str, List[str]]:
        """Get fallback suggestions for various failure scenarios.
        
        Args:
            results: TestResults object from test execution
            
        Returns:
            Dictionary mapping failure types to fallback suggestions
        """
        suggestions = {}
        
        failed_tests = results.get_failed_tests()
        
        # Database connectivity failures
        db_failures = [r for r in failed_tests if 'database' in r.component.lower() or 'connectivity' in r.component.lower()]
        if db_failures:
            suggestions['database'] = [
                "Consider using mock data mode for continued development",
                "Disable database-dependent features temporarily",
                "Use local SQLite database for basic testing",
                "Focus on frontend development while database issues are resolved"
            ]
        
        # API endpoint failures
        api_failures = [r for r in failed_tests if 'api' in r.component.lower() or 'endpoint' in r.component.lower()]
        if api_failures:
            suggestions['api'] = [
                "Use mock API responses for frontend development",
                "Disable affected endpoints temporarily",
                "Test individual components in isolation",
                "Use Postman or curl for manual API testing"
            ]
        
        # Authentication failures
        auth_failures = [r for r in failed_tests if 'auth' in r.component.lower()]
        if auth_failures:
            suggestions['authentication'] = [
                "Use development mode with mock authentication",
                "Disable authentication for local development",
                "Use hardcoded test credentials temporarily",
                "Focus on non-authenticated features first"
            ]
        
        # Configuration failures
        config_failures = [r for r in failed_tests if 'config' in r.component.lower()]
        if config_failures:
            suggestions['configuration'] = [
                "Use .env.example as template for missing variables",
                "Set up minimal configuration for basic functionality",
                "Use default values for non-critical settings",
                "Prioritize fixing critical configuration issues first"
            ]
        
        return suggestions
    
    def analyze_service_impact(self, results: TestResults) -> Dict[str, str]:
        """Analyze which services will be affected by failures.
        
        Args:
            results: TestResults object from test execution
            
        Returns:
            Dictionary mapping service names to impact descriptions
        """
        impact_analysis = {}
        
        failed_tests = results.get_failed_tests()
        
        # Analyze database impact
        db_failures = [r for r in failed_tests if 'database' in r.component.lower()]
        if db_failures:
            impact_analysis['Database Services'] = (
                "Database connectivity issues will affect: user authentication, "
                "data persistence, API endpoints that query data, and real-time features"
            )
        
        # Analyze API impact
        api_failures = [r for r in failed_tests if 'api' in r.component.lower()]
        if api_failures:
            impact_analysis['API Services'] = (
                "API endpoint failures will affect: frontend data loading, "
                "user interactions, admin functions, and third-party integrations"
            )
        
        # Analyze authentication impact
        auth_failures = [r for r in failed_tests if 'auth' in r.component.lower()]
        if auth_failures:
            impact_analysis['Authentication Services'] = (
                "Authentication issues will affect: user login, protected routes, "
                "role-based access control, and secure API endpoints"
            )
        
        # Analyze configuration impact
        config_failures = [r for r in failed_tests if 'config' in r.component.lower()]
        if config_failures:
            impact_analysis['Configuration Services'] = (
                "Configuration problems will affect: external service connections, "
                "API integrations, security settings, and environment-specific features"
            )
        
        return impact_analysis
    
    def classify_failure_criticality(self, result: ValidationResult) -> str:
        """Classify a failure as critical, non-critical, or development-only.
        
        Args:
            result: ValidationResult with FAIL status
            
        Returns:
            String classification: 'critical', 'non-critical', or 'development-only'
        """
        # Critical failures that should always block startup
        critical_patterns = [
            'supabase_connection',
            'missing_environment_variable',
            'authentication_failed',
            'database_connection',
            'execute_sql'
        ]
        
        # Non-critical failures that can be worked around
        non_critical_patterns = [
            'optional_table',
            'performance_warning',
            'format_validation',
            'response_format'
        ]
        
        # Development-only issues that don't affect production
        dev_only_patterns = [
            'development_mode',
            'test_endpoint',
            'mock_data'
        ]
        
        test_key = f"{result.component}_{result.test_name}".lower()
        
        # Check for critical patterns
        for pattern in critical_patterns:
            if pattern in test_key or pattern in result.message.lower():
                return 'critical'
        
        # Check for development-only patterns
        for pattern in dev_only_patterns:
            if pattern in test_key or pattern in result.message.lower():
                return 'development-only'
        
        # Check for non-critical patterns
        for pattern in non_critical_patterns:
            if pattern in test_key or pattern in result.message.lower():
                return 'non-critical'
        
        # Default classification based on severity
        if result.severity == Severity.CRITICAL:
            return 'critical'
        elif result.severity == Severity.HIGH:
            return 'critical' if not self.config.development_mode else 'non-critical'
        else:
            return 'non-critical'
    
    def generate_enhanced_startup_report(self, results: TestResults) -> str:
        """Generate an enhanced startup report with fallback suggestions and service impact analysis.
        
        Args:
            results: TestResults object from test execution
            
        Returns:
            Enhanced formatted string report
        """
        lines = []
        lines.append("=== ENHANCED PRE-STARTUP TEST RESULTS ===")
        lines.append(f"Overall Status: {results.overall_status.value.upper()}")
        lines.append(f"Execution Time: {results.execution_time:.2f}s")
        lines.append(f"Timestamp: {results.timestamp.isoformat()}")
        lines.append("")
        
        # Summary counts with criticality breakdown
        passed = len(results.get_passed_tests())
        failed_tests = results.get_failed_tests()
        warnings = len(results.get_warning_tests())
        
        critical_failures = [r for r in failed_tests if self.classify_failure_criticality(r) == 'critical']
        non_critical_failures = [r for r in failed_tests if self.classify_failure_criticality(r) == 'non-critical']
        dev_only_failures = [r for r in failed_tests if self.classify_failure_criticality(r) == 'development-only']
        
        lines.append(f"Tests: {passed} passed, {len(failed_tests)} failed, {warnings} warnings")
        lines.append(f"Failure Breakdown: {len(critical_failures)} critical, {len(non_critical_failures)} non-critical, {len(dev_only_failures)} dev-only")
        lines.append("")
        
        # Show critical failures first
        if critical_failures:
            lines.append("🚨 CRITICAL FAILURES (Block Startup):")
            for result in critical_failures:
                lines.append(f"  ❌ {result.component}.{result.test_name}: {result.message}")
                if result.resolution_steps:
                    for step in result.resolution_steps[:2]:  # Show first 2 steps
                        lines.append(f"     {step}")
            lines.append("")
        
        # Show non-critical failures
        if non_critical_failures:
            lines.append("⚠️  NON-CRITICAL FAILURES (Can Continue with Warnings):")
            for result in non_critical_failures:
                lines.append(f"  ⚠️  {result.component}.{result.test_name}: {result.message}")
            lines.append("")
        
        # Show development-only issues
        if dev_only_failures:
            lines.append("🔧 DEVELOPMENT-ONLY ISSUES:")
            for result in dev_only_failures:
                lines.append(f"  🔧 {result.component}.{result.test_name}: {result.message}")
            lines.append("")
        
        # Service impact analysis
        if failed_tests:
            impact_analysis = self.analyze_service_impact(results)
            if impact_analysis:
                lines.append("📊 SERVICE IMPACT ANALYSIS:")
                for service, impact in impact_analysis.items():
                    lines.append(f"  • {service}: {impact}")
                lines.append("")
        
        # Fallback suggestions
        if failed_tests:
            fallback_suggestions = self.get_fallback_suggestions(results)
            if fallback_suggestions:
                lines.append("💡 FALLBACK SUGGESTIONS:")
                for category, suggestions in fallback_suggestions.items():
                    lines.append(f"  {category.title()}:")
                    for suggestion in suggestions[:2]:  # Show first 2 suggestions
                        lines.append(f"    • {suggestion}")
                lines.append("")
        
        # Startup decision with enhanced logic
        startup_allowed = self.should_allow_startup(results)
        if startup_allowed:
            if critical_failures:
                lines.append("⚠️  Server startup ALLOWED with CRITICAL issues (check configuration)")
            elif non_critical_failures:
                lines.append("✅ Server startup ALLOWED (non-critical issues present)")
            else:
                lines.append("✅ Server startup ALLOWED")
        else:
            lines.append("❌ Server startup BLOCKED")
            lines.append("Fix critical issues above before starting the server.")
            
            # Suggest immediate actions
            lines.append("")
            lines.append("IMMEDIATE ACTIONS:")
            if critical_failures:
                lines.append("1. Focus on critical failures first")
                lines.append("2. Check environment variables and database connectivity")
                lines.append("3. Run database migrations if needed")
                lines.append("4. Verify external service availability")
        
        return "\n".join(lines)