#!/usr/bin/env python3
"""
RAG System Test Script
Tests the RAG system end-to-end
"""

import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client
from ai_agents import RAGReporterAgent

# Load environment variables
load_dotenv()

async def test_rag_system():
    """Test the RAG system"""
    
    print("=" * 70)
    print("RAG System Test")
    print("=" * 70)
    print()
    
    # Check environment variables
    print("🔍 Checking configuration...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai_base_url = os.getenv("OPENAI_BASE_URL")
    use_local_embeddings = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set")
        return False
    
    if not openai_api_key:
        print("❌ Error: OPENAI_API_KEY must be set")
        return False
    
    print(f"   ✅ Supabase URL: {supabase_url}")
    print(f"   ✅ OpenAI API Key: {'*' * 20}{openai_api_key[-4:]}")
    if openai_base_url:
        print(f"   ✅ OpenAI Base URL: {openai_base_url}")
    print(f"   ✅ Use Local Embeddings: {use_local_embeddings}")
    print()
    
    # Initialize clients
    print("🔄 Initializing RAG agent...")
    try:
        supabase: Client = create_client(supabase_url, supabase_key)
        
        rag_agent = RAGReporterAgent(
            supabase_client=supabase,
            openai_api_key=openai_api_key,
            base_url=openai_base_url
        )
        print("   ✅ RAG agent initialized")
    except Exception as e:
        print(f"   ❌ Failed to initialize RAG agent: {e}")
        return False
    
    print()
    
    # Test 1: Check embeddings table
    print("📊 Test 1: Checking embeddings table...")
    try:
        result = supabase.table("embeddings").select("id").limit(1).execute()
        print(f"   ✅ Embeddings table exists")
        print(f"   📈 Sample query successful")
    except Exception as e:
        print(f"   ❌ Embeddings table check failed: {e}")
        print("   💡 Hint: Apply the database migration first")
        return False
    
    print()
    
    # Test 2: Check embedding statistics
    print("📊 Test 2: Checking embedding statistics...")
    try:
        result = supabase.rpc('get_embedding_stats', {}).execute()
        if result.data:
            print(f"   ✅ Embedding statistics available:")
            for stat in result.data:
                print(f"      - {stat['content_type']}: {stat['count']} embeddings")
        else:
            print(f"   ⚠️  No embeddings found")
            print(f"   💡 Hint: Run index_content_for_rag.py to index content")
    except Exception as e:
        print(f"   ⚠️  Could not retrieve statistics: {e}")
    
    print()
    
    # Test 3: Generate test embedding
    print("🧪 Test 3: Generating test embedding...")
    try:
        test_text = "This is a test sentence for embedding generation."
        embedding = await rag_agent.generate_embedding(test_text)
        print(f"   ✅ Embedding generated successfully")
        print(f"   📏 Embedding dimension: {len(embedding)}")
        print(f"   🔢 First 5 values: {embedding[:5]}")
    except Exception as e:
        print(f"   ❌ Embedding generation failed: {e}")
        return False
    
    print()
    
    # Test 4: Test RAG query (if embeddings exist)
    print("🧪 Test 4: Testing RAG query...")
    try:
        # Check if we have any embeddings
        count_result = supabase.table("embeddings").select("id", count="exact").execute()
        embedding_count = count_result.count if hasattr(count_result, 'count') else 0
        
        if embedding_count > 0:
            test_query = "What projects do we have?"
            print(f"   📝 Query: {test_query}")
            
            result = await rag_agent.process_rag_query(
                query=test_query,
                user_id="test-user-123",
                conversation_id="test-conv-123"
            )
            
            print(f"   ✅ RAG query successful")
            print(f"   💬 Response: {result['response'][:200]}...")
            print(f"   🎯 Confidence: {result['confidence_score']:.2f}")
            print(f"   📚 Sources: {len(result['sources'])} items")
            print(f"   ⏱️  Response time: {result['response_time_ms']}ms")
        else:
            print(f"   ⚠️  No embeddings available for testing")
            print(f"   💡 Hint: Run index_content_for_rag.py first")
    except Exception as e:
        print(f"   ❌ RAG query failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print()
    print("=" * 70)
    print("✅ All tests passed!")
    print("=" * 70)
    print()
    print("RAG system is ready to use!")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(test_rag_system())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
