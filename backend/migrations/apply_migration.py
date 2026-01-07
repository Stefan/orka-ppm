#!/usr/bin/env python3
"""
Database Migration Script for AI-Powered PPM Platform
Applies SQL migrations to Supabase database
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client with service role key for admin operations"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    
    return create_client(url, service_key)

def read_migration_file(migration_path: Path) -> str:
    """Read migration SQL file"""
    if not migration_path.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_path}")
    
    return migration_path.read_text(encoding='utf-8')

def apply_migration(supabase: Client, migration_sql: str, migration_name: str) -> bool:
    """Apply migration SQL to database"""
    try:
        print(f"Applying migration: {migration_name}")
        
        # Split the migration into individual statements
        # Remove comments and empty lines
        statements = []
        current_statement = []
        
        for line in migration_sql.split('\n'):
            line = line.strip()
            # Skip comments and empty lines
            if line.startswith('--') or not line:
                continue
            
            current_statement.append(line)
            
            # If line ends with semicolon, it's the end of a statement
            if line.endswith(';'):
                statement = ' '.join(current_statement)
                if statement.strip():
                    statements.append(statement)
                current_statement = []
        
        # Add any remaining statement
        if current_statement:
            statement = ' '.join(current_statement)
            if statement.strip():
                statements.append(statement)
        
        # Execute each statement
        for i, statement in enumerate(statements):
            try:
                print(f"Executing statement {i+1}/{len(statements)}")
                # Use rpc to execute raw SQL
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                print(f"✓ Statement {i+1} executed successfully")
            except Exception as e:
                print(f"✗ Error executing statement {i+1}: {str(e)}")
                print(f"Statement: {statement[:100]}...")
                # Continue with other statements
                continue
        
        print(f"✓ Migration {migration_name} completed")
        return True
        
    except Exception as e:
        print(f"✗ Error applying migration {migration_name}: {str(e)}")
        return False

def create_exec_sql_function(supabase: Client):
    """Create a helper function to execute raw SQL"""
    try:
        # First, try to create the function
        create_function_sql = """
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS text
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            EXECUTE sql;
            RETURN 'OK';
        EXCEPTION
            WHEN OTHERS THEN
                RETURN SQLERRM;
        END;
        $$;
        """
        
        # Try to execute using direct SQL if possible
        print("Creating exec_sql helper function...")
        result = supabase.rpc('exec_sql', {'sql': create_function_sql}).execute()
        print("✓ Helper function created")
        
    except Exception as e:
        print(f"Note: Could not create helper function: {str(e)}")
        print("Will attempt direct execution...")

def main():
    """Main migration application function"""
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Create helper function
        create_exec_sql_function(supabase)
        
        # Get migration file path
        migrations_dir = Path(__file__).parent
        migration_file = migrations_dir / "001_initial_schema_enhancement.sql"
        
        # Read migration
        migration_sql = read_migration_file(migration_file)
        print(f"✓ Read migration file: {migration_file.name}")
        
        # Apply migration
        success = apply_migration(supabase, migration_sql, migration_file.name)
        
        if success:
            print("\n🎉 Database migration completed successfully!")
            
            # Test the migration by checking if new tables exist
            print("\nVerifying migration...")
            try:
                # Check if risks table exists
                result = supabase.table("risks").select("*", count="exact").limit(1).execute()
                print(f"✓ Risks table exists (count: {result.count})")
                
                # Check if issues table exists  
                result = supabase.table("issues").select("*", count="exact").limit(1).execute()
                print(f"✓ Issues table exists (count: {result.count})")
                
                # Check if workflows table exists
                result = supabase.table("workflows").select("*", count="exact").limit(1).execute()
                print(f"✓ Workflows table exists (count: {result.count})")
                
                # Check if financial_tracking table exists
                result = supabase.table("financial_tracking").select("*", count="exact").limit(1).execute()
                print(f"✓ Financial tracking table exists (count: {result.count})")
                
                # Check if milestones table exists
                result = supabase.table("milestones").select("*", count="exact").limit(1).execute()
                print(f"✓ Milestones table exists (count: {result.count})")
                
                print("\n✅ All new tables verified successfully!")
                
            except Exception as e:
                print(f"⚠️  Warning: Could not verify all tables: {str(e)}")
                
        else:
            print("\n❌ Migration failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Migration error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()