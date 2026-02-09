"""
Visualization and Results Presentation - Chart generation system for Monte Carlo simulation results.

This module provides comprehensive visualization capabilities for Monte Carlo simulation results,
including probability distribution charts, tornado diagrams, CDF charts, risk heat maps,
and scenario overlay charts.
"""

import io
import base64
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
from enum import Enum
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.colors import LinearSegmentedColormap
import seaborn as sns
from scipy import stats
import pandas as pd

from .models import (
    SimulationResults, PercentileAnalysis, RiskContribution, 
    ScenarioComparison, Risk, DistributionType
)
from .results_analyzer import SimulationResultsAnalyzer


class ChartFormat(Enum):
    """Supported chart output formats."""
    PNG = "png"
    PDF = "pdf"
    SVG = "svg"
    HTML = "html"


class ChartTheme(Enum):
    """Chart visual themes."""
    DEFAULT = "default"
    PROFESSIONAL = "professional"
    PRESENTATION = "presentation"
    COLORBLIND_FRIENDLY = "colorblind_friendly"


@dataclass
class ChartConfig:
    """Configuration for chart generation."""
    format: ChartFormat = ChartFormat.PNG
    theme: ChartTheme = ChartTheme.PROFESSIONAL
    width: int = 12
    height: int = 8
    dpi: int = 300
    font_size: int = 10
    title_font_size: int = 14
    show_grid: bool = True
    show_legend: bool = True
    color_palette: Optional[List[str]] = None
    
    def __post_init__(self):
        """Set default color palette based on theme."""
        if self.color_palette is None:
            if self.theme == ChartTheme.COLORBLIND_FRIENDLY:
                self.color_palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b']
            elif self.theme == ChartTheme.PRESENTATION:
                self.color_palette = ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#592E83', '#1B998B']
            else:
                self.color_palette = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#34495e']


@dataclass
class ChartData:
    """Container for chart data and metadata."""
    data: Any
    title: str
    subtitle: Optional[str] = None
    x_label: str = ""
    y_label: str = ""
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ChartGenerator:
    """
    Core chart generation system for Monte Carlo simulation visualization.
    
    Provides methods to generate all required chart types:
    - Probability distribution charts for cost and schedule
    - Tornado diagrams for risk contributions
    - CDF charts with percentile markers
    - Risk heat maps
    - Scenario overlay charts
    """
    
    def __init__(self, config: Optional[ChartConfig] = None):
        """
        Initialize the chart generator with configuration.
        
        Args:
            config: Optional ChartConfig. If None, uses default configuration.
        """
        self.config = config or ChartConfig()
        self.results_analyzer = SimulationResultsAnalyzer()
        
        # Set up matplotlib style based on theme
        self._setup_matplotlib_style()
    
    def _setup_matplotlib_style(self):
        """Set up matplotlib style based on configuration theme."""
        plt.style.use('default')
        
        # Set font sizes
        plt.rcParams['font.size'] = self.config.font_size
        plt.rcParams['axes.titlesize'] = self.config.title_font_size
        plt.rcParams['axes.labelsize'] = self.config.font_size
        plt.rcParams['xtick.labelsize'] = self.config.font_size - 1
        plt.rcParams['ytick.labelsize'] = self.config.font_size - 1
        plt.rcParams['legend.fontsize'] = self.config.font_size - 1
        
        # Set grid style
        plt.rcParams['axes.grid'] = self.config.show_grid
        plt.rcParams['grid.alpha'] = 0.3
        
        # Set figure DPI
        plt.rcParams['figure.dpi'] = self.config.dpi
        
        # Theme-specific styling
        if self.config.theme == ChartTheme.PROFESSIONAL:
            plt.rcParams['axes.spines.top'] = False
            plt.rcParams['axes.spines.right'] = False
            plt.rcParams['axes.linewidth'] = 0.8
        elif self.config.theme == ChartTheme.PRESENTATION:
            plt.rcParams['axes.facecolor'] = '#f8f9fa'
            plt.rcParams['figure.facecolor'] = 'white'
    
    def generate_probability_distribution_chart(
        self,
        simulation_results: SimulationResults,
        outcome_type: str = 'cost',
        show_percentiles: bool = True,
        percentiles: Optional[List[float]] = None
    ) -> ChartData:
        """
        Generate probability distribution charts for cost and schedule outcomes.
        
        Implements Requirements 8.1: Display probability distribution charts for cost and schedule outcomes.
        
        Args:
            simulation_results: Results from Monte Carlo simulation
            outcome_type: 'cost' or 'schedule' to specify which outcomes to visualize
            show_percentiles: Whether to show percentile markers
            percentiles: List of percentiles to mark (defaults to [10, 25, 50, 75, 90, 95])
            
        Returns:
            ChartData containing the generated chart and metadata
            
        Raises:
            ValueError: If outcome_type is not 'cost' or 'schedule'
        """
        if outcome_type not in ['cost', 'schedule']:
            raise ValueError("outcome_type must be 'cost' or 'schedule'")
        
        # Get outcome data
        if outcome_type == 'cost':
            data = simulation_results.cost_outcomes
            unit = '$'
            title = 'Cost Risk Distribution'
        else:
            data = simulation_results.schedule_outcomes
            unit = 'days'
            title = 'Schedule Risk Distribution'
        
        # Set default percentiles
        if percentiles is None:
            percentiles = [10, 25, 50, 75, 90, 95]
        
        # Create figure
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(self.config.width, self.config.height), 
                                       height_ratios=[3, 1])
        
        # Main distribution plot (histogram + KDE)
        ax1.hist(data, bins=50, density=True, alpha=0.7, color=self.config.color_palette[0], 
                edgecolor='white', linewidth=0.5)
        
        # Add kernel density estimation (handle singular data)
        try:
            kde_x = np.linspace(data.min(), data.max(), 200)
            kde = stats.gaussian_kde(data)
            kde_y = kde(kde_x)
            ax1.plot(kde_x, kde_y, color=self.config.color_palette[1], linewidth=2, label='Probability Density')
        except np.linalg.LinAlgError:
            # Handle case where all data points are identical (singular covariance)
            # Skip KDE and just show the histogram
            pass
        
        # Add percentile markers if requested
        if show_percentiles:
            percentile_values = np.percentile(data, percentiles)
            colors = plt.cm.viridis(np.linspace(0, 1, len(percentiles)))
            
            for i, (p, value) in enumerate(zip(percentiles, percentile_values)):
                ax1.axvline(value, color=colors[i], linestyle='--', alpha=0.8, linewidth=1.5)
                ax1.text(value, ax1.get_ylim()[1] * 0.9, f'P{p}', 
                        rotation=90, ha='right', va='top', fontsize=8, color=colors[i])
        
        # Add mean and median lines
        mean_val = np.mean(data)
        median_val = np.median(data)
        ax1.axvline(mean_val, color='red', linestyle='-', alpha=0.8, linewidth=2, label=f'Mean: {mean_val:.0f}{unit}')
        ax1.axvline(median_val, color='orange', linestyle='-', alpha=0.8, linewidth=2, label=f'Median: {median_val:.0f}{unit}')
        
        # Formatting
        ax1.set_title(title, fontsize=self.config.title_font_size, fontweight='bold', pad=20)
        ax1.set_xlabel(f'{outcome_type.capitalize()} ({unit})')
        ax1.set_ylabel('Probability Density')
        if self.config.show_legend:
            ax1.legend(loc='upper right')
        
        # Box plot for additional insight
        box_plot = ax2.boxplot(data, vert=False, patch_artist=True, 
                              boxprops=dict(facecolor=self.config.color_palette[0], alpha=0.7),
                              medianprops=dict(color='orange', linewidth=2))
        ax2.set_xlabel(f'{outcome_type.capitalize()} ({unit})')
        ax2.set_yticks([])
        ax2.set_title('Distribution Summary', fontsize=self.config.font_size + 1)
        
        # Add statistical summary text
        stats_text = (
            f'Mean: {mean_val:.0f}{unit}\n'
            f'Median: {median_val:.0f}{unit}\n'
            f'Std Dev: {np.std(data):.0f}{unit}\n'
            f'Range: {data.min():.0f} - {data.max():.0f}{unit}'
        )
        ax2.text(0.02, 0.98, stats_text, transform=ax2.transAxes, fontsize=8,
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        plt.tight_layout()
        
        # Create chart data
        chart_data = ChartData(
            data=fig,
            title=title,
            subtitle=f'Distribution of {outcome_type} outcomes from {simulation_results.iteration_count:,} iterations',
            x_label=f'{outcome_type.capitalize()} ({unit})',
            y_label='Probability Density',
            metadata={
                'outcome_type': outcome_type,
                'mean': mean_val,
                'median': median_val,
                'std_dev': np.std(data),
                'percentiles': dict(zip(percentiles, percentile_values)) if show_percentiles else {},
                'iteration_count': simulation_results.iteration_count
            }
        )
        
        return chart_data
    
    def generate_tornado_diagram(
        self,
        simulation_results: SimulationResults,
        top_n: int = 10,
        outcome_type: str = 'cost'
    ) -> ChartData:
        """
        Generate tornado diagrams for risk contributions.
        
        Implements Requirements 8.2: Use tornado diagrams to display individual risk contributions.
        
        Args:
            simulation_results: Results from Monte Carlo simulation
            top_n: Number of top risk contributors to display
            outcome_type: 'cost' or 'schedule' to specify which outcomes to analyze
            
        Returns:
            ChartData containing the tornado diagram and metadata
        """
        # Validate outcome type first
        if outcome_type not in ['cost', 'schedule']:
            raise ValueError("outcome_type must be 'cost' or 'schedule'")
        
        # Get risk contributions
        risk_contributions = self.results_analyzer.identify_top_risk_contributors(
            simulation_results, top_n=top_n
        )
        
        if not risk_contributions:
            raise ValueError("No risk contributions found in simulation results")
        
        # Prepare data for tornado diagram
        risk_names = [rc.risk_name for rc in risk_contributions]
        contributions = [rc.contribution_percentage for rc in risk_contributions]
        
        # Create figure
        fig, ax = plt.subplots(figsize=(self.config.width, max(6, len(risk_names) * 0.5)))
        
        # Create horizontal bar chart (tornado style)
        y_positions = np.arange(len(risk_names))
        colors = plt.cm.RdYlBu_r(np.linspace(0.2, 0.8, len(risk_names)))
        
        bars = ax.barh(y_positions, contributions, color=colors, alpha=0.8, edgecolor='white', linewidth=0.5)
        
        # Add value labels on bars
        for i, (bar, contribution) in enumerate(zip(bars, contributions)):
            width = bar.get_width()
            ax.text(width + max(contributions) * 0.01, bar.get_y() + bar.get_height()/2, 
                   f'{contribution:.1f}%', ha='left', va='center', fontweight='bold', fontsize=9)
        
        # Formatting
        ax.set_yticks(y_positions)
        ax.set_yticklabels(risk_names)
        ax.set_xlabel('Contribution to Total Variance (%)')
        ax.set_title(f'Top {len(risk_names)} Risk Contributors - {outcome_type.capitalize()} Impact', 
                    fontsize=self.config.title_font_size, fontweight='bold', pad=20)
        
        # Add grid for better readability
        ax.grid(axis='x', alpha=0.3)
        ax.set_axisbelow(True)
        
        # Invert y-axis to show highest contributor at top
        ax.invert_yaxis()
        
        # Add total contribution text
        total_contribution = sum(contributions)
        ax.text(0.98, 0.02, f'Total shown: {total_contribution:.1f}%', 
               transform=ax.transAxes, ha='right', va='bottom',
               bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8))
        
        plt.tight_layout()
        
        # Create chart data
        chart_data = ChartData(
            data=fig,
            title=f'Risk Contribution Analysis - {outcome_type.capitalize()}',
            subtitle=f'Top {len(risk_names)} contributors to {outcome_type} uncertainty',
            x_label='Contribution to Total Variance (%)',
            y_label='Risk Factors',
            metadata={
                'outcome_type': outcome_type,
                'top_n': top_n,
                'risk_contributions': {rc.risk_name: rc.contribution_percentage for rc in risk_contributions},
                'total_contribution': total_contribution,
                'correlation_effects': {rc.risk_name: rc.correlation_effects for rc in risk_contributions}
            }
        )
        
        return chart_data
    
    def generate_cdf_chart(
        self,
        simulation_results: SimulationResults,
        outcome_type: str = 'cost',
        percentile_markers: Optional[List[float]] = None,
        confidence_levels: Optional[List[float]] = None
    ) -> ChartData:
        """
        Generate cumulative distribution function (CDF) charts with percentile markers.
        
        Implements Requirements 8.3: Provide cumulative distribution function (CDF) charts 
        with key percentile markers.
        
        Args:
            simulation_results: Results from Monte Carlo simulation
            outcome_type: 'cost' or 'schedule' to specify which outcomes to visualize
            percentile_markers: List of percentiles to mark (defaults to [10, 25, 50, 75, 90, 95, 99])
            confidence_levels: List of confidence levels to highlight (defaults to [80, 90, 95])
            
        Returns:
            ChartData containing the CDF chart and metadata
        """
        if outcome_type not in ['cost', 'schedule']:
            raise ValueError("outcome_type must be 'cost' or 'schedule'")
        
        # Get outcome data
        if outcome_type == 'cost':
            data = simulation_results.cost_outcomes
            unit = '$'
            title = 'Cost Risk Cumulative Distribution'
        else:
            data = simulation_results.schedule_outcomes
            unit = 'days'
            title = 'Schedule Risk Cumulative Distribution'
        
        # Set defaults
        if percentile_markers is None:
            percentile_markers = [10, 25, 50, 75, 90, 95, 99]
        if confidence_levels is None:
            confidence_levels = [80, 90, 95]
        
        # Sort data for CDF
        sorted_data = np.sort(data)
        n = len(sorted_data)
        y_values = np.arange(1, n + 1) / n * 100  # Convert to percentages
        
        # Create figure
        fig, ax = plt.subplots(figsize=(self.config.width, self.config.height))
        
        # Plot CDF
        ax.plot(sorted_data, y_values, color=self.config.color_palette[0], linewidth=2, label='Cumulative Probability')
        
        # Add percentile markers
        percentile_values = np.percentile(data, percentile_markers)
        colors = plt.cm.viridis(np.linspace(0, 1, len(percentile_markers)))
        
        for i, (p, value) in enumerate(zip(percentile_markers, percentile_values)):
            ax.axvline(value, color=colors[i], linestyle='--', alpha=0.7, linewidth=1.5)
            ax.axhline(p, color=colors[i], linestyle='--', alpha=0.7, linewidth=1.5)
            
            # Add marker point
            ax.plot(value, p, 'o', color=colors[i], markersize=6, markeredgecolor='white', markeredgewidth=1)
            
            # Add text label
            ax.annotate(f'P{p}: {value:.0f}{unit}', 
                       xy=(value, p), xytext=(10, 10), textcoords='offset points',
                       fontsize=8, ha='left', va='bottom',
                       bbox=dict(boxstyle='round,pad=0.3', facecolor=colors[i], alpha=0.7))
        
        # Highlight confidence intervals
        for i, conf_level in enumerate(confidence_levels):
            alpha = (100 - conf_level) / 2
            lower_bound = np.percentile(data, alpha)
            upper_bound = np.percentile(data, 100 - alpha)
            
            # Add shaded region
            ax.axvspan(lower_bound, upper_bound, alpha=0.1, 
                      color=self.config.color_palette[i + 1], 
                      label=f'{conf_level}% Confidence Interval')
        
        # Formatting
        ax.set_title(title, fontsize=self.config.title_font_size, fontweight='bold', pad=20)
        ax.set_xlabel(f'{outcome_type.capitalize()} ({unit})')
        ax.set_ylabel('Cumulative Probability (%)')
        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3)
        
        if self.config.show_legend:
            ax.legend(loc='lower right')
        
        # Add statistical summary
        mean_val = np.mean(data)
        median_val = np.median(data)
        ax.axvline(mean_val, color='red', linestyle='-', alpha=0.8, linewidth=2, label=f'Mean: {mean_val:.0f}{unit}')
        ax.axvline(median_val, color='orange', linestyle='-', alpha=0.8, linewidth=2, label=f'Median: {median_val:.0f}{unit}')
        
        plt.tight_layout()
        
        # Create chart data
        chart_data = ChartData(
            data=fig,
            title=title,
            subtitle=f'Cumulative probability distribution showing likelihood of {outcome_type} outcomes',
            x_label=f'{outcome_type.capitalize()} ({unit})',
            y_label='Cumulative Probability (%)',
            metadata={
                'outcome_type': outcome_type,
                'percentile_markers': dict(zip(percentile_markers, percentile_values)),
                'confidence_intervals': {
                    f'{cl}%': (np.percentile(data, (100-cl)/2), np.percentile(data, 100-(100-cl)/2))
                    for cl in confidence_levels
                },
                'mean': mean_val,
                'median': median_val,
                'iteration_count': simulation_results.iteration_count
            }
        )
        
        return chart_data
    
    def generate_risk_heat_map(
        self,
        risks: List[Risk],
        simulation_results: SimulationResults,
        impact_threshold: float = 1000,
        probability_threshold: float = 0.5
    ) -> ChartData:
        """
        Generate risk heat maps showing probability vs. impact for all simulated risks.
        
        Implements Requirements 8.4: Generate risk heat maps showing probability vs. impact 
        for all simulated risks.
        
        Args:
            risks: List of Risk objects that were simulated
            simulation_results: Results from Monte Carlo simulation
            impact_threshold: Threshold for high impact classification
            probability_threshold: Threshold for high probability classification
            
        Returns:
            ChartData containing the risk heat map and metadata
        """
        if not risks or not simulation_results.risk_contributions:
            raise ValueError("Risks and risk contributions are required for heat map generation")
        
        # Prepare data for heat map
        risk_data = []
        
        for risk in risks:
            if risk.id in simulation_results.risk_contributions:
                contributions = simulation_results.risk_contributions[risk.id]
                
                # Calculate impact metrics
                mean_impact = np.mean(np.abs(contributions))
                max_impact = np.max(np.abs(contributions))
                impact_variance = np.var(contributions)
                
                # Estimate probability (simplified - could be enhanced with actual probability data)
                # For now, use the coefficient of variation as a proxy for probability variability
                cv = np.std(contributions) / max(np.mean(np.abs(contributions)), 0.001)
                estimated_probability = min(1.0, max(0.1, 1.0 - cv))  # Higher CV = lower consistent probability
                
                risk_data.append({
                    'id': risk.id,
                    'name': risk.name,
                    'category': risk.category.value,
                    'impact_type': risk.impact_type.value,
                    'mean_impact': mean_impact,
                    'max_impact': max_impact,
                    'estimated_probability': estimated_probability,
                    'impact_variance': impact_variance
                })
        
        if not risk_data:
            raise ValueError("No valid risk data found for heat map generation")
        
        # Create figure
        fig, ax = plt.subplots(figsize=(self.config.width, self.config.height))
        
        # Extract data for plotting
        probabilities = [rd['estimated_probability'] for rd in risk_data]
        impacts = [rd['mean_impact'] for rd in risk_data]
        risk_names = [rd['name'] for rd in risk_data]
        categories = [rd['category'] for rd in risk_data]
        
        # Create color map based on categories
        unique_categories = list(set(categories))
        category_colors = dict(zip(unique_categories, self.config.color_palette[:len(unique_categories)]))
        colors = [category_colors[cat] for cat in categories]
        
        # Create scatter plot
        scatter = ax.scatter(impacts, probabilities, c=colors, s=100, alpha=0.7, 
                           edgecolors='white', linewidth=1)
        
        # Add risk labels
        for i, (impact, prob, name) in enumerate(zip(impacts, probabilities, risk_names)):
            ax.annotate(name, (impact, prob), xytext=(5, 5), textcoords='offset points',
                       fontsize=8, ha='left', va='bottom',
                       bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.8))
        
        # Add threshold lines
        ax.axvline(impact_threshold, color='red', linestyle='--', alpha=0.7, linewidth=2, 
                  label=f'High Impact Threshold: {impact_threshold}')
        ax.axhline(probability_threshold, color='orange', linestyle='--', alpha=0.7, linewidth=2,
                  label=f'High Probability Threshold: {probability_threshold}')
        
        # Add quadrant labels
        ax.text(0.02, 0.98, 'Low Impact\nHigh Probability', transform=ax.transAxes, 
               ha='left', va='top', fontsize=10, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.3))
        ax.text(0.98, 0.98, 'High Impact\nHigh Probability', transform=ax.transAxes, 
               ha='right', va='top', fontsize=10, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='red', alpha=0.3))
        ax.text(0.02, 0.02, 'Low Impact\nLow Probability', transform=ax.transAxes, 
               ha='left', va='bottom', fontsize=10, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='green', alpha=0.3))
        ax.text(0.98, 0.02, 'High Impact\nLow Probability', transform=ax.transAxes, 
               ha='right', va='bottom', fontsize=10, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='orange', alpha=0.3))
        
        # Formatting
        ax.set_title('Risk Heat Map - Probability vs. Impact', 
                    fontsize=self.config.title_font_size, fontweight='bold', pad=20)
        ax.set_xlabel('Mean Impact')
        ax.set_ylabel('Estimated Probability')
        ax.set_xlim(0, max(impacts) * 1.1)
        ax.set_ylim(0, 1.05)
        ax.grid(True, alpha=0.3)
        
        # Create legend for categories
        legend_elements = [plt.Line2D([0], [0], marker='o', color='w', 
                                     markerfacecolor=color, markersize=8, label=category)
                          for category, color in category_colors.items()]
        ax.legend(handles=legend_elements, loc='upper left', title='Risk Categories')
        
        plt.tight_layout()
        
        # Create chart data
        chart_data = ChartData(
            data=fig,
            title='Risk Heat Map - Probability vs. Impact',
            subtitle=f'Risk assessment matrix for {len(risk_data)} risks',
            x_label='Mean Impact',
            y_label='Estimated Probability',
            metadata={
                'risk_count': len(risk_data),
                'impact_threshold': impact_threshold,
                'probability_threshold': probability_threshold,
                'risk_data': risk_data,
                'category_distribution': {cat: categories.count(cat) for cat in unique_categories},
                'high_risk_count': sum(1 for rd in risk_data 
                                     if rd['mean_impact'] > impact_threshold and 
                                        rd['estimated_probability'] > probability_threshold)
            }
        )
        
        return chart_data
    
    def generate_scenario_overlay_chart(
        self,
        scenario_results: List[Tuple[str, SimulationResults]],
        outcome_type: str = 'cost',
        chart_type: str = 'distribution'
    ) -> ChartData:
        """
        Generate overlay charts showing multiple distribution curves for scenario comparison.
        
        Implements Requirements 8.5: Provide overlay charts showing multiple distribution curves 
        when comparing scenarios.
        
        Args:
            scenario_results: List of tuples containing (scenario_name, SimulationResults)
            outcome_type: 'cost' or 'schedule' to specify which outcomes to visualize
            chart_type: 'distribution' for PDF overlay or 'cdf' for CDF overlay
            
        Returns:
            ChartData containing the scenario overlay chart and metadata
        """
        if not scenario_results:
            raise ValueError("At least one scenario result is required")
        
        if outcome_type not in ['cost', 'schedule']:
            raise ValueError("outcome_type must be 'cost' or 'schedule'")
        
        if chart_type not in ['distribution', 'cdf']:
            raise ValueError("chart_type must be 'distribution' or 'cdf'")
        
        # Create figure
        fig, ax = plt.subplots(figsize=(self.config.width, self.config.height))
        
        # Prepare data
        scenario_data = {}
        all_data = []
        
        # Ensure unique scenario names
        name_counts = {}
        for scenario_name, results in scenario_results:
            if outcome_type == 'cost':
                data = results.cost_outcomes
                unit = '$'
            else:
                data = results.schedule_outcomes
                unit = 'days'
            
            # Make scenario name unique if it already exists
            original_name = scenario_name
            if scenario_name in name_counts:
                name_counts[scenario_name] += 1
                scenario_name = f"{original_name}_{name_counts[scenario_name]}"
            else:
                name_counts[scenario_name] = 0
            
            scenario_data[scenario_name] = data
            all_data.extend(data)
        
        # Set common x-axis range
        x_min, x_max = min(all_data), max(all_data)
        x_range = np.linspace(x_min, x_max, 200)
        
        # Generate colors for scenarios
        colors = plt.cm.Set1(np.linspace(0, 1, len(scenario_results)))
        
        if chart_type == 'distribution':
            # Plot probability density functions
            for i, (scenario_name, data) in enumerate(scenario_data.items()):
                # Histogram
                ax.hist(data, bins=50, density=True, alpha=0.3, color=colors[i], 
                       label=f'{scenario_name} (histogram)', edgecolor='white', linewidth=0.5)
                
                # KDE curve
                kde = stats.gaussian_kde(data)
                kde_y = kde(x_range)
                ax.plot(x_range, kde_y, color=colors[i], linewidth=2.5, 
                       label=f'{scenario_name} (density)', linestyle='-')
                
                # Add mean line
                mean_val = np.mean(data)
                ax.axvline(mean_val, color=colors[i], linestyle='--', alpha=0.8, linewidth=1.5)
            
            ax.set_ylabel('Probability Density')
            title = f'Scenario Comparison - {outcome_type.capitalize()} Distribution Overlay'
            
        else:  # CDF
            # Plot cumulative distribution functions
            for i, (scenario_name, data) in enumerate(scenario_data.items()):
                sorted_data = np.sort(data)
                n = len(sorted_data)
                y_values = np.arange(1, n + 1) / n * 100
                
                ax.plot(sorted_data, y_values, color=colors[i], linewidth=2.5, 
                       label=scenario_name, linestyle='-')
                
                # Add percentile markers
                p50 = np.percentile(data, 50)
                p90 = np.percentile(data, 90)
                ax.plot(p50, 50, 'o', color=colors[i], markersize=6, 
                       markeredgecolor='white', markeredgewidth=1)
                ax.plot(p90, 90, 's', color=colors[i], markersize=6, 
                       markeredgecolor='white', markeredgewidth=1)
            
            ax.set_ylabel('Cumulative Probability (%)')
            ax.set_ylim(0, 100)
            title = f'Scenario Comparison - {outcome_type.capitalize()} CDF Overlay'
        
        # Common formatting
        ax.set_xlabel(f'{outcome_type.capitalize()} ({unit})')
        ax.set_title(title, fontsize=self.config.title_font_size, fontweight='bold', pad=20)
        ax.grid(True, alpha=0.3)
        
        if self.config.show_legend:
            ax.legend(loc='best')
        
        # Add comparison statistics table
        stats_data = []
        for scenario_name, data in scenario_data.items():
            stats_data.append({
                'Scenario': scenario_name,
                'Mean': f'{np.mean(data):.0f}{unit}',
                'Median': f'{np.median(data):.0f}{unit}',
                'Std Dev': f'{np.std(data):.0f}{unit}',
                'P90': f'{np.percentile(data, 90):.0f}{unit}'
            })
        
        # Add statistics table as text
        table_text = "Scenario Statistics:\n"
        for stat in stats_data:
            table_text += f"{stat['Scenario']}: Mean={stat['Mean']}, P90={stat['P90']}\n"
        
        ax.text(0.02, 0.98, table_text, transform=ax.transAxes, fontsize=8,
               verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        plt.tight_layout()
        
        # Create chart data
        chart_data = ChartData(
            data=fig,
            title=title,
            subtitle=f'Comparison of {len(scenario_results)} scenarios - {outcome_type} outcomes',
            x_label=f'{outcome_type.capitalize()} ({unit})',
            y_label='Probability Density' if chart_type == 'distribution' else 'Cumulative Probability (%)',
            metadata={
                'outcome_type': outcome_type,
                'chart_type': chart_type,
                'scenario_count': len(scenario_results),
                'scenario_statistics': stats_data,
                'comparison_range': (x_min, x_max)
            }
        )
        
        return chart_data
    
    def save_chart(self, chart_data: ChartData, filename: str, format: Optional[ChartFormat] = None) -> str:
        """
        Save chart to file in specified format.
        
        Args:
            chart_data: ChartData containing the chart to save
            filename: Output filename (without extension)
            format: Output format (uses config default if None)
            
        Returns:
            Full path to saved file
        """
        output_format = format or self.config.format
        
        # Add appropriate extension
        if not filename.endswith(f'.{output_format.value}'):
            filename = f"{filename}.{output_format.value}"
        
        # Save based on format
        if output_format == ChartFormat.PNG:
            chart_data.data.savefig(filename, format='png', dpi=self.config.dpi, bbox_inches='tight')
        elif output_format == ChartFormat.PDF:
            chart_data.data.savefig(filename, format='pdf', bbox_inches='tight')
        elif output_format == ChartFormat.SVG:
            chart_data.data.savefig(filename, format='svg', bbox_inches='tight')
        elif output_format == ChartFormat.HTML:
            # For HTML, we'll save as PNG and embed in HTML
            png_filename = filename.replace('.html', '.png')
            chart_data.data.savefig(png_filename, format='png', dpi=self.config.dpi, bbox_inches='tight')
            
            # Create HTML wrapper
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>{chart_data.title}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; }}
                    .chart-container {{ text-align: center; }}
                    .metadata {{ margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="chart-container">
                    <h1>{chart_data.title}</h1>
                    {f'<h2>{chart_data.subtitle}</h2>' if chart_data.subtitle else ''}
                    <img src="{png_filename}" alt="{chart_data.title}" style="max-width: 100%;">
                    <div class="metadata">
                        <p>Generated from Monte Carlo Risk Simulation</p>
                        {f'<p>Metadata: {chart_data.metadata}</p>' if chart_data.metadata else ''}
                    </div>
                </div>
            </body>
            </html>
            """
            
            with open(filename, 'w') as f:
                f.write(html_content)
        
        plt.close(chart_data.data)  # Clean up memory
        return filename
    
    def export_chart_data(self, chart_data: ChartData) -> Dict[str, Any]:
        """
        Export chart data in a structured format for external use.
        
        Args:
            chart_data: ChartData to export
            
        Returns:
            Dictionary containing structured chart data
        """
        return {
            'title': chart_data.title,
            'subtitle': chart_data.subtitle,
            'x_label': chart_data.x_label,
            'y_label': chart_data.y_label,
            'metadata': chart_data.metadata,
            'config': {
                'format': self.config.format.value,
                'theme': self.config.theme.value,
                'width': self.config.width,
                'height': self.config.height,
                'dpi': self.config.dpi
            }
        }
    
    def get_chart_as_base64(self, chart_data: ChartData, format: ChartFormat = ChartFormat.PNG) -> str:
        """
        Get chart as base64 encoded string for embedding in web applications.
        
        Args:
            chart_data: ChartData containing the chart
            format: Output format for encoding
            
        Returns:
            Base64 encoded string of the chart
        """
        buffer = io.BytesIO()
        
        if format == ChartFormat.PNG:
            chart_data.data.savefig(buffer, format='png', dpi=self.config.dpi, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            plt.close(chart_data.data)
            return f"data:image/png;base64,{image_base64}"
        elif format == ChartFormat.SVG:
            chart_data.data.savefig(buffer, format='svg', bbox_inches='tight')
            buffer.seek(0)
            svg_content = buffer.getvalue().decode('utf-8')
            plt.close(chart_data.data)
            return svg_content
        else:
            raise ValueError(f"Base64 encoding not supported for format: {format}")


class VisualizationManager:
    """
    High-level manager for coordinating visualization generation across the system.
    
    Provides a unified interface for generating all types of charts and managing
    visualization workflows for Monte Carlo simulation results.
    """
    
    def __init__(self, config: Optional[ChartConfig] = None):
        """
        Initialize the visualization manager.
        
        Args:
            config: Optional ChartConfig for customizing chart appearance
        """
        self.chart_generator = ChartGenerator(config)
        self.results_analyzer = SimulationResultsAnalyzer()
    
    def generate_complete_visualization_suite(
        self,
        simulation_results: SimulationResults,
        risks: Optional[List[Risk]] = None,
        scenario_results: Optional[List[Tuple[str, SimulationResults]]] = None,
        output_directory: str = "visualizations"
    ) -> Dict[str, ChartData]:
        """
        Generate a complete suite of visualizations for simulation results.
        
        Creates all standard chart types for comprehensive result presentation.
        
        Args:
            simulation_results: Primary simulation results to visualize
            risks: Optional list of risks for heat map generation
            scenario_results: Optional scenario results for comparison charts
            output_directory: Directory to save charts (if saving is enabled)
            
        Returns:
            Dictionary mapping chart names to ChartData objects
        """
        charts = {}
        
        # 1. Probability Distribution Charts
        try:
            charts['cost_distribution'] = self.chart_generator.generate_probability_distribution_chart(
                simulation_results, outcome_type='cost'
            )
            charts['schedule_distribution'] = self.chart_generator.generate_probability_distribution_chart(
                simulation_results, outcome_type='schedule'
            )
        except Exception as e:
            print(f"Warning: Could not generate distribution charts: {e}")
        
        # 2. Tornado Diagrams
        try:
            charts['cost_tornado'] = self.chart_generator.generate_tornado_diagram(
                simulation_results, outcome_type='cost'
            )
            charts['schedule_tornado'] = self.chart_generator.generate_tornado_diagram(
                simulation_results, outcome_type='schedule'
            )
        except Exception as e:
            print(f"Warning: Could not generate tornado diagrams: {e}")
        
        # 3. CDF Charts
        try:
            charts['cost_cdf'] = self.chart_generator.generate_cdf_chart(
                simulation_results, outcome_type='cost'
            )
            charts['schedule_cdf'] = self.chart_generator.generate_cdf_chart(
                simulation_results, outcome_type='schedule'
            )
        except Exception as e:
            print(f"Warning: Could not generate CDF charts: {e}")
        
        # 4. Risk Heat Map (if risks provided)
        if risks:
            try:
                charts['risk_heat_map'] = self.chart_generator.generate_risk_heat_map(
                    risks, simulation_results
                )
            except Exception as e:
                print(f"Warning: Could not generate risk heat map: {e}")
        
        # 5. Scenario Overlay Charts (if scenario results provided)
        if scenario_results:
            try:
                charts['scenario_cost_overlay'] = self.chart_generator.generate_scenario_overlay_chart(
                    scenario_results, outcome_type='cost', chart_type='distribution'
                )
                charts['scenario_schedule_overlay'] = self.chart_generator.generate_scenario_overlay_chart(
                    scenario_results, outcome_type='schedule', chart_type='distribution'
                )
                charts['scenario_cost_cdf_overlay'] = self.chart_generator.generate_scenario_overlay_chart(
                    scenario_results, outcome_type='cost', chart_type='cdf'
                )
                charts['scenario_schedule_cdf_overlay'] = self.chart_generator.generate_scenario_overlay_chart(
                    scenario_results, outcome_type='schedule', chart_type='cdf'
                )
            except Exception as e:
                print(f"Warning: Could not generate scenario overlay charts: {e}")
        
        return charts
    
    def generate_executive_summary_charts(
        self,
        simulation_results: SimulationResults,
        risks: Optional[List[Risk]] = None
    ) -> Dict[str, ChartData]:
        """
        Generate a focused set of charts for executive summary presentations.
        
        Args:
            simulation_results: Simulation results to visualize
            risks: Optional list of risks for heat map
            
        Returns:
            Dictionary containing key executive charts
        """
        charts = {}
        
        # Key distribution chart with confidence intervals
        charts['cost_summary'] = self.chart_generator.generate_cdf_chart(
            simulation_results, outcome_type='cost', 
            percentile_markers=[10, 50, 90], confidence_levels=[80, 90]
        )
        
        # Top risk contributors
        charts['top_risks'] = self.chart_generator.generate_tornado_diagram(
            simulation_results, top_n=5, outcome_type='cost'
        )
        
        # Risk heat map if risks available
        if risks:
            charts['risk_overview'] = self.chart_generator.generate_risk_heat_map(
                risks, simulation_results
            )
        
        return charts
    
    def create_dashboard_layout(
        self,
        charts: Dict[str, ChartData],
        layout_type: str = "standard"
    ) -> Dict[str, Any]:
        """
        Create a dashboard layout specification for multiple charts.
        
        Args:
            charts: Dictionary of charts to include in dashboard
            layout_type: Type of layout ("standard", "executive", "detailed")
            
        Returns:
            Dictionary containing dashboard layout specification
        """
        if layout_type == "executive":
            layout = {
                "title": "Monte Carlo Risk Analysis - Executive Summary",
                "layout": "2x2",
                "charts": {
                    "top_left": charts.get('cost_summary'),
                    "top_right": charts.get('top_risks'),
                    "bottom_left": charts.get('risk_overview'),
                    "bottom_right": charts.get('schedule_distribution')
                }
            }
        elif layout_type == "detailed":
            layout = {
                "title": "Monte Carlo Risk Analysis - Detailed Results",
                "layout": "3x2",
                "charts": {
                    "row1_col1": charts.get('cost_distribution'),
                    "row1_col2": charts.get('schedule_distribution'),
                    "row2_col1": charts.get('cost_tornado'),
                    "row2_col2": charts.get('schedule_tornado'),
                    "row3_col1": charts.get('cost_cdf'),
                    "row3_col2": charts.get('risk_heat_map')
                }
            }
        else:  # standard
            layout = {
                "title": "Monte Carlo Risk Analysis - Standard View",
                "layout": "2x3",
                "charts": {
                    "row1_col1": charts.get('cost_distribution'),
                    "row1_col2": charts.get('schedule_distribution'),
                    "row2_col1": charts.get('cost_tornado'),
                    "row2_col2": charts.get('schedule_tornado'),
                    "row3_col1": charts.get('cost_cdf'),
                    "row3_col2": charts.get('schedule_cdf')
                }
            }
        
        # Filter out None charts
        layout["charts"] = {k: v for k, v in layout["charts"].items() if v is not None}
        
        return layout
    
    def export_visualization_suite(
        self,
        charts: Dict[str, ChartData],
        output_directory: str = "visualizations",
        formats: Optional[List[ChartFormat]] = None
    ) -> Dict[str, List[str]]:
        """
        Export a complete visualization suite to files.
        
        Args:
            charts: Dictionary of charts to export
            output_directory: Directory to save charts
            formats: List of formats to export (defaults to PNG and PDF)
            
        Returns:
            Dictionary mapping chart names to lists of saved file paths
        """
        import os
        
        if formats is None:
            formats = [ChartFormat.PNG, ChartFormat.PDF]
        
        # Create output directory if it doesn't exist
        os.makedirs(output_directory, exist_ok=True)
        
        exported_files = {}
        
        for chart_name, chart_data in charts.items():
            if chart_data is None:
                continue
                
            chart_files = []
            for format in formats:
                filename = os.path.join(output_directory, f"{chart_name}.{format.value}")
                try:
                    saved_path = self.chart_generator.save_chart(chart_data, filename, format)
                    chart_files.append(saved_path)
                except Exception as e:
                    print(f"Warning: Could not save {chart_name} in {format.value} format: {e}")
            
            exported_files[chart_name] = chart_files
        
        return exported_files
    
    def generate_interactive_charts(
        self,
        simulation_results: SimulationResults,
        risks: Optional[List[Risk]] = None
    ) -> Dict[str, Any]:
        """
        Generate interactive chart specifications for web-based visualization.
        
        Args:
            simulation_results: Simulation results to visualize
            risks: Optional list of risks
            
        Returns:
            Dictionary containing interactive chart specifications
        """
        # This would typically integrate with libraries like Plotly for interactive charts
        # For now, we'll return specifications that could be used by a frontend
        
        interactive_specs = {}
        
        # Cost distribution interactive spec
        cost_data = simulation_results.cost_outcomes
        interactive_specs['cost_distribution'] = {
            'type': 'histogram_with_kde',
            'data': cost_data.tolist(),
            'title': 'Cost Risk Distribution',
            'x_label': 'Cost ($)',
            'y_label': 'Probability Density',
            'statistics': {
                'mean': float(np.mean(cost_data)),
                'median': float(np.median(cost_data)),
                'std': float(np.std(cost_data)),
                'percentiles': {
                    f'P{p}': float(np.percentile(cost_data, p))
                    for p in [10, 25, 50, 75, 90, 95, 99]
                }
            }
        }
        
        # Risk contributions interactive spec
        if simulation_results.risk_contributions:
            risk_contributions = self.results_analyzer.identify_top_risk_contributors(
                simulation_results, top_n=10
            )
            
            interactive_specs['risk_tornado'] = {
                'type': 'horizontal_bar',
                'data': [
                    {
                        'name': rc.risk_name,
                        'value': rc.contribution_percentage,
                        'category': 'risk_contribution'
                    }
                    for rc in risk_contributions
                ],
                'title': 'Top Risk Contributors',
                'x_label': 'Contribution to Total Variance (%)',
                'y_label': 'Risk Factors'
            }
        
        # CDF interactive spec
        sorted_cost = np.sort(cost_data)
        cdf_y = np.arange(1, len(sorted_cost) + 1) / len(sorted_cost) * 100
        
        interactive_specs['cost_cdf'] = {
            'type': 'line',
            'data': {
                'x': sorted_cost.tolist(),
                'y': cdf_y.tolist()
            },
            'title': 'Cost Risk Cumulative Distribution',
            'x_label': 'Cost ($)',
            'y_label': 'Cumulative Probability (%)',
            'markers': {
                f'P{p}': {
                    'x': float(np.percentile(cost_data, p)),
                    'y': float(p)
                }
                for p in [10, 25, 50, 75, 90, 95]
            }
        }
        
        return interactive_specs
    
    def validate_visualization_requirements(
        self,
        simulation_results: SimulationResults,
        risks: Optional[List[Risk]] = None
    ) -> Dict[str, Any]:
        """
        Validate that simulation results contain sufficient data for visualization.
        
        Args:
            simulation_results: Simulation results to validate
            risks: Optional list of risks
            
        Returns:
            Dictionary containing validation results and recommendations
        """
        validation_results = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'recommendations': [],
            'available_charts': []
        }
        
        # Check basic requirements
        if simulation_results.iteration_count < 1000:
            validation_results['warnings'].append(
                f"Low iteration count ({simulation_results.iteration_count}). "
                "Consider using at least 10,000 iterations for stable visualizations."
            )
        
        # Check cost outcomes
        if len(simulation_results.cost_outcomes) > 0:
            validation_results['available_charts'].extend([
                'cost_distribution', 'cost_cdf', 'cost_tornado'
            ])
            
            if np.all(simulation_results.cost_outcomes == simulation_results.cost_outcomes[0]):
                validation_results['warnings'].append(
                    "All cost outcomes are identical. Distribution charts may not be meaningful."
                )
        else:
            validation_results['errors'].append("No cost outcomes found in simulation results.")
        
        # Check schedule outcomes
        if len(simulation_results.schedule_outcomes) > 0:
            validation_results['available_charts'].extend([
                'schedule_distribution', 'schedule_cdf', 'schedule_tornado'
            ])
            
            if np.all(simulation_results.schedule_outcomes == simulation_results.schedule_outcomes[0]):
                validation_results['warnings'].append(
                    "All schedule outcomes are identical. Distribution charts may not be meaningful."
                )
        else:
            validation_results['warnings'].append("No schedule outcomes found in simulation results.")
        
        # Check risk contributions
        if simulation_results.risk_contributions:
            validation_results['available_charts'].append('tornado_diagram')
            
            if len(simulation_results.risk_contributions) < 3:
                validation_results['warnings'].append(
                    f"Only {len(simulation_results.risk_contributions)} risks found. "
                    "Tornado diagrams are most effective with 5+ risks."
                )
        else:
            validation_results['warnings'].append(
                "No risk contributions found. Tornado diagrams will not be available."
            )
        
        # Check for heat map requirements
        if risks and simulation_results.risk_contributions:
            validation_results['available_charts'].append('risk_heat_map')
        else:
            validation_results['recommendations'].append(
                "Provide risk objects to enable risk heat map generation."
            )
        
        # Set overall validity
        validation_results['valid'] = len(validation_results['errors']) == 0
        
        return validation_results


class ChartTemplateManager:
    """
    Manager for chart templates and styling presets.
    
    Provides predefined chart configurations for different use cases
    and audiences (executive, technical, presentation, etc.).
    """
    
    @staticmethod
    def get_executive_template() -> ChartConfig:
        """Get chart configuration optimized for executive presentations."""
        return ChartConfig(
            format=ChartFormat.PDF,
            theme=ChartTheme.PRESENTATION,
            width=10,
            height=6,
            font_size=12,
            title_font_size=16,
            show_grid=False,
            color_palette=['#2E86AB', '#A23B72', '#F18F01', '#C73E1D']
        )
    
    @staticmethod
    def get_technical_template() -> ChartConfig:
        """Get chart configuration optimized for technical analysis."""
        return ChartConfig(
            format=ChartFormat.PNG,
            theme=ChartTheme.DEFAULT,
            width=12,
            height=8,
            font_size=10,
            title_font_size=14,
            show_grid=True,
            dpi=300
        )
    
    @staticmethod
    def get_web_template() -> ChartConfig:
        """Get chart configuration optimized for web display."""
        return ChartConfig(
            format=ChartFormat.SVG,
            theme=ChartTheme.PROFESSIONAL,
            width=10,
            height=6,
            font_size=11,
            title_font_size=15,
            show_grid=True,
            dpi=150
        )
    
    @staticmethod
    def get_colorblind_friendly_template() -> ChartConfig:
        """Get chart configuration optimized for colorblind accessibility."""
        return ChartConfig(
            format=ChartFormat.PNG,
            theme=ChartTheme.COLORBLIND_FRIENDLY,
            width=12,
            height=8,
            font_size=11,
            title_font_size=14,
            show_grid=True,
            dpi=300
        )
    
    @staticmethod
    def get_print_template() -> ChartConfig:
        """Get chart configuration optimized for print publications."""
        return ChartConfig(
            format=ChartFormat.PDF,
            theme=ChartTheme.PROFESSIONAL,
            width=8,
            height=6,
            font_size=9,
            title_font_size=12,
            show_grid=True,
            dpi=600,
            color_palette=['#000000', '#666666', '#999999', '#CCCCCC']  # Grayscale for print
        )


# Utility functions for chart data processing

def calculate_chart_statistics(data: np.ndarray) -> Dict[str, float]:
    """
    Calculate comprehensive statistics for chart data.
    
    Args:
        data: NumPy array of data values
        
    Returns:
        Dictionary containing statistical measures
    """
    return {
        'count': len(data),
        'mean': float(np.mean(data)),
        'median': float(np.median(data)),
        'std_dev': float(np.std(data)),
        'variance': float(np.var(data)),
        'min': float(np.min(data)),
        'max': float(np.max(data)),
        'range': float(np.max(data) - np.min(data)),
        'skewness': float(stats.skew(data)),
        'kurtosis': float(stats.kurtosis(data)),
        'coefficient_of_variation': float(np.std(data) / np.mean(data)) if np.mean(data) != 0 else 0,
        'percentiles': {
            f'P{p}': float(np.percentile(data, p))
            for p in [1, 5, 10, 25, 50, 75, 90, 95, 99]
        }
    }


def format_currency(value: float, currency_symbol: str = '$') -> str:
    """
    Format numeric value as currency string.
    
    Args:
        value: Numeric value to format
        currency_symbol: Currency symbol to use
        
    Returns:
        Formatted currency string
    """
    if abs(value) >= 1e9:
        return f"{currency_symbol}{value/1e9:.1f}B"
    elif abs(value) >= 1e6:
        return f"{currency_symbol}{value/1e6:.1f}M"
    elif abs(value) >= 1e3:
        return f"{currency_symbol}{value/1e3:.1f}K"
    else:
        return f"{currency_symbol}{value:.0f}"


def format_duration(days: float) -> str:
    """
    Format duration in days to human-readable string.
    
    Args:
        days: Duration in days
        
    Returns:
        Formatted duration string
    """
    if days >= 365:
        years = days / 365
        return f"{years:.1f} years"
    elif days >= 30:
        months = days / 30
        return f"{months:.1f} months"
    elif days >= 7:
        weeks = days / 7
        return f"{weeks:.1f} weeks"
    else:
        return f"{days:.1f} days"


def create_color_gradient(start_color: str, end_color: str, steps: int) -> List[str]:
    """
    Create a color gradient between two colors.
    
    Args:
        start_color: Starting color (hex format)
        end_color: Ending color (hex format)
        steps: Number of gradient steps
        
    Returns:
        List of hex color strings
    """
    # Convert hex to RGB
    start_rgb = tuple(int(start_color[i:i+2], 16) for i in (1, 3, 5))
    end_rgb = tuple(int(end_color[i:i+2], 16) for i in (1, 3, 5))
    
    # Generate gradient
    gradient = []
    for i in range(steps):
        ratio = i / (steps - 1) if steps > 1 else 0
        r = int(start_rgb[0] + (end_rgb[0] - start_rgb[0]) * ratio)
        g = int(start_rgb[1] + (end_rgb[1] - start_rgb[1]) * ratio)
        b = int(start_rgb[2] + (end_rgb[2] - start_rgb[2]) * ratio)
        gradient.append(f"#{r:02x}{g:02x}{b:02x}")
    
    return gradient


# Alias for backward compatibility (e.g. test_complete_monte_carlo_integration)
VisualizationGenerator = VisualizationManager