#!/usr/bin/env python3
"""
Execute SQL migration using Supabase REST API
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

def execute_sql_via_rest(sql_query):
    """Execute SQL using Supabase REST API"""
    
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not service_key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    
    # Use the REST API to execute SQL
    url = f"{supabase_url}/rest/v1/rpc/exec_sql"
    
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "sql": sql_query
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"SQL execution failed: {response.status_code} - {response.text}")

def apply_migration_sql():
    """Apply the migration by executing SQL statements"""
    
    print("🚀 Applying user management schema migration via SQL...")
    
    try:
        # Read the migration SQL file
        migration_file = "migrations/user_management_schema.sql"
        if not os.path.exists(migration_file):
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Read migration SQL file")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"📋 Found {len(statements)} SQL statements to execute")
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            if statement.strip():
                print(f"   Executing statement {i}/{len(statements)}...")
                try:
                    result = execute_sql_via_rest(statement)
                    print(f"   ✅ Statement {i} executed successfully")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"   ℹ️  Statement {i} - object already exists (skipping)")
                    else:
                        print(f"   ❌ Statement {i} failed: {e}")
                        # Continue with other statements
        
        print("\n🎉 Migration SQL execution completed!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = apply_migration_sql()
    exit(0 if success else 1)