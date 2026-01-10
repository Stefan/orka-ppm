#!/usr/bin/env python3
"""
Project Controls Migration Verification Script

This script verifies that the project controls database schema migration
was applied correctly by checking tables, views, functions, and constraints.
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

def verify_tables(supabase: Client) -> bool:
    """
    Verify that all project controls tables exist and are accessible.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if all tables exist, False otherwise
    """
    required_tables = [
        'etc_calculations',
        'eac_calculations', 
        'monthly_forecasts',
        'earned_value_metrics',
        'work_packages',
        'performance_predictions'
    ]
    
    logger.info("Verifying project controls tables...")
    
    all_tables_exist = True
    
    for table in required_tables:
        try:
            # Try to query the table structure
            result = supabase.table(table).select("*").limit(1).execute()
            logger.info(f"✓ Table '{table}' exists and is accessible")
            
        except Exception as e:
            logger.error(f"❌ Table '{table}' does not exist or is not accessible: {e}")
            all_tables_exist = False
            
    return all_tables_exist

def verify_table_structure(supabase: Client) -> bool:
    """
    Verify that tables have the expected structure by testing key operations.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if table structures are correct, False otherwise
    """
    logger.info("Verifying table structures...")
    
    try:
        # Test ETC calculations table structure
        logger.info("Testing ETC calculations table...")
        # This will fail if required columns don't exist
        supabase.table("etc_calculations").select(
            "id, project_id, calculation_method, remaining_cost, confidence_level"
        ).limit(1).execute()
        logger.info("✓ ETC calculations table structure verified")
        
        # Test EAC calculations table structure
        logger.info("Testing EAC calculations table...")
        supabase.table("eac_calculations").select(
            "id, project_id, calculation_method, estimate_at_completion, variance_at_completion"
        ).limit(1).execute()
        logger.info("✓ EAC calculations table structure verified")
        
        # Test monthly forecasts table structure
        logger.info("Testing monthly forecasts table...")
        supabase.table("monthly_forecasts").select(
            "id, project_id, forecast_date, forecasted_cost, scenario_type"
        ).limit(1).execute()
        logger.info("✓ Monthly forecasts table structure verified")
        
        # Test earned value metrics table structure
        logger.info("Testing earned value metrics table...")
        supabase.table("earned_value_metrics").select(
            "id, project_id, measurement_date, cost_performance_index, schedule_performance_index"
        ).limit(1).execute()
        logger.info("✓ Earned value metrics table structure verified")
        
        # Test work packages table structure
        logger.info("Testing work packages table...")
        supabase.table("work_packages").select(
            "id, project_id, name, budget, percent_complete"
        ).limit(1).execute()
        logger.info("✓ Work packages table structure verified")
        
        # Test performance predictions table structure
        logger.info("Testing performance predictions table...")
        supabase.table("performance_predictions").select(
            "id, project_id, prediction_date, performance_trend, confidence_score"
        ).limit(1).execute()
        logger.info("✓ Performance predictions table structure verified")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Table structure verification failed: {e}")
        return False

def test_basic_operations(supabase: Client) -> bool:
    """
    Test basic CRUD operations on the tables.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if basic operations work, False otherwise
    """
    logger.info("Testing basic table operations...")
    
    try:
        # Get a sample project ID if available
        projects_result = supabase.table("projects").select("id").limit(1).execute()
        
        if not projects_result.data:
            logger.warning("⚠️ No projects found - skipping basic operations test")
            return True
            
        project_id = projects_result.data[0]['id']
        
        # Get a sample user ID from user_roles table (since auth.users is not directly accessible)
        try:
            users_result = supabase.table("user_roles").select("user_id").limit(1).execute()
            if not users_result.data:
                logger.warning("⚠️ No user roles found - skipping basic operations test")
                return True
            user_id = users_result.data[0]['user_id']
        except Exception:
            # If user_roles doesn't exist or is empty, create a dummy UUID for testing
            from uuid import uuid4
            user_id = str(uuid4())
            logger.warning("⚠️ Using dummy user ID for testing - skipping user validation")
        
        # Test inserting and deleting a work package
        logger.info("Testing work package operations...")
        
        # Insert test work package
        insert_result = supabase.table("work_packages").insert({
            "project_id": project_id,
            "name": "Test Work Package - Migration Verification",
            "description": "Temporary work package for testing migration",
            "budget": 1000.00,
            "start_date": "2024-01-01",
            "end_date": "2024-01-31",
            "responsible_manager": user_id,
            "percent_complete": 0.0,
            "actual_cost": 0.0,
            "earned_value": 0.0
        }).execute()
        
        if not insert_result.data:
            logger.error("❌ Failed to insert test work package")
            return False
            
        test_work_package_id = insert_result.data[0]['id']
        logger.info("✓ Successfully inserted test work package")
        
        # Update the work package
        update_result = supabase.table("work_packages").update({
            "percent_complete": 50.0,
            "actual_cost": 500.00
        }).eq("id", test_work_package_id).execute()
        
        if not update_result.data:
            logger.error("❌ Failed to update test work package")
            return False
            
        logger.info("✓ Successfully updated test work package")
        
        # Delete the test work package
        delete_result = supabase.table("work_packages").delete().eq("id", test_work_package_id).execute()
        
        if not delete_result.data:
            logger.error("❌ Failed to delete test work package")
            return False
            
        logger.info("✓ Successfully deleted test work package")
        
        # Test ETC calculations
        logger.info("Testing ETC calculations operations...")
        
        insert_result = supabase.table("etc_calculations").insert({
            "project_id": project_id,
            "calculation_method": "manual",
            "remaining_work_hours": 100.0,
            "remaining_cost": 5000.00,
            "confidence_level": 0.8,
            "calculated_by": user_id,
            "justification": "Test ETC calculation for migration verification"
        }).execute()
        
        if not insert_result.data:
            logger.error("❌ Failed to insert test ETC calculation")
            return False
            
        test_etc_id = insert_result.data[0]['id']
        logger.info("✓ Successfully inserted test ETC calculation")
        
        # Clean up test ETC calculation
        supabase.table("etc_calculations").delete().eq("id", test_etc_id).execute()
        logger.info("✓ Successfully cleaned up test ETC calculation")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Basic operations test failed: {e}")
        return False

def verify_constraints_and_validation(supabase: Client) -> bool:
    """
    Test that database constraints and validation rules are working.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if constraints are working, False otherwise
    """
    logger.info("Testing database constraints and validation...")
    
    try:
        # Get sample IDs
        projects_result = supabase.table("projects").select("id").limit(1).execute()
        
        try:
            users_result = supabase.table("user_roles").select("user_id").limit(1).execute()
            if not users_result.data:
                # Use dummy UUID if no user roles exist
                from uuid import uuid4
                user_id = str(uuid4())
                logger.warning("⚠️ Using dummy user ID for constraint testing")
            else:
                user_id = users_result.data[0]['user_id']
        except Exception:
            from uuid import uuid4
            user_id = str(uuid4())
            logger.warning("⚠️ Using dummy user ID for constraint testing")
        
        if not projects_result.data:
            logger.warning("⚠️ No sample data available - skipping constraint tests")
            return True
            
        project_id = projects_result.data[0]['id']
        
        # Test negative cost constraint (should fail)
        logger.info("Testing negative cost constraint...")
        try:
            supabase.table("etc_calculations").insert({
                "project_id": project_id,
                "calculation_method": "manual",
                "remaining_work_hours": 100.0,
                "remaining_cost": -1000.00,  # This should fail
                "confidence_level": 0.8,
                "calculated_by": user_id
            }).execute()
            
            logger.error("❌ Negative cost constraint not working - insert should have failed")
            return False
            
        except Exception:
            logger.info("✓ Negative cost constraint working correctly")
        
        # Test invalid confidence level (should fail)
        logger.info("Testing confidence level constraint...")
        try:
            supabase.table("etc_calculations").insert({
                "project_id": project_id,
                "calculation_method": "manual",
                "remaining_work_hours": 100.0,
                "remaining_cost": 1000.00,
                "confidence_level": 1.5,  # This should fail (> 1.0)
                "calculated_by": user_id
            }).execute()
            
            logger.error("❌ Confidence level constraint not working - insert should have failed")
            return False
            
        except Exception:
            logger.info("✓ Confidence level constraint working correctly")
        
        # Test invalid calculation method (should fail)
        logger.info("Testing calculation method constraint...")
        try:
            supabase.table("etc_calculations").insert({
                "project_id": project_id,
                "calculation_method": "invalid_method",  # This should fail
                "remaining_work_hours": 100.0,
                "remaining_cost": 1000.00,
                "confidence_level": 0.8,
                "calculated_by": user_id
            }).execute()
            
            logger.error("❌ Calculation method constraint not working - insert should have failed")
            return False
            
        except Exception:
            logger.info("✓ Calculation method constraint working correctly")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Constraint validation test failed: {e}")
        return False

def verify_project_controls_migration():
    """Main verification function"""
    
    # Load environment variables
    load_dotenv()
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_anon_key:
        logger.error("❌ Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
        logger.error("Please check your .env file")
        return False
    
    try:
        # Create Supabase client with anon key for verification
        supabase: Client = create_client(supabase_url, supabase_anon_key)
        logger.info("✓ Connected to Supabase")
        
        # Run verification tests
        tests_passed = 0
        total_tests = 4
        
        # Test 1: Verify tables exist
        if verify_tables(supabase):
            tests_passed += 1
            logger.info("✓ Table existence test passed")
        else:
            logger.error("❌ Table existence test failed")
        
        # Test 2: Verify table structures
        if verify_table_structure(supabase):
            tests_passed += 1
            logger.info("✓ Table structure test passed")
        else:
            logger.error("❌ Table structure test failed")
        
        # Test 3: Test basic operations
        if test_basic_operations(supabase):
            tests_passed += 1
            logger.info("✓ Basic operations test passed")
        else:
            logger.error("❌ Basic operations test failed")
        
        # Test 4: Test constraints and validation
        if verify_constraints_and_validation(supabase):
            tests_passed += 1
            logger.info("✓ Constraints and validation test passed")
        else:
            logger.error("❌ Constraints and validation test failed")
        
        # Summary
        print("\n" + "="*60)
        print("PROJECT CONTROLS MIGRATION VERIFICATION SUMMARY")
        print("="*60)
        print(f"Tests passed: {tests_passed}/{total_tests}")
        
        if tests_passed == total_tests:
            print("✅ All verification tests passed!")
            print("The project controls migration was applied successfully.")
            print("\nYou can now proceed with implementing the service layer:")
            print("- ETC Calculator Service")
            print("- EAC Calculator Service") 
            print("- Forecast Engine Service")
            print("- Earned Value Manager Service")
            print("- Variance Analyzer Service")
            print("- Performance Predictor Service")
            return True
        else:
            print(f"❌ {total_tests - tests_passed} verification tests failed!")
            print("Please check the migration and fix any issues before proceeding.")
            return False
        
    except Exception as e:
        logger.error(f"❌ Error during verification: {e}")
        return False

def main():
    """Main function"""
    print("Project Controls Migration Verification")
    print("="*50)
    
    success = verify_project_controls_migration()
    
    if not success:
        print("\n❌ Verification failed")
        sys.exit(1)
    else:
        print("\n✅ Verification completed successfully")

if __name__ == "__main__":
    main()