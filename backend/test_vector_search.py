#!/usr/bin/env python3
"""
Test Vector Search for Indexed Documentation
"""

import asyncio
import os
from dotenv import load_dotenv
from config.database import supabase
from ai_agents import RAGReporterAgent

# Load environment variables
load_dotenv()

async def test_vector_search():
    """Test vector search for indexed documentation"""
    print("🔍 Testing Vector Search for Indexed Documentation")
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
    
    # Initialize RAG agent
    print("📚 Initializing RAG agent...")
    agent = RAGReporterAgent(supabase, api_key, base_url)
    print("✓ RAG agent initialized")
    print()
    
    # Test queries
    test_queries = [
        "variance tracking",
        "schedule management",
        "baseline management",
        "PMR system",
        "project features"
    ]
    
    for query in test_queries:
        print(f"\n{'=' * 60}")
        print(f"Query: {query}")
        print('=' * 60)
        
        try:
            # Search for similar content
            results = await agent.search_similar_content(
                query=query,
                content_types=['document'],
                limit=5
            )
            
            print(f"✅ Found {len(results)} results")
            
            for i, result in enumerate(results, 1):
                print(f"\n{i}. {result.get('metadata', {}).get('title', 'Untitled')}")
                print(f"   Type: {result['content_type']}")
                print(f"   ID: {result['content_id']}")
                print(f"   Similarity: {result['similarity_score']:.2%}")
                print(f"   Preview: {result['content_text'][:100]}...")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'=' * 60}")
    print("✅ Vector search testing completed!")
    print('=' * 60)

if __name__ == "__main__":
    asyncio.run(test_vector_search())
