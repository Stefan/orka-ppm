"""
Load Testing Script for Help Chat Performance

This script provides intensive load testing capabilities for the help chat system
to validate performance under realistic production loads.
"""

import asyncio
import time
import statistics
import random
from datetime import datetime
from typing import List, Dict, Any
from unittest.mock import Mock

from services.help_chat_performance import HelpChatPerformanceService

class HelpChatLoadTester:
    """Load testing utility for help chat performance"""
    
    def __init__(self, performance_service: HelpChatPerformanceService):
        self.performance_service = performance_service
        self.test_queries = self._generate_test_queries()
        self.results = []
    
    def _generate_test_queries(self) -> List[tuple]:
        """Generate realistic test queries and contexts"""
        queries = [
            # Navigation queries
            ("How do I access the dashboard?", {"route": "/dashboard"}),
            ("Where can I find project settings?", {"route": "/projects"}),
            ("How do I navigate to reports?", {"route": "/reports"}),
            ("Where is the user management section?", {"route": "/admin"}),
            
            # Feature queries
            ("How do I create a new project?", {"route": "/projects"}),
            ("What are the budget tracking features?", {"route": "/financials"}),
            ("How do I assign resources to tasks?", {"route": "/resources"}),
            ("What reporting options are available?", {"route": "/reports"}),
            
            # Complex queries
            ("Explain the complete project lifecycle management process", {"route": "/projects"}),
            ("How do I set up automated budget alerts and notifications?", {"route": "/financials"}),
            ("What are the best practices for resource optimization?", {"route": "/resources"}),
            ("How do I configure risk assessment parameters?", {"route": "/risks"}),
            
            # Troubleshooting queries
            ("The system is running slowly", {"route": "/dashboard"}),
            ("I can't save my project changes", {"route": "/projects"}),
            ("Budget calculations seem incorrect", {"route": "/financials"}),
            ("Resource allocation is not updating", {"route": "/resources"}),
            
            # Multi-language queries (simulated)
            ("Wie erstelle ich ein neues Projekt?", {"route": "/projects", "language": "de"}),
            ("Comment accéder au tableau de bord?", {"route": "/dashboard", "language": "fr"}),
            ("Wo finde ich die Benutzereinstellungen?", {"route": "/admin", "language": "de"}),
        ]
        
        # Add variations with different contexts
        extended_queries = []
        for query, base_context in queries:
            for user_role in ["user", "admin", "manager"]:
                for project_id in [None, "proj-1", "proj-2"]:
                    context = base_context.copy()
                    context["userRole"] = user_role
                    if project_id:
                        context["currentProject"] = project_id
                    extended_queries.append((query, context))
        
        return extended_queries
    
    async def run_load_test(self, 
                           concurrent_users: int = 50,
                           requests_per_user: int = 10,
                           test_duration_seconds: int = 60) -> Dict[str, Any]:
        """
        Run comprehensive load test
        
        Args:
            concurrent_users: Number of concurrent users to simulate
            requests_per_user: Number of requests each user makes
            test_duration_seconds: Maximum test duration
        """
        print(f"🚀 Starting load test: {concurrent_users} users, {requests_per_user} requests each")
        print(f"📊 Test duration limit: {test_duration_seconds} seconds")
        
        # Pre-populate cache with some common responses
        await self._populate_cache()
        
        # Run the load test
        start_time = time.time()
        
        # Create user simulation tasks
        user_tasks = []
        for user_id in range(concurrent_users):
            task = self._simulate_user(user_id, requests_per_user)
            user_tasks.append(task)
        
        # Execute all user simulations concurrently
        try:
            user_results = await asyncio.wait_for(
                asyncio.gather(*user_tasks, return_exceptions=True),
                timeout=test_duration_seconds
            )
        except asyncio.TimeoutError:
            print(f"⚠️ Load test timed out after {test_duration_seconds} seconds")
            user_results = ["timeout"] * concurrent_users
        
        total_time = time.time() - start_time
        
        # Analyze results
        return self._analyze_load_test_results(user_results, total_time, concurrent_users)
    
    async def _populate_cache(self):
        """Pre-populate cache with common responses"""
        common_responses = [
            ("How do I create a project?", {"route": "/projects"}, 
             {"response": "To create a project, click the 'New Project' button...", "confidence": 0.9}),
            ("Where is the dashboard?", {"route": "/dashboard"}, 
             {"response": "The dashboard is accessible from the main menu...", "confidence": 0.95}),
            ("How do I add users?", {"route": "/admin"}, 
             {"response": "User management is available in the Admin section...", "confidence": 0.85}),
        ]
        
        for query, context, response in common_responses:
            await self.performance_service.cache_response(query, context, response)
        
        print("✅ Cache pre-populated with common responses")
    
    async def _simulate_user(self, user_id: int, num_requests: int) -> Dict[str, Any]:
        """Simulate a single user's interaction pattern"""
        user_results = {
            "user_id": user_id,
            "requests_completed": 0,
            "total_time": 0,
            "response_times": [],
            "cache_hits": 0,
            "errors": 0
        }
        
        try:
            for request_num in range(num_requests):
                # Select a random query
                query, context = random.choice(self.test_queries)
                
                # Add user-specific context
                context = context.copy()
                context["userId"] = f"user_{user_id}"
                context["sessionId"] = f"session_{user_id}"
                
                # Execute request
                request_start = time.time()
                
                try:
                    # Check cache first
                    cached_result = await self.performance_service.get_cached_response(query, context)
                    
                    if cached_result:
                        user_results["cache_hits"] += 1
                        response_data = cached_result
                    else:
                        # Simulate AI processing
                        processing_time = random.uniform(0.1, 0.5)  # 100-500ms
                        await asyncio.sleep(processing_time)
                        
                        response_data = {
                            "response": f"AI response for: {query[:50]}...",
                            "confidence": random.uniform(0.7, 0.95),
                            "sources": []
                        }
                        
                        # Cache the response
                        await self.performance_service.cache_response(query, context, response_data)
                    
                    request_time = time.time() - request_start
                    user_results["response_times"].append(request_time * 1000)  # Convert to ms
                    user_results["requests_completed"] += 1
                    
                    # Record performance metrics
                    await self.performance_service.record_operation_performance(
                        "load_test_query", request_start, True
                    )
                    
                    # Simulate user think time
                    think_time = random.uniform(0.5, 2.0)  # 0.5-2 seconds
                    await asyncio.sleep(think_time)
                    
                except Exception as e:
                    user_results["errors"] += 1
                    await self.performance_service.record_operation_performance(
                        "load_test_query", request_start, False, str(type(e).__name__)
                    )
            
            user_results["total_time"] = sum(user_results["response_times"])
            
        except Exception as e:
            user_results["errors"] += 1
            print(f"❌ User {user_id} simulation failed: {e}")
        
        return user_results
    
    def _analyze_load_test_results(self, user_results: List, total_time: float, 
                                 concurrent_users: int) -> Dict[str, Any]:
        """Analyze load test results and generate report"""
        
        # Filter out timeout and error results
        valid_results = [r for r in user_results if isinstance(r, dict)]
        
        if not valid_results:
            return {
                "success": False,
                "error": "No valid results collected",
                "total_time": total_time
            }
        
        # Aggregate metrics
        total_requests = sum(r["requests_completed"] for r in valid_results)
        total_errors = sum(r["errors"] for r in valid_results)
        total_cache_hits = sum(r["cache_hits"] for r in valid_results)
        
        # Response time statistics
        all_response_times = []
        for r in valid_results:
            all_response_times.extend(r["response_times"])
        
        if not all_response_times:
            return {
                "success": False,
                "error": "No response times recorded",
                "total_time": total_time
            }
        
        # Calculate statistics
        avg_response_time = statistics.mean(all_response_times)
        median_response_time = statistics.median(all_response_times)
        p95_response_time = statistics.quantiles(all_response_times, n=20)[18]  # 95th percentile
        p99_response_time = statistics.quantiles(all_response_times, n=100)[98]  # 99th percentile
        max_response_time = max(all_response_times)
        min_response_time = min(all_response_times)
        
        # Calculate rates
        requests_per_second = total_requests / total_time if total_time > 0 else 0
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        cache_hit_rate = (total_cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        # Performance assessment
        performance_grade = self._calculate_performance_grade(
            avg_response_time, p95_response_time, error_rate, cache_hit_rate
        )
        
        return {
            "success": True,
            "test_summary": {
                "concurrent_users": concurrent_users,
                "total_requests": total_requests,
                "total_time_seconds": round(total_time, 2),
                "requests_per_second": round(requests_per_second, 2),
                "successful_users": len(valid_results)
            },
            "response_times": {
                "average_ms": round(avg_response_time, 2),
                "median_ms": round(median_response_time, 2),
                "p95_ms": round(p95_response_time, 2),
                "p99_ms": round(p99_response_time, 2),
                "min_ms": round(min_response_time, 2),
                "max_ms": round(max_response_time, 2)
            },
            "performance_metrics": {
                "error_rate_percent": round(error_rate, 2),
                "cache_hit_rate_percent": round(cache_hit_rate, 2),
                "total_errors": total_errors,
                "total_cache_hits": total_cache_hits
            },
            "performance_grade": performance_grade,
            "recommendations": self._generate_performance_recommendations(
                avg_response_time, p95_response_time, error_rate, cache_hit_rate
            )
        }
    
    def _calculate_performance_grade(self, avg_response_time: float, p95_response_time: float,
                                   error_rate: float, cache_hit_rate: float) -> str:
        """Calculate overall performance grade"""
        score = 100
        
        # Response time penalties
        if avg_response_time > 1000:  # > 1 second
            score -= 30
        elif avg_response_time > 500:  # > 500ms
            score -= 15
        
        if p95_response_time > 3000:  # > 3 seconds
            score -= 25
        elif p95_response_time > 1500:  # > 1.5 seconds
            score -= 10
        
        # Error rate penalties
        if error_rate > 5:  # > 5%
            score -= 40
        elif error_rate > 1:  # > 1%
            score -= 20
        
        # Cache hit rate bonus/penalty
        if cache_hit_rate > 50:  # > 50%
            score += 10
        elif cache_hit_rate < 20:  # < 20%
            score -= 15
        
        # Grade assignment
        if score >= 90:
            return "A (Excellent)"
        elif score >= 80:
            return "B (Good)"
        elif score >= 70:
            return "C (Acceptable)"
        elif score >= 60:
            return "D (Needs Improvement)"
        else:
            return "F (Poor)"
    
    def _generate_performance_recommendations(self, avg_response_time: float, 
                                            p95_response_time: float,
                                            error_rate: float, 
                                            cache_hit_rate: float) -> List[str]:
        """Generate performance improvement recommendations"""
        recommendations = []
        
        if avg_response_time > 500:
            recommendations.append("Average response time is high - consider optimizing AI model calls")
        
        if p95_response_time > 2000:
            recommendations.append("95th percentile response time exceeds 2 seconds - investigate slow queries")
        
        if error_rate > 1:
            recommendations.append(f"Error rate of {error_rate:.1f}% is concerning - investigate error causes")
        
        if cache_hit_rate < 30:
            recommendations.append("Low cache hit rate - consider improving cache strategy or TTL settings")
        
        if cache_hit_rate > 80:
            recommendations.append("Excellent cache performance - current caching strategy is effective")
        
        if not recommendations:
            recommendations.append("Performance is within acceptable ranges - continue monitoring")
        
        return recommendations

async def run_comprehensive_load_test():
    """Run a comprehensive load test suite"""
    print("🚀 Help Chat Comprehensive Load Testing")
    print("=" * 50)
    
    # Initialize performance service
    mock_supabase = Mock()
    performance_service = HelpChatPerformanceService(mock_supabase)
    
    # Create load tester
    load_tester = HelpChatLoadTester(performance_service)
    
    # Test scenarios
    test_scenarios = [
        {"name": "Light Load", "users": 10, "requests": 5, "duration": 30},
        {"name": "Medium Load", "users": 25, "requests": 8, "duration": 45},
        {"name": "Heavy Load", "users": 50, "requests": 10, "duration": 60},
    ]
    
    all_results = {}
    
    for scenario in test_scenarios:
        print(f"\n📊 Running {scenario['name']} Test...")
        print(f"   Users: {scenario['users']}, Requests per user: {scenario['requests']}")
        
        results = await load_tester.run_load_test(
            concurrent_users=scenario['users'],
            requests_per_user=scenario['requests'],
            test_duration_seconds=scenario['duration']
        )
        
        all_results[scenario['name']] = results
        
        if results['success']:
            print(f"✅ {scenario['name']} Test Results:")
            print(f"   Total Requests: {results['test_summary']['total_requests']}")
            print(f"   Requests/Second: {results['test_summary']['requests_per_second']}")
            print(f"   Average Response Time: {results['response_times']['average_ms']}ms")
            print(f"   95th Percentile: {results['response_times']['p95_ms']}ms")
            print(f"   Error Rate: {results['performance_metrics']['error_rate_percent']}%")
            print(f"   Cache Hit Rate: {results['performance_metrics']['cache_hit_rate_percent']}%")
            print(f"   Performance Grade: {results['performance_grade']}")
        else:
            print(f"❌ {scenario['name']} Test Failed: {results.get('error', 'Unknown error')}")
    
    # Generate summary report
    print("\n📋 Load Test Summary Report")
    print("=" * 50)
    
    for scenario_name, results in all_results.items():
        if results['success']:
            grade = results['performance_grade']
            rps = results['test_summary']['requests_per_second']
            avg_time = results['response_times']['average_ms']
            print(f"{scenario_name:15} | Grade: {grade:15} | {rps:6.1f} RPS | {avg_time:6.1f}ms avg")
    
    return all_results

if __name__ == "__main__":
    # Run the comprehensive load test
    results = asyncio.run(run_comprehensive_load_test())
    print("\n✅ Load testing completed!")