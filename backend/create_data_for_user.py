#!/usr/bin/env python3
"""
Create test data for a specific user in the PPM platform
"""
import os
import sys
from datetime import date, datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import uuid

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Use service role key for admin operations
)

def create_data_for_user(user_email="stefan.krause@gmail.com"):
    """Create test data for a specific user"""
    
    print(f"🚀 Creating test data for user: {user_email}")
    
    try:
        # 1. Create test data without specific user ownership
        print(f"\n📁 Creating test portfolio...")
        user_id = None  # We'll create data without specific user ownership
        portfolio_data = {
            "name": "Digital Transformation Initiative",
            "description": "Company-wide digital transformation portfolio"
        }
        
        if user_id:
            portfolio_data["owner_id"] = user_id
        
        portfolio_response = supabase.table("portfolios").insert(portfolio_data).execute()
        portfolio_id = portfolio_response.data[0]["id"]
        print(f"✅ Created portfolio: {portfolio_id}")
        
        # 3. Create test resources
        print("\n👥 Creating test resources...")
        resources_data = [
            {
                "name": "Alice Johnson",
                "email": "alice.johnson@company.com",
                "role": "Senior Developer",
                "capacity": 40,
                "availability": 85,
                "hourly_rate": 95.0,
                "skills": ["React", "TypeScript", "Node.js", "Python", "AWS"],
                "location": "New York"
            },
            {
                "name": "Bob Smith",
                "email": "bob.smith@company.com", 
                "role": "Project Manager",
                "capacity": 40,
                "availability": 90,
                "hourly_rate": 85.0,
                "skills": ["Project Management", "Agile", "Scrum", "Risk Management"],
                "location": "San Francisco"
            },
            {
                "name": "Carol Davis",
                "email": "carol.davis@company.com",
                "role": "UX Designer",
                "capacity": 35,
                "availability": 75,
                "hourly_rate": 80.0,
                "skills": ["UI/UX Design", "Figma", "User Research", "Prototyping"],
                "location": "Remote"
            },
            {
                "name": "David Wilson",
                "email": "david.wilson@company.com",
                "role": "DevOps Engineer", 
                "capacity": 40,
                "availability": 95,
                "hourly_rate": 100.0,
                "skills": ["Docker", "Kubernetes", "AWS", "CI/CD", "Terraform"],
                "location": "Austin"
            },
            {
                "name": "Eva Martinez",
                "email": "eva.martinez@company.com",
                "role": "Data Analyst",
                "capacity": 40,
                "availability": 60,
                "hourly_rate": 75.0,
                "skills": ["Python", "SQL", "Tableau", "Data Analysis", "Machine Learning"],
                "location": "Chicago"
            }
        ]
        
        resources_response = supabase.table("resources").insert(resources_data).execute()
        resource_ids = [r["id"] for r in resources_response.data]
        print(f"✅ Created {len(resource_ids)} resources")
        
        # 4. Create test projects with different statuses and health
        print("\n📊 Creating test projects...")
        projects_data = [
            {
                "portfolio_id": portfolio_id,
                "name": "Customer Portal Redesign",
                "description": "Complete redesign of customer-facing portal with modern UI/UX",
                "status": "active",
                "health": "green",
                "budget": 450000.0,
                "actual_cost": 320000.0,
                "start_date": "2024-02-01",
                "end_date": "2024-08-31",
                "manager_id": resource_ids[1],  # Bob Smith
                "team_members": [resource_ids[0], resource_ids[2]]  # Alice, Carol
            },
            {
                "portfolio_id": portfolio_id,
                "name": "API Modernization",
                "description": "Migrate legacy APIs to modern microservices architecture",
                "status": "active", 
                "health": "yellow",
                "budget": 680000.0,
                "actual_cost": 580000.0,
                "start_date": "2024-01-15",
                "end_date": "2024-09-30",
                "manager_id": resource_ids[1],  # Bob Smith
                "team_members": [resource_ids[0], resource_ids[3]]  # Alice, David
            },
            {
                "portfolio_id": portfolio_id,
                "name": "Data Analytics Platform",
                "description": "Build comprehensive analytics platform for business intelligence",
                "status": "planning",
                "health": "green", 
                "budget": 750000.0,
                "actual_cost": 45000.0,
                "start_date": "2024-06-01",
                "end_date": "2024-12-31",
                "manager_id": resource_ids[1],  # Bob Smith
                "team_members": [resource_ids[4]]  # Eva
            },
            {
                "portfolio_id": portfolio_id,
                "name": "Mobile App Development",
                "description": "Native mobile applications for iOS and Android",
                "status": "on-hold",
                "health": "red",
                "budget": 520000.0,
                "actual_cost": 180000.0,
                "start_date": "2024-03-01",
                "end_date": "2024-10-31",
                "manager_id": resource_ids[1],  # Bob Smith
                "team_members": [resource_ids[0], resource_ids[2]]  # Alice, Carol
            },
            {
                "portfolio_id": portfolio_id,
                "name": "Security Audit & Compliance",
                "description": "Comprehensive security audit and compliance implementation",
                "status": "completed",
                "health": "green",
                "budget": 280000.0,
                "actual_cost": 265000.0,
                "start_date": "2024-01-01",
                "end_date": "2024-04-30",
                "manager_id": resource_ids[1],  # Bob Smith
                "team_members": [resource_ids[3]]  # David
            }
        ]
        
        projects_response = supabase.table("projects").insert(projects_data).execute()
        project_ids = [p["id"] for p in projects_response.data]
        print(f"✅ Created {len(project_ids)} projects")
        
        # 5. Create milestones for projects
        print("\n🎯 Creating project milestones...")
        milestones_data = []
        
        # Milestones for Customer Portal Redesign
        milestones_data.extend([
            {
                "project_id": project_ids[0],
                "name": "Requirements Gathering",
                "description": "Complete user research and requirements documentation",
                "due_date": "2024-03-15",
                "status": "completed",
                "progress_percentage": 100,
                "completion_date": "2024-03-12"
            },
            {
                "project_id": project_ids[0],
                "name": "UI/UX Design",
                "description": "Create wireframes and high-fidelity designs",
                "due_date": "2024-05-01",
                "status": "completed", 
                "progress_percentage": 100,
                "completion_date": "2024-04-28"
            },
            {
                "project_id": project_ids[0],
                "name": "Frontend Development",
                "description": "Implement new UI components and pages",
                "due_date": "2024-07-15",
                "status": "in_progress",
                "progress_percentage": 75
            }
        ])
        
        # Milestones for API Modernization
        milestones_data.extend([
            {
                "project_id": project_ids[1],
                "name": "Legacy API Analysis",
                "description": "Analyze existing APIs and dependencies",
                "due_date": "2024-02-28",
                "status": "completed",
                "progress_percentage": 100,
                "completion_date": "2024-02-25"
            },
            {
                "project_id": project_ids[1],
                "name": "Microservices Architecture",
                "description": "Design new microservices architecture",
                "due_date": "2024-04-30",
                "status": "completed",
                "progress_percentage": 100,
                "completion_date": "2024-05-05"  # Overdue
            }
        ])
        
        supabase.table("milestones").insert(milestones_data).execute()
        print(f"✅ Created {len(milestones_data)} milestones")
        
        # 6. Create some risks
        print("\n⚠️ Creating project risks...")
        risks_data = [
            {
                "project_id": project_ids[0],
                "title": "Third-party API Dependency",
                "description": "Risk of third-party API changes affecting integration",
                "category": "technical",
                "probability": 0.3,
                "impact": 0.7,
                "status": "identified",
                "mitigation": "Implement adapter pattern and fallback mechanisms",
                "owner_id": resource_ids[0],
                "due_date": "2024-07-01"
            },
            {
                "project_id": project_ids[1],
                "title": "Resource Availability",
                "description": "Key developer may be unavailable during critical phase",
                "category": "resource",
                "probability": 0.4,
                "impact": 0.8,
                "status": "mitigating",
                "mitigation": "Cross-training team members and documenting processes",
                "owner_id": resource_ids[1],
                "due_date": "2024-06-15"
            }
        ]
        
        supabase.table("risks").insert(risks_data).execute()
        print(f"✅ Created {len(risks_data)} risks")
        
        print("\n🎉 Test data creation completed successfully!")
        print("\n📊 Summary:")
        print(f"   • 1 Portfolio created")
        print(f"   • {len(resource_ids)} Resources created")
        print(f"   • {len(project_ids)} Projects created")
        print(f"   • {len(milestones_data)} Milestones created")
        print(f"   • {len(risks_data)} Risks created")
        
        print(f"\n🔑 Portfolio ID: {portfolio_id}")
        print("You can now refresh the dashboard to see the data!")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_data_for_user()