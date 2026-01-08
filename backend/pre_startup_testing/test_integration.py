"""
Integration tests for the pre-startup testing system.
"""

import pytest
from .models import ValidationConfiguration, ValidationStatus
from .runner import PreStartupTestRunner
from .example_validator import ExampleValidator


class TestPreStartupIntegration:
    """Integration tests for the complete pre-startup testing system."""
    
    @pytest.mark.asyncio
    async def test_complete_system_integration(self):
        """Test the complete system with real validators."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=10
        )
        
        runner = PreStartupTestRunner(config)
        runner.add_validator(ExampleValidator(config))
        
        # Act
        results = await runner.run_all_tests()
        
        # Assert
        assert results is not None
        assert len(results.validation_results) >= 2  # ExampleValidator has 2 tests
        assert results.execution_time >= 0
        assert results.timestamp is not None
        
        # Test startup decision
        startup_allowed = runner.should_allow_startup(results)
        assert isinstance(startup_allowed, bool)
        
        # Test report generation
        report = runner.generate_startup_report(results)
        assert isinstance(report, str)
        assert len(report) > 0
        assert "Pre-Startup Test Results" in report
    
    @pytest.mark.asyncio
    async def test_sequential_execution(self):
        """Test sequential execution mode."""
        config = ValidationConfiguration(
            parallel_execution=False,
            timeout_seconds=10
        )
        
        runner = PreStartupTestRunner(config)
        runner.add_validator(ExampleValidator(config))
        
        results = await runner.run_all_tests()
        
        assert results is not None
        assert len(results.validation_results) >= 2
    
    @pytest.mark.asyncio
    async def test_critical_tests_only(self):
        """Test running only critical tests."""
        config = ValidationConfiguration()
        runner = PreStartupTestRunner(config)
        runner.add_validator(ExampleValidator(config))
        
        results = await runner.run_critical_tests_only()
        
        assert results is not None
        # Results may be empty if no critical tests exist in ExampleValidator
        assert isinstance(results.validation_results, list)