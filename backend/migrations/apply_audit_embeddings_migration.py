#!/usr/bin/env python3
"""
Apply Audit Logs Embeddings Migration (028)

This script applies the migration to add embedding column to roche_audit_logs table
for semantic search using RAG (Retrieval-Augmented Generation).

Requirements: 14.1
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    
    return create_client(supabase_url, supabase_key)

def apply_migration(supabase: Client) -> bool:
    """Apply the audit logs embeddings migration"""
    
    migration_file = Path(__file__).parent / "028_audit_logs_embeddings.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    print("📖 Reading migration file...")
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    print("🚀 Applying migration 028: Add Embedding Column to Audit Logs...")
    
    try:
        # Execute the migration SQL
        # Note: Supabase Python client doesn't directly support raw SQL execution
        # You may need to use psycopg2 or execute via Supabase SQL editor
        print("⚠️  Note: This migration needs to be applied via Supabase SQL editor or psycopg2")
        print("📋 Migration SQL content:")
        print("-" * 80)
        print(migration_sql[:500] + "..." if len(migration_sql) > 500 else migration_sql)
        print("-" * 80)
        
        # Alternative: Use psycopg2 if available
        try:
            import psycopg2
            
            # Get database connection string
            db_url = os.getenv("DATABASE_URL")
            if not db_url:
                print("⚠️  DATABASE_URL not set. Please apply migration manually via Supabase SQL editor.")
                return False
            
            print("🔌 Connecting to database...")
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor()
            
            print("⚙️  Executing migration...")
            cursor.execute(migration_sql)
            conn.commit()
            
            print("✅ Migration applied successfully!")
            
            # Verify the migration
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'roche_audit_logs' 
                AND column_name = 'embedding'
            """)
            result = cursor.fetchone()
            
            if result:
                print(f"✅ Verified: embedding column exists with type {result[1]}")
            else:
                print("⚠️  Warning: Could not verify embedding column")
            
            # Check if functions were created
            cursor.execute("""
                SELECT routine_name 
                FROM information_schema.routines 
                WHERE routine_name IN (
                    'search_audit_logs_semantic',
                    'get_audit_logs_without_embeddings',
                    'batch_update_audit_embeddings',
                    'get_audit_embedding_stats'
                )
            """)
            functions = cursor.fetchall()
            print(f"✅ Created {len(functions)} functions:")
            for func in functions:
                print(f"   - {func[0]}")
            
            cursor.close()
            conn.close()
            
            return True
            
        except ImportError:
            print("⚠️  psycopg2 not installed. Please install it or apply migration manually.")
            print("   pip install psycopg2-binary")
            return False
            
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        import traceback
        traceback.print_exc()
        return False

def verify_migration(supabase: Client) -> bool:
    """Verify the migration was applied successfully"""
    
    print("\n🔍 Verifying migration...")
    
    try:
        # Try to call one of the new functions to verify it exists
        result = supabase.rpc('get_audit_embedding_stats').execute()
        
        if result.data:
            stats = result.data[0] if isinstance(result.data, list) else result.data
            print("✅ Migration verified successfully!")
            print(f"   Total logs: {stats.get('total_logs', 0)}")
            print(f"   Logs with embeddings: {stats.get('logs_with_embeddings', 0)}")
            print(f"   Logs without embeddings: {stats.get('logs_without_embeddings', 0)}")
            print(f"   Coverage: {stats.get('embedding_coverage_percent', 0)}%")
            return True
        else:
            print("⚠️  Could not verify migration (no data returned)")
            return False
            
    except Exception as e:
        print(f"⚠️  Could not verify migration: {e}")
        print("   This is expected if the migration hasn't been applied yet.")
        return False

def main():
    """Main execution function"""
    
    print("=" * 80)
    print("Audit Logs Embeddings Migration (028)")
    print("=" * 80)
    print()
    
    try:
        # Create Supabase client
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
        print()
        
        # Apply migration
        success = apply_migration(supabase)
        
        if success:
            # Verify migration
            verify_migration(supabase)
            print()
            print("=" * 80)
            print("✅ Migration completed successfully!")
            print("=" * 80)
            print()
            print("Next steps:")
            print("1. Implement AuditSearchAgent class (task 19.2)")
            print("2. Implement background embedding generation (task 19.3)")
            print("3. Run property tests (tasks 19.4-19.6)")
            return 0
        else:
            print()
            print("=" * 80)
            print("⚠️  Migration needs manual application")
            print("=" * 80)
            print()
            print("Please apply the migration manually:")
            print("1. Open Supabase SQL Editor")
            print("2. Copy the contents of backend/migrations/028_audit_logs_embeddings.sql")
            print("3. Execute the SQL")
            print("4. Run this script again to verify")
            return 1
            
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())

