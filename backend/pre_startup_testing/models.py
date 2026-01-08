"""
Core data models for the pre-startup testing system.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any


class ValidationStatus(Enum):
    """Status of a test execution."""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    SKIP = "skip"


class Severity(Enum):
    """Severity level of test results."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OutputFormat(Enum):
    """Output format for test results."""
    CONSOLE = "console"
    JSON = "json"
    MACHINE_READABLE = "machine_readable"


@dataclass
class ValidationResult:
    """Result of a single validation test."""
    component: str
    test_name: str
    status: ValidationStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    resolution_steps: List[str] = field(default_factory=list)
    severity: Severity = Severity.MEDIUM
    execution_time: float = 0.0


@dataclass
class TestResults:
    """Aggregated results from all validation tests."""
    overall_status: ValidationStatus
    validation_results: List[ValidationResult]
    execution_time: float
    timestamp: datetime
    
    def has_critical_failures(self) -> bool:
        """Check if any validation results have critical severity failures."""
        return any(
            result.status == ValidationStatus.FAIL and result.severity == Severity.CRITICAL
            for result in self.validation_results
        )
    
    def get_failures_by_severity(self) -> Dict[Severity, List[ValidationResult]]:
        """Group failed validation results by severity level."""
        failures_by_severity = {severity: [] for severity in Severity}
        
        for result in self.validation_results:
            if result.status == ValidationStatus.FAIL:
                failures_by_severity[result.severity].append(result)
        
        return failures_by_severity
    
    def get_passed_tests(self) -> List[ValidationResult]:
        """Get all tests that passed."""
        return [result for result in self.validation_results if result.status == ValidationStatus.PASS]
    
    def get_failed_tests(self) -> List[ValidationResult]:
        """Get all tests that failed."""
        return [result for result in self.validation_results if result.status == ValidationStatus.FAIL]
    
    def get_warning_tests(self) -> List[ValidationResult]:
        """Get all tests that generated warnings."""
        return [result for result in self.validation_results if result.status == ValidationStatus.WARNING]


@dataclass
class ValidationConfiguration:
    """Configuration for test execution."""
    skip_non_critical: bool = False
    timeout_seconds: int = 30
    parallel_execution: bool = True
    cache_results: bool = True
    output_format: OutputFormat = OutputFormat.CONSOLE
    
    # Endpoint-specific configuration
    test_endpoints: List[str] = field(default_factory=lambda: [
        "/admin/users",
        "/csv-import/variances", 
        "/variance/alerts"
    ])
    
    # Environment-specific settings
    development_mode: bool = True
    skip_external_services: bool = False
    
    # Performance settings
    max_concurrent_tests: int = 5
    retry_failed_tests: bool = True
    max_retries: int = 2


# Error resolution guidance mapping
ERROR_RESOLUTION_MAP = {
    "missing_execute_sql_function": [
        "The execute_sql database function is missing",
        "1. Run database migrations: python apply_migration_direct.py",
        "2. Or modify endpoints to use standard Supabase queries",
        "3. Check migration files in backend/migrations/"
    ],
    "supabase_connection_failed": [
        "Cannot connect to Supabase database",
        "1. Check SUPABASE_URL in .env file",
        "2. Verify SUPABASE_ANON_KEY is valid",
        "3. Test connection: curl -H 'apikey: YOUR_KEY' YOUR_URL/rest/v1/"
    ],
    "missing_environment_variable": [
        "Required environment variable is missing",
        "1. Check .env file in backend directory",
        "2. Copy from .env.example if available",
        "3. Ensure all required variables are set"
    ],
    "authentication_failed": [
        "Authentication system validation failed",
        "1. Check JWT token configuration",
        "2. Verify authentication endpoints are working",
        "3. Test with valid credentials"
    ],
    "api_endpoint_failed": [
        "API endpoint validation failed",
        "1. Check if endpoint exists and is accessible",
        "2. Verify required database functions are available",
        "3. Test endpoint manually with curl or Postman"
    ]
}