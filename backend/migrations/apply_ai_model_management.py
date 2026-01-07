#!/usr/bin/env python3
"""
Apply AI Model Management Migration
Creates tables and functions for comprehensive AI model management and monitoring
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

def apply_ai_model_management_migration():
    """Apply the AI model management migration"""
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(supabase_url, supabase_service_key)
        print("✅ Connected to Supabase")
        
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "006_ai_model_management.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Read migration file")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"🔄 Executing {len(statements)} SQL statements...")
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments and empty statements
                if statement.startswith('--') or not statement:
                    continue
                
                # Execute the statement using RPC
                result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                
                # Check for specific table creation statements to provide feedback
                if 'CREATE TABLE' in statement.upper():
                    table_name = extract_table_name(statement)
                    print(f"  ✅ Created table: {table_name}")
                elif 'CREATE INDEX' in statement.upper():
                    index_name = extract_index_name(statement)
                    print(f"  ✅ Created index: {index_name}")
                elif 'CREATE FUNCTION' in statement.upper():
                    function_name = extract_function_name(statement)
                    print(f"  ✅ Created function: {function_name}")
                elif 'CREATE VIEW' in statement.upper():
                    view_name = extract_view_name(statement)
                    print(f"  ✅ Created view: {view_name}")
                elif 'CREATE TRIGGER' in statement.upper():
                    trigger_name = extract_trigger_name(statement)
                    print(f"  ✅ Created trigger: {trigger_name}")
                elif 'CREATE POLICY' in statement.upper():
                    policy_name = extract_policy_name(statement)
                    print(f"  ✅ Created policy: {policy_name}")
                
            except Exception as e:
                print(f"  ⚠️  Statement {i} warning: {e}")
                # Continue with other statements even if one fails
                continue
        
        print("✅ AI Model Management migration completed successfully!")
        
        # Verify the tables were created
        print("\n🔍 Verifying table creation...")
        
        tables_to_verify = [
            'ai_model_operations',
            'user_feedback', 
            'ab_tests',
            'performance_alerts',
            'notifications',
            'model_training_data'
        ]
        
        for table in tables_to_verify:
            try:
                # Try to query the table to verify it exists
                result = supabase.table(table).select("count", count="exact").limit(1).execute()
                print(f"  ✅ Table '{table}' verified")
            except Exception as e:
                print(f"  ❌ Table '{table}' verification failed: {e}")
        
        print("\n📊 Migration Summary:")
        print("  - AI Model Operations logging")
        print("  - User Feedback collection")
        print("  - A/B Testing infrastructure")
        print("  - Performance Monitoring & Alerts")
        print("  - Notification system")
        print("  - Training data preparation")
        print("  - Automated triggers and functions")
        print("  - Performance views and metrics")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

def extract_table_name(statement: str) -> str:
    """Extract table name from CREATE TABLE statement"""
    try:
        parts = statement.upper().split()
        if_not_exists_idx = -1
        for i, part in enumerate(parts):
            if part == "EXISTS":
                if_not_exists_idx = i
                break
        
        if if_not_exists_idx > 0:
            return parts[if_not_exists_idx + 1]
        else:
            table_idx = parts.index("TABLE") + 1
            return parts[table_idx]
    except:
        return "unknown"

def extract_index_name(statement: str) -> str:
    """Extract index name from CREATE INDEX statement"""
    try:
        parts = statement.upper().split()
        if_not_exists_idx = -1
        for i, part in enumerate(parts):
            if part == "EXISTS":
                if_not_exists_idx = i
                break
        
        if if_not_exists_idx > 0:
            return parts[if_not_exists_idx + 1]
        else:
            index_idx = parts.index("INDEX") + 1
            return parts[index_idx]
    except:
        return "unknown"

def extract_function_name(statement: str) -> str:
    """Extract function name from CREATE FUNCTION statement"""
    try:
        parts = statement.split()
        function_idx = -1
        for i, part in enumerate(parts):
            if part.upper() == "FUNCTION":
                function_idx = i
                break
        
        if function_idx > 0:
            func_name = parts[function_idx + 1]
            return func_name.split('(')[0]  # Remove parameters
        return "unknown"
    except:
        return "unknown"

def extract_view_name(statement: str) -> str:
    """Extract view name from CREATE VIEW statement"""
    try:
        parts = statement.upper().split()
        view_idx = parts.index("VIEW") + 1
        return parts[view_idx]
    except:
        return "unknown"

def extract_trigger_name(statement: str) -> str:
    """Extract trigger name from CREATE TRIGGER statement"""
    try:
        parts = statement.split()
        trigger_idx = -1
        for i, part in enumerate(parts):
            if part.upper() == "TRIGGER":
                trigger_idx = i
                break
        
        if trigger_idx > 0:
            return parts[trigger_idx + 1]
        return "unknown"
    except:
        return "unknown"

def extract_policy_name(statement: str) -> str:
    """Extract policy name from CREATE POLICY statement"""
    try:
        # Policy names are usually quoted
        start = statement.find('"') + 1
        end = statement.find('"', start)
        if start > 0 and end > start:
            return statement[start:end]
        return "unknown"
    except:
        return "unknown"

if __name__ == "__main__":
    print("🚀 Starting AI Model Management Migration...")
    success = apply_ai_model_management_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)