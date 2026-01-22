#!/usr/bin/env python3
"""
Test Help Chat with French Language
"""

import asyncio
import os
from dotenv import load_dotenv
from config.database import supabase
from services.help_rag_agent import HelpRAGAgent, PageContext

# Load environment variables
load_dotenv()

async def test_french_help_chat():
    """Test help chat with French language"""
    print("🧪 Testing Help Chat with French Language")
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
    
    # Test queries in different languages
    test_cases = [
        ("en", "What is variance tracking?"),
        ("de", "Was ist Varianz-Tracking?"),
        ("fr", "Qu'est-ce que le suivi des écarts?"),
    ]
    
    for language, query in test_cases:
        print(f"\n{'=' * 60}")
        print(f"Test: {language.upper()} - {query}")
        print('=' * 60)
        
        try:
            # Process query
            response = await agent.process_help_query(
                query=query,
                context=context,
                user_id="test_user_123",
                language=language
            )
            
            print(f"\n✅ Response received:")
            print(f"   Language: {language}")
            print(f"   Confidence: {response.confidence:.2%}")
            print(f"   Response time: {response.response_time_ms}ms")
            
            print(f"\n💬 Response (first 200 chars):")
            print(f"   {response.response[:200]}...")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'=' * 60}")
    print("✅ French language testing completed!")
    print('=' * 60)

if __name__ == "__main__":
    asyncio.run(test_french_help_chat())
