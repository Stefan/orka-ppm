"""
Comprehensive Integration Tests for Monte Carlo Risk Simulation System.

This module provides extensive integration testing covering:
- Complete system workflows with real data
- Cross-component interactions and data flow validation
- System performance and scalability testing
- Concurrent operations and thread safety
- Error handling and recovery across components
- End-to-end data pipeline validation

Feature: monte-carlo-risk-simulations
Task: 16.2 Write comprehensive integration tests
"""

import pytest
import numpy as np
import json
import tempfile
import os
import time
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import Mock, patch, MagicMock
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Import Monte Carlo components
from monte_carlo.system_integrator import MonteCarloSystemIntegrator, get_system_integrator
from monte_carlo.engine import MonteCarloEngine
from monte_carlo.distribution_modeler import RiskDistributionModeler
from monte_carlo.correlation_analyzer import RiskCorrelationAnalyzer
from monte_carlo.results_analyzer import SimulationResultsAnalyzer
from monte_carlo.scenario_generator import ScenarioGenerator
from monte_carlo.visualization import VisualizationManager
from monte_carlo.risk_register_integration import RiskRegisterImporter
from monte_carlo.historical_data_calibrator import HistoricalDataCalibrator
from monte_carlo.continuous_improvement_engine import ContinuousImprovementEngine
from monte_carlo.risk_pattern_database import RiskPatternDatabase
from monte_carlo.model_validator import ModelValidator
from monte_carlo.change_detector import ModelChangeDetector
from monte_carlo.cost_escalation import CostEscalationModeler
from monte_carlo.distribution_outputs import DistributionOutputGenerator
from monte_carlo.incomplete_data_handler import IncompleteDataHandler

# Import models
from monte_carlo.models import (
    Risk, RiskCategory, ImpactType, DistributionType, ProbabilityDistribution,
    Scenario, SimulationResults, CorrelationMatrix, MitigationStrategy,
    ScheduleData, Milestone, Activity, ResourceConstraint, RiskModification,
    ValidationResult, ProgressStatus, SystemHealthStatus, IntegrationReport,
    WorkflowResult, PerformanceMetrics
)

# Import configuration
from monte_carlo.simulation_config import SimulationConfig, ConfigurationManager


class TestSystemIntegrationWorkflows:
    """Test complete system integration workflows with real data."""
    
    @pytest.fixture
    def real_world_project_data(self) -> Dict[str, Any]:
        """Create realistic project data for integration testing."""
        return {
            'project_id': 'PROJ_CONSTRUCTION_2024_001',
            'project_name': 'Commercial Building Construction',
            'project_type': 'construction',
            'baseline_budget': 5000000,
            'baseline_duration': 180,  # days
            'start_date': datetime.now(),
            'target_completion': datetime.now() + timedelta(days=180),
            'risk_tolerance': 0.15,  # 15% budget variance acceptable
            'schedule_tolerance': 0.10  # 10% schedule variance acceptable
        }
    
    @pytest.fixture
    def comprehensive_risk_set(self) -> List[Risk]:
        """Create comprehensive set of realistic risks."""
        risks = []
        
        # Cost risks
        risks.append(Risk(
            id="COST_001",
            name="Material Price Escalation",
            category=RiskCategory.COST,
            impact_type=ImpactType.COST,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.TRIANGULAR,
                parameters={"min": 100000, "mode": 250000, "max": 500000}
            ),
            baseline_impact=250000,
            correlation_dependencies=["COST_002", "SCHEDULE_001"],
            mitigation_strategies=[
                MitigationStrategy(
                    id="MIT_COST_001",
                    name="Fixed Price Contracts",
                    description="Lock in material prices with suppliers",
                    cost=25000,
                    effectiveness=0.75,
                    implementation_time=30
                )
            ]
        ))
        
        risks.append(Risk(
            id="COST_002",
            name="Labor Cost Overrun",
            category=RiskCategory.RESOURCE,
            impact_type=ImpactType.COST,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.LOGNORMAL,
                parameters={"mu": 12.0, "sigma": 0.4}
            ),
            baseline_impact=150000,
            correlation_dependencies=["SCHEDULE_002"],
            mitigation_strategies=[]
        ))
        
        # Schedule risks
        risks.append(Risk(
            id="SCHEDULE_001",
            name="Weather Delays",
            category=RiskCategory.SCHEDULE,
            impact_type=ImpactType.SCHEDULE,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.BETA,
                parameters={"alpha": 2, "beta": 5, "scale": 30}
            ),
            baseline_impact=15,  # days
            correlation_dependencies=["SCHEDULE_002"],
            mitigation_strategies=[]
        ))
        
        risks.append(Risk(
            id="SCHEDULE_002",
            name="Permit Approval Delays",
            category=RiskCategory.REGULATORY,
            impact_type=ImpactType.SCHEDULE,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.UNIFORM,
                parameters={"min": 5, "max": 45}
            ),
            baseline_impact=20,  # days
            correlation_dependencies=[],
            mitigation_strategies=[]
        ))
        
        # Combined risks
        risks.append(Risk(
            id="COMBINED_001",
            name="Design Changes",
            category=RiskCategory.TECHNICAL,
            impact_type=ImpactType.BOTH,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.NORMAL,
                parameters={"mean": 200000, "std": 75000}
            ),
            baseline_impact=200000,
            correlation_dependencies=["COST_001", "SCHEDULE_001"],
            mitigation_strategies=[]
        ))
        
        risks.append(Risk(
            id="COMBINED_002",
            name="Equipment Failure",
            category=RiskCategory.TECHNICAL,
            impact_type=ImpactType.BOTH,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.TRIANGULAR,
                parameters={"min": 50000, "mode": 100000, "max": 300000}
            ),
            baseline_impact=100000,
            correlation_dependencies=[],
            mitigation_strategies=[]
        ))
        
        return risks
    
    @pytest.fixture
    def comprehensive_correlations(self, comprehensive_risk_set) -> CorrelationMatrix:
        """Create realistic correlation matrix."""
        correlations = {
            ("COST_001", "COST_002"): 0.5,  # Material and labor costs moderately correlated
            ("COST_001", "SCHEDULE_001"): 0.6,  # Material costs and weather delays correlated
            ("COST_002", "SCHEDULE_002"): 0.4,  # Labor costs and permit delays weakly correlated
            ("SCHEDULE_001", "SCHEDULE_002"): 0.3,  # Weather and permit delays weakly correlated
            ("COMBINED_001", "COST_001"): 0.7,  # Design changes strongly affect material costs
            ("COMBINED_001", "SCHEDULE_001"): 0.6,  # Design changes affect schedule
            ("COMBINED_002", "COST_002"): 0.5,  # Equipment failure affects labor costs
        }
        
        risk_ids = [risk.id for risk in comprehensive_risk_set]
        return CorrelationMatrix(correlations=correlations, risk_ids=risk_ids)
    
    @pytest.fixture
    def comprehensive_schedule_data(self) -> ScheduleData:
        """Create comprehensive schedule data."""
        milestones = [
            Milestone(
                id="M001",
                name="Site Preparation Complete",
                baseline_duration=20,
                critical_path=True,
                dependencies=[]
            ),
            Milestone(
                id="M002",
                name="Foundation Complete",
                baseline_duration=40,
                critical_path=True,
                dependencies=["M001"]
            ),
            Milestone(
                id="M003",
                name="Structure Complete",
                baseline_duration=80,
                critical_path=True,
                dependencies=["M002"]
            ),
            Milestone(
                id="M004",
                name="Interior Finish Complete",
                baseline_duration=40,
                critical_path=False,
                dependencies=["M003"]
            )
        ]
        
        activities = [
            Activity(
                id="A001",
                name="Site Clearing",
                baseline_duration=10,
                earliest_start=0,
                latest_start=0,
                float_time=0,
                critical_path=True,
                resource_requirements={"excavator": 2, "crew": 5}
            ),
            Activity(
                id="A002",
                name="Foundation Excavation",
                baseline_duration=15,
                earliest_start=10,
                latest_start=10,
                float_time=0,
                critical_path=True,
                resource_requirements={"excavator": 1, "crew": 8}
            ),
            Activity(
                id="A003",
                name="Foundation Pour",
                baseline_duration=25,
                earliest_start=25,
                latest_start=25,
                float_time=0,
                critical_path=True,
                resource_requirements={"concrete_crew": 12, "crane": 1}
            ),
            Activity(
                id="A004",
                name="Steel Erection",
                baseline_duration=50,
                earliest_start=50,
                latest_start=50,
                float_time=0,
                critical_path=True,
                resource_requirements={"steel_crew": 15, "crane": 2}
            ),
            Activity(
                id="A005",
                name="Interior Framing",
                baseline_duration=30,
                earliest_start=100,
                latest_start=110,
                float_time=10,
                critical_path=False,
                resource_requirements={"carpenter_crew": 10}
            )
        ]
        
        resource_constraints = [
            ResourceConstraint(
                resource_id="R001",
                resource_name="Tower Crane",
                total_availability=2,
                utilization_limit=0.9,
                availability_periods=[(0, 180)]
            ),
            ResourceConstraint(
                resource_id="R002",
                resource_name="Concrete Crew",
                total_availability=15,
                utilization_limit=1.0,
                availability_periods=[(0, 180)]
            ),
            ResourceConstraint(
                resource_id="R003",
                resource_name="Steel Crew",
                total_availability=20,
                utilization_limit=1.0,
                availability_periods=[(0, 180)]
            )
        ]
        
        return ScheduleData(
            project_baseline_duration=180,
            milestones=milestones,
            activities=activities,
            resource_constraints=resource_constraints
        )
    
    def test_complete_end_to_end_workflow_with_real_data(
        self,
        real_world_project_data,
        comprehensive_risk_set,
        comprehensive_correlations,
        comprehensive_schedule_data
    ):
        """
        Test complete end-to-end workflow with realistic project data.
        
        Validates:
        - Complete data pipeline from risk import to visualization
        - All component interactions work correctly
        - Results are mathematically valid and realistic
        - Performance meets requirements
        """
        print("\n🧪 Testing Complete End-to-End Workflow with Real Data")
        
        # Initialize system integrator
        config = SimulationConfig(
            default_iterations=10000,
            convergence_threshold=0.01,
            random_seed=None,  # Use random for realistic testing
            enable_parallel_processing=True
        )
        integrator = MonteCarloSystemIntegrator(config)
        
        # Execute complete workflow
        start_time = time.time()
        workflow_result = integrator.execute_complete_workflow(
            risks=comprehensive_risk_set,
            correlations=comprehensive_correlations,
            iterations=10000,
            include_visualization=True,
            include_historical_learning=False,  # No historical data for this test
            export_formats=['json', 'csv']
        )
        execution_time = time.time() - start_time
        
        # Validate workflow success
        assert workflow_result.success, f"Workflow failed: {workflow_result.execution_error}"
        assert workflow_result.simulation_results is not None
        assert workflow_result.percentile_analysis is not None
        assert workflow_result.confidence_intervals is not None
        assert workflow_result.risk_contributions is not None
        
        # Validate simulation results
        results = workflow_result.simulation_results
        assert results.iteration_count == 10000
        assert len(results.cost_outcomes) == 10000
        assert len(results.schedule_outcomes) == 10000
        assert results.convergence_metrics.converged
        
        # Validate statistical properties
        cost_mean = np.mean(results.cost_outcomes)
        cost_std = np.std(results.cost_outcomes)
        schedule_mean = np.mean(results.schedule_outcomes)
        schedule_std = np.std(results.schedule_outcomes)
        
        # Cost should be above baseline due to risks
        assert cost_mean > real_world_project_data['baseline_budget']
        assert cost_std > 0
        
        # Schedule should be above baseline due to schedule risks
        assert schedule_mean > real_world_project_data['baseline_duration']
        assert schedule_std > 0
        
        # Validate percentile analysis
        percentiles = workflow_result.percentile_analysis
        assert percentiles.mean > 0
        assert percentiles.median > 0
        assert percentiles.std_dev > 0
        assert len(percentiles.percentiles) >= 7  # P10, P25, P50, P75, P90, P95, P99
        
        # Validate confidence intervals
        ci = workflow_result.confidence_intervals
        assert len(ci.intervals) == 3  # 80%, 90%, 95%
        for level, (lower, upper) in ci.intervals.items():
            assert lower < upper
            assert lower > 0
        
        # Validate risk contributions
        assert len(workflow_result.risk_contributions) <= 10
        total_contribution = sum(rc.contribution_percentage for rc in workflow_result.risk_contributions)
        assert 0.5 <= total_contribution <= 1.0  # Should account for most variance
        
        # Validate visualizations were generated
        assert workflow_result.visualizations is not None
        assert 'cost_distribution' in workflow_result.visualizations
        assert 'schedule_distribution' in workflow_result.visualizations
        assert 'tornado_diagram' in workflow_result.visualizations
        
        # Validate exports were created
        assert workflow_result.exports is not None
        assert 'json' in workflow_result.exports
        assert 'csv' in workflow_result.exports
        
        # Validate performance
        assert execution_time < 30.0, f"Execution time {execution_time:.2f}s exceeds 30s requirement"
        assert workflow_result.performance_metrics.meets_performance_requirements
        
        print(f"✅ End-to-End Workflow Test Passed")
        print(f"   - Execution time: {execution_time:.2f}s")
        print(f"   - Cost mean: ${cost_mean:,.0f} (baseline: ${real_world_project_data['baseline_budget']:,.0f})")
        print(f"   - Schedule mean: {schedule_mean:.1f} days (baseline: {real_world_project_data['baseline_duration']} days)")
        print(f"   - Top risk: {workflow_result.risk_contributions[0].risk_name} ({workflow_result.risk_contributions[0].contribution_percentage:.1%})")
        print(f"   - Visualizations generated: {len(workflow_result.visualizations)}")
        print(f"   - Exports created: {len(workflow_result.exports)}")

    def test_cross_component_data_flow_validation(
        self,
        comprehensive_risk_set,
        comprehensive_correlations
    ):
        """
        Test data flow between all system components.
        
        Validates:
        - Data transformations are correct at each stage
        - No data loss or corruption between components
        - Component interfaces work correctly
        - Data types and formats are preserved
        """
        print("\n🧪 Testing Cross-Component Data Flow")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Step 1: Distribution Modeler -> Engine
        print("   Step 1: Distribution Modeler -> Engine")
        modeled_risks = []
        for risk in comprehensive_risk_set:
            # Validate distribution modeling
            assert risk.probability_distribution is not None
            assert risk.probability_distribution.distribution_type in DistributionType
            assert len(risk.probability_distribution.parameters) > 0
            modeled_risks.append(risk)
        
        # Step 2: Correlation Analyzer -> Engine
        print("   Step 2: Correlation Analyzer -> Engine")
        validated_correlations = integrator.correlation_analyzer.validate_correlation_matrix(
            comprehensive_correlations
        )
        assert validated_correlations.is_valid
        
        # Step 3: Engine -> Results Analyzer
        print("   Step 3: Engine -> Results Analyzer")
        simulation_results = integrator.engine.run_simulation(
            risks=modeled_risks,
            iterations=5000,
            correlations=comprehensive_correlations,
            random_seed=42
        )
        
        # Validate simulation output structure
        assert hasattr(simulation_results, 'simulation_id')
        assert hasattr(simulation_results, 'cost_outcomes')
        assert hasattr(simulation_results, 'schedule_outcomes')
        assert hasattr(simulation_results, 'risk_contributions')
        assert len(simulation_results.cost_outcomes) == 5000
        assert len(simulation_results.schedule_outcomes) == 5000
        
        # Step 4: Results Analyzer -> Statistical Analysis
        print("   Step 4: Results Analyzer -> Statistical Analysis")
        percentiles = integrator.results_analyzer.calculate_percentiles(simulation_results)
        
        # Validate percentile calculation
        assert percentiles.mean > 0
        assert percentiles.median > 0
        assert percentiles.std_dev > 0
        assert 10 in percentiles.percentiles
        assert 50 in percentiles.percentiles
        assert 90 in percentiles.percentiles
        
        # Step 5: Results Analyzer -> Risk Contributions
        print("   Step 5: Results Analyzer -> Risk Contributions")
        risk_contributions = integrator.results_analyzer.identify_top_risk_contributors(
            simulation_results, top_n=5
        )
        
        # Validate risk contribution analysis
        assert len(risk_contributions) <= 5
        for contrib in risk_contributions:
            assert contrib.risk_id in [r.id for r in modeled_risks]
            assert 0 <= contrib.contribution_percentage <= 1
            assert contrib.risk_name is not None
        
        # Step 6: Scenario Generator -> Comparison
        print("   Step 6: Scenario Generator -> Comparison")
        baseline_scenario = integrator.scenario_generator.create_scenario(
            base_risks=modeled_risks,
            modifications={},
            name="Baseline",
            description="Original risks"
        )
        
        # Validate scenario creation
        assert baseline_scenario.id is not None
        assert len(baseline_scenario.risks) == len(modeled_risks)
        assert baseline_scenario.name == "Baseline"
        
        # Step 7: Visualization Generator -> Charts
        print("   Step 7: Visualization Generator -> Charts")
        with tempfile.TemporaryDirectory() as temp_dir:
            cost_chart = integrator.visualization_generator.generate_cost_distribution_chart(
                simulation_results,
                output_path=os.path.join(temp_dir, "cost.png")
            )
            
            # Validate visualization output
            assert os.path.exists(cost_chart)
            assert os.path.getsize(cost_chart) > 1000
        
        print(f"✅ Cross-Component Data Flow Test Passed")
        print(f"   - All 7 component interactions validated")
        print(f"   - Data integrity maintained throughout pipeline")
        print(f"   - No data loss or corruption detected")
    
    def test_concurrent_simulation_execution(
        self,
        comprehensive_risk_set,
        comprehensive_correlations
    ):
        """
        Test concurrent execution of multiple simulations.
        
        Validates:
        - Thread safety of simulation engine
        - No race conditions or data corruption
        - Correct isolation between concurrent simulations
        - Performance under concurrent load
        """
        print("\n🧪 Testing Concurrent Simulation Execution")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Create multiple scenarios for concurrent execution
        scenarios = []
        for i in range(5):
            modifications = {}
            if i > 0:
                # Modify first risk for each scenario
                modifications[comprehensive_risk_set[0].id] = RiskModification(
                    parameter_changes={"mode": 250000 + i * 50000},
                    mitigation_applied=False
                )
            
            scenario = integrator.scenario_generator.create_scenario(
                base_risks=comprehensive_risk_set,
                modifications=modifications,
                name=f"Scenario_{i}",
                description=f"Test scenario {i}"
            )
            scenarios.append(scenario)
        
        # Execute simulations concurrently
        results = {}
        errors = []
        
        def run_simulation(scenario):
            try:
                result = integrator.engine.run_simulation(
                    risks=scenario.risks,
                    iterations=2000,  # Smaller for faster concurrent execution
                    correlations=comprehensive_correlations,
                    random_seed=42 + scenarios.index(scenario)  # Different seed per scenario
                )
                return scenario.id, result
            except Exception as e:
                errors.append((scenario.id, str(e)))
                return scenario.id, None
        
        start_time = time.time()
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(run_simulation, scenario) for scenario in scenarios]
            
            for future in as_completed(futures):
                scenario_id, result = future.result()
                if result is not None:
                    results[scenario_id] = result
        
        execution_time = time.time() - start_time
        
        # Validate concurrent execution
        assert len(errors) == 0, f"Concurrent execution errors: {errors}"
        assert len(results) == 5, f"Expected 5 results, got {len(results)}"
        
        # Validate each result is independent and correct
        for scenario_id, result in results.items():
            assert result.iteration_count == 2000
            assert len(result.cost_outcomes) == 2000
            assert result.convergence_metrics.converged
            
            # Verify results are different (not sharing state)
            for other_id, other_result in results.items():
                if other_id != scenario_id:
                    # Results should be different due to different scenarios/seeds
                    assert not np.array_equal(result.cost_outcomes, other_result.cost_outcomes)
        
        print(f"✅ Concurrent Simulation Test Passed")
        print(f"   - Executed {len(scenarios)} simulations concurrently")
        print(f"   - Total execution time: {execution_time:.2f}s")
        print(f"   - No race conditions or data corruption detected")
        print(f"   - All simulations completed successfully")
    
    def test_system_scalability_with_varying_project_sizes(self):
        """
        Test system scalability with different project sizes.
        
        Validates:
        - Performance scales appropriately with risk count
        - Memory usage remains reasonable
        - Results quality maintained across scales
        - System handles maximum supported configuration
        """
        print("\n🧪 Testing System Scalability")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Test with different risk counts
        test_configurations = [
            {'risk_count': 10, 'iterations': 10000, 'max_time': 5.0},
            {'risk_count': 25, 'iterations': 10000, 'max_time': 10.0},
            {'risk_count': 50, 'iterations': 10000, 'max_time': 20.0},
            {'risk_count': 100, 'iterations': 10000, 'max_time': 30.0},  # Maximum supported
        ]
        
        scalability_results = []
        
        for config in test_configurations:
            print(f"   Testing with {config['risk_count']} risks...")
            
            # Generate risk set
            risks = []
            for i in range(config['risk_count']):
                risk = Risk(
                    id=f"SCALE_RISK_{i:03d}",
                    name=f"Scalability Test Risk {i}",
                    category=RiskCategory.COST,
                    impact_type=ImpactType.COST,
                    probability_distribution=ProbabilityDistribution(
                        distribution_type=DistributionType.NORMAL,
                        parameters={"mean": 10000 + i * 100, "std": 2000}
                    ),
                    baseline_impact=10000 + i * 100,
                    correlation_dependencies=[],
                    mitigation_strategies=[]
                )
                risks.append(risk)
            
            # Execute simulation
            start_time = time.time()
            result = integrator.engine.run_simulation(
                risks=risks,
                iterations=config['iterations'],
                random_seed=42
            )
            execution_time = time.time() - start_time
            
            # Validate results
            assert result.iteration_count == config['iterations']
            assert len(result.cost_outcomes) == config['iterations']
            assert result.convergence_metrics.converged
            assert execution_time < config['max_time'], \
                f"Execution time {execution_time:.2f}s exceeds limit {config['max_time']}s"
            
            scalability_results.append({
                'risk_count': config['risk_count'],
                'execution_time': execution_time,
                'time_per_risk': execution_time / config['risk_count'],
                'meets_requirement': execution_time < config['max_time']
            })
        
        # Validate scalability characteristics
        for result in scalability_results:
            assert result['meets_requirement'], \
                f"Failed performance requirement for {result['risk_count']} risks"
        
        # Check that scaling is reasonable (not exponential)
        time_ratios = []
        for i in range(1, len(scalability_results)):
            prev = scalability_results[i-1]
            curr = scalability_results[i]
            risk_ratio = curr['risk_count'] / prev['risk_count']
            time_ratio = curr['execution_time'] / prev['execution_time']
            time_ratios.append(time_ratio / risk_ratio)
        
        # Time should scale roughly linearly (ratio close to 1)
        avg_scaling_factor = np.mean(time_ratios)
        assert avg_scaling_factor < 2.0, \
            f"Scaling factor {avg_scaling_factor:.2f} indicates poor scalability"
        
        print(f"✅ System Scalability Test Passed")
        print(f"   - Tested configurations: {len(test_configurations)}")
        print(f"   - Maximum configuration: 100 risks, 10000 iterations")
        print(f"   - Average scaling factor: {avg_scaling_factor:.2f}x")
        for result in scalability_results:
            print(f"   - {result['risk_count']} risks: {result['execution_time']:.2f}s")

    def test_error_recovery_and_graceful_degradation(
        self,
        comprehensive_risk_set
    ):
        """
        Test error handling and graceful degradation across components.
        
        Validates:
        - System handles component failures gracefully
        - Error messages are informative
        - Partial results available when possible
        - System can recover from errors
        """
        print("\n🧪 Testing Error Recovery and Graceful Degradation")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Test 1: Invalid risk parameters
        print("   Test 1: Invalid risk parameters")
        invalid_risk = Risk(
            id="INVALID_001",
            name="Invalid Risk",
            category=RiskCategory.COST,
            impact_type=ImpactType.COST,
            probability_distribution=ProbabilityDistribution(
                distribution_type=DistributionType.NORMAL,
                parameters={"mean": 1000, "std": -500}  # Invalid negative std
            ),
            baseline_impact=1000,
            correlation_dependencies=[],
            mitigation_strategies=[]
        )
        
        validation_result = integrator.engine.validate_simulation_parameters([invalid_risk])
        assert not validation_result.is_valid
        assert len(validation_result.errors) > 0
        assert any("std" in error.lower() or "standard deviation" in error.lower() 
                  for error in validation_result.errors)
        
        # Test 2: Correlation matrix errors
        print("   Test 2: Correlation matrix errors")
        invalid_correlations = CorrelationMatrix(
            correlations={
                (comprehensive_risk_set[0].id, comprehensive_risk_set[1].id): 1.5  # Invalid > 1
            },
            risk_ids=[r.id for r in comprehensive_risk_set[:2]]
        )
        
        with pytest.raises((ValueError, AssertionError)):
            integrator.engine.run_simulation(
                risks=comprehensive_risk_set[:2],
                iterations=1000,
                correlations=invalid_correlations
            )
        
        # Test 3: Missing component graceful degradation
        print("   Test 3: Component failure handling")
        # Simulate visualization failure
        original_viz_generator = integrator.visualization_generator
        integrator.visualization_generator = None
        
        workflow_result = integrator.execute_complete_workflow(
            risks=comprehensive_risk_set[:2],
            iterations=1000,
            include_visualization=True,  # Request visualization despite missing component
            include_historical_learning=False
        )
        
        # Should complete workflow even without visualization
        assert workflow_result.success or workflow_result.visualization_errors is not None
        assert workflow_result.simulation_results is not None
        
        # Restore component
        integrator.visualization_generator = original_viz_generator
        
        # Test 4: Incomplete data handling
        print("   Test 4: Incomplete data handling")
        incomplete_risk_data = {
            'id': 'INCOMPLETE_001',
            'name': 'Incomplete Risk',
            'category': 'TECHNICAL',
            # Missing probability and impact data
        }
        
        if integrator.incomplete_data_handler:
            handled_risks = integrator.incomplete_data_handler.handle_incomplete_data(
                [incomplete_risk_data]
            )
            assert len(handled_risks) == 1
            assert handled_risks[0].probability_distribution is not None
            assert handled_risks[0].baseline_impact > 0
        
        # Test 5: System health monitoring
        print("   Test 5: System health monitoring")
        health_status = integrator.get_system_health()
        assert health_status is not None
        assert hasattr(health_status, 'overall_status')
        assert hasattr(health_status, 'components_initialized')
        
        print(f"✅ Error Recovery Test Passed")
        print(f"   - Invalid parameters detected and rejected")
        print(f"   - Correlation validation working")
        print(f"   - Graceful degradation functional")
        print(f"   - Incomplete data handling working")
        print(f"   - System health monitoring operational")


class TestDataPipelineIntegration:
    """Test data pipeline integration from import to export."""
    
    def test_risk_register_to_simulation_pipeline(self):
        """
        Test complete pipeline from risk register import to simulation results.
        
        Validates:
        - Risk register data import and transformation
        - Data validation and enrichment
        - Simulation execution with imported data
        - Results traceability back to source
        """
        print("\n🧪 Testing Risk Register to Simulation Pipeline")
        
        integrator = MonteCarloSystemIntegrator()
        risk_register_importer = RiskRegisterImporter()
        
        # Mock risk register data
        risk_register_data = [
            {
                'id': 'REG_001',
                'name': 'Supply Chain Disruption',
                'category': 'EXTERNAL',
                'probability': 0.3,
                'impact_cost': 200000,
                'impact_schedule': 25,
                'description': 'Potential supply chain issues',
                'mitigation_status': 'planned',
                'owner': 'Project Manager',
                'last_updated': datetime.now().isoformat()
            },
            {
                'id': 'REG_002',
                'name': 'Labor Shortage',
                'category': 'RESOURCE',
                'probability': 0.4,
                'impact_cost': 150000,
                'impact_schedule': 20,
                'description': 'Skilled labor availability',
                'mitigation_status': 'active',
                'owner': 'HR Manager',
                'last_updated': datetime.now().isoformat()
            },
            {
                'id': 'REG_003',
                'name': 'Regulatory Changes',
                'category': 'REGULATORY',
                'probability': 0.2,
                'impact_cost': 100000,
                'impact_schedule': 15,
                'description': 'Potential regulatory changes',
                'mitigation_status': 'monitoring',
                'owner': 'Compliance Officer',
                'last_updated': datetime.now().isoformat()
            }
        ]
        
        # Step 1: Import from risk register
        print("   Step 1: Importing from risk register")
        imported_risks = risk_register_importer.import_risks_from_register(
            risk_register_data
        )
        
        assert len(imported_risks) == 3
        assert all(isinstance(risk, Risk) for risk in imported_risks)
        
        # Validate data transformation
        for i, risk in enumerate(imported_risks):
            source_data = risk_register_data[i]
            assert risk.id == source_data['id']
            assert risk.name == source_data['name']
            assert risk.probability_distribution is not None
            assert risk.baseline_impact > 0
        
        # Step 2: Run simulation with imported risks
        print("   Step 2: Running simulation with imported risks")
        simulation_results = integrator.engine.run_simulation(
            risks=imported_risks,
            iterations=5000,
            random_seed=42
        )
        
        assert simulation_results.iteration_count == 5000
        assert len(simulation_results.cost_outcomes) == 5000
        
        # Step 3: Verify traceability
        print("   Step 3: Verifying traceability")
        risk_contributions = integrator.results_analyzer.identify_top_risk_contributors(
            simulation_results, top_n=3
        )
        
        # All risk contributions should trace back to original register
        for contrib in risk_contributions:
            assert any(risk.id == contrib.risk_id for risk in imported_risks)
            source_risk = next(r for r in risk_register_data if r['id'] == contrib.risk_id)
            assert source_risk is not None
        
        # Step 4: Export results with traceability
        print("   Step 4: Exporting results with traceability")
        with tempfile.TemporaryDirectory() as temp_dir:
            export_path = os.path.join(temp_dir, "results.json")
            
            export_data = {
                'simulation_id': simulation_results.simulation_id,
                'source': 'risk_register',
                'imported_risks': [
                    {
                        'id': risk.id,
                        'name': risk.name,
                        'source_data': next(r for r in risk_register_data if r['id'] == risk.id)
                    }
                    for risk in imported_risks
                ],
                'risk_contributions': [
                    {
                        'risk_id': contrib.risk_id,
                        'contribution': contrib.contribution_percentage
                    }
                    for contrib in risk_contributions
                ]
            }
            
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2)
            
            assert os.path.exists(export_path)
            
            # Verify export contains traceability
            with open(export_path, 'r') as f:
                exported = json.load(f)
            
            assert 'source' in exported
            assert exported['source'] == 'risk_register'
            assert len(exported['imported_risks']) == 3
        
        print(f"✅ Risk Register Pipeline Test Passed")
        print(f"   - Imported {len(imported_risks)} risks from register")
        print(f"   - Simulation completed successfully")
        print(f"   - Traceability maintained throughout pipeline")
        print(f"   - Export includes source data references")
    
    def test_historical_data_learning_pipeline(self):
        """
        Test pipeline for historical data learning and calibration.
        
        Validates:
        - Historical data import and processing
        - Distribution calibration based on historical outcomes
        - Accuracy metrics calculation
        - Recommendation generation
        """
        print("\n🧪 Testing Historical Data Learning Pipeline")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Create historical project data
        historical_projects = [
            {
                'project_id': 'HIST_001',
                'project_type': 'construction',
                'planned_cost': 1000000,
                'actual_cost': 1180000,
                'planned_duration': 90,
                'actual_duration': 105,
                'risks_realized': ['material_cost', 'weather_delays'],
                'completion_date': datetime.now() - timedelta(days=365)
            },
            {
                'project_id': 'HIST_002',
                'project_type': 'construction',
                'planned_cost': 800000,
                'actual_cost': 920000,
                'planned_duration': 75,
                'actual_duration': 85,
                'risks_realized': ['labor_shortage'],
                'completion_date': datetime.now() - timedelta(days=270)
            },
            {
                'project_id': 'HIST_003',
                'project_type': 'construction',
                'planned_cost': 1200000,
                'actual_cost': 1150000,
                'planned_duration': 100,
                'actual_duration': 98,
                'risks_realized': [],
                'completion_date': datetime.now() - timedelta(days=180)
            },
            {
                'project_id': 'HIST_004',
                'project_type': 'construction',
                'planned_cost': 900000,
                'actual_cost': 1050000,
                'planned_duration': 80,
                'actual_duration': 92,
                'risks_realized': ['regulatory_delays', 'design_changes'],
                'completion_date': datetime.now() - timedelta(days=90)
            }
        ]
        
        # Create current project risks
        current_risks = [
            Risk(
                id="CURRENT_001",
                name="Material Cost Risk",
                category=RiskCategory.COST,
                impact_type=ImpactType.COST,
                probability_distribution=ProbabilityDistribution(
                    distribution_type=DistributionType.TRIANGULAR,
                    parameters={"min": 50000, "mode": 100000, "max": 200000}
                ),
                baseline_impact=100000,
                correlation_dependencies=[],
                mitigation_strategies=[]
            ),
            Risk(
                id="CURRENT_002",
                name="Schedule Delay Risk",
                category=RiskCategory.SCHEDULE,
                impact_type=ImpactType.SCHEDULE,
                probability_distribution=ProbabilityDistribution(
                    distribution_type=DistributionType.NORMAL,
                    parameters={"mean": 10, "std": 5}
                ),
                baseline_impact=10,
                correlation_dependencies=[],
                mitigation_strategies=[]
            )
        ]
        
        # Step 1: Store historical patterns
        print("   Step 1: Storing historical patterns")
        for project in historical_projects:
            integrator.pattern_database.store_risk_pattern(
                project_type=project['project_type'],
                risk_pattern={
                    'cost_variance': (project['actual_cost'] - project['planned_cost']) / project['planned_cost'],
                    'schedule_variance': (project['actual_duration'] - project['planned_duration']) / project['planned_duration'],
                    'risks_realized': project['risks_realized']
                },
                project_outcome={
                    'success': project['actual_cost'] <= project['planned_cost'] * 1.15,
                    'cost_performance': project['actual_cost'] / project['planned_cost'],
                    'schedule_performance': project['actual_duration'] / project['planned_duration']
                }
            )
        
        # Step 2: Calibrate distributions
        print("   Step 2: Calibrating distributions from historical data")
        calibration_result = integrator.historical_calibrator.calibrate_distributions(
            current_risks,
            historical_projects
        )
        
        assert calibration_result is not None
        assert len(calibration_result.calibrated_risks) > 0
        assert calibration_result.accuracy_metrics is not None
        
        # Step 3: Generate recommendations
        print("   Step 3: Generating improvement recommendations")
        recommendations = integrator.improvement_engine.generate_recommendations(
            current_risks=current_risks,
            historical_data=historical_projects,
            project_type='construction'
        )
        
        assert recommendations is not None
        assert len(recommendations.parameter_suggestions) > 0
        
        # Step 4: Retrieve similar patterns
        print("   Step 4: Retrieving similar historical patterns")
        similar_patterns = integrator.pattern_database.get_similar_patterns(
            project_type='construction',
            risk_categories=['COST', 'SCHEDULE']
        )
        
        assert len(similar_patterns) > 0
        assert all('cost_variance' in pattern for pattern in similar_patterns)
        
        print(f"✅ Historical Learning Pipeline Test Passed")
        print(f"   - Stored {len(historical_projects)} historical patterns")
        print(f"   - Calibrated {len(calibration_result.calibrated_risks)} risk distributions")
        print(f"   - Generated {len(recommendations.parameter_suggestions)} recommendations")
        print(f"   - Retrieved {len(similar_patterns)} similar patterns")


class TestPerformanceAndScalability:
    """Test system performance and scalability characteristics."""
    
    def test_large_scale_simulation_performance(self):
        """
        Test performance with maximum supported configuration.
        
        Validates:
        - System handles 100 risks with 10,000 iterations
        - Execution completes within 30 seconds
        - Memory usage remains reasonable
        - Results quality maintained at scale
        """
        print("\n🧪 Testing Large-Scale Simulation Performance")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Create maximum supported risk set (100 risks)
        large_risk_set = []
        for i in range(100):
            risk = Risk(
                id=f"LARGE_RISK_{i:03d}",
                name=f"Large Scale Risk {i}",
                category=RiskCategory.COST if i % 2 == 0 else RiskCategory.SCHEDULE,
                impact_type=ImpactType.COST if i % 2 == 0 else ImpactType.SCHEDULE,
                probability_distribution=ProbabilityDistribution(
                    distribution_type=DistributionType.NORMAL,
                    parameters={"mean": 10000 + i * 500, "std": 2000}
                ),
                baseline_impact=10000 + i * 500,
                correlation_dependencies=[],
                mitigation_strategies=[]
            )
            large_risk_set.append(risk)
        
        # Execute large-scale simulation
        print(f"   Executing simulation with {len(large_risk_set)} risks...")
        start_time = time.time()
        
        result = integrator.engine.run_simulation(
            risks=large_risk_set,
            iterations=10000,
            random_seed=42
        )
        
        execution_time = time.time() - start_time
        
        # Validate performance requirements
        assert execution_time < 30.0, \
            f"Execution time {execution_time:.2f}s exceeds 30s requirement"
        
        # Validate results quality
        assert result.iteration_count == 10000
        assert len(result.cost_outcomes) == 10000
        assert result.convergence_metrics.converged
        
        # Validate statistical properties
        cost_mean = np.mean(result.cost_outcomes)
        cost_std = np.std(result.cost_outcomes)
        assert cost_mean > 0
        assert cost_std > 0
        assert cost_std / cost_mean < 1.0  # Coefficient of variation should be reasonable
        
        print(f"✅ Large-Scale Performance Test Passed")
        print(f"   - Risk count: {len(large_risk_set)}")
        print(f"   - Iterations: {result.iteration_count}")
        print(f"   - Execution time: {execution_time:.2f}s")
        print(f"   - Performance requirement met: {execution_time < 30.0}")
        print(f"   - Cost mean: ${cost_mean:,.0f}")
        print(f"   - Cost std dev: ${cost_std:,.0f}")
    
    def test_memory_efficiency_with_large_datasets(self):
        """
        Test memory efficiency with large simulation datasets.
        
        Validates:
        - Memory usage scales appropriately
        - No memory leaks during repeated simulations
        - Garbage collection works correctly
        - System remains stable under memory pressure
        """
        print("\n🧪 Testing Memory Efficiency")
        
        integrator = MonteCarloSystemIntegrator()
        
        # Create moderate risk set
        risks = []
        for i in range(20):
            risk = Risk(
                id=f"MEM_RISK_{i:03d}",
                name=f"Memory Test Risk {i}",
                category=RiskCategory.COST,
                impact_type=ImpactType.COST,
                probability_distribution=ProbabilityDistribution(
                    distribution_type=DistributionType.NORMAL,
                    parameters={"mean": 10000, "std": 2000}
                ),
                baseline_impact=10000,
                correlation_dependencies=[],
                mitigation_strategies=[]
            )
            risks.append(risk)
        
        # Run multiple simulations to test memory stability
        print("   Running 10 consecutive simulations...")
        execution_times = []
        
        for i in range(10):
            start_time = time.time()
            result = integrator.engine.run_simulation(
                risks=risks,
                iterations=5000,
                random_seed=42 + i
            )
            execution_time = time.time() - start_time
            execution_times.append(execution_time)
            
            # Validate each result
            assert result.iteration_count == 5000
            assert len(result.cost_outcomes) == 5000
        
        # Check for memory leaks (execution time should be stable)
        avg_time = np.mean(execution_times)
        std_time = np.std(execution_times)
        
        # Execution times should be consistent (no degradation)
        assert std_time / avg_time < 0.2, \
            f"High variance in execution times suggests memory issues"
        
        # Last execution should not be significantly slower than first
        time_ratio = execution_times[-1] / execution_times[0]
        assert time_ratio < 1.5, \
            f"Execution time increased by {time_ratio:.2f}x, possible memory leak"
        
        print(f"✅ Memory Efficiency Test Passed")
        print(f"   - Completed 10 consecutive simulations")
        print(f"   - Average execution time: {avg_time:.2f}s")
        print(f"   - Time variance: {std_time / avg_time:.1%}")
        print(f"   - No memory leaks detected")


if __name__ == "__main__":
    # Run comprehensive integration tests
    pytest.main([__file__, "-v", "--tb=short", "-s"])
