"""
Load Testing for Change Management System

Stress tests the system under realistic load conditions with multiple concurrent users,
high data volumes, and sustained operations over time.
"""

import asyncio
import aiohttp
import time
import json
import random
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from uuid import uuid4
from dataclasses import dataclass, asdict
import statistics

@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    base_url: str = "http://localhost:8000"
    concurrent_users: int = 50
    test_duration_minutes: int = 10
    ramp_up_time_minutes: int = 2
    operations_per_user_per_minute: int = 10
    
    # Test data configuration
    num_projects: int = 10
    num_users: int = 100
    change_types: List[str] = None
    priorities: List[str] = None
    
    def __post_init__(self):
        if self.change_types is None:
            self.change_types = ["scope", "schedule", "budget", "design", "regulatory"]
        if self.priorities is None:
            self.priorities = ["low", "medium", "high", "critical"]

@dataclass
class LoadTestResults:
    """Results from load testing"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    p95_response_time: float
    p99_response_time: float
    requests_per_second: float
    error_rate: float
    errors: List[str]

class ChangeManagementLoadTester:
    """Load tester for change management system"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_projects: List[str] = []
        self.test_users: List[str] = []
        self.created_changes: List[str] = []
        
    async def setup_session(self):
        """Set up HTTP session for testing"""
        connector = aiohttp.TCPConnector(limit=200, limit_per_host=50)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"Content-Type": "application/json"}
        )
    
    async def cleanup_session(self):
        """Clean up HTTP session"""
        if self.session:
            await self.session.close()
    
    async def setup_test_data(self):
        """Set up test projects and users"""
        print("Setting up test data...")
        
        # Create test projects
        for i in range(self.config.num_projects):
            project_id = str(uuid4())
            self.test_projects.append(project_id)
            
            project_data = {
                "id": project_id,
                "name": f"Load Test Project {i}",
                "description": f"Project for load testing - {i}",
                "status": "active"
            }
            
            try:
                async with self.session.post(
                    f"{self.config.base_url}/projects",
                    json=project_data
                ) as response:
                    if response.status not in [200, 201, 409]:  # 409 = already exists
                        print(f"Warning: Failed to create project {i}: {response.status}")
            except Exception as e:
                print(f"Error creating project {i}: {e}")
        
        # Create test users
        for i in range(self.config.num_users):
            user_id = str(uuid4())
            self.test_users.append(user_id)
        
        print(f"Set up {len(self.test_projects)} projects and {len(self.test_users)} users")
    
    async def cleanup_test_data(self):
        """Clean up test data after load testing"""
        print("Cleaning up test data...")
        
        try:
            # Clean up created changes
            if self.created_changes:
                for change_id in self.created_changes:
                    try:
                        async with self.session.delete(
                            f"{self.config.base_url}/changes/{change_id}"
                        ) as response:
                            pass  # Ignore response
                    except Exception:
                        pass  # Ignore cleanup errors
            
            # Clean up projects
            for project_id in self.test_projects:
                try:
                    async with self.session.delete(
                        f"{self.config.base_url}/projects/{project_id}"
                    ) as response:
                        pass  # Ignore response
                except Exception:
                    pass  # Ignore cleanup errors
                    
        except Exception as e:
            print(f"Error during cleanup: {e}")
        
        print("Test data cleanup completed")
    
    def generate_change_request_data(self) -> Dict[str, Any]:
        """Generate random change request data"""
        return {
            "title": f"Load Test Change {uuid4().hex[:8]}",
            "description": f"Load test change request created at {datetime.now().isoformat()}",
            "justification": "Load testing the change management system",
            "change_type": random.choice(self.config.change_types),
            "priority": random.choice(self.config.priorities),
            "project_id": random.choice(self.test_projects),
            "required_by_date": (date.today() + timedelta(days=random.randint(1, 90))).isoformat(),
            "estimated_cost_impact": random.randint(1000, 100000),
            "estimated_schedule_impact_days": random.randint(1, 30),
            "estimated_effort_hours": random.randint(8, 200)
        }
    
    async def make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request and measure response time.
        
        Returns:
            Dict with response data and timing information
        """
        start_time = time.time()
        
        try:
            url = f"{self.config.base_url}{endpoint}"
            
            if method.upper() == "GET":
                async with self.session.get(url, params=data) as response:
                    response_data = await response.json() if response.content_type == 'application/json' else {}
                    status = response.status
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    response_data = await response.json() if response.content_type == 'application/json' else {}
                    status = response.status
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data) as response:
                    response_data = await response.json() if response.content_type == 'application/json' else {}
                    status = response.status
            elif method.upper() == "DELETE":
                async with self.session.delete(url) as response:
                    response_data = {}
                    status = response.status
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            end_time = time.time()
            response_time = end_time - start_time
            
            success = 200 <= status < 300
            
            return {
                "success": success,
                "status_code": status,
                "response_time": response_time,
                "response_data": response_data,
                "error": None
            }
            
        except Exception as e:
            end_time = time.time()
            response_time = end_time - start_time
            
            return {
                "success": False,
                "status_code": 0,
                "response_time": response_time,
                "response_data": {},
                "error": str(e)
            }
    
    async def user_simulation(self, user_id: int, duration_seconds: int) -> List[Dict[str, Any]]:
        """
        Simulate a single user's activity during the load test.
        
        Args:
            user_id: Unique identifier for this simulated user
            duration_seconds: How long to run the simulation
            
        Returns:
            List of request results
        """
        results = []
        start_time = time.time()
        
        # Calculate operations timing
        operations_per_second = self.config.operations_per_user_per_minute / 60
        operation_interval = 1.0 / operations_per_second if operations_per_second > 0 else 1.0
        
        operation_count = 0
        
        while (time.time() - start_time) < duration_seconds:
            operation_start = time.time()
            
            # Choose random operation to perform
            operation = random.choices(
                ["create_change", "list_changes", "get_change", "update_change", "get_analytics"],
                weights=[40, 25, 15, 10, 10]  # Weighted distribution of operations
            )[0]
            
            try:
                if operation == "create_change":
                    change_data = self.generate_change_request_data()
                    result = await self.make_request("POST", "/changes", change_data)
                    
                    # Track created changes for cleanup
                    if result["success"] and "id" in result.get("response_data", {}):
                        self.created_changes.append(result["response_data"]["id"])
                
                elif operation == "list_changes":
                    params = {
                        "project_id": random.choice(self.test_projects),
                        "page_size": random.choice([10, 25, 50]),
                        "page": random.randint(1, 5)
                    }
                    result = await self.make_request("GET", "/changes", params)
                
                elif operation == "get_change" and self.created_changes:
                    change_id = random.choice(self.created_changes)
                    result = await self.make_request("GET", f"/changes/{change_id}")
                
                elif operation == "update_change" and self.created_changes:
                    change_id = random.choice(self.created_changes)
                    update_data = {
                        "title": f"Updated Load Test Change {uuid4().hex[:8]}",
                        "priority": random.choice(self.config.priorities)
                    }
                    result = await self.make_request("PUT", f"/changes/{change_id}", update_data)
                
                elif operation == "get_analytics":
                    params = {
                        "project_id": random.choice(self.test_projects)
                    }
                    result = await self.make_request("GET", "/changes/analytics", params)
                
                else:
                    # Fallback to list changes
                    result = await self.make_request("GET", "/changes", {"page_size": 10})
                
                # Add operation metadata
                result["operation"] = operation
                result["user_id"] = user_id
                result["operation_count"] = operation_count
                
                results.append(result)
                operation_count += 1
                
            except Exception as e:
                results.append({
                    "success": False,
                    "status_code": 0,
                    "response_time": 0,
                    "response_data": {},
                    "error": f"User simulation error: {str(e)}",
                    "operation": operation,
                    "user_id": user_id,
                    "operation_count": operation_count
                })
            
            # Wait for next operation (rate limiting)
            operation_end = time.time()
            operation_duration = operation_end - operation_start
            sleep_time = max(0, operation_interval - operation_duration)
            
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
        
        return results
    
    async def run_load_test(self) -> LoadTestResults:
        """
        Run the complete load test.
        
        Returns:
            LoadTestResults with comprehensive metrics
        """
        print(f"Starting load test with {self.config.concurrent_users} concurrent users...")
        print(f"Test duration: {self.config.test_duration_minutes} minutes")
        print(f"Ramp-up time: {self.config.ramp_up_time_minutes} minutes")
        
        await self.setup_session()
        await self.setup_test_data()
        
        try:
            # Calculate timing
            total_duration = self.config.test_duration_minutes * 60
            ramp_up_duration = self.config.ramp_up_time_minutes * 60
            
            # Start users gradually during ramp-up period
            user_tasks = []
            
            for user_id in range(self.config.concurrent_users):
                # Calculate when this user should start
                start_delay = (user_id / self.config.concurrent_users) * ramp_up_duration
                
                # Each user runs for the full duration minus their start delay
                user_duration = total_duration - start_delay
                
                # Create user task with delay
                async def delayed_user_simulation(uid, delay, duration):
                    if delay > 0:
                        await asyncio.sleep(delay)
                    return await self.user_simulation(uid, duration)
                
                task = asyncio.create_task(
                    delayed_user_simulation(user_id, start_delay, user_duration)
                )
                user_tasks.append(task)
            
            print(f"Started {len(user_tasks)} user simulation tasks")
            
            # Wait for all users to complete
            start_time = time.time()
            all_results = await asyncio.gather(*user_tasks, return_exceptions=True)
            end_time = time.time()
            
            # Process results
            all_request_results = []
            
            for user_results in all_results:
                if isinstance(user_results, Exception):
                    print(f"User simulation failed: {user_results}")
                    continue
                
                all_request_results.extend(user_results)
            
            # Calculate metrics
            if not all_request_results:
                raise RuntimeError("No successful requests completed")
            
            successful_requests = [r for r in all_request_results if r["success"]]
            failed_requests = [r for r in all_request_results if not r["success"]]
            
            response_times = [r["response_time"] for r in all_request_results]
            successful_response_times = [r["response_time"] for r in successful_requests]
            
            total_test_time = end_time - start_time
            
            # Calculate percentiles
            sorted_times = sorted(successful_response_times) if successful_response_times else [0]
            p95_index = int(0.95 * len(sorted_times))
            p99_index = int(0.99 * len(sorted_times))
            
            results = LoadTestResults(
                total_requests=len(all_request_results),
                successful_requests=len(successful_requests),
                failed_requests=len(failed_requests),
                avg_response_time=statistics.mean(response_times) if response_times else 0,
                min_response_time=min(response_times) if response_times else 0,
                max_response_time=max(response_times) if response_times else 0,
                p95_response_time=sorted_times[p95_index] if sorted_times else 0,
                p99_response_time=sorted_times[p99_index] if sorted_times else 0,
                requests_per_second=len(all_request_results) / total_test_time if total_test_time > 0 else 0,
                error_rate=(len(failed_requests) / len(all_request_results)) * 100 if all_request_results else 0,
                errors=[r.get("error", f"Status {r.get('status_code', 'unknown')}") 
                       for r in failed_requests if r.get("error")]
            )
            
            return results
            
        finally:
            await self.cleanup_test_data()
            await self.cleanup_session()
    
    def print_load_test_report(self, results: LoadTestResults):
        """Print comprehensive load test report"""
        print("\n" + "="*80)
        print("CHANGE MANAGEMENT SYSTEM LOAD TEST REPORT")
        print("="*80)
        
        print(f"\nTest Configuration:")
        print(f"  Concurrent Users: {self.config.concurrent_users}")
        print(f"  Test Duration: {self.config.test_duration_minutes} minutes")
        print(f"  Ramp-up Time: {self.config.ramp_up_time_minutes} minutes")
        print(f"  Target Ops/User/Min: {self.config.operations_per_user_per_minute}")
        
        print(f"\nRequest Statistics:")
        print(f"  Total Requests: {results.total_requests}")
        print(f"  Successful Requests: {results.successful_requests}")
        print(f"  Failed Requests: {results.failed_requests}")
        print(f"  Success Rate: {100 - results.error_rate:.1f}%")
        print(f"  Error Rate: {results.error_rate:.1f}%")
        
        print(f"\nPerformance Metrics:")
        print(f"  Requests per Second: {results.requests_per_second:.2f}")
        print(f"  Average Response Time: {results.avg_response_time*1000:.2f} ms")
        print(f"  Min Response Time: {results.min_response_time*1000:.2f} ms")
        print(f"  Max Response Time: {results.max_response_time*1000:.2f} ms")
        print(f"  95th Percentile: {results.p95_response_time*1000:.2f} ms")
        print(f"  99th Percentile: {results.p99_response_time*1000:.2f} ms")
        
        if results.errors:
            print(f"\nTop Errors:")
            error_counts = {}
            for error in results.errors:
                error_counts[error] = error_counts.get(error, 0) + 1
            
            sorted_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)
            for error, count in sorted_errors[:10]:
                print(f"  {error}: {count} occurrences")
        
        print("\n" + "="*80)

async def run_load_test_suite():
    """Run a comprehensive load test suite"""
    
    # Test configurations for different load levels
    test_configs = [
        LoadTestConfig(
            concurrent_users=10,
            test_duration_minutes=2,
            ramp_up_time_minutes=1,
            operations_per_user_per_minute=5
        ),
        LoadTestConfig(
            concurrent_users=25,
            test_duration_minutes=5,
            ramp_up_time_minutes=1,
            operations_per_user_per_minute=8
        ),
        LoadTestConfig(
            concurrent_users=50,
            test_duration_minutes=10,
            ramp_up_time_minutes=2,
            operations_per_user_per_minute=10
        )
    ]
    
    print("Running Change Management Load Test Suite")
    print("="*60)
    
    for i, config in enumerate(test_configs, 1):
        print(f"\n🚀 Running Load Test {i}/{len(test_configs)}")
        print(f"Configuration: {config.concurrent_users} users, {config.test_duration_minutes}min duration")
        
        tester = ChangeManagementLoadTester(config)
        
        try:
            results = await tester.run_load_test()
            tester.print_load_test_report(results)
            
            # Basic assertions for load test success
            assert results.error_rate < 5.0, f"Error rate too high: {results.error_rate}%"
            assert results.avg_response_time < 5.0, f"Average response time too slow: {results.avg_response_time:.3f}s"
            assert results.requests_per_second > 1.0, f"Throughput too low: {results.requests_per_second:.2f} req/s"
            
            print(f"✅ Load Test {i} passed!")
            
        except Exception as e:
            print(f"❌ Load Test {i} failed: {e}")
            raise
        
        # Brief pause between tests
        if i < len(test_configs):
            print("Pausing 30 seconds before next test...")
            await asyncio.sleep(30)
    
    print("\n🎉 All load tests completed successfully!")

if __name__ == "__main__":
    # Run the load test suite
    asyncio.run(run_load_test_suite())