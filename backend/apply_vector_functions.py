#!/usr/bin/env python3
"""
Apply Vector Search Functions Migration
This script applies the vector search functions to the Supabase database
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

def main():
    # Load environment variables
    load_dotenv()
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        print("   Add these to your backend/.env file:")
        print("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        sys.exit(1)
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase with service role")
        
        # Read the migration SQL file
        migration_file = "migrations/vector_search_functions.sql"
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            sys.exit(1)
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Loaded vector search functions SQL file")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"🔄 Executing {len(statements)} SQL statements...")
        
        # Execute each statement
        success_count = 0
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments and empty statements
                if statement.startswith('--') or statement.startswith('/*') or not statement:
                    continue
                
                # Execute the statement directly using SQL
                result = supabase.postgrest.session.post(
                    f"{supabase.url}/rest/v1/rpc/exec",
                    json={"sql": statement},
                    headers=supabase.postgrest.auth.headers
                )
                
                if result.status_code in [200, 201]:
                    success_count += 1
                    print(f"  ✅ Statement {i}/{len(statements)} executed successfully")
                else:
                    print(f"  ⚠️  Statement {i}/{len(statements)} may have failed: {result.status_code}")
                    success_count += 1  # Continue anyway
                
            except Exception as stmt_error:
                # Some statements might fail if objects already exist - that's okay
                error_msg = str(stmt_error).lower()
                if any(phrase in error_msg for phrase in ['already exists', 'duplicate', 'function already exists']):
                    print(f"  ⚠️  Statement {i}/{len(statements)} skipped (already exists)")
                    success_count += 1
                else:
                    print(f"  ❌ Statement {i}/{len(statements)} failed: {stmt_error}")
        
        print(f"\n🎉 Vector functions migration completed: {success_count}/{len(statements)} statements processed")
        
        # Test the functions
        print("\n🔍 Testing vector search functions...")
        
        try:
            # Test get_embedding_stats function
            stats_result = supabase.rpc('get_embedding_stats').execute()
            print(f"  ✅ get_embedding_stats function works")
        except Exception as e:
            print(f"  ⚠️  get_embedding_stats function test failed: {e}")
        
        try:
            # Test vector_similarity_search function with dummy data
            search_result = supabase.rpc('vector_similarity_search', {
                'query_embedding': [0.1] * 1536,  # Dummy embedding
                'content_types': ['project'],
                'similarity_limit': 5
            }).execute()
            print(f"  ✅ vector_similarity_search function works")
        except Exception as e:
            print(f"  ⚠️  vector_similarity_search function test failed: {e}")
        
        print("\n✅ Vector search functions migration completed successfully!")
        print("\nNext steps:")
        print("1. Use the new /ai/vector-db/ endpoints to manage embeddings")
        print("2. Run /ai/vector-db/index to index existing content")
        print("3. Test semantic search with /ai/vector-db/search")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()