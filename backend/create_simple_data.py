#!/usr/bin/env python3
"""
Create simple test data for the PPM platform
"""
import os
import sys
from datetime import date, datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service role key for admin operations
)

def create_simple_data():
    """Create simple test data"""
    
    print("🚀 Creating simple test data...")
    
    try:
        # 1. Create a test portfolio
        print("\n📁 Creating test portfolio...")
        portfolio_data = {
            "name": "Digital Transformation Initiative",
            "description": "Company-wide digital transformation portfolio"
        }
        
        portfolio_response = supabase.table("portfolios").insert(portfolio_data).execute()
        portfolio_id = portfolio_response.data[0]["id"]
        print(f"✅ Created portfolio: {portfolio_id}")
        
        # 2. Create test resources
        print("\n👥 Creating test resources...")
        resources_data = [
            {
                "name": "Alice Johnson",
                "email": "alice.johnson@company.com",
                "role": "Senior Developer",
                "capacity": 40,
                "availability": 85,
                "hourly_rate": 95.0,
                "skills": ["React", "TypeScript", "Node.js"],
                "location": "New York"
            },
            {
                "name": "Bob Smith",
                "email": "bob.smith@company.com", 
                "role": "Project Manager",
                "capacity": 40,
                "availability": 90,
                "hourly_rate": 85.0,
                "skills": ["Project Management", "Agile"],
                "location": "San Francisco"
            }
        ]
        
        resources_response = supabase.table("resources").insert(resources_data).execute()
        resource_ids = [r["id"] for r in resources_response.data]
        print(f"✅ Created {len(resource_ids)} resources")
        
        # 3. Create simple projects - one at a time to identify the issue
        print("\n📊 Creating test projects...")
        
        # Project 1 - Simple active project
        project1 = {
            "portfolio_id": portfolio_id,
            "name": "Customer Portal Redesign",
            "description": "Complete redesign of customer-facing portal",
            "status": "active",
            "health": "green",
            "budget": 450000.0,
            "actual_cost": 320000.0,
            "start_date": "2024-02-01",
            "end_date": "2024-08-31"
        }
        
        try:
            project1_response = supabase.table("projects").insert(project1).execute()
            project1_id = project1_response.data[0]["id"]
            print(f"✅ Created project 1: {project1_id}")
        except Exception as e:
            print(f"❌ Error creating project 1: {e}")
            return
        
        # Project 2 - Simple planning project
        project2 = {
            "portfolio_id": portfolio_id,
            "name": "API Modernization",
            "description": "Migrate legacy APIs to microservices",
            "status": "planning",
            "health": "green",
            "budget": 680000.0,
            "actual_cost": 45000.0,
            "start_date": "2024-06-01",
            "end_date": "2024-12-31"
        }
        
        try:
            project2_response = supabase.table("projects").insert(project2).execute()
            project2_id = project2_response.data[0]["id"]
            print(f"✅ Created project 2: {project2_id}")
        except Exception as e:
            print(f"❌ Error creating project 2: {e}")
            return
        
        # Project 3 - Completed project
        project3 = {
            "portfolio_id": portfolio_id,
            "name": "Security Audit",
            "description": "Security audit and compliance",
            "status": "completed",
            "health": "green",
            "budget": 280000.0,
            "actual_cost": 265000.0,
            "start_date": "2024-01-01",
            "end_date": "2024-04-30"
        }
        
        try:
            project3_response = supabase.table("projects").insert(project3).execute()
            project3_id = project3_response.data[0]["id"]
            print(f"✅ Created project 3: {project3_id}")
        except Exception as e:
            print(f"❌ Error creating project 3: {e}")
            return
        
        print("\n🎉 Simple test data creation completed successfully!")
        print("\n📊 Summary:")
        print(f"   • 1 Portfolio created")
        print(f"   • {len(resource_ids)} Resources created")
        print(f"   • 3 Projects created")
        
        print(f"\n🔑 Portfolio ID: {portfolio_id}")
        print("You can now refresh the dashboard to see the data!")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_simple_data()