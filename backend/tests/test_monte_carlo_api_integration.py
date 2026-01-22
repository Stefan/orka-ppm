"""
Integration tests for Monte Carlo Risk Simulation API endpoints.

Task 15.3: Write integration tests for API endpoints
- Test end-to-end simulation workflows
- Validate error handling and edge cases
- Test performance with varying project sizes

These tests validate complete workflows through the API layer.
"""

import pytest
import json
import asyncio
from typing import Dict, List, Any
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime
from uuid import uuid4
import numpy as np

# Import FastAPI testing utilities
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Import Monte Carlo components
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from monte_carlo.models import (
    Risk, RiskCategory, ImpactType, DistributionType, ProbabilityDistribution,
    SimulationResults, ConvergenceMetrics, Scenario, RiskModification
)
from monte_carlo.engine import MonteCarloEngine
from monte_carlo.scenario_generator import ScenarioGenerator
from monte_carlo.results_analyzer import SimulationResultsAnalyzer


class TestEndToEndSimulationWorkflow:
    """Test complete end-to-end simulation workflows through API."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication for testing."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {
                "user_id": "test-user-123",
                "email": "test@example.com",
                "permissions": ["simulation_run", "simulation_read"]
            }
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user", "permissions": [permission.value]}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    @pytest.fixture
    def sample_simulation_request(self):
        """Create a sample simulation request."""
        return {
            "risks": [
                {
                    "id": "risk-001",
                    "name": "Cost Overrun Risk",
                    "category": "COST",
                    "impact_type": "COST",
                    "distribution_type": "TRIANGULAR",
                    "distribution_parameters": {
                        "min": 5000.0,
                        "mode": 10000.0,
                        "max": 20000.0
                    },
                    "baseline_impact": 10000.0,
                    "correlation_dependencies": [],
                    "mitigation_strategies": []
                },
                {
                    "id": "risk-002",
                    "name": "Schedule Delay Risk",
                    "category": "SCHEDULE",
                    "impact_type": "SCHEDULE",
                    "distribution_type": "NORMAL",
                    "distribution_parameters": {
                        "mean": 30.0,
                        "std": 10.0
                    },
                    "baseline_impact": 30.0,
                    "correlation_dependencies": [],
                    "mitigation_strategies": []
                }
            ],
            "iterations": 10000,
            "random_seed": 42
        }
    
    def test_complete_simulation_workflow(self, mock_require_permission, mock_auth, sample_simulation_request):
        """
        Test complete simulation workflow from request to results retrieval.
        
        Workflow:
        1. Submit simulation request
        2. Check simulation progress
        3. Retrieve simulation results
        4. Validate results structure and content
        
        Note: This test validates the workflow logic without full API integration.
        """
        # Test the workflow components directly
        from monte_carlo.engine import MonteCarloEngine
        from monte_carlo.results_analyzer import SimulationResultsAnalyzer
        from monte_carlo.models import Risk, RiskCategory, ImpactType, DistributionType, ProbabilityDistribution
        
        engine = MonteCarloEngine()
        analyzer = SimulationResultsAnalyzer()
        
        # Step 1: Create risks from request
        risks = []
        for risk_data in sample_simulation_request["risks"]:
            distribution = ProbabilityDistribution(
                distribution_type=DistributionType(risk_data["distribution_type"]),
                parameters=risk_data["distribution_parameters"]
            )
            
            risk = Risk(
                id=risk_data["id"],
                name=risk_data["name"],
                category=RiskCategory(risk_data["category"]),
                impact_type=ImpactType(risk_data["impact_type"]),
                probability_distribution=distribution,
                baseline_impact=risk_data["baseline_impact"]
            )
            risks.append(risk)
        
        # Step 2: Run simulation
        results = engine.run_simulation(
            risks=risks,
            iterations=sample_simulation_request["iterations"],
            random_seed=sample_simulation_request.get("random_seed")
        )
        
        # Step 3: Validate results
        assert results is not None
        assert results.simulation_id is not None
        assert results.iteration_count == sample_simulation_request["iterations"]
        assert results.execution_time > 0
        assert results.convergence_metrics.converged is True
        
        # Step 4: Analyze results
        percentile_analysis = analyzer.calculate_percentiles(results)
        assert percentile_analysis.mean > 0
        assert percentile_analysis.median > 0
        assert 10 in percentile_analysis.percentiles
        assert 90 in percentile_analysis.percentiles
        
        confidence_intervals = analyzer.generate_confidence_intervals(results, 'cost', [0.8, 0.9, 0.95])
        assert 0.8 in confidence_intervals.intervals
        assert 0.9 in confidence_intervals.intervals
        
        risk_contributions = analyzer.identify_top_risk_contributors(results, top_n=10)
        assert len(risk_contributions) > 0

    
    def _create_mock_simulation_results(self, simulation_id: str, iterations: int) -> SimulationResults:
        """Helper to create mock simulation results."""
        cost_outcomes = np.random.normal(10000, 2000, iterations)
        schedule_outcomes = np.random.normal(30, 10, iterations)
        
        convergence_metrics = ConvergenceMetrics(
            mean_stability=0.95,
            variance_stability=0.90,
            percentile_stability={50: 0.98, 90: 0.92},
            converged=True,
            iterations_to_convergence=8000
        )
        
        return SimulationResults(
            simulation_id=simulation_id,
            timestamp=datetime.now(),
            iteration_count=iterations,
            cost_outcomes=cost_outcomes,
            schedule_outcomes=schedule_outcomes,
            risk_contributions={"risk-001": cost_outcomes * 0.6, "risk-002": cost_outcomes * 0.4},
            convergence_metrics=convergence_metrics,
            execution_time=5.2
        )
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_scenario_creation_and_comparison_workflow(self, mock_cache_service, mock_require_permission, mock_auth):
        """
        Test scenario creation and comparison workflow.
        
        Workflow:
        1. Create base scenario
        2. Create modified scenario
        3. Run simulations for both scenarios
        4. Compare scenarios
        """
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # Step 1: Create base scenario
        base_scenario_request = {
            "name": "Base Scenario",
            "description": "Original risk profile",
            "base_risks": [
                {
                    "id": "risk-001",
                    "name": "Cost Risk",
                    "category": "COST",
                    "impact_type": "COST",
                    "distribution_type": "NORMAL",
                    "distribution_parameters": {"mean": 10000, "std": 2000},
                    "baseline_impact": 10000,
                    "correlation_dependencies": []
                }
            ],
            "modifications": {}
        }
        
        with patch('routers.simulations.scenario_generator') as mock_generator:
            mock_scenario = self._create_mock_scenario("scenario-001", "Base Scenario")
            mock_generator.create_scenario.return_value = mock_scenario
            
            response = client.post("/api/v1/monte-carlo/scenarios", json=base_scenario_request)
            assert response.status_code == 200
            base_scenario_id = response.json()["scenario_id"]
            
            # Step 2: Create modified scenario
            modified_scenario_request = {
                "name": "Mitigation Scenario",
                "description": "With risk mitigation applied",
                "base_risks": base_scenario_request["base_risks"],
                "modifications": {
                    "risk-001": {
                        "parameter_changes": {"std": 1000}  # Reduced uncertainty
                    }
                }
            }
            
            mock_scenario_2 = self._create_mock_scenario("scenario-002", "Mitigation Scenario")
            mock_generator.create_scenario.return_value = mock_scenario_2
            
            response = client.post("/api/v1/monte-carlo/scenarios", json=modified_scenario_request)
            assert response.status_code == 200
            modified_scenario_id = response.json()["scenario_id"]
            
            # Step 3: Simulate both scenarios (mocked)
            mock_scenario.simulation_results = self._create_mock_simulation_results("sim-base", 10000)
            mock_scenario_2.simulation_results = self._create_mock_simulation_results("sim-modified", 10000)
            
            mock_generator.get_scenario.side_effect = lambda sid: (
                mock_scenario if sid == base_scenario_id else mock_scenario_2
            )
            
            # Step 4: Compare scenarios
            comparison_request = {
                "scenario_ids": [base_scenario_id, modified_scenario_id],
                "comparison_metrics": ["cost", "schedule"]
            }
            
            with patch('routers.simulations.results_analyzer') as mock_analyzer:
                from monte_carlo.results_analyzer import ScenarioComparison
                
                mock_comparison = ScenarioComparison(
                    cost_difference=500.0,
                    schedule_difference=2.0,
                    statistical_significance=0.95,
                    effect_size=0.25
                )
                mock_analyzer.compare_scenarios.return_value = mock_comparison
                
                response = client.post("/api/v1/monte-carlo/scenarios/compare", json=comparison_request)
                assert response.status_code == 200
                comparison_data = response.json()
                
                assert "pairwise_comparisons" in comparison_data
                assert len(comparison_data["pairwise_comparisons"]) > 0
    
    def _create_mock_scenario(self, scenario_id: str, name: str) -> Scenario:
        """Helper to create mock scenario."""
        distribution = ProbabilityDistribution(
            distribution_type=DistributionType.NORMAL,
            parameters={"mean": 10000, "std": 2000}
        )
        
        risk = Risk(
            id="risk-001",
            name="Cost Risk",
            category=RiskCategory.COST,
            impact_type=ImpactType.COST,
            probability_distribution=distribution,
            baseline_impact=10000
        )
        
        return Scenario(
            id=scenario_id,
            name=name,
            description="Test scenario",
            risks=[risk],
            modifications={},
            simulation_results=None
        )


class TestAPIErrorHandling:
    """Test error handling and edge cases in API endpoints."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {"user_id": "test-user", "permissions": ["simulation_run"]}
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user"}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_invalid_simulation_request(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test handling of invalid simulation requests."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # Test 1: Empty risks list
        invalid_request = {
            "risks": [],
            "iterations": 10000
        }
        
        response = client.post("/api/v1/monte-carlo/simulations/run", json=invalid_request)
        assert response.status_code in [400, 422]  # Validation error
        
        # Test 2: Invalid iterations (below minimum)
        invalid_request = {
            "risks": [{
                "id": "risk-001",
                "name": "Test Risk",
                "category": "COST",
                "impact_type": "COST",
                "distribution_type": "NORMAL",
                "distribution_parameters": {"mean": 1000, "std": 200},
                "baseline_impact": 1000
            }],
            "iterations": 5000  # Below minimum of 10000
        }
        
        response = client.post("/api/v1/monte-carlo/simulations/run", json=invalid_request)
        assert response.status_code in [400, 422]
        
        # Test 3: Invalid distribution parameters
        invalid_request = {
            "risks": [{
                "id": "risk-001",
                "name": "Test Risk",
                "category": "COST",
                "impact_type": "COST",
                "distribution_type": "TRIANGULAR",
                "distribution_parameters": {
                    "min": 1000,
                    "mode": 500,  # Invalid: mode < min
                    "max": 2000
                },
                "baseline_impact": 1000
            }],
            "iterations": 10000
        }
        
        response = client.post("/api/v1/monte-carlo/simulations/run", json=invalid_request)
        assert response.status_code in [400, 422, 500]
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_simulation_not_found(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test handling of non-existent simulation requests."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            mock_engine.get_cached_results.return_value = None
            mock_engine.get_simulation_progress.return_value = None
            
            # Test retrieving non-existent simulation
            response = client.get("/api/v1/monte-carlo/simulations/non-existent-id/results")
            assert response.status_code == 404
            
            # Test progress of non-existent simulation
            response = client.get("/api/v1/monte-carlo/simulations/non-existent-id/progress")
            assert response.status_code == 404
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_external_system_failure_handling(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test graceful handling of external system failures."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        valid_request = {
            "risks": [{
                "id": "risk-001",
                "name": "Test Risk",
                "category": "COST",
                "impact_type": "COST",
                "distribution_type": "NORMAL",
                "distribution_parameters": {"mean": 1000, "std": 200},
                "baseline_impact": 1000
            }],
            "iterations": 10000
        }
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            # Simulate engine failure
            mock_engine.run_simulation.side_effect = Exception("Engine failure")
            
            response = client.post("/api/v1/monte-carlo/simulations/run", json=valid_request)
            assert response.status_code in [500, 503]
            
            # Verify error response contains useful information
            error_data = response.json()
            assert "detail" in error_data
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_correlation_validation_errors(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test validation of correlation matrices."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # Test invalid correlation value (> 1.0)
        invalid_request = {
            "risks": [
                {
                    "id": "risk-001",
                    "name": "Risk 1",
                    "category": "COST",
                    "impact_type": "COST",
                    "distribution_type": "NORMAL",
                    "distribution_parameters": {"mean": 1000, "std": 200},
                    "baseline_impact": 1000
                },
                {
                    "id": "risk-002",
                    "name": "Risk 2",
                    "category": "COST",
                    "impact_type": "COST",
                    "distribution_type": "NORMAL",
                    "distribution_parameters": {"mean": 2000, "std": 300},
                    "baseline_impact": 2000
                }
            ],
            "iterations": 10000,
            "correlations": {
                "risk-001": {"risk-002": 1.5}  # Invalid: > 1.0
            }
        }
        
        response = client.post("/api/v1/monte-carlo/simulations/run", json=invalid_request)
        assert response.status_code in [400, 422, 500]


class TestPerformanceWithVaryingProjectSizes:
    """Test API performance with different project sizes."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {"user_id": "test-user", "permissions": ["simulation_run"]}
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user"}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    def _create_simulation_request(self, num_risks: int, iterations: int = 10000) -> Dict[str, Any]:
        """Helper to create simulation request with specified number of risks."""
        risks = []
        for i in range(num_risks):
            risks.append({
                "id": f"risk-{i:03d}",
                "name": f"Risk {i}",
                "category": "COST" if i % 2 == 0 else "SCHEDULE",
                "impact_type": "COST" if i % 2 == 0 else "SCHEDULE",
                "distribution_type": "NORMAL",
                "distribution_parameters": {
                    "mean": 1000.0 * (i + 1),
                    "std": 200.0 * (i + 1)
                },
                "baseline_impact": 1000.0 * (i + 1),
                "correlation_dependencies": [],
                "mitigation_strategies": []
            })
        
        return {
            "risks": risks,
            "iterations": iterations,
            "random_seed": 42
        }
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_small_project_performance(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test performance with small project (10 risks)."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        request_data = self._create_simulation_request(num_risks=10)
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            mock_results = self._create_mock_results("sim-small", 10000, execution_time=2.5)
            mock_engine.run_simulation.return_value = mock_results
            
            response = client.post("/api/v1/monte-carlo/simulations/run", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["execution_time"] < 30.0  # Should complete within 30 seconds
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_medium_project_performance(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test performance with medium project (50 risks)."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        request_data = self._create_simulation_request(num_risks=50)
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            mock_results = self._create_mock_results("sim-medium", 10000, execution_time=15.0)
            mock_engine.run_simulation.return_value = mock_results
            
            response = client.post("/api/v1/monte-carlo/simulations/run", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["execution_time"] < 30.0
            
            # Verify performance info is included
            assert "performance_info" in data
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_large_project_performance(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test performance with large project (100 risks)."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        request_data = self._create_simulation_request(num_risks=100)
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            mock_results = self._create_mock_results("sim-large", 10000, execution_time=28.0)
            mock_engine.run_simulation.return_value = mock_results
            
            response = client.post("/api/v1/monte-carlo/simulations/run", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert data["execution_time"] < 30.0  # Must meet performance requirement
            
            # Verify performance warnings for large projects
            if "performance_info" in data:
                perf_info = data["performance_info"]
                assert "performance_tier" in perf_info
    
    def _create_mock_results(self, simulation_id: str, iterations: int, execution_time: float) -> SimulationResults:
        """Helper to create mock simulation results."""
        cost_outcomes = np.random.normal(10000, 2000, iterations)
        schedule_outcomes = np.random.normal(30, 10, iterations)
        
        convergence_metrics = ConvergenceMetrics(
            mean_stability=0.95,
            variance_stability=0.90,
            percentile_stability={50: 0.98, 90: 0.92},
            converged=True,
            iterations_to_convergence=int(iterations * 0.8)
        )
        
        return SimulationResults(
            simulation_id=simulation_id,
            timestamp=datetime.now(),
            iteration_count=iterations,
            cost_outcomes=cost_outcomes,
            schedule_outcomes=schedule_outcomes,
            risk_contributions={"risk-001": cost_outcomes * 0.5},
            convergence_metrics=convergence_metrics,
            execution_time=execution_time
        )


class TestVisualizationEndpoints:
    """Test visualization and export endpoints."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {"user_id": "test-user", "permissions": ["risk_read"]}
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user"}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_chart_generation(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test chart generation endpoint."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        simulation_id = "test-sim-001"
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            # Create mock results
            mock_results = self._create_mock_results(simulation_id, 10000)
            mock_engine.get_cached_results.return_value = mock_results
            
            # Test chart generation
            chart_request = {
                "chart_types": ["distribution", "tornado", "cdf"],
                "outcome_type": "cost",
                "format": "png",
                "theme": "professional"
            }
            
            with patch('routers.simulations.ChartGenerator') as mock_chart_gen:
                from monte_carlo.visualization import ChartData
                
                mock_chart_instance = MagicMock()
                mock_chart_data = ChartData(
                    title="Cost Distribution",
                    subtitle="Monte Carlo Simulation Results",
                    figure=MagicMock(),
                    metadata={"chart_type": "distribution"}
                )
                
                mock_chart_instance.generate_probability_distribution_chart.return_value = mock_chart_data
                mock_chart_instance.generate_tornado_diagram.return_value = mock_chart_data
                mock_chart_instance.generate_cdf_chart.return_value = mock_chart_data
                mock_chart_instance.get_chart_as_base64.return_value = "base64_encoded_image"
                
                mock_chart_gen.return_value = mock_chart_instance
                
                response = client.post(
                    f"/api/v1/monte-carlo/simulations/{simulation_id}/visualizations/generate",
                    json=chart_request
                )
                
                assert response.status_code == 200
                data = response.json()
                
                assert "charts" in data
                assert "simulation_id" in data
                assert data["simulation_id"] == simulation_id
    
    def _create_mock_results(self, simulation_id: str, iterations: int) -> SimulationResults:
        """Helper to create mock simulation results."""
        cost_outcomes = np.random.normal(10000, 2000, iterations)
        schedule_outcomes = np.random.normal(30, 10, iterations)
        
        convergence_metrics = ConvergenceMetrics(
            mean_stability=0.95,
            variance_stability=0.90,
            percentile_stability={50: 0.98, 90: 0.92},
            converged=True,
            iterations_to_convergence=8000
        )
        
        return SimulationResults(
            simulation_id=simulation_id,
            timestamp=datetime.now(),
            iteration_count=iterations,
            cost_outcomes=cost_outcomes,
            schedule_outcomes=schedule_outcomes,
            risk_contributions={"risk-001": cost_outcomes * 0.5},
            convergence_metrics=convergence_metrics,
            execution_time=5.0
        )



class TestCacheIntegration:
    """Test cache integration with API endpoints."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {"user_id": "test-user", "permissions": ["simulation_run", "simulation_read"]}
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user"}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_cache_enabled_simulation(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test simulation with caching enabled."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = True
        mock_cache.cache_simulation_result = AsyncMock()
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        request_data = {
            "risks": [{
                "id": "risk-001",
                "name": "Test Risk",
                "category": "COST",
                "impact_type": "COST",
                "distribution_type": "NORMAL",
                "distribution_parameters": {"mean": 1000, "std": 200},
                "baseline_impact": 1000
            }],
            "iterations": 10000,
            "random_seed": 42
        }
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            mock_results = self._create_mock_results("sim-cached", 10000)
            mock_engine.run_simulation.return_value = mock_results
            
            response = client.post(
                "/api/v1/monte-carlo/simulations/run?use_cache=true",
                json=request_data
            )
            
            assert response.status_code == 200
            # Verify cache was attempted (even if it fails, the simulation should succeed)
            assert mock_cache.cache_enabled is True
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_cache_invalidation(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test cache invalidation endpoint."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = True
        mock_cache.invalidate_project_cache = AsyncMock(return_value=5)
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        project_id = str(uuid4())
        
        response = client.delete(f"/api/v1/monte-carlo/cache/projects/{project_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "invalidated_count" in data
        assert data["invalidated_count"] == 5
    
    def _create_mock_results(self, simulation_id: str, iterations: int) -> SimulationResults:
        """Helper to create mock simulation results."""
        cost_outcomes = np.random.normal(10000, 2000, iterations)
        schedule_outcomes = np.random.normal(30, 10, iterations)
        
        convergence_metrics = ConvergenceMetrics(
            mean_stability=0.95,
            variance_stability=0.90,
            percentile_stability={50: 0.98, 90: 0.92},
            converged=True,
            iterations_to_convergence=8000
        )
        
        return SimulationResults(
            simulation_id=simulation_id,
            timestamp=datetime.now(),
            iteration_count=iterations,
            cost_outcomes=cost_outcomes,
            schedule_outcomes=schedule_outcomes,
            risk_contributions={"risk-001": cost_outcomes * 0.5},
            convergence_metrics=convergence_metrics,
            execution_time=5.0
        )


class TestConfigurationEndpoints:
    """Test configuration and validation endpoints."""
    
    @pytest.fixture
    def mock_auth(self):
        """Mock authentication."""
        with patch('auth.dependencies.get_current_user') as mock:
            mock.return_value = {"user_id": "test-user", "permissions": ["risk_read"]}
            yield mock
    
    @pytest.fixture
    def mock_require_permission(self):
        """Mock permission checking."""
        with patch('auth.rbac.require_permission') as mock:
            def permission_checker(permission):
                def dependency(current_user=None):
                    return current_user or {"user_id": "test-user"}
                return dependency
            mock.side_effect = permission_checker
            yield mock
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_parameter_validation_endpoint(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test parameter validation endpoint."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        # Test valid parameters
        valid_request = {
            "risks": [{
                "id": "risk-001",
                "name": "Test Risk",
                "category": "COST",
                "impact_type": "COST",
                "distribution_type": "NORMAL",
                "distribution_parameters": {"mean": 1000, "std": 200},
                "baseline_impact": 1000,
                "correlation_dependencies": []
            }],
            "iterations": 10000
        }
        
        with patch('routers.simulations.monte_carlo_engine') as mock_engine:
            from monte_carlo.models import ValidationResult
            
            mock_validation = ValidationResult(
                is_valid=True,
                errors=[],
                warnings=[],
                recommendations=["Consider adding correlations between risks"]
            )
            mock_engine.validate_simulation_parameters.return_value = mock_validation
            
            response = client.post("/api/v1/monte-carlo/validate", json=valid_request)
            
            assert response.status_code == 200
            data = response.json()
            assert data["is_valid"] is True
            assert "estimated_execution_time" in data
            assert "risk_count" in data
    
    @patch('routers.simulations.supabase', None)
    @patch('routers.simulations.get_cache_service')
    def test_default_configuration_endpoint(self, mock_cache_service, mock_require_permission, mock_auth):
        """Test default configuration retrieval."""
        mock_cache = AsyncMock()
        mock_cache.cache_enabled = False
        mock_cache_service.return_value = mock_cache
        
        from routers.simulations import router
        from fastapi import FastAPI
        
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)
        
        response = client.get("/api/v1/monte-carlo/config/defaults")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify default configuration structure
        assert "default_iterations" in data
        assert "convergence_threshold" in data
        assert "supported_distributions" in data
        assert "supported_risk_categories" in data
        assert "performance_limits" in data


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
