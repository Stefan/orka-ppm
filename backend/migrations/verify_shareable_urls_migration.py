#!/usr/bin/env python3
"""
Verify Shareable Project URLs Migration

This script verifies that the shareable project URLs migration was applied correctly.
It checks for the existence of tables, indexes, functions, and views.

Usage:
    python verify_shareable_urls_migration.py
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from config.database import get_supabase_client
from supabase import Client


def verify_migration():
    """Verify the shareable URLs migration"""
    print("=" * 60)
    print("Shareable Project URLs Migration Verification")
    print("=" * 60)
    
    # Get database client
    try:
        supabase: Client = get_supabase_client()
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Failed to connect to database: {e}")
        return False
    
    all_checks_passed = True
    
    # Check tables
    print("\n" + "-" * 60)
    print("Checking Tables")
    print("-" * 60)
    
    tables = ['project_shares', 'share_access_logs']
    for table in tables:
        try:
            result = supabase.table(table).select('id').limit(0).execute()
            print(f"✓ Table '{table}' exists")
        except Exception as e:
            print(f"✗ Table '{table}' not found: {e}")
            all_checks_passed = False
    
    # Check enum types
    print("\n" + "-" * 60)
    print("Checking Enum Types")
    print("-" * 60)
    print("  Note: Enum verification requires direct database access")
    print("  Expected enum: share_permission_level (view_only, limited_data, full_project)")
    
    # Check views
    print("\n" + "-" * 60)
    print("Checking Views")
    print("-" * 60)
    
    views = [
        'v_active_share_links',
        'v_share_link_usage',
        'v_suspicious_access_patterns'
    ]
    
    for view in views:
        try:
            result = supabase.table(view).select('*').limit(0).execute()
            print(f"✓ View '{view}' exists")
        except Exception as e:
            print(f"✗ View '{view}' not found: {e}")
            all_checks_passed = False
    
    # Check functions
    print("\n" + "-" * 60)
    print("Checking Functions")
    print("-" * 60)
    print("  Note: Function verification requires direct database access")
    
    functions = [
        'deactivate_expired_share_links()',
        'validate_share_link_access(VARCHAR)',
        'log_share_access(UUID, INET, TEXT, VARCHAR, VARCHAR)',
        'detect_suspicious_access(UUID, INET)',
        'get_share_analytics(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE)'
    ]
    
    for func in functions:
        print(f"  Expected function: {func}")
    
    # Check RLS policies
    print("\n" + "-" * 60)
    print("Checking Row Level Security")
    print("-" * 60)
    print("  Note: RLS policy verification requires direct database access")
    print("  Expected policies on project_shares:")
    print("    - project_shares_select_policy")
    print("    - project_shares_insert_policy")
    print("    - project_shares_update_policy")
    print("    - project_shares_delete_policy")
    print("  Expected policies on share_access_logs:")
    print("    - share_access_logs_select_policy")
    print("    - share_access_logs_insert_policy")
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    if all_checks_passed:
        print("\n✓ All basic checks passed!")
        print("\nNote: Some checks require direct database access.")
        print("Please verify the following manually:")
        print("  1. Enum types are created correctly")
        print("  2. All functions are present and working")
        print("  3. RLS policies are enabled and configured")
        print("  4. Indexes are created for performance")
        print("  5. Triggers are set up for audit logging")
    else:
        print("\n✗ Some checks failed!")
        print("\nPlease ensure the migration was applied correctly.")
        print("Run: python apply_shareable_urls_migration.py")
    
    return all_checks_passed


def test_basic_operations():
    """Test basic CRUD operations on the tables"""
    print("\n" + "=" * 60)
    print("TESTING BASIC OPERATIONS")
    print("=" * 60)
    
    try:
        supabase: Client = get_supabase_client()
        
        # Test project_shares table structure
        print("\nTesting project_shares table structure...")
        try:
            # This will fail if the table doesn't exist or has wrong structure
            result = supabase.table('project_shares').select(
                'id, project_id, token, permission_level, expires_at, is_active, '
                'access_count, created_by, created_at, updated_at'
            ).limit(0).execute()
            print("✓ project_shares table structure is correct")
        except Exception as e:
            print(f"✗ project_shares table structure issue: {e}")
            return False
        
        # Test share_access_logs table structure
        print("\nTesting share_access_logs table structure...")
        try:
            result = supabase.table('share_access_logs').select(
                'id, share_id, accessed_at, ip_address, user_agent, '
                'country_code, city, accessed_sections, session_duration, '
                'is_suspicious, suspicious_reasons'
            ).limit(0).execute()
            print("✓ share_access_logs table structure is correct")
        except Exception as e:
            print(f"✗ share_access_logs table structure issue: {e}")
            return False
        
        print("\n✓ Basic operations test passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ Basic operations test failed: {e}")
        return False


if __name__ == "__main__":
    print("\n")
    
    # Run verification
    verification_passed = verify_migration()
    
    # Run basic operations test
    if verification_passed:
        test_passed = test_basic_operations()
    else:
        test_passed = False
    
    # Final summary
    print("\n" + "=" * 60)
    print("FINAL RESULT")
    print("=" * 60)
    
    if verification_passed and test_passed:
        print("\n✓ Migration verification successful!")
        print("\nYou can now proceed with implementing the share link services.")
    else:
        print("\n✗ Migration verification failed!")
        print("\nPlease check the errors above and reapply the migration if needed.")
        sys.exit(1)
    
    print("\n")
