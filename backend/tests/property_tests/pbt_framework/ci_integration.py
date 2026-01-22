"""
CI/CD Integration for Property-Based Testing

This module provides utilities for integrating property-based tests
with CI/CD pipelines, including GitHub Actions support.

Task: 2.2 Add test failure debugging and CI/CD support
**Validates: Requirements 1.3, 1.4**
"""

import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import logging

from hypothesis import settings, Verbosity, Phase
from hypothesis.database import DirectoryBasedExampleDatabase

from .seed_management import (
    get_seed_from_environment,
    generate_deterministic_seed,
    set_global_seed,
    SeedConfig,
    get_seed_config
)
from .debugging_utils import (
    FailureReport,
    FailingExample,
    get_environment_info
)

# Configure logging
logger = logging.getLogger(__name__)


# CI/CD Environment Detection
CI_ENVIRONMENT_VARS = {
    'github_actions': 'GITHUB_ACTIONS',
    'gitlab_ci': 'GITLAB_CI',
    'jenkins': 'JENKINS_URL',
    'circleci': 'CIRCLECI',
    'travis': 'TRAVIS',
    'azure_pipelines': 'TF_BUILD',
    'generic_ci': 'CI'
}


@dataclass
class CIEnvironment:
    """
    Detected CI/CD environment information.
    
    **Validates: Requirements 1.4**
    """
    is_ci: bool = False
    ci_provider: Optional[str] = None
    build_id: Optional[str] = None
    build_number: Optional[str] = None
    branch: Optional[str] = None
    commit_sha: Optional[str] = None
    pull_request: Optional[str] = None
    repository: Optional[str] = None
    workflow_name: Optional[str] = None
    job_name: Optional[str] = None
    runner_os: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'is_ci': self.is_ci,
            'ci_provider': self.ci_provider,
            'build_id': self.build_id,
            'build_number': self.build_number,
            'branch': self.branch,
            'commit_sha': self.commit_sha,
            'pull_request': self.pull_request,
            'repository': self.repository,
            'workflow_name': self.workflow_name,
            'job_name': self.job_name,
            'runner_os': self.runner_os
        }


def detect_ci_environment() -> CIEnvironment:
    """
    Detect the current CI/CD environment.
    
    Returns:
        CIEnvironment with detected information
    
    **Validates: Requirements 1.4**
    """
    env = CIEnvironment()
    
    # Check for GitHub Actions
    if os.getenv('GITHUB_ACTIONS') == 'true':
        env.is_ci = True
        env.ci_provider = 'github_actions'
        env.build_id = os.getenv('GITHUB_RUN_ID')
        env.build_number = os.getenv('GITHUB_RUN_NUMBER')
        env.branch = os.getenv('GITHUB_REF_NAME')
        env.commit_sha = os.getenv('GITHUB_SHA')
        env.pull_request = os.getenv('GITHUB_EVENT_NAME') == 'pull_request'
        env.repository = os.getenv('GITHUB_REPOSITORY')
        env.workflow_name = os.getenv('GITHUB_WORKFLOW')
        env.job_name = os.getenv('GITHUB_JOB')
        env.runner_os = os.getenv('RUNNER_OS')
        return env
    
    # Check for GitLab CI
    if os.getenv('GITLAB_CI') == 'true':
        env.is_ci = True
        env.ci_provider = 'gitlab_ci'
        env.build_id = os.getenv('CI_PIPELINE_ID')
        env.build_number = os.getenv('CI_PIPELINE_IID')
        env.branch = os.getenv('CI_COMMIT_REF_NAME')
        env.commit_sha = os.getenv('CI_COMMIT_SHA')
        env.repository = os.getenv('CI_PROJECT_PATH')
        env.job_name = os.getenv('CI_JOB_NAME')
        return env
    
    # Check for Jenkins
    if os.getenv('JENKINS_URL'):
        env.is_ci = True
        env.ci_provider = 'jenkins'
        env.build_id = os.getenv('BUILD_ID')
        env.build_number = os.getenv('BUILD_NUMBER')
        env.branch = os.getenv('GIT_BRANCH')
        env.commit_sha = os.getenv('GIT_COMMIT')
        env.job_name = os.getenv('JOB_NAME')
        return env
    
    # Check for CircleCI
    if os.getenv('CIRCLECI') == 'true':
        env.is_ci = True
        env.ci_provider = 'circleci'
        env.build_id = os.getenv('CIRCLE_WORKFLOW_ID')
        env.build_number = os.getenv('CIRCLE_BUILD_NUM')
        env.branch = os.getenv('CIRCLE_BRANCH')
        env.commit_sha = os.getenv('CIRCLE_SHA1')
        env.repository = os.getenv('CIRCLE_PROJECT_REPONAME')
        env.job_name = os.getenv('CIRCLE_JOB')
        return env
    
    # Check for generic CI
    if os.getenv('CI') in ('true', '1', 'yes'):
        env.is_ci = True
        env.ci_provider = 'generic'
        return env
    
    return env


@dataclass
class CITestConfig:
    """
    Configuration for property-based tests in CI/CD environments.
    
    **Validates: Requirements 1.4**
    """
    # Number of examples to run in CI
    max_examples: int = 1000
    
    # Deadline in milliseconds (longer for CI)
    deadline_ms: int = 120000  # 2 minutes
    
    # Verbosity level
    verbosity: Verbosity = field(default_factory=lambda: Verbosity.verbose)
    
    # Whether to use deterministic seeds
    deterministic: bool = True
    
    # Seed for deterministic execution
    seed: Optional[int] = None
    
    # Path for example database
    database_path: str = '.hypothesis/ci_examples'
    
    # Path for test artifacts
    artifact_path: str = '.hypothesis/ci_artifacts'
    
    # Whether to save failure reports
    save_failure_reports: bool = True
    
    # Whether to generate JUnit XML reports
    generate_junit: bool = True
    
    # JUnit report path
    junit_path: str = 'test-results/property-tests.xml'
    
    def to_hypothesis_settings(self) -> settings:
        """
        Convert to Hypothesis settings.
        
        **Validates: Requirements 1.4**
        """
        # Note: derandomize=True implies database=None
        # So we only set database when not in deterministic mode
        if self.deterministic:
            return settings(
                max_examples=self.max_examples,
                deadline=self.deadline_ms,
                verbosity=self.verbosity,
                derandomize=True,
                print_blob=True,
                report_multiple_bugs=True,
                phases=[
                    Phase.explicit,
                    Phase.reuse,
                    Phase.generate,
                    Phase.target,
                    Phase.shrink
                ]
            )
        else:
            database = DirectoryBasedExampleDatabase(self.database_path)
            return settings(
                max_examples=self.max_examples,
                deadline=self.deadline_ms,
                verbosity=self.verbosity,
                database=database,
                print_blob=True,
                report_multiple_bugs=True,
                phases=[
                    Phase.explicit,
                    Phase.reuse,
                    Phase.generate,
                    Phase.target,
                    Phase.shrink
                ]
            )


def get_ci_test_config(
    seed: Optional[int] = None,
    max_examples: Optional[int] = None
) -> CITestConfig:
    """
    Get test configuration optimized for CI/CD.
    
    Args:
        seed: Optional seed for deterministic execution
        max_examples: Optional override for max examples
    
    Returns:
        CI-optimized test configuration
    
    **Validates: Requirements 1.4**
    """
    # Get seed from environment if not provided
    if seed is None:
        seed = get_seed_from_environment()
    
    # If still no seed, generate deterministic one based on commit
    if seed is None:
        ci_env = detect_ci_environment()
        if ci_env.commit_sha:
            seed = generate_deterministic_seed(ci_env.commit_sha)
    
    config = CITestConfig(
        seed=seed,
        deterministic=seed is not None
    )
    
    if max_examples is not None:
        config.max_examples = max_examples
    
    return config


@dataclass
class CITestResult:
    """
    Test result for CI/CD reporting.
    
    **Validates: Requirements 1.3, 1.4**
    """
    test_name: str
    test_module: str
    passed: bool
    duration_seconds: float
    examples_run: int
    seed: Optional[int] = None
    failure_message: Optional[str] = None
    failing_example: Optional[Dict[str, Any]] = None
    reproduction_command: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'test_name': self.test_name,
            'test_module': self.test_module,
            'passed': self.passed,
            'duration_seconds': self.duration_seconds,
            'examples_run': self.examples_run,
            'seed': self.seed,
            'failure_message': self.failure_message,
            'failing_example': self.failing_example,
            'reproduction_command': self.reproduction_command
        }


@dataclass
class CITestReport:
    """
    Comprehensive test report for CI/CD.
    
    **Validates: Requirements 1.3, 1.4**
    """
    session_id: str = ""
    ci_environment: Optional[CIEnvironment] = None
    test_results: List[CITestResult] = field(default_factory=list)
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    total_duration_seconds: float = 0.0
    seed_config: Optional[SeedConfig] = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.session_id:
            self.session_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()
        if self.ci_environment is None:
            self.ci_environment = detect_ci_environment()
    
    def add_result(self, result: CITestResult) -> None:
        """Add a test result to the report."""
        self.test_results.append(result)
        self.total_tests += 1
        if result.passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
        self.total_duration_seconds += result.duration_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'session_id': self.session_id,
            'ci_environment': self.ci_environment.to_dict() if self.ci_environment else None,
            'test_results': [r.to_dict() for r in self.test_results],
            'total_tests': self.total_tests,
            'passed_tests': self.passed_tests,
            'failed_tests': self.failed_tests,
            'total_duration_seconds': self.total_duration_seconds,
            'seed_config': self.seed_config.to_dict() if self.seed_config else None,
            'timestamp': self.timestamp
        }
    
    def to_json(self, indent: int = 2) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, default=str)
    
    def save_to_file(self, filepath: Union[str, Path]) -> None:
        """Save report to file."""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(self.to_json())
        logger.info(f"CI test report saved to {filepath}")
    
    def generate_summary(self) -> str:
        """Generate human-readable summary."""
        lines = [
            "=" * 60,
            "PROPERTY-BASED TEST REPORT (CI/CD)",
            "=" * 60,
            f"Session ID: {self.session_id}",
            f"Timestamp: {self.timestamp}",
            "",
        ]
        
        if self.ci_environment and self.ci_environment.is_ci:
            lines.extend([
                f"CI Provider: {self.ci_environment.ci_provider}",
                f"Build: {self.ci_environment.build_number}",
                f"Branch: {self.ci_environment.branch}",
                f"Commit: {self.ci_environment.commit_sha}",
                ""
            ])
        
        lines.extend([
            f"Total Tests: {self.total_tests}",
            f"Passed: {self.passed_tests}",
            f"Failed: {self.failed_tests}",
            f"Duration: {self.total_duration_seconds:.2f}s",
            ""
        ])
        
        if self.failed_tests > 0:
            lines.append("FAILURES:")
            lines.append("-" * 40)
            for result in self.test_results:
                if not result.passed:
                    lines.extend([
                        f"  {result.test_module}::{result.test_name}",
                        f"    Error: {result.failure_message}",
                        f"    Reproduction: {result.reproduction_command}",
                        ""
                    ])
        
        lines.append("=" * 60)
        return "\n".join(lines)
    
    def to_junit_xml(self) -> str:
        """
        Generate JUnit XML format for CI/CD integration.
        
        **Validates: Requirements 1.4**
        """
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<testsuite name="property-tests" tests="{self.total_tests}" '
            f'failures="{self.failed_tests}" errors="0" '
            f'time="{self.total_duration_seconds:.3f}">'
        ]
        
        for result in self.test_results:
            classname = result.test_module.replace('.', '_')
            lines.append(
                f'  <testcase classname="{classname}" '
                f'name="{result.test_name}" '
                f'time="{result.duration_seconds:.3f}">'
            )
            
            if not result.passed:
                failure_msg = result.failure_message or "Test failed"
                # Escape XML special characters
                failure_msg = (failure_msg
                    .replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;'))
                
                lines.append(f'    <failure message="{failure_msg}">')
                if result.failing_example:
                    lines.append(f'      Failing example: {result.failing_example}')
                if result.reproduction_command:
                    lines.append(f'      Reproduction: {result.reproduction_command}')
                lines.append('    </failure>')
            
            lines.append('  </testcase>')
        
        lines.append('</testsuite>')
        return '\n'.join(lines)
    
    def save_junit_xml(self, filepath: Union[str, Path]) -> None:
        """Save JUnit XML report."""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(self.to_junit_xml())
        logger.info(f"JUnit XML report saved to {filepath}")


def setup_ci_environment() -> CITestConfig:
    """
    Setup the CI/CD environment for property-based testing.
    
    This function:
    1. Detects the CI environment
    2. Configures appropriate settings
    3. Sets up seed management
    4. Configures artifact paths
    
    Returns:
        CI test configuration
    
    **Validates: Requirements 1.4**
    """
    ci_env = detect_ci_environment()
    
    if ci_env.is_ci:
        logger.info(f"CI environment detected: {ci_env.ci_provider}")
        
        # Get CI-optimized configuration
        config = get_ci_test_config()
        
        # Set global seed if configured
        if config.seed is not None:
            set_global_seed(config.seed)
            logger.info(f"Using seed {config.seed} for deterministic execution")
        
        # Create artifact directories
        Path(config.artifact_path).mkdir(parents=True, exist_ok=True)
        Path(config.database_path).mkdir(parents=True, exist_ok=True)
        
        return config
    else:
        logger.info("Not running in CI environment, using default configuration")
        return CITestConfig(
            max_examples=100,
            deterministic=False
        )


def register_ci_profiles() -> None:
    """
    Register Hypothesis profiles optimized for CI/CD.
    
    **Validates: Requirements 1.4**
    """
    # CI profile - thorough testing
    # Note: derandomize=True implies database=None
    settings.register_profile(
        "ci",
        max_examples=1000,
        verbosity=Verbosity.verbose,
        deadline=120000,  # 2 minutes
        derandomize=True,
        print_blob=True,
        report_multiple_bugs=True
    )
    
    # CI-fast profile - quick validation
    settings.register_profile(
        "ci-fast",
        max_examples=100,
        verbosity=Verbosity.normal,
        deadline=60000,  # 1 minute
        derandomize=True,
        print_blob=True
    )
    
    # CI-thorough profile - comprehensive testing
    settings.register_profile(
        "ci-thorough",
        max_examples=2000,
        verbosity=Verbosity.verbose,
        deadline=300000,  # 5 minutes
        derandomize=True,
        print_blob=True,
        report_multiple_bugs=True
    )
    
    logger.info("CI profiles registered: ci, ci-fast, ci-thorough")


def get_github_actions_output(
    report: CITestReport,
    output_file: Optional[str] = None
) -> str:
    """
    Generate GitHub Actions output format.
    
    Args:
        report: Test report
        output_file: Optional GITHUB_OUTPUT file path
    
    Returns:
        GitHub Actions output string
    
    **Validates: Requirements 1.4**
    """
    outputs = [
        f"total_tests={report.total_tests}",
        f"passed_tests={report.passed_tests}",
        f"failed_tests={report.failed_tests}",
        f"duration={report.total_duration_seconds:.2f}",
        f"success={str(report.failed_tests == 0).lower()}"
    ]
    
    output_str = "\n".join(outputs)
    
    # Write to GITHUB_OUTPUT if available
    github_output = output_file or os.getenv('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a') as f:
            f.write(output_str + "\n")
        logger.info(f"GitHub Actions outputs written to {github_output}")
    
    return output_str


def create_github_step_summary(report: CITestReport) -> str:
    """
    Create a GitHub Actions step summary in Markdown format.
    
    Args:
        report: Test report
    
    Returns:
        Markdown summary string
    
    **Validates: Requirements 1.4**
    """
    status_emoji = "✅" if report.failed_tests == 0 else "❌"
    
    lines = [
        f"## {status_emoji} Property-Based Test Results",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Total Tests | {report.total_tests} |",
        f"| Passed | {report.passed_tests} |",
        f"| Failed | {report.failed_tests} |",
        f"| Duration | {report.total_duration_seconds:.2f}s |",
        ""
    ]
    
    if report.seed_config and report.seed_config.hypothesis_seed:
        lines.extend([
            "### Reproduction",
            f"Seed: `{report.seed_config.hypothesis_seed}`",
            "",
            "To reproduce locally:",
            "```bash",
            f"HYPOTHESIS_SEED={report.seed_config.hypothesis_seed} pytest tests/property_tests/ -v",
            "```",
            ""
        ])
    
    if report.failed_tests > 0:
        lines.extend([
            "### Failed Tests",
            ""
        ])
        for result in report.test_results:
            if not result.passed:
                lines.extend([
                    f"#### ❌ {result.test_name}",
                    f"- **Module**: `{result.test_module}`",
                    f"- **Error**: {result.failure_message}",
                ])
                if result.reproduction_command:
                    lines.extend([
                        f"- **Reproduce**: `{result.reproduction_command}`",
                    ])
                lines.append("")
    
    # Write to GITHUB_STEP_SUMMARY if available
    step_summary_file = os.getenv('GITHUB_STEP_SUMMARY')
    if step_summary_file:
        with open(step_summary_file, 'a') as f:
            f.write("\n".join(lines))
        logger.info("GitHub step summary written")
    
    return "\n".join(lines)


# Register CI profiles on module import
register_ci_profiles()
