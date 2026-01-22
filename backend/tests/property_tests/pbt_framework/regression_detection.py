"""
Performance Regression Detection and Memory Management Testing

This module provides utilities for detecting performance regressions,
tracking performance trends, and validating memory usage patterns.

**Validates: Requirements 8.3, 8.4, 8.5**
"""

import json
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
import logging

from .performance_utils import PerformanceMetrics, PerformanceBaseline

logger = logging.getLogger(__name__)


@dataclass
class RegressionReport:
    """
    Report of performance regression detection.
    
    **Validates: Requirements 8.3**
    """
    operation_name: str
    timestamp: datetime
    baseline_duration_ms: float
    current_duration_ms: float
    duration_regression_percent: float
    baseline_memory_mb: float
    current_memory_mb: float
    memory_regression_percent: float
    is_regression: bool
    severity: str  # 'none', 'minor', 'moderate', 'severe'
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


@dataclass
class MemoryLeakReport:
    """
    Report of potential memory leak detection.
    
    **Validates: Requirements 8.4**
    """
    operation_name: str
    timestamp: datetime
    iterations: int
    initial_memory_mb: float
    final_memory_mb: float
    memory_growth_mb: float
    memory_growth_per_iteration_mb: float
    is_leak_suspected: bool
    threshold_mb: float
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class PerformanceRegressionDetector:
    """
    Detects performance regressions by comparing current metrics against baselines.
    
    **Validates: Requirements 8.3**
    """
    
    def __init__(self, 
                 baseline_storage_path: Optional[str] = None,
                 regression_threshold_percent: float = 10.0):
        """
        Initialize regression detector.
        
        Args:
            baseline_storage_path: Path to store baseline data
            regression_threshold_percent: Threshold for regression detection
        """
        self.regression_threshold_percent = regression_threshold_percent
        
        if baseline_storage_path is None:
            baseline_storage_path = os.path.join(
                os.path.dirname(__file__),
                '..',
                '.performance_baselines'
            )
        
        self.baseline_storage_path = Path(baseline_storage_path)
        self.baseline_storage_path.mkdir(parents=True, exist_ok=True)
        
        self.baselines: Dict[str, PerformanceBaseline] = {}
        self.load_baselines()
    
    def load_baselines(self) -> None:
        """Load baselines from storage."""
        baseline_file = self.baseline_storage_path / 'baselines.json'
        
        if not baseline_file.exists():
            logger.info("No baseline file found, starting fresh")
            return
        
        try:
            with open(baseline_file, 'r') as f:
                data = json.load(f)
            
            for operation_name, baseline_data in data.items():
                self.baselines[operation_name] = PerformanceBaseline(
                    operation_name=baseline_data['operation_name'],
                    baseline_duration_ms=baseline_data['baseline_duration_ms'],
                    baseline_memory_mb=baseline_data['baseline_memory_mb'],
                    max_duration_ms=baseline_data['max_duration_ms'],
                    max_memory_mb=baseline_data['max_memory_mb'],
                    data_size=baseline_data['data_size'],
                    timestamp=datetime.fromisoformat(baseline_data['timestamp'])
                )
            
            logger.info(f"Loaded {len(self.baselines)} baselines")
        except Exception as e:
            logger.error(f"Error loading baselines: {e}")
    
    def save_baselines(self) -> None:
        """Save baselines to storage."""
        baseline_file = self.baseline_storage_path / 'baselines.json'
        
        data = {}
        for operation_name, baseline in self.baselines.items():
            data[operation_name] = {
                'operation_name': baseline.operation_name,
                'baseline_duration_ms': baseline.baseline_duration_ms,
                'baseline_memory_mb': baseline.baseline_memory_mb,
                'max_duration_ms': baseline.max_duration_ms,
                'max_memory_mb': baseline.max_memory_mb,
                'data_size': baseline.data_size,
                'timestamp': baseline.timestamp.isoformat()
            }
        
        try:
            with open(baseline_file, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved {len(self.baselines)} baselines")
        except Exception as e:
            logger.error(f"Error saving baselines: {e}")
    
    def set_baseline(self, metrics: PerformanceMetrics, tolerance_percent: float = 20.0) -> None:
        """
        Set a performance baseline from metrics.
        
        Args:
            metrics: Performance metrics to use as baseline
            tolerance_percent: Acceptable tolerance for regression detection
            
        **Validates: Requirements 8.3**
        """
        max_duration = metrics.duration_ms * (1 + tolerance_percent / 100)
        max_memory = abs(metrics.memory_delta_mb) * (1 + tolerance_percent / 100)
        
        baseline = PerformanceBaseline(
            operation_name=metrics.operation_name,
            baseline_duration_ms=metrics.duration_ms,
            baseline_memory_mb=abs(metrics.memory_delta_mb),
            max_duration_ms=max_duration,
            max_memory_mb=max_memory,
            data_size=metrics.data_size
        )
        
        self.baselines[metrics.operation_name] = baseline
        self.save_baselines()
        
        logger.info(
            f"Set baseline for {metrics.operation_name}: "
            f"{metrics.duration_ms:.2f}ms, {abs(metrics.memory_delta_mb):.2f}MB"
        )
    
    def detect_regression(self, metrics: PerformanceMetrics) -> RegressionReport:
        """
        Detect if metrics represent a performance regression.
        
        Args:
            metrics: Current performance metrics
            
        Returns:
            RegressionReport with regression analysis
            
        **Validates: Requirements 8.3**
        """
        baseline = self.baselines.get(metrics.operation_name)
        
        if baseline is None:
            # No baseline, set current as baseline
            self.set_baseline(metrics)
            return RegressionReport(
                operation_name=metrics.operation_name,
                timestamp=datetime.now(),
                baseline_duration_ms=metrics.duration_ms,
                current_duration_ms=metrics.duration_ms,
                duration_regression_percent=0.0,
                baseline_memory_mb=abs(metrics.memory_delta_mb),
                current_memory_mb=abs(metrics.memory_delta_mb),
                memory_regression_percent=0.0,
                is_regression=False,
                severity='none',
                details={'message': 'Baseline established'}
            )
        
        # Calculate regression
        regression_data = baseline.calculate_regression(metrics)
        
        duration_regression = regression_data['duration_regression_percent']
        memory_regression = regression_data['memory_regression_percent']
        
        # Determine if this is a regression
        is_regression = (
            duration_regression > self.regression_threshold_percent or
            memory_regression > self.regression_threshold_percent
        )
        
        # Determine severity
        severity = self._calculate_severity(duration_regression, memory_regression)
        
        report = RegressionReport(
            operation_name=metrics.operation_name,
            timestamp=datetime.now(),
            baseline_duration_ms=baseline.baseline_duration_ms,
            current_duration_ms=metrics.duration_ms,
            duration_regression_percent=duration_regression,
            baseline_memory_mb=baseline.baseline_memory_mb,
            current_memory_mb=abs(metrics.memory_delta_mb),
            memory_regression_percent=memory_regression,
            is_regression=is_regression,
            severity=severity,
            details={
                'duration_exceeded': regression_data['duration_exceeded'],
                'memory_exceeded': regression_data['memory_exceeded'],
                'baseline_max_duration_ms': baseline.max_duration_ms,
                'baseline_max_memory_mb': baseline.max_memory_mb
            }
        )
        
        if is_regression:
            logger.warning(
                f"Performance regression detected for {metrics.operation_name}: "
                f"Duration: {duration_regression:+.1f}%, Memory: {memory_regression:+.1f}% "
                f"(Severity: {severity})"
            )
        
        return report
    
    def _calculate_severity(self, duration_regression: float, memory_regression: float) -> str:
        """Calculate regression severity."""
        max_regression = max(duration_regression, memory_regression)
        
        if max_regression < self.regression_threshold_percent:
            return 'none'
        elif max_regression < self.regression_threshold_percent * 2:
            return 'minor'
        elif max_regression < self.regression_threshold_percent * 5:
            return 'moderate'
        else:
            return 'severe'
    
    def get_baseline(self, operation_name: str) -> Optional[PerformanceBaseline]:
        """Get baseline for an operation."""
        return self.baselines.get(operation_name)
    
    def clear_baselines(self) -> None:
        """Clear all baselines."""
        self.baselines.clear()
        self.save_baselines()


class MemoryLeakDetector:
    """
    Detects potential memory leaks by monitoring memory growth over iterations.
    
    **Validates: Requirements 8.4**
    """
    
    def __init__(self, leak_threshold_mb: float = 10.0):
        """
        Initialize memory leak detector.
        
        Args:
            leak_threshold_mb: Threshold for leak detection (MB per iteration)
        """
        self.leak_threshold_mb = leak_threshold_mb
        self.measurements: List[PerformanceMetrics] = []
    
    def add_measurement(self, metrics: PerformanceMetrics) -> None:
        """Add a measurement for leak detection."""
        self.measurements.append(metrics)
    
    def detect_leak(self, operation_name: str) -> MemoryLeakReport:
        """
        Detect if measurements indicate a memory leak.
        
        Args:
            operation_name: Name of the operation being tested
            
        Returns:
            MemoryLeakReport with leak analysis
            
        **Validates: Requirements 8.4**
        """
        if not self.measurements:
            return MemoryLeakReport(
                operation_name=operation_name,
                timestamp=datetime.now(),
                iterations=0,
                initial_memory_mb=0.0,
                final_memory_mb=0.0,
                memory_growth_mb=0.0,
                memory_growth_per_iteration_mb=0.0,
                is_leak_suspected=False,
                threshold_mb=self.leak_threshold_mb,
                details={'message': 'No measurements available'}
            )
        
        # Calculate memory growth
        initial_memory = self.measurements[0].memory_before_mb
        final_memory = self.measurements[-1].memory_after_mb
        memory_growth = final_memory - initial_memory
        iterations = len(self.measurements)
        memory_growth_per_iteration = memory_growth / iterations if iterations > 0 else 0
        
        # Check if growth exceeds threshold
        is_leak_suspected = memory_growth_per_iteration > self.leak_threshold_mb
        
        # Analyze trend
        memory_values = [m.memory_after_mb for m in self.measurements]
        is_monotonic_growth = all(
            memory_values[i] <= memory_values[i + 1]
            for i in range(len(memory_values) - 1)
        )
        
        report = MemoryLeakReport(
            operation_name=operation_name,
            timestamp=datetime.now(),
            iterations=iterations,
            initial_memory_mb=initial_memory,
            final_memory_mb=final_memory,
            memory_growth_mb=memory_growth,
            memory_growth_per_iteration_mb=memory_growth_per_iteration,
            is_leak_suspected=is_leak_suspected,
            threshold_mb=self.leak_threshold_mb,
            details={
                'is_monotonic_growth': is_monotonic_growth,
                'memory_values': memory_values,
                'total_memory_delta': sum(m.memory_delta_mb for m in self.measurements)
            }
        )
        
        if is_leak_suspected:
            logger.warning(
                f"Potential memory leak detected for {operation_name}: "
                f"{memory_growth_per_iteration:.2f}MB per iteration "
                f"(threshold: {self.leak_threshold_mb}MB)"
            )
        
        return report
    
    def reset(self) -> None:
        """Reset measurements."""
        self.measurements.clear()


class PerformanceTrendAnalyzer:
    """
    Analyzes performance trends over time for monitoring integration.
    
    **Validates: Requirements 8.5**
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize trend analyzer.
        
        Args:
            storage_path: Path to store trend data
        """
        if storage_path is None:
            storage_path = os.path.join(
                os.path.dirname(__file__),
                '..',
                '.performance_trends'
            )
        
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self.trends: Dict[str, List[Dict[str, Any]]] = {}
        self.load_trends()
    
    def load_trends(self) -> None:
        """Load trend data from storage."""
        trend_file = self.storage_path / 'trends.json'
        
        if not trend_file.exists():
            logger.info("No trend file found, starting fresh")
            return
        
        try:
            with open(trend_file, 'r') as f:
                self.trends = json.load(f)
            logger.info(f"Loaded trends for {len(self.trends)} operations")
        except Exception as e:
            logger.error(f"Error loading trends: {e}")
    
    def save_trends(self) -> None:
        """Save trend data to storage."""
        trend_file = self.storage_path / 'trends.json'
        
        try:
            with open(trend_file, 'w') as f:
                json.dump(self.trends, f, indent=2)
            logger.info(f"Saved trends for {len(self.trends)} operations")
        except Exception as e:
            logger.error(f"Error saving trends: {e}")
    
    def record_measurement(self, metrics: PerformanceMetrics) -> None:
        """
        Record a performance measurement for trend analysis.
        
        Args:
            metrics: Performance metrics to record
            
        **Validates: Requirements 8.5**
        """
        operation_name = metrics.operation_name
        
        if operation_name not in self.trends:
            self.trends[operation_name] = []
        
        trend_data = {
            'timestamp': datetime.now().isoformat(),
            'duration_ms': metrics.duration_ms,
            'memory_delta_mb': metrics.memory_delta_mb,
            'data_size': metrics.data_size,
            'success': metrics.success
        }
        
        self.trends[operation_name].append(trend_data)
        
        # Keep only last 1000 measurements per operation
        if len(self.trends[operation_name]) > 1000:
            self.trends[operation_name] = self.trends[operation_name][-1000:]
        
        self.save_trends()
    
    def get_trend_summary(self, operation_name: str, last_n: int = 100) -> Dict[str, Any]:
        """
        Get trend summary for an operation.
        
        Args:
            operation_name: Name of the operation
            last_n: Number of recent measurements to analyze
            
        Returns:
            Dict with trend summary
            
        **Validates: Requirements 8.5**
        """
        if operation_name not in self.trends:
            return {'error': f'No trend data for {operation_name}'}
        
        measurements = self.trends[operation_name][-last_n:]
        
        if not measurements:
            return {'error': 'No measurements available'}
        
        durations = [m['duration_ms'] for m in measurements]
        memory_deltas = [m['memory_delta_mb'] for m in measurements]
        
        import statistics
        
        return {
            'operation_name': operation_name,
            'measurement_count': len(measurements),
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
            },
            'recent_measurements': measurements[-10:]  # Last 10 for quick view
        }
    
    def export_for_monitoring(self, operation_name: str) -> Dict[str, Any]:
        """
        Export trend data in format suitable for monitoring systems.
        
        Args:
            operation_name: Name of the operation
            
        Returns:
            Dict with monitoring-compatible data
            
        **Validates: Requirements 8.5**
        """
        summary = self.get_trend_summary(operation_name)
        
        if 'error' in summary:
            return summary
        
        return {
            'metric_name': f'performance.{operation_name}',
            'timestamp': datetime.now().isoformat(),
            'metrics': {
                'duration_ms_mean': summary['duration_ms']['mean'],
                'duration_ms_p95': summary['duration_ms']['mean'] + 1.96 * summary['duration_ms']['stdev'],
                'memory_delta_mb_mean': summary['memory_delta_mb']['mean'],
                'memory_delta_mb_max': summary['memory_delta_mb']['max']
            },
            'tags': {
                'operation': operation_name,
                'measurement_count': summary['measurement_count']
            }
        }
    
    def clear_trends(self, operation_name: Optional[str] = None) -> None:
        """
        Clear trend data.
        
        Args:
            operation_name: Specific operation to clear, or None for all
        """
        if operation_name is None:
            self.trends.clear()
        elif operation_name in self.trends:
            del self.trends[operation_name]
        
        self.save_trends()
