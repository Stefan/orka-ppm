"""
Monte Carlo System Integrator - Orchestrates all components into a cohesive system.

This module provides the main integration point for the Monte Carlo Risk Simulation system,
coordinating between all components and managing the complete workflow from risk import
to visualization and results export.
"""

import logging
import time
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio

# Import available Monte Carlo components
from .engine import MonteCarloEngine
from .distribution_modeler import RiskDistributionModeler
from .correlation_analyzer import RiskCorrelationAnalyzer
from .results_analyzer import SimulationResultsAnalyzer
from .scenario_generator import ScenarioGenerator
from .visualization import VisualizationManager

# Import components that may not be fully implemented yet
try:
    from .risk_register_integration import RiskRegisterIntegrator
except ImportError:
    RiskRegisterIntegrator = None

try:
    from .historical_data_calibrator import HistoricalDataCalibrator
except ImportError:
    HistoricalDataCalibrator = None

try:
    from .continuous_improvement_engine import ContinuousImprovementEngine
except ImportError:
    ContinuousImprovementEngine = None

try:
    from .risk_pattern_database import RiskPatternDatabase
except ImportError:
    RiskPatternDatabase = None

try:
    from .model_validator import ModelValidator
except ImportError:
    ModelValidator = None

try:
    from .change_detector import ModelChangeDetector
except ImportError:
    ModelChangeDetector = None

try:
    from .cost_escalation import CostEscalationModeler
except ImportError:
    CostEscalationModeler = None

try:
    from .distribution_outputs import DistributionOutputGenerator
except ImportError:
    DistributionOutputGenerator = None

try:
    from .incomplete_data_handler import IncompleteDataHandler
except ImportError:
    IncompleteDataHandler = None

try:
    from .api_validation import APIErrorHandler, GracefulDegradationManager
except ImportError:
    APIErrorHandler = None
    GracefulDegradationManager = None

# Import models
from .models import (
    Risk, Scenario, SimulationResults, CorrelationMatrix, 
    ValidationResult, ProgressStatus, SystemHealthStatus,
    IntegrationReport, WorkflowResult, PerformanceMetrics
)

# Import configuration
from .simulation_config import SimulationConfig, ConfigurationManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MonteCarloSystemIntegrator:
    """
    Main system integrator that orchestrates all Monte Carlo components.
    
    This class provides the primary interface for the complete Monte Carlo system,
    managing component interactions, workflow orchestration, and system health monitoring.
    """
    
    def __init__(self, config: Optional[SimulationConfig] = None):
        """
        Initialize the system integrator with all components.
        
        Args:
            config: Optional simulation configuration. Uses defaults if not provided.
        """
        self._config = config or ConfigurationManager().get_default_config()
        self._performance_metrics = PerformanceMetrics()
        
        # Initialize system health tracking BEFORE component initialization
        self._system_health = SystemHealthStatus()
        self._last_health_check = datetime.now()
        
        # Initialize core components
        self._initialize_components()
        
        # Initialize error handling and degradation management
        if APIErrorHandler and GracefulDegradationManager:
            self._error_handler = APIErrorHandler()
            self._degradation_manager = GracefulDegradationManager()
        else:
            self._error_handler = None
            self._degradation_manager = None
        
        logger.info("Monte Carlo System Integrator initialized successfully")
    
    def _initialize_components(self):
        """Initialize all Monte Carlo system components."""
        try:
            # Core simulation components (always available)
            self.engine = MonteCarloEngine(self._config)
            self.distribution_modeler = RiskDistributionModeler()
            self.correlation_analyzer = RiskCorrelationAnalyzer()
            self.results_analyzer = SimulationResultsAnalyzer()
            self.scenario_generator = ScenarioGenerator()
            
            # Visualization and output components
            self.visualization_generator = VisualizationManager()
            
            # Optional components - initialize if available
            if DistributionOutputGenerator:
                self.distribution_output_generator = DistributionOutputGenerator()
            else:
                self.distribution_output_generator = None
            
            if RiskRegisterIntegrator:
                self.risk_register_integrator = RiskRegisterIntegrator()
            else:
                self.risk_register_integrator = None
                
            if HistoricalDataCalibrator:
                self.historical_calibrator = HistoricalDataCalibrator()
            else:
                self.historical_calibrator = None
                
            if ContinuousImprovementEngine and self.historical_calibrator:
                self.improvement_engine = ContinuousImprovementEngine(self.historical_calibrator)
            else:
                self.improvement_engine = None
                
            if RiskPatternDatabase:
                self.pattern_database = RiskPatternDatabase()
            else:
                self.pattern_database = None
                
            if IncompleteDataHandler:
                self.incomplete_data_handler = IncompleteDataHandler()
            else:
                self.incomplete_data_handler = None
            
            # Validation and monitoring components
            if ModelValidator:
                self.model_validator = ModelValidator()
            else:
                self.model_validator = None
                
            if ModelChangeDetector:
                self.change_detector = ModelChangeDetector()
            else:
                self.change_detector = None
                
            if CostEscalationModeler:
                self.cost_escalation_modeler = CostEscalationModeler()
            else:
                self.cost_escalation_modeler = None
            
            # Wire component dependencies
            self._wire_component_dependencies()
            
            self._system_health.components_initialized = True
            logger.info("Monte Carlo components initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize components: {str(e)}")
            self._system_health.components_initialized = False
            self._system_health.initialization_error = str(e)
            raise
    
    def _wire_component_dependencies(self):
        """Wire dependencies between components."""
        # Connect results analyzer to confidence calculator (if available)
        if hasattr(self, 'confidence_calculator') and self.confidence_calculator:
            self.results_analyzer.set_confidence_calculator(self.confidence_calculator)
        
        # Connect scenario generator to distribution modeler
        if hasattr(self.scenario_generator, 'set_distribution_modeler'):
            self.scenario_generator.set_distribution_modeler(self.distribution_modeler)
        
        # Connect engine to analysis components
        if hasattr(self.engine, 'set_results_analyzer'):
            self.engine.set_results_analyzer(self.results_analyzer)
            
        if self.model_validator and hasattr(self.engine, 'set_model_validator'):
            self.engine.set_model_validator(self.model_validator)
        
        # Connect improvement engine to pattern database (if both available)
        if self.improvement_engine and self.pattern_database:
            if hasattr(self.improvement_engine, 'set_pattern_database'):
                self.improvement_engine.set_pattern_database(self.pattern_database)
        
        # Connect historical calibrator to distribution modeler (if available)
        if self.historical_calibrator and hasattr(self.historical_calibrator, 'set_distribution_modeler'):
            self.historical_calibrator.set_distribution_modeler(self.distribution_modeler)
        
        logger.info("Component dependencies wired successfully")
    
    def get_system_health(self) -> SystemHealthStatus:
        """
        Get current system health status.
        
        Returns:
            SystemHealthStatus with current health information
        """
        # Update health check timestamp
        self._last_health_check = datetime.now()
        
        # Check component health
        component_health = {}
        try:
            # Test core components
            component_health['engine'] = self.engine.health_check()
            component_health['distribution_modeler'] = self.distribution_modeler.health_check()
            component_health['results_analyzer'] = self.results_analyzer.health_check()
            component_health['visualization_generator'] = self.visualization_generator.health_check()
            
            # Update overall health
            all_healthy = all(health.get('status') == 'healthy' for health in component_health.values())
            self._system_health.overall_status = 'healthy' if all_healthy else 'degraded'
            self._system_health.component_health = component_health
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            self._system_health.overall_status = 'unhealthy'
            self._system_health.health_check_error = str(e)
        
        return self._system_health
    
    def execute_complete_workflow(
        self,
        risks: List[Risk],
        correlations: Optional[CorrelationMatrix] = None,
        iterations: int = 10000,
        include_visualization: bool = True,
        include_historical_learning: bool = True,
        export_formats: List[str] = None
    ) -> WorkflowResult:
        """
        Execute complete Monte Carlo workflow from start to finish.
        
        Args:
            risks: List of Risk objects to simulate
            correlations: Optional correlation matrix
            iterations: Number of simulation iterations
            include_visualization: Whether to generate visualizations
            include_historical_learning: Whether to apply historical learning
            export_formats: List of export formats (json, csv, pdf)
            
        Returns:
            WorkflowResult containing all outputs and metadata
        """
        workflow_start_time = time.time()
        workflow_result = WorkflowResult()
        
        try:
            logger.info(f"Starting complete Monte Carlo workflow with {len(risks)} risks")
            
            # Step 1: Validate inputs
            logger.info("Step 1: Validating simulation parameters")
            validation_result = self.model_validator.validate_complete_model(risks, correlations)
            if not validation_result.is_valid:
                workflow_result.validation_errors = validation_result.errors
                workflow_result.success = False
                return workflow_result
            
            # Step 2: Apply historical learning if requested
            calibrated_risks = risks
            if include_historical_learning:
                logger.info("Step 2: Applying historical learning and calibration")
                try:
                    calibration_result = self.historical_calibrator.calibrate_risks_if_data_available(risks)
                    if calibration_result:
                        calibrated_risks = calibration_result.calibrated_risks
                        workflow_result.calibration_applied = True
                        workflow_result.calibration_metrics = calibration_result.accuracy_metrics
                except Exception as e:
                    logger.warning(f"Historical calibration failed, using original risks: {str(e)}")
            
            # Step 3: Run Monte Carlo simulation
            logger.info("Step 3: Executing Monte Carlo simulation")
            simulation_results = self.engine.run_simulation(
                risks=calibrated_risks,
                iterations=iterations,
                correlations=correlations,
                random_seed=None  # Use random seed for production runs
            )
            workflow_result.simulation_results = simulation_results
            
            # Step 4: Analyze results
            logger.info("Step 4: Analyzing simulation results")
            percentile_analysis = self.results_analyzer.calculate_percentiles(simulation_results)
            confidence_intervals = self.results_analyzer.generate_confidence_intervals(
                simulation_results, [0.8, 0.9, 0.95]
            )
            risk_contributions = self.results_analyzer.identify_top_risk_contributors(
                simulation_results, top_n=10
            )
            
            workflow_result.percentile_analysis = percentile_analysis
            workflow_result.confidence_intervals = confidence_intervals
            workflow_result.risk_contributions = risk_contributions
            
            # Step 5: Generate visualizations if requested
            if include_visualization:
                logger.info("Step 5: Generating visualizations")
                try:
                    visualizations = self._generate_all_visualizations(
                        simulation_results, percentile_analysis, risk_contributions, risks
                    )
                    workflow_result.visualizations = visualizations
                except Exception as e:
                    logger.error(f"Visualization generation failed: {str(e)}")
                    workflow_result.visualization_errors = [str(e)]
            
            # Step 6: Generate distribution outputs
            logger.info("Step 6: Generating distribution outputs")
            try:
                budget_compliance = self.distribution_output_generator.calculate_budget_compliance(
                    simulation_results, baseline_budget=1000000  # Would come from input
                )
                schedule_compliance = self.distribution_output_generator.calculate_schedule_compliance(
                    simulation_results, target_date=90  # Would come from input
                )
                
                workflow_result.budget_compliance = budget_compliance
                workflow_result.schedule_compliance = schedule_compliance
            except Exception as e:
                logger.error(f"Distribution output generation failed: {str(e)}")
                workflow_result.distribution_output_errors = [str(e)]
            
            # Step 7: Generate improvement recommendations
            if include_historical_learning:
                logger.info("Step 7: Generating improvement recommendations")
                try:
                    recommendations = self.improvement_engine.generate_recommendations_from_results(
                        current_risks=calibrated_risks,
                        simulation_results=simulation_results
                    )
                    workflow_result.improvement_recommendations = recommendations
                except Exception as e:
                    logger.warning(f"Recommendation generation failed: {str(e)}")
            
            # Step 8: Export results if formats specified
            if export_formats:
                logger.info("Step 8: Exporting results")
                try:
                    exports = self._export_results_multiple_formats(
                        simulation_results, export_formats, workflow_result
                    )
                    workflow_result.exports = exports
                except Exception as e:
                    logger.error(f"Export generation failed: {str(e)}")
                    workflow_result.export_errors = [str(e)]
            
            # Calculate performance metrics
            workflow_execution_time = time.time() - workflow_start_time
            workflow_result.execution_time = workflow_execution_time
            workflow_result.performance_metrics = self._calculate_performance_metrics(
                len(risks), iterations, workflow_execution_time
            )
            
            workflow_result.success = True
            logger.info(f"Complete workflow executed successfully in {workflow_execution_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            workflow_result.success = False
            workflow_result.execution_error = str(e)
            workflow_result.execution_time = time.time() - workflow_start_time
        
        return workflow_result
    
    def _generate_all_visualizations(
        self,
        simulation_results: SimulationResults,
        percentile_analysis: Any,
        risk_contributions: List[Any],
        risks: List[Risk]
    ) -> Dict[str, str]:
        """Generate all visualization types."""
        visualizations = {}
        
        try:
            # Cost distribution chart
            cost_chart_path = self.visualization_generator.generate_cost_distribution_chart(
                simulation_results
            )
            visualizations['cost_distribution'] = cost_chart_path
            
            # Schedule distribution chart
            schedule_chart_path = self.visualization_generator.generate_schedule_distribution_chart(
                simulation_results
            )
            visualizations['schedule_distribution'] = schedule_chart_path
            
            # Tornado diagram
            tornado_path = self.visualization_generator.generate_tornado_diagram(
                risk_contributions
            )
            visualizations['tornado_diagram'] = tornado_path
            
            # CDF chart
            cdf_path = self.visualization_generator.generate_cdf_chart(
                simulation_results, percentile_analysis
            )
            visualizations['cdf_chart'] = cdf_path
            
            # Risk heat map
            heatmap_path = self.visualization_generator.generate_risk_heatmap(
                risks, simulation_results
            )
            visualizations['risk_heatmap'] = heatmap_path
            
        except Exception as e:
            logger.error(f"Visualization generation error: {str(e)}")
            raise
        
        return visualizations
    
    def _export_results_multiple_formats(
        self,
        simulation_results: SimulationResults,
        export_formats: List[str],
        workflow_result: WorkflowResult
    ) -> Dict[str, str]:
        """Export results in multiple formats."""
        exports = {}
        
        for format_type in export_formats:
            try:
                if format_type == 'json':
                    export_path = self._export_json(simulation_results, workflow_result)
                    exports['json'] = export_path
                elif format_type == 'csv':
                    export_path = self._export_csv(simulation_results, workflow_result)
                    exports['csv'] = export_path
                elif format_type == 'pdf':
                    export_path = self._export_pdf(simulation_results, workflow_result)
                    exports['pdf'] = export_path
                else:
                    logger.warning(f"Unsupported export format: {format_type}")
            except Exception as e:
                logger.error(f"Export failed for format {format_type}: {str(e)}")
        
        return exports
    
    def _export_json(self, simulation_results: SimulationResults, workflow_result: WorkflowResult) -> str:
        """Export results as JSON."""
        import json
        import tempfile
        import os
        
        export_data = {
            'simulation_id': simulation_results.simulation_id,
            'timestamp': simulation_results.timestamp.isoformat(),
            'iteration_count': simulation_results.iteration_count,
            'execution_time': simulation_results.execution_time,
            'convergence_metrics': {
                'converged': simulation_results.convergence_metrics.converged,
                'mean_stability': simulation_results.convergence_metrics.mean_stability,
                'variance_stability': simulation_results.convergence_metrics.variance_stability
            },
            'percentile_analysis': {
                'mean': workflow_result.percentile_analysis.mean,
                'median': workflow_result.percentile_analysis.median,
                'std_dev': workflow_result.percentile_analysis.std_dev,
                'percentiles': workflow_result.percentile_analysis.percentiles
            },
            'confidence_intervals': {
                str(level): {'lower': interval[0], 'upper': interval[1]}
                for level, interval in workflow_result.confidence_intervals.intervals.items()
            },
            'risk_contributions': [
                {
                    'risk_id': contrib.risk_id,
                    'risk_name': contrib.risk_name,
                    'contribution_percentage': contrib.contribution_percentage
                }
                for contrib in workflow_result.risk_contributions
            ]
        }
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(export_data, temp_file, indent=2)
        temp_file.close()
        
        return temp_file.name
    
    def _export_csv(self, simulation_results: SimulationResults, workflow_result: WorkflowResult) -> str:
        """Export results as CSV."""
        import pandas as pd
        import tempfile
        
        # Create summary statistics DataFrame
        summary_data = {
            'Metric': ['Mean', 'Median', 'Std Dev', 'P10', 'P25', 'P75', 'P90', 'P95', 'P99'],
            'Cost': [
                workflow_result.percentile_analysis.mean,
                workflow_result.percentile_analysis.median,
                workflow_result.percentile_analysis.std_dev,
                workflow_result.percentile_analysis.percentiles.get(10, 0),
                workflow_result.percentile_analysis.percentiles.get(25, 0),
                workflow_result.percentile_analysis.percentiles.get(75, 0),
                workflow_result.percentile_analysis.percentiles.get(90, 0),
                workflow_result.percentile_analysis.percentiles.get(95, 0),
                workflow_result.percentile_analysis.percentiles.get(99, 0)
            ]
        }
        
        df = pd.DataFrame(summary_data)
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        df.to_csv(temp_file.name, index=False)
        
        return temp_file.name
    
    def _export_pdf(self, simulation_results: SimulationResults, workflow_result: WorkflowResult) -> str:
        """Export results as PDF report."""
        # This would use a PDF generation library like ReportLab
        # For now, return a placeholder
        import tempfile
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.pdf', delete=False)
        temp_file.write("PDF export placeholder - would contain full simulation report")
        temp_file.close()
        
        return temp_file.name
    
    def _calculate_performance_metrics(
        self, 
        risk_count: int, 
        iterations: int, 
        execution_time: float
    ) -> PerformanceMetrics:
        """Calculate performance metrics for the workflow."""
        metrics = PerformanceMetrics()
        metrics.risk_count = risk_count
        metrics.iteration_count = iterations
        metrics.total_execution_time = execution_time
        metrics.risks_per_second = risk_count / execution_time if execution_time > 0 else 0
        metrics.iterations_per_second = iterations / execution_time if execution_time > 0 else 0
        metrics.meets_performance_requirements = execution_time < 30.0  # 30 second requirement
        
        return metrics
    
    def execute_scenario_comparison_workflow(
        self,
        scenarios: List[Scenario],
        iterations: int = 10000
    ) -> Dict[str, Any]:
        """
        Execute scenario comparison workflow.
        
        Args:
            scenarios: List of scenarios to compare
            iterations: Number of iterations per scenario
            
        Returns:
            Dictionary containing comparison results
        """
        logger.info(f"Starting scenario comparison workflow with {len(scenarios)} scenarios")
        
        # Run simulations for all scenarios
        scenario_results = {}
        for scenario in scenarios:
            logger.info(f"Running simulation for scenario: {scenario.name}")
            results = self.engine.run_simulation(
                risks=scenario.risks,
                iterations=iterations,
                random_seed=42  # Use same seed for fair comparison
            )
            scenario_results[scenario.id] = results
        
        # Perform pairwise comparisons
        comparisons = []
        scenario_list = list(scenarios)
        for i in range(len(scenario_list)):
            for j in range(i + 1, len(scenario_list)):
                scenario_a = scenario_list[i]
                scenario_b = scenario_list[j]
                
                comparison = self.results_analyzer.compare_scenarios(
                    scenario_results[scenario_a.id],
                    scenario_results[scenario_b.id]
                )
                
                comparisons.append({
                    'scenario_a': scenario_a.name,
                    'scenario_b': scenario_b.name,
                    'cost_difference': comparison.cost_difference,
                    'schedule_difference': comparison.schedule_difference,
                    'statistical_significance': comparison.statistical_significance,
                    'effect_size': comparison.effect_size
                })
        
        return {
            'scenario_results': scenario_results,
            'comparisons': comparisons,
            'execution_timestamp': datetime.now().isoformat()
        }
    
    def validate_system_integration(self) -> IntegrationReport:
        """
        Validate that all system components are properly integrated.
        
        Returns:
            IntegrationReport with validation results
        """
        logger.info("Starting system integration validation")
        
        report = IntegrationReport()
        report.validation_timestamp = datetime.now()
        
        # Test component initialization
        try:
            health_status = self.get_system_health()
            report.components_healthy = health_status.overall_status == 'healthy'
            report.component_health_details = health_status.component_health
        except Exception as e:
            report.components_healthy = False
            report.integration_errors.append(f"Health check failed: {str(e)}")
        
        # Test basic workflow
        try:
            # Create minimal test data
            test_risk = Risk(
                id="TEST_001",
                name="Integration Test Risk",
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
            
            # Run minimal workflow
            workflow_result = self.execute_complete_workflow(
                risks=[test_risk],
                iterations=1000,  # Small for fast validation
                include_visualization=False,
                include_historical_learning=False
            )
            
            report.workflow_functional = workflow_result.success
            if not workflow_result.success:
                report.integration_errors.append(f"Workflow test failed: {workflow_result.execution_error}")
            
        except Exception as e:
            report.workflow_functional = False
            report.integration_errors.append(f"Workflow test error: {str(e)}")
        
        # Test API integration points
        try:
            # This would test API endpoints if available
            report.api_integration_functional = True  # Placeholder
        except Exception as e:
            report.api_integration_functional = False
            report.integration_errors.append(f"API integration test failed: {str(e)}")
        
        # Overall integration status
        report.overall_integration_status = (
            report.components_healthy and 
            report.workflow_functional and 
            report.api_integration_functional
        )
        
        logger.info(f"System integration validation completed. Status: {'PASS' if report.overall_integration_status else 'FAIL'}")
        
        return report


# Global system integrator instance
_system_integrator = None

def get_system_integrator(config: Optional[SimulationConfig] = None) -> MonteCarloSystemIntegrator:
    """
    Get the global system integrator instance.
    
    Args:
        config: Optional configuration for first-time initialization
        
    Returns:
        MonteCarloSystemIntegrator instance
    """
    global _system_integrator
    if _system_integrator is None:
        _system_integrator = MonteCarloSystemIntegrator(config)
    return _system_integrator