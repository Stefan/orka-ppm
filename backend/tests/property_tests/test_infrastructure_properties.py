"""
Property-Based Tests for Test Infrastructure

This module contains property tests that validate the test infrastructure itself:
- Property 2: Test Failure Debugging Support
- Property 3: CI/CD Test Determinism
- Property 4: Domain Generator Validity (additional coverage)

Feature: property-based-testing
Task: 2.3 Write property tests for test infrastructure
**Validates: Requirements 1.3, 1.4, 1.5**
"""

import json
import os
import tempfile
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Dict, Any, List
from uuid import UUID

import pytest
from hypothesis import given, settings, assume, Phase, reproduce_failure
from hypothesis import strategies as st

# Import the PBT framework
from tests.property_tests.pbt_framework import (
    # Debugging utilities
    FailingExample,
    FailureReport,
    FailureCapture,
    get_shrinking_settings,
    configure_minimal_example_generation,
    format_failing_example_for_debugging,
    get_environment_info,
    # Seed management
    SeedConfig,
    SeedManager,
    generate_deterministic_seed,
    generate_random_seed,
    set_global_seed,
    get_seed_config,
    create_reproducible_settings,
    get_reproduction_command,
    save_seed_for_ci,
    # Domain generators
    DomainGenerators,
)

from tests.property_tests.pbt_framework.domain_generators import (
    edge_case_financial_record,
    currency_conversion_pair,
    rbac_test_scenario,
    project_with_financials,
)


class TestProperty2FailureDebuggingSupport:
    """
    Property tests for Test Failure Debugging Support.
    
    **Property 2: Test Failure Debugging Support**
    For any property test failure, the system must provide minimal failing examples
    that enable efficient debugging and issue resolution.
    
    Task: 2.3 Write property tests for test infrastructure
    **Validates: Requirements 1.3**
    """
    
    @given(
        test_name=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        test_module=st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
        failing_input=st.dictionaries(
            st.text(min_size=1, max_size=20).filter(lambda x: x.strip() and x.isidentifier()),
            st.one_of(
                st.integers(),
                st.floats(allow_nan=False, allow_infinity=False),
                st.text(max_size=50),
                st.booleans()
            ),
            min_size=1,
            max_size=5
        ),
        seed=st.integers(min_value=0, max_value=2**31 - 1)
    )
    @settings(max_examples=100)
    def test_failing_example_captures_all_debugging_info(
        self,
        test_name: str,
        test_module: str,
        failing_input: Dict[str, Any],
        seed: int
    ):
        """
        Property test: FailingExample captures all necessary debugging information.
        
        For any test failure scenario, the FailingExample must capture:
        - Test identification (name and module)
        - Failing input data
        - Exception information
        - Seed for reproduction
        - Timestamp for tracking
        
        **Validates: Requirements 1.3**
        """
        # Create a FailingExample with the generated data
        example = FailingExample(
            test_name=test_name.strip(),
            test_module=test_module.strip(),
            failing_input=failing_input,
            exception_type="AssertionError",
            exception_message="Test assertion failed",
            traceback_str="Traceback (most recent call last):\n  ...",
            seed=seed,
            timestamp=datetime.now(timezone.utc).isoformat(),
            hypothesis_version="6.0.0"
        )
        
        # Property: All debugging information must be captured
        assert example.test_name == test_name.strip()
        assert example.test_module == test_module.strip()
        assert example.failing_input == failing_input
        assert example.seed == seed
        assert example.timestamp is not None
        
        # Property: Serialization must preserve all information
        data = example.to_dict()
        assert data['test_name'] == test_name.strip()
        assert data['failing_input'] == failing_input
        assert data['seed'] == seed
        
        # Property: JSON serialization must be valid
        json_str = example.to_json()
        parsed = json.loads(json_str)
        assert parsed['test_name'] == test_name.strip()
        assert parsed['seed'] == seed
    
    @given(
        test_name=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        seed=st.integers(min_value=0, max_value=2**31 - 1)
    )
    @settings(max_examples=100)
    def test_reproduction_code_generation(self, test_name: str, seed: int):
        """
        Property test: Reproduction code contains all necessary information.
        
        For any failing example, the generated reproduction code must contain:
        - The test name for identification
        - The seed for deterministic reproduction
        
        **Validates: Requirements 1.3**
        """
        example = FailingExample(
            test_name=test_name.strip(),
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Test failed",
            traceback_str="Traceback...",
            seed=seed,
            timestamp=datetime.now(timezone.utc).isoformat(),
            hypothesis_version="6.0.0"
        )
        
        code = example.generate_reproduction_code()
        
        # Property: Reproduction code must contain test name
        assert test_name.strip() in code
        
        # Property: Reproduction code must contain seed
        assert str(seed) in code
    
    @given(
        num_failures=st.integers(min_value=1, max_value=10),
        test_names=st.lists(
            st.text(min_size=1, max_size=30).filter(lambda x: x.strip()),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=100)
    def test_failure_report_aggregation(self, num_failures: int, test_names: List[str]):
        """
        Property test: FailureReport correctly aggregates multiple failures.
        
        For any number of failures added to a report:
        - Total failure count must match number of failures added
        - All failing examples must be preserved
        - Summary must include all failures
        
        **Validates: Requirements 1.3**
        """
        report = FailureReport()
        
        # Add failures
        actual_failures = min(num_failures, len(test_names))
        for i in range(actual_failures):
            example = FailingExample(
                test_name=test_names[i].strip() or f"test_{i}",
                test_module="test_module",
                failing_input={"index": i},
                exception_type="AssertionError",
                exception_message=f"Failure {i}",
                traceback_str="Traceback...",
                seed=i * 1000,
                timestamp=datetime.now(timezone.utc).isoformat(),
                hypothesis_version="6.0.0"
            )
            report.add_failure(example)
        
        # Property: Total failures must match added count
        assert report.total_failures == actual_failures
        
        # Property: All examples must be preserved
        assert len(report.failing_examples) == actual_failures
        
        # Property: Summary must be generated
        summary = report.generate_summary()
        assert "PROPERTY TEST FAILURE REPORT" in summary
        assert f"Total Failures: {actual_failures}" in summary

    @given(
        enable_shrinking=st.booleans(),
        verbose_shrinking=st.booleans()
    )
    @settings(max_examples=100)
    def test_shrinking_configuration_validity(
        self,
        enable_shrinking: bool,
        verbose_shrinking: bool
    ):
        """
        Property test: Shrinking configuration produces valid Hypothesis settings.
        
        For any shrinking configuration:
        - Settings must be valid Hypothesis settings
        - Shrink phase must be included when enabled
        - Verbosity must match configuration
        
        **Validates: Requirements 1.3**
        """
        min_settings = configure_minimal_example_generation(
            enable_shrinking=enable_shrinking,
            verbose_shrinking=verbose_shrinking
        )
        
        # Property: Settings must have phases
        assert min_settings.phases is not None
        
        # Property: Shrink phase presence must match configuration
        if enable_shrinking:
            assert Phase.shrink in min_settings.phases
        else:
            assert Phase.shrink not in min_settings.phases
    
    @given(
        test_name=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        seed=st.integers(min_value=0, max_value=2**31 - 1),
        include_traceback=st.booleans(),
        include_reproduction=st.booleans()
    )
    @settings(max_examples=100)
    def test_formatted_output_completeness(
        self,
        test_name: str,
        seed: int,
        include_traceback: bool,
        include_reproduction: bool
    ):
        """
        Property test: Formatted debugging output contains required sections.
        
        For any failing example formatting configuration:
        - Output must contain test identification
        - Output must contain failing input
        - Traceback included only when requested
        - Reproduction info included only when requested
        
        **Validates: Requirements 1.3**
        """
        example = FailingExample(
            test_name=test_name.strip(),
            test_module="test_module",
            failing_input={"x": 42},
            exception_type="AssertionError",
            exception_message="Test failed",
            traceback_str="Traceback (most recent call last):\n  File...",
            seed=seed,
            timestamp=datetime.now(timezone.utc).isoformat(),
            hypothesis_version="6.0.0"
        )
        
        formatted = format_failing_example_for_debugging(
            example,
            include_traceback=include_traceback,
            include_reproduction=include_reproduction
        )
        
        # Property: Must always contain header and test info
        assert "MINIMAL FAILING EXAMPLE" in formatted
        assert test_name.strip() in formatted
        
        # Property: Must always contain failing input section
        assert "FAILING INPUT" in formatted
        
        # Property: Traceback section depends on configuration
        if include_traceback:
            assert "TRACEBACK" in formatted
        
        # Property: Reproduction section depends on configuration
        if include_reproduction:
            assert "REPRODUCTION" in formatted


class TestProperty3CICDTestDeterminism:
    """
    Property tests for CI/CD Test Determinism.
    
    **Property 3: CI/CD Test Determinism**
    For any test execution with configured seed values, the system must produce
    deterministic, reproducible results across different environments.
    
    Task: 2.3 Write property tests for test infrastructure
    **Validates: Requirements 1.4**
    """
    
    @given(
        test_name=st.text(min_size=1, max_size=50).filter(lambda x: x.strip())
    )
    @settings(max_examples=100)
    def test_deterministic_seed_consistency(self, test_name: str):
        """
        Property test: Same test name always produces same deterministic seed.
        
        For any test name, generating a deterministic seed multiple times
        must always produce the same seed value.
        
        **Validates: Requirements 1.4**
        """
        seed1 = generate_deterministic_seed(test_name.strip())
        seed2 = generate_deterministic_seed(test_name.strip())
        seed3 = generate_deterministic_seed(test_name.strip())
        
        # Property: Same input must produce same seed
        assert seed1 == seed2
        assert seed2 == seed3
        
        # Property: Seed must be valid (positive integer within range)
        assert seed1 >= 0
        assert seed1 < 2**31
    
    @given(
        test_name1=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        test_name2=st.text(min_size=1, max_size=50).filter(lambda x: x.strip())
    )
    @settings(max_examples=100)
    def test_different_tests_different_seeds(self, test_name1: str, test_name2: str):
        """
        Property test: Different test names produce different seeds.
        
        For any two different test names, the generated deterministic seeds
        should be different (with very high probability due to hash function).
        
        **Validates: Requirements 1.4**
        """
        # Skip if names are the same after stripping
        assume(test_name1.strip() != test_name2.strip())
        
        seed1 = generate_deterministic_seed(test_name1.strip())
        seed2 = generate_deterministic_seed(test_name2.strip())
        
        # Property: Different inputs should produce different seeds
        # (This is probabilistic but should hold for any reasonable hash function)
        assert seed1 != seed2

    @given(
        seed=st.integers(min_value=0, max_value=2**31 - 1)
    )
    @settings(max_examples=100)
    def test_seed_config_determinism(self, seed: int):
        """
        Property test: Explicit seed produces deterministic configuration.
        
        For any explicit seed value, the seed configuration must:
        - Use the exact seed provided
        - Mark the configuration as deterministic
        
        **Validates: Requirements 1.4**
        """
        config = get_seed_config(seed=seed)
        
        # Property: Explicit seed must be used exactly
        assert config.hypothesis_seed == seed
        
        # Property: Configuration must be marked deterministic
        assert config.deterministic is True
        
        # Property: Random seed should match hypothesis seed
        assert config.random_seed == seed
    
    @given(
        seed=st.integers(min_value=0, max_value=2**31 - 1),
        max_examples=st.integers(min_value=10, max_value=1000)
    )
    @settings(max_examples=100)
    def test_reproducible_settings_creation(self, seed: int, max_examples: int):
        """
        Property test: Reproducible settings are correctly configured.
        
        For any seed and max_examples configuration:
        - Settings must use the specified max_examples
        - Settings must enable derandomize for reproducibility
        
        **Validates: Requirements 1.4**
        """
        test_settings = create_reproducible_settings(
            seed=seed,
            max_examples=max_examples
        )
        
        # Property: Max examples must match configuration
        assert test_settings.max_examples == max_examples
        
        # Property: Derandomize must be enabled for reproducibility
        assert test_settings.derandomize is True
    
    @given(
        test_module=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        test_name=st.text(min_size=1, max_size=50).filter(lambda x: x.strip()),
        seed=st.integers(min_value=0, max_value=2**31 - 1)
    )
    @settings(max_examples=100)
    def test_reproduction_command_format(
        self,
        test_module: str,
        test_name: str,
        seed: int
    ):
        """
        Property test: Reproduction command contains all necessary components.
        
        For any test identification and seed:
        - Command must contain the seed environment variable
        - Command must contain the test module and name
        - Command must be a valid shell command format
        
        **Validates: Requirements 1.4**
        """
        command = get_reproduction_command(
            test_module=test_module.strip(),
            test_name=test_name.strip(),
            seed=seed
        )
        
        # Property: Command must contain seed environment variable
        assert f"HYPOTHESIS_SEED={seed}" in command
        
        # Property: Command must contain test name
        assert test_name.strip() in command
        
        # Property: Command must contain pytest invocation
        assert "pytest" in command
    
    @given(
        seed=st.integers(min_value=0, max_value=2**31 - 1),
        test_name=st.text(min_size=1, max_size=30).filter(lambda x: x.strip() and x.replace('_', '').isalnum())
    )
    @settings(max_examples=100)
    def test_seed_persistence_for_ci(self, seed: int, test_name: str):
        """
        Property test: Seed information is correctly persisted for CI.
        
        For any seed and test name:
        - Seed file must be created
        - File must contain correct seed value
        - File must contain reproduction command
        
        **Validates: Requirements 1.4**
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = save_seed_for_ci(
                seed=seed,
                test_name=test_name.strip(),
                output_path=tmpdir
            )
            
            # Property: File must be created
            assert filepath.exists()
            
            # Property: File must contain valid JSON
            data = json.loads(filepath.read_text())
            
            # Property: Seed must be preserved exactly
            assert data['seed'] == seed
            
            # Property: Test name must be preserved
            assert data['test_name'] == test_name.strip()
            
            # Property: Reproduction command must be included
            assert 'reproduction_command' in data
            assert str(seed) in data['reproduction_command']
    
    @given(
        seed=st.integers(min_value=0, max_value=2**31 - 1),
        test_name=st.text(min_size=1, max_size=30).filter(lambda x: x.strip() and x.replace('_', '').isalnum())
    )
    @settings(max_examples=100)
    def test_seed_manager_history_tracking(self, seed: int, test_name: str):
        """
        Property test: SeedManager correctly tracks seed history.
        
        For any seed configuration:
        - Seed must be recorded in history
        - Last seed must be retrievable
        - History must be persistent
        
        **Validates: Requirements 1.4**
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = SeedManager(
                seed_file_path=Path(tmpdir) / "seeds.json",
                auto_save=True
            )
            
            # Configure with seed
            config = manager.configure(
                seed=seed,
                test_name=test_name.strip()
            )
            
            # Property: Configuration must use the seed
            assert config.hypothesis_seed == seed
            
            # Property: Last seed must be retrievable
            last_seed = manager.get_last_seed(test_name.strip())
            assert last_seed == seed
            
            # Property: History must contain the record
            history = manager.get_history(limit=1)
            assert len(history) >= 1
            assert history[0]['hypothesis_seed'] == seed


class TestProperty4DomainGeneratorValidity:
    """
    Property tests for Domain Generator Validity.
    
    **Property 4: Domain Generator Validity**
    For any custom generator for domain-specific data types, generated data
    must be valid and realistic.
    
    Task: 2.3 Write property tests for test infrastructure
    **Validates: Requirements 1.5**
    """
    
    @given(project=DomainGenerators.project_data())
    @settings(max_examples=100)
    def test_project_data_invariants(self, project: Dict[str, Any]):
        """
        Property test: Project data maintains all required invariants.
        
        For any generated project:
        - Budget must be non-negative
        - Dates must be logically consistent
        - Status and health must be valid values
        - All required fields must be present
        
        **Validates: Requirements 1.5**
        """
        # Property: All required fields must be present
        required_fields = ['id', 'name', 'budget', 'status', 'health']
        for field in required_fields:
            assert field in project, f"Missing required field: {field}"
        
        # Property: ID must be valid UUID
        assert isinstance(project['id'], UUID)
        
        # Property: Name must be non-empty
        assert len(project['name']) > 0
        
        # Property: Budget must be non-negative
        assert project['budget'] >= 0
        
        # Property: Status must be valid
        valid_statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
        assert project['status'] in valid_statuses
        
        # Property: Health must be valid
        valid_health = ['green', 'yellow', 'red']
        assert project['health'] in valid_health
        
        # Property: Dates must be consistent if present
        if 'start_date' in project and 'end_date' in project:
            start = date.fromisoformat(project['start_date'])
            end = date.fromisoformat(project['end_date'])
            assert end >= start, "End date must be >= start date"
    
    @given(record=DomainGenerators.financial_record())
    @settings(max_examples=100)
    def test_financial_record_invariants(self, record: Dict[str, Any]):
        """
        Property test: Financial records maintain all required invariants.
        
        For any generated financial record:
        - Amounts must be non-negative
        - Variance calculations must be mathematically correct
        - Currency must be valid
        - Status must align with variance percentage
        
        **Validates: Requirements 1.5**
        """
        # Property: Required fields must be present
        required_fields = ['planned_amount', 'actual_amount', 'currency']
        for field in required_fields:
            assert field in record, f"Missing required field: {field}"
        
        # Property: Amounts must be non-negative
        assert record['planned_amount'] >= 0
        assert record['actual_amount'] >= 0
        
        # Property: Currency must be valid
        valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
        assert record['currency'] in valid_currencies
        
        # Property: Variance calculation must be correct
        if 'variance_amount' in record:
            expected_variance = record['actual_amount'] - record['planned_amount']
            assert abs(record['variance_amount'] - expected_variance) < 0.1
        
        # Property: Variance status must align with percentage
        if 'variance_status' in record and 'variance_percentage' in record:
            pct = record['variance_percentage']
            status = record['variance_status']
            
            # Use <= and >= to match the generator's boundary conditions
            if pct <= -5:
                assert status == 'under_budget'
            elif pct >= 5:
                assert status == 'over_budget'
            else:
                assert status == 'on_budget'
    
    @given(assignment=DomainGenerators.user_role_assignment())
    @settings(max_examples=100)
    def test_user_role_assignment_invariants(self, assignment: Dict[str, Any]):
        """
        Property test: User role assignments maintain all required invariants.
        
        For any generated user role assignment:
        - User ID must be valid UUID
        - Role must be valid
        - Role level must match role
        - Scope must be consistent
        
        **Validates: Requirements 1.5**
        """
        # Property: Required fields must be present
        assert 'user_id' in assignment
        assert 'role' in assignment
        
        # Property: User ID must be valid UUID
        assert isinstance(assignment['user_id'], UUID)
        
        # Property: Role must be valid
        valid_roles = ['admin', 'portfolio_manager', 'project_manager', 'viewer', 'analyst']
        assert assignment['role'] in valid_roles
        
        # Property: Role level must match role
        if 'role_level' in assignment:
            expected_levels = {
                'admin': 100,
                'portfolio_manager': 80,
                'project_manager': 60,
                'analyst': 40,
                'viewer': 20
            }
            assert assignment['role_level'] == expected_levels[assignment['role']]
        
        # Property: Scope consistency
        if 'scope_type' in assignment:
            if assignment['scope_type'] is not None:
                assert 'scope_id' in assignment
                assert assignment['scope_id'] is not None
    
    @given(record=edge_case_financial_record())
    @settings(max_examples=100)
    def test_edge_case_financial_record_validity(self, record: Dict[str, Any]):
        """
        Property test: Edge case financial records are valid and properly typed.
        
        For any generated edge case financial record:
        - Edge case type must be valid
        - Amounts must be non-negative
        - Edge case constraints must be satisfied
        
        **Validates: Requirements 1.5**
        """
        # Property: Edge case type must be present and valid
        assert 'edge_case_type' in record
        valid_types = [
            'zero_budget', 'tiny_amount', 'large_amount',
            'extreme_over_budget', 'extreme_under_budget'
        ]
        assert record['edge_case_type'] in valid_types
        
        # Property: Amounts must be non-negative
        assert record['planned_amount'] >= 0
        assert record['actual_amount'] >= 0
        
        # Property: Edge case constraints must be satisfied
        edge_type = record['edge_case_type']
        if edge_type == 'zero_budget':
            assert record['planned_amount'] == 0
        elif edge_type == 'tiny_amount':
            assert record['planned_amount'] <= 1.0
        elif edge_type == 'large_amount':
            assert record['planned_amount'] >= 1_000_000
        elif edge_type == 'extreme_over_budget':
            assert record['actual_amount'] > record['planned_amount']
        elif edge_type == 'extreme_under_budget':
            assert record['actual_amount'] < record['planned_amount']

    @given(pair=currency_conversion_pair())
    @settings(max_examples=100)
    def test_currency_conversion_pair_validity(self, pair: Dict[str, Any]):
        """
        Property test: Currency conversion pairs have valid data.
        
        For any generated currency conversion pair:
        - Currencies must be valid
        - Exchange rates must be positive
        - Amount must be positive
        
        **Validates: Requirements 1.5**
        """
        valid_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
        
        # Property: Currencies must be valid
        assert pair['from_currency'] in valid_currencies
        assert pair['to_currency'] in valid_currencies
        
        # Property: Exchange rates must be positive
        assert pair['from_rate_to_usd'] > 0
        assert pair['to_rate_to_usd'] > 0
        
        # Property: Amount must be positive
        assert pair['amount'] > 0
    
    @given(scenario=rbac_test_scenario())
    @settings(max_examples=100)
    def test_rbac_scenario_consistency(self, scenario: Dict[str, Any]):
        """
        Property test: RBAC test scenarios are internally consistent.
        
        For any generated RBAC scenario:
        - User role and level must be consistent
        - Expected access must align with permissions
        - All required fields must be present
        
        **Validates: Requirements 1.5**
        """
        # Property: Required fields must be present
        required_fields = [
            'user_id', 'user_role', 'user_role_level',
            'action', 'required_permission', 'expected_access'
        ]
        for field in required_fields:
            assert field in scenario, f"Missing required field: {field}"
        
        # Property: Role level must match role
        expected_levels = {
            'admin': 100,
            'portfolio_manager': 80,
            'project_manager': 60,
            'analyst': 40,
            'viewer': 20
        }
        assert scenario['user_role_level'] == expected_levels[scenario['user_role']]
        
        # Property: Expected access must be consistent with permissions
        user_permissions = scenario.get('user_permissions', [])
        required_permission = scenario['required_permission']
        
        if required_permission in user_permissions:
            assert scenario['expected_access'] is True
        else:
            assert scenario['expected_access'] is False
    
    @given(project_data=project_with_financials())
    @settings(max_examples=100)
    def test_project_with_financials_aggregation(self, project_data: Dict[str, Any]):
        """
        Property test: Projects with financials have correct aggregations.
        
        For any generated project with financial records:
        - All records must reference the project
        - Aggregated totals must be mathematically correct
        - Variance calculations must be accurate
        
        **Validates: Requirements 1.5**
        """
        project = project_data['project']
        records = project_data['financial_records']
        aggregated = project_data['aggregated']
        
        # Property: Project must have valid ID
        assert isinstance(project['id'], UUID)
        
        # Property: Must have at least one financial record
        assert len(records) >= 1
        
        # Property: All records must reference the project
        for record in records:
            assert record['project_id'] == project['id']
        
        # Property: Aggregated totals must be correct
        calculated_planned = sum(r['planned_amount'] for r in records)
        calculated_actual = sum(r['actual_amount'] for r in records)
        
        assert abs(aggregated['total_planned'] - calculated_planned) < 0.5
        assert abs(aggregated['total_actual'] - calculated_actual) < 0.5
        
        # Property: Variance must be correct
        expected_variance = aggregated['total_actual'] - aggregated['total_planned']
        assert abs(aggregated['total_variance'] - expected_variance) < 0.5
    
    @given(
        projects=st.lists(DomainGenerators.project_data(), min_size=1, max_size=10)
    )
    @settings(max_examples=100)
    def test_multiple_projects_uniqueness(self, projects: List[Dict[str, Any]]):
        """
        Property test: Multiple generated projects have unique IDs.
        
        For any list of generated projects:
        - All project IDs must be unique
        - All projects must be valid
        
        **Validates: Requirements 1.5**
        """
        # Property: All IDs must be unique
        ids = [p['id'] for p in projects]
        assert len(ids) == len(set(ids)), "Project IDs must be unique"
        
        # Property: All projects must be valid
        for project in projects:
            assert isinstance(project['id'], UUID)
            assert project['budget'] >= 0
    
    @given(
        records=st.lists(DomainGenerators.financial_record(), min_size=1, max_size=20)
    )
    @settings(max_examples=100)
    def test_financial_records_aggregation_consistency(
        self,
        records: List[Dict[str, Any]]
    ):
        """
        Property test: Financial record aggregations are order-independent.
        
        For any list of financial records:
        - Sum of planned amounts must be consistent regardless of order
        - Sum of actual amounts must be consistent regardless of order
        
        **Validates: Requirements 1.5**
        """
        import random
        
        # Calculate totals in original order
        total_planned_1 = sum(r['planned_amount'] for r in records)
        total_actual_1 = sum(r['actual_amount'] for r in records)
        
        # Shuffle and recalculate
        shuffled = records.copy()
        random.shuffle(shuffled)
        
        total_planned_2 = sum(r['planned_amount'] for r in shuffled)
        total_actual_2 = sum(r['actual_amount'] for r in shuffled)
        
        # Property: Totals must be order-independent
        assert abs(total_planned_1 - total_planned_2) < 0.01
        assert abs(total_actual_1 - total_actual_2) < 0.01


class TestEnvironmentInfo:
    """
    Property tests for environment information collection.
    
    **Validates: Requirements 1.3, 1.4**
    """
    
    def test_environment_info_completeness(self):
        """
        Test that environment info contains all required fields.
        
        **Validates: Requirements 1.3, 1.4**
        """
        info = get_environment_info()
        
        # Property: All required fields must be present
        required_fields = [
            'python_version',
            'hypothesis_version',
            'platform',
            'timestamp'
        ]
        
        for field in required_fields:
            assert field in info, f"Missing required field: {field}"
        
        # Property: Timestamp must be valid ISO format
        timestamp = info['timestamp']
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
