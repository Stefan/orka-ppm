"""
Core interfaces for the pre-startup testing system.
"""

from abc import ABC, abstractmethod
from typing import List
from .models import ValidationResult, ValidationConfiguration


class BaseValidator(ABC):
    """Base interface for all validation components."""
    
    def __init__(self, config: ValidationConfiguration):
        self.config = config
    
    @abstractmethod
    async def validate(self) -> List[ValidationResult]:
        """
        Run validation tests and return results.
        
        Returns:
            List of ValidationResult objects representing test outcomes.
        """
        pass
    
    @property
    @abstractmethod
    def component_name(self) -> str:
        """Name of the validation component."""
        pass
    
    def create_result(
        self, 
        test_name: str, 
        status, 
        message: str, 
        **kwargs
    ) -> ValidationResult:
        """Helper method to create ValidationResult objects."""
        return ValidationResult(
            component=self.component_name,
            test_name=test_name,
            status=status,
            message=message,
            **kwargs
        )


class TestReporter(ABC):
    """Interface for test result reporting."""
    
    @abstractmethod
    def generate_summary_report(self, results) -> str:
        """Generate a summary report of test results."""
        pass
    
    @abstractmethod
    def format_error_details(self, errors: List[ValidationResult]) -> str:
        """Format detailed error information."""
        pass
    
    @abstractmethod
    def provide_resolution_guidance(self, error: ValidationResult) -> str:
        """Provide resolution guidance for a specific error."""
        pass
    
    @abstractmethod
    def create_machine_readable_output(self, results) -> dict:
        """Create machine-readable output for CI/CD systems."""
        pass


class TestRunner(ABC):
    """Interface for test execution orchestration."""
    
    @abstractmethod
    async def run_all_tests(self) -> 'TestResults':
        """Run all validation tests."""
        pass
    
    @abstractmethod
    async def run_critical_tests_only(self) -> 'TestResults':
        """Run only critical validation tests."""
        pass
    
    @abstractmethod
    def should_allow_startup(self, results: 'TestResults') -> bool:
        """Determine if server startup should be allowed based on test results."""
        pass
    
    @abstractmethod
    def generate_startup_report(self, results: 'TestResults') -> str:
        """Generate a report for startup decision."""
        pass