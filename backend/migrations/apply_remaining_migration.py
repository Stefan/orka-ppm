#!/usr/bin/env python3
"""
Apply Remaining Database Schema Migration
This script applies the remaining missing tables and columns to complete the schema enhancement.
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        print("Please ensure your .env file contains:")
        print("SUPABASE_URL=your_supabase_url")
        print("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        sys.exit(1)
    
    return create_client(url, key)

def read_migration_file() -> str:
    """Read the migration SQL file"""
    migration_file = Path(__file__).parent / "002_complete_remaining_schema.sql"
    
    if not migration_file.exists():
        print(f"❌ Error: Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file, 'r') as f:
        return f.read()

def apply_migration(supabase: Client, sql: str) -> bool:
    """Apply the migration SQL by executing individual statements"""
    try:
        print("🔄 Applying remaining schema migration...")
        
        # Split SQL into individual statements and execute them
        statements = [stmt.strip() for stmt in sql.split(';') if stmt.strip()]
        
        print(f"📝 Executing {len(statements)} SQL statements...")
        
        for i, statement in enumerate(statements, 1):
            if statement.strip():
                try:
                    # Use PostgREST to execute SQL (limited functionality)
                    # For now, we'll print instructions for manual execution
                    print(f"Statement {i}: {statement[:50]}...")
                except Exception as e:
                    print(f"⚠️  Statement {i} failed: {str(e)}")
        
        print("\n⚠️  Note: Supabase client cannot execute DDL statements directly.")
        print("Please apply the migration manually via Supabase SQL Editor:")
        print("1. Open your Supabase project dashboard")
        print("2. Go to SQL Editor")
        print("3. Copy the contents of 'backend/migrations/002_complete_remaining_schema.sql'")
        print("4. Paste and execute in the SQL Editor")
        
        return False  # Return False to indicate manual action needed
            
    except Exception as e:
        print(f"❌ Migration preparation failed with error: {str(e)}")
        return False

def verify_migration(supabase: Client) -> bool:
    """Verify that the migration was successful"""
    print("\n🔍 Verifying migration results...")
    
    # Check for missing tables
    missing_tables = [
        'workflows', 'workflow_instances', 'workflow_approvals',
        'financial_tracking', 'milestones', 'project_resources', 'audit_logs'
    ]
    
    success = True
    
    for table in missing_tables:
        try:
            result = supabase.table(table).select("*").limit(1).execute()
            print(f"✅ Table '{table}' exists and is accessible")
        except Exception as e:
            print(f"❌ Table '{table}' check failed: {str(e)}")
            success = False
    
    # Check for missing columns in projects table
    missing_project_columns = ['health', 'manager_id', 'team_members']
    
    try:
        # Try to select the missing columns
        result = supabase.table('projects').select(','.join(missing_project_columns)).limit(1).execute()
        print("✅ All missing project columns are now available")
    except Exception as e:
        print(f"❌ Project columns check failed: {str(e)}")
        success = False
    
    # Check for missing columns in resources table  
    missing_resource_columns = ['availability', 'current_projects', 'location']
    
    try:
        # Try to select the missing columns
        result = supabase.table('resources').select(','.join(missing_resource_columns)).limit(1).execute()
        print("✅ All missing resource columns are now available")
    except Exception as e:
        print(f"❌ Resource columns check failed: {str(e)}")
        success = False
    
    return success

def main():
    """Main execution function"""
    print("🚀 Starting remaining database schema migration...")
    
    # Get Supabase client
    try:
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {str(e)}")
        sys.exit(1)
    
    # Read migration file
    sql = read_migration_file()
    print(f"✅ Loaded migration SQL ({len(sql)} characters)")
    
    # Show migration instructions
    apply_migration(supabase, sql)
    
    print("\n📋 Manual Migration Instructions:")
    print("=" * 50)
    print("Since Supabase doesn't allow DDL execution via API, please:")
    print("1. Open your Supabase project dashboard")
    print("2. Navigate to 'SQL Editor'")
    print("3. Copy the entire contents of:")
    print("   backend/migrations/002_complete_remaining_schema.sql")
    print("4. Paste into the SQL Editor and click 'Run'")
    print("5. After execution, run: python migrations/verify_schema.py")
    print("=" * 50)
    
    # Still run verification to show current status
    print("\n🔍 Current schema status:")
    verify_migration(supabase)

if __name__ == "__main__":
    main()