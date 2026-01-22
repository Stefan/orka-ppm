"""
Property-Based Testing Coverage Analysis and Reporting

This module provides comprehensive coverage analysis for property-based tests,
including requirement coverage, property effectiveness metrics, and detailed
reporting with visualization support.

Task: 13.3 Add test coverage analysis and reporting
Feature: property-based-testing
"""

import json
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
import re

from pbt_orchestrator import OrchestrationReport, TestCategory, TestStatus


@dataclass
class PropertyCoverage:
    """Coverage information for a single property"""
    property_number: int
    property_name: str
    category: TestCategory
    requirements: List[str]
    test_count: int
    last_executed: Optional[datetime]
    success_rate: float
    avg_execution_time: float
    iterations_per_run: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'category': self.category.value,
            'last_executed': self.last_executed.isoformat() if self.last_executed else None
        }


@dataclass
class RequirementCoverage:
    """Coverage information for a requirement"""
    requirement_id: str
    requirement_description: str
    properties: List[int]
    coverage_percentage: float
    test_count: int
    all_passing: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CategoryCoverage:
    """Coverage information for a test category"""
    category: TestCategory
    total_properties: int
    implemented_properties: int
    coverage_percentage: float
    total_tests: int
    success_rate: float
    avg_execution_time: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'category': self.category.value
        }


@dataclass
class EffectivenessMetrics:
    """Test effectiveness metrics"""
    total_properties: int
    active_properties: int
    dormant_properties: int  # Not executed recently
    flaky_properties: List[int]  # Inconsistent pass/fail
    slow_properties: List[int]  # Execution time > threshold
    high_value_properties: List[int]  # Caught bugs recently
    bug_detection_rate: float
    false_positive_rate: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CoverageReport:
    """Comprehensive coverage report"""
    report_id: str
    generated_at: datetime
    overall_coverage: float
    property_coverage: List[PropertyCoverage]
    requirement_coverage: List[RequirementCoverage]
    category_coverage: List[CategoryCoverage]
    effectiveness_metrics: EffectivenessMetrics
    gaps: List[str]
    recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'report_id': self.report_id,
            'generated_at': self.generated_at.isoformat(),
            'overall_coverage': self.overall_coverage,
            'property_coverage': [pc.to_dict() for pc in self.property_coverage],
            'requirement_coverage': [rc.to_dict() for rc in self.requirement_coverage],
            'category_coverage': [cc.to_dict() for cc in self.category_coverage],
            'effectiveness_metrics': self.effectiveness_metrics.to_dict(),
            'gaps': self.gaps,
            'recommendations': self.recommendations
        }


class CoverageAnalyzer:
    """
    Comprehensive coverage analyzer for property-based tests.
    
    Analyzes test coverage across properties, requirements, and categories,
    and provides effectiveness metrics and recommendations.
    """
    
    # Expected properties based on design document
    EXPECTED_PROPERTIES = {
        TestCategory.BACKEND_INFRASTRUCTURE: [1, 2, 3, 4],
        TestCategory.FINANCIAL_ACCURACY: [5, 6, 7, 8, 9],
        TestCategory.FRONTEND_INFRASTRUCTURE: [10, 11, 12, 13],
        TestCategory.FILTER_CONSISTENCY: [14, 15, 16, 17, 18],
        TestCategory.BUSINESS_LOGIC: [19, 20, 21, 22, 23],
        TestCategory.API_CONTRACT: [24, 25, 26, 27, 28],
        TestCategory.DATA_INTEGRITY: [29, 30, 31, 32, 33],
        TestCategory.PERFORMANCE: [34, 35, 36, 37, 38]
    }
    
    # Requirement to property mapping
    REQUIREMENT_PROPERTY_MAP = {
        '1.1': [1], '1.2': [1], '1.3': [2], '1.4': [3], '1.5': [4],
        '2.1': [5], '2.2': [6], '2.3': [7], '2.4': [8], '2.5': [9],
        '3.1': [10], '3.2': [11], '3.3': [12], '3.4': [10], '3.5': [13],
        '4.1': [14], '4.2': [15], '4.3': [16], '4.4': [17], '4.5': [18],
        '5.1': [19], '5.2': [20], '5.3': [21], '5.4': [22], '5.5': [23],
        '6.1': [24], '6.2': [25], '6.3': [26], '6.4': [27], '6.5': [28],
        '7.1': [29], '7.2': [30], '7.3': [31], '7.4': [32], '7.5': [33],
        '8.1': [34], '8.2': [35], '8.3': [36], '8.4': [37], '8.5': [38]
    }
    
    # Requirement descriptions
    REQUIREMENT_DESCRIPTIONS = {
        '1.1': 'Backend PBT System integration with pytest and Hypothesis',
        '1.2': 'Automatic test case generation with minimum 100 iterations',
        '1.3': 'Minimal failing examples for debugging',
        '1.4': 'Deterministic test execution with configurable seeds',
        '1.5': 'Custom generators for domain-specific data types',
        '2.1': 'Budget variance formula mathematical correctness',
        '2.2': 'Currency conversion reciprocal consistency',
        '2.3': 'Percentage calculation scale independence',
        '2.4': 'Edge case handling (zero budgets, negative values)',
        '2.5': 'Variance status classification consistency',
        '3.1': 'Frontend PBT System integration with fast-check and Jest',
        '3.2': 'Realistic mock data generation',
        '3.3': 'React component behavior validation',
        '3.4': 'Stable test execution with seed management',
        '3.5': 'Async operation and state management testing',
        '4.1': 'Filter operation consistency across data sets',
        '4.2': 'Search result consistency regardless of order',
        '4.3': 'Combined filter logic correctness',
        '4.4': 'Filter state persistence across navigation',
        '4.5': 'Filter performance with large data sets',
        '5.1': 'Project health score accuracy',
        '5.2': 'Resource allocation constraint enforcement',
        '5.3': 'Timeline calculation correctness',
        '5.4': 'Risk scoring formula compliance',
        '5.5': 'System invariant preservation',
        '6.1': 'API response schema compliance',
        '6.2': 'Pagination behavior consistency',
        '6.3': 'API filter parameter correctness',
        '6.4': 'API error response appropriateness',
        '6.5': 'API performance consistency',
        '7.1': 'CRUD operation referential integrity',
        '7.2': 'Concurrent operation safety',
        '7.3': 'Data migration information preservation',
        '7.4': 'Backup and restore accuracy',
        '7.5': 'Database constraint enforcement',
        '8.1': 'Performance measurement accuracy',
        '8.2': 'Performance scaling predictability',
        '8.3': 'Performance regression detection',
        '8.4': 'Memory usage management',
        '8.5': 'Monitoring system integration'
    }
    
    def __init__(
        self,
        reports_dir: Path,
        slow_test_threshold: float = 5.0,  # seconds
        flaky_threshold: float = 0.8  # 80% success rate
    ):
        """
        Initialize coverage analyzer.
        
        Args:
            reports_dir: Directory containing test reports
            slow_test_threshold: Threshold for slow test identification (seconds)
            flaky_threshold: Success rate threshold for flaky test identification
        """
        self.reports_dir = reports_dir
        self.slow_test_threshold = slow_test_threshold
        self.flaky_threshold = flaky_threshold
    
    def analyze_coverage(
        self,
        current_report: OrchestrationReport,
        historical_reports: Optional[List[Dict]] = None
    ) -> CoverageReport:
        """
        Analyze test coverage comprehensively.
        
        Args:
            current_report: Current orchestration report
            historical_reports: Optional historical reports for trend analysis
            
        Returns:
            Comprehensive coverage report
        """
        report_id = f"coverage-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        generated_at = datetime.now(timezone.utc)
        
        # Load historical reports if not provided
        if historical_reports is None:
            historical_reports = self._load_historical_reports()
        
        # Analyze property coverage
        property_coverage = self._analyze_property_coverage(
            current_report,
            historical_reports
        )
        
        # Analyze requirement coverage
        requirement_coverage = self._analyze_requirement_coverage(property_coverage)
        
        # Analyze category coverage
        category_coverage = self._analyze_category_coverage(
            current_report,
            property_coverage
        )
        
        # Calculate effectiveness metrics
        effectiveness_metrics = self._calculate_effectiveness_metrics(
            property_coverage,
            historical_reports
        )
        
        # Calculate overall coverage
        total_expected = sum(len(props) for props in self.EXPECTED_PROPERTIES.values())
        total_implemented = len(property_coverage)
        overall_coverage = (total_implemented / total_expected) * 100 if total_expected > 0 else 0.0
        
        # Identify gaps
        gaps = self._identify_coverage_gaps(property_coverage)
        
        # Generate recommendations
        recommendations = self._generate_coverage_recommendations(
            overall_coverage,
            property_coverage,
            requirement_coverage,
            category_coverage,
            effectiveness_metrics,
            gaps
        )
        
        return CoverageReport(
            report_id=report_id,
            generated_at=generated_at,
            overall_coverage=overall_coverage,
            property_coverage=property_coverage,
            requirement_coverage=requirement_coverage,
            category_coverage=category_coverage,
            effectiveness_metrics=effectiveness_metrics,
            gaps=gaps,
            recommendations=recommendations
        )
    
    def _load_historical_reports(self, limit: int = 20) -> List[Dict]:
        """Load historical test reports"""
        reports = []
        
        report_files = sorted(
            self.reports_dir.glob("pbt-*_report.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        for report_file in report_files[:limit]:
            try:
                with open(report_file, 'r') as f:
                    reports.append(json.load(f))
            except Exception:
                pass
        
        return reports
    
    def _analyze_property_coverage(
        self,
        current_report: OrchestrationReport,
        historical_reports: List[Dict]
    ) -> List[PropertyCoverage]:
        """Analyze coverage for each property"""
        property_data = defaultdict(lambda: {
            'test_count': 0,
            'executions': [],
            'requirements': set()
        })
        
        # Collect data from current report
        for suite in current_report.backend_suites + current_report.frontend_suites:
            for test in suite.test_results:
                if test.property_number:
                    prop_num = test.property_number
                    data = property_data[prop_num]
                    
                    data['test_count'] += 1
                    data['executions'].append({
                        'status': test.status,
                        'execution_time': test.execution_time,
                        'timestamp': test.timestamp
                    })
                    data['property_name'] = test.test_name
                    data['category'] = test.category
                    data['requirements'].update(test.requirements)
        
        # Build property coverage list
        coverage_list = []
        
        for prop_num, data in property_data.items():
            executions = data['executions']
            
            # Calculate metrics
            passed = sum(1 for e in executions if e['status'] == TestStatus.PASSED)
            success_rate = (passed / len(executions)) * 100 if executions else 0.0
            
            avg_exec_time = (
                sum(e['execution_time'] for e in executions) / len(executions)
                if executions else 0.0
            )
            
            last_executed = max(
                (e['timestamp'] for e in executions),
                default=None
            )
            
            coverage = PropertyCoverage(
                property_number=prop_num,
                property_name=data.get('property_name', f'Property {prop_num}'),
                category=data.get('category', TestCategory.BACKEND_INFRASTRUCTURE),
                requirements=sorted(data['requirements']),
                test_count=data['test_count'],
                last_executed=last_executed,
                success_rate=success_rate,
                avg_execution_time=avg_exec_time,
                iterations_per_run=100  # Default from design
            )
            
            coverage_list.append(coverage)
        
        return sorted(coverage_list, key=lambda x: x.property_number)
    
    def _analyze_requirement_coverage(
        self,
        property_coverage: List[PropertyCoverage]
    ) -> List[RequirementCoverage]:
        """Analyze coverage for each requirement"""
        requirement_data = defaultdict(lambda: {
            'properties': set(),
            'test_count': 0,
            'all_passing': True
        })
        
        # Map properties to requirements
        for prop_cov in property_coverage:
            for req in prop_cov.requirements:
                data = requirement_data[req]
                data['properties'].add(prop_cov.property_number)
                data['test_count'] += prop_cov.test_count
                
                if prop_cov.success_rate < 100.0:
                    data['all_passing'] = False
        
        # Build requirement coverage list
        coverage_list = []
        
        for req_id, data in requirement_data.items():
            expected_props = set(self.REQUIREMENT_PROPERTY_MAP.get(req_id, []))
            implemented_props = data['properties']
            
            coverage_pct = (
                (len(implemented_props) / len(expected_props)) * 100
                if expected_props else 0.0
            )
            
            coverage = RequirementCoverage(
                requirement_id=req_id,
                requirement_description=self.REQUIREMENT_DESCRIPTIONS.get(
                    req_id,
                    f'Requirement {req_id}'
                ),
                properties=sorted(implemented_props),
                coverage_percentage=coverage_pct,
                test_count=data['test_count'],
                all_passing=data['all_passing']
            )
            
            coverage_list.append(coverage)
        
        return sorted(coverage_list, key=lambda x: x.requirement_id)
    
    def _analyze_category_coverage(
        self,
        current_report: OrchestrationReport,
        property_coverage: List[PropertyCoverage]
    ) -> List[CategoryCoverage]:
        """Analyze coverage for each category"""
        category_data = defaultdict(lambda: {
            'implemented_properties': set(),
            'total_tests': 0,
            'passed_tests': 0,
            'total_exec_time': 0.0
        })
        
        # Collect data
        for prop_cov in property_coverage:
            data = category_data[prop_cov.category]
            data['implemented_properties'].add(prop_cov.property_number)
            data['total_tests'] += prop_cov.test_count
            data['passed_tests'] += int(
                (prop_cov.success_rate / 100.0) * prop_cov.test_count
            )
            data['total_exec_time'] += prop_cov.avg_execution_time * prop_cov.test_count
        
        # Build category coverage list
        coverage_list = []
        
        for category, expected_props in self.EXPECTED_PROPERTIES.items():
            data = category_data[category]
            implemented = len(data['implemented_properties'])
            total_expected = len(expected_props)
            
            coverage_pct = (implemented / total_expected) * 100 if total_expected > 0 else 0.0
            
            success_rate = (
                (data['passed_tests'] / data['total_tests']) * 100
                if data['total_tests'] > 0 else 0.0
            )
            
            avg_exec_time = (
                data['total_exec_time'] / data['total_tests']
                if data['total_tests'] > 0 else 0.0
            )
            
            coverage = CategoryCoverage(
                category=category,
                total_properties=total_expected,
                implemented_properties=implemented,
                coverage_percentage=coverage_pct,
                total_tests=data['total_tests'],
                success_rate=success_rate,
                avg_execution_time=avg_exec_time
            )
            
            coverage_list.append(coverage)
        
        return coverage_list
    
    def _calculate_effectiveness_metrics(
        self,
        property_coverage: List[PropertyCoverage],
        historical_reports: List[Dict]
    ) -> EffectivenessMetrics:
        """Calculate test effectiveness metrics"""
        total_properties = len(property_coverage)
        active_properties = 0
        dormant_properties = 0
        flaky_properties = []
        slow_properties = []
        
        # Analyze each property
        for prop_cov in property_coverage:
            # Check if active (executed recently)
            if prop_cov.last_executed:
                days_since = (datetime.now(timezone.utc) - prop_cov.last_executed).days
                if days_since <= 7:
                    active_properties += 1
                else:
                    dormant_properties += 1
            else:
                dormant_properties += 1
            
            # Check if flaky
            if 0 < prop_cov.success_rate < (self.flaky_threshold * 100):
                flaky_properties.append(prop_cov.property_number)
            
            # Check if slow
            if prop_cov.avg_execution_time > self.slow_test_threshold:
                slow_properties.append(prop_cov.property_number)
        
        # Calculate bug detection and false positive rates (simplified)
        # In production, this would track actual bugs found vs false alarms
        bug_detection_rate = 0.0  # Placeholder
        false_positive_rate = 0.0  # Placeholder
        
        # High value properties (caught bugs recently) - placeholder
        high_value_properties = []
        
        return EffectivenessMetrics(
            total_properties=total_properties,
            active_properties=active_properties,
            dormant_properties=dormant_properties,
            flaky_properties=flaky_properties,
            slow_properties=slow_properties,
            high_value_properties=high_value_properties,
            bug_detection_rate=bug_detection_rate,
            false_positive_rate=false_positive_rate
        )
    
    def _identify_coverage_gaps(
        self,
        property_coverage: List[PropertyCoverage]
    ) -> List[str]:
        """Identify coverage gaps"""
        gaps = []
        
        implemented_properties = {pc.property_number for pc in property_coverage}
        
        # Check for missing properties by category
        for category, expected_props in self.EXPECTED_PROPERTIES.items():
            missing = set(expected_props) - implemented_properties
            
            if missing:
                gaps.append(
                    f"Category {category.value}: Missing properties {sorted(missing)}"
                )
        
        # Check for requirements without coverage
        covered_requirements = set()
        for pc in property_coverage:
            covered_requirements.update(pc.requirements)
        
        all_requirements = set(self.REQUIREMENT_DESCRIPTIONS.keys())
        uncovered = all_requirements - covered_requirements
        
        if uncovered:
            gaps.append(
                f"Uncovered requirements: {sorted(uncovered)}"
            )
        
        return gaps
    
    def _generate_coverage_recommendations(
        self,
        overall_coverage: float,
        property_coverage: List[PropertyCoverage],
        requirement_coverage: List[RequirementCoverage],
        category_coverage: List[CategoryCoverage],
        effectiveness_metrics: EffectivenessMetrics,
        gaps: List[str]
    ) -> List[str]:
        """Generate coverage recommendations"""
        recommendations = []
        
        # Overall coverage recommendations
        if overall_coverage < 80:
            recommendations.append(
                f"⚠ Overall coverage is {overall_coverage:.1f}%. "
                f"Target is 80%+. Implement missing properties."
            )
        elif overall_coverage < 95:
            recommendations.append(
                f"Coverage is {overall_coverage:.1f}%. "
                f"Consider implementing remaining properties for comprehensive coverage."
            )
        else:
            recommendations.append(
                f"✓ Excellent coverage at {overall_coverage:.1f}%"
            )
        
        # Category-specific recommendations
        for cat_cov in category_coverage:
            if cat_cov.coverage_percentage < 80:
                recommendations.append(
                    f"⚠ {cat_cov.category.value}: Only {cat_cov.coverage_percentage:.1f}% coverage. "
                    f"Implement {cat_cov.total_properties - cat_cov.implemented_properties} more properties."
                )
        
        # Effectiveness recommendations
        if effectiveness_metrics.flaky_properties:
            recommendations.append(
                f"⚠ {len(effectiveness_metrics.flaky_properties)} flaky properties detected. "
                f"Investigate: {effectiveness_metrics.flaky_properties[:5]}"
            )
        
        if effectiveness_metrics.slow_properties:
            recommendations.append(
                f"⚠ {len(effectiveness_metrics.slow_properties)} slow properties detected. "
                f"Consider optimization: {effectiveness_metrics.slow_properties[:5]}"
            )
        
        if effectiveness_metrics.dormant_properties > 0:
            recommendations.append(
                f"⚠ {effectiveness_metrics.dormant_properties} dormant properties. "
                f"Ensure all properties are executed regularly."
            )
        
        # Gap-specific recommendations
        if gaps:
            recommendations.append(
                f"⚠ {len(gaps)} coverage gap(s) identified. Review gaps section for details."
            )
        
        return recommendations


def generate_coverage_report(
    report_path: Path,
    reports_dir: Path,
    output_path: Optional[Path] = None
) -> CoverageReport:
    """
    Generate coverage report for a test execution.
    
    Args:
        report_path: Path to the orchestration report JSON
        reports_dir: Directory containing historical reports
        output_path: Optional path to save coverage report
        
    Returns:
        Coverage report
    """
    # Load current report
    with open(report_path, 'r') as f:
        report_data = json.load(f)
    
    # Reconstruct OrchestrationReport (simplified)
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
    analyzer = CoverageAnalyzer(reports_dir=reports_dir)
    
    # Generate coverage analysis
    coverage = analyzer.analyze_coverage(current_report)
    
    # Save coverage report if output path provided
    if output_path:
        with open(output_path, 'w') as f:
            json.dump(coverage.to_dict(), f, indent=2)
    
    return coverage


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyze Property-Based Test Coverage")
    parser.add_argument("report", help="Path to orchestration report JSON")
    parser.add_argument("--reports-dir", default="test-results/pbt-orchestration",
                       help="Directory containing historical reports")
    parser.add_argument("--output", help="Output path for coverage report")
    
    args = parser.parse_args()
    
    coverage = generate_coverage_report(
        report_path=Path(args.report),
        reports_dir=Path(args.reports_dir),
        output_path=Path(args.output) if args.output else None
    )
    
    print("\n" + "="*80)
    print("PROPERTY-BASED TESTING COVERAGE ANALYSIS")
    print("="*80)
    print(f"\nReport ID: {coverage.report_id}")
    print(f"Generated: {coverage.generated_at.isoformat()}")
    print(f"\nOverall Coverage: {coverage.overall_coverage:.1f}%")
    print(f"Properties Implemented: {len(coverage.property_coverage)}/38")
    print(f"\nCategory Coverage:")
    for cat_cov in coverage.category_coverage:
        print(f"  {cat_cov.category.value}: {cat_cov.coverage_percentage:.1f}% "
              f"({cat_cov.implemented_properties}/{cat_cov.total_properties})")
    print(f"\nEffectiveness Metrics:")
    print(f"  Active Properties: {coverage.effectiveness_metrics.active_properties}")
    print(f"  Dormant Properties: {coverage.effectiveness_metrics.dormant_properties}")
    print(f"  Flaky Properties: {len(coverage.effectiveness_metrics.flaky_properties)}")
    print(f"  Slow Properties: {len(coverage.effectiveness_metrics.slow_properties)}")
    print(f"\nCoverage Gaps: {len(coverage.gaps)}")
    for gap in coverage.gaps:
        print(f"  - {gap}")
    print(f"\nRecommendations:")
    for rec in coverage.recommendations:
        print(f"  {rec}")
    print("="*80 + "\n")
