#!/usr/bin/env python3
"""
Verify Help Chat Schema
Checks if the help chat database schema has been properly set up
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Add parent directory to path to import from backend
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
load_dotenv()

def verify_help_chat_schema():
    """Verify that the help chat schema exists and is accessible"""
    
    print("🔍 Verifying Help Chat Database Schema...")
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_anon_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_anon_key)
        print("✅ Connected to Supabase")
        
        # Check if key tables exist and are accessible
        tables_to_check = [
            'help_sessions',
            'help_messages', 
            'help_feedback',
            'help_analytics',
            'help_content'
        ]
        
        existing_tables = []
        missing_tables = []
        
        for table in tables_to_check:
            try:
                result = supabase.table(table).select("count", count="exact").limit(1).execute()
                existing_tables.append(table)
                print(f"✅ Table '{table}' exists and is accessible")
            except Exception as e:
                missing_tables.append(table)
                print(f"❌ Table '{table}' not found: {str(e)[:100]}...")
        
        # Summary
        print(f"\n📊 Schema Verification Summary:")
        print(f"   Existing tables: {len(existing_tables)}/{len(tables_to_check)}")
        print(f"   Missing tables: {len(missing_tables)}")
        
        if existing_tables:
            print(f"   ✅ Found: {', '.join(existing_tables)}")
        
        if missing_tables:
            print(f"   ❌ Missing: {', '.join(missing_tables)}")
            print(f"\n📋 To create missing tables:")
            print(f"   1. Review backend/migrations/HELP_CHAT_MIGRATION_GUIDE.md")
            print(f"   2. Execute the SQL statements in Supabase dashboard")
            print(f"   3. Or run the full migration: backend/migrations/018_help_chat_system.sql")
        
        # Check sample content if help_content table exists
        if 'help_content' in existing_tables:
            try:
                result = supabase.table('help_content').select("count", count="exact").execute()
                content_count = result.count if hasattr(result, 'count') else 0
                if content_count > 0:
                    print(f"✅ Help content available ({content_count} items)")
                else:
                    print("⚠️ No help content found - consider adding sample data")
            except Exception as e:
                print(f"⚠️ Could not check help content: {e}")
        
        return len(missing_tables) == 0
        
    except Exception as e:
        print(f"❌ Schema verification failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔍 HELP CHAT SCHEMA VERIFICATION")
    print("=" * 60)
    
    success = verify_help_chat_schema()
    
    if success:
        print("\n🎉 Help Chat schema verification completed successfully!")
        print("   All required tables are present and accessible.")
        sys.exit(0)
    else:
        print("\n⚠️ Help Chat schema verification found issues.")
        print("   Please review the migration guide and create missing tables.")
        sys.exit(1)