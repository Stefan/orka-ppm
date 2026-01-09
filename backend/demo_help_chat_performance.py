"""
Demo script for Help Chat Performance Optimization
Demonstrates caching, monitoring, and fallback functionality
"""

import asyncio
import time
from unittest.mock import Mock

async def demo_performance_features():
    """Demonstrate the key performance features"""
    
    print("🚀 Help Chat Performance Optimization Demo")
    print("=" * 50)
    
    # Initialize performance service
    from services.help_chat_performance import HelpChatPerformanceService
    
    mock_supabase = Mock()
    performance_service = HelpChatPerformanceService(mock_supabase)
    
    # Demo 1: Response Caching
    print("\n📦 Demo 1: Response Caching")
    print("-" * 30)
    
    query = "How do I create a new project?"
    context = {"route": "/projects", "userRole": "user", "pageTitle": "Projects"}
    
    # First request - cache miss
    print("🔍 Checking cache for first time...")
    cached = await performance_service.get_cached_response(query, context)
    print(f"   Cache result: {cached}")
    
    # Simulate AI response
    ai_response = {
        "response": "To create a new project, navigate to the Projects page and click the 'New Project' button. Fill in the required details like project name, description, and initial budget.",
        "confidence": 0.85,
        "sources": [
            {"type": "guide", "title": "Project Creation Guide", "url": "/help/projects/create"}
        ],
        "session_id": "demo_session_123"
    }
    
    # Cache the response
    print("💾 Caching AI response...")
    await performance_service.cache_response(query, context, ai_response, ttl=600)
    
    # Second request - cache hit
    print("🔍 Checking cache again...")
    cached = await performance_service.get_cached_response(query, context)
    print(f"   Cache hit! Response: {cached['response'][:50]}...")
    
    # Demo 2: Performance Monitoring
    print("\n📊 Demo 2: Performance Monitoring")
    print("-" * 35)
    
    # Simulate various response times
    response_times = [120, 250, 180, 95, 300, 150, 200]
    
    print("⏱️  Recording response times...")
    for i, response_time in enumerate(response_times):
        start_time = time.time() - (response_time / 1000)  # Simulate past start time
        success = i < 6  # Last one fails
        error_type = "timeout" if not success else None
        
        await performance_service.record_operation_performance(
            "help_query", start_time, success, error_type
        )
        
        status = "✅" if success else "❌"
        print(f"   Request {i+1}: {response_time}ms {status}")
    
    # Get performance metrics
    print("\n📈 Performance Summary:")
    report = await performance_service.get_performance_report()
    summary = report['response_performance']['summary']
    
    print(f"   Total Requests: {summary['total_requests']}")
    print(f"   Average Response Time: {summary['avg_response_time_ms']:.1f}ms")
    print(f"   Error Count: {summary['error_count']}")
    print(f"   Health Score: {report['health_score']:.1f}/100")
    
    # Demo 3: Fallback Responses
    print("\n🔄 Demo 3: Fallback Responses")
    print("-" * 32)
    
    fallback_queries = [
        ("Where can I find the navigation menu?", {"route": "/dashboard"}),
        ("What features are available?", {"route": "/features"}),
        ("The system is not working", {"route": "/projects"}),
        ("How do I get started?", {"route": "/onboarding"})
    ]
    
    for query, context in fallback_queries:
        fallback = await performance_service.get_fallback_response(query, context)
        print(f"   Query: {query}")
        print(f"   Fallback: {fallback['response'][:60]}...")
        print(f"   Confidence: {fallback['confidence']}")
        print()
    
    # Demo 4: Cache Statistics
    print("📊 Demo 4: Cache Statistics")
    print("-" * 28)
    
    cache_stats = performance_service.cache.get_stats()
    print(f"   Memory Cache Size: {cache_stats['memory_cache_size']}")
    print(f"   Persistent Cache Size: {cache_stats['persistent_cache_size']}")
    print(f"   Cache Hit Rate: {cache_stats['hit_rate_percent']:.1f}%")
    print(f"   Total Hits: {cache_stats['total_hits']}")
    print(f"   Total Misses: {cache_stats['total_misses']}")
    
    # Demo 5: Health Assessment
    print("\n🏥 Demo 5: Health Assessment")
    print("-" * 30)
    
    # Simulate poor performance to show health degradation
    print("⚠️  Simulating poor performance...")
    for _ in range(5):
        start_time = time.time() - 8.0  # 8 second response time
        await performance_service.record_operation_performance(
            "help_query", start_time, False, "service_unavailable"
        )
    
    report = await performance_service.get_performance_report()
    print(f"   Updated Health Score: {report['health_score']:.1f}/100")
    print("   Recommendations:")
    for rec in report['recommendations']:
        print(f"   • {rec}")
    
    # Show fallback decision
    should_fallback = performance_service.should_use_fallback()
    print(f"   Should use fallback: {'Yes' if should_fallback else 'No'}")
    
    print("\n🎉 Demo completed! Performance optimization features working correctly.")
    print("\nKey Benefits:")
    print("✅ Faster response times through intelligent caching")
    print("✅ Comprehensive performance monitoring and health scoring")
    print("✅ Graceful degradation with fallback responses")
    print("✅ Automatic cache management and cleanup")
    print("✅ Real-time performance metrics and recommendations")

if __name__ == "__main__":
    asyncio.run(demo_performance_features())