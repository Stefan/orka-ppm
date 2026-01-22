"""
Performance Measurement and Scaling Testing Utilities

This module provides utilities for measuring performance, tracking metrics,
and validating performance scaling characteristics in property-based tests.

**Validates: Requirements 8.1, 8.2**
"""

import time
import psutil
import os
from typing import Dict, List, Any, Optional, Callable, TypeVar
from dataclasses import dataclass, field
from datetime import datetime
import statistics
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class PerformanceMetrics:
    """
    Container for performance measurement data.
    
    **Validates: Requirements 8.1**
    """
    operation_name: str
    start_time: float
    end_time: float
    duration_ms: float
    memory_before_mb: float
    memory_after_mb: float
    memory_delta_mb: float
    cpu_percent: float
    data_size: int
    success: bool
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def duration_seconds(self) -> float:
        """Get duration in seconds."""
        return self.duration_ms / 1000.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            'operation_name': self.operation_name,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'duration_ms': self.duration_ms,
            'duration_seconds': self.duration_seconds,
            'memory_before_mb': self.memory_before_mb,
            'memory_after_mb': self.memory_after_mb,
            'memory_delta_mb': self.memory_delta_mb,
            'cpu_percent': self.cpu_percent,
            'data_size': self.data_size,
            'success': self.success,
            'error_message': self.error_message,
            'metadata': self.metadata
        }


@dataclass
class PerformanceBaseline:
    """
    Performance baseline for regression detection.
    
    **Validates: Requirements 8.1, 8.2**
    """
    operation_name: str
    baseline_duration_ms: float
    baseline_memory_mb: float
    max_duration_ms: float
    max_memory_mb: float
    data_size: int
    timestamp: datetime = field(default_factory=datetime.now)
    
    def is_within_bounds(self, metrics: PerformanceMetrics) -> bool:
        """Check if metrics are within acceptable bounds."""
        duration_ok = metrics.duration_ms <= self.max_duration_ms
        memory_ok = abs(metrics.memory_delta_mb) <= self.max_memory_mb
        return duration_ok and memory_ok
    
    def calculate_regression(self, metrics: PerformanceMetrics) -> Dict[str, float]:
        """Calculate regression percentages."""
        duration_regression = ((metrics.duration_ms - self.baseline_duration_ms) / 
                              self.baseline_duration_ms * 100)
        memory_regression = ((abs(metrics.memory_delta_mb) - self.baseline_memory_mb) / 
                            self.baseline_memory_mb * 100) if self.baseline_memory_mb > 0 else 0
        
        return {
            'duration_regression_percent': duration_regression,
            'memory_regression_percent': memory_regression,
            'duration_exceeded': metrics.duration_ms > self.max_duration_ms,
            'memory_exceeded': abs(metrics.memory_delta_mb) > self.max_memory_mb
        }


class PerformanceMeasurement:
    """
    Context manager for measuring performance of operations.
    
    **Validates: Requirements 8.1**
    
    Example:
        ```python
        with PerformanceMeasurement("test_operation", data_size=1000) as pm:
            # Perform operation
            result = expensive_operation()
        
        metrics = pm.get_metrics()
        assert metrics.duration_ms < 1000
        ```
    """
    
    def __init__(self, operation_name: str, data_size: int = 0, metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize performance measurement.
        
        Args:
            operation_name: Name of the operation being measured
            data_size: Size of data being processed
            metadata: Additional metadata to track
        """
        self.operation_name = operation_name
        self.data_size = data_size
        self.metadata = metadata or {}
        self.process = psutil.Process(os.getpid())
        
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.memory_before: Optional[float] = None
        self.memory_after: Optional[float] = None
        self.cpu_percent: Optional[float] = None
        self.success = True
        self.error_message: Optional[str] = None
    
    def __enter__(self) -> 'PerformanceMeasurement':
        """Start performance measurement."""
        self.start_time = time.time()
        self.memory_before = self.process.memory_info().rss / (1024 * 1024)  # MB
        self.process.cpu_percent()  # Initialize CPU measurement
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """End performance measurement."""
        self.end_time = time.time()
        self.memory_after = self.process.memory_info().rss / (1024 * 1024)  # MB
        self.cpu_percent = self.process.cpu_percent()
        
        if exc_type is not None:
            self.success = False
            self.error_message = str(exc_val)
        
        return False  # Don't suppress exceptions
    
    def get_metrics(self) -> PerformanceMetrics:
        """Get performance metrics."""
        if self.start_time is None or self.end_time is None:
            raise ValueError("Measurement not completed")
        
        duration_ms = (self.end_time - self.start_time) * 1000
        memory_delta = self.memory_after - self.memory_before
        
        return PerformanceMetrics(
            operation_name=self.operation_name,
            start_time=self.start_time,
            end_time=self.end_time,
            duration_ms=duration_ms,
            memory_before_mb=self.memory_before,
            memory_after_mb=self.memory_after,
            memory_delta_mb=memory_delta,
            cpu_percent=self.cpu_percent,
            data_size=self.data_size,
            success=self.success,
            error_message=self.error_message,
            metadata=self.metadata
        )


class PerformanceScalingValidator:
    """
    Validates performance scaling characteristics across different data sizes.
    
    **Validates: Requirements 8.2**
    """
    
    def __init__(self, operation_name: str):
        """
        Initialize scaling validator.
        
        Args:
            operation_name: Name of the operation being validated
        """
        self.operation_name = operation_name
        self.measurements: List[PerformanceMetrics] = []
    
    def measure_operation(self, 
                         operation: Callable[[int], T],
                         data_size: int,
                         metadata: Optional[Dict[str, Any]] = None) -> PerformanceMetrics:
        """
        Measure operation performance for a specific data size.
        
        Args:
            operation: Function that takes data_size and performs the operation
            data_size: Size of data to process
            metadata: Additional metadata
            
        Returns:
            PerformanceMetrics for this measurement
            
        **Validates: Requirements 8.1, 8.2**
        """
        with PerformanceMeasurement(self.operation_name, data_size, metadata) as pm:
            operation(data_size)
        
        metrics = pm.get_metrics()
        self.measurements.append(metrics)
        return metrics
    
    def validate_linear_scaling(self, tolerance_percent: float = 50.0) -> Dict[str, Any]:
        """
        Validate that performance scales linearly with data size.
        
        Args:
            tolerance_percent: Acceptable deviation from linear scaling
            
        Returns:
            Dict with validation results
            
        **Validates: Requirements 8.2**
        """
        if len(self.measurements) < 2:
            return {
                'valid': False,
                'reason': 'Insufficient measurements for scaling validation',
                'measurements_count': len(self.measurements)
            }
        
        # Sort by data size
        sorted_measurements = sorted(self.measurements, key=lambda m: m.data_size)
        
        # Calculate expected scaling ratios
        base_measurement = sorted_measurements[0]
        scaling_results = []
        
        for measurement in sorted_measurements[1:]:
            size_ratio = measurement.data_size / base_measurement.data_size
            duration_ratio = measurement.duration_ms / base_measurement.duration_ms
            
            # Expected duration based on linear scaling
            expected_duration = base_measurement.duration_ms * size_ratio
            actual_duration = measurement.duration_ms
            deviation_percent = abs((actual_duration - expected_duration) / expected_duration * 100)
            
            within_tolerance = deviation_percent <= tolerance_percent
            
            scaling_results.append({
                'data_size': measurement.data_size,
                'size_ratio': size_ratio,
                'duration_ratio': duration_ratio,
                'expected_duration_ms': expected_duration,
                'actual_duration_ms': actual_duration,
                'deviation_percent': deviation_percent,
                'within_tolerance': within_tolerance
            })
        
        all_within_tolerance = all(r['within_tolerance'] for r in scaling_results)
        
        return {
            'valid': all_within_tolerance,
            'tolerance_percent': tolerance_percent,
            'measurements_count': len(self.measurements),
            'scaling_results': scaling_results,
            'base_measurement': {
                'data_size': base_measurement.data_size,
                'duration_ms': base_measurement.duration_ms
            }
        }
    
    def validate_sublinear_scaling(self, max_growth_factor: float = 1.5) -> Dict[str, Any]:
        """
        Validate that performance grows sublinearly (e.g., O(log n) or O(n log n)).
        
        Args:
            max_growth_factor: Maximum acceptable growth factor
            
        Returns:
            Dict with validation results
            
        **Validates: Requirements 8.2**
        """
        if len(self.measurements) < 2:
            return {
                'valid': False,
                'reason': 'Insufficient measurements for scaling validation'
            }
        
        sorted_measurements = sorted(self.measurements, key=lambda m: m.data_size)
        base_measurement = sorted_measurements[0]
        
        scaling_results = []
        for measurement in sorted_measurements[1:]:
            size_ratio = measurement.data_size / base_measurement.data_size
            duration_ratio = measurement.duration_ms / base_measurement.duration_ms
            
            # For sublinear scaling, duration_ratio should be less than size_ratio * max_growth_factor
            max_acceptable_ratio = size_ratio * max_growth_factor
            within_bounds = duration_ratio <= max_acceptable_ratio
            
            scaling_results.append({
                'data_size': measurement.data_size,
                'size_ratio': size_ratio,
                'duration_ratio': duration_ratio,
                'max_acceptable_ratio': max_acceptable_ratio,
                'within_bounds': within_bounds
            })
        
        all_within_bounds = all(r['within_bounds'] for r in scaling_results)
        
        return {
            'valid': all_within_bounds,
            'max_growth_factor': max_growth_factor,
            'scaling_results': scaling_results
        }
    
    def get_scaling_statistics(self) -> Dict[str, Any]:
        """
        Get statistical summary of scaling measurements.
        
        Returns:
            Dict with scaling statistics
        """
        if not self.measurements:
            return {'error': 'No measurements available'}
        
        durations = [m.duration_ms for m in self.measurements]
        memory_deltas = [m.memory_delta_mb for m in self.measurements]
        data_sizes = [m.data_size for m in self.measurements]
        
        return {
            'operation_name': self.operation_name,
            'measurement_count': len(self.measurements),
            'data_size_range': {
                'min': min(data_sizes),
                'max': max(data_sizes),
                'mean': statistics.mean(data_sizes)
            },
            'duration_ms': {
                'min': min(durations),
                'max': max(durations),
                'mean': statistics.mean(durations),
                'median': statistics.median(durations),
                'stdev': statistics.stdev(durations) if len(durations) > 1 else 0
            },
            'memory_delta_mb': {
                'min': min(memory_deltas),
                'max': max(memory_deltas),
                'mean': statistics.mean(memory_deltas),
                'median': statistics.median(memory_deltas),
                'stdev': statistics.stdev(memory_deltas) if len(memory_deltas) > 1 else 0
            }
        }


class ResponseTimeValidator:
    """
    Validates response time consistency under different conditions.
    
    **Validates: Requirements 8.1**
    """
    
    def __init__(self, operation_name: str, max_acceptable_ms: float):
        """
        Initialize response time validator.
        
        Args:
            operation_name: Name of the operation
            max_acceptable_ms: Maximum acceptable response time in milliseconds
        """
        self.operation_name = operation_name
        self.max_acceptable_ms = max_acceptable_ms
        self.measurements: List[PerformanceMetrics] = []
    
    def measure_response_time(self,
                             operation: Callable[[], T],
                             metadata: Optional[Dict[str, Any]] = None) -> PerformanceMetrics:
        """
        Measure response time for an operation.
        
        Args:
            operation: Function to measure
            metadata: Additional metadata
            
        Returns:
            PerformanceMetrics
        """
        with PerformanceMeasurement(self.operation_name, metadata=metadata) as pm:
            operation()
        
        metrics = pm.get_metrics()
        self.measurements.append(metrics)
        return metrics
    
    def validate_consistency(self, max_variance_percent: float = 20.0) -> Dict[str, Any]:
        """
        Validate that response times are consistent.
        
        Args:
            max_variance_percent: Maximum acceptable variance percentage
            
        Returns:
            Dict with validation results
            
        **Validates: Requirements 8.1**
        """
        if len(self.measurements) < 2:
            return {
                'valid': False,
                'reason': 'Insufficient measurements for consistency validation'
            }
        
        durations = [m.duration_ms for m in self.measurements]
        mean_duration = statistics.mean(durations)
        stdev_duration = statistics.stdev(durations) if len(durations) > 1 else 0
        variance_percent = (stdev_duration / mean_duration * 100) if mean_duration > 0 else 0
        
        all_within_max = all(d <= self.max_acceptable_ms for d in durations)
        variance_acceptable = variance_percent <= max_variance_percent
        
        return {
            'valid': all_within_max and variance_acceptable,
            'measurements_count': len(self.measurements),
            'mean_duration_ms': mean_duration,
            'stdev_duration_ms': stdev_duration,
            'variance_percent': variance_percent,
            'max_acceptable_ms': self.max_acceptable_ms,
            'max_variance_percent': max_variance_percent,
            'all_within_max': all_within_max,
            'variance_acceptable': variance_acceptable,
            'durations': durations
        }
    
    def get_percentiles(self) -> Dict[str, float]:
        """Get response time percentiles."""
        if not self.measurements:
            return {}
        
        durations = sorted([m.duration_ms for m in self.measurements])
        n = len(durations)
        
        def percentile(p: float) -> float:
            k = (n - 1) * p
            f = int(k)
            c = f + 1
            if c >= n:
                return durations[-1]
            return durations[f] + (k - f) * (durations[c] - durations[f])
        
        return {
            'p50': percentile(0.50),
            'p75': percentile(0.75),
            'p90': percentile(0.90),
            'p95': percentile(0.95),
            'p99': percentile(0.99)
        }


def measure_load_pattern_performance(
    operation: Callable[[int], T],
    load_patterns: List[int],
    operation_name: str = "operation"
) -> List[PerformanceMetrics]:
    """
    Measure performance across different load patterns.
    
    Args:
        operation: Function that takes load size and performs operation
        load_patterns: List of load sizes to test
        operation_name: Name of the operation
        
    Returns:
        List of PerformanceMetrics for each load pattern
        
    **Validates: Requirements 8.1**
    """
    measurements = []
    
    for load_size in load_patterns:
        with PerformanceMeasurement(operation_name, data_size=load_size) as pm:
            operation(load_size)
        
        metrics = pm.get_metrics()
        measurements.append(metrics)
        
        logger.info(
            f"Load pattern {load_size}: {metrics.duration_ms:.2f}ms, "
            f"Memory delta: {metrics.memory_delta_mb:.2f}MB"
        )
    
    return measurements
