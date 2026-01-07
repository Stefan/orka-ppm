#!/usr/bin/env python3
"""
Database Schema Verification Script
Verifies that all required tables and columns exist after migration
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    
    return create_client(url, service_key)

def verify_table_exists(supabase: Client, table_name: str) -> bool:
    """Check if a table exists and is accessible"""
    try:
        result = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        return True
    except Exception as e:
        print(f"✗ Table '{table_name}' check failed: {str(e)}")
        return False

def verify_column_exists(supabase: Client, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    try:
        result = supabase.table(table_name).select(column_name).limit(1).execute()
        return True
    except Exception as e:
        return False

def main():
    """Main verification function"""
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Define required tables
        required_tables = [
            "portfolios",
            "projects", 
            "resources",
            "risks",
            "issues", 
            "workflows",
            "workflow_instances",
            "workflow_approvals",
            "financial_tracking",
            "milestones",
            "project_resources",
            "audit_logs"
        ]
        
        # Define required columns for existing tables
        required_project_columns = [
            "id", "name", "description", "status", "portfolio_id", "budget",
            "health", "start_date", "end_date", "actual_cost", "manager_id", "team_members"
        ]
        
        required_resource_columns = [
            "id", "name", "email", "role", "skills", "capacity", "availability", 
            "hourly_rate", "current_projects", "location"
        ]
        
        print("\n=== Verifying Tables ===")
        tables_ok = True
        for table in required_tables:
            if verify_table_exists(supabase, table):
                print(f"✓ {table}")
            else:
                print(f"✗ {table}")
                tables_ok = False
        
        print("\n=== Verifying Project Table Columns ===")
        projects_ok = True
        for column in required_project_columns:
            if verify_column_exists(supabase, "projects", column):
                print(f"✓ projects.{column}")
            else:
                print(f"✗ projects.{column}")
                projects_ok = False
        
        print("\n=== Verifying Resource Table Columns ===")
        resources_ok = True
        for column in required_resource_columns:
            if verify_column_exists(supabase, "resources", column):
                print(f"✓ resources.{column}")
            else:
                print(f"✗ resources.{column}")
                resources_ok = False
        
        # Test data insertion to verify schema works
        print("\n=== Testing Data Operations ===")
        try:
            # Test portfolio insertion
            portfolio_data = {
                "name": "Test Portfolio",
                "description": "Test portfolio for schema verification"
            }
            result = supabase.table("portfolios").insert(portfolio_data).execute()
            if result.data:
                portfolio_id = result.data[0]["id"]
                print(f"✓ Portfolio creation test passed (ID: {portfolio_id})")
                
                # Clean up test data
                supabase.table("portfolios").delete().eq("id", portfolio_id).execute()
                print("✓ Test data cleanup completed")
            else:
                print("✗ Portfolio creation test failed")
                
        except Exception as e:
            print(f"✗ Data operation test failed: {str(e)}")
        
        # Summary
        print("\n=== Schema Verification Summary ===")
        if tables_ok and projects_ok and resources_ok:
            print("🎉 All schema requirements verified successfully!")
            print("\nThe database schema enhancement is complete and ready for use.")
            return True
        else:
            print("❌ Schema verification failed!")
            print("\nSome tables or columns are missing. Please run the migration SQL script.")
            return False
            
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)