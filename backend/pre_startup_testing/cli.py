"""
Command-line interface for the pre-startup testing system.
"""

import asyncio
import sys
import argparse
import json
import os
from typing import Dict, Any

from .models import ValidationConfiguration
from .runner import PreStartupTestRunner
from .test_reporter import ConsoleTestReporter


class PreStartupTestCLI:
    """
    Command-line interface for running pre-startup tests independently.
    
    This class provides:
    - Standalone command for running tests independently
    - Command-line flags for skipping tests during urgent debugging
    - CI/CD support with machine-readable output
    - Flexible configuration options
    """
    
    def __init__(self):
        self.parser = self._create_argument_parser()
        self.reporter = ConsoleTestReporter()
    
    def _create_argument_parser(self) -> argparse.ArgumentParser:
        """Create command-line argument parser."""
        parser = argparse.ArgumentParser(
            description="Pre-Startup Testing System - Validate system configuration before server startup",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  python -m pre_startup_testing.cli                    # Run all tests
  python -m pre_startup_testing.cli --critical-only    # Run only critical tests
  python -m pre_startup_testing.cli --json             # Output in JSON format
  python -m pre_startup_testing.cli --skip-tests       # Skip tests (for urgent debugging)
  python -m pre_startup_testing.cli --timeout 60       # Set custom timeout
  python -m pre_startup_testing.cli --base-url http://localhost:3000  # Custom base URL
            """
        )
        
        # Test execution options
        parser.add_argument(
            "--critical-only",
            action="store_true",
            help="Run only critical tests (faster execution)"
        )
        
        parser.add_argument(
            "--skip-tests",
            action="store_true",
            help="Skip all tests and exit successfully (for urgent debugging)"
        )
        
        parser.add_argument(
            "--skip-non-critical",
            action="store_true",
            help="Skip non-critical tests and allow startup with warnings"
        )
        
        # Configuration options
        parser.add_argument(
            "--timeout",
            type=int,
            default=30,
            help="Test execution timeout in seconds (default: 30)"
        )
        
        parser.add_argument(
            "--base-url",
            default="http://localhost:8000",
            help="Base URL for API endpoint testing (default: http://localhost:8000)"
        )
        
        parser.add_argument(
            "--no-parallel",
            action="store_true",
            help="Disable parallel test execution"
        )
        
        parser.add_argument(
            "--no-cache",
            action="store_true",
            help="Disable test result caching"
        )
        
        # Output options
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output results in JSON format (for CI/CD integration)"
        )
        
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Suppress progress output (only show final results)"
        )
        
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed test execution information"
        )
        
        # Development options
        parser.add_argument(
            "--dev-mode",
            action="store_true",
            help="Enable development mode (more lenient failure handling)"
        )
        
        parser.add_argument(
            "--endpoints",
            nargs="+",
            help="Specific endpoints to test (space-separated list)"
        )
        
        return parser
    
    def _create_configuration(self, args: argparse.Namespace) -> ValidationConfiguration:
        """Create validation configuration from command-line arguments."""
        # Default endpoints
        default_endpoints = [
            "/admin/users",
            "/csv-import/variances", 
            "/variance/alerts",
            "/health"
        ]
        
        return ValidationConfiguration(
            parallel_execution=not args.no_parallel,
            timeout_seconds=args.timeout,
            cache_results=not args.no_cache,
            skip_non_critical=args.skip_non_critical,
            development_mode=args.dev_mode or os.getenv("ENVIRONMENT", "development") == "development",
            test_endpoints=args.endpoints if args.endpoints else default_endpoints
        )
    
    async def run_tests(self, args: argparse.Namespace) -> Dict[str, Any]:
        """
        Run pre-startup tests based on command-line arguments.
        
        Args:
            args: Parsed command-line arguments
            
        Returns:
            Dictionary containing test results and metadata
        """
        if args.skip_tests:
            if not args.quiet:
                print("⏭️  Pre-startup tests SKIPPED (--skip-tests flag)")
            return {
                "status": "skipped",
                "message": "Tests skipped by user request",
                "exit_code": 0
            }
        
        # Create configuration
        config = self._create_configuration(args)
        
        # Create test runner
        runner = PreStartupTestRunner(config)
        runner.initialize_validators(args.base_url)
        
        if not args.quiet:
            print("🚀 Pre-Startup Testing System")
            print("=" * 50)
            if args.verbose:
                print(f"Configuration:")
                print(f"  - Base URL: {args.base_url}")
                print(f"  - Timeout: {args.timeout}s")
                print(f"  - Parallel: {not args.no_parallel}")
                print(f"  - Cache: {not args.no_cache}")
                print(f"  - Development Mode: {config.development_mode}")
                print(f"  - Test Endpoints: {len(config.test_endpoints)}")
                print("")
        
        try:
            # Run tests
            if args.critical_only:
                if not args.quiet:
                    print("Running critical tests only...")
                results = await runner.run_critical_tests_only()
            else:
                if not args.quiet:
                    print("Running all validation tests...")
                results = await runner.run_all_tests()
            
            # Determine startup decision
            startup_allowed = runner.should_allow_startup(results)
            
            # Generate report
            if args.json:
                # Machine-readable JSON output for CI/CD
                return self._generate_json_report(results, runner, startup_allowed)
            else:
                # Human-readable console output
                if config.development_mode and not args.quiet:
                    report = runner.generate_enhanced_startup_report(results)
                else:
                    report = runner.generate_startup_report(results)
                
                if not args.quiet:
                    print(report)
                    print("=" * 50)
                
                return {
                    "status": "completed",
                    "startup_allowed": startup_allowed,
                    "exit_code": 0 if startup_allowed else 1,
                    "results": results,
                    "report": report
                }
        
        except Exception as e:
            error_msg = f"Error running pre-startup tests: {e}"
            
            if args.json:
                return {
                    "status": "error",
                    "error": str(e),
                    "startup_allowed": config.development_mode,  # Allow in dev mode
                    "exit_code": 0 if config.development_mode else 1
                }
            else:
                if not args.quiet:
                    print(f"❌ {error_msg}")
                    if config.development_mode:
                        print("⚠️  Development mode: allowing startup despite test error")
                    else:
                        print("🛑 Production mode: blocking startup due to test error")
                
                return {
                    "status": "error",
                    "error": str(e),
                    "startup_allowed": config.development_mode,
                    "exit_code": 0 if config.development_mode else 1
                }
    
    def _generate_json_report(self, results, runner, startup_allowed: bool) -> Dict[str, Any]:
        """Generate machine-readable JSON report for CI/CD integration."""
        return {
            "status": "completed",
            "timestamp": results.timestamp.isoformat(),
            "execution_time": results.execution_time,
            "overall_status": results.overall_status.value,
            "startup_allowed": startup_allowed,
            "exit_code": 0 if startup_allowed else 1,
            "summary": {
                "total_tests": len(results.validation_results),
                "passed": len(results.get_passed_tests()),
                "failed": len(results.get_failed_tests()),
                "warnings": len(results.get_warning_tests()),
                "critical_failures": len([
                    r for r in results.get_failed_tests() 
                    if runner.classify_failure_criticality(r) == 'critical'
                ])
            },
            "test_results": [
                {
                    "component": result.component,
                    "test_name": result.test_name,
                    "status": result.status.value,
                    "severity": result.severity.value,
                    "message": result.message,
                    "execution_time": result.execution_time,
                    "criticality": runner.classify_failure_criticality(result) if result.status.value == "fail" else None,
                    "resolution_steps": result.resolution_steps
                }
                for result in results.validation_results
            ],
            "service_impact": runner.analyze_service_impact(results) if results.get_failed_tests() else {},
            "fallback_suggestions": runner.get_fallback_suggestions(results) if results.get_failed_tests() else {}
        }
    
    async def main(self) -> int:
        """Main CLI entry point."""
        try:
            args = self.parser.parse_args()
            
            # Run tests
            result = await self.run_tests(args)
            
            # Output JSON if requested
            if args.json:
                print(json.dumps(result, indent=2, default=str))
            
            # Return appropriate exit code
            return result.get("exit_code", 0)
            
        except KeyboardInterrupt:
            if not getattr(args, 'quiet', False):
                print("\n⚠️  Tests interrupted by user")
            return 130  # Standard exit code for SIGINT
        except Exception as e:
            print(f"❌ Unexpected error: {e}", file=sys.stderr)
            return 1


# Convenience functions for different use cases
async def run_pre_startup_tests_cli() -> int:
    """Run pre-startup tests from command line."""
    cli = PreStartupTestCLI()
    return await cli.main()


async def run_pre_startup_tests_programmatic(
    base_url: str = "http://localhost:8000",
    critical_only: bool = False,
    timeout: int = 30,
    development_mode: bool = True
) -> Dict[str, Any]:
    """
    Run pre-startup tests programmatically.
    
    Args:
        base_url: Base URL for API endpoint testing
        critical_only: Whether to run only critical tests
        timeout: Test execution timeout in seconds
        development_mode: Whether to use development mode settings
        
    Returns:
        Dictionary containing test results
    """
    # Create mock args for programmatic use
    class MockArgs:
        def __init__(self):
            self.skip_tests = False
            self.critical_only = critical_only
            self.timeout = timeout
            self.base_url = base_url
            self.no_parallel = False
            self.no_cache = False
            self.skip_non_critical = False
            self.dev_mode = development_mode
            self.endpoints = None
            self.json = True
            self.quiet = True
            self.verbose = False
    
    cli = PreStartupTestCLI()
    return await cli.run_tests(MockArgs())


# Main entry point
async def main():
    """Main CLI entry point."""
    cli = PreStartupTestCLI()
    exit_code = await cli.main()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())