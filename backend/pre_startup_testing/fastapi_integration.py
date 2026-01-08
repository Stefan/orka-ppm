"""
FastAPI integration for pre-startup testing system.

This module provides integration with FastAPI's lifespan events to automatically
run pre-startup tests before the server starts accepting requests.
"""

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from .models import ValidationConfiguration
from .runner import PreStartupTestRunner
from .test_reporter import ConsoleTestReporter


class FastAPIPreStartupIntegration:
    """
    Integration class for hooking pre-startup tests into FastAPI application startup.
    
    This class provides:
    - Automatic test execution during FastAPI startup
    - Configuration from environment variables
    - Graceful error handling and reporting
    - Optional test skipping for urgent debugging
    """
    
    def __init__(self, app: FastAPI, base_url: str = "http://localhost:8000"):
        self.app = app
        self.base_url = base_url
        self.config = self._create_configuration()
        self.runner = PreStartupTestRunner(self.config)
        self.reporter = ConsoleTestReporter()
        
        # Check if tests should be skipped
        self.skip_tests = self._should_skip_tests()
        
    def _create_configuration(self) -> ValidationConfiguration:
        """Create validation configuration from environment variables."""
        return ValidationConfiguration(
            parallel_execution=os.getenv("PRE_STARTUP_PARALLEL", "true").lower() == "true",
            timeout_seconds=int(os.getenv("PRE_STARTUP_TIMEOUT", "30")),
            cache_results=os.getenv("PRE_STARTUP_CACHE", "true").lower() == "true",
            skip_non_critical=os.getenv("PRE_STARTUP_SKIP_NON_CRITICAL", "false").lower() == "true",
            development_mode=os.getenv("ENVIRONMENT", "development") == "development",
            test_endpoints=[
                "/admin/users",
                "/csv-import/variances", 
                "/variance/alerts",
                "/health"
            ]
        )
    
    def _should_skip_tests(self) -> bool:
        """Check if tests should be skipped based on environment variables or command line flags."""
        # Check environment variable
        if os.getenv("SKIP_PRE_STARTUP_TESTS", "false").lower() == "true":
            return True
        
        # Check command line arguments
        if "--skip-pre-startup-tests" in sys.argv:
            return True
        
        # Check for urgent debugging flag
        if "--debug-urgent" in sys.argv:
            return True
        
        return False
    
    async def run_pre_startup_tests(self) -> bool:
        """
        Run pre-startup tests and determine if startup should proceed.
        
        Returns:
            True if startup should proceed, False if it should be blocked
        """
        if self.skip_tests:
            print("⏭️  Pre-startup tests SKIPPED (--skip-pre-startup-tests or SKIP_PRE_STARTUP_TESTS=true)")
            return True
        
        print("🚀 Running pre-startup validation tests...")
        print("=" * 50)
        
        try:
            # Initialize validators with the current base URL
            self.runner.initialize_validators(self.base_url)
            
            # Run all tests
            results = await self.runner.run_all_tests()
            
            # Generate and display report
            if self.config.development_mode:
                report = self.runner.generate_enhanced_startup_report(results)
            else:
                report = self.runner.generate_startup_report(results)
            
            print(report)
            print("=" * 50)
            
            # Determine if startup should proceed
            should_proceed = self.runner.should_allow_startup(results)
            
            if should_proceed:
                print("✅ Pre-startup tests completed successfully - starting server")
            else:
                print("❌ Pre-startup tests failed - blocking server startup")
                print("💡 Use --skip-pre-startup-tests to bypass for urgent debugging")
            
            return should_proceed
            
        except Exception as e:
            print(f"❌ Error running pre-startup tests: {e}")
            print("⚠️  Continuing with server startup due to test system error")
            
            # In case of test system failure, allow startup but warn
            if self.config.development_mode:
                return True
            else:
                # In production, be more cautious
                print("🛑 Production mode: blocking startup due to test system failure")
                return False
    
    def create_lifespan_handler(self):
        """
        Create a lifespan context manager for FastAPI that runs pre-startup tests.
        
        Returns:
            Async context manager for FastAPI lifespan events
        """
        @asynccontextmanager
        async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
            # Startup: Run pre-startup tests
            startup_allowed = await self.run_pre_startup_tests()
            
            if not startup_allowed:
                print("🛑 Server startup blocked by pre-startup tests")
                # Exit the process to prevent server from starting
                sys.exit(1)
            
            # Server is starting up
            yield
            
            # Shutdown: Clean up if needed
            print("🔄 Server shutting down...")
        
        return lifespan
    
    def integrate_with_app(self):
        """
        Integrate pre-startup testing with the FastAPI application.
        
        This method modifies the FastAPI app to include the lifespan handler.
        """
        # Set the lifespan handler
        self.app.router.lifespan_context = self.create_lifespan_handler()
        
        print("✅ Pre-startup testing integrated with FastAPI application")


def integrate_pre_startup_testing(app: FastAPI, base_url: str = "http://localhost:8000") -> FastAPIPreStartupIntegration:
    """
    Convenience function to integrate pre-startup testing with a FastAPI application.
    
    Args:
        app: FastAPI application instance
        base_url: Base URL for API endpoint testing
        
    Returns:
        FastAPIPreStartupIntegration instance for further configuration
    """
    integration = FastAPIPreStartupIntegration(app, base_url)
    integration.integrate_with_app()
    return integration


# Alternative approach using startup event (deprecated in newer FastAPI versions but still supported)
def setup_startup_event_integration(app: FastAPI, base_url: str = "http://localhost:8000"):
    """
    Alternative integration using FastAPI startup events (for older FastAPI versions).
    
    Args:
        app: FastAPI application instance
        base_url: Base URL for API endpoint testing
    """
    integration = FastAPIPreStartupIntegration(app, base_url)
    
    @app.on_event("startup")
    async def run_pre_startup_tests():
        startup_allowed = await integration.run_pre_startup_tests()
        if not startup_allowed:
            print("🛑 Server startup blocked by pre-startup tests")
            # Note: With startup events, we can't easily block startup,
            # so we just log the error and continue
            print("⚠️  Server will continue starting despite test failures")