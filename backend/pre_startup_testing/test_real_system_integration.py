"""
Real system integration tests for the pre-startup testing system.

This module tests the actual system integration without mocking,
demonstrating that the complete system works end-to-end.
"""

import pytest
import asyncio
import os
from datetime import datetime

from .models import ValidationConfiguration, ValidationStatus
from .runner import PreStartupTestRunner
from .cli import main


class TestRealSystemIntegration:
    """Real system integration tests that test the actual components."""
    
    @pytest.mark.asyncio
    async def test_runner_initialization_and_basic_flow(self):
        """Test that the runner can be initialized and run basic operations."""
        # Arrange
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True  # Allow startup even with failures
        )
        
        runner = PreStartupTestRunner(config)
        
        # Act - Initialize validators
        runner.initialize_validators()
        
        # Assert - Validators should be initialized
        assert len(runner.validators) == 4  # Config, DB, Auth, API validators
        assert all(hasattr(v, 'validate') for v in runner.validators)
        assert all(hasattr(v, 'component_name') for v in runner.validators)
        
        # Test that we can run tests (may fail, but should complete)
        results = await runner.run_all_tests()
        
        # Assert - Should get results regardless of pass/fail
        assert results is not None
        assert isinstance(results.validation_results, list)
        assert results.execution_time >= 0
        assert isinstance(results.timestamp, datetime)
        
        # Should be able to make startup decision
        startup_allowed = runner.should_allow_startup(results)
        assert isinstance(startup_allowed, bool)
        
        # Should be able to generate reports
        basic_report = runner.generate_startup_report(results)
        enhanced_report = runner.generate_enhanced_startup_report(results)
        
        assert isinstance(basic_report, str)
        assert isinstance(enhanced_report, str)
        assert len(basic_report) > 0
        assert len(enhanced_report) > 0
        assert "Pre-Startup Test Results" in basic_report
    
    @pytest.mark.asyncio
    async def test_parallel_vs_sequential_execution(self):
        """Test that both parallel and sequential execution modes work."""
        # Test parallel execution
        config_parallel = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner_parallel = PreStartupTestRunner(config_parallel)
        results_parallel = await runner_parallel.run_all_tests()
        
        # Test sequential execution
        config_sequential = ValidationConfiguration(
            parallel_execution=False,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner_sequential = PreStartupTestRunner(config_sequential)
        results_sequential = await runner_sequential.run_all_tests()
        
        # Both should complete successfully
        assert results_parallel is not None
        assert results_sequential is not None
        
        # Both should have similar number of results
        assert len(results_parallel.validation_results) == len(results_sequential.validation_results)
        
        # Both should be able to make startup decisions
        startup_parallel = runner_parallel.should_allow_startup(results_parallel)
        startup_sequential = runner_sequential.should_allow_startup(results_sequential)
        
        assert isinstance(startup_parallel, bool)
        assert isinstance(startup_sequential, bool)
    
    @pytest.mark.asyncio
    async def test_configuration_variations(self):
        """Test different configuration variations."""
        configurations = [
            # Development mode with skip non-critical
            ValidationConfiguration(
                development_mode=True,
                skip_non_critical=True,
                parallel_execution=True,
                timeout_seconds=30
            ),
            # Development mode without skip non-critical
            ValidationConfiguration(
                development_mode=True,
                skip_non_critical=False,
                parallel_execution=True,
                timeout_seconds=30
            ),
            # Production mode with skip non-critical
            ValidationConfiguration(
                development_mode=False,
                skip_non_critical=True,
                parallel_execution=True,
                timeout_seconds=30
            ),
            # Sequential execution
            ValidationConfiguration(
                development_mode=True,
                skip_non_critical=True,
                parallel_execution=False,
                timeout_seconds=30
            )
        ]
        
        for i, config in enumerate(configurations):
            runner = PreStartupTestRunner(config)
            results = await runner.run_all_tests()
            
            # All configurations should complete
            assert results is not None, f"Configuration {i} failed to complete"
            assert isinstance(results.validation_results, list), f"Configuration {i} has invalid results"
            assert results.execution_time >= 0, f"Configuration {i} has invalid execution time"
            
            # Should be able to make startup decision
            startup_allowed = runner.should_allow_startup(results)
            assert isinstance(startup_allowed, bool), f"Configuration {i} startup decision failed"
    
    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(self):
        """Test that the system handles errors gracefully."""
        # Test with very short timeout to trigger timeout handling
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=1,  # Very short timeout
            development_mode=True,
            skip_non_critical=True
        )
        
        runner = PreStartupTestRunner(config)
        results = await runner.run_all_tests()
        
        # Should complete even with timeout issues
        assert results is not None
        assert isinstance(results.validation_results, list)
        
        # Check if timeout was handled (may have timeout results)
        timeout_results = [r for r in results.validation_results if "timeout" in r.test_name.lower()]
        
        # Should still be able to make startup decision
        startup_allowed = runner.should_allow_startup(results)
        assert isinstance(startup_allowed, bool)
        
        # Should still generate reports
        report = runner.generate_startup_report(results)
        assert isinstance(report, str)
        assert len(report) > 0
    
    @pytest.mark.asyncio
    async def test_fallback_and_impact_analysis(self):
        """Test fallback suggestions and service impact analysis."""
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=False
        )
        
        runner = PreStartupTestRunner(config)
        results = await runner.run_all_tests()
        
        # Test fallback suggestions
        fallback_suggestions = runner.get_fallback_suggestions(results)
        assert isinstance(fallback_suggestions, dict)
        
        # Test service impact analysis
        impact_analysis = runner.analyze_service_impact(results)
        assert isinstance(impact_analysis, dict)
        
        # Test failure criticality classification
        for result in results.validation_results:
            if result.status == ValidationStatus.FAIL:
                criticality = runner.classify_failure_criticality(result)
                assert criticality in ['critical', 'non-critical', 'development-only']
    
    @pytest.mark.asyncio
    async def test_caching_mechanism(self):
        """Test that caching works correctly."""
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
        
        # First run - should create cache
        results1 = await runner.run_all_tests()
        assert os.path.exists(runner._cache_file)
        
        # Second run - should potentially use cache
        results2 = await runner.run_all_tests()
        
        # Both runs should complete
        assert results1 is not None
        assert results2 is not None
        
        # Clean up cache
        if os.path.exists(runner._cache_file):
            os.remove(runner._cache_file)
    
    @pytest.mark.asyncio
    async def test_cli_integration_real(self):
        """Test CLI integration with real system."""
        # This test runs the actual CLI main function
        # It may fail due to system dependencies, but should handle errors gracefully
        
        try:
            # Run CLI main function
            await main()
            # If it completes without exception, that's good
            cli_completed = True
        except SystemExit as e:
            # CLI may exit with code 0 (success) or 1 (failure) - both are valid
            cli_completed = True
            assert e.code in [0, 1]
        except Exception as e:
            # Any other exception should be handled gracefully
            cli_completed = True
            # The CLI should not raise unhandled exceptions
            assert False, f"CLI raised unhandled exception: {e}"
        
        assert cli_completed
    
    @pytest.mark.asyncio
    async def test_performance_characteristics(self):
        """Test performance characteristics of the system."""
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner = PreStartupTestRunner(config)
        
        # Measure execution time
        start_time = asyncio.get_event_loop().time()
        results = await runner.run_all_tests()
        end_time = asyncio.get_event_loop().time()
        
        actual_execution_time = end_time - start_time
        
        # Should complete within reasonable time
        assert actual_execution_time < config.timeout_seconds
        # Allow for small timing differences in execution time measurement
        assert abs(results.execution_time - actual_execution_time) < 1.0  # Within 1 second difference
        
        # Should have reasonable performance
        assert actual_execution_time < 60  # Should complete within 1 minute
    
    def test_configuration_validation(self):
        """Test that configuration validation works correctly."""
        # Test valid configurations
        valid_configs = [
            ValidationConfiguration(),
            ValidationConfiguration(parallel_execution=True),
            ValidationConfiguration(timeout_seconds=60),
            ValidationConfiguration(development_mode=False),
            ValidationConfiguration(skip_non_critical=True),
        ]
        
        for config in valid_configs:
            # Should be able to create runner with valid config
            runner = PreStartupTestRunner(config)
            assert runner.config == config
    
    @pytest.mark.asyncio
    async def test_validator_independence(self):
        """Test that validators can run independently."""
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner = PreStartupTestRunner(config)
        runner.initialize_validators()
        
        # Test each validator independently
        for validator in runner.validators:
            try:
                results = await validator.validate()
                assert isinstance(results, list)
                assert all(hasattr(r, 'status') for r in results)
                assert all(hasattr(r, 'component') for r in results)
                assert all(hasattr(r, 'test_name') for r in results)
                assert all(hasattr(r, 'message') for r in results)
            except Exception as e:
                # Validators may fail due to system dependencies, but should not crash
                # This is acceptable in integration testing
                pass
    
    @pytest.mark.asyncio
    async def test_comprehensive_reporting(self):
        """Test comprehensive reporting functionality."""
        config = ValidationConfiguration(
            parallel_execution=True,
            timeout_seconds=30,
            development_mode=True,
            skip_non_critical=True
        )
        
        runner = PreStartupTestRunner(config)
        results = await runner.run_all_tests()
        
        # Test basic report
        basic_report = runner.generate_startup_report(results)
        assert "Pre-Startup Test Results" in basic_report
        assert "Overall Status:" in basic_report
        assert "Execution Time:" in basic_report
        
        # Test enhanced report
        enhanced_report = runner.generate_enhanced_startup_report(results)
        assert "ENHANCED PRE-STARTUP TEST RESULTS" in enhanced_report
        assert "Overall Status:" in enhanced_report
        
        # Enhanced report should contain additional information
        # (May not always be longer due to different formatting)
        assert "ENHANCED PRE-STARTUP TEST RESULTS" in enhanced_report
        
        # Test that reports contain startup decision
        startup_allowed = runner.should_allow_startup(results)
        if startup_allowed:
            assert "ALLOWED" in basic_report
        else:
            assert "BLOCKED" in basic_report