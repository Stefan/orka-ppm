"""
Property-based tests for configuration validation.

These tests validate universal properties that should hold across all
configuration validation scenarios.
"""

import os
import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from unittest.mock import patch, MagicMock
from typing import Dict, Any

from .configuration_validator import ConfigurationValidator
from .models import ValidationConfiguration, ValidationStatus, Severity


class TestConfigurationValidationProperties:
    """Property-based tests for configuration validation."""
    
    def setup_method(self):
        """Set up test configuration."""
        self.config = ValidationConfiguration(
            development_mode=True,
            timeout_seconds=30
        )
    
    # Strategy for generating environment variable names
    env_var_names = st.sampled_from([
        'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY',
        'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'
    ])
    
    # Strategy for generating valid URLs
    valid_supabase_urls = st.builds(
        lambda project_id: f"https://{project_id}.supabase.co",
        st.text(
            alphabet='abcdefghijklmnopqrstuvwxyz0123456789', 
            min_size=16, 
            max_size=16
        )
    )
    
    # Strategy for generating valid JWT tokens
    valid_jwt_tokens = st.builds(
        lambda header, payload, signature: f"{header}.{payload}.{signature}",
        st.just('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),  # Fixed valid header
        st.text(
            alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
            min_size=20,
            max_size=100
        ),
        st.text(
            alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
            min_size=20,
            max_size=50
        )
    )
    
    # Strategy for generating valid OpenAI API keys
    valid_openai_keys = st.builds(
        lambda suffix: f"sk-{suffix}",
        st.text(
            alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            min_size=48,
            max_size=48
        )
    )
    
    @given(
        required_vars=st.dictionaries(
            st.sampled_from(['SUPABASE_URL']),
            valid_supabase_urls,
            min_size=1,
            max_size=1
        ) | st.dictionaries(
            st.sampled_from(['SUPABASE_ANON_KEY']),
            valid_jwt_tokens,
            min_size=1,
            max_size=1
        ) | st.dictionaries(
            st.sampled_from(['OPENAI_API_KEY']),
            valid_openai_keys,
            min_size=1,
            max_size=1
        )
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_property_13_environment_variable_completeness(self, required_vars: Dict[str, str]):
        """
        Property 13: Environment Variable Completeness
        For any configuration validation, all required environment variables 
        must be checked for presence and validity.
        
        **Validates: Requirements 5.1, 5.4**
        """
        # Feature: pre-startup-testing, Property 13: Environment Variable Completeness
        
        validator = ConfigurationValidator(self.config)
        
        # Set up environment with the generated variables
        with patch.dict(os.environ, required_vars, clear=True):
            results = await validator.validate()
        
        # Property: All required environment variables must be checked
        required_env_vars = set(ConfigurationValidator.REQUIRED_ENV_VARS.keys())
        tested_vars = set()
        
        for result in results:
            if "Environment Variable:" in result.test_name:
                var_name = result.test_name.split(": ")[1]
                tested_vars.add(var_name)
        
        # Assert: All required variables were tested (even if some are missing from environment)
        # The validator should test all required variables regardless of what's in the environment
        for required_var in required_env_vars:
            var_results = [r for r in results if required_var in r.test_name]
            assert len(var_results) > 0, f"Required variable {required_var} was not tested"
        
        # Property: Variables present in environment should pass or have specific validation failures
        for var_name, var_value in required_vars.items():
            if var_name in required_env_vars:
                var_results = [r for r in results if var_name in r.test_name]
                assert len(var_results) > 0, f"No results found for variable {var_name}"
                
                # If the variable is properly formatted, it should pass
                # If not, it should fail with specific guidance
                for result in var_results:
                    assert result.status in [ValidationStatus.PASS, ValidationStatus.FAIL], (
                        f"Variable {var_name} should either pass or fail, got {result.status}"
                    )
    
    @given(
        missing_vars=st.sets(env_var_names, min_size=1, max_size=3),
        present_vars=st.dictionaries(
            env_var_names,
            st.text(
                alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.',
                min_size=1, 
                max_size=100
            ),
            min_size=0,
            max_size=2
        )
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_property_14_configuration_error_guidance(
        self, 
        missing_vars: set, 
        present_vars: Dict[str, str]
    ):
        """
        Property 14: Configuration Error Guidance
        For any configuration validation failure, specific guidance with 
        correct formats and examples must be provided.
        
        **Validates: Requirements 5.2, 5.3**
        """
        # Feature: pre-startup-testing, Property 14: Configuration Error Guidance
        
        # Ensure missing_vars and present_vars don't overlap
        assume(not (missing_vars & set(present_vars.keys())))
        
        validator = ConfigurationValidator(self.config)
        
        # Set up environment with only present vars (missing vars will be absent)
        with patch.dict(os.environ, present_vars, clear=True):
            results = await validator.validate()
        
        # Property: All failed validations must provide resolution guidance
        failed_results = [r for r in results if r.status == ValidationStatus.FAIL]
        
        for result in failed_results:
            # Must have resolution steps
            assert len(result.resolution_steps) > 0, (
                f"Failed result '{result.test_name}' must provide resolution steps"
            )
            
            # Must have meaningful error message
            assert len(result.message) > 10, (
                f"Failed result '{result.test_name}' must have descriptive error message"
            )
            
            # Must have details for context
            assert result.details is not None, (
                f"Failed result '{result.test_name}' must provide details"
            )
            
            # Resolution steps should be actionable (contain specific instructions)
            actionable_keywords = ['add', 'check', 'verify', 'copy', 'set', 'go to', 'create']
            has_actionable_step = any(
                any(keyword in step.lower() for keyword in actionable_keywords)
                for step in result.resolution_steps
            )
            assert has_actionable_step, (
                f"Failed result '{result.test_name}' must have actionable resolution steps"
            )
        
        # Property: Missing required variables must have specific guidance
        required_missing = missing_vars & set(ConfigurationValidator.REQUIRED_ENV_VARS.keys())
        for missing_var in required_missing:
            missing_var_results = [
                r for r in failed_results 
                if missing_var in r.test_name and 'missing' in r.message.lower()
            ]
            
            if missing_var_results:  # Should have results for missing required vars
                result = missing_var_results[0]
                
                # Must provide where to find the variable
                assert any(
                    'dashboard' in step.lower() or 'platform' in step.lower() or 'settings' in step.lower()
                    for step in result.resolution_steps
                ), f"Missing variable {missing_var} must provide source location guidance"
                
                # Must provide format example
                assert result.details and 'expected_format' in result.details, (
                    f"Missing variable {missing_var} must provide format example"
                )
    
    @given(
        invalid_formats=st.dictionaries(
            env_var_names,
            st.one_of(
                st.text(
                    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                    max_size=5
                ),  # Too short
                st.text(
                    alphabet='!@#$%^&*()',
                    min_size=10,
                    max_size=20
                ),  # Special chars only
                st.builds(lambda x: f"invalid-{x}", st.text(
                    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                    min_size=5, 
                    max_size=20
                )),  # Invalid prefix
                st.just("invalid"),  # Simple invalid string
                st.builds(lambda x: f"   {x}   ", st.text(
                    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                    min_size=5, 
                    max_size=20
                ))  # With spaces
            ),
            min_size=1,
            max_size=3
        )
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_property_format_validation_consistency(self, invalid_formats: Dict[str, str]):
        """
        Property: Format validation must be consistent and provide specific guidance.
        For any invalid format, the validator must identify specific issues and 
        provide targeted resolution steps.
        """
        # Feature: pre-startup-testing, Property: Format Validation Consistency
        
        validator = ConfigurationValidator(self.config)
        
        # Test with invalid formats
        with patch.dict(os.environ, invalid_formats, clear=True):
            results = await validator.validate()
        
        # Property: Invalid formats should be detected and reported
        format_failures = [
            r for r in results 
            if r.status == ValidationStatus.FAIL and 
            ('format' in r.message.lower() or 'invalid' in r.message.lower())
        ]
        
        for result in format_failures:
            # Must identify specific format issues
            assert result.details is not None, "Format failures must provide details"
            
            # Must provide expected format
            expected_format_provided = (
                'expected_format' in result.details or 
                any('format' in step.lower() for step in result.resolution_steps)
            )
            assert expected_format_provided, (
                f"Format failure '{result.test_name}' must provide expected format"
            )
            
            # Must provide example value
            example_provided = (
                'example_value' in result.details or
                any('example' in step.lower() for step in result.resolution_steps)
            )
            assert example_provided, (
                f"Format failure '{result.test_name}' must provide example value"
            )
    
    @given(
        env_config=st.dictionaries(
            env_var_names,
            st.one_of(
                valid_supabase_urls,
                valid_jwt_tokens, 
                valid_openai_keys,
                st.text(
                    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.',
                    min_size=1, 
                    max_size=50
                )  # Mix of valid and invalid
            ),
            min_size=0,
            max_size=5
        ),
        development_mode=st.booleans()
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_property_validation_determinism(
        self, 
        env_config: Dict[str, str], 
        development_mode: bool
    ):
        """
        Property: Validation results must be deterministic.
        For any given environment configuration, running validation multiple times
        should produce identical results.
        """
        # Feature: pre-startup-testing, Property: Validation Determinism
        
        config = ValidationConfiguration(development_mode=development_mode)
        validator = ConfigurationValidator(config)
        
        # Run validation multiple times with same environment
        results_list = []
        for _ in range(3):
            with patch.dict(os.environ, env_config, clear=True):
                results = await validator.validate()
                results_list.append(results)
        
        # Property: Results should be identical across runs
        first_results = results_list[0]
        for subsequent_results in results_list[1:]:
            assert len(first_results) == len(subsequent_results), (
                "Number of validation results should be consistent"
            )
            
            # Compare results by test name and status
            first_by_name = {r.test_name: r for r in first_results}
            subsequent_by_name = {r.test_name: r for r in subsequent_results}
            
            assert set(first_by_name.keys()) == set(subsequent_by_name.keys()), (
                "Test names should be consistent across runs"
            )
            
            for test_name in first_by_name:
                first_result = first_by_name[test_name]
                subsequent_result = subsequent_by_name[test_name]
                
                assert first_result.status == subsequent_result.status, (
                    f"Status for '{test_name}' should be consistent: "
                    f"{first_result.status} vs {subsequent_result.status}"
                )
                
                assert first_result.severity == subsequent_result.severity, (
                    f"Severity for '{test_name}' should be consistent"
                )
    
    @given(
        complete_valid_config=st.fixed_dictionaries({
            'SUPABASE_URL': valid_supabase_urls,
            'SUPABASE_ANON_KEY': valid_jwt_tokens,
            'OPENAI_API_KEY': valid_openai_keys
        })
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.filter_too_much])
    @pytest.mark.asyncio
    async def test_property_complete_valid_configuration_passes(
        self, 
        complete_valid_config: Dict[str, str]
    ):
        """
        Property: Complete valid configuration should pass all tests.
        For any environment with all required variables in valid formats,
        all validation tests should pass.
        """
        # Feature: pre-startup-testing, Property: Complete Valid Configuration Passes
        
        validator = ConfigurationValidator(self.config)
        
        with patch.dict(os.environ, complete_valid_config, clear=True):
            results = await validator.validate()
        
        # Property: All required variable tests should pass
        required_var_results = [
            r for r in results 
            if any(var in r.test_name for var in ConfigurationValidator.REQUIRED_ENV_VARS.keys())
            and r.status != ValidationStatus.SKIP
        ]
        
        failed_results = [r for r in required_var_results if r.status == ValidationStatus.FAIL]
        
        assert len(failed_results) == 0, (
            f"Valid configuration should not have failures. Failed tests: "
            f"{[(r.test_name, r.message) for r in failed_results]}"
        )
        
        # Property: Should have at least one passing test for each required variable
        for var_name in ConfigurationValidator.REQUIRED_ENV_VARS.keys():
            var_tests = [r for r in results if var_name in r.test_name]
            passing_tests = [r for r in var_tests if r.status == ValidationStatus.PASS]
            
            assert len(passing_tests) > 0, (
                f"Should have at least one passing test for {var_name}"
            )