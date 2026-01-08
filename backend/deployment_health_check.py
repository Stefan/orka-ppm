#!/usr/bin/env python3
"""
Deployment Health Check Script

This script performs comprehensive health checks after deployment to ensure
the user synchronization system is working correctly.

Usage:
    python deployment_health_check.py [--url <api_url>] [--timeout <seconds>] [--verbose]
"""

import argparse
import requests
import json
import sys
import time
from typing import Dict, Any, List, Optional
from datetime import datetime

class DeploymentHealthChecker:
    """Comprehensive health checker for post-deployment verification"""
    
    def __init__(self, base_url: str, timeout: int = 30, verbose: bool = False):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.verbose = verbose
        self.session = requests.Session()
        self.session.timeout = timeout
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if self.verbose or level in ["ERROR", "WARNING"]:
            print(f"[{timestamp}] {level}: {message}")
    
    def check_basic_health(self) -> Dict[str, Any]:
        """Check basic application health"""
        self.log("Checking basic application health...")
        
        try:
            response = self.session.get(f"{self.base_url}/health")
            response.raise_for_status()
            
            health_data = response.json()
            status = health_data.get("status", "unknown")
            
            if status == "healthy":
                self.log("✅ Basic health check passed")
                return {"status": "passed", "data": health_data}
            else:
                self.log(f"⚠️ Basic health check warning: {status}", "WARNING")
                return {"status": "warning", "data": health_data}
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ Basic health check failed: {e}", "ERROR")
            return {"status": "failed", "error": str(e)}
    
    def check_comprehensive_health(self) -> Dict[str, Any]:
        """Check comprehensive health including user sync"""
        self.log("Checking comprehensive health...")
        
        try:
            response = self.session.get(f"{self.base_url}/health/comprehensive")
            response.raise_for_status()
            
            health_data = response.json()
            status = health_data.get("status", "unknown")
            
            # Check user sync status
            user_sync = health_data.get("components", {}).get("user_sync", {})
            missing_profiles = user_sync.get("missing_profiles", 0)
            
            if status == "healthy" and missing_profiles == 0:
                self.log("✅ Comprehensive health check passed")
                return {"status": "passed", "data": health_data}
            elif missing_profiles > 0:
                self.log(f"⚠️ {missing_profiles} users need synchronization", "WARNING")
                return {"status": "warning", "data": health_data, "missing_profiles": missing_profiles}
            else:
                self.log(f"⚠️ Comprehensive health check warning: {status}", "WARNING")
                return {"status": "warning", "data": health_data}
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ Comprehensive health check failed: {e}", "ERROR")
            return {"status": "failed", "error": str(e)}
    
    def check_user_sync_health(self) -> Dict[str, Any]:
        """Check user synchronization health specifically"""
        self.log("Checking user synchronization health...")
        
        try:
            response = self.session.get(f"{self.base_url}/health/user-sync")
            response.raise_for_status()
            
            sync_data = response.json()
            status = sync_data.get("status", "unknown")
            missing_profiles = sync_data.get("missing_profiles", 0)
            sync_percentage = sync_data.get("sync_percentage", 0)
            
            if status == "healthy" and missing_profiles == 0:
                self.log("✅ User synchronization health check passed")
                return {"status": "passed", "data": sync_data}
            elif missing_profiles > 0:
                self.log(f"⚠️ User sync warning: {missing_profiles} missing profiles ({sync_percentage}% synced)", "WARNING")
                return {"status": "warning", "data": sync_data}
            else:
                self.log(f"⚠️ User sync status: {status}", "WARNING")
                return {"status": "warning", "data": sync_data}
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ User sync health check failed: {e}", "ERROR")
            return {"status": "failed", "error": str(e)}
    
    def test_api_endpoints(self) -> Dict[str, Any]:
        """Test critical API endpoints"""
        self.log("Testing critical API endpoints...")
        
        endpoints = [
            "/health",
            "/health/comprehensive", 
            "/health/user-sync",
            "/debug"
        ]
        
        results = {}
        passed = 0
        failed = 0
        
        for endpoint in endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                if response.status_code == 200:
                    results[endpoint] = {"status": "passed", "status_code": response.status_code}
                    passed += 1
                    self.log(f"✅ {endpoint} - OK")
                else:
                    results[endpoint] = {"status": "warning", "status_code": response.status_code}
                    self.log(f"⚠️ {endpoint} - Status {response.status_code}", "WARNING")
                    
            except requests.exceptions.RequestException as e:
                results[endpoint] = {"status": "failed", "error": str(e)}
                failed += 1
                self.log(f"❌ {endpoint} - Failed: {e}", "ERROR")
        
        overall_status = "passed" if failed == 0 else ("warning" if passed > failed else "failed")
        
        return {
            "status": overall_status,
            "passed": passed,
            "failed": failed,
            "total": len(endpoints),
            "results": results
        }
    
    def wait_for_startup(self, max_wait: int = 120) -> bool:
        """Wait for application to start up"""
        self.log(f"Waiting for application startup (max {max_wait}s)...")
        
        start_time = time.time()
        while time.time() - start_time < max_wait:
            try:
                response = self.session.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    self.log("✅ Application is responding")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(5)
            self.log("⏳ Still waiting for application...")
        
        self.log("❌ Application failed to start within timeout", "ERROR")
        return False
    
    def run_full_health_check(self, wait_for_startup: bool = True) -> Dict[str, Any]:
        """Run complete health check suite"""
        self.log("Starting deployment health check...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "timeout": self.timeout,
            "checks": {}
        }
        
        # Wait for startup if requested
        if wait_for_startup:
            if not self.wait_for_startup():
                results["status"] = "failed"
                results["error"] = "Application failed to start"
                return results
        
        # Run all health checks
        checks = [
            ("basic_health", self.check_basic_health),
            ("comprehensive_health", self.check_comprehensive_health),
            ("user_sync_health", self.check_user_sync_health),
            ("api_endpoints", self.test_api_endpoints)
        ]
        
        passed_checks = 0
        failed_checks = 0
        warning_checks = 0
        
        for check_name, check_func in checks:
            self.log(f"Running {check_name} check...")
            try:
                result = check_func()
                results["checks"][check_name] = result
                
                if result["status"] == "passed":
                    passed_checks += 1
                elif result["status"] == "warning":
                    warning_checks += 1
                else:
                    failed_checks += 1
                    
            except Exception as e:
                self.log(f"❌ {check_name} check failed with exception: {e}", "ERROR")
                results["checks"][check_name] = {"status": "failed", "error": str(e)}
                failed_checks += 1
        
        # Determine overall status
        if failed_checks == 0 and warning_checks == 0:
            overall_status = "passed"
        elif failed_checks == 0:
            overall_status = "warning"
        else:
            overall_status = "failed"
        
        results["status"] = overall_status
        results["summary"] = {
            "passed": passed_checks,
            "warnings": warning_checks,
            "failed": failed_checks,
            "total": len(checks)
        }
        
        # Log summary
        self.log(f"Health check completed: {overall_status.upper()}")
        self.log(f"Summary: {passed_checks} passed, {warning_checks} warnings, {failed_checks} failed")
        
        return results
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate a human-readable report"""
        report = []
        report.append("=" * 60)
        report.append("DEPLOYMENT HEALTH CHECK REPORT")
        report.append("=" * 60)
        report.append(f"Timestamp: {results['timestamp']}")
        report.append(f"Base URL: {results['base_url']}")
        report.append(f"Overall Status: {results['status'].upper()}")
        report.append("")
        
        summary = results.get("summary", {})
        report.append(f"Summary: {summary.get('passed', 0)} passed, "
                     f"{summary.get('warnings', 0)} warnings, "
                     f"{summary.get('failed', 0)} failed")
        report.append("")
        
        # Detailed results
        for check_name, check_result in results.get("checks", {}).items():
            status = check_result.get("status", "unknown").upper()
            report.append(f"{check_name.replace('_', ' ').title()}: {status}")
            
            if check_result.get("missing_profiles"):
                report.append(f"  - Missing profiles: {check_result['missing_profiles']}")
            
            if check_result.get("error"):
                report.append(f"  - Error: {check_result['error']}")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Deployment Health Check Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --url https://api.example.com
  %(prog)s --url http://localhost:8000 --verbose
  %(prog)s --url https://api.example.com --timeout 60 --no-wait
        """
    )
    
    parser.add_argument(
        '--url',
        default='http://localhost:8000',
        help='Base URL of the API to check (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Request timeout in seconds (default: 30)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    parser.add_argument(
        '--no-wait',
        action='store_true',
        help='Skip waiting for application startup'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )
    parser.add_argument(
        '--report',
        action='store_true',
        help='Generate human-readable report'
    )
    
    args = parser.parse_args()
    
    # Create health checker
    checker = DeploymentHealthChecker(
        base_url=args.url,
        timeout=args.timeout,
        verbose=args.verbose
    )
    
    try:
        # Run health checks
        results = checker.run_full_health_check(wait_for_startup=not args.no_wait)
        
        # Output results
        if args.json:
            print(json.dumps(results, indent=2))
        elif args.report:
            print(checker.generate_report(results))
        else:
            # Simple status output
            status = results["status"]
            summary = results.get("summary", {})
            
            print(f"Status: {status.upper()}")
            print(f"Checks: {summary.get('passed', 0)} passed, "
                  f"{summary.get('warnings', 0)} warnings, "
                  f"{summary.get('failed', 0)} failed")
            
            # Show warnings/errors
            for check_name, check_result in results.get("checks", {}).items():
                if check_result.get("status") != "passed":
                    print(f"  {check_name}: {check_result.get('status', 'unknown')}")
                    if check_result.get("missing_profiles"):
                        print(f"    Missing profiles: {check_result['missing_profiles']}")
        
        # Exit with appropriate code
        if results["status"] == "passed":
            sys.exit(0)
        elif results["status"] == "warning":
            sys.exit(1)  # Warnings still indicate issues
        else:
            sys.exit(2)  # Failed checks
            
    except KeyboardInterrupt:
        print("\nHealth check cancelled by user")
        sys.exit(130)
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(3)


if __name__ == '__main__':
    main()