#!/usr/bin/env python3
"""
Apply Performance Optimization Migration

This script applies the performance optimization migration including:
- Creating performance indexes
- Setting up materialized views
- Creating archive tables
- Installing maintenance functions
"""

import asyncio
import logging
from pathlib import Path
from config.database import supabase
from config.settings import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def apply_performance_optimization():
    """Apply the performance optimization migration"""
    
    if not supabase:
        logger.error("Database connection not available")
        return False
    
    try:
        # Read the migration SQL file
        migration_file = Path(__file__).parent / "migrations" / "016_performance_optimization.sql"
        
        if not migration_file.exists():
            logger.error(f"Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        logger.info("Starting performance optimization migration...")
        
        # Split the SQL into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        successful_statements = 0
        failed_statements = 0
        
        for i, statement in enumerate(statements, 1):
            # Skip comments and empty statements
            if statement.startswith('--') or statement.startswith('/*') or not statement:
                continue
            
            try:
                logger.info(f"Executing statement {i}/{len(statements)}")
                
                # Execute the statement
                result = supabase.rpc("execute_sql", {"sql": statement}).execute()
                
                successful_statements += 1
                logger.debug(f"Successfully executed statement {i}")
                
            except Exception as e:
                error_msg = str(e)
                
                # Some errors are expected (like "already exists")
                if any(phrase in error_msg.lower() for phrase in [
                    "already exists", 
                    "does not exist",
                    "relation already exists"
                ]):
                    logger.info(f"Statement {i} - Expected condition: {error_msg}")
                    successful_statements += 1
                else:
                    logger.error(f"Failed to execute statement {i}: {error_msg}")
                    logger.debug(f"Failed statement: {statement[:100]}...")
                    failed_statements += 1
        
        logger.info(f"Migration completed: {successful_statements} successful, {failed_statements} failed")
        
        if failed_statements == 0:
            logger.info("✅ Performance optimization migration completed successfully!")
            return True
        else:
            logger.warning(f"⚠️ Migration completed with {failed_statements} failures")
            return False
            
    except Exception as e:
        logger.error(f"Error applying performance optimization migration: {e}")
        return False

async def verify_optimization():
    """Verify that the optimization was applied correctly"""
    
    try:
        logger.info("Verifying performance optimization...")
        
        # Check if key indexes exist
        index_checks = [
            "idx_change_requests_project_status",
            "idx_change_approvals_approver_decision", 
            "idx_change_audit_log_performed_at_type"
        ]
        
        for index_name in index_checks:
            try:
                # Check if index exists
                result = supabase.rpc("execute_sql", {
                    "sql": f"""
                    SELECT indexname FROM pg_indexes 
                    WHERE indexname = '{index_name}' 
                    LIMIT 1
                    """
                }).execute()
                
                if result.data:
                    logger.info(f"✅ Index {index_name} exists")
                else:
                    logger.warning(f"⚠️ Index {index_name} not found")
                    
            except Exception as e:
                logger.error(f"Error checking index {index_name}: {e}")
        
        # Check if materialized view exists
        try:
            result = supabase.rpc("execute_sql", {
                "sql": "SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_change_requests_summary'"
            }).execute()
            
            if result.data:
                logger.info("✅ Materialized view mv_change_requests_summary exists")
            else:
                logger.warning("⚠️ Materialized view mv_change_requests_summary not found")
                
        except Exception as e:
            logger.error(f"Error checking materialized view: {e}")
        
        # Check if maintenance functions exist
        function_checks = [
            "refresh_change_management_views",
            "cleanup_old_change_records",
            "get_change_management_table_stats"
        ]
        
        for function_name in function_checks:
            try:
                result = supabase.rpc("execute_sql", {
                    "sql": f"""
                    SELECT proname FROM pg_proc 
                    WHERE proname = '{function_name}' 
                    LIMIT 1
                    """
                }).execute()
                
                if result.data:
                    logger.info(f"✅ Function {function_name} exists")
                else:
                    logger.warning(f"⚠️ Function {function_name} not found")
                    
            except Exception as e:
                logger.error(f"Error checking function {function_name}: {e}")
        
        logger.info("Verification completed")
        return True
        
    except Exception as e:
        logger.error(f"Error during verification: {e}")
        return False

async def get_table_statistics():
    """Get statistics about change management tables"""
    
    try:
        logger.info("Getting table statistics...")
        
        # Use the new function to get table stats
        result = supabase.rpc("get_change_management_table_stats").execute()
        
        if result.data:
            logger.info("📊 Table Statistics:")
            for row in result.data:
                logger.info(f"  {row['table_name']}: {row['row_count']} rows, "
                          f"Table: {row['table_size']}, Indexes: {row['index_size']}")
        else:
            logger.warning("No table statistics available")
            
    except Exception as e:
        logger.error(f"Error getting table statistics: {e}")

async def main():
    """Main function to run the performance optimization"""
    
    logger.info("🚀 Starting Change Management Performance Optimization")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Database URL configured: {bool(settings.SUPABASE_URL)}")
    
    # Apply the optimization
    success = await apply_performance_optimization()
    
    if success:
        # Verify the optimization
        await verify_optimization()
        
        # Get table statistics
        await get_table_statistics()
        
        logger.info("🎉 Performance optimization completed successfully!")
    else:
        logger.error("❌ Performance optimization failed")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())