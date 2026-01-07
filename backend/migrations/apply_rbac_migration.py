#!/usr/bin/env python3
"""
Apply RBAC system migration to Supabase database
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import from main
sys.path.append(str(Path(__file__).parent.parent))

from supabase import create_client
from dotenv import load_dotenv

def apply_rbac_migration():
    """Apply the RBAC system migration"""
    print("🔧 Applying RBAC System Migration...")
    
    # Load environment variables
    load_dotenv()
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        print("   SUPABASE_URL set:", bool(SUPABASE_URL))
        print("   SUPABASE_SERVICE_ROLE_KEY set:", bool(SUPABASE_SERVICE_ROLE_KEY))
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase")
        
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "005_rbac_system.sql"
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Read migration file: 005_rbac_system.sql")
        
        # Execute the migration
        # Note: Supabase Python client doesn't support raw SQL execution
        # This would need to be run manually in the Supabase SQL editor
        # or via the Supabase CLI
        
        print("⚠️  Manual Action Required:")
        print("   1. Open Supabase Dashboard > SQL Editor")
        print("   2. Copy and paste the contents of migrations/005_rbac_system.sql")
        print("   3. Execute the SQL to create the RBAC tables and default roles")
        print("")
        print("   Alternatively, use the Supabase CLI:")
        print("   supabase db push")
        print("")
        
        # Test if tables exist by trying to query them
        try:
            roles_response = supabase.table("roles").select("count", count="exact").execute()
            print(f"✅ Roles table exists with {roles_response.count} roles")
            
            user_roles_response = supabase.table("user_roles").select("count", count="exact").execute()
            print(f"✅ User roles table exists with {user_roles_response.count} assignments")
            
            return True
            
        except Exception as e:
            print(f"⚠️  Tables not yet created: {e}")
            print("   Please run the migration SQL manually as described above")
            return False
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        return False

if __name__ == "__main__":
    success = apply_rbac_migration()
    if success:
        print("\n🎉 RBAC migration completed successfully!")
    else:
        print("\n❌ RBAC migration requires manual intervention")
        sys.exit(1)