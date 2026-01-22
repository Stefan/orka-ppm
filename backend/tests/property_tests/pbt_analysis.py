"""
Property-Based Testing Result Analysis and Aggregation

This module provides comprehensive analysis of property test results including
trend analysis, failure pattern detection, and performance regression detection.

Task: 13.1 Implement test orchestration system
Feature: property-based-testing
"""

import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

from pbt_orchestrator import (
    OrchestrationReport, TestSuiteResult, PropertyTestResult,
    TestStatus, TestCategory
)


class TrendDirection(Enum):
    """Trend direction for metrics"""
    IMPROVING = "improving"
    STABLE = "stable"
    DEGRADING = "degrading"
    INSUFFICIENT_DATA = "insufficient_data"


@dataclass
class FailurePattern:
    """Detected failure pattern"""
    pattern_id: str
    test_names: List[str]
    category: TestCategory
    frequency: int
    first_seen: datetime
    last_seen: datetime
    common_error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pattern_id': self.pattern_id,
            'test_names': self.test_names,
            'category': self.category.value,
            'frequency': self.frequency,
            'first_seen': self.first_seen.isoformat(),
            'last_seen': self.last_seen.isoformat(),
            'common_error': self.common_error
        }


@dataclass
class PerformanceTrend:
    """Performance trend analysis"""
    metric_name: str
    current_value: float
    previous_value: Optional[float]
    trend_direction: TrendDirection
    change_percentage: float
    threshold_exceeded: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'metric_name': self.metric_name,
            'current_value': self.current_value,
            'previous_value': self.previous_value,
            'trend_direction': self.trend_direction.value,
            'change_percentage': self.change_percentage,
            'threshold_exceeded': self.threshold_exceeded
        }


@dataclass
class TestCoverageAnalysis:
    """Test coverage analysis for property tests"""
    total_properties: int
    properties_by_category: Dict[str, int]
    requirements_coverage: Dict[str, List[int]]  # requirement_id -> property_numbers
    uncovered_requirements: List[str]
    coverage_percentage: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_properties': self.total_properties,
            'properties_by_category': self.properties_by_category,
            'requirements_coverage': self.requirements_coverage,
            'uncovered_requirements': self.uncovered_requirements,
            'coverage_percentage': self.coverage_percentage
        }


@dataclass
class AnalysisReport:
    """Comprehensive analysis report"""
    execution_id: str
    analysis_timestamp: datetime
    success_rate_trend: PerformanceTrend
    execution_time_trend: PerformanceTrend
    failure_patterns: List[FailurePattern]
    coverage_analysis: TestCoverageAnalysis
    category_performance: Dict[str, Dict[str, Any]]
    recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'execution_id': self.execution_id,
            'analysis_timestamp': self.analysis_timestamp.isoformat(),
            'success_rate_trend': self.success_rate_trend.to_dict(),
            'execution_time_trend': self.execution_time_trend.to_dict(),
            'failure_patterns': [fp.to_dict() for fp in self.failure_patterns],
            'coverage_analysis': self.coverage_analysis.to_dict(),
            'category_performance': self.category_performance,
            'recommendations': self.recommendations
        }


class TestResultAnalyzer:
    """
    Comprehensive analyzer for property-based test results.
    
    Provides trend analysis, failure pattern detection, coverage analysis,
    and performance regression detection.
    """
    
    def __init__(
        self,
        reports_dir: Path,
        performance_threshold: float = 10.0,  # 10% performance degradation threshold
        min_reports_for_trend: int = 3
    ):
        """
        Initialize test result analyzer.
        
        Args:
            reports_dir: Directory containing test reports
            performance_threshold: Threshold for performance regression (percentage)
            min_reports_for_trend: Minimum reports needed for trend analysis
        """
        self.reports_dir = reports_dir
        self.performance_threshold = performance_threshold
        self.min_reports_for_trend = min_reports_for_trend
        
    def analyze_latest_report(
        self,
        current_report: OrchestrationReport
    ) -> AnalysisReport:
        """
        Analyze the latest test report with historical context.
        
        Args:
            current_report: Current orchestration report
            
        Returns:
            Comprehensive analysis report
        """
        analysis_timestamp = datetime.now()
        
        # Load historical reports
        historical_reports = self._load_historical_reports(limit=10)
        
        # Analyze success rate trend
        success_rate_trend = self._analyze_success_rate_trend(
            current_report,
            historical_reports
        )
        
        # Analyze execution time trend
        execution_time_trend = self._analyze_execution_time_trend(
            current_report,
            historical_reports
        )
        
        # Detect failure patterns
        failure_patterns = self._detect_failure_patterns(
            current_report,
            historical_reports
        )
        
        # Analyze test coverage
        coverage_analysis = self._analyze_test_coverage(current_report)
        
        # Analyze category performance
        category_performance = self._analyze_category_performance(current_report)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            current_report,
            success_rate_trend,
            execution_time_trend,
            failure_patterns,
            coverage_analysis
        )
        
        return AnalysisReport(
            execution_id=current_report.execution_id,
            analysis_timestamp=analysis_timestamp,
            success_rate_trend=success_rate_trend,
            execution_time_trend=execution_time_trend,
            failure_patterns=failure_patterns,
            coverage_analysis=coverage_analysis,
            category_performance=category_performance,
            recommendations=recommendations
        )
    
    def _load_historical_reports(
        self,
        limit: int = 10
    ) -> List[OrchestrationReport]:
        """Load historical test reports"""
        reports = []
        
        # Find all report JSON files
        report_files = sorted(
            self.reports_dir.glob("pbt-*_report.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        for report_file in report_files[:limit]:
            try:
                with open(report_file, 'r') as f:
                    data = json.load(f)
                    # Reconstruct OrchestrationReport (simplified)
                    # In production, you'd want proper deserialization
                    reports.append(data)
            except Exception as e:
                print(f"Warning: Could not load report {report_file}: {e}")
        
        return reports
    
    def _analyze_success_rate_trend(
        self,
        current_report: OrchestrationReport,
        historical_reports: List[Dict]
    ) -> PerformanceTrend:
        """Analyze success rate trend"""
        current_rate = current_report.overall_success_rate
        
        if len(historical_reports) < self.min_reports_for_trend:
            return PerformanceTrend(
                metric_name="Success Rate",
                current_value=current_rate,
                previous_value=None,
                trend_direction=TrendDirection.INSUFFICIENT_DATA,
                change_percentage=0.0,
                threshold_exceeded=False
            )
        
        # Calculate average of previous reports
        previous_rates = [
            report.get('overall_success_rate', 0.0)
            for report in historical_reports[:5]
        ]
        avg_previous_rate = sum(previous_rates) / len(previous_rates) if previous_rates else 0.0
        
        # Calculate change
        change_percentage = ((current_rate - avg_previous_rate) / avg_previous_rate * 100
                           if avg_previous_rate > 0 else 0.0)
        
        # Determine trend direction
        if abs(change_percentage) < 2.0:  # Within 2% is considered stable
            trend_direction = TrendDirection.STABLE
        elif change_percentage > 0:
            trend_direction = TrendDirection.IMPROVING
        else:
            trend_direction = TrendDirection.DEGRADING
        
        # Check if threshold exceeded (for degradation)
        threshold_exceeded = (trend_direction == TrendDirection.DEGRADING and
                            abs(change_percentage) > self.performance_threshold)
        
        return PerformanceTrend(
            metric_name="Success Rate",
            current_value=current_rate,
            previous_value=avg_previous_rate,
            trend_direction=trend_direction,
            change_percentage=change_percentage,
            threshold_exceeded=threshold_exceeded
        )
    
    def _analyze_execution_time_trend(
        self,
        current_report: OrchestrationReport,
        historical_reports: List[Dict]
    ) -> PerformanceTrend:
        """Analyze execution time trend"""
        current_time = current_report.total_execution_time
        
        if len(historical_reports) < self.min_reports_for_trend:
            return PerformanceTrend(
                metric_name="Execution Time",
                current_value=current_time,
                previous_value=None,
                trend_direction=TrendDirection.INSUFFICIENT_DATA,
                change_percentage=0.0,
                threshold_exceeded=False
            )
        
        # Calculate average of previous reports
        previous_times = [
            report.get('total_execution_time', 0.0)
            for report in historical_reports[:5]
        ]
        avg_previous_time = sum(previous_times) / len(previous_times) if previous_times else 0.0
        
        # Calculate change
        change_percentage = ((current_time - avg_previous_time) / avg_previous_time * 100
                           if avg_previous_time > 0 else 0.0)
        
        # Determine trend direction (for execution time, lower is better)
        if abs(change_percentage) < 5.0:  # Within 5% is considered stable
            trend_direction = TrendDirection.STABLE
        elif change_percentage < 0:  # Faster is improving
            trend_direction = TrendDirection.IMPROVING
        else:  # Slower is degrading
            trend_direction = TrendDirection.DEGRADING
        
        # Check if threshold exceeded (for performance regression)
        threshold_exceeded = (trend_direction == TrendDirection.DEGRADING and
                            abs(change_percentage) > self.performance_threshold)
        
        return PerformanceTrend(
            metric_name="Execution Time",
            current_value=current_time,
            previous_value=avg_previous_time,
            trend_direction=trend_direction,
            change_percentage=change_percentage,
            threshold_exceeded=threshold_exceeded
        )
    
    def _detect_failure_patterns(
        self,
        current_report: OrchestrationReport,
        historical_reports: List[Dict]
    ) -> List[FailurePattern]:
        """Detect recurring failure patterns"""
        patterns = []
        
        # Collect all failed tests from current report
        failed_tests = defaultdict(list)
        
        for suite in current_report.backend_suites + current_report.frontend_suites:
            for test in suite.test_results:
                if test.status == TestStatus.FAILED:
                    key = (test.category, test.test_name)
                    failed_tests[key].append({
                        'timestamp': test.timestamp,
                        'error': test.error_message
                    })
        
        # Check historical reports for recurring failures
        for (category, test_name), failures in failed_tests.items():
            # Count occurrences in historical reports
            historical_count = 0
            first_seen = failures[0]['timestamp']
            last_seen = failures[-1]['timestamp']
            common_errors = []
            
            for report in historical_reports:
                for suite in report.get('backend_suites', []) + report.get('frontend_suites', []):
                    for test in suite.get('test_results', []):
                        if test.get('test_name') == test_name and test.get('status') == 'failed':
                            historical_count += 1
                            if test.get('error_message'):
                                common_errors.append(test['error_message'])
            
            # If test failed multiple times, it's a pattern
            if historical_count >= 2:
                pattern = FailurePattern(
                    pattern_id=f"{category.value}_{test_name}",
                    test_names=[test_name],
                    category=category,
                    frequency=historical_count + len(failures),
                    first_seen=first_seen,
                    last_seen=last_seen,
                    common_error=common_errors[0] if common_errors else None
                )
                patterns.append(pattern)
        
        return patterns
    
    def _analyze_test_coverage(
        self,
        current_report: OrchestrationReport
    ) -> TestCoverageAnalysis:
        """Analyze property test coverage"""
        # Count properties by category
        properties_by_category = defaultdict(int)
        requirements_coverage = defaultdict(list)
        all_property_numbers = set()
        
        for suite in current_report.backend_suites + current_report.frontend_suites:
            category_name = suite.category.value
            
            for test in suite.test_results:
                if test.property_number:
                    properties_by_category[category_name] += 1
                    all_property_numbers.add(test.property_number)
                    
                    # Map to requirements
                    for req in test.requirements:
                        requirements_coverage[req].append(test.property_number)
        
        # Calculate total properties (assuming properties 1-38 based on design)
        expected_properties = 38
        total_properties = len(all_property_numbers)
        coverage_percentage = (total_properties / expected_properties) * 100
        
        # Identify uncovered requirements (simplified)
        expected_requirements = [f"{i}.{j}" for i in range(1, 9) for j in range(1, 6)]
        uncovered_requirements = [
            req for req in expected_requirements
            if req not in requirements_coverage
        ]
        
        return TestCoverageAnalysis(
            total_properties=total_properties,
            properties_by_category=dict(properties_by_category),
            requirements_coverage=dict(requirements_coverage),
            uncovered_requirements=uncovered_requirements,
            coverage_percentage=coverage_percentage
        )
    
    def _analyze_category_performance(
        self,
        current_report: OrchestrationReport
    ) -> Dict[str, Dict[str, Any]]:
        """Analyze performance by test category"""
        category_stats = defaultdict(lambda: {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'success_rate': 0.0,
            'avg_execution_time': 0.0,
            'total_execution_time': 0.0
        })
        
        for suite in current_report.backend_suites + current_report.frontend_suites:
            category = suite.category.value
            stats = category_stats[category]
            
            stats['total_tests'] += suite.total_tests
            stats['passed'] += suite.passed
            stats['failed'] += suite.failed
            stats['total_execution_time'] += suite.execution_time
        
        # Calculate derived metrics
        for category, stats in category_stats.items():
            if stats['total_tests'] > 0:
                stats['success_rate'] = (stats['passed'] / stats['total_tests']) * 100
                stats['avg_execution_time'] = stats['total_execution_time'] / stats['total_tests']
        
        return dict(category_stats)
    
    def _generate_recommendations(
        self,
        current_report: OrchestrationReport,
        success_rate_trend: PerformanceTrend,
        execution_time_trend: PerformanceTrend,
        failure_patterns: List[FailurePattern],
        coverage_analysis: TestCoverageAnalysis
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Success rate recommendations
        if success_rate_trend.threshold_exceeded:
            recommendations.append(
                f"⚠ CRITICAL: Success rate has degraded by {abs(success_rate_trend.change_percentage):.1f}%. "
                "Investigate recent code changes and failing tests immediately."
            )
        elif success_rate_trend.trend_direction == TrendDirection.DEGRADING:
            recommendations.append(
                f"⚠ Success rate is declining ({success_rate_trend.change_percentage:.1f}%). "
                "Monitor test failures and consider reviewing recent changes."
            )
        
        # Execution time recommendations
        if execution_time_trend.threshold_exceeded:
            recommendations.append(
                f"⚠ PERFORMANCE: Test execution time has increased by {execution_time_trend.change_percentage:.1f}%. "
                "Review test performance and consider optimization."
            )
        
        # Failure pattern recommendations
        if failure_patterns:
            recommendations.append(
                f"⚠ RECURRING FAILURES: {len(failure_patterns)} test(s) are failing repeatedly. "
                "Prioritize fixing these persistent issues:"
            )
            for pattern in failure_patterns[:5]:  # Top 5
                recommendations.append(
                    f"  - {pattern.test_names[0]} (failed {pattern.frequency} times)"
                )
        
        # Coverage recommendations
        if coverage_analysis.coverage_percentage < 80:
            recommendations.append(
                f"⚠ COVERAGE: Property test coverage is {coverage_analysis.coverage_percentage:.1f}%. "
                f"Consider implementing tests for {len(coverage_analysis.uncovered_requirements)} uncovered requirements."
            )
        
        # Category-specific recommendations
        if current_report.total_failed > 0:
            failed_categories = set()
            for suite in current_report.backend_suites + current_report.frontend_suites:
                if suite.failed > 0:
                    failed_categories.add(suite.category.value)
            
            if failed_categories:
                recommendations.append(
                    f"Focus testing efforts on: {', '.join(failed_categories)}"
                )
        
        # Positive feedback
        if not recommendations:
            recommendations.append(
                "✓ All property tests passing with good performance. Continue monitoring trends."
            )
        
        return recommendations


def generate_analysis_report(
    report_path: Path,
    reports_dir: Path,
    output_path: Optional[Path] = None
) -> AnalysisReport:
    """
    Generate analysis report for a test execution.
    
    Args:
        report_path: Path to the orchestration report JSON
        reports_dir: Directory containing historical reports
        output_path: Optional path to save analysis report
        
    Returns:
        Analysis report
    """
    # Load current report
    with open(report_path, 'r') as f:
        report_data = json.load(f)
    
    # Reconstruct OrchestrationReport (simplified for this example)
    # In production, implement proper deserialization
    current_report = OrchestrationReport(
        execution_id=report_data['execution_id'],
        start_time=datetime.fromisoformat(report_data['start_time']),
        end_time=datetime.fromisoformat(report_data['end_time']) if report_data.get('end_time') else None,
        total_execution_time=report_data['total_execution_time'],
        overall_status=TestStatus(report_data['overall_status']),
        total_tests=report_data['total_tests'],
        total_passed=report_data['total_passed'],
        total_failed=report_data['total_failed'],
        total_skipped=report_data['total_skipped'],
        total_errors=report_data['total_errors']
    )
    
    # Create analyzer
    analyzer = TestResultAnalyzer(reports_dir=reports_dir)
    
    # Generate analysis
    analysis = analyzer.analyze_latest_report(current_report)
    
    # Save analysis report if output path provided
    if output_path:
        with open(output_path, 'w') as f:
            json.dump(analysis.to_dict(), f, indent=2)
    
    return analysis


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyze Property-Based Test Results")
    parser.add_argument("report", help="Path to orchestration report JSON")
    parser.add_argument("--reports-dir", default="test-results/pbt-orchestration",
                       help="Directory containing historical reports")
    parser.add_argument("--output", help="Output path for analysis report")
    
    args = parser.parse_args()
    
    analysis = generate_analysis_report(
        report_path=Path(args.report),
        reports_dir=Path(args.reports_dir),
        output_path=Path(args.output) if args.output else None
    )
    
    print("\n" + "="*80)
    print("PROPERTY-BASED TESTING ANALYSIS")
    print("="*80)
    print(f"\nExecution ID: {analysis.execution_id}")
    print(f"Analysis Time: {analysis.analysis_timestamp.isoformat()}")
    print(f"\nSuccess Rate Trend: {analysis.success_rate_trend.trend_direction.value}")
    print(f"Execution Time Trend: {analysis.execution_time_trend.trend_direction.value}")
    print(f"\nFailure Patterns Detected: {len(analysis.failure_patterns)}")
    print(f"Test Coverage: {analysis.coverage_analysis.coverage_percentage:.1f}%")
    print(f"\nRecommendations:")
    for rec in analysis.recommendations:
        print(f"  {rec}")
    print("="*80 + "\n")
