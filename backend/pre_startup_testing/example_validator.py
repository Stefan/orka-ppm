"""
Example validator to demonstrate the pre-startup testing system.
"""

from typing import List
from .interfaces import BaseValidator
from .models import ValidationResult, ValidationStatus, Severity


class ExampleValidator(BaseValidator):
    """
    Example validator that demonstrates the validation interface.
    This can be used for testing and as a template for other validators.
    """
    
    @property
    def component_name(self) -> str:
        return "example_validator"
    
    async def validate(self) -> List[ValidationResult]:
        """
        Run example validation tests.
        
        Returns:
            List of ValidationResult objects.
        """
        results = []
        
        # Example test 1: Always passes
        results.append(self.create_result(
            test_name="always_pass",
            status=ValidationStatus.PASS,
            message="This test always passes",
            severity=Severity.LOW
        ))
        
        # Example test 2: Environment check (mock)
        try:
            import os
            if os.getenv("EXAMPLE_VAR"):
                results.append(self.create_result(
                    test_name="environment_check",
                    status=ValidationStatus.PASS,
                    message="EXAMPLE_VAR environment variable is set",
                    severity=Severity.MEDIUM
                ))
            else:
                results.append(self.create_result(
                    test_name="environment_check",
                    status=ValidationStatus.WARNING,
                    message="EXAMPLE_VAR environment variable is not set",
                    severity=Severity.LOW,
                    resolution_steps=[
                        "Set EXAMPLE_VAR environment variable",
                        "Add EXAMPLE_VAR=value to your .env file"
                    ]
                ))
        except Exception as e:
            results.append(self.create_result(
                test_name="environment_check",
                status=ValidationStatus.FAIL,
                message=f"Failed to check environment: {str(e)}",
                severity=Severity.MEDIUM
            ))
        
        return results