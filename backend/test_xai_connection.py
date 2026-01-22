#!/usr/bin/env python3
"""
Test script to verify XAI/Grok API connection
Run this after configuring your XAI API key in .env
"""

import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

def test_xai_connection():
    """Test XAI/Grok API connection"""
    
    # Get configuration
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "grok-beta")
    
    print("=" * 60)
    print("XAI/Grok API Connection Test")
    print("=" * 60)
    
    # Check if API key is configured
    if not api_key:
        print("❌ ERROR: OPENAI_API_KEY not found in .env file")
        print("\nPlease add your XAI API key to backend/.env:")
        print("OPENAI_API_KEY=xai-your-key-here")
        return False
    
    if api_key == "your-xai-api-key-here":
        print("❌ ERROR: Please replace 'your-xai-api-key-here' with your actual XAI API key")
        print("\nEdit backend/.env and add your real XAI API key from https://console.x.ai/")
        return False
    
    print(f"✓ API Key found: {api_key[:10]}...{api_key[-4:]}")
    print(f"✓ Base URL: {base_url or 'Default OpenAI'}")
    print(f"✓ Model: {model}")
    print()
    
    # Verify we're using the right endpoint
    if base_url and "x.ai" in base_url:
        print("ℹ️  Using xAI (Grok) API")
        print("   Endpoint: /v1/chat/completions (OpenAI-compatible)")
        print("   ✅ NOT affected by /v1/messages deprecation")
        print()
    
    # Test connection
    try:
        print("Testing connection to XAI API...")
        
        if base_url:
            client = OpenAI(api_key=api_key, base_url=base_url)
        else:
            client = OpenAI(api_key=api_key)
        
        # Make a simple test request
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Hello, XAI connection successful!' in one sentence."}
            ],
            max_tokens=50
        )
        
        result = response.choices[0].message.content
        
        print("✅ SUCCESS! XAI API connection working!")
        print(f"\nTest Response: {result}")
        print(f"\nTokens used: {response.usage.total_tokens}")
        print(f"Model: {response.model}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Failed to connect to XAI API")
        print(f"\nError details: {str(e)}")
        print("\nPossible issues:")
        print("1. Invalid API key - check your key at https://console.x.ai/")
        print("2. Network connectivity issues")
        print("3. XAI API service temporarily unavailable")
        print("4. Incorrect base URL")
        return False

def test_local_embeddings():
    """Test local embeddings setup"""
    print("\n" + "=" * 60)
    print("Local Embeddings Test")
    print("=" * 60)
    
    use_local = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"
    
    if not use_local:
        print("ℹ️  Local embeddings not enabled (USE_LOCAL_EMBEDDINGS=false)")
        print("   This is fine if you're using OpenAI embeddings")
        return True
    
    print("✓ Local embeddings enabled (USE_LOCAL_EMBEDDINGS=true)")
    
    try:
        print("Testing sentence-transformers installation...")
        from sentence_transformers import SentenceTransformer
        
        print("✓ sentence-transformers installed")
        print("Loading model 'all-MiniLM-L6-v2'...")
        
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Test embedding generation
        test_text = "This is a test sentence for embeddings."
        embedding = model.encode(test_text)
        
        print(f"✅ SUCCESS! Local embeddings working!")
        print(f"   Embedding dimension: {len(embedding)}")
        print(f"   Test embedding generated successfully")
        
        return True
        
    except ImportError:
        print("❌ ERROR: sentence-transformers not installed")
        print("\nInstall it with:")
        print("   pip install sentence-transformers")
        return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    print("\n")
    
    # Test XAI connection
    xai_success = test_xai_connection()
    
    # Test local embeddings
    embeddings_success = test_local_embeddings()
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"XAI API Connection: {'✅ PASS' if xai_success else '❌ FAIL'}")
    print(f"Local Embeddings: {'✅ PASS' if embeddings_success else '❌ FAIL'}")
    
    if xai_success and embeddings_success:
        print("\n🎉 All tests passed! Your help chat should work now.")
        print("\nNext steps:")
        print("1. Restart your backend server")
        print("2. Test the help chat in your application")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        sys.exit(1)
    
    print()
