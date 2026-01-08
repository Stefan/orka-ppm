"""
Property-based tests for workflow integration.

Tests Properties:
- Property 18: Automatic Test Execution
- Property 19: Test Caching Efficiency

**Validates: Requirements 7.1, 7.4**
"""

import pytest
import asyncio
import os
import tempfile
import json
from unittest.mock import Mock, patch, AsyncMock
from hypothesis import given, strategies as st, settings
from fastapi import FastAPI
from contextlib import asynccontextmanager

from .fastapi_integration import FastAPIPreStartupIntegration, integrate_pre_startup_testing
from .cli import PreStartupTestCLI, run_pre_startup_tests_programmatic
from .models import ValidationConfiguration, ValidationResult, ValidationStatus, Severity, TestResults
from .runner import PreStartupTestRunner


class TestWorkflowIntegrationProperties:
    """Property-based tests for workflow integration functionality."""
    
    @given(
        base_urls=st.sampled_from([
            'http://localhost:8000',
            'http://localhost:3000', 
            'https://api.example.com',
            'http://127.0.0.1:8080',
            'https://test.domain.com'
        ]),
        skip_flags=st.booleans(),
        environment_modes=st.sampled_from(['development', 'production', 'testing'])
    )
    @settings(max_examples=100, deadline=30000)
    def test_property_18_automatic_test_execution(self, base_urls, skip_flags, environment_modes):
        """
        Property 18: Automatic Test Execution
        
        For any backend server startup, the test system must execute automatically 
        without requiring separate commands.
        
        **Validates: Requirements 7.1**
        """
        async def run_test():
            # Create a FastAPI app
            app = FastAPI()
            
            # Mock environment variables
            with patch.dict(os.environ, {
                'ENVIRONMENT': environment_modes,
                'SKIP_PRE_STARTUP_TESTS': str(skip_flags).lower(),
                'PRE_STARTUP_TIMEOUT': '10'  # Short timeout for testing
            }):
                # Create integration
                integration = FastAPIPreStartupIntegration(app, base_urls)
                
                # Mock the test runner to avoid actual network calls
                mock_runner = Mock()
                mock_results = TestResults(
                    overall_status=ValidationStatus.PASS,
                    validation_results=[
                        ValidationResult(
                            component="test",
                            test_name="mock_test",
                            status=ValidationStatus.PASS,
                            message="Mock test passed",
                            severity=Severity.LOW
                        )
                    ],
                    execution_time=0.1,
                    timestamp=None
                )
                
                mock_runner.initialize_validators = Mock()
                mock_runner.run_all_tests = AsyncMock(return_value=mock_results)
                mock_runner.should_allow_startup = Mock(return_value=True)
                mock_runner.generate_startup_report = Mock(return_value="Mock report")
                mock_runner.generate_enhanced_startup_report = Mock(return_value="Enhanced mock report")
                
                integration.runner = mock_runner
                
                # Test automatic execution
                startup_allowed = await integration.run_pre_startup_tests()
                
                # Verify automatic execution behavior
                if skip_flags:
                    # When tests are skipped, startup should be allowed without running tests
                    assert startup_allowed is True
                    mock_runner.run_all_tests.assert_not_called()
                else:
                    # When tests are not skipped, they should run automatically
                    mock_runner.initialize_validators.assert_called_once()
                    mock_runner.run_all_tests.assert_called_once()
                    mock_runner.should_allow_startup.assert_called_once_with(mock_results)
                    
                    # Report generation should match environment mode
                    if environment_modes == 'development':
                        mock_runner.generate_enhanced_startup_report.assert_called_once()
                    else:
                        mock_runner.generate_startup_report.assert_called_once()
        
        # Run the async test
        asyncio.run(run_test())
    
    @given(
        config_changes=st.lists(
            st.dictionaries(
                keys=st.sampled_from(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY']),
                values=st.text(min_size=10, max_size=50, alphabet=st.characters(min_codepoint=32, max_codepoint=126)),
                min_size=1,
                max_size=3
            ),
            min_size=2,  # Ensure at least 2 different configs
            max_size=3
        ).filter(lambda configs: len(configs) >= 2 and configs[0] != configs[1]),  # Ensure first two are different
        cache_enabled=st.booleans(),
        test_endpoints=st.lists(
            st.sampled_from(['/health', '/admin/users', '/api/test', '/status', '/metrics']),
            min_size=1,
            max_size=5,
            unique=True
        )
    )
    @settings(max_examples=100, deadline=30000)
    def test_property_19_test_caching_efficiency(self, config_changes, cache_enabled, test_endpoints):
        """
        Property 19: Test Caching Efficiency
        
        For any test execution where configuration hasn't changed, cached results 
        must be used to avoid redundant checks.
        
        **Validates: Requirements 7.4**
        """
        async def run_test():
            with tempfile.TemporaryDirectory() as temp_dir:
                cache_file = os.path.join(temp_dir, "test_cache.json")
                
                # Create configuration
                config = ValidationConfiguration(
                    cache_results=cache_enabled,
                    test_endpoints=test_endpoints,
                    timeout_seconds=10
                )
                
                # Create test runner with custom cache file
                runner = PreStartupTestRunner(config)
                runner._cache_file = cache_file
                
                # Mock validators to avoid actual network calls
                mock_validator = Mock()
                mock_validator.component_name = "MockValidator"
                mock_validator.validate = AsyncMock(return_value=[
                    ValidationResult(
                        component="MockValidator",
                        test_name="mock_test",
                        status=ValidationStatus.PASS,
                        message="Mock test passed",
                        severity=Severity.LOW
                    )
                ])
                runner.validators = [mock_validator]
                
                # First execution - should run tests and cache results
                with patch.dict(os.environ, config_changes[0]):
                    results1 = await runner.run_all_tests()
                    first_execution_calls = mock_validator.validate.call_count
                
                # Second execution with same configuration - should use cache if enabled
                with patch.dict(os.environ, config_changes[0]):
                    results2 = await runner.run_all_tests()
                    second_execution_calls = mock_validator.validate.call_count
                
                # Third execution with different configuration - should run tests again
                with patch.dict(os.environ, config_changes[1]):
                    results3 = await runner.run_all_tests()
                    third_execution_calls = mock_validator.validate.call_count
                
                # Verify caching behavior
                if cache_enabled:
                    # With caching enabled:
                    # - First execution should run tests (1 call)
                    # - Second execution with same config should use cache (still 1 call)
                    # - Third execution with different config should run tests again (2 calls)
                    assert first_execution_calls == 1, "First execution should run tests"
                    assert second_execution_calls == 1, "Second execution should use cache"
                    assert third_execution_calls == 2, "Third execution with different config should run tests"
                    
                    # Cache file should exist
                    assert os.path.exists(cache_file), "Cache file should be created"
                    
                    # Cache file should contain valid JSON
                    with open(cache_file, 'r') as f:
                        cache_data = json.load(f)
                        assert 'config_hash' in cache_data
                        assert 'validation_results' in cache_data
                        assert 'timestamp' in cache_data
                
                else:
                    # With caching disabled:
                    # - Each execution should run tests
                    assert first_execution_calls == 1, "First execution should run tests"
                    assert second_execution_calls == 2, "Second execution should run tests (no cache)"
                    assert third_execution_calls == 3, "Third execution should run tests (no cache)"
                
                # Results should be consistent regardless of caching
                assert results1.overall_status == results2.overall_status
                assert len(results1.validation_results) == len(results2.validation_results)
        
        # Run the async test
        asyncio.run(run_test())
    
    @given(
        cli_args=st.lists(
            st.sampled_from([
                '--critical-only',
                '--skip-tests', 
                '--skip-non-critical',
                '--no-parallel',
                '--no-cache',
                '--json',
                '--quiet',
                '--verbose',
                '--dev-mode'
            ]),
            min_size=0,
            max_size=5,
            unique=True
        ),
        timeout_values=st.integers(min_value=5, max_value=60),
        base_urls=st.sampled_from([
            'http://localhost:8000',
            'http://localhost:3000', 
            'https://api.example.com'
        ])
    )
    @settings(max_examples=100, deadline=30000)
    def test_cli_integration_consistency(self, cli_args, timeout_values, base_urls):
        """
        Test that CLI integration provides consistent behavior across different argument combinations.
        
        This property ensures that the CLI interface works correctly with various combinations
        of arguments and produces consistent results.
        """
        async def run_test():
            # Create CLI instance
            cli = PreStartupTestCLI()
            
            # Create mock arguments
            class MockArgs:
                def __init__(self):
                    self.skip_tests = '--skip-tests' in cli_args
                    self.critical_only = '--critical-only' in cli_args
                    self.skip_non_critical = '--skip-non-critical' in cli_args
                    self.no_parallel = '--no-parallel' in cli_args
                    self.no_cache = '--no-cache' in cli_args
                    self.json = '--json' in cli_args
                    self.quiet = '--quiet' in cli_args
                    self.verbose = '--verbose' in cli_args
                    self.dev_mode = '--dev-mode' in cli_args
                    self.timeout = timeout_values
                    self.base_url = base_urls
                    self.endpoints = None
            
            args = MockArgs()
            
            # Mock the test runner to avoid actual network calls
            with patch('pre_startup_testing.cli.PreStartupTestRunner') as mock_runner_class:
                mock_runner = Mock()
                mock_results = TestResults(
                    overall_status=ValidationStatus.PASS,
                    validation_results=[],
                    execution_time=0.1,
                    timestamp=None
                )
                
                mock_runner.initialize_validators = Mock()
                mock_runner.run_all_tests = AsyncMock(return_value=mock_results)
                mock_runner.run_critical_tests_only = AsyncMock(return_value=mock_results)
                mock_runner.should_allow_startup = Mock(return_value=True)
                mock_runner.generate_startup_report = Mock(return_value="Mock report")
                mock_runner.generate_enhanced_startup_report = Mock(return_value="Enhanced mock report")
                mock_runner.classify_failure_criticality = Mock(return_value="non-critical")
                mock_runner.analyze_service_impact = Mock(return_value={})
                mock_runner.get_fallback_suggestions = Mock(return_value={})
                
                mock_runner_class.return_value = mock_runner
                
                # Run CLI tests
                result = await cli.run_tests(args)
                
                # Verify consistent behavior
                assert isinstance(result, dict), "CLI should return a dictionary result"
                assert 'status' in result, "Result should contain status"
                assert 'exit_code' in result, "Result should contain exit_code"
                
                if args.skip_tests:
                    # When tests are skipped
                    assert result['status'] == 'skipped'
                    assert result['exit_code'] == 0
                    mock_runner.run_all_tests.assert_not_called()
                    mock_runner.run_critical_tests_only.assert_not_called()
                else:
                    # When tests are run
                    assert result['status'] in ['completed', 'error']
                    
                    if args.critical_only:
                        mock_runner.run_critical_tests_only.assert_called_once()
                    else:
                        mock_runner.run_all_tests.assert_called_once()
                    
                    # JSON output should be structured differently
                    if args.json:
                        # JSON output should contain specific fields
                        expected_fields = ['status', 'timestamp', 'execution_time', 'overall_status', 
                                         'startup_allowed', 'exit_code', 'summary', 'test_results']
                        for field in expected_fields:
                            if result['status'] == 'completed':
                                assert field in result, f"JSON output should contain {field}"
        
        # Run the async test
        asyncio.run(run_test())
    
    @given(
        app_configurations=st.lists(
            st.dictionaries(
                keys=st.sampled_from(['title', 'description', 'version']),
                values=st.text(min_size=5, max_size=50),
                min_size=1,
                max_size=3
            ),
            min_size=1,
            max_size=3
        ),
        integration_base_urls=st.sampled_from([
            'http://localhost:8000',
            'http://localhost:3000', 
            'https://api.example.com'
        ])
    )
    @settings(max_examples=100, deadline=30000)
    def test_fastapi_integration_consistency(self, app_configurations, integration_base_urls):
        """
        Test that FastAPI integration provides consistent behavior across different app configurations.
        
        This property ensures that the integration works correctly with various FastAPI app
        configurations and provides consistent pre-startup testing behavior.
        """
        async def run_test():
            for app_config in app_configurations:
                # Create FastAPI app with different configurations
                app = FastAPI(**app_config)
                
                # Test integration
                with patch.dict(os.environ, {'SKIP_PRE_STARTUP_TESTS': 'false'}):
                    integration = integrate_pre_startup_testing(app, integration_base_urls)
                    
                    # Verify integration was successful
                    assert integration is not None, "Integration should return an instance"
                    assert isinstance(integration, FastAPIPreStartupIntegration)
                    assert integration.base_url == integration_base_urls
                    
                    # Verify lifespan handler was set
                    assert hasattr(app.router, 'lifespan_context'), "App should have lifespan context"
                    
                    # Test that the integration doesn't break the app
                    assert app.title == app_config.get('title', 'FastAPI')
                    if 'description' in app_config:
                        assert app.description == app_config['description']
                    if 'version' in app_config:
                        assert app.version == app_config['version']
        
        # Run the async test
        asyncio.run(run_test())


# Additional integration tests for edge cases
class TestWorkflowIntegrationEdgeCases:
    """Test edge cases and error conditions in workflow integration."""
    
    def test_integration_with_missing_dependencies(self):
        """Test that integration handles missing dependencies gracefully."""
        app = FastAPI()
        
        # Mock import error
        with patch('pre_startup_testing.fastapi_integration.PreStartupTestRunner', side_effect=ImportError("Mock import error")):
            # Integration should handle the error gracefully
            try:
                integration = FastAPIPreStartupIntegration(app)
                # Should not raise an exception
                assert integration is not None
            except ImportError:
                pytest.fail("Integration should handle import errors gracefully")
    
    def test_cli_with_invalid_arguments(self):
        """Test CLI behavior with invalid or conflicting arguments."""
        cli = PreStartupTestCLI()
        
        # Test with conflicting arguments
        class ConflictingArgs:
            def __init__(self):
                self.skip_tests = True
                self.critical_only = True  # Conflicting with skip_tests
                self.quiet = True
                self.verbose = True  # Conflicting with quiet
                self.timeout = -1  # Invalid timeout
                self.base_url = "invalid-url"  # Invalid URL
                self.no_parallel = False
                self.no_cache = False
                self.skip_non_critical = False
                self.dev_mode = False
                self.endpoints = None
                self.json = False
        
        async def run_test():
            args = ConflictingArgs()
            result = await cli.run_tests(args)
            
            # Should handle conflicts gracefully
            assert isinstance(result, dict)
            assert 'status' in result
            
            # When skip_tests is True, should skip regardless of other flags
            assert result['status'] == 'skipped'
        
        asyncio.run(run_test())
    
    def test_programmatic_api_consistency(self):
        """Test that programmatic API provides consistent results."""
        async def run_test():
            # Test with different parameter combinations
            test_cases = [
                {'critical_only': True, 'development_mode': True},
                {'critical_only': False, 'development_mode': False},
                {'timeout': 5, 'development_mode': True},
                {'timeout': 60, 'development_mode': False}
            ]
            
            for case in test_cases:
                with patch('pre_startup_testing.cli.PreStartupTestRunner') as mock_runner_class:
                    mock_runner = Mock()
                    mock_results = TestResults(
                        overall_status=ValidationStatus.PASS,
                        validation_results=[],
                        execution_time=0.1,
                        timestamp=None
                    )
                    
                    mock_runner.initialize_validators = Mock()
                    mock_runner.run_all_tests = AsyncMock(return_value=mock_results)
                    mock_runner.run_critical_tests_only = AsyncMock(return_value=mock_results)
                    mock_runner_class.return_value = mock_runner
                    
                    result = await run_pre_startup_tests_programmatic(**case)
                    
                    # Verify consistent structure
                    assert isinstance(result, dict)
                    assert 'status' in result
                    assert 'startup_allowed' in result
                    assert 'exit_code' in result
        
        asyncio.run(run_test())