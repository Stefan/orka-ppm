#!/usr/bin/env python3
"""
Performance Test Runner

Runs comprehensive performance tests for the change management system including:
- Unit performance tests
- Load tests
- Database optimization verification
- Cache performance validation
"""

import asyncio
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

from config.settings import settings
from services.database_optimization_service import db_optimization_service
from services.cache_service import cache_service

async def check_prerequisites():
    """Check that all prerequisites are met for performance testing"""
    print("🔍 Checking prerequisites...")
    
    # Check database connection
    try:
        from config.database import supabase
        if not supabase:
            print("❌ Database connection not available")
            return False
        print("✅ Database connection available")
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False
    
    # Check Redis cache availability
    cache_available = cache_service.is_available()
    if cache_available:
        print("✅ Redis cache available")
    else:
        print("⚠️ Redis cache not available - some tests may be skipped")
    
    # Check if performance optimization is applied
    try:
        health_metrics = await db_optimization_service.get_database_health_metrics()
        if health_metrics.get("error"):
            print(f"⚠️ Database health check warning: {health_metrics['error']}")
        else:
            print("✅ Database health check passed")
    except Exception as e:
        print(f"⚠️ Database health check failed: {e}")
    
    print("Prerequisites check completed\n")
    return True

async def run_database_optimization():
    """Apply database optimizations before performance testing"""
    print("🔧 Applying database optimizations...")
    
    try:
        # Run maintenance tasks
        results = await db_optimization_service.run_maintenance_tasks()
        
        print("Database optimization results:")
        if results.get("indexes_created", {}).get("created"):
            print(f"  ✅ Created {len(results['indexes_created']['created'])} indexes")
        
        if results.get("statistics_updated", {}).get("analyzed"):
            print(f"  ✅ Updated statistics for {len(results['statistics_updated']['analyzed'])} tables")
        
        if results.get("cleanup_performed", {}).get("cleaned"):
            print(f"  ✅ Cleaned up {len(results['cleanup_performed']['cleaned'])} table types")
        
        if results.get("optimizations_applied", {}).get("optimized"):
            print(f"  ✅ Applied {len(results['optimizations_applied']['optimized'])} query optimizations")
        
        if results.get("errors"):
            print("  ⚠️ Some optimization errors occurred:")
            for error in results["errors"][:3]:
                print(f"    - {error}")
        
        print("Database optimization completed\n")
        return True
        
    except Exception as e:
        print(f"❌ Database optimization failed: {e}")
        return False

async def run_unit_performance_tests():
    """Run unit performance tests using pytest"""
    print("🧪 Running unit performance tests...")
    
    try:
        # Run the performance test module
        cmd = [
            sys.executable, "-m", "pytest", 
            "test_change_management_performance.py",
            "-v", "--tb=short", "-m", "performance"
        ]
        
        result = subprocess.run(
            cmd,
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes timeout
        )
        
        print("Unit performance test output:")
        print(result.stdout)
        
        if result.stderr:
            print("Errors/Warnings:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("✅ Unit performance tests passed")
            return True
        else:
            print(f"❌ Unit performance tests failed (exit code: {result.returncode})")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Unit performance tests timed out")
        return False
    except Exception as e:
        print(f"❌ Error running unit performance tests: {e}")
        return False

async def run_load_tests():
    """Run load tests"""
    print("🚀 Running load tests...")
    
    try:
        # Import and run load tests
        from test_change_management_load import run_load_test_suite
        
        await run_load_test_suite()
        
        print("✅ Load tests completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Load tests failed: {e}")
        return False

async def run_cache_performance_validation():
    """Validate cache performance"""
    print("💾 Validating cache performance...")
    
    if not cache_service.is_available():
        print("⚠️ Cache not available - skipping cache performance validation")
        return True
    
    try:
        # Test cache health
        health_result = await cache_service.health_check()
        
        if health_result["status"] == "healthy":
            print("✅ Cache health check passed")
            print(f"  Redis version: {health_result.get('redis_version', 'unknown')}")
            print(f"  Connected clients: {health_result.get('connected_clients', 'unknown')}")
            print(f"  Memory usage: {health_result.get('used_memory_human', 'unknown')}")
        else:
            print(f"⚠️ Cache health check warning: {health_result.get('error', 'unknown')}")
        
        # Test basic cache operations performance
        print("Testing cache operation performance...")
        
        start_time = time.time()
        
        # Test set operations
        for i in range(100):
            await cache_service.set(f"perf_test_{i}", {"test": "data", "index": i}, ttl=60)
        
        set_time = time.time() - start_time
        
        # Test get operations
        start_time = time.time()
        
        for i in range(100):
            await cache_service.get(f"perf_test_{i}")
        
        get_time = time.time() - start_time
        
        # Test delete operations
        start_time = time.time()
        
        for i in range(100):
            await cache_service.delete(f"perf_test_{i}")
        
        delete_time = time.time() - start_time
        
        print(f"  Set operations: {set_time:.3f}s for 100 ops ({100/set_time:.1f} ops/sec)")
        print(f"  Get operations: {get_time:.3f}s for 100 ops ({100/get_time:.1f} ops/sec)")
        print(f"  Delete operations: {delete_time:.3f}s for 100 ops ({100/delete_time:.1f} ops/sec)")
        
        # Performance assertions
        assert set_time < 1.0, f"Cache set operations too slow: {set_time:.3f}s"
        assert get_time < 0.5, f"Cache get operations too slow: {get_time:.3f}s"
        assert delete_time < 1.0, f"Cache delete operations too slow: {delete_time:.3f}s"
        
        print("✅ Cache performance validation passed")
        return True
        
    except Exception as e:
        print(f"❌ Cache performance validation failed: {e}")
        return False

async def generate_performance_report():
    """Generate a comprehensive performance report"""
    print("📊 Generating performance report...")
    
    try:
        # Get database health metrics
        db_metrics = await db_optimization_service.get_database_health_metrics()
        
        # Get cache health metrics
        cache_metrics = await cache_service.health_check() if cache_service.is_available() else {"status": "unavailable"}
        
        report = f"""
# Change Management System Performance Report
Generated: {datetime.now().isoformat()}

## Environment Information
- Environment: {settings.environment}
- Database URL configured: {bool(settings.SUPABASE_URL)}
- Redis URL configured: {bool(settings.REDIS_URL)}

## Database Health Metrics
"""
        
        if db_metrics.get("table_sizes"):
            report += "### Table Sizes\n"
            for table, metrics in db_metrics["table_sizes"].items():
                report += f"- {table}: {metrics.get('row_count', 0)} rows\n"
        
        if db_metrics.get("maintenance_needed"):
            report += "\n### Maintenance Recommendations\n"
            for item in db_metrics["maintenance_needed"]:
                report += f"- {item['type']}: {item['table']} - {item['reason']}\n"
        
        report += f"""
## Cache Health Metrics
- Status: {cache_metrics.get('status', 'unknown')}
- Redis Version: {cache_metrics.get('redis_version', 'N/A')}
- Connected Clients: {cache_metrics.get('connected_clients', 'N/A')}
- Memory Usage: {cache_metrics.get('used_memory_human', 'N/A')}

## Performance Test Summary
- Unit Performance Tests: See detailed output above
- Load Tests: See detailed output above
- Cache Performance: See validation results above

## Recommendations
1. Monitor database table sizes regularly
2. Run cleanup procedures weekly for audit logs
3. Refresh materialized views hourly
4. Monitor cache hit rates and memory usage
5. Consider partitioning audit logs if volume exceeds 1M records

---
Report generated by Change Management Performance Test Suite
"""
        
        # Write report to file
        report_file = Path(__file__).parent / f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"📄 Performance report saved to: {report_file}")
        print("✅ Performance report generated")
        return True
        
    except Exception as e:
        print(f"❌ Error generating performance report: {e}")
        return False

async def main():
    """Main function to run all performance tests"""
    print("🎯 Change Management System Performance Test Suite")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Environment: {settings.environment}")
    print()
    
    start_time = time.time()
    
    # Track test results
    test_results = {
        "prerequisites": False,
        "database_optimization": False,
        "unit_performance_tests": False,
        "load_tests": False,
        "cache_validation": False,
        "report_generation": False
    }
    
    try:
        # Step 1: Check prerequisites
        test_results["prerequisites"] = await check_prerequisites()
        if not test_results["prerequisites"]:
            print("❌ Prerequisites check failed - aborting tests")
            return 1
        
        # Step 2: Apply database optimizations
        test_results["database_optimization"] = await run_database_optimization()
        
        # Step 3: Run unit performance tests
        test_results["unit_performance_tests"] = await run_unit_performance_tests()
        
        # Step 4: Run load tests
        test_results["load_tests"] = await run_load_tests()
        
        # Step 5: Validate cache performance
        test_results["cache_validation"] = await run_cache_performance_validation()
        
        # Step 6: Generate performance report
        test_results["report_generation"] = await generate_performance_report()
        
    except KeyboardInterrupt:
        print("\n⚠️ Performance tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Unexpected error during performance tests: {e}")
        return 1
    
    finally:
        end_time = time.time()
        total_time = end_time - start_time
        
        print("\n" + "=" * 60)
        print("PERFORMANCE TEST SUITE SUMMARY")
        print("=" * 60)
        
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        passed_tests = sum(test_results.values())
        total_tests = len(test_results)
        
        print(f"\nOverall Results: {passed_tests}/{total_tests} tests passed")
        print(f"Total execution time: {total_time:.1f} seconds")
        
        if passed_tests == total_tests:
            print("\n🎉 All performance tests completed successfully!")
            return 0
        else:
            print(f"\n⚠️ {total_tests - passed_tests} performance tests failed")
            return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)