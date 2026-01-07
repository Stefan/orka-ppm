#!/usr/bin/env python3
"""
Test script to verify all dependencies can be imported successfully.
"""

def test_imports():
    """Test that all required dependencies can be imported."""
    try:
        # Core dependencies
        import fastapi
        import uvicorn
        import supabase
        import dotenv
        import jwt
        import cryptography
        import requests
        import pydantic
        import gunicorn
        import numpy
        import openai
        import pgvector
        import psycopg2
        
        # Performance dependencies
        import redis
        import slowapi
        import prometheus_client
        import cachetools
        import aiofiles
        
        print("✅ All dependencies imported successfully!")
        
        # Check cachetools version
        print(f"📦 cachetools version: {cachetools.__version__}")
        
        # Check if pyiceberg is available (pulled in by storage3)
        try:
            import pyiceberg
            print(f"📦 pyiceberg version: {pyiceberg.__version__}")
        except ImportError:
            print("⚠️  pyiceberg not available (this is OK)")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

if __name__ == "__main__":
    success = test_imports()
    exit(0 if success else 1)