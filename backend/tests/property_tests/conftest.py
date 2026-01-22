"""
Configuration for property-based tests

This module provides pytest fixtures and Hypothesis configuration for
property-based testing in the PPM backend.

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**
"""

import pytest
from hypothesis import settings, Verbosity
import os
import logging

# Import the PBT framework
from tests.property_tests.pbt_framework import (
    BackendPBTFramework,
    DomainGenerators,
    PBTTestConfig,
    get_test_settings,
    # Debugging utilities (Requirement 1.3)
    FailureCapture,
    get_failure_capture,
    get_shrinking_settings,
    configure_minimal_example_generation,
    # Seed management (Requirement 1.4)
    SeedManager,
    get_seed_manager,
    get_seed_from_environment,
    set_global_seed,
    get_seed_config,
    # CI/CD integration
    detect_ci_environment,
    setup_ci_environment,
    CITestReport
)
from tests.property_tests.pbt_framework.test_config import register_hypothesis_profiles

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Register Hypothesis profiles
register_hypothesis_profiles()


@pytest.fixture(scope="session")
def property_test_config():
    """
    Configuration for property-based tests.
    
    Returns configuration based on environment:
    - CI environment: Uses 'ci' profile with 1000 iterations
    - Development: Uses 'default' profile with 100 iterations
    
    **Validates: Requirements 1.2, 1.4**
    """
    profile = os.getenv('HYPOTHESIS_PROFILE', 'default')
    config = get_test_settings(profile)
    
    # Apply seed from environment if available
    env_seed = get_seed_from_environment()
    if env_seed is not None:
        config = config.with_seed(env_seed)
        logger.info(f"Using seed from environment: {env_seed}")
    
    return config


@pytest.fixture(scope="session")
def pbt_framework(property_test_config):
    """
    Provide a configured BackendPBTFramework instance.
    
    **Validates: Requirements 1.1, 1.2**
    """
    return BackendPBTFramework(config=property_test_config)


@pytest.fixture(scope="session")
def domain_generators():
    """
    Provide access to domain generators.
    
    **Validates: Requirements 1.5**
    """
    return DomainGenerators()


@pytest.fixture(scope="session")
def seed_manager():
    """
    Provide access to the seed manager for deterministic testing.
    
    **Validates: Requirements 1.4**
    """
    return get_seed_manager()


@pytest.fixture(scope="session")
def failure_capture():
    """
    Provide access to failure capture for debugging.
    
    **Validates: Requirements 1.3**
    """
    return get_failure_capture()


@pytest.fixture(scope="session")
def ci_environment():
    """
    Provide CI environment information.
    
    **Validates: Requirements 1.4**
    """
    return detect_ci_environment()


@pytest.fixture(scope="session")
def ci_test_report(ci_environment):
    """
    Provide a CI test report instance for collecting results.
    
    **Validates: Requirements 1.3, 1.4**
    """
    return CITestReport(ci_environment=ci_environment)


@pytest.fixture
def mock_database():
    """Mock database for testing"""
    return {}


@pytest.fixture
def mock_audit_logger():
    """Mock audit logger for testing"""
    class MockAuditLogger:
        def __init__(self):
            self.logs = []
        
        def log_event(self, event_type, entity_id, details):
            import datetime
            self.logs.append({
                'event_type': event_type,
                'entity_id': entity_id,
                'details': details,
                'timestamp': datetime.datetime.now()
            })
    
    return MockAuditLogger()


@pytest.fixture
def debugging_settings():
    """
    Provide Hypothesis settings optimized for debugging.
    
    **Validates: Requirements 1.3**
    """
    return get_shrinking_settings(aggressive=True)


@pytest.fixture
def minimal_example_settings():
    """
    Provide Hypothesis settings for minimal example generation.
    
    **Validates: Requirements 1.3**
    """
    return configure_minimal_example_generation(
        enable_shrinking=True,
        verbose_shrinking=True,
        save_examples=True
    )


def pytest_configure(config):
    """
    Configure pytest for property-based testing.
    
    **Validates: Requirements 1.4**
    """
    # Setup CI environment if detected
    ci_env = detect_ci_environment()
    if ci_env.is_ci:
        logger.info(f"Running in CI environment: {ci_env.ci_provider}")
        setup_ci_environment()
    
    # Set global seed if provided
    env_seed = get_seed_from_environment()
    if env_seed is not None:
        set_global_seed(env_seed)
        logger.info(f"Global seed set to: {env_seed}")


def pytest_report_header(config):
    """
    Add property-based testing info to pytest header.
    
    **Validates: Requirements 1.4**
    """
    lines = ["Property-Based Testing Configuration:"]
    
    profile = os.getenv('HYPOTHESIS_PROFILE', 'default')
    lines.append(f"  Profile: {profile}")
    
    seed = get_seed_from_environment()
    if seed is not None:
        lines.append(f"  Seed: {seed}")
    
    ci_env = detect_ci_environment()
    if ci_env.is_ci:
        lines.append(f"  CI Provider: {ci_env.ci_provider}")
    
    return lines