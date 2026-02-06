#!/usr/bin/env python3
"""
Apply Shareable Project URLs Migration

This script applies the shareable project URLs migration to the database.
It creates the necessary tables, indexes, functions, and views for the
secure shareable URL system.

Usage:
    python apply_shareable_urls_migration.py
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from config.database import get_db
from supabase import Client


def apply_migration():
    """Apply the shareable URLs migration"""
    print("=" * 60)
    print("Shareable Project URLs Migration")
    print("=" * 60)
    
    # Get database client
    try:
        supabase: Client = get_db()
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Failed to connect to database: {e}")
        return False
    
    # Read migration file
    migration_file = Path(__file__).parent / "031_shareable_project_urls.sql"
    try:
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        print(f"✓ Loaded migration file: {migration_file.name}")
    except Exception as e:
        print(f"✗ Failed to read migration file: {e}")
        return False
    
    # Apply migration
    print("\nApplying migration...")
    try:
        # Execute the migration SQL
        # Note: Supabase client doesn't directly support raw SQL execution
        # This would typically be done through the Supabase dashboard or CLI
        # For now, we'll provide instructions
        
        print("\n" + "=" * 60)
        print("MIGRATION SQL READY")
        print("=" * 60)
        print("\nTo apply this migration, you have two options:")
        print("\n1. Using Supabase Dashboard:")
        print("   - Go to your Supabase project dashboard")
        print("   - Navigate to SQL Editor")
        print("   - Copy and paste the contents of:")
        print(f"     {migration_file}")
        print("   - Execute the SQL")
        
        print("\n2. Using Supabase CLI:")
        print("   - Run: supabase db push")
        print("   - Or: psql <connection_string> < migrations/031_shareable_project_urls.sql")
        
        print("\n" + "=" * 60)
        print("MIGRATION VERIFICATION")
        print("=" * 60)
        print("\nAfter applying the migration, verify with:")
        print("  python verify_shareable_urls_migration.py")
        
        return True
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        return False


def verify_tables():
    """Verify that the tables were created"""
    print("\n" + "=" * 60)
    print("VERIFYING MIGRATION")
    print("=" * 60)
    
    try:
        supabase: Client = get_db()
        
        # Check if project_shares table exists
        result = supabase.table('project_shares').select('id').limit(0).execute()
        print("✓ project_shares table exists")
        
        # Check if share_access_logs table exists
        result = supabase.table('share_access_logs').select('id').limit(0).execute()
        print("✓ share_access_logs table exists")
        
        print("\n✓ Migration verification successful!")
        return True
        
    except Exception as e:
        print(f"\n✗ Verification failed: {e}")
        print("\nThis is expected if you haven't applied the migration yet.")
        print("Please apply the migration using one of the methods above.")
        return False


if __name__ == "__main__":
    print("\n")
    success = apply_migration()
    
    if success:
        print("\n" + "=" * 60)
        print("NEXT STEPS")
        print("=" * 60)
        print("\n1. Apply the migration SQL using Supabase Dashboard or CLI")
        print("2. Run verification: python verify_shareable_urls_migration.py")
        print("3. Test the share link functionality")
        print("\n")
    else:
        print("\n✗ Migration setup failed")
        sys.exit(1)
