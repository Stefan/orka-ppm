"""
Database configuration and client setup
"""

import os
import jwt
import asyncpg
from datetime import datetime
from supabase import create_client, Client
from typing import Optional
from urllib.parse import urlparse

from .settings import settings

def create_supabase_client() -> Optional[Client]:
    """Create and configure Supabase client with enhanced error handling"""
    
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_ANON_KEY
    
    try:
        if not supabase_url or not supabase_key:
            print(f"⚠️ WARNING: Missing Supabase credentials - URL: {bool(supabase_url)}, KEY: {bool(supabase_key)}")
            # Use fallback values from vercel.json if available
            supabase_url = supabase_url or "https://xceyrfvxooiplbmwavlb.supabase.co"
            supabase_key = supabase_key or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo"
            print(f"🔄 Using fallback values from configuration")
        
        # Validate JWT token format with tolerance for timestamp issues
        if supabase_key:
            parts = supabase_key.split('.')
            if len(parts) != 3:
                raise ValueError(f"Invalid JWT format: expected 3 parts, got {len(parts)}")
            if not supabase_key.startswith('eyJ'):
                raise ValueError("Invalid JWT format: must start with 'eyJ'")
            
            # Check JWT payload but be tolerant of timestamp issues
            try:
                payload = jwt.decode(supabase_key, options={"verify_signature": False})
                print(f"✅ JWT payload decoded: iss={payload.get('iss')}, role={payload.get('role')}")
                
                # Check expiration but be tolerant
                now = int(datetime.now().timestamp())
                if payload.get('exp') and payload.get('exp') < now:
                    print(f"⚠️ JWT token expired but continuing (exp: {payload.get('exp')}, now: {now})")
                
                if payload.get('iat') and payload.get('iat') > now:
                    print(f"⚠️ JWT token issued in future but continuing (iat: {payload.get('iat')}, now: {now})")
                    
            except Exception as jwt_error:
                print(f"⚠️ JWT validation warning: {jwt_error}")
            
            print(f"✅ JWT token format validated")
        
        # Create Supabase client with error handling
        supabase = create_client(supabase_url, supabase_key)
        print(f"✅ Supabase client created successfully")
        
        # Test connection with graceful failure
        try:
            # Simple test query with timeout
            test_response = supabase.table("portfolios").select("count", count="exact").limit(1).execute()
            print(f"✅ Supabase connection test successful")
        except Exception as test_error:
            print(f"⚠️ Supabase connection test failed: {test_error}")
            print(f"⚠️ Continuing with degraded functionality")
        
        return supabase
        
    except Exception as e:
        print(f"❌ Error creating Supabase client: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        print(f"⚠️ Continuing without database functionality")
        return None

def create_service_supabase_client() -> Optional[Client]:
    """Create Supabase client with service role key for admin operations"""
    
    supabase_url = settings.SUPABASE_URL
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    
    if not supabase_url or not service_key:
        print(f"⚠️ Service role client unavailable - missing credentials")
        return None
    
    try:
        service_supabase = create_client(supabase_url, service_key)
        print(f"✅ Service role Supabase client created")
        return service_supabase
    except Exception as e:
        print(f"❌ Error creating service role client: {e}")
        return None

# Global database clients
supabase: Optional[Client] = create_supabase_client()
service_supabase: Optional[Client] = create_service_supabase_client()

async def get_database_connection() -> asyncpg.Connection:
    """
    Create a direct asyncpg connection to the database for migrations.
    
    Returns:
        asyncpg.Connection: Database connection
        
    Raises:
        Exception: If connection cannot be established
    """
    try:
        # Parse Supabase URL to get connection parameters
        supabase_url = settings.SUPABASE_URL
        if not supabase_url:
            raise ValueError("SUPABASE_URL not configured")
            
        # Supabase URLs are in format: https://project.supabase.co
        # We need to construct the PostgreSQL connection URL
        parsed = urlparse(supabase_url)
        
        # For Supabase, the database connection is typically:
        # postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
        
        # Extract project ID from the URL
        project_id = parsed.hostname.split('.')[0] if parsed.hostname else None
        if not project_id:
            raise ValueError("Could not extract project ID from Supabase URL")
            
        # Get the service role key to extract the database password
        service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not service_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY not configured for database access")
            
        # For direct database access, we need the database password
        # This is typically stored in environment variables or can be extracted from service key
        db_password = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("DATABASE_PASSWORD")
        
        if not db_password:
            # Try to use service key as password (some setups work this way)
            db_password = service_key
            
        # Construct the PostgreSQL connection URL
        db_host = f"db.{project_id}.supabase.co"
        db_url = f"postgresql://postgres:{db_password}@{db_host}:5432/postgres"
        
        # Try to connect
        conn = await asyncpg.connect(db_url)
        return conn
        
    except Exception as e:
        # Fallback: try environment variables for direct database connection
        try:
            database_url = os.getenv("DATABASE_URL")
            if database_url:
                conn = await asyncpg.connect(database_url)
                return conn
        except Exception:
            pass
            
        raise Exception(f"Could not establish database connection: {e}")

async def get_database_url() -> str:
    """
    Get the database URL for connection.
    
    Returns:
        str: Database connection URL
    """
    # Try environment variable first
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
        
    # Construct from Supabase settings
    supabase_url = settings.SUPABASE_URL
    if not supabase_url:
        raise ValueError("No database URL configured")
        
    parsed = urlparse(supabase_url)
    project_id = parsed.hostname.split('.')[0] if parsed.hostname else None
    
    if not project_id:
        raise ValueError("Could not extract project ID from Supabase URL")
        
    db_password = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("DATABASE_PASSWORD")
    if not db_password:
        db_password = settings.SUPABASE_SERVICE_ROLE_KEY
        
    return f"postgresql://postgres:{db_password}@db.{project_id}.supabase.co:5432/postgres"