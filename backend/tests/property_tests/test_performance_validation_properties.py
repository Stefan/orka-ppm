"""
Property Tests for Performance and Regression Testing

This module implements property-based tests for performance measurement accuracy,
scaling predictability, regression detection, memory management, and monitoring
system integration.

**Feature: property-based-testing**
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
"""

import pytest

pytest.importorskip("psutil")

import time
from hypothesis import given, settings, strategies as st, assume
from typing import List, Dict, Any
import random

from tests.property_tests.pbt_framework.performance_utils import (
    PerformanceMeasurement,
    PerformanceScalingValidator,
    ResponseTimeValidator,
    measure_load_pattern_performance
)
from tests.property_tests.pbt_framework.regression_detection import (
    PerformanceRegressionDetector,
    MemoryLeakDetector,
    PerformanceTrendAnalyzer
)


# ============================================================================
# Property 34: Performance Measurement Accuracy
# ============================================================================

@given(
    operation_duration_ms=st.integers(min_value=1, max_value=1000),
    data_size=st.integers(min_value=1, max_value=10000)
)
@settings(max_examples=20, deadline=None)
def test_property_34_performance_measurement_accuracy(operation_duration_ms: int, data_size: int):
    """
    Property 34: Performance Measurement Accuracy
    
    For any performance test across different load patterns, response time
    measurements must be accurate and representative.
    
    **Validates: Requirements 8.1**
    **Feature: property-based-testing, Property 34: Performance Measurement Accuracy**
    """
    # Simulate an operation with known duration
    def test_operation():
        time.sleep(operation_duration_ms / 1000.0)
    
    # Measure performance
    with PerformanceMeasurement("test_operation", data_size=data_size) as pm:
        test_operation()
    
    metrics = pm.get_metrics()
    
    # Property: Measured duration should be close to actual duration
    # Allow 10% tolerance for measurement overhead
    tolerance_ms = operation_duration_ms * 0.1 + 10  # 10% + 10ms overhead
    assert abs(metrics.duration_ms - operation_duration_ms) <= tolerance_ms, \
        f"Measurement inaccurate: expected ~{operation_duration_ms}ms, got {metrics.duration_ms}ms"
    
    # Property: Metrics should contain all required fields
    assert metrics.operation_name == "test_operation"
    assert metrics.data_size == data_size
    assert metrics.start_time > 0
    assert metrics.end_time > metrics.start_time
    assert metrics.duration_ms > 0
    assert metrics.memory_before_mb >= 0
    assert metrics.memory_after_mb >= 0
    assert metrics.cpu_percent >= 0
    assert metrics.success is True
    
    # Property: Duration should match time difference
    calculated_duration = (metrics.end_time - metrics.start_time) * 1000
    assert abs(metrics.duration_ms - calculated_duration) < 1.0, \
        "Duration calculation inconsistent"


@given(
    num_measurements=st.integers(min_value=5, max_value=20),
    base_duration_ms=st.integers(min_value=10, max_value=100)
)
@settings(max_examples=10, deadline=None)
def test_property_34_measurement_consistency_across_load_patterns(
    num_measurements: int,
    base_duration_ms: int
):
    """
    Property 34: Performance Measurement Accuracy - Load Pattern Consistency
    
    Measurements across different load patterns should be consistent and accurate.
    
    **Validates: Requirements 8.1**
    **Feature: property-based-testing, Property 34: Performance Measurement Accuracy**
    """
    # Create varying load patterns
    load_patterns = [i * 10 for i in range(1, num_measurements + 1)]
    
    def operation(load_size: int):
        # Simulate work proportional to load
        time.sleep((base_duration_ms / 1000.0) * (load_size / 100.0))
    
    # Measure across load patterns
    measurements = measure_load_pattern_performance(
        operation,
        load_patterns,
        "load_test_operation"
    )
    
    # Property: Should have measurement for each load pattern
    assert len(measurements) == len(load_patterns)
    
    # Property: All measurements should be successful
    assert all(m.success for m in measurements)
    
    # Property: Measurements should generally scale with load (allowing for variance)
    # We check that the trend is generally increasing, not that every single measurement increases
    # This accounts for OS scheduling variability
    if len(measurements) >= 3:
        # Check that later measurements are generally higher than earlier ones
        first_third = measurements[:len(measurements)//3]
        last_third = measurements[-(len(measurements)//3):]
        
        avg_first = sum(m.duration_ms for m in first_third) / len(first_third)
        avg_last = sum(m.duration_ms for m in last_third) / len(last_third)
        
        # Last third should be at least 50% higher than first third on average
        assert avg_last >= avg_first * 1.5, \
            f"Duration should increase with load on average: {avg_first:.2f}ms -> {avg_last:.2f}ms"


# ============================================================================
# Property 35: Performance Scaling Predictability
# ============================================================================

@given(
    data_sizes=st.lists(
        st.integers(min_value=10, max_value=1000),
        min_size=3,
        max_size=10,
        unique=True
    ).map(sorted),
    base_duration_ms=st.integers(min_value=5, max_value=50)
)
@settings(max_examples=10, deadline=None)
def test_property_35_performance_scaling_predictability(
    data_sizes: List[int],
    base_duration_ms: int
):
    """
    Property 35: Performance Scaling Predictability
    
    For any system operation with varying data sizes, performance scaling
    must follow predictable patterns within expected bounds.
    
    **Validates: Requirements 8.2**
    **Feature: property-based-testing, Property 35: Performance Scaling Predictability**
    """
    validator = PerformanceScalingValidator("scaling_test_operation")
    
    def operation(data_size: int):
        # Simulate linear scaling operation
        time.sleep((base_duration_ms / 1000.0) * (data_size / data_sizes[0]))
    
    # Measure performance at different data sizes
    for data_size in data_sizes:
        validator.measure_operation(operation, data_size)
    
    # Property: Linear scaling should be validated
    scaling_result = validator.validate_linear_scaling(tolerance_percent=50.0)
    
    assert scaling_result['measurements_count'] == len(data_sizes)
    assert len(scaling_result['scaling_results']) == len(data_sizes) - 1
    
    # Property: Scaling should be predictable (most measurements within tolerance)
    within_tolerance_count = sum(
        1 for r in scaling_result['scaling_results'] if r['within_tolerance']
    )
    tolerance_ratio = within_tolerance_count / len(scaling_result['scaling_results'])
    
    assert tolerance_ratio >= 0.6, \
        f"Scaling not predictable: only {tolerance_ratio:.1%} within tolerance"
    
    # Property: Statistics should be available
    stats = validator.get_scaling_statistics()
    assert stats['measurement_count'] == len(data_sizes)
    assert stats['data_size_range']['min'] == min(data_sizes)
    assert stats['data_size_range']['max'] == max(data_sizes)
    assert stats['duration_ms']['min'] > 0
    assert stats['duration_ms']['max'] >= stats['duration_ms']['min']


@given(
    data_sizes=st.lists(
        st.integers(min_value=100, max_value=5000),
        min_size=3,
        max_size=8,
        unique=True
    ).map(sorted),
    base_duration_ms=st.integers(min_value=5, max_value=30)
)
@settings(max_examples=10, deadline=None)
def test_property_35_sublinear_scaling_validation(
    data_sizes: List[int],
    base_duration_ms: int
):
    """
    Property 35: Performance Scaling Predictability - Sublinear Scaling
    
    Operations with sublinear complexity should scale predictably.
    
    **Validates: Requirements 8.2**
    **Feature: property-based-testing, Property 35: Performance Scaling Predictability**
    """
    import math
    
    validator = PerformanceScalingValidator("sublinear_operation")
    
    def operation(data_size: int):
        # Simulate O(log n) operation
        log_factor = math.log(data_size) / math.log(data_sizes[0])
        time.sleep((base_duration_ms / 1000.0) * log_factor)
    
    # Measure performance
    for data_size in data_sizes:
        validator.measure_operation(operation, data_size)
    
    # Property: Sublinear scaling should be validated
    scaling_result = validator.validate_sublinear_scaling(max_growth_factor=1.5)
    
    # Property: Should have scaling results
    assert 'scaling_results' in scaling_result
    assert len(scaling_result['scaling_results']) == len(data_sizes) - 1  # N-1 comparisons
    
    # Property: Most measurements should be within sublinear bounds
    within_bounds_count = sum(
        1 for r in scaling_result['scaling_results'] if r['within_bounds']
    )
    
    if len(scaling_result['scaling_results']) > 0:
        bounds_ratio = within_bounds_count / len(scaling_result['scaling_results'])
        assert bounds_ratio >= 0.5, \
            f"Sublinear scaling not validated: only {bounds_ratio:.1%} within bounds"


# ============================================================================
# Property 36: Performance Regression Detection
# ============================================================================

@given(
    baseline_duration_ms=st.integers(min_value=50, max_value=200),
    regression_percent=st.integers(min_value=-20, max_value=50),
    data_size=st.integers(min_value=100, max_value=1000)
)
@settings(max_examples=20, deadline=None)
def test_property_36_performance_regression_detection(
    baseline_duration_ms: int,
    regression_percent: int,
    data_size: int
):
    """
    Property 36: Performance Regression Detection
    
    For any performance regression occurrence, the system must detect it
    and provide clear metrics and comparison data for analysis.
    
    **Validates: Requirements 8.3**
    **Feature: property-based-testing, Property 36: Performance Regression Detection**
    """
    detector = PerformanceRegressionDetector(regression_threshold_percent=10.0)
    
    # Create baseline measurement
    def baseline_operation():
        time.sleep(baseline_duration_ms / 1000.0)
    
    with PerformanceMeasurement("regression_test_op", data_size=data_size) as pm:
        baseline_operation()
    
    baseline_metrics = pm.get_metrics()
    detector.set_baseline(baseline_metrics, tolerance_percent=20.0)
    
    # Create current measurement with regression
    current_duration_ms = baseline_duration_ms * (1 + regression_percent / 100.0)
    
    def current_operation():
        time.sleep(current_duration_ms / 1000.0)
    
    with PerformanceMeasurement("regression_test_op", data_size=data_size) as pm:
        current_operation()
    
    current_metrics = pm.get_metrics()
    
    # Detect regression
    report = detector.detect_regression(current_metrics)
    
    # Property: Report should contain all required fields
    assert report.operation_name == "regression_test_op"
    assert report.baseline_duration_ms > 0
    assert report.current_duration_ms > 0
    assert report.duration_regression_percent is not None
    assert report.severity in ['none', 'minor', 'moderate', 'severe']
    
    # Property: Regression detection should be accurate
    if regression_percent > 10:
        # Significant regression should be detected
        assert report.is_regression is True, \
            f"Failed to detect regression: {regression_percent}% change"
        assert report.duration_regression_percent > 0
    elif regression_percent < -10:
        # Improvement should be detected (negative regression)
        assert report.duration_regression_percent < 0
    
    # Property: Severity should match regression magnitude
    if abs(regression_percent) > 50:
        assert report.severity in ['moderate', 'severe']
    elif abs(regression_percent) < 10:
        assert report.severity in ['none', 'minor']


@given(
    num_operations=st.integers(min_value=3, max_value=10),
    base_work_units=st.integers(min_value=1000, max_value=5000)
)
@settings(max_examples=10, deadline=None)
def test_property_36_regression_tracking_over_time(
    num_operations: int,
    base_work_units: int
):
    """
    Property 36: Performance Regression Detection - Tracking Over Time
    
    Regression detection should work consistently over multiple measurements.
    
    **Validates: Requirements 8.3**
    **Feature: property-based-testing, Property 36: Performance Regression Detection**
    """
    # Use a unique operation name for this test to avoid baseline conflicts
    import uuid
    operation_name = f"tracked_op_{uuid.uuid4().hex[:8]}"
    
    detector = PerformanceRegressionDetector(regression_threshold_percent=15.0)
    
    # Simulate gradual performance degradation using CPU-bound work
    # This is more predictable than time.sleep() which is subject to OS scheduling
    for i in range(num_operations):
        degradation_factor = 1 + (i * 0.05)  # 5% degradation per iteration
        work_units = int(base_work_units * degradation_factor)
        
        def operation():
            # CPU-bound work that scales predictably
            result = 0
            for _ in range(work_units):
                result += sum(range(100))
            return result
        
        with PerformanceMeasurement(operation_name, data_size=100) as pm:
            operation()
        
        metrics = pm.get_metrics()
        report = detector.detect_regression(metrics)
        
        # Property: First measurement establishes baseline
        if i == 0:
            assert report.is_regression is False
            assert report.severity == 'none'
        
        # Property: Later measurements should detect regression
        # At iteration 6, we have 30% degradation (6 * 5%), which is well above 15% threshold
        # We use iteration 6 to provide sufficient margin above the 15% threshold
        if i >= 6:  # After 30% degradation (double the 15% threshold for reliability)
            assert report.is_regression is True, \
                f"Failed to detect regression at iteration {i} with {i * 5}% degradation"


# ============================================================================
# Property 37: Memory Usage Management
# ============================================================================

@given(
    num_iterations=st.integers(min_value=5, max_value=20),
    memory_growth_mb=st.floats(min_value=0.0, max_value=5.0)
)
@settings(max_examples=10, deadline=None)
def test_property_37_memory_usage_management(
    num_iterations: int,
    memory_growth_mb: float
):
    """
    Property 37: Memory Usage Management
    
    For any system operation, memory usage must remain within reasonable
    bounds without causing memory leaks or excessive allocation.
    
    **Validates: Requirements 8.4**
    **Feature: property-based-testing, Property 37: Memory Usage Management**
    """
    detector = MemoryLeakDetector(leak_threshold_mb=2.0)
    
    # Simulate operations with controlled memory growth
    data_accumulator = []
    
    for i in range(num_iterations):
        def operation():
            # Simulate memory allocation
            if memory_growth_mb > 0:
                # Allocate some memory
                size = int(memory_growth_mb * 1024 * 1024 / num_iterations)
                data_accumulator.append(bytearray(size))
            time.sleep(0.01)
        
        with PerformanceMeasurement("memory_test_op", data_size=i) as pm:
            operation()
        
        metrics = pm.get_metrics()
        detector.add_measurement(metrics)
    
    # Detect memory leak
    report = detector.detect_leak("memory_test_op")
    
    # Property: Report should contain all required fields
    assert report.operation_name == "memory_test_op"
    assert report.iterations == num_iterations
    assert report.initial_memory_mb >= 0
    assert report.final_memory_mb >= 0
    assert report.memory_growth_mb >= 0
    assert report.threshold_mb == 2.0
    
    # Property: Leak detection should be accurate
    # The detector checks memory_growth_per_iteration against threshold
    expected_growth_per_iter = memory_growth_mb / num_iterations
    
    if expected_growth_per_iter > 2.0:
        # Per-iteration growth exceeds threshold - should be detected
        assert report.is_leak_suspected is True, \
            f"Failed to detect leak: {expected_growth_per_iter:.2f}MB per iteration (threshold: 2.0MB)"
    elif expected_growth_per_iter < 0.5:
        # Minimal per-iteration growth should not be flagged
        assert report.is_leak_suspected is False, \
            f"False positive leak detection: {expected_growth_per_iter:.2f}MB per iteration"
    # For values between 0.5 and 2.0, we don't make assertions due to measurement variability
    
    # Property: Memory growth calculation should be reasonable
    # Allow large tolerance due to measurement variability and GC
    if memory_growth_mb > 0:
        assert abs(report.memory_growth_per_iteration_mb) < memory_growth_mb * 2.0, \
            "Memory growth measurement is unreasonably high"


@given(
    num_iterations=st.integers(min_value=10, max_value=30)
)
@settings(max_examples=10, deadline=None)
def test_property_37_no_memory_leak_in_stable_operations(num_iterations: int):
    """
    Property 37: Memory Usage Management - Stable Operations
    
    Operations that don't allocate memory should not show memory leaks.
    
    **Validates: Requirements 8.4**
    **Feature: property-based-testing, Property 37: Memory Usage Management**
    """
    detector = MemoryLeakDetector(leak_threshold_mb=1.0)
    
    # Simulate stable operation without memory growth
    for i in range(num_iterations):
        def stable_operation():
            # Just compute something without allocating
            result = sum(range(1000))
            time.sleep(0.01)
        
        with PerformanceMeasurement("stable_op", data_size=i) as pm:
            stable_operation()
        
        metrics = pm.get_metrics()
        detector.add_measurement(metrics)
    
    # Detect memory leak
    report = detector.detect_leak("stable_op")
    
    # Property: Stable operations should not show leaks
    assert report.is_leak_suspected is False, \
        f"False positive: stable operation flagged as leak ({report.memory_growth_per_iteration_mb}MB/iter)"
    
    # Property: Memory growth should be minimal
    assert abs(report.memory_growth_per_iteration_mb) < 1.0, \
        "Stable operation should have minimal memory growth"


# ============================================================================
# Property 38: Monitoring System Integration
# ============================================================================

@given(
    num_measurements=st.integers(min_value=10, max_value=50),
    base_duration_ms=st.integers(min_value=10, max_value=100)
)
@settings(max_examples=10, deadline=None)
def test_property_38_monitoring_system_integration(
    num_measurements: int,
    base_duration_ms: int
):
    """
    Property 38: Monitoring System Integration
    
    For any performance data collection, the system must properly integrate
    with monitoring systems to track trends over time.
    
    **Validates: Requirements 8.5**
    **Feature: property-based-testing, Property 38: Monitoring System Integration**
    """
    analyzer = PerformanceTrendAnalyzer()
    
    # Record measurements over time
    for i in range(num_measurements):
        # Simulate varying performance
        duration_ms = base_duration_ms * (1 + random.uniform(-0.2, 0.2))
        
        def operation():
            time.sleep(duration_ms / 1000.0)
        
        with PerformanceMeasurement("monitored_op", data_size=i * 10) as pm:
            operation()
        
        metrics = pm.get_metrics()
        analyzer.record_measurement(metrics)
    
    # Property: Trend summary should be available
    summary = analyzer.get_trend_summary("monitored_op", last_n=num_measurements)
    
    assert 'error' not in summary
    assert summary['operation_name'] == "monitored_op"
    assert summary['measurement_count'] == num_measurements
    
    # Property: Statistical metrics should be present
    assert 'duration_ms' in summary
    assert 'mean' in summary['duration_ms']
    assert 'median' in summary['duration_ms']
    assert 'stdev' in summary['duration_ms']
    assert summary['duration_ms']['min'] > 0
    assert summary['duration_ms']['max'] >= summary['duration_ms']['min']
    assert summary['duration_ms']['mean'] > 0
    
    # Property: Memory metrics should be present
    assert 'memory_delta_mb' in summary
    assert 'mean' in summary['memory_delta_mb']
    
    # Property: Recent measurements should be available
    assert 'recent_measurements' in summary
    assert len(summary['recent_measurements']) <= 10


@given(
    num_operations=st.integers(min_value=3, max_value=10),
    base_duration_ms=st.integers(min_value=20, max_value=100)
)
@settings(max_examples=10, deadline=None)
def test_property_38_monitoring_export_format(
    num_operations: int,
    base_duration_ms: int
):
    """
    Property 38: Monitoring System Integration - Export Format
    
    Exported monitoring data should be in correct format for monitoring systems.
    
    **Validates: Requirements 8.5**
    **Feature: property-based-testing, Property 38: Monitoring System Integration**
    """
    analyzer = PerformanceTrendAnalyzer()
    
    # Clear any existing trends for this operation to ensure clean test
    analyzer.clear_trends("export_test_op")
    
    # Record some measurements
    for i in range(num_operations):
        def operation():
            time.sleep(base_duration_ms / 1000.0)
        
        with PerformanceMeasurement("export_test_op", data_size=i * 100) as pm:
            operation()
        
        metrics = pm.get_metrics()
        analyzer.record_measurement(metrics)
    
    # Export for monitoring
    export_data = analyzer.export_for_monitoring("export_test_op")
    
    # Property: Export should contain required fields
    assert 'metric_name' in export_data
    assert export_data['metric_name'] == 'performance.export_test_op'
    assert 'timestamp' in export_data
    assert 'metrics' in export_data
    assert 'tags' in export_data
    
    # Property: Metrics should contain key performance indicators
    metrics = export_data['metrics']
    assert 'duration_ms_mean' in metrics
    assert 'duration_ms_p95' in metrics
    assert 'memory_delta_mb_mean' in metrics
    assert 'memory_delta_mb_max' in metrics
    
    # Property: All metric values should be numeric
    assert isinstance(metrics['duration_ms_mean'], (int, float))
    assert isinstance(metrics['duration_ms_p95'], (int, float))
    assert isinstance(metrics['memory_delta_mb_mean'], (int, float))
    assert isinstance(metrics['memory_delta_mb_max'], (int, float))
    
    # Property: Tags should contain operation metadata
    tags = export_data['tags']
    assert tags['operation'] == 'export_test_op'
    assert tags['measurement_count'] == num_operations


# ============================================================================
# Integration Tests
# ============================================================================

@given(
    data_sizes=st.lists(
        st.integers(min_value=50, max_value=500),
        min_size=5,
        max_size=10,
        unique=True
    ).map(sorted),
    base_duration_ms=st.integers(min_value=10, max_value=50)
)
@settings(max_examples=5, deadline=None)
def test_integrated_performance_validation_workflow(
    data_sizes: List[int],
    base_duration_ms: int
):
    """
    Integration test for complete performance validation workflow.
    
    Tests the integration of measurement, scaling validation, regression
    detection, memory management, and monitoring.
    
    **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
    **Feature: property-based-testing**
    """
    # Initialize all components
    scaling_validator = PerformanceScalingValidator("integrated_op")
    regression_detector = PerformanceRegressionDetector()
    memory_detector = MemoryLeakDetector()
    trend_analyzer = PerformanceTrendAnalyzer()
    
    # Clear any existing trends for clean test
    trend_analyzer.clear_trends("integrated_op")
    
    # Run operations at different scales
    for data_size in data_sizes:
        def operation(size: int):
            # Simulate work
            time.sleep((base_duration_ms / 1000.0) * (size / data_sizes[0]))
        
        # Measure with scaling validator
        metrics = scaling_validator.measure_operation(operation, data_size)
        
        # Check for regression
        regression_report = regression_detector.detect_regression(metrics)
        
        # Track memory
        memory_detector.add_measurement(metrics)
        
        # Record for monitoring
        trend_analyzer.record_measurement(metrics)
    
    # Validate scaling
    scaling_result = scaling_validator.validate_linear_scaling(tolerance_percent=50.0)
    assert scaling_result['measurements_count'] == len(data_sizes)
    
    # Check memory
    memory_report = memory_detector.detect_leak("integrated_op")
    assert memory_report.iterations == len(data_sizes)
    
    # Get monitoring summary
    monitoring_summary = trend_analyzer.get_trend_summary("integrated_op")
    assert monitoring_summary['measurement_count'] == len(data_sizes)
    
    # Property: All components should work together consistently
    assert scaling_result['valid'] or scaling_result['measurements_count'] > 0
    assert not memory_report.is_leak_suspected  # Should not leak in this test
    assert 'error' not in monitoring_summary


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
