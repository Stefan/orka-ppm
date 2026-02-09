"""
Property-Based Testing Orchestration System

This module provides comprehensive test orchestration for both backend and frontend
property-based tests, with integrated reporting, result aggregation, and analysis.

Task: 13.1 Implement test orchestration system
Feature: property-based-testing
"""

import asyncio
import json
import subprocess
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict
import sys


class TestStatus(Enum):
    """Test execution status"""
    NOT_STARTED = "not_started"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


class TestCategory(Enum):
    """Test category classification"""
    BACKEND_INFRASTRUCTURE = "backend_infrastructure"
    FRONTEND_INFRASTRUCTURE = "frontend_infrastructure"
    FINANCIAL_ACCURACY = "financial_accuracy"
    FILTER_CONSISTENCY = "filter_consistency"
    BUSINESS_LOGIC = "business_logic"
    API_CONTRACT = "api_contract"
    DATA_INTEGRITY = "data_integrity"
    PERFORMANCE = "performance"


@dataclass
class PropertyTestResult:
    """Individual property test result"""
    test_id: str
    test_name: str
    property_number: Optional[int]
    category: TestCategory
    status: TestStatus
    execution_time: float
    error_message: Optional[str] = None
    failure_example: Optional[str] = None
    iterations: int = 0
    seed: Optional[int] = None
    requirements: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            **asdict(self),
            'category': self.category.value,
            'status': self.status.value,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class TestSuiteResult:
    """Test suite execution result"""
    suite_name: str
    category: TestCategory
    total_tests: int
    passed: int
    failed: int
    skipped: int
    errors: int
    execution_time: float
    test_results: List[PropertyTestResult] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.total_tests == 0:
            return 0.0
        return (self.passed / self.total_tests) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'suite_name': self.suite_name,
            'category': self.category.value,
            'total_tests': self.total_tests,
            'passed': self.passed,
            'failed': self.failed,
            'skipped': self.skipped,
            'errors': self.errors,
            'execution_time': self.execution_time,
            'success_rate': self.success_rate,
            'test_results': [tr.to_dict() for tr in self.test_results],
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class OrchestrationReport:
    """Complete orchestration execution report"""
    execution_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_execution_time: float = 0.0
    backend_suites: List[TestSuiteResult] = field(default_factory=list)
    frontend_suites: List[TestSuiteResult] = field(default_factory=list)
    overall_status: TestStatus = TestStatus.NOT_STARTED
    total_tests: int = 0
    total_passed: int = 0
    total_failed: int = 0
    total_skipped: int = 0
    total_errors: int = 0
    
    @property
    def overall_success_rate(self) -> float:
        """Calculate overall success rate"""
        if self.total_tests == 0:
            return 0.0
        return (self.total_passed / self.total_tests) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'execution_id': self.execution_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'total_execution_time': self.total_execution_time,
            'overall_status': self.overall_status.value,
            'total_tests': self.total_tests,
            'total_passed': self.total_passed,
            'total_failed': self.total_failed,
            'total_skipped': self.total_skipped,
            'total_errors': self.total_errors,
            'overall_success_rate': self.overall_success_rate,
            'backend_suites': [suite.to_dict() for suite in self.backend_suites],
            'frontend_suites': [suite.to_dict() for suite in self.frontend_suites]
        }


class TestOrchestrator:
    """
    Comprehensive test orchestration system for property-based testing.
    
    Coordinates execution of both backend (Python/pytest/Hypothesis) and 
    frontend (TypeScript/Jest/fast-check) property-based tests with 
    integrated reporting and analysis.
    """
    
    def __init__(
        self,
        backend_test_dir: Path,
        frontend_test_dir: Path,
        output_dir: Path,
        parallel_execution: bool = True,
        verbose: bool = False
    ):
        """
        Initialize test orchestrator.
        
        Args:
            backend_test_dir: Path to backend property tests
            frontend_test_dir: Path to frontend tests
            output_dir: Path for test reports and artifacts
            parallel_execution: Whether to run backend/frontend tests in parallel
            verbose: Enable verbose output
        """
        self.backend_test_dir = backend_test_dir
        self.frontend_test_dir = frontend_test_dir
        self.output_dir = output_dir
        self.parallel_execution = parallel_execution
        self.verbose = verbose
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Test suite registry
        self.backend_test_suites: Dict[str, TestCategory] = {}
        self.frontend_test_suites: Dict[str, TestCategory] = {}
        
        # Execution tracking
        self.current_report: Optional[OrchestrationReport] = None
        
    def register_backend_suite(self, suite_name: str, category: TestCategory):
        """Register a backend test suite"""
        self.backend_test_suites[suite_name] = category
        
    def register_frontend_suite(self, suite_name: str, category: TestCategory):
        """Register a frontend test suite"""
        self.frontend_test_suites[suite_name] = category
    
    async def run_all_tests(
        self,
        backend_only: bool = False,
        frontend_only: bool = False,
        categories: Optional[List[TestCategory]] = None
    ) -> OrchestrationReport:
        """
        Run all registered property-based tests.
        
        Args:
            backend_only: Run only backend tests
            frontend_only: Run only frontend tests
            categories: Filter tests by categories
            
        Returns:
            Complete orchestration report
        """
        execution_id = f"pbt-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        start_time = datetime.now(timezone.utc)
        
        self.current_report = OrchestrationReport(
            execution_id=execution_id,
            start_time=start_time
        )
        
        if self.verbose:
            print(f"\n{'='*80}")
            print(f"Property-Based Testing Orchestration")
            print(f"Execution ID: {execution_id}")
            print(f"Start Time: {start_time.isoformat()}")
            print(f"{'='*80}\n")
        
        try:
            # Run tests based on configuration
            if self.parallel_execution and not backend_only and not frontend_only:
                # Run backend and frontend in parallel
                backend_task = self._run_backend_tests(categories)
                frontend_task = self._run_frontend_tests(categories)
                
                backend_results, frontend_results = await asyncio.gather(
                    backend_task,
                    frontend_task,
                    return_exceptions=True
                )
                
                if isinstance(backend_results, Exception):
                    print(f"Backend tests error: {backend_results}")
                    backend_results = []
                if isinstance(frontend_results, Exception):
                    print(f"Frontend tests error: {frontend_results}")
                    frontend_results = []
                    
                self.current_report.backend_suites = backend_results
                self.current_report.frontend_suites = frontend_results
            else:
                # Run sequentially
                if not frontend_only:
                    self.current_report.backend_suites = await self._run_backend_tests(categories)
                if not backend_only:
                    self.current_report.frontend_suites = await self._run_frontend_tests(categories)
            
            # Aggregate results
            self._aggregate_results()
            
        except Exception as e:
            print(f"Orchestration error: {e}")
            self.current_report.overall_status = TestStatus.ERROR
        finally:
            self.current_report.end_time = datetime.now(timezone.utc)
            self.current_report.total_execution_time = (
                self.current_report.end_time - self.current_report.start_time
            ).total_seconds()
        
        # Generate reports
        await self._generate_reports()
        
        return self.current_report
    
    async def _run_backend_tests(
        self,
        categories: Optional[List[TestCategory]] = None
    ) -> List[TestSuiteResult]:
        """Run backend property-based tests"""
        if self.verbose:
            print("\n--- Running Backend Property Tests ---\n")
        
        results = []
        
        # Filter suites by category if specified
        suites_to_run = self.backend_test_suites
        if categories:
            suites_to_run = {
                name: cat for name, cat in self.backend_test_suites.items()
                if cat in categories
            }
        
        for suite_name, category in suites_to_run.items():
            if self.verbose:
                print(f"Running backend suite: {suite_name} ({category.value})")
            
            result = await self._execute_backend_suite(suite_name, category)
            results.append(result)
        
        return results
    
    async def _run_frontend_tests(
        self,
        categories: Optional[List[TestCategory]] = None
    ) -> List[TestSuiteResult]:
        """Run frontend property-based tests"""
        if self.verbose:
            print("\n--- Running Frontend Property Tests ---\n")
        
        results = []
        
        # Filter suites by category if specified
        suites_to_run = self.frontend_test_suites
        if categories:
            suites_to_run = {
                name: cat for name, cat in self.frontend_test_suites.items()
                if cat in categories
            }
        
        for suite_name, category in suites_to_run.items():
            if self.verbose:
                print(f"Running frontend suite: {suite_name} ({category.value})")
            
            result = await self._execute_frontend_suite(suite_name, category)
            results.append(result)
        
        return results
    
    async def _execute_backend_suite(
        self,
        suite_name: str,
        category: TestCategory
    ) -> TestSuiteResult:
        """Execute a backend test suite using pytest"""
        start_time = time.time()
        
        # Construct pytest command; run from backend/ so imports (e.g. monte_carlo) resolve
        test_file = self.backend_test_dir / f"{suite_name}.py"
        backend_root = self.backend_test_dir.parent.parent
        backend_root_abs = backend_root.resolve()
        try:
            test_path = str(test_file.relative_to(backend_root))
        except ValueError:
            test_path = str(test_file)
        cmd = [
            sys.executable, "-m", "pytest",
            "-o", "addopts=",
            test_path,
            "-v",
            "--tb=short"
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(backend_root_abs)
            )
            
            stdout_bytes, stderr = await process.communicate()
            execution_time = time.time() - start_time
            stdout_text = (stdout_bytes or b"").decode("utf-8", errors="replace")
            
            # Parse results (JSON report if plugin used, else pytest stdout)
            result = self._parse_backend_results(
                suite_name,
                category,
                execution_time,
                process.returncode,
                stdout=stdout_text
            )
            
            if self.verbose:
                print(f"  ✓ {suite_name}: {result.passed}/{result.total_tests} passed "
                      f"({result.execution_time:.2f}s)")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            if self.verbose:
                print(f"  ✗ {suite_name}: Error - {str(e)}")
            
            return TestSuiteResult(
                suite_name=suite_name,
                category=category,
                total_tests=0,
                passed=0,
                failed=0,
                skipped=0,
                errors=1,
                execution_time=execution_time
            )
    
    async def _execute_frontend_suite(
        self,
        suite_name: str,
        category: TestCategory
    ) -> TestSuiteResult:
        """Execute a frontend test suite using Jest"""
        start_time = time.time()
        
        # Construct Jest command
        test_file = self.frontend_test_dir / f"{suite_name}.test.tsx"
        cmd = [
            "npm", "test", "--",
            str(test_file),
            "--run",
            "--json",
            f"--outputFile={self.output_dir / f'{suite_name}_report.json'}"
        ]
        
        try:
            # Run Jest from project root so npm test and Jest config resolve correctly
            frontend_cwd = self.output_dir.parent.parent
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(frontend_cwd)
            )
            
            stdout, stderr = await process.communicate()
            execution_time = time.time() - start_time
            
            # Parse results
            result = self._parse_frontend_results(
                suite_name,
                category,
                execution_time,
                process.returncode
            )
            
            if self.verbose:
                print(f"  ✓ {suite_name}: {result.passed}/{result.total_tests} passed "
                      f"({result.execution_time:.2f}s)")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            if self.verbose:
                print(f"  ✗ {suite_name}: Error - {str(e)}")
            
            return TestSuiteResult(
                suite_name=suite_name,
                category=category,
                total_tests=0,
                passed=0,
                failed=0,
                skipped=0,
                errors=1,
                execution_time=execution_time
            )
    
    def _parse_backend_results(
        self,
        suite_name: str,
        category: TestCategory,
        execution_time: float,
        return_code: int,
        stdout: str = ""
    ) -> TestSuiteResult:
        """Parse backend test results from pytest JSON report or from pytest stdout."""
        import re
        report_file = self.output_dir / f"{suite_name}_report.json"
        
        result = TestSuiteResult(
            suite_name=suite_name,
            category=category,
            total_tests=0,
            passed=0,
            failed=0,
            skipped=0,
            errors=0,
            execution_time=execution_time
        )
        
        try:
            if report_file.exists():
                with open(report_file, 'r') as f:
                    data = json.load(f)
                summary = data.get('summary', {})
                result.total_tests = summary.get('total', 0)
                result.passed = summary.get('passed', 0)
                result.failed = summary.get('failed', 0)
                result.skipped = summary.get('skipped', 0)
                result.errors = summary.get('error', 0)
                for test in data.get('tests', []):
                    test_result = PropertyTestResult(
                        test_id=test.get('nodeid', ''),
                        test_name=test.get('name', ''),
                        property_number=self._extract_property_number(test.get('name', '')),
                        category=category,
                        status=TestStatus(test.get('outcome', 'error')),
                        execution_time=test.get('duration', 0.0),
                        error_message=test.get('call', {}).get('longrepr', None)
                    )
                    result.test_results.append(test_result)
            elif stdout:
                # Fallback: parse pytest summary line e.g. "22 passed, 1 failed in 3.21s" or "23 passed in 2.00s"
                m = re.search(r"(\d+)\s+passed", stdout)
                passed = int(m.group(1), 10) if m else 0
                m = re.search(r"(\d+)\s+failed", stdout)
                failed = int(m.group(1), 10) if m else 0
                m = re.search(r"(\d+)\s+skipped", stdout)
                skipped = int(m.group(1), 10) if m else 0
                m = re.search(r"(\d+)\s+error", stdout)
                errors = int(m.group(1), 10) if m else 0
                result.total_tests = passed + failed + skipped + errors
                result.passed = passed
                result.failed = failed
                result.skipped = skipped
                result.errors = errors
        except Exception as e:
            if self.verbose:
                print(f"Warning: Could not parse results for {suite_name}: {e}")
        
        return result
    
    def _parse_frontend_results(
        self,
        suite_name: str,
        category: TestCategory,
        execution_time: float,
        return_code: int
    ) -> TestSuiteResult:
        """Parse frontend test results from Jest JSON report"""
        report_file = self.output_dir / f"{suite_name}_report.json"
        
        # Default result
        result = TestSuiteResult(
            suite_name=suite_name,
            category=category,
            total_tests=0,
            passed=0,
            failed=0,
            skipped=0,
            errors=0,
            execution_time=execution_time
        )
        
        try:
            if report_file.exists():
                with open(report_file, 'r') as f:
                    data = json.load(f)
                    
                # Extract test counts
                result.total_tests = data.get('numTotalTests', 0)
                result.passed = data.get('numPassedTests', 0)
                result.failed = data.get('numFailedTests', 0)
                result.skipped = data.get('numPendingTests', 0)
                
                # Extract individual test results
                for test_result_data in data.get('testResults', []):
                    for assertion in test_result_data.get('assertionResults', []):
                        test_result = PropertyTestResult(
                            test_id=assertion.get('fullName', ''),
                            test_name=assertion.get('title', ''),
                            property_number=self._extract_property_number(assertion.get('title', '')),
                            category=category,
                            status=TestStatus.PASSED if assertion.get('status') == 'passed' else TestStatus.FAILED,
                            execution_time=assertion.get('duration', 0.0) / 1000.0,  # Convert ms to seconds
                            error_message=assertion.get('failureMessages', [None])[0]
                        )
                        result.test_results.append(test_result)
        except Exception as e:
            if self.verbose:
                print(f"Warning: Could not parse results for {suite_name}: {e}")
        
        return result
    
    def _extract_property_number(self, test_name: str) -> Optional[int]:
        """Extract property number from test name"""
        import re
        match = re.search(r'Property\s+(\d+)', test_name, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return None
    
    def _aggregate_results(self):
        """Aggregate results from all test suites"""
        if not self.current_report:
            return
        
        all_suites = self.current_report.backend_suites + self.current_report.frontend_suites
        
        self.current_report.total_tests = sum(suite.total_tests for suite in all_suites)
        self.current_report.total_passed = sum(suite.passed for suite in all_suites)
        self.current_report.total_failed = sum(suite.failed for suite in all_suites)
        self.current_report.total_skipped = sum(suite.skipped for suite in all_suites)
        self.current_report.total_errors = sum(suite.errors for suite in all_suites)
        
        # Determine overall status
        if self.current_report.total_errors > 0:
            self.current_report.overall_status = TestStatus.ERROR
        elif self.current_report.total_failed > 0:
            self.current_report.overall_status = TestStatus.FAILED
        elif self.current_report.total_tests == 0:
            self.current_report.overall_status = TestStatus.SKIPPED
        else:
            self.current_report.overall_status = TestStatus.PASSED
    
    async def _generate_reports(self):
        """Generate comprehensive test reports"""
        if not self.current_report:
            return
        
        # Generate JSON report
        json_report_path = self.output_dir / f"{self.current_report.execution_id}_report.json"
        with open(json_report_path, 'w') as f:
            json.dump(self.current_report.to_dict(), f, indent=2)
        
        # Generate human-readable report
        text_report_path = self.output_dir / f"{self.current_report.execution_id}_report.txt"
        with open(text_report_path, 'w') as f:
            f.write(self._format_text_report())
        
        # Generate summary report
        summary_path = self.output_dir / "latest_summary.txt"
        with open(summary_path, 'w') as f:
            f.write(self._format_summary_report())
        
        if self.verbose:
            print(f"\n{'='*80}")
            print(f"Reports generated:")
            print(f"  - JSON: {json_report_path}")
            print(f"  - Text: {text_report_path}")
            print(f"  - Summary: {summary_path}")
            print(f"{'='*80}\n")
    
    def _format_text_report(self) -> str:
        """Format comprehensive text report"""
        if not self.current_report:
            return ""
        
        lines = []
        lines.append("=" * 80)
        lines.append("PROPERTY-BASED TESTING ORCHESTRATION REPORT")
        lines.append("=" * 80)
        lines.append(f"Execution ID: {self.current_report.execution_id}")
        lines.append(f"Start Time: {self.current_report.start_time.isoformat()}")
        lines.append(f"End Time: {self.current_report.end_time.isoformat() if self.current_report.end_time else 'N/A'}")
        lines.append(f"Total Execution Time: {self.current_report.total_execution_time:.2f}s")
        lines.append(f"Overall Status: {self.current_report.overall_status.value.upper()}")
        lines.append("")
        
        lines.append("SUMMARY")
        lines.append("-" * 80)
        lines.append(f"Total Tests: {self.current_report.total_tests}")
        lines.append(f"Passed: {self.current_report.total_passed}")
        lines.append(f"Failed: {self.current_report.total_failed}")
        lines.append(f"Skipped: {self.current_report.total_skipped}")
        lines.append(f"Errors: {self.current_report.total_errors}")
        lines.append(f"Success Rate: {self.current_report.overall_success_rate:.2f}%")
        lines.append("")
        
        # Backend suites
        if self.current_report.backend_suites:
            lines.append("BACKEND TEST SUITES")
            lines.append("-" * 80)
            for suite in self.current_report.backend_suites:
                lines.append(f"\n{suite.suite_name} ({suite.category.value})")
                lines.append(f"  Tests: {suite.total_tests} | Passed: {suite.passed} | "
                           f"Failed: {suite.failed} | Time: {suite.execution_time:.2f}s")
                lines.append(f"  Success Rate: {suite.success_rate:.2f}%")
                
                if suite.test_results:
                    for test in suite.test_results:
                        status_symbol = "✓" if test.status == TestStatus.PASSED else "✗"
                        lines.append(f"    {status_symbol} {test.test_name} ({test.execution_time:.2f}s)")
                        if test.error_message:
                            lines.append(f"      Error: {test.error_message[:100]}...")
            lines.append("")
        
        # Frontend suites
        if self.current_report.frontend_suites:
            lines.append("FRONTEND TEST SUITES")
            lines.append("-" * 80)
            for suite in self.current_report.frontend_suites:
                lines.append(f"\n{suite.suite_name} ({suite.category.value})")
                lines.append(f"  Tests: {suite.total_tests} | Passed: {suite.passed} | "
                           f"Failed: {suite.failed} | Time: {suite.execution_time:.2f}s")
                lines.append(f"  Success Rate: {suite.success_rate:.2f}%")
                
                if suite.test_results:
                    for test in suite.test_results:
                        status_symbol = "✓" if test.status == TestStatus.PASSED else "✗"
                        lines.append(f"    {status_symbol} {test.test_name} ({test.execution_time:.2f}s)")
                        if test.error_message:
                            lines.append(f"      Error: {test.error_message[:100]}...")
            lines.append("")
        
        lines.append("=" * 80)
        return "\n".join(lines)
    
    def _format_summary_report(self) -> str:
        """Format concise summary report"""
        if not self.current_report:
            return ""
        
        lines = []
        lines.append("PROPERTY-BASED TESTING SUMMARY")
        lines.append("=" * 60)
        lines.append(f"Status: {self.current_report.overall_status.value.upper()}")
        lines.append(f"Tests: {self.current_report.total_passed}/{self.current_report.total_tests} passed")
        lines.append(f"Success Rate: {self.current_report.overall_success_rate:.2f}%")
        lines.append(f"Execution Time: {self.current_report.total_execution_time:.2f}s")
        lines.append(f"Timestamp: {self.current_report.start_time.isoformat()}")
        
        if self.current_report.total_failed > 0:
            lines.append(f"\n⚠ {self.current_report.total_failed} test(s) failed")
        if self.current_report.total_errors > 0:
            lines.append(f"⚠ {self.current_report.total_errors} error(s) occurred")
        
        lines.append("=" * 60)
        return "\n".join(lines)


def _project_root() -> Path:
    """Resolve project root (repo root) from this script's location. Always returns an absolute path."""
    script_dir = Path(__file__).resolve().parent
    # backend/tests/property_tests -> backend/tests -> backend -> repo root
    return script_dir.parent.parent.parent.resolve()


# Convenience function for running orchestration
async def run_orchestration(
    backend_test_dir: str = "backend/tests/property_tests",
    frontend_test_dir: str = "__tests__/property",
    output_dir: str = "test-results/pbt-orchestration",
    parallel: bool = True,
    verbose: bool = True,
    backend_only: bool = False,
    frontend_only: bool = False
) -> OrchestrationReport:
    """
    Run property-based test orchestration.
    
    Args:
        backend_test_dir: Path to backend property tests (relative to project root)
        frontend_test_dir: Path to frontend tests (relative to project root)
        output_dir: Path for test reports (relative to project root)
        parallel: Run backend/frontend in parallel
        verbose: Enable verbose output
        backend_only: Run only backend tests
        frontend_only: Run only frontend tests
        
    Returns:
        Complete orchestration report
    """
    root = _project_root()
    backend_path = Path(backend_test_dir) if Path(backend_test_dir).is_absolute() else root / backend_test_dir
    frontend_path = Path(frontend_test_dir) if Path(frontend_test_dir).is_absolute() else root / frontend_test_dir
    out_path = Path(output_dir) if Path(output_dir).is_absolute() else root / output_dir
    orchestrator = TestOrchestrator(
        backend_test_dir=backend_path,
        frontend_test_dir=frontend_path,
        output_dir=out_path,
        parallel_execution=parallel,
        verbose=verbose
    )
    
    # Register backend test suites
    orchestrator.register_backend_suite("test_pbt_framework_integration", TestCategory.BACKEND_INFRASTRUCTURE)
    orchestrator.register_backend_suite("test_financial_variance_accuracy", TestCategory.FINANCIAL_ACCURACY)
    orchestrator.register_backend_suite("test_api_contract_validation", TestCategory.API_CONTRACT)
    orchestrator.register_backend_suite("test_data_integrity_crud_concurrency", TestCategory.DATA_INTEGRITY)
    orchestrator.register_backend_suite("test_performance_validation_properties", TestCategory.PERFORMANCE)
    
    # Register frontend test suites (examples)
    orchestrator.register_frontend_suite("ui-consistency.property", TestCategory.FILTER_CONSISTENCY)
    orchestrator.register_frontend_suite("frontend-loading-states.property", TestCategory.FRONTEND_INFRASTRUCTURE)
    
    # Run orchestration
    report = await orchestrator.run_all_tests(
        backend_only=backend_only,
        frontend_only=frontend_only
    )
    
    return report


if __name__ == "__main__":
    # Run orchestration from command line
    import argparse
    
    parser = argparse.ArgumentParser(description="Property-Based Testing Orchestration")
    parser.add_argument("--backend-only", action="store_true", help="Run only backend tests")
    parser.add_argument("--frontend-only", action="store_true", help="Run only frontend tests")
    parser.add_argument("--sequential", action="store_true", help="Run tests sequentially")
    parser.add_argument("--quiet", action="store_true", help="Minimal output")
    parser.add_argument("--output-dir", default="test-results/pbt-orchestration", help="Output directory")
    
    args = parser.parse_args()
    
    report = asyncio.run(run_orchestration(
        parallel=not args.sequential,
        verbose=not args.quiet,
        backend_only=args.backend_only,
        frontend_only=args.frontend_only,
        output_dir=args.output_dir
    ))
    
    # Exit 0 when passed or when no tests were run (skipped); exit 1 on failure or error
    sys.exit(0 if report.overall_status in (TestStatus.PASSED, TestStatus.SKIPPED) else 1)
