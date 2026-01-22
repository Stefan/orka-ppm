"""
Test Failure Debugging Utilities for Property-Based Testing

This module provides utilities for debugging failed property tests including:
- Minimal failing example generation and capture
- Detailed failure reporting
- Example reproduction helpers
- Shrinking configuration for efficient debugging

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.3, 1.4**
"""

import json
import os
import sys
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from functools import wraps
import logging

from hypothesis import settings, Verbosity, Phase, reproduce_failure
from hypothesis.database import DirectoryBasedExampleDatabase
from hypothesis.reporting import default as default_reporter

# Configure logging
logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class FailingExample:
    """
    Represents a minimal failing example from a property test.
    
    Captures all information needed to reproduce and debug a test failure.
    
    **Validates: Requirements 1.3**
    """
    test_name: str
    test_module: str
    failing_input: Dict[str, Any]
    exception_type: str
    exception_message: str
    traceback_str: str
    seed: Optional[int]
    timestamp: str
    hypothesis_version: str
    shrunk_from_size: Optional[int] = None
    final_size: Optional[int] = None
    shrink_iterations: int = 0
    reproduction_code: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'test_name': self.test_name,
            'test_module': self.test_module,
            'failing_input': self.failing_input,
            'exception_type': self.exception_type,
            'exception_message': self.exception_message,
            'traceback': self.traceback_str,
            'seed': self.seed,
            'timestamp': self.timestamp,
            'hypothesis_version': self.hypothesis_version,
            'shrunk_from_size': self.shrunk_from_size,
            'final_size': self.final_size,
            'shrink_iterations': self.shrink_iterations,
            'reproduction_code': self.reproduction_code
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FailingExample':
        """Create from dictionary."""
        return cls(
            test_name=data['test_name'],
            test_module=data['test_module'],
            failing_input=data['failing_input'],
            exception_type=data['exception_type'],
            exception_message=data['exception_message'],
            traceback_str=data['traceback'],
            seed=data.get('seed'),
            timestamp=data['timestamp'],
            hypothesis_version=data['hypothesis_version'],
            shrunk_from_size=data.get('shrunk_from_size'),
            final_size=data.get('final_size'),
            shrink_iterations=data.get('shrink_iterations', 0),
            reproduction_code=data.get('reproduction_code')
        )
    
    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)
    
    def generate_reproduction_code(self) -> str:
        """
        Generate Python code to reproduce this failing example.
        
        **Validates: Requirements 1.3**
        """
        code_lines = [
            "# Reproduction code for failing property test",
            f"# Test: {self.test_module}::{self.test_name}",
            f"# Timestamp: {self.timestamp}",
            "",
            "from hypothesis import given, settings, reproduce_failure",
            "import pytest",
            "",
            "# Failing input:",
            f"failing_input = {repr(self.failing_input)}",
            "",
            f"# To reproduce, run the test with this specific input:",
            f"# pytest {self.test_module}::{self.test_name} -v",
            "",
        ]
        
        if self.seed is not None:
            code_lines.extend([
                f"# Or set the seed for deterministic reproduction:",
                f"# HYPOTHESIS_SEED={self.seed} pytest {self.test_module}::{self.test_name}",
                ""
            ])
        
        return "\n".join(code_lines)


@dataclass
class FailureReport:
    """
    Comprehensive failure report for property test debugging.
    
    **Validates: Requirements 1.3**
    """
    failing_examples: List[FailingExample] = field(default_factory=list)
    test_session_id: str = ""
    total_tests_run: int = 0
    total_failures: int = 0
    environment_info: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.test_session_id:
            self.test_session_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        if not self.environment_info:
            self.environment_info = get_environment_info()
    
    def add_failure(self, example: FailingExample) -> None:
        """Add a failing example to the report."""
        self.failing_examples.append(example)
        self.total_failures += 1
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'test_session_id': self.test_session_id,
            'total_tests_run': self.total_tests_run,
            'total_failures': self.total_failures,
            'environment_info': self.environment_info,
            'failing_examples': [ex.to_dict() for ex in self.failing_examples]
        }
    
    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)
    
    def save_to_file(self, filepath: Union[str, Path]) -> None:
        """Save report to a JSON file."""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(self.to_json())
        logger.info(f"Failure report saved to {filepath}")
    
    def generate_summary(self) -> str:
        """Generate a human-readable summary of failures."""
        lines = [
            "=" * 60,
            "PROPERTY TEST FAILURE REPORT",
            "=" * 60,
            f"Session ID: {self.test_session_id}",
            f"Total Tests Run: {self.total_tests_run}",
            f"Total Failures: {self.total_failures}",
            "",
        ]
        
        for i, example in enumerate(self.failing_examples, 1):
            lines.extend([
                f"--- Failure {i} ---",
                f"Test: {example.test_module}::{example.test_name}",
                f"Exception: {example.exception_type}: {example.exception_message}",
                f"Failing Input: {example.failing_input}",
                ""
            ])
        
        lines.append("=" * 60)
        return "\n".join(lines)


def get_environment_info() -> Dict[str, Any]:
    """
    Collect environment information for debugging.
    
    **Validates: Requirements 1.3, 1.4**
    """
    import hypothesis
    
    return {
        'python_version': sys.version,
        'hypothesis_version': hypothesis.__version__,
        'platform': sys.platform,
        'ci_environment': os.getenv('CI', 'false'),
        'github_actions': os.getenv('GITHUB_ACTIONS', 'false'),
        'hypothesis_profile': os.getenv('HYPOTHESIS_PROFILE', 'default'),
        'hypothesis_seed': os.getenv('HYPOTHESIS_SEED'),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


class FailureCapture:
    """
    Context manager and utilities for capturing test failures.
    
    Provides automatic capture of minimal failing examples with
    detailed debugging information.
    
    **Validates: Requirements 1.3**
    
    Example usage:
        ```python
        capture = FailureCapture()
        
        @capture.wrap_test
        @given(st.integers())
        def test_example(x):
            assert x >= 0
        ```
    """
    
    def __init__(self, report_dir: Optional[Union[str, Path]] = None):
        """
        Initialize failure capture.
        
        Args:
            report_dir: Directory to save failure reports (default: .hypothesis/failures)
        """
        self.report_dir = Path(report_dir) if report_dir else Path('.hypothesis/failures')
        self.current_report = FailureReport()
        self._captured_examples: List[FailingExample] = []
    
    def wrap_test(self, test_func: Callable[..., T]) -> Callable[..., T]:
        """
        Decorator to wrap a test function with failure capture.
        
        **Validates: Requirements 1.3**
        """
        @wraps(test_func)
        def wrapped(*args, **kwargs):
            try:
                return test_func(*args, **kwargs)
            except Exception as e:
                # Capture the failing example
                example = self._create_failing_example(
                    test_func=test_func,
                    args=args,
                    kwargs=kwargs,
                    exception=e
                )
                self._captured_examples.append(example)
                self.current_report.add_failure(example)
                raise
        
        return wrapped
    
    def _create_failing_example(
        self,
        test_func: Callable,
        args: tuple,
        kwargs: dict,
        exception: Exception
    ) -> FailingExample:
        """Create a FailingExample from test failure information."""
        import hypothesis
        
        # Combine args and kwargs into failing input
        failing_input = {}
        if args:
            failing_input['args'] = list(args)
        if kwargs:
            failing_input.update(kwargs)
        
        return FailingExample(
            test_name=test_func.__name__,
            test_module=test_func.__module__,
            failing_input=failing_input,
            exception_type=type(exception).__name__,
            exception_message=str(exception),
            traceback_str=traceback.format_exc(),
            seed=get_current_seed(),
            timestamp=datetime.now(timezone.utc).isoformat(),
            hypothesis_version=hypothesis.__version__
        )
    
    def save_report(self, filename: Optional[str] = None) -> Path:
        """
        Save the current failure report to a file.
        
        **Validates: Requirements 1.3**
        """
        if filename is None:
            filename = f"failure_report_{self.current_report.test_session_id}.json"
        
        filepath = self.report_dir / filename
        self.current_report.save_to_file(filepath)
        return filepath
    
    def get_captured_examples(self) -> List[FailingExample]:
        """Get all captured failing examples."""
        return self._captured_examples.copy()
    
    def clear(self) -> None:
        """Clear captured examples and reset report."""
        self._captured_examples.clear()
        self.current_report = FailureReport()


def get_current_seed() -> Optional[int]:
    """
    Get the current Hypothesis seed from environment.
    
    **Validates: Requirements 1.4**
    """
    seed_str = os.getenv('HYPOTHESIS_SEED')
    if seed_str:
        try:
            return int(seed_str)
        except ValueError:
            pass
    return None


def get_shrinking_settings(
    aggressive: bool = True,
    max_shrinks: Optional[int] = None
) -> settings:
    """
    Get Hypothesis settings optimized for shrinking to minimal examples.
    
    Args:
        aggressive: If True, use aggressive shrinking for smallest examples
        max_shrinks: Maximum number of shrink attempts (None for unlimited)
    
    Returns:
        Hypothesis settings configured for optimal shrinking
    
    **Validates: Requirements 1.3**
    """
    phases = [
        Phase.explicit,
        Phase.reuse,
        Phase.generate,
        Phase.target,
        Phase.shrink  # Always include shrink phase for minimal examples
    ]
    
    return settings(
        phases=phases,
        verbosity=Verbosity.verbose if aggressive else Verbosity.normal,
        deadline=None,  # No deadline during shrinking for thorough minimization
        suppress_health_check=[],  # Don't suppress health checks
        database=DirectoryBasedExampleDatabase('.hypothesis/examples')
    )


def configure_minimal_example_generation(
    enable_shrinking: bool = True,
    verbose_shrinking: bool = False,
    save_examples: bool = True,
    example_database_path: Optional[str] = None
) -> settings:
    """
    Configure Hypothesis for minimal failing example generation.
    
    This function configures Hypothesis to:
    1. Always shrink failing examples to minimal cases
    2. Save examples for reproduction
    3. Provide detailed output during shrinking (if verbose)
    
    Args:
        enable_shrinking: Enable shrinking phase (default: True)
        verbose_shrinking: Enable verbose output during shrinking
        save_examples: Save examples to database for reproduction
        example_database_path: Custom path for example database
    
    Returns:
        Configured Hypothesis settings
    
    **Validates: Requirements 1.3**
    """
    phases = [Phase.explicit, Phase.reuse, Phase.generate, Phase.target]
    
    if enable_shrinking:
        phases.append(Phase.shrink)
    
    db_path = example_database_path or '.hypothesis/examples'
    database = DirectoryBasedExampleDatabase(db_path) if save_examples else None
    
    return settings(
        phases=phases,
        verbosity=Verbosity.verbose if verbose_shrinking else Verbosity.normal,
        database=database,
        deadline=None,  # No deadline for thorough shrinking
        report_multiple_bugs=True  # Report all bugs found, not just first
    )


def format_failing_example_for_debugging(
    example: FailingExample,
    include_traceback: bool = True,
    include_reproduction: bool = True
) -> str:
    """
    Format a failing example for human-readable debugging output.
    
    **Validates: Requirements 1.3**
    """
    lines = [
        "=" * 70,
        "MINIMAL FAILING EXAMPLE",
        "=" * 70,
        "",
        f"Test: {example.test_module}::{example.test_name}",
        f"Timestamp: {example.timestamp}",
        "",
        "FAILING INPUT:",
        "-" * 40,
        json.dumps(example.failing_input, indent=2, default=str),
        "",
        "EXCEPTION:",
        "-" * 40,
        f"{example.exception_type}: {example.exception_message}",
    ]
    
    if include_traceback:
        lines.extend([
            "",
            "TRACEBACK:",
            "-" * 40,
            example.traceback_str
        ])
    
    if include_reproduction:
        lines.extend([
            "",
            "REPRODUCTION:",
            "-" * 40,
            example.generate_reproduction_code()
        ])
    
    if example.seed is not None:
        lines.extend([
            "",
            "DETERMINISTIC REPRODUCTION:",
            "-" * 40,
            f"Run with: HYPOTHESIS_SEED={example.seed} pytest {example.test_module}::{example.test_name}"
        ])
    
    lines.append("=" * 70)
    return "\n".join(lines)


class DebuggingReporter:
    """
    Custom reporter for detailed debugging output during property tests.
    
    **Validates: Requirements 1.3**
    """
    
    def __init__(self, output_file: Optional[Union[str, Path]] = None):
        """
        Initialize the debugging reporter.
        
        Args:
            output_file: Optional file to write debug output
        """
        self.output_file = Path(output_file) if output_file else None
        self.messages: List[str] = []
    
    def __call__(self, message: str) -> None:
        """Handle a message from Hypothesis."""
        self.messages.append(message)
        
        # Also print to stdout
        print(message)
        
        # Write to file if configured
        if self.output_file:
            with open(self.output_file, 'a') as f:
                f.write(message + "\n")
    
    def get_all_messages(self) -> List[str]:
        """Get all captured messages."""
        return self.messages.copy()
    
    def clear(self) -> None:
        """Clear captured messages."""
        self.messages.clear()


# Global failure capture instance for convenience
_global_failure_capture: Optional[FailureCapture] = None


def get_failure_capture() -> FailureCapture:
    """Get or create the global failure capture instance."""
    global _global_failure_capture
    if _global_failure_capture is None:
        _global_failure_capture = FailureCapture()
    return _global_failure_capture


def capture_failure(test_func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator to capture failures from a property test.
    
    **Validates: Requirements 1.3**
    
    Example:
        ```python
        @capture_failure
        @given(st.integers())
        def test_positive(x):
            assert x > 0
        ```
    """
    return get_failure_capture().wrap_test(test_func)
