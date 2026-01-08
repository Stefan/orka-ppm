"""
Performance Tests for Change Management System

Tests system performance under high change volume, concurrent approval processing,
data consistency, and analytics query performance with large datasets.
"""

import asyncio
import pytest
import time
import statistics
from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from uuid import uuid4, UUID
from decimal import Decimal
import random
import concurrent.futures
from dataclasses import dataclass

from config.database import supabase
from services.change_request_manager import ChangeRequestManager
from services.approval_workflow_engine import ApprovalWorkflowEngine
from services.change_analytics_service import ChangeAnalyticsService
from services.cache_service import cache_service
from services.database_optimization_service import db_optimization_service
from models.change_management import (
    ChangeRequestCreate, ChangeType, PriorityLevel, ChangeStatus,
    ApprovalDecision, ChangeRequestFilters
)

@dataclass
class PerformanceMetrics:
    """Container for performance test metrics"""
    operation_name: str
    total_operations: int
    total_time_seconds: float
    avg_time_per_operation: float
    min_time: float
    max_time: float
    operations_per_second: float
    success_rate: float
    errors: List[str]

class ChangeManagementPerformanceTest:
    """Performance test suite for change management system"""
    
    def __init__(self):
        self.change_manager = ChangeRequestManager()
        self.approval_engine = ApprovalWorkflowEngine()
        self.analytics_service = ChangeAnalyticsService()
        self.test_project_id = uuid4()
        self.test_user_id = uuid4()
        
    async def setup_test_data(self, num_changes: int = 1000) -> List[UUID]:
        """
        Set up test data for performance testing.
        
        Args:
            num_changes: Number of test change requests to create
            
        Returns:
            List of created change request IDs
        """
        print(f"Setting up {num_changes} test change requests...")
        
        # Create test project
        project_data = {
            "id": str(self.test_project_id),
            "name": f"Performance Test Project {datetime.now().isoformat()}",
            "description": "Project for performance testing",
            "status": "active",
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("projects").insert(project_data).execute()
        except Exception:
            # Project might already exist
            pass
        
        # Create test user
        user_data = {
            "id": str(self.test_user_id),
            "email": f"perf-test-{self.test_user_id}@example.com",
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            supabase.table("auth.users").insert(user_data).execute()
        except Exception:
            # User might already exist
            pass
        
        # Create change requests in batches
        change_ids = []
        batch_size = 50
        
        for i in range(0, num_changes, batch_size):
            batch_end = min(i + batch_size, num_changes)
            batch_changes = []
            
            for j in range(i, batch_end):
                change_data = ChangeRequestCreate(
                    title=f"Performance Test Change {j}",
                    description=f"Test change request for performance testing - {j}",
                    justification="Performance testing",
                    change_type=random.choice(list(ChangeType)),
                    priority=random.choice(list(PriorityLevel)),
                    project_id=self.test_project_id,
                    required_by_date=date.today() + timedelta(days=random.randint(1, 90)),
                    estimated_cost_impact=Decimal(random.randint(1000, 100000)),
                    estimated_schedule_impact_days=random.randint(1, 30),
                    estimated_effort_hours=Decimal(random.randint(8, 200))
                )
                
                try:
                    response = await self.change_manager.create_change_request(
                        change_data, self.test_user_id
                    )
                    change_ids.append(UUID(response.id))
                except Exception as e:
                    print(f"Error creating change request {j}: {e}")
            
            if i % 200 == 0:
                print(f"Created {i + batch_end - i} change requests...")
        
        print(f"Successfully created {len(change_ids)} test change requests")
        return change_ids
    
    async def cleanup_test_data(self, change_ids: List[UUID]):
        """Clean up test data after performance testing"""
        print("Cleaning up test data...")
        
        try:
            # Delete change requests in batches
            batch_size = 50
            for i in range(0, len(change_ids), batch_size):
                batch = change_ids[i:i + batch_size]
                batch_str = [str(cid) for cid in batch]
                
                # Delete related records first
                supabase.table("change_audit_log").delete().in_("change_request_id", batch_str).execute()
                supabase.table("change_approvals").delete().in_("change_request_id", batch_str).execute()
                supabase.table("change_impacts").delete().in_("change_request_id", batch_str).execute()
                supabase.table("change_implementations").delete().in_("change_request_id", batch_str).execute()
                
                # Delete change requests
                supabase.table("change_requests").delete().in_("id", batch_str).execute()
            
            # Clean up project and user
            supabase.table("projects").delete().eq("id", str(self.test_project_id)).execute()
            
        except Exception as e:
            print(f"Error during cleanup: {e}")
        
        print("Test data cleanup completed")
    
    def measure_performance(self, operation_name: str, times: List[float], errors: List[str]) -> PerformanceMetrics:
        """Calculate performance metrics from timing data"""
        if not times:
            return PerformanceMetrics(
                operation_name=operation_name,
                total_operations=0,
                total_time_seconds=0,
                avg_time_per_operation=0,
                min_time=0,
                max_time=0,
                operations_per_second=0,
                success_rate=0,
                errors=errors
            )
        
        total_time = sum(times)
        total_operations = len(times)
        success_rate = (total_operations / (total_operations + len(errors))) * 100 if (total_operations + len(errors)) > 0 else 0
        
        return PerformanceMetrics(
            operation_name=operation_name,
            total_operations=total_operations,
            total_time_seconds=total_time,
            avg_time_per_operation=statistics.mean(times),
            min_time=min(times),
            max_time=max(times),
            operations_per_second=total_operations / total_time if total_time > 0 else 0,
            success_rate=success_rate,
            errors=errors
        )
    
    async def test_high_volume_change_creation(self, num_changes: int = 500) -> PerformanceMetrics:
        """
        Test system performance under high change volume creation.
        
        Args:
            num_changes: Number of changes to create
            
        Returns:
            PerformanceMetrics with results
        """
        print(f"Testing high volume change creation ({num_changes} changes)...")
        
        times = []
        errors = []
        
        for i in range(num_changes):
            change_data = ChangeRequestCreate(
                title=f"High Volume Test Change {i}",
                description=f"Performance test change request {i}",
                justification="High volume performance testing",
                change_type=random.choice(list(ChangeType)),
                priority=random.choice(list(PriorityLevel)),
                project_id=self.test_project_id,
                estimated_cost_impact=Decimal(random.randint(1000, 50000))
            )
            
            start_time = time.time()
            try:
                await self.change_manager.create_change_request(change_data, self.test_user_id)
                end_time = time.time()
                times.append(end_time - start_time)
            except Exception as e:
                errors.append(f"Change {i}: {str(e)}")
            
            # Progress indicator
            if i % 100 == 0 and i > 0:
                print(f"Created {i} changes...")
        
        return self.measure_performance("High Volume Change Creation", times, errors)
    
    async def test_concurrent_change_operations(self, num_concurrent: int = 50, operations_per_thread: int = 20) -> PerformanceMetrics:
        """
        Test concurrent change request operations.
        
        Args:
            num_concurrent: Number of concurrent threads
            operations_per_thread: Number of operations per thread
            
        Returns:
            PerformanceMetrics with results
        """
        print(f"Testing concurrent operations ({num_concurrent} threads, {operations_per_thread} ops each)...")
        
        async def worker_thread(thread_id: int) -> Tuple[List[float], List[str]]:
            """Worker thread for concurrent operations"""
            times = []
            errors = []
            
            for i in range(operations_per_thread):
                change_data = ChangeRequestCreate(
                    title=f"Concurrent Test Change T{thread_id}-{i}",
                    description=f"Concurrent test change from thread {thread_id}",
                    justification="Concurrent performance testing",
                    change_type=random.choice(list(ChangeType)),
                    priority=random.choice(list(PriorityLevel)),
                    project_id=self.test_project_id,
                    estimated_cost_impact=Decimal(random.randint(1000, 25000))
                )
                
                start_time = time.time()
                try:
                    await self.change_manager.create_change_request(change_data, self.test_user_id)
                    end_time = time.time()
                    times.append(end_time - start_time)
                except Exception as e:
                    errors.append(f"Thread {thread_id}, Op {i}: {str(e)}")
            
            return times, errors
        
        # Run concurrent operations
        start_time = time.time()
        tasks = [worker_thread(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # Aggregate results
        all_times = []
        all_errors = []
        
        for result in results:
            if isinstance(result, Exception):
                all_errors.append(f"Thread error: {str(result)}")
            else:
                times, errors = result
                all_times.extend(times)
                all_errors.extend(errors)
        
        metrics = self.measure_performance("Concurrent Change Operations", all_times, all_errors)
        metrics.total_time_seconds = end_time - start_time  # Override with actual wall clock time
        
        return metrics
    
    async def test_approval_processing_performance(self, change_ids: List[UUID], num_approvals: int = 200) -> PerformanceMetrics:
        """
        Test approval processing performance.
        
        Args:
            change_ids: List of change request IDs to create approvals for
            num_approvals: Number of approvals to process
            
        Returns:
            PerformanceMetrics with results
        """
        print(f"Testing approval processing performance ({num_approvals} approvals)...")
        
        # Create approval requests
        approval_ids = []
        for i in range(min(num_approvals, len(change_ids))):
            try:
                # Create approval workflow
                workflow = await self.approval_engine.initiate_approval_workflow(
                    change_ids[i], "standard"
                )
                if workflow and hasattr(workflow, 'approval_steps'):
                    approval_ids.extend([step.id for step in workflow.approval_steps[:1]])  # Take first step
            except Exception as e:
                print(f"Error creating approval workflow {i}: {e}")
        
        # Process approvals
        times = []
        errors = []
        
        for i, approval_id in enumerate(approval_ids[:num_approvals]):
            start_time = time.time()
            try:
                await self.approval_engine.process_approval_decision(
                    approval_id,
                    ApprovalDecision.APPROVED,
                    self.test_user_id,
                    f"Performance test approval {i}"
                )
                end_time = time.time()
                times.append(end_time - start_time)
            except Exception as e:
                errors.append(f"Approval {i}: {str(e)}")
            
            if i % 50 == 0 and i > 0:
                print(f"Processed {i} approvals...")
        
        return self.measure_performance("Approval Processing", times, errors)
    
    async def test_analytics_query_performance(self, change_ids: List[UUID]) -> PerformanceMetrics:
        """
        Test analytics query performance with large datasets.
        
        Args:
            change_ids: List of change request IDs for analytics
            
        Returns:
            PerformanceMetrics with results
        """
        print(f"Testing analytics query performance with {len(change_ids)} changes...")
        
        times = []
        errors = []
        
        # Test different analytics queries
        analytics_operations = [
            ("get_change_analytics", lambda: self.analytics_service.get_change_analytics(
                project_id=self.test_project_id
            )),
            ("get_approval_performance_metrics", lambda: self.analytics_service.get_approval_performance_metrics(
                project_id=self.test_project_id
            )),
            ("get_change_trends", lambda: self.analytics_service.get_change_trends(
                project_id=self.test_project_id,
                date_from=date.today() - timedelta(days=90),
                date_to=date.today()
            )),
            ("get_impact_accuracy_analysis", lambda: self.analytics_service.get_impact_accuracy_analysis(
                project_id=self.test_project_id
            ))
        ]
        
        # Run each analytics operation multiple times
        for operation_name, operation_func in analytics_operations:
            for i in range(5):  # Run each operation 5 times
                start_time = time.time()
                try:
                    await operation_func()
                    end_time = time.time()
                    times.append(end_time - start_time)
                except Exception as e:
                    errors.append(f"{operation_name} run {i}: {str(e)}")
        
        return self.measure_performance("Analytics Queries", times, errors)
    
    async def test_cache_performance(self, change_ids: List[UUID], num_operations: int = 1000) -> PerformanceMetrics:
        """
        Test caching system performance.
        
        Args:
            change_ids: List of change request IDs
            num_operations: Number of cache operations to test
            
        Returns:
            PerformanceMetrics with results
        """
        print(f"Testing cache performance ({num_operations} operations)...")
        
        times = []
        errors = []
        
        # Test cache operations
        for i in range(num_operations):
            change_id = random.choice(change_ids)
            
            start_time = time.time()
            try:
                # Test cache hit/miss scenario
                if i % 3 == 0:
                    # Cache miss - get from database and cache
                    change_request = await self.change_manager.get_change_request(change_id)
                elif i % 3 == 1:
                    # Cache hit - get from cache
                    cached_data = await cache_service.get_cached_change_request(change_id)
                else:
                    # Cache invalidation
                    await cache_service.invalidate_change_request(change_id)
                
                end_time = time.time()
                times.append(end_time - start_time)
            except Exception as e:
                errors.append(f"Cache operation {i}: {str(e)}")
            
            if i % 200 == 0 and i > 0:
                print(f"Completed {i} cache operations...")
        
        return self.measure_performance("Cache Operations", times, errors)
    
    async def test_database_query_performance(self, change_ids: List[UUID]) -> PerformanceMetrics:
        """
        Test database query performance with various filters and pagination.
        
        Args:
            change_ids: List of change request IDs
            
        Returns:
            PerformanceMetrics with results
        """
        print("Testing database query performance...")
        
        times = []
        errors = []
        
        # Test different query patterns
        query_tests = [
            # Project-based queries
            lambda: self.change_manager.list_change_requests(
                ChangeRequestFilters(project_id=self.test_project_id, page_size=50)
            ),
            # Status-based queries
            lambda: self.change_manager.list_change_requests(
                ChangeRequestFilters(status=ChangeStatus.DRAFT, page_size=100)
            ),
            # Type-based queries
            lambda: self.change_manager.list_change_requests(
                ChangeRequestFilters(change_type=ChangeType.SCOPE, page_size=50)
            ),
            # Date range queries
            lambda: self.change_manager.list_change_requests(
                ChangeRequestFilters(
                    date_from=date.today() - timedelta(days=30),
                    date_to=date.today(),
                    page_size=100
                )
            ),
            # Complex filtered queries
            lambda: self.change_manager.list_change_requests(
                ChangeRequestFilters(
                    project_id=self.test_project_id,
                    status=ChangeStatus.SUBMITTED,
                    priority=PriorityLevel.HIGH,
                    page_size=25
                )
            )
        ]
        
        # Run each query type multiple times
        for i, query_func in enumerate(query_tests):
            for run in range(10):  # Run each query 10 times
                start_time = time.time()
                try:
                    await query_func()
                    end_time = time.time()
                    times.append(end_time - start_time)
                except Exception as e:
                    errors.append(f"Query {i} run {run}: {str(e)}")
        
        return self.measure_performance("Database Queries", times, errors)
    
    def print_performance_report(self, metrics_list: List[PerformanceMetrics]):
        """Print a comprehensive performance report"""
        print("\n" + "="*80)
        print("CHANGE MANAGEMENT SYSTEM PERFORMANCE REPORT")
        print("="*80)
        
        for metrics in metrics_list:
            print(f"\n{metrics.operation_name}:")
            print(f"  Total Operations: {metrics.total_operations}")
            print(f"  Total Time: {metrics.total_time_seconds:.2f} seconds")
            print(f"  Average Time per Operation: {metrics.avg_time_per_operation*1000:.2f} ms")
            print(f"  Min Time: {metrics.min_time*1000:.2f} ms")
            print(f"  Max Time: {metrics.max_time*1000:.2f} ms")
            print(f"  Operations per Second: {metrics.operations_per_second:.2f}")
            print(f"  Success Rate: {metrics.success_rate:.1f}%")
            
            if metrics.errors:
                print(f"  Errors ({len(metrics.errors)}):")
                for error in metrics.errors[:5]:  # Show first 5 errors
                    print(f"    - {error}")
                if len(metrics.errors) > 5:
                    print(f"    ... and {len(metrics.errors) - 5} more errors")
        
        print("\n" + "="*80)

@pytest.mark.asyncio
@pytest.mark.performance
async def test_change_management_performance():
    """Main performance test function"""
    
    # Initialize test suite
    perf_test = ChangeManagementPerformanceTest()
    
    try:
        # Set up test data
        change_ids = await perf_test.setup_test_data(num_changes=1000)
        
        if not change_ids:
            pytest.skip("Failed to create test data")
        
        print(f"Running performance tests with {len(change_ids)} test change requests...")
        
        # Run performance tests
        metrics_list = []
        
        # Test 1: High volume change creation
        metrics = await perf_test.test_high_volume_change_creation(num_changes=200)
        metrics_list.append(metrics)
        
        # Test 2: Concurrent operations
        metrics = await perf_test.test_concurrent_change_operations(
            num_concurrent=20, operations_per_thread=10
        )
        metrics_list.append(metrics)
        
        # Test 3: Approval processing
        metrics = await perf_test.test_approval_processing_performance(
            change_ids, num_approvals=100
        )
        metrics_list.append(metrics)
        
        # Test 4: Analytics queries
        metrics = await perf_test.test_analytics_query_performance(change_ids)
        metrics_list.append(metrics)
        
        # Test 5: Cache performance
        metrics = await perf_test.test_cache_performance(change_ids, num_operations=500)
        metrics_list.append(metrics)
        
        # Test 6: Database query performance
        metrics = await perf_test.test_database_query_performance(change_ids)
        metrics_list.append(metrics)
        
        # Print comprehensive report
        perf_test.print_performance_report(metrics_list)
        
        # Performance assertions
        for metrics in metrics_list:
            # Assert reasonable performance thresholds
            assert metrics.success_rate >= 95.0, f"{metrics.operation_name} success rate too low: {metrics.success_rate}%"
            
            # Operation-specific performance thresholds
            if "Creation" in metrics.operation_name:
                assert metrics.avg_time_per_operation < 2.0, f"{metrics.operation_name} too slow: {metrics.avg_time_per_operation:.3f}s"
            elif "Analytics" in metrics.operation_name:
                assert metrics.avg_time_per_operation < 5.0, f"{metrics.operation_name} too slow: {metrics.avg_time_per_operation:.3f}s"
            elif "Cache" in metrics.operation_name:
                assert metrics.avg_time_per_operation < 0.1, f"{metrics.operation_name} too slow: {metrics.avg_time_per_operation:.3f}s"
            else:
                assert metrics.avg_time_per_operation < 3.0, f"{metrics.operation_name} too slow: {metrics.avg_time_per_operation:.3f}s"
        
        print("\n✅ All performance tests passed!")
        
    finally:
        # Clean up test data
        if 'change_ids' in locals():
            await perf_test.cleanup_test_data(change_ids)

if __name__ == "__main__":
    # Run performance tests directly
    asyncio.run(test_change_management_performance())