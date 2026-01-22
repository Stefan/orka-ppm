# Property-Based Testing Orchestration System

Comprehensive test orchestration, analysis, and reporting system for property-based tests across backend (Python/pytest/Hypothesis) and frontend (TypeScript/Jest/fast-check) components.

## Overview

The orchestration system provides:

- **Unified Test Execution**: Coordinate backend and frontend property tests
- **Result Aggregation**: Collect and aggregate results from all test suites
- **Trend Analysis**: Track success rates, execution times, and failure patterns
- **Coverage Analysis**: Monitor property and requirement coverage
- **Performance Regression Detection**: Automatically detect performance degradations
- **CI/CD Integration**: Seamless integration with GitHub Actions and git hooks
- **Interactive Dashboards**: HTML dashboards with charts and metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Test Orchestrator                          │
│  - Coordinates backend/frontend test execution               │
│  - Manages parallel/sequential execution                     │
│  - Aggregates results from all suites                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼───────┐
│  Backend Tests │                    │ Frontend Tests │
│  (pytest +     │                    │ (Jest +        │
│   Hypothesis)  │                    │  fast-check)   │
└───────┬────────┘                    └────────┬───────┘
        │                                      │
        └───────────────────┬──────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │                                       │
┌───────▼────────┐  ┌──────────────┐  ┌───────▼────────┐
│   Analysis     │  │   Coverage   │  │   Dashboard    │
│   Engine       │  │   Analyzer   │  │   Generator    │
│                │  │              │  │                │
│ - Trends       │  │ - Property   │  │ - HTML         │
│ - Patterns     │  │   coverage   │  │   reports      │
│ - Regressions  │  │ - Requirement│  │ - Metrics      │
│                │  │   coverage   │  │ - Charts       │
└────────────────┘  └──────────────┘  └────────────────┘
```

## Components

### 1. Test Orchestrator (`pbt_orchestrator.py`)

Main orchestration engine that coordinates test execution.

**Features:**
- Parallel/sequential execution modes
- Backend and frontend test coordination
- Result aggregation and reporting
- JSON and text report generation

**Usage:**
```bash
# Run all tests
python pbt_orchestrator.py --output-dir test-results/pbt

# Backend only
python pbt_orchestrator.py --backend-only

# Frontend only
python pbt_orchestrator.py --frontend-only

# Sequential execution
python pbt_orchestrator.py --sequential

# Quiet mode
python pbt_orchestrator.py --quiet
```

**Programmatic Usage:**
```python
from pbt_orchestrator import run_orchestration

report = await run_orchestration(
    backend_test_dir="backend/tests/property_tests",
    frontend_test_dir="__tests__",
    output_dir="test-results/pbt",
    parallel=True,
    verbose=True
)

print(f"Success Rate: {report.overall_success_rate}%")
```

### 2. Analysis Engine (`pbt_analysis.py`)

Analyzes test results for trends, patterns, and regressions.

**Features:**
- Success rate trend analysis
- Execution time trend analysis
- Failure pattern detection
- Performance regression detection
- Actionable recommendations

**Usage:**
```bash
# Analyze latest report
python pbt_analysis.py test-results/pbt/pbt-20260121-120000_report.json \
    --reports-dir test-results/pbt \
    --output test-results/analysis.json
```

**Programmatic Usage:**
```python
from pbt_analysis import TestResultAnalyzer

analyzer = TestResultAnalyzer(reports_dir=Path("test-results/pbt"))
analysis = analyzer.analyze_latest_report(current_report)

print(f"Trend: {analysis.success_rate_trend.trend_direction}")
print(f"Failure Patterns: {len(analysis.failure_patterns)}")
```

### 3. Coverage Analyzer (`pbt_coverage.py`)

Analyzes property and requirement coverage.

**Features:**
- Property coverage tracking
- Requirement coverage mapping
- Category coverage analysis
- Effectiveness metrics (flaky, slow, dormant tests)
- Gap identification

**Usage:**
```bash
# Analyze coverage
python pbt_coverage.py test-results/pbt/pbt-20260121-120000_report.json \
    --reports-dir test-results/pbt \
    --output test-results/coverage.json
```

**Programmatic Usage:**
```python
from pbt_coverage import CoverageAnalyzer

analyzer = CoverageAnalyzer(reports_dir=Path("test-results/pbt"))
coverage = analyzer.analyze_coverage(current_report)

print(f"Overall Coverage: {coverage.overall_coverage}%")
print(f"Flaky Properties: {coverage.effectiveness_metrics.flaky_properties}")
```

### 4. Dashboard Generator (`pbt_dashboard.py`)

Generates interactive HTML dashboards.

**Features:**
- Visual metrics and charts
- Trend indicators
- Coverage visualization
- Failure pattern tables
- Recommendations display

**Usage:**
```bash
# Generate dashboard
python pbt_dashboard.py \
    --reports-dir test-results/pbt \
    --output-dir test-results/dashboard
```

**Output:**
- `pbt-dashboard.html` - Interactive HTML dashboard

## CI/CD Integration

### GitHub Actions Workflow

The orchestration system integrates with GitHub Actions via `.github/workflows/pbt-orchestration.yml`.

**Features:**
- Automatic execution on push/PR
- Scheduled nightly comprehensive testing
- Performance regression detection
- PR comments with results
- Artifact upload for historical tracking

**Workflow Triggers:**
- Push to main/develop branches
- Pull requests
- Daily schedule (2 AM UTC)
- Manual workflow dispatch

**Workflow Outputs:**
- Test results artifacts
- Analysis reports
- Coverage reports
- GitHub step summaries
- PR comments

### Git Hooks

Pre-push hook for local testing before pushing code.

**Installation:**
```bash
cp scripts/git-hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

**Features:**
- Runs tests on changed code
- Prevents push if tests fail
- Can be bypassed with `--no-verify`

### Automated Test Execution

Script for running tests based on code changes.

**Usage:**
```bash
# Run tests on changes between commits
./scripts/run-pbt-on-changes.sh HEAD~1 HEAD

# Force run all tests
./scripts/run-pbt-on-changes.sh --force-all

# Compare with specific refs
./scripts/run-pbt-on-changes.sh --base main --head feature-branch
```

**Features:**
- Detects changed files
- Determines relevant test scope
- Runs appropriate test categories
- Generates summary reports

## Reports and Artifacts

### Orchestration Report

JSON report with complete test execution results.

**Location:** `test-results/pbt-orchestration/pbt-{timestamp}_report.json`

**Contents:**
- Execution metadata
- Overall status and metrics
- Backend suite results
- Frontend suite results
- Individual test results

### Analysis Report

JSON report with trend analysis and recommendations.

**Location:** `test-results/pbt-analysis/latest_analysis.json`

**Contents:**
- Success rate trends
- Execution time trends
- Failure patterns
- Coverage analysis
- Recommendations

### Coverage Report

JSON report with coverage metrics.

**Location:** `test-results/pbt-coverage/latest_coverage.json`

**Contents:**
- Overall coverage percentage
- Property coverage details
- Requirement coverage mapping
- Category coverage breakdown
- Effectiveness metrics
- Coverage gaps

### Dashboard

Interactive HTML dashboard.

**Location:** `test-results/pbt-dashboard/pbt-dashboard.html`

**Features:**
- Visual metrics display
- Trend charts
- Coverage visualization
- Failure pattern tables
- Recommendations

## Configuration

### Test Suite Registration

Register test suites in the orchestrator:

```python
orchestrator = TestOrchestrator(...)

# Backend suites
orchestrator.register_backend_suite(
    "test_financial_variance_accuracy",
    TestCategory.FINANCIAL_ACCURACY
)

# Frontend suites
orchestrator.register_frontend_suite(
    "ui-consistency.property",
    TestCategory.FILTER_CONSISTENCY
)
```

### Performance Thresholds

Configure performance regression thresholds:

```python
analyzer = TestResultAnalyzer(
    reports_dir=Path("test-results/pbt"),
    performance_threshold=10.0,  # 10% degradation threshold
    min_reports_for_trend=3      # Minimum reports for trend analysis
)
```

### Coverage Thresholds

Configure coverage analysis thresholds:

```python
analyzer = CoverageAnalyzer(
    reports_dir=Path("test-results/pbt"),
    slow_test_threshold=5.0,     # 5 seconds
    flaky_threshold=0.8          # 80% success rate
)
```

## Best Practices

### 1. Regular Execution

- Run orchestration on every commit (via git hooks)
- Run comprehensive tests nightly (via scheduled workflow)
- Review dashboards regularly

### 2. Trend Monitoring

- Monitor success rate trends
- Watch for performance regressions
- Address recurring failure patterns promptly

### 3. Coverage Maintenance

- Maintain >80% overall coverage
- Implement missing properties
- Address coverage gaps

### 4. Performance Optimization

- Investigate slow properties (>5s)
- Optimize flaky tests
- Parallelize where possible

### 5. Failure Response

- Fix critical failures immediately
- Investigate recurring patterns
- Update tests for false positives

## Troubleshooting

### Tests Not Running

**Issue:** Orchestrator doesn't find tests

**Solution:**
- Verify test file paths
- Check test suite registration
- Ensure test files follow naming convention

### Performance Regression False Positives

**Issue:** Performance regression detected incorrectly

**Solution:**
- Adjust `performance_threshold` setting
- Increase `min_reports_for_trend`
- Review historical data for anomalies

### Coverage Gaps

**Issue:** Coverage percentage lower than expected

**Solution:**
- Implement missing properties
- Verify property number extraction
- Check requirement mapping

### Dashboard Not Generating

**Issue:** Dashboard HTML not created

**Solution:**
- Verify report files exist
- Check output directory permissions
- Review error logs

## Maintenance

### Adding New Test Suites

1. Create test file following naming convention
2. Register suite in orchestrator
3. Map to appropriate category
4. Update CI/CD workflow if needed

### Updating Property Mappings

1. Update `EXPECTED_PROPERTIES` in `pbt_coverage.py`
2. Update `REQUIREMENT_PROPERTY_MAP`
3. Update `REQUIREMENT_DESCRIPTIONS`
4. Regenerate coverage reports

### Extending Analysis

1. Add new metrics to analysis engine
2. Update report data structures
3. Extend dashboard visualization
4. Update documentation

## Support

For issues or questions:

1. Check this documentation
2. Review test execution logs
3. Examine generated reports
4. Consult design document: `.kiro/specs/property-based-testing/design.md`

## Related Documentation

- [Property-Based Testing Design](../.kiro/specs/property-based-testing/design.md)
- [Property-Based Testing Requirements](../.kiro/specs/property-based-testing/requirements.md)
- [Property-Based Testing Tasks](../.kiro/specs/property-based-testing/tasks.md)
- [GitHub Actions Workflow](../../.github/workflows/pbt-orchestration.yml)

## Version History

- **v1.0.0** (2026-01-21): Initial orchestration system implementation
  - Test orchestrator with parallel execution
  - Analysis engine with trend detection
  - Coverage analyzer with effectiveness metrics
  - Dashboard generator with HTML reports
  - CI/CD integration with GitHub Actions
  - Automated test execution scripts
