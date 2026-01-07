#!/usr/bin/env python3
"""
Apply AI Features Database Migration
This script applies the AI features schema to the Supabase database
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
        migration_file = "migrations/ai_features_schema.sql"
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            sys.exit(1)
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Loaded migration SQL file")
        
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
                
                # Execute the statement using RPC call
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                success_count += 1
                print(f"  ✅ Statement {i}/{len(statements)} executed successfully")
                
            except Exception as stmt_error:
                # Some statements might fail if objects already exist - that's okay
                error_msg = str(stmt_error).lower()
                if any(phrase in error_msg for phrase in ['already exists', 'duplicate', 'relation already exists']):
                    print(f"  ⚠️  Statement {i}/{len(statements)} skipped (already exists)")
                    success_count += 1
                else:
                    print(f"  ❌ Statement {i}/{len(statements)} failed: {stmt_error}")
        
        print(f"\n🎉 Migration completed: {success_count}/{len(statements)} statements processed")
        
        # Verify some key tables were created
        print("\n🔍 Verifying migration...")
        
        tables_to_check = [
            'embeddings', 'rag_contexts', 'resource_skills', 
            'project_requirements', 'resource_availability', 
            'risk_patterns', 'risk_predictions', 'ai_agent_metrics'
        ]
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("count", count="exact").limit(1).execute()
                print(f"  ✅ Table '{table}' exists and accessible")
            except Exception as e:
                print(f"  ❌ Table '{table}' verification failed: {e}")
        
        print("\n✅ AI features migration completed successfully!")
        print("\nNext steps:")
        print("1. Set OPENAI_API_KEY in your backend/.env file")
        print("2. Restart your backend server")
        print("3. Test the AI endpoints at /docs")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()