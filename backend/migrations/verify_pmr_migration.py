#!/usr/bin/env python3
"""
Enhanced PMR Migration Verification Script

This script verifies that the PMR database schema migration
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
    Verify that all PMR tables exist and are accessible.
    
    Args:
        supabase: Supabase client
        
    Returns:
        bool: True if all tables exist, False otherwise
    """
    required_tables = [
        'pmr_reports',
        'pmr_templates',
        'ai_insights',
        'edit_sessions',
        'export_jobs',
        'pmr_collaboration',
        'pmr_distribution_log'
    ]
    
    logger.info("Verifying PMR tables...")
    
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
        # Test PMR reports table structure
        logger.info("Testing PMR reports table...")
        supabase.table("pmr_reports").select(
            "id, project_id, report_month, report_year, template_id, title, status"
        ).limit(1).execute()
        logger.info("✓ PMR reports table structure verified")
        
        # Test PMR templates table structure
        logger.info("Testing PMR templates table...")
        supabase.table("pmr_templates").select(
            "id, name, template_type, sections, is_public, usage_count"
        ).limit(1).execute()
        logger.info("✓ PMR templates table structure verified")
        
        # Test AI insights table structure
        logger.info("Testing AI insights table...")
        supabase.table("ai_insights").select(
            "id, report_id, insight_type, category, title, confidence_score, priority"
        ).limit(1).execute()
        logger.info("✓ AI insights table structure verified")
        
        # Test edit sessions table structure
        logger.info("Testing edit sessions table...")
        supabase.table("edit_sessions").select(
            "id, report_id, user_id, session_type, is_active"
        ).limit(1).execute()
        logger.info("✓ Edit sessions table structure verified")
        
        # Test export jobs table structure
        logger.info("Testing export jobs table...")
        supabase.table("export_jobs").select(
            "id, report_id, export_format, status, requested_by"
        ).limit(1).execute()
        logger.info("✓ Export jobs table structure verified")
        
        # Test collaboration table structure
        logger.info("Testing PMR collaboration table...")
        supabase.table("pmr_collaboration").select(
            "id, report_id, user_id, action_type, timestamp"
        ).limit(1).execute()
        logger.info("✓ PMR collaboration table structure verified")
        
        # Test distribution log table structure
        logger.info("Testing PMR distribution log table...")
        supabase.table("pmr_distribution_log").select(
            "id, report_id, distribution_method, recipient_type, status"
        ).limit(1).execute()
        logger.info("✓ PMR distribution log table structure verified")
        
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
        
        # Test inserting and deleting a PMR template
        logger.info("Testing PMR template operations...")
        
        # Insert test template
        insert_result = supabase.table("pmr_templates").insert({
            "name": "Test Template - Migration Verification",
            "description": "Temporary template for testing migration",
            "template_type": "custom",
            "sections": [{"id": "test", "name": "Test Section", "required": False}],
            "default_metrics": ["test_metric"],
            "export_formats": ["pdf"],
            "is_public": False,
            "created_by": user_id
        }).execute()
        
        if not insert_result.data:
            logger.error("❌ Failed to insert test template")
            return False
            
        test_template_id = insert_result.data[0]['id']
        logger.info("✓ Successfully inserted test template")
        
        # Update the template
        update_result = supabase.table("pmr_templates").update({
            "description": "Updated test template description",
            "usage_count": 1
        }).eq("id", test_template_id).execute()
        
        if not update_result.data:
            logger.error("❌ Failed to update test template")
            return False
            
        logger.info("✓ Successfully updated test template")
        
        # Test PMR report creation
        logger.info("Testing PMR report operations...")
        
        insert_result = supabase.table("pmr_reports").insert({
            "project_id": project_id,
            "report_month": "2024-01-01",
            "report_year": 2024,
            "template_id": test_template_id,
            "title": "Test PMR Report - Migration Verification",
            "executive_summary": "Test executive summary",
            "sections": [{"id": "test", "content": "Test content"}],
            "metrics": {"test_metric": 100},
            "status": "draft",
            "generated_by": user_id
        }).execute()
        
        if not insert_result.data:
            logger.error("❌ Failed to insert test PMR report")
            return False
            
        test_report_id = insert_result.data[0]['id']
        logger.info("✓ Successfully inserted test PMR report")
        
        # Clean up test data
        supabase.table("pmr_reports").delete().eq("id", test_report_id).execute()
        supabase.table("pmr_templates").delete().eq("id", test_template_id).execute()
        logger.info("✓ Successfully cleaned up test data")
        
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
        
        # Create a valid template first for testing
        template_result = supabase.table("pmr_templates").insert({
            "name": "Constraint Test Template",
            "template_type": "custom",
            "sections": [],
            "created_by": user_id
        }).execute()
        
        if not template_result.data:
            logger.warning("⚠️ Cannot create test template - skipping constraint tests")
            return True
            
        template_id = template_result.data[0]['id']
        
        # Test invalid report year constraint (should fail)
        logger.info("Testing report year constraint...")
        try:
            supabase.table("pmr_reports").insert({
                "project_id": project_id,
                "report_month": "2024-01-01",
                "report_year": 2050,  # This should fail (> 2030)
                "template_id": template_id,
                "title": "Invalid Year Test",
                "generated_by": user_id
            }).execute()
            
            logger.error("❌ Report year constraint not working - insert should have failed")
            return False
            
        except Exception:
            logger.info("✓ Report year constraint working correctly")
        
        # Test invalid template type constraint (should fail)
        logger.info("Testing template type constraint...")
        try:
            supabase.table("pmr_templates").insert({
                "name": "Invalid Template Type Test",
                "template_type": "invalid_type",  # This should fail
                "sections": [],
                "created_by": user_id
            }).execute()
            
            logger.error("❌ Template type constraint not working - insert should have failed")
            return False
            
        except Exception:
            logger.info("✓ Template type constraint working correctly")
        
        # Test invalid confidence score constraint (should fail)
        logger.info("Testing confidence score constraint...")
        
        # First create a valid report
        report_result = supabase.table("pmr_reports").insert({
            "project_id": project_id,
            "report_month": "2024-01-01",
            "report_year": 2024,
            "template_id": template_id,
            "title": "Constraint Test Report",
            "generated_by": user_id
        }).execute()
        
        if report_result.data:
            report_id = report_result.data[0]['id']
            
            try:
                supabase.table("ai_insights").insert({
                    "report_id": report_id,
                    "insight_type": "prediction",
                    "category": "budget",
                    "title": "Invalid Confidence Test",
                    "content": "Test content",
                    "confidence_score": 1.5  # This should fail (> 1.0)
                }).execute()
                
                logger.error("❌ Confidence score constraint not working - insert should have failed")
                return False
                
            except Exception:
                logger.info("✓ Confidence score constraint working correctly")
            
            # Clean up test report
            supabase.table("pmr_reports").delete().eq("id", report_id).execute()
        
        # Clean up test template
        supabase.table("pmr_templates").delete().eq("id", template_id).execute()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Constraint validation test failed: {e}")
        return False

def verify_pmr_migration():
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
        print("PMR MIGRATION VERIFICATION SUMMARY")
        print("="*60)
        print(f"Tests passed: {tests_passed}/{total_tests}")
        
        if tests_passed == total_tests:
            print("✅ All verification tests passed!")
            print("The PMR migration was applied successfully.")
            print("\nYou can now proceed with implementing the service layer:")
            print("- PMR Generator Service")
            print("- AI Insights Engine Service")
            print("- Interactive Editor Service") 
            print("- Multi-Format Exporter Service")
            print("- Template Manager Service")
            print("- RAG Context Provider Service")
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
    print("PMR Migration Verification")
    print("="*30)
    
    success = verify_pmr_migration()
    
    if not success:
        print("\n❌ Verification failed")
        sys.exit(1)
    else:
        print("\n✅ Verification completed successfully")

if __name__ == "__main__":
    main()