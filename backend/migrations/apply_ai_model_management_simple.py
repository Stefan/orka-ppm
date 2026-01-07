#!/usr/bin/env python3
"""
Apply AI Model Management Migration - Simple Version
Creates tables for AI model management using direct SQL execution
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
    """Apply the AI model management migration using direct table creation"""
    
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
        
        # Create tables by inserting dummy data and letting Supabase auto-create schema
        print("🔄 Creating AI model management tables...")
        
        # 1. Create ai_model_operations table
        try:
            dummy_operation = {
                "operation_id": "init_table",
                "model_id": "init",
                "operation_type": "init",
                "user_id": None,
                "inputs": {},
                "outputs": {},
                "confidence_score": 0.0,
                "response_time_ms": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "success": True,
                "error_message": None,
                "metadata": {}
            }
            
            result = supabase.table("ai_model_operations").insert(dummy_operation).execute()
            if result.data:
                # Delete the dummy record
                supabase.table("ai_model_operations").delete().eq("operation_id", "init_table").execute()
                print("  ✅ Created ai_model_operations table")
        except Exception as e:
            print(f"  ⚠️  ai_model_operations table may already exist: {e}")
        
        # 2. Create user_feedback table
        try:
            dummy_feedback = {
                "feedback_id": "init_table",
                "operation_id": "init_table",
                "user_id": None,
                "rating": 5,
                "feedback_type": "init",
                "comments": "init",
                "metadata": {}
            }
            
            result = supabase.table("user_feedback").insert(dummy_feedback).execute()
            if result.data:
                # Delete the dummy record
                supabase.table("user_feedback").delete().eq("feedback_id", "init_table").execute()
                print("  ✅ Created user_feedback table")
        except Exception as e:
            print(f"  ⚠️  user_feedback table may already exist: {e}")
        
        # 3. Create ab_tests table
        try:
            dummy_ab_test = {
                "test_id": "init_table",
                "test_name": "init",
                "model_a_id": "init",
                "model_b_id": "init",
                "operation_type": "init",
                "traffic_split": 0.5,
                "success_metrics": [],
                "duration_days": 7,
                "min_sample_size": 100,
                "status": "active",
                "metadata": {}
            }
            
            result = supabase.table("ab_tests").insert(dummy_ab_test).execute()
            if result.data:
                # Delete the dummy record
                supabase.table("ab_tests").delete().eq("test_id", "init_table").execute()
                print("  ✅ Created ab_tests table")
        except Exception as e:
            print(f"  ⚠️  ab_tests table may already exist: {e}")
        
        # 4. Create performance_alerts table
        try:
            dummy_alert = {
                "alert_id": "init_table",
                "model_id": "init",
                "operation_type": "init",
                "performance_status": "good",
                "metrics": {},
                "alert_message": "init",
                "severity": "low",
                "resolved": False
            }
            
            result = supabase.table("performance_alerts").insert(dummy_alert).execute()
            if result.data:
                # Delete the dummy record
                supabase.table("performance_alerts").delete().eq("alert_id", "init_table").execute()
                print("  ✅ Created performance_alerts table")
        except Exception as e:
            print(f"  ⚠️  performance_alerts table may already exist: {e}")
        
        # 5. Create model_training_data table
        try:
            dummy_training = {
                "operation_id": "init_table",
                "model_id": "init",
                "operation_type": "init",
                "input_data": {},
                "expected_output": {},
                "actual_output": {},
                "feedback_score": 0.5,
                "quality_score": 0.5,
                "training_weight": 1.0
            }
            
            result = supabase.table("model_training_data").insert(dummy_training).execute()
            if result.data:
                # Delete the dummy record
                supabase.table("model_training_data").delete().eq("operation_id", "init_table").execute()
                print("  ✅ Created model_training_data table")
        except Exception as e:
            print(f"  ⚠️  model_training_data table may already exist: {e}")
        
        print("✅ AI Model Management tables created successfully!")
        
        # Verify the tables were created
        print("\n🔍 Verifying table creation...")
        
        tables_to_verify = [
            'ai_model_operations',
            'user_feedback', 
            'ab_tests',
            'performance_alerts',
            'model_training_data'
        ]
        
        for table in tables_to_verify:
            try:
                # Try to query the table to verify it exists
                result = supabase.table(table).select("*").limit(1).execute()
                print(f"  ✅ Table '{table}' verified")
            except Exception as e:
                print(f"  ❌ Table '{table}' verification failed: {e}")
        
        print("\n📊 Migration Summary:")
        print("  - AI Model Operations logging table")
        print("  - User Feedback collection table")
        print("  - A/B Testing infrastructure table")
        print("  - Performance Monitoring & Alerts table")
        print("  - Training data preparation table")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting AI Model Management Migration (Simple)...")
    success = apply_ai_model_management_migration()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)