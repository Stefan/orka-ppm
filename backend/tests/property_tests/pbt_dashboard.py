"""
Property-Based Testing Dashboard and Monitoring Integration

This module provides dashboard generation and monitoring system integration
for property-based testing results, trends, and metrics.

Task: 13.3 Add test coverage analysis and reporting
Feature: property-based-testing
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

from pbt_orchestrator import TestStatus, TestCategory
from pbt_analysis import TrendDirection
from pbt_coverage import CoverageAnalyzer


class DashboardGenerator:
    """
    Generate HTML dashboards for property-based testing results.
    
    Creates interactive dashboards with charts, trends, and detailed metrics.
    """
    
    def __init__(self, reports_dir: Path, output_dir: Path):
        """
        Initialize dashboard generator.
        
        Args:
            reports_dir: Directory containing test reports
            output_dir: Directory for dashboard output
        """
        self.reports_dir = reports_dir
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_dashboard(
        self,
        latest_report_path: Path,
        latest_analysis_path: Optional[Path] = None,
        latest_coverage_path: Optional[Path] = None
    ) -> Path:
        """
        Generate comprehensive HTML dashboard.
        
        Args:
            latest_report_path: Path to latest orchestration report
            latest_analysis_path: Path to latest analysis report
            latest_coverage_path: Path to latest coverage report
            
        Returns:
            Path to generated dashboard HTML
        """
        # Load reports
        with open(latest_report_path, 'r') as f:
            report = json.load(f)
        
        analysis = None
        if latest_analysis_path and latest_analysis_path.exists():
            with open(latest_analysis_path, 'r') as f:
                analysis = json.load(f)
        
        coverage = None
        if latest_coverage_path and latest_coverage_path.exists():
            with open(latest_coverage_path, 'r') as f:
                coverage = json.load(f)
        
        # Generate HTML
        html = self._generate_html(report, analysis, coverage)
        
        # Save dashboard
        dashboard_path = self.output_dir / "pbt-dashboard.html"
        with open(dashboard_path, 'w') as f:
            f.write(html)
        
        return dashboard_path
    
    def _generate_html(
        self,
        report: Dict,
        analysis: Optional[Dict],
        coverage: Optional[Dict]
    ) -> str:
        """Generate HTML dashboard content"""
        
        # Extract key metrics
        total_tests = report.get('total_tests', 0)
        passed = report.get('total_passed', 0)
        failed = report.get('total_failed', 0)
        success_rate = report.get('overall_success_rate', 0.0)
        exec_time = report.get('total_execution_time', 0.0)
        status = report.get('overall_status', 'unknown')
        
        # Status color
        status_color = {
            'passed': '#28a745',
            'failed': '#dc3545',
            'error': '#ffc107'
        }.get(status, '#6c757d')
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Property-Based Testing Dashboard</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f7fa;
            color: #2c3e50;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        header {{
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        
        h1 {{
            color: #2c3e50;
            margin-bottom: 10px;
        }}
        
        .timestamp {{
            color: #7f8c8d;
            font-size: 14px;
        }}
        
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }}
        
        .metric-card {{
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        .metric-label {{
            font-size: 14px;
            color: #7f8c8d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }}
        
        .metric-value {{
            font-size: 36px;
            font-weight: bold;
            color: #2c3e50;
        }}
        
        .metric-subtitle {{
            font-size: 14px;
            color: #95a5a6;
            margin-top: 5px;
        }}
        
        .status-badge {{
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1px;
        }}
        
        .section {{
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        
        .section-title {{
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2c3e50;
        }}
        
        .progress-bar {{
            width: 100%;
            height: 30px;
            background: #ecf0f1;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }}
        
        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
        }}
        
        .trend-indicator {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }}
        
        .trend-improving {{
            background: #d4edda;
            color: #155724;
        }}
        
        .trend-stable {{
            background: #d1ecf1;
            color: #0c5460;
        }}
        
        .trend-degrading {{
            background: #f8d7da;
            color: #721c24;
        }}
        
        .recommendation {{
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #3498db;
            background: #f8f9fa;
            border-radius: 4px;
        }}
        
        .recommendation.warning {{
            border-left-color: #f39c12;
            background: #fff3cd;
        }}
        
        .recommendation.critical {{
            border-left-color: #e74c3c;
            background: #f8d7da;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }}
        
        th {{
            background: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
        }}
        
        tr:hover {{
            background: #f8f9fa;
        }}
        
        .chart-container {{
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🧪 Property-Based Testing Dashboard</h1>
            <div class="timestamp">
                Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
            </div>
        </header>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Overall Status</div>
                <div class="metric-value">
                    <span class="status-badge" style="background: {status_color}; color: white;">
                        {status.upper()}
                    </span>
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Total Tests</div>
                <div class="metric-value">{total_tests}</div>
                <div class="metric-subtitle">{passed} passed, {failed} failed</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Success Rate</div>
                <div class="metric-value">{success_rate:.1f}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {success_rate}%">
                        {success_rate:.1f}%
                    </div>
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Execution Time</div>
                <div class="metric-value">{exec_time:.1f}s</div>
                <div class="metric-subtitle">Total runtime</div>
            </div>
        </div>
"""
        
        # Add analysis section if available
        if analysis:
            html += self._generate_analysis_section(analysis)
        
        # Add coverage section if available
        if coverage:
            html += self._generate_coverage_section(coverage)
        
        # Add test suites section
        html += self._generate_suites_section(report)
        
        html += """
    </div>
</body>
</html>
"""
        
        return html
    
    def _generate_analysis_section(self, analysis: Dict) -> str:
        """Generate analysis section HTML"""
        success_trend = analysis.get('success_rate_trend', {})
        exec_trend = analysis.get('execution_time_trend', {})
        failure_patterns = analysis.get('failure_patterns', [])
        recommendations = analysis.get('recommendations', [])
        
        # Trend indicators
        success_trend_class = f"trend-{success_trend.get('trend_direction', 'stable')}"
        exec_trend_class = f"trend-{exec_trend.get('trend_direction', 'stable')}"
        
        html = f"""
        <div class="section">
            <div class="section-title">📊 Trend Analysis</div>
            
            <div style="margin: 20px 0;">
                <strong>Success Rate Trend:</strong>
                <span class="trend-indicator {success_trend_class}">
                    {success_trend.get('trend_direction', 'unknown').upper()}
                </span>
                <div style="margin-top: 10px; color: #7f8c8d;">
                    Current: {success_trend.get('current_value', 0):.1f}% | 
                    Previous: {success_trend.get('previous_value', 0):.1f}% | 
                    Change: {success_trend.get('change_percentage', 0):.1f}%
                </div>
            </div>
            
            <div style="margin: 20px 0;">
                <strong>Execution Time Trend:</strong>
                <span class="trend-indicator {exec_trend_class}">
                    {exec_trend.get('trend_direction', 'unknown').upper()}
                </span>
                <div style="margin-top: 10px; color: #7f8c8d;">
                    Current: {exec_trend.get('current_value', 0):.2f}s | 
                    Previous: {exec_trend.get('previous_value', 0):.2f}s | 
                    Change: {exec_trend.get('change_percentage', 0):.1f}%
                </div>
            </div>
"""
        
        if failure_patterns:
            html += """
            <div style="margin: 20px 0;">
                <strong>⚠️ Recurring Failure Patterns:</strong>
                <table>
                    <thead>
                        <tr>
                            <th>Test Name</th>
                            <th>Category</th>
                            <th>Frequency</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody>
"""
            for pattern in failure_patterns[:10]:
                html += f"""
                        <tr>
                            <td>{pattern.get('test_names', ['Unknown'])[0]}</td>
                            <td>{pattern.get('category', 'Unknown')}</td>
                            <td>{pattern.get('frequency', 0)}</td>
                            <td>{pattern.get('last_seen', 'Unknown')}</td>
                        </tr>
"""
            html += """
                    </tbody>
                </table>
            </div>
"""
        
        if recommendations:
            html += """
            <div style="margin: 20px 0;">
                <strong>💡 Recommendations:</strong>
"""
            for rec in recommendations:
                rec_class = "critical" if "CRITICAL" in rec else ("warning" if "⚠" in rec else "")
                html += f"""
                <div class="recommendation {rec_class}">{rec}</div>
"""
            html += """
            </div>
"""
        
        html += """
        </div>
"""
        
        return html
    
    def _generate_coverage_section(self, coverage: Dict) -> str:
        """Generate coverage section HTML"""
        overall_coverage = coverage.get('overall_coverage', 0.0)
        category_coverage = coverage.get('category_coverage', [])
        effectiveness = coverage.get('effectiveness_metrics', {})
        gaps = coverage.get('gaps', [])
        
        html = f"""
        <div class="section">
            <div class="section-title">📈 Coverage Analysis</div>
            
            <div style="margin: 20px 0;">
                <strong>Overall Coverage:</strong>
                <div class="progress-bar" style="height: 40px;">
                    <div class="progress-fill" style="width: {overall_coverage}%">
                        {overall_coverage:.1f}%
                    </div>
                </div>
            </div>
            
            <div style="margin: 20px 0;">
                <strong>Category Coverage:</strong>
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Coverage</th>
                            <th>Properties</th>
                            <th>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
"""
        
        for cat in category_coverage:
            html += f"""
                        <tr>
                            <td>{cat.get('category', 'Unknown')}</td>
                            <td>
                                <div class="progress-bar" style="height: 20px;">
                                    <div class="progress-fill" style="width: {cat.get('coverage_percentage', 0)}%; font-size: 11px;">
                                        {cat.get('coverage_percentage', 0):.0f}%
                                    </div>
                                </div>
                            </td>
                            <td>{cat.get('implemented_properties', 0)}/{cat.get('total_properties', 0)}</td>
                            <td>{cat.get('success_rate', 0):.1f}%</td>
                        </tr>
"""
        
        html += f"""
                    </tbody>
                </table>
            </div>
            
            <div style="margin: 20px 0;">
                <strong>Effectiveness Metrics:</strong>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #2ecc71;">
                            {effectiveness.get('active_properties', 0)}
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">Active Properties</div>
                    </div>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #f39c12;">
                            {effectiveness.get('dormant_properties', 0)}
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">Dormant Properties</div>
                    </div>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">
                            {len(effectiveness.get('flaky_properties', []))}
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">Flaky Properties</div>
                    </div>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #9b59b6;">
                            {len(effectiveness.get('slow_properties', []))}
                        </div>
                        <div style="font-size: 12px; color: #7f8c8d;">Slow Properties</div>
                    </div>
                </div>
            </div>
"""
        
        if gaps:
            html += """
            <div style="margin: 20px 0;">
                <strong>⚠️ Coverage Gaps:</strong>
                <ul style="margin-top: 10px; padding-left: 20px;">
"""
            for gap in gaps:
                html += f"""
                    <li style="margin: 5px 0;">{gap}</li>
"""
            html += """
                </ul>
            </div>
"""
        
        html += """
        </div>
"""
        
        return html
    
    def _generate_suites_section(self, report: Dict) -> str:
        """Generate test suites section HTML"""
        backend_suites = report.get('backend_suites', [])
        frontend_suites = report.get('frontend_suites', [])
        
        html = """
        <div class="section">
            <div class="section-title">🧪 Test Suites</div>
"""
        
        if backend_suites:
            html += """
            <h3 style="margin: 20px 0 10px 0;">Backend Suites</h3>
            <table>
                <thead>
                    <tr>
                        <th>Suite Name</th>
                        <th>Category</th>
                        <th>Tests</th>
                        <th>Success Rate</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
"""
            for suite in backend_suites:
                html += f"""
                    <tr>
                        <td>{suite.get('suite_name', 'Unknown')}</td>
                        <td>{suite.get('category', 'Unknown')}</td>
                        <td>{suite.get('passed', 0)}/{suite.get('total_tests', 0)}</td>
                        <td>{suite.get('success_rate', 0):.1f}%</td>
                        <td>{suite.get('execution_time', 0):.2f}s</td>
                    </tr>
"""
            html += """
                </tbody>
            </table>
"""
        
        if frontend_suites:
            html += """
            <h3 style="margin: 20px 0 10px 0;">Frontend Suites</h3>
            <table>
                <thead>
                    <tr>
                        <th>Suite Name</th>
                        <th>Category</th>
                        <th>Tests</th>
                        <th>Success Rate</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
"""
            for suite in frontend_suites:
                html += f"""
                    <tr>
                        <td>{suite.get('suite_name', 'Unknown')}</td>
                        <td>{suite.get('category', 'Unknown')}</td>
                        <td>{suite.get('passed', 0)}/{suite.get('total_tests', 0)}</td>
                        <td>{suite.get('success_rate', 0):.1f}%</td>
                        <td>{suite.get('execution_time', 0):.2f}s</td>
                    </tr>
"""
            html += """
                </tbody>
            </table>
"""
        
        html += """
        </div>
"""
        
        return html


def generate_dashboard(
    reports_dir: str = "test-results/pbt-orchestration",
    output_dir: str = "test-results/pbt-dashboard"
) -> Path:
    """
    Generate property-based testing dashboard.
    
    Args:
        reports_dir: Directory containing test reports
        output_dir: Directory for dashboard output
        
    Returns:
        Path to generated dashboard
    """
    reports_path = Path(reports_dir)
    output_path = Path(output_dir)
    
    # Find latest reports
    report_files = sorted(
        reports_path.glob("pbt-*_report.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    
    if not report_files:
        raise FileNotFoundError("No test reports found")
    
    latest_report = report_files[0]
    
    # Find corresponding analysis and coverage reports
    analysis_dir = reports_path.parent / "pbt-analysis"
    coverage_dir = reports_path.parent / "pbt-coverage"
    
    latest_analysis = analysis_dir / "latest_analysis.json" if analysis_dir.exists() else None
    latest_coverage = coverage_dir / "latest_coverage.json" if coverage_dir.exists() else None
    
    # Generate dashboard
    generator = DashboardGenerator(reports_path, output_path)
    dashboard_path = generator.generate_dashboard(
        latest_report,
        latest_analysis,
        latest_coverage
    )
    
    print(f"Dashboard generated: {dashboard_path}")
    return dashboard_path


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate Property-Based Testing Dashboard")
    parser.add_argument("--reports-dir", default="test-results/pbt-orchestration",
                       help="Directory containing test reports")
    parser.add_argument("--output-dir", default="test-results/pbt-dashboard",
                       help="Directory for dashboard output")
    
    args = parser.parse_args()
    
    dashboard_path = generate_dashboard(
        reports_dir=args.reports_dir,
        output_dir=args.output_dir
    )
    
    print(f"\n✓ Dashboard generated successfully!")
    print(f"  Open: {dashboard_path}")
