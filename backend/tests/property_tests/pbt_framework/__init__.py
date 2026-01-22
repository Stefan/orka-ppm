"""
Property-Based Testing Framework for PPM Backend

This module provides comprehensive property-based testing infrastructure
using pytest and Hypothesis for the PPM SaaS platform.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**
"""

from .backend_pbt_framework import BackendPBTFramework
from .domain_generators import DomainGenerators
from .test_config import PBTTestConfig, get_test_settings, register_hypothesis_profiles

# Debugging utilities (Requirement 1.3)
from .debugging_utils import (
    FailingExample,
    FailureReport,
    FailureCapture,
    get_failure_capture,
    capture_failure,
    get_shrinking_settings,
    configure_minimal_example_generation,
    format_failing_example_for_debugging,
    DebuggingReporter,
    get_environment_info
)

# Seed management (Requirement 1.4)
from .seed_management import (
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
    save_seed_for_ci
)

# CI/CD integration (Requirements 1.3, 1.4)
from .ci_integration import (
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

__all__ = [
    # Core framework
    'BackendPBTFramework',
    'DomainGenerators',
    'PBTTestConfig',
    'get_test_settings',
    'register_hypothesis_profiles',
    
    # Debugging utilities
    'FailingExample',
    'FailureReport',
    'FailureCapture',
    'get_failure_capture',
    'capture_failure',
    'get_shrinking_settings',
    'configure_minimal_example_generation',
    'format_failing_example_for_debugging',
    'DebuggingReporter',
    'get_environment_info',
    
    # Seed management
    'SeedConfig',
    'SeedManager',
    'get_seed_manager',
    'get_seed_from_environment',
    'generate_deterministic_seed',
    'generate_random_seed',
    'set_global_seed',
    'get_seed_config',
    'with_seed',
    'deterministic_test',
    'create_reproducible_settings',
    'get_reproduction_command',
    'save_seed_for_ci',
    
    # CI/CD integration
    'CIEnvironment',
    'CITestConfig',
    'CITestResult',
    'CITestReport',
    'detect_ci_environment',
    'get_ci_test_config',
    'setup_ci_environment',
    'register_ci_profiles',
    'get_github_actions_output',
    'create_github_step_summary'
]
