#!/usr/bin/env python3
"""
Test Help Chat with Indexed Documentation
"""

import asyncio
import os
from dotenv import load_dotenv
from config.database import supabase
from services.help_rag_agent import HelpRAGAgent, PageContext

# Load environment variables
load_dotenv()

async def test_help_chat():
    """Test help chat with indexed documentation"""
    print("🧪 Testing Help Chat with Indexed Documentation")
    print("=" * 60)
    print()
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment")
        return False
    
    print(f"✓ API Key found")
    print(f"✓ Base URL: {base_url or 'Default OpenAI'}")
    print()
    
    # Initialize Help RAG agent
    print("📚 Initializing Help RAG agent...")
    agent = HelpRAGAgent(supabase, api_key, base_url)
    print("✓ Help RAG agent initialized")
    print()
    
    # Create test context
    context = PageContext(
        route="/dashboards",
        page_title="Dashboard",
        user_role="project_manager",
        current_project=None,
        current_portfolio=None
    )
    
    # Test queries
    test_queries = [
        "What is variance tracking?",
        "How do I manage schedules?",
        "Tell me about baseline management",
        "What features does this app have?",
        "How do I use the PMR system?"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'=' * 60}")
        print(f"Test Query {i}: {query}")
        print('=' * 60)
        
        try:
            # Process query
            response = await agent.process_help_query(
                query=query,
                context=context,
                user_id="test_user_123",
                language="en"
            )
            
            print(f"\n✅ Response received:")
            print(f"   Confidence: {response.confidence:.2%}")
            print(f"   Response time: {response.response_time_ms}ms")
            print(f"   Sources found: {len(response.sources)}")
            
            if response.sources:
                print(f"\n📚 Sources:")
                for source in response.sources[:3]:
                    print(f"   - {source['type']}: {source.get('title', source['id'])}")
                    print(f"     Similarity: {source['similarity']:.2%}")
            
            print(f"\n💬 Response:")
            print(f"   {response.response[:200]}...")
            
            if response.suggested_actions:
                print(f"\n🎯 Suggested Actions: {len(response.suggested_actions)}")
            
            if response.related_guides:
                print(f"📖 Related Guides: {len(response.related_guides)}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'=' * 60}")
    print("✅ Help Chat testing completed!")
    print('=' * 60)

if __name__ == "__main__":
    asyncio.run(test_help_chat())
