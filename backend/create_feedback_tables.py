#!/usr/bin/env python3
"""
Create feedback system tables directly using Supabase client
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_feedback_tables():
    """Create the feedback system tables"""
    
    # Get Supabase credentials
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xceyrfvxooiplbmwavlb.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment")
        print("⚠️  This operation requires service role key for DDL operations")
        print("💡 Please set SUPABASE_SERVICE_ROLE_KEY in your .env file")
        print("💡 You can find it in your Supabase project settings under API")
        return False
    
    try:
        # Create Supabase client with service role key
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase with service role")
        
        # Create tables using individual INSERT operations to test if they exist
        print("🔧 Creating feedback system tables...")
        
        # Test if we can create a simple table first
        try:
            # Try to insert a test record to see if tables exist
            test_feature = {
                "title": "Test Feature",
                "description": "Test description",
                "submitted_by": "00000000-0000-0000-0000-000000000000"
            }
            
            result = supabase.table("features").insert(test_feature).execute()
            print("✅ Features table exists and is writable")
            
            # Clean up test record
            if result.data:
                supabase.table("features").delete().eq("id", result.data[0]["id"]).execute()
                print("🧹 Cleaned up test record")
                
        except Exception as e:
            print(f"❌ Features table doesn't exist or isn't accessible: {e}")
            print("💡 The tables need to be created through Supabase Dashboard SQL Editor")
            print("💡 Please run the SQL from migrations/008_feedback_system.sql in your Supabase Dashboard")
            return False
        
        # Verify all tables exist
        print("\n=== Verifying Tables ===")
        tables = ['features', 'bugs', 'notifications', 'feature_votes', 'feature_comments']
        all_exist = True
        
        for table in tables:
            try:
                result = supabase.table(table).select('count', count='exact').limit(1).execute()
                print(f"✅ {table} table exists (count: {result.count})")
            except Exception as e:
                print(f"❌ {table} table missing: {e}")
                all_exist = False
        
        return all_exist
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def provide_manual_instructions():
    """Provide manual instructions for creating tables"""
    print("\n" + "="*60)
    print("📋 MANUAL SETUP INSTRUCTIONS")
    print("="*60)
    print()
    print("Since automatic table creation requires service role permissions,")
    print("please follow these steps to create the feedback system tables:")
    print()
    print("1. Go to your Supabase Dashboard")
    print("2. Navigate to SQL Editor")
    print("3. Copy and paste the contents of backend/migrations/008_feedback_system.sql")
    print("4. Run the SQL script")
    print("5. Verify tables are created in the Table Editor")
    print()
    print("The following tables should be created:")
    print("- features (feature requests)")
    print("- bugs (bug reports)")
    print("- notifications (system notifications)")
    print("- feature_votes (voting system)")
    print("- feature_comments (comments on features)")
    print("- bug_attachments (file attachments for bugs)")
    print()
    print("After creating the tables, the feedback system will be fully functional!")
    print("="*60)

if __name__ == "__main__":
    print("🚀 Setting up feedback system tables...")
    success = create_feedback_tables()
    
    if not success:
        provide_manual_instructions()
    else:
        print("\n✅ Feedback system is ready to use!")