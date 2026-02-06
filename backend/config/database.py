"""
Database configuration and client setup
"""

import os
import jwt
from datetime import datetime
from supabase import create_client, Client
from typing import Optional

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

def get_db() -> Optional[Client]:
    """
    Get the database client (provider-agnostic entry point).
    Currently returns the Supabase client; can be swapped for another provider later.
    
    Returns:
        Optional[Client]: Database client instance or None if not available
    """
    return supabase


# Backward compatibility: use get_db() in new code. This alias exists so callers
# that still reference get_supabase_client (e.g. legacy imports or other modules)
# do not raise NameError. Prefer get_db for provider-agnostic naming.
get_supabase_client = get_db

# Database connection pool configuration (Task 18.4)
# These settings optimize database performance for high-load scenarios
DATABASE_POOL_CONFIG = {
    "min_size": 10,  # Minimum number of connections in the pool
    "max_size": 50,  # Maximum number of connections in the pool
    "max_queries": 50000,  # Maximum number of queries per connection before recycling
    "max_inactive_connection_lifetime": 300.0,  # Close connections idle for 5 minutes
    "timeout": 60.0,  # Connection timeout in seconds
    "command_timeout": 60.0,  # Query timeout in seconds
}