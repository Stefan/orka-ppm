"""
Property-Based Tests for Performance Requirements (Task 10.3)

Tests Property 4: Simulation Performance and Caching
Tests Property 10: Performance Under Load

Feature: roche-construction-ppm-features
Validates: Requirements 8.1, 8.3, 8.4, 8.6
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, initialize
import time
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from typing import List, Dict, Any
import numpy as np

# Import Monte Carlo components
try:
    from monte_carlo.engine import MonteCarloEngine
    from monte_carlo.models import (
        Risk, RiskCategory, ImpactType, ProbabilityDistribution,
        DistributionType, SimulationResults
    )
    MONTE_CARLO_AVAILABLE = True
except ImportError:
    MONTE_CARLO_AVAILABLE = False

# Import caching service
try:
    from services.simulation_cache_service import SimulationCacheService
    CACHE_SERVICE_AVAILABLE = True
except ImportError:
    CACHE_SERVICE_AVAILABLE = False


# ============================================================================
# Hypothesis Strategies
# ============================================================================

def risk_distribution_strategy():
    """Generate valid probability distributions for risks."""
    return st.one_of(
        # Triangular distribution
        st.builds(
            lambda min_val, mode, max_val: {
                'distribution_type': 'triangular',
                'parameters': {'min': min_val, 'mode': mode, 'max': max_val}
            },
            min_val=st.floats(min_value=0, max_value=1000),
            mode=st.floats(min_value=1000, max_value=5000),
            max_val=st.floats(min_value=5000, max_value=10000)
        ),
        # Normal distribution
        st.builds(
            lambda mean, std: {
                'distribution_type': 'normal',
                'parameters': {'mean': mean, 'std': std}
            },
            mean=st.floats(min_value=1000, max_value=5000),
            std=st.floats(min_value=100, max_value=1000)
        )
    )


def risk_strategy():
    """Generate valid Risk objects for simulation."""
    return st.builds(
        lambda id_val, name, category, impact_type, dist: {
            'id': f"{id_val}_{uuid4().hex[:8]}",  # Ensure unique IDs
            'name': name,
            'category': category,
            'impact_type': impact_type,
            'distribution': dist,
            'baseline_impact': dist['parameters'].get('mode', dist['parameters'].get('mean', 1000))
        },
        id_val=st.text(min_size=5, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))),
        name=st.text(min_size=10, max_size=50),
        category=st.sampled_from(['cost', 'schedule', 'resource', 'technical', 'external']),
        impact_type=st.sampled_from(['cost', 'schedule', 'both']),
        dist=risk_distribution_strategy()
    )


def simulation_config_strategy():
    """Generate valid simulation configurations."""
    return st.builds(
        lambda iterations, risks: {
            'iterations': iterations,
            'risks': risks,
            'random_seed': 42  # Fixed seed for reproducibility
        },
        iterations=st.integers(min_value=10000, max_value=50000),
        risks=st.lists(risk_strategy(), min_size=1, max_size=20)
    )


def project_complexity_strategy():
    """Generate project complexity scenarios."""
    return st.builds(
        lambda risk_count, iteration_count, has_correlations: {
            'risk_count': risk_count,
            'iteration_count': iteration_count,
            'has_correlations': has_correlations,
            'complexity_score': risk_count * (iteration_count / 10000) * (1.5 if has_correlations else 1.0)
        },
        risk_count=st.integers(min_value=1, max_value=30),
        iteration_count=st.integers(min_value=10000, max_value=100000),
        has_correlations=st.booleans()
    )


# ============================================================================
# Property 4: Simulation Performance and Caching
# ============================================================================

@pytest.mark.property
@pytest.mark.skipif(not MONTE_CARLO_AVAILABLE, reason="Monte Carlo engine not available")
class TestSimulationPerformanceAndCaching:
    """
    Property 4: Simulation Performance and Caching
    
    For any Monte Carlo simulation on typical project complexity,
    execution must complete within 30 seconds and results must be
    cached until underlying risk data changes.
    
    Validates: Requirements 2.6, 8.1, 8.5
    """
    
    @settings(max_examples=20, deadline=35000)  # 35 second deadline to allow for 30s simulation + overhead
    @given(config=simulation_config_strategy())
    def test_simulation_completes_within_time_limit(self, config):
        """
        Property: Simulations with typical complexity complete within 30 seconds.
        
        Typical complexity defined as:
        - Up to 20 risks
        - 10,000 to 50,000 iterations
        - With or without correlations
        """
        # Skip if configuration is too complex
        complexity_score = len(config['risks']) * (config['iterations'] / 10000)
        assume(complexity_score <= 100)  # Typical complexity threshold
        
        try:
            engine = MonteCarloEngine()
            
            # Convert risk dictionaries to Risk objects
            risks = []
            for risk_data in config['risks']:
                dist_type = DistributionType(risk_data['distribution']['distribution_type'])
                distribution = ProbabilityDistribution(
                    distribution_type=dist_type,
                    parameters=risk_data['distribution']['parameters']
                )
                
                risk = Risk(
                    id=risk_data['id'],
                    name=risk_data['name'],
                    category=RiskCategory(risk_data['category']),
                    impact_type=ImpactType(risk_data['impact_type']),
                    probability_distribution=distribution,
                    baseline_impact=risk_data['baseline_impact']
                )
                risks.append(risk)
            
            # Measure execution time
            start_time = time.time()
            
            results = engine.run_simulation(
                risks=risks,
                iterations=config['iterations'],
                random_seed=config['random_seed']
            )
            
            execution_time = time.time() - start_time
            
            # Property: Execution time must be <= 30 seconds for typical complexity
            assert execution_time <= 30.0, \
                f"Simulation took {execution_time:.2f}s, exceeds 30s limit. " \
                f"Risks: {len(risks)}, Iterations: {config['iterations']}"
            
            # Property: Results must be valid
            assert results is not None, "Simulation must return results"
            assert results.iteration_count == config['iterations'], \
                f"Iteration count mismatch: {results.iteration_count} != {config['iterations']}"
            assert len(results.cost_outcomes) == config['iterations'], \
                "Cost outcomes must match iteration count"
            
        except Exception as e:
            pytest.fail(f"Simulation failed: {str(e)}")
    
    @settings(max_examples=15, deadline=None)
    @given(
        config=simulation_config_strategy(),
        cache_ttl=st.integers(min_value=60, max_value=3600)
    )
    @pytest.mark.skipif(not CACHE_SERVICE_AVAILABLE, reason="Cache service not available")
    def test_simulation_results_cached_correctly(self, config, cache_ttl):
        """
        Property: Simulation results are cached and retrievable until TTL expires.
        
        Note: This is a simplified synchronous test. Full async cache testing
        should be done in separate integration tests.
        """
        # Skip complex configurations
        assume(len(config['risks']) <= 10)
        assume(config['iterations'] <= 20000)
        
        # This test validates the cache key generation and hash calculation logic
        # Full async cache operations are tested in integration tests
        try:
            cache_service = SimulationCacheService()
            
            # Test risk hash calculation (synchronous operation)
            risk_hash1 = cache_service._calculate_risk_hash(config['risks'])
            risk_hash2 = cache_service._calculate_risk_hash(config['risks'])
            
            # Property: Same risk data produces same hash
            assert risk_hash1 == risk_hash2, "Same risk data should produce same hash"
            
            # Property: Modified risk data produces different hash
            if config['risks']:
                modified_risks = config['risks'].copy()
                modified_risks[0]['baseline_impact'] *= 1.5
                
                risk_hash3 = cache_service._calculate_risk_hash(modified_risks)
                assert risk_hash1 != risk_hash3, "Modified risk data should produce different hash"
            
            # Property: Cache key generation is consistent
            simulation_id = str(uuid4())
            cache_key1 = cache_service._generate_cache_key(simulation_id)
            cache_key2 = cache_service._generate_cache_key(simulation_id)
            
            assert cache_key1 == cache_key2, "Cache key generation should be consistent"
            assert simulation_id in cache_key1, "Cache key should contain simulation ID"
            
        except Exception as e:
            pytest.fail(f"Cache test failed: {str(e)}")
    
    @settings(max_examples=10, deadline=None)
    @given(project_complexity=project_complexity_strategy())
    def test_simulation_performance_scales_with_complexity(self, project_complexity):
        """
        Property: Simulation performance scales predictably with complexity.
        
        Complexity factors:
        - Number of risks
        - Number of iterations
        - Presence of correlations
        """
        # Only test reasonable complexity levels
        assume(project_complexity['complexity_score'] <= 150)
        
        try:
            engine = MonteCarloEngine()
            
            # Generate risks based on complexity
            risks = []
            for i in range(project_complexity['risk_count']):
                distribution = ProbabilityDistribution(
                    distribution_type=DistributionType.TRIANGULAR,
                    parameters={'min': 1000, 'mode': 3000, 'max': 5000}
                )
                
                risk = Risk(
                    id=f"risk_{i}",
                    name=f"Risk {i}",
                    category=RiskCategory.COST,
                    impact_type=ImpactType.COST,
                    probability_distribution=distribution,
                    baseline_impact=3000
                )
                risks.append(risk)
            
            # Measure execution time
            start_time = time.time()
            
            results = engine.run_simulation(
                risks=risks,
                iterations=project_complexity['iteration_count'],
                random_seed=42
            )
            
            execution_time = time.time() - start_time
            
            # Property: Execution time should scale reasonably with complexity
            # Expected: ~0.1-0.3 seconds per 10,000 iterations per risk
            expected_max_time = (
                project_complexity['risk_count'] * 
                (project_complexity['iteration_count'] / 10000) * 
                0.5  # 0.5 seconds per risk per 10k iterations
            )
            
            if project_complexity['has_correlations']:
                expected_max_time *= 1.5  # Correlations add overhead
            
            # Allow 2x buffer for system variability
            assert execution_time <= expected_max_time * 2, \
                f"Execution time {execution_time:.2f}s exceeds expected {expected_max_time:.2f}s " \
                f"for complexity score {project_complexity['complexity_score']}"
            
            # Property: Results must be valid
            assert results.iteration_count == project_complexity['iteration_count']
            assert len(results.cost_outcomes) == project_complexity['iteration_count']
            
        except Exception as e:
            pytest.fail(f"Performance scaling test failed: {str(e)}")


# ============================================================================
# Property 10: Performance Under Load
# ============================================================================

@pytest.mark.property
class TestPerformanceUnderLoad:
    """
    Property 10: Performance Under Load
    
    For any system operation under normal load conditions, response times
    must remain within specified limits and the system must degrade
    gracefully rather than fail.
    
    Validates: Requirements 8.1, 8.3, 8.4, 8.6
    
    Note: Full async load testing is done in separate integration tests.
    These property tests validate the core logic and algorithms.
    """
    
    @settings(max_examples=20, deadline=None)
    @given(
        data_size=st.integers(min_value=100, max_value=10000),
        operation_type=st.sampled_from(['hash_calculation', 'key_generation', 'data_validation'])
    )
    @pytest.mark.skipif(not CACHE_SERVICE_AVAILABLE, reason="Cache service not available")
    def test_cache_operations_scale_with_data_size(self, data_size, operation_type):
        """
        Property: Cache operations scale linearly with data size.
        
        Tests synchronous operations that are part of the cache service.
        """
        try:
            cache_service = SimulationCacheService()
            
            # Generate test data
            test_risks = [
                {
                    'id': f"risk_{i}",
                    'name': f"Risk {i}",
                    'category': 'cost',
                    'impact_type': 'cost',
                    'distribution': {
                        'distribution_type': 'triangular',
                        'parameters': {'min': 1000, 'mode': 3000, 'max': 5000}
                    },
                    'baseline_impact': 3000
                }
                for i in range(min(data_size, 100))  # Limit to 100 risks for performance
            ]
            
            if operation_type == 'hash_calculation':
                # Test hash calculation performance
                start_time = time.time()
                hash_value = cache_service._calculate_risk_hash(test_risks)
                execution_time = (time.time() - start_time) * 1000  # ms
                
                # Property: Hash calculation should be fast
                assert execution_time < 100, \
                    f"Hash calculation took {execution_time:.2f}ms, exceeds 100ms limit"
                assert len(hash_value) == 64, "SHA256 hash should be 64 characters"
                
            elif operation_type == 'key_generation':
                # Test key generation performance
                simulation_ids = [str(uuid4()) for _ in range(min(data_size, 1000))]
                
                start_time = time.time()
                keys = [cache_service._generate_cache_key(sim_id) for sim_id in simulation_ids]
                execution_time = (time.time() - start_time) * 1000  # ms
                
                # Property: Key generation should be fast
                avg_time_per_key = execution_time / len(keys)
                assert avg_time_per_key < 1.0, \
                    f"Average key generation time {avg_time_per_key:.4f}ms exceeds 1ms limit"
                
                # Property: All keys should be unique
                assert len(keys) == len(set(keys)), "All generated keys should be unique"
                
            elif operation_type == 'data_validation':
                # Test data validation logic
                project_id = uuid4()
                
                start_time = time.time()
                key1 = cache_service._generate_project_sims_key(project_id)
                key2 = cache_service._generate_risk_hash_key(project_id)
                execution_time = (time.time() - start_time) * 1000  # ms
                
                # Property: Key generation should be instant
                assert execution_time < 10, \
                    f"Key generation took {execution_time:.2f}ms, exceeds 10ms limit"
                
                # Property: Keys should be properly formatted
                assert str(project_id) in key1, "Project ID should be in project sims key"
                assert str(project_id) in key2, "Project ID should be in risk hash key"
            
        except Exception as e:
            pytest.fail(f"Cache operation test failed: {str(e)}")
    
    @settings(max_examples=10, deadline=None)
    @given(
        num_operations=st.integers(min_value=10, max_value=100),
        operation_complexity=st.sampled_from(['simple', 'moderate', 'complex'])
    )
    def test_repeated_operations_maintain_consistency(self, num_operations, operation_complexity):
        """
        Property: Repeated operations produce consistent results.
        
        This validates that the system maintains consistency under repeated load.
        """
        try:
            cache_service = SimulationCacheService()
            
            # Generate test data based on complexity
            risk_count = {
                'simple': 5,
                'moderate': 15,
                'complex': 30
            }[operation_complexity]
            
            test_risks = [
                {
                    'id': f"risk_{i}",
                    'name': f"Risk {i}",
                    'category': 'cost',
                    'impact_type': 'cost',
                    'distribution': {
                        'distribution_type': 'triangular',
                        'parameters': {'min': 1000, 'mode': 3000, 'max': 5000}
                    },
                    'baseline_impact': 3000
                }
                for i in range(risk_count)
            ]
            
            # Property: Hash calculation is deterministic
            hashes = []
            for _ in range(num_operations):
                hash_value = cache_service._calculate_risk_hash(test_risks)
                hashes.append(hash_value)
            
            # All hashes should be identical
            assert len(set(hashes)) == 1, \
                "Hash calculation should be deterministic - all hashes should be identical"
            
            # Property: Key generation is consistent
            simulation_id = str(uuid4())
            keys = []
            for _ in range(num_operations):
                key = cache_service._generate_cache_key(simulation_id)
                keys.append(key)
            
            # All keys should be identical for the same simulation ID
            assert len(set(keys)) == 1, \
                "Key generation should be consistent for the same simulation ID"
            
        except Exception as e:
            pytest.fail(f"Consistency test failed: {str(e)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "property"])
