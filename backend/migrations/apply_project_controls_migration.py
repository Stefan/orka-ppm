#!/usr/bin/env python3
"""
Project Controls Migration Application Script

This script applies the project controls database schema migration,
creating tables for ETC, EAC, Earned Value Management, and Forecasting.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_prerequisites(supabase: Client) -> bool:
    """
    Check if prerequisite tables exist before applying migration.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if prerequisites are met, False otherwise
    """
    try:
        # Check if required tables exist by trying to query them
        required_tables = ['projects', 'users']
        
        for table in required_tables:
            try:
                result = supabase.table(table).select("id").limit(1).execute()
                logger.info(f"✓ Table '{table}' exists")
            except Exception as e:
                logger.error(f"❌ Required table '{table}' does not exist or is not accessible: {e}")
                return False
                
        logger.info("✓ All prerequisite tables exist")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error checking prerequisites: {e}")
        return False

def check_existing_tables(supabase: Client) -> dict:
    """
    Check which project controls tables already exist.
    
    Args:
        supabase: Supabase client
        
    Returns:
        dict: Dictionary of table names and their existence status
    """
    project_controls_tables = [
        'etc_calculations',
        'eac_calculations', 
        'monthly_forecasts',
        'earned_value_metrics',
        'work_packages',
        'performance_predictions'
    ]
    
    existing_tables = {}
    
    for table in project_controls_tables:
        try:
            # Try to query the table to see if it exists
            result = supabase.table(table).select("*").limit(1).execute()
            existing_tables[table] = True
            logger.info(f"✓ Table '{table}' already exists")
            
        except Exception:
            existing_tables[table] = False
            logger.info(f"- Table '{table}' does not exist")
            
    return existing_tables

def apply_project_controls_migration():
    """Apply the project controls migration"""
    
    # Load environment variables
    load_dotenv()
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        logger.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        logger.error("Please check your .env file")
        return False
    
    try:
        # Create Supabase client with service role key for admin operations
        supabase: Client = create_client(supabase_url, supabase_service_key)
        logger.info("✓ Connected to Supabase")
        
        # Check prerequisites
        if not check_prerequisites(supabase):
            logger.error("❌ Prerequisites not met - aborting migration")
            return False
            
        # Check existing tables
        existing_tables = check_existing_tables(supabase)
        existing_count = sum(1 for exists in existing_tables.values() if exists)
        
        if existing_count > 0:
            logger.info(f"Found {existing_count} existing project controls tables")
            existing_list = [table for table, exists in existing_tables.items() if exists]
            logger.info(f"Existing tables: {', '.join(existing_list)}")
        
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "020_project_controls_schema.sql"
        
        if not migration_file.exists():
            logger.error(f"❌ Error: Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        logger.info("✓ Read migration SQL file")
        
        # Note: Supabase Python client doesn't support executing DDL directly
        # We need to provide instructions for manual execution
        
        print("\n" + "="*70)
        print("PROJECT CONTROLS MIGRATION - MANUAL EXECUTION REQUIRED")
        print("="*70)
        print("\nThe project controls schema migration cannot be applied automatically.")
        print("Please follow these steps:")
        print("\n1. Open your Supabase project dashboard")
        print("2. Navigate to the SQL Editor (left sidebar)")
        print("3. Copy the contents of: backend/migrations/020_project_controls_schema.sql")
        print("4. Paste into the SQL Editor and click 'Run'")
        print("\nAlternatively, copy and paste this SQL:")
        print("\n" + "-"*70)
        print(migration_sql)
        print("-"*70)
        
        print("\n5. After running the SQL, verify the migration by running:")
        print("   python backend/migrations/verify_project_controls_migration.py")
        
        print("\n6. The migration creates the following tables:")
        for table in ['etc_calculations', 'eac_calculations', 'monthly_forecasts', 
                     'earned_value_metrics', 'work_packages', 'performance_predictions']:
            status = "✓ EXISTS" if existing_tables.get(table, False) else "- NEW"
            print(f"   {status} {table}")
            
        print("\n7. The migration also creates:")
        print("   - Performance indexes for query optimization")
        print("   - Database views: project_controls_summary, performance_trends")
        print("   - Utility functions for calculations")
        print("   - Triggers for data validation and timestamps")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error connecting to Supabase: {e}")
        return False

def main():
    """Main migration function."""
    logger.info("Starting Project Controls migration...")
    
    print("Project Controls Database Migration")
    print("="*50)
    
    success = apply_project_controls_migration()
    
    if success:
        print("\n✓ Migration instructions provided")
        print("Please execute the SQL manually in Supabase SQL Editor")
        print("\nThis migration implements:")
        print("- ETC (Estimate to Complete) calculations")
        print("- EAC (Estimate at Completion) calculations") 
        print("- Monthly financial forecasting")
        print("- Earned Value Management metrics")
        print("- Work package hierarchy management")
        print("- Performance predictions and analytics")
        return True
    else:
        print("\n❌ Migration failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)