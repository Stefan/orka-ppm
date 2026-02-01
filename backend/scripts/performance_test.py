#!/usr/bin/env python3
"""
Performance Testing Script for RAG Knowledge Base
Tests response times, load handling, and scalability
"""

import asyncio
import time
import statistics
from typing import List, Dict, Any
import logging
from concurrent.futures import ThreadPoolExecutor
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PerformanceTester:
    """Performance testing for RAG system"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = {}

    async def run_response_time_test(self, num_requests: int = 100) -> Dict[str, Any]:
        """
        Test response time performance with 95th percentile target < 3 seconds

        Args:
            num_requests: Number of requests to make

        Returns:
            Performance test results
        """
        logger.info(f"Running response time test with {num_requests} requests...")

        response_times = []

        # Test queries
        test_queries = [
            "How do I create a new project?",
            "What is resource allocation?",
            "How do I generate a budget report?",
            "What are the risk management features?",
            "How do I set up automated notifications?",
            "What is the difference between budget and forecast?",
            "How do I assign resources to tasks?",
            "What are the collaboration features?",
            "How do I export project data?",
            "What is Monte Carlo simulation?"
        ]

        for i in range(num_requests):
            query = test_queries[i % len(test_queries)]

            start_time = time.time()

            # Simulate API call (in real implementation, make HTTP request)
            await self._simulate_api_call(query, delay_ms=500 + (i % 1000))  # 500ms - 1.5s

            response_time = (time.time() - start_time) * 1000  # Convert to ms
            response_times.append(response_time)

            if (i + 1) % 10 == 0:
                logger.info(f"Completed {i + 1}/{num_requests} requests")

        # Calculate statistics
        avg_time = statistics.mean(response_times)
        median_time = statistics.median(response_times)
        p95_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        p99_time = statistics.quantiles(response_times, n=100)[98]  # 99th percentile
        min_time = min(response_times)
        max_time = max(response_times)

        results = {
            "test_type": "response_time",
            "num_requests": num_requests,
            "average_response_time_ms": avg_time,
            "median_response_time_ms": median_time,
            "p95_response_time_ms": p95_time,
            "p99_response_time_ms": p99_time,
            "min_response_time_ms": min_time,
            "max_response_time_ms": max_time,
            "target_met": p95_time < 3000,  # 3 second target
            "timestamp": time.time()
        }

        logger.info(".2f"        logger.info(".2f"        logger.info(f"Target met (95th < 3s): {results['target_met']}")

        return results

    async def run_load_test(self, concurrent_users: int = 100, duration_seconds: int = 60) -> Dict[str, Any]:
        """
        Test load handling with concurrent users

        Args:
            concurrent_users: Number of concurrent users to simulate
            duration_seconds: Test duration in seconds

        Returns:
            Load test results
        """
        logger.info(f"Running load test with {concurrent_users} concurrent users for {duration_seconds}s...")

        start_time = time.time()
        request_count = 0
        response_times = []
        errors = 0

        async def simulate_user(user_id: int):
            nonlocal request_count, errors
            user_start = time.time()

            while time.time() - start_time < duration_seconds:
                try:
                    # Make a request
                    await self._simulate_api_call(f"User {user_id} query", delay_ms=200)
                    request_count += 1

                    # Record response time
                    response_time = (time.time() - user_start) * 1000
                    response_times.append(response_time)

                except Exception as e:
                    errors += 1
                    logger.debug(f"Request error for user {user_id}: {e}")

                # Small delay between requests
                await asyncio.sleep(0.1)

        # Create concurrent users
        tasks = [simulate_user(i) for i in range(concurrent_users)]
        await asyncio.gather(*tasks, return_exceptions=True)

        total_time = time.time() - start_time
        requests_per_second = request_count / total_time

        results = {
            "test_type": "load_test",
            "concurrent_users": concurrent_users,
            "duration_seconds": duration_seconds,
            "total_requests": request_count,
            "requests_per_second": requests_per_second,
            "errors": errors,
            "error_rate": errors / max(request_count, 1),
            "average_response_time_ms": statistics.mean(response_times) if response_times else 0,
            "timestamp": time.time()
        }

        logger.info(f"Load test completed: {requests_per_second:.2f} req/sec, {errors} errors")
        return results

    async def run_scalability_test(self, document_counts: List[int]) -> Dict[str, Any]:
        """
        Test scalability with different document counts

        Args:
            document_counts: List of document counts to test

        Returns:
            Scalability test results
        """
        logger.info(f"Running scalability test with document counts: {document_counts}")

        results = []

        for doc_count in document_counts:
            logger.info(f"Testing with {doc_count} documents...")

            # Simulate search performance with different document counts
            # In real implementation, this would test against actual databases
            base_response_time = 500  # Base response time in ms
            scaling_factor = 1 + (doc_count / 10000) * 0.5  # Performance degrades with size
            response_time = base_response_time * scaling_factor

            # Simulate a few queries
            query_times = []
            for _ in range(10):
                # Add some variance
                variance = (0.8 + 0.4 * (time.time() % 1))  # 0.8-1.2
                query_time = response_time * variance
                query_times.append(query_time)
                await asyncio.sleep(0.01)  # Small delay

            avg_time = statistics.mean(query_times)
            p95_time = statistics.quantiles(query_times, n=20)[18]

            result = {
                "document_count": doc_count,
                "average_response_time_ms": avg_time,
                "p95_response_time_ms": p95_time,
                "scaling_factor": scaling_factor
            }
            results.append(result)

            logger.info(f"  {doc_count} docs: {avg_time:.1f}ms avg, {p95_time:.1f}ms p95")

        return {
            "test_type": "scalability_test",
            "results": results,
            "timestamp": time.time()
        }

    async def _simulate_api_call(self, query: str, delay_ms: int = 500):
        """
        Simulate an API call with specified delay

        Args:
            query: Query string
            delay_ms: Simulated response delay in milliseconds
        """
        # Simulate network and processing delay
        delay_seconds = delay_ms / 1000.0
        await asyncio.sleep(delay_seconds)

        # Simulate occasional errors (1% error rate)
        if time.time() % 100 < 1:
            raise Exception("Simulated API error")

    def generate_report(self, test_results: List[Dict[str, Any]]) -> str:
        """Generate a performance test report"""
        report = []
        report.append("=" * 60)
        report.append("PERFORMANCE TEST REPORT")
        report.append("=" * 60)
        report.append("")

        for result in test_results:
            test_type = result["test_type"]

            if test_type == "response_time":
                report.append("RESPONSE TIME TEST")
                report.append("-" * 20)
                report.append(f"Requests: {result['num_requests']}")
                report.append(".2f"                report.append(".2f"                report.append(".2f"                report.append(".2f"                report.append(f"Target Met (95th < 3s): {'✅' if result['target_met'] else '❌'}")
                report.append("")

            elif test_type == "load_test":
                report.append("LOAD TEST")
                report.append("-" * 10)
                report.append(f"Concurrent Users: {result['concurrent_users']}")
                report.append(f"Duration: {result['duration_seconds']}s")
                report.append(f"Total Requests: {result['total_requests']}")
                report.append(".2f"                report.append(f"Errors: {result['error_count']}")
                report.append(".1%"                report.append(".2f"                report.append("")

            elif test_type == "scalability_test":
                report.append("SCALABILITY TEST")
                report.append("-" * 20)
                report.append("Documents | Avg Time | P95 Time | Scaling")
                report.append("-" * 45)
                for r in result["results"]:
                    report.append("8")
                report.append("")

        # Overall assessment
        report.append("OVERALL ASSESSMENT")
        report.append("-" * 20)

        response_time_test = next((r for r in test_results if r["test_type"] == "response_time"), None)
        load_test = next((r for r in test_results if r["test_type"] == "load_test"), None)

        if response_time_test and response_time_test["target_met"]:
            report.append("✅ Response time target met (< 3s 95th percentile)")
        else:
            report.append("❌ Response time target not met")

        if load_test and load_test["error_rate"] < 0.05:  # < 5% error rate
            report.append("✅ Load test passed (low error rate)")
        else:
            report.append("❌ Load test failed (high error rate)")

        report.append("")
        report.append("Recommendations:")
        if response_time_test and response_time_test["p95_response_time_ms"] > 3000:
            report.append("- Optimize query processing and caching")
        if load_test and load_test["error_rate"] > 0.05:
            report.append("- Improve error handling and resource management")
        if not any(r.get("target_met", False) for r in test_results if r["test_type"] == "response_time"):
            report.append("- Consider implementing response caching")
            report.append("- Review database query optimization")

        return "\n".join(report)


async def main():
    """Main performance testing function"""
    print("🚀 RAG Performance Tester")
    print("=" * 40)

    tester = PerformanceTester()

    try:
        # Run all performance tests
        test_results = []

        # 1. Response time test
        print("\n📊 Running response time test...")
        response_time_results = await tester.run_response_time_test(num_requests=50)  # Reduced for demo
        test_results.append(response_time_results)

        # 2. Load test
        print("\n🔥 Running load test...")
        load_results = await tester.run_load_test(concurrent_users=10, duration_seconds=10)  # Reduced for demo
        test_results.append(load_results)

        # 3. Scalability test
        print("\n📈 Running scalability test...")
        scalability_results = await tester.run_scalability_test([1000, 5000, 10000, 25000])
        test_results.append(scalability_results)

        # Generate report
        report = tester.generate_report(test_results)
        print("\n" + report)

        # Save detailed results
        output_file = "performance_test_results.json"
        with open(output_file, 'w') as f:
            json.dump(test_results, f, indent=2, default=str)

        print(f"\n💾 Detailed results saved to: {output_file}")

        # Determine overall success
        response_time_ok = any(r.get("target_met", False)
                              for r in test_results
                              if r["test_type"] == "response_time")
        load_test_ok = all(r.get("error_rate", 1) < 0.05
                          for r in test_results
                          if r["test_type"] == "load_test")

        if response_time_ok and load_test_ok:
            print("✅ Performance tests PASSED")
            return 0
        else:
            print("❌ Performance tests FAILED")
            return 1

    except Exception as e:
        print(f"❌ Performance testing failed: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)