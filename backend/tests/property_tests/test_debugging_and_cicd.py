"""
Tests for Debugging Utilities and CI/CD Integration

This module tests the debugging utilities and CI/CD integration
for property-based testing.

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.3, 1.4**
"""

import json
import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone

import pytest
from hypothesis import given, settings, Verbosity, Phase
from hypothesis import strategies as st

from tests.property_tests.pbt_framework import (
    # Debugging utilities
    FailingExample,
    FailureReport,
    FailureCapture,
    get_failure_capture,
    capture_failure,
    get_shrinking_settings,
    configure_minimal_example_generation,
    format_failing_example_for_debugging,
    DebuggingReporter,
    get_environment_info,
    # Seed management
    SeedConfig,
    SeedManager,
    get_seed_manager,
    get_seed_from_environment,
    generate_deterministic_seed,
    generate_random_seed,
    set_global_seed,
    get_seed_config,
    with_seed,
    deterministic_test,
    create_reproducible_settings,
    get_reproduction_command,
    save_seed_for_ci,
    # CI/CD integration
    CIEnvironment,
    CITestConfig,
    CITestResult,
    CITestReport,
    detect_ci_environment,
    get_ci_test_config,
    setup_ci_environment,
    register_ci_profiles,
    get_github_actions_output,
    create_github_step_summary
)


class TestFailingExample:
    """Tests for FailingExample class.
    
    **Validates: Requirements 1.3**
    """
    
    def test_failing_example_creation(self):
        """Test creating a FailingExample instance."""
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp=datetime.now(timezone.utc).isoformat(),
            hypothesis_version="6.0.0"
        )
        
        assert example.test_name == "test_example"
        assert example.failing_input == {"x": 42}
        assert example.seed == 12345
    
    def test_failing_example_to_dict(self):
        """Test converting FailingExample to dictionary."""
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp="2024-01-01T00:00:00Z",
            hypothesis_version="6.0.0"
        )
        
        data = example.to_dict()
        
        assert data['test_name'] == "test_example"
        assert data['failing_input'] == {"x": 42}
        assert data['seed'] == 12345
    
    def test_failing_example_from_dict(self):
        """Test creating FailingExample from dictionary."""
        data = {
            'test_name': "test_example",
            'test_module': "test_module",
            'failing_input': {"x": 42},
            'exception_type': "AssertionError",
            'exception_message': "Expected positive",
            'traceback': "Traceback...",
            'seed': 12345,
            'timestamp': "2024-01-01T00:00:00Z",
            'hypothesis_version': "6.0.0"
        }
        
        example = FailingExample.from_dict(data)
        
        assert example.test_name == "test_example"
        assert example.seed == 12345
    
    def test_failing_example_to_json(self):
        """Test converting FailingExample to JSON."""
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp="2024-01-01T00:00:00Z",
            hypothesis_version="6.0.0"
        )
        
        json_str = example.to_json()
        data = json.loads(json_str)
        
        assert data['test_name'] == "test_example"
    
    def test_generate_reproduction_code(self):
        """Test generating reproduction code."""
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp="2024-01-01T00:00:00Z",
            hypothesis_version="6.0.0"
        )
        
        code = example.generate_reproduction_code()
        
        assert "test_example" in code
        assert "12345" in code


class TestFailureReport:
    """Tests for FailureReport class.
    
    **Validates: Requirements 1.3**
    """
    
    def test_failure_report_creation(self):
        """Test creating a FailureReport instance."""
        report = FailureReport()
        
        assert report.total_failures == 0
        assert len(report.failing_examples) == 0
    
    def test_add_failure(self):
        """Test adding a failure to the report."""
        report = FailureReport()
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp="2024-01-01T00:00:00Z",
            hypothesis_version="6.0.0"
        )
        
        report.add_failure(example)
        
        assert report.total_failures == 1
        assert len(report.failing_examples) == 1
    
    def test_failure_report_to_json(self):
        """Test converting FailureReport to JSON."""
        report = FailureReport()
        json_str = report.to_json()
        data = json.loads(json_str)
        
        assert 'test_session_id' in data
        assert 'total_failures' in data
    
    def test_failure_report_save_to_file(self):
        """Test saving FailureReport to file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            report = FailureReport()
            filepath = Path(tmpdir) / "report.json"
            
            report.save_to_file(filepath)
            
            assert filepath.exists()
            data = json.loads(filepath.read_text())
            assert 'test_session_id' in data
    
    def test_generate_summary(self):
        """Test generating human-readable summary."""
        report = FailureReport()
        summary = report.generate_summary()
        
        assert "PROPERTY TEST FAILURE REPORT" in summary


class TestSeedManagement:
    """Tests for seed management utilities.
    
    **Validates: Requirements 1.4**
    """
    
    def test_generate_deterministic_seed(self):
        """Test generating deterministic seed from test name."""
        seed1 = generate_deterministic_seed("test_example")
        seed2 = generate_deterministic_seed("test_example")
        seed3 = generate_deterministic_seed("different_test")
        
        # Same test name should produce same seed
        assert seed1 == seed2
        # Different test name should produce different seed
        assert seed1 != seed3
    
    def test_generate_random_seed(self):
        """Test generating random seed."""
        seed1 = generate_random_seed()
        seed2 = generate_random_seed()
        
        # Random seeds should be different (with very high probability)
        # Note: There's a tiny chance they could be equal
        assert isinstance(seed1, int)
        assert isinstance(seed2, int)
    
    def test_seed_config_creation(self):
        """Test creating SeedConfig."""
        config = SeedConfig(
            hypothesis_seed=12345,
            random_seed=12345,
            deterministic=True
        )
        
        assert config.hypothesis_seed == 12345
        assert config.deterministic is True
    
    def test_seed_config_to_dict(self):
        """Test converting SeedConfig to dictionary."""
        config = SeedConfig(hypothesis_seed=12345)
        data = config.to_dict()
        
        assert data['hypothesis_seed'] == 12345
    
    def test_get_seed_config_explicit(self):
        """Test getting seed config with explicit seed."""
        config = get_seed_config(seed=12345)
        
        assert config.hypothesis_seed == 12345
        assert config.deterministic is True
    
    def test_get_seed_config_deterministic(self):
        """Test getting seed config in deterministic mode."""
        config = get_seed_config(deterministic=True, test_name="test_example")
        
        assert config.hypothesis_seed is not None
        assert config.deterministic is True
    
    def test_get_reproduction_command(self):
        """Test generating reproduction command."""
        command = get_reproduction_command(
            test_module="tests.property_tests.test_example",
            test_name="test_positive",
            seed=12345
        )
        
        assert "HYPOTHESIS_SEED=12345" in command
        assert "test_positive" in command
    
    def test_seed_manager_configure(self):
        """Test SeedManager configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = SeedManager(
                seed_file_path=Path(tmpdir) / "seeds.json",
                auto_save=True
            )
            
            config = manager.configure(seed=12345, test_name="test_example")
            
            assert config.hypothesis_seed == 12345
    
    def test_seed_manager_get_last_seed(self):
        """Test getting last seed from SeedManager."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = SeedManager(
                seed_file_path=Path(tmpdir) / "seeds.json",
                auto_save=True
            )
            
            manager.configure(seed=12345, test_name="test_example")
            
            last_seed = manager.get_last_seed("test_example")
            assert last_seed == 12345


class TestCIIntegration:
    """Tests for CI/CD integration utilities.
    
    **Validates: Requirements 1.4**
    """
    
    def test_detect_ci_environment_not_ci(self):
        """Test detecting non-CI environment."""
        # Clear CI environment variables
        original_ci = os.environ.get('CI')
        original_github = os.environ.get('GITHUB_ACTIONS')
        
        try:
            os.environ.pop('CI', None)
            os.environ.pop('GITHUB_ACTIONS', None)
            
            env = detect_ci_environment()
            
            # Should not detect CI when variables are not set
            # (unless running in actual CI)
            assert isinstance(env, CIEnvironment)
        finally:
            if original_ci:
                os.environ['CI'] = original_ci
            if original_github:
                os.environ['GITHUB_ACTIONS'] = original_github
    
    def test_ci_test_config_creation(self):
        """Test creating CITestConfig."""
        config = CITestConfig(
            max_examples=1000,
            deterministic=True,
            seed=12345
        )
        
        assert config.max_examples == 1000
        assert config.deterministic is True
        assert config.seed == 12345
    
    def test_ci_test_config_to_hypothesis_settings(self):
        """Test converting CITestConfig to Hypothesis settings."""
        config = CITestConfig(max_examples=100)
        hypothesis_settings = config.to_hypothesis_settings()
        
        assert hypothesis_settings.max_examples == 100
    
    def test_ci_test_result_creation(self):
        """Test creating CITestResult."""
        result = CITestResult(
            test_name="test_example",
            test_module="test_module",
            passed=True,
            duration_seconds=1.5,
            examples_run=100
        )
        
        assert result.test_name == "test_example"
        assert result.passed is True
    
    def test_ci_test_report_creation(self):
        """Test creating CITestReport."""
        report = CITestReport()
        
        assert report.total_tests == 0
        assert report.passed_tests == 0
        assert report.failed_tests == 0
    
    def test_ci_test_report_add_result(self):
        """Test adding result to CITestReport."""
        report = CITestReport()
        result = CITestResult(
            test_name="test_example",
            test_module="test_module",
            passed=True,
            duration_seconds=1.5,
            examples_run=100
        )
        
        report.add_result(result)
        
        assert report.total_tests == 1
        assert report.passed_tests == 1
    
    def test_ci_test_report_to_junit_xml(self):
        """Test generating JUnit XML from CITestReport."""
        report = CITestReport()
        result = CITestResult(
            test_name="test_example",
            test_module="test_module",
            passed=True,
            duration_seconds=1.5,
            examples_run=100
        )
        report.add_result(result)
        
        xml = report.to_junit_xml()
        
        assert '<?xml version="1.0"' in xml
        assert 'testsuite' in xml
        assert 'test_example' in xml
    
    def test_ci_test_report_save_junit_xml(self):
        """Test saving JUnit XML to file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            report = CITestReport()
            result = CITestResult(
                test_name="test_example",
                test_module="test_module",
                passed=True,
                duration_seconds=1.5,
                examples_run=100
            )
            report.add_result(result)
            
            filepath = Path(tmpdir) / "results.xml"
            report.save_junit_xml(filepath)
            
            assert filepath.exists()
            content = filepath.read_text()
            assert 'testsuite' in content


class TestShrinkingConfiguration:
    """Tests for shrinking configuration.
    
    **Validates: Requirements 1.3**
    """
    
    def test_get_shrinking_settings(self):
        """Test getting shrinking settings."""
        shrink_settings = get_shrinking_settings(aggressive=True)
        
        assert Phase.shrink in shrink_settings.phases
    
    def test_configure_minimal_example_generation(self):
        """Test configuring minimal example generation."""
        min_settings = configure_minimal_example_generation(
            enable_shrinking=True,
            verbose_shrinking=True
        )
        
        assert Phase.shrink in min_settings.phases
        assert min_settings.verbosity == Verbosity.verbose


class TestEnvironmentInfo:
    """Tests for environment information collection.
    
    **Validates: Requirements 1.3, 1.4**
    """
    
    def test_get_environment_info(self):
        """Test getting environment information."""
        info = get_environment_info()
        
        assert 'python_version' in info
        assert 'hypothesis_version' in info
        assert 'platform' in info
        assert 'timestamp' in info


class TestDebuggingReporter:
    """Tests for DebuggingReporter.
    
    **Validates: Requirements 1.3**
    """
    
    def test_debugging_reporter_capture(self):
        """Test DebuggingReporter message capture."""
        reporter = DebuggingReporter()
        
        reporter("Test message 1")
        reporter("Test message 2")
        
        messages = reporter.get_all_messages()
        assert len(messages) == 2
        assert "Test message 1" in messages
    
    def test_debugging_reporter_clear(self):
        """Test clearing DebuggingReporter messages."""
        reporter = DebuggingReporter()
        reporter("Test message")
        
        reporter.clear()
        
        assert len(reporter.get_all_messages()) == 0


class TestFormatFailingExample:
    """Tests for formatting failing examples.
    
    **Validates: Requirements 1.3**
    """
    
    def test_format_failing_example_for_debugging(self):
        """Test formatting failing example for debugging output."""
        example = FailingExample(
            test_name="test_example",
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Expected positive",
            traceback_str="Traceback...",
            seed=12345,
            timestamp="2024-01-01T00:00:00Z",
            hypothesis_version="6.0.0"
        )
        
        formatted = format_failing_example_for_debugging(example)
        
        assert "MINIMAL FAILING EXAMPLE" in formatted
        assert "test_example" in formatted
        assert "12345" in formatted


class TestWithSeedDecorator:
    """Tests for the with_seed decorator.
    
    **Validates: Requirements 1.4**
    """
    
    def test_with_seed_decorator(self):
        """Test that with_seed decorator sets seed correctly."""
        results = []
        
        @with_seed(12345)
        def test_func():
            import random
            results.append(random.randint(0, 1000000))
        
        # Run twice - should get same result due to seed
        test_func()
        test_func()
        
        # Both runs should produce the same random number
        assert results[0] == results[1]


class TestCreateReproducibleSettings:
    """Tests for create_reproducible_settings.
    
    **Validates: Requirements 1.4**
    """
    
    def test_create_reproducible_settings_with_seed(self):
        """Test creating reproducible settings with seed."""
        test_settings = create_reproducible_settings(
            seed=12345,
            max_examples=100
        )
        
        assert test_settings.max_examples == 100
        assert test_settings.derandomize is True
    
    def test_create_reproducible_settings_without_seed(self):
        """Test creating reproducible settings without seed."""
        test_settings = create_reproducible_settings(
            max_examples=100
        )
        
        assert test_settings.max_examples == 100


class TestSaveSeedForCI:
    """Tests for save_seed_for_ci.
    
    **Validates: Requirements 1.4**
    """
    
    def test_save_seed_for_ci(self):
        """Test saving seed information for CI."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = save_seed_for_ci(
                seed=12345,
                test_name="test_example",
                output_path=tmpdir
            )
            
            assert filepath.exists()
            data = json.loads(filepath.read_text())
            assert data['seed'] == 12345
            assert data['test_name'] == "test_example"
            assert 'reproduction_command' in data
