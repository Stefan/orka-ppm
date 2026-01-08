#!/usr/bin/env python3
"""
Test Vector Database Implementation
This script tests the vector database functionality
"""

import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client
from ai_agents import RAGReporterAgent

async def test_vector_db():
    """Test vector database functionality"""
    load_dotenv()
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    if not all([SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY]):
        print("❌ Missing required environment variables")
        return
    
    try:
        # Create Supabase client
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Connected to Supabase")
        
        # Create RAG agent
        rag_agent = RAGReporterAgent(supabase, OPENAI_API_KEY)
        print("✅ Created RAG agent")
        
        # Test embedding generation
        print("\n🔄 Testing embedding generation...")
        test_text = "This is a test project for AI-powered portfolio management"
        embedding = await rag_agent.generate_embedding(test_text)
        print(f"✅ Generated embedding with {len(embedding)} dimensions")
        
        # Test content storage
        print("\n🔄 Testing content storage...")
        await rag_agent.store_content_embedding(
            "test", 
            "test-id-123", 
            test_text,
            {"test": True, "category": "demo"}
        )
        print("✅ Stored test embedding")
        
        # Test similarity search
        print("\n🔄 Testing similarity search...")
        results = await rag_agent.search_similar_content(
            "AI portfolio management project",
            content_types=["test"],
            limit=3
        )
        print(f"✅ Found {len(results)} similar items")
        for result in results:
            print(f"  - {result['content_type']}: {result['content_text'][:50]}... (similarity: {result['similarity_score']:.3f})")
        
        # Test semantic search
        print("\n🔄 Testing semantic search...")
        search_results = await rag_agent.semantic_search(
            "portfolio management",
            filters={"content_types": ["test"]},
            limit=5
        )
        print(f"✅ Semantic search returned {search_results['statistics']['total_results']} results")
        
        # Test content indexing (if there's existing data)
        print("\n🔄 Testing content indexing...")
        index_results = await rag_agent.index_existing_content()
        print(f"✅ Indexed {index_results['indexed_count']} items")
        if index_results['errors']:
            print(f"⚠️  {len(index_results['errors'])} errors occurred during indexing")
        
        print("\n🎉 All vector database tests passed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_vector_db())