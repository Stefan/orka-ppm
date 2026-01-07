#!/usr/bin/env python3
"""
Add sample financial tracking data for variance testing
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    
    return create_client(url, service_key)

def add_sample_data():
    """Add sample financial tracking data"""
    try:
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Sample financial tracking data with different variance scenarios
        sample_data = [
            {
                "project_id": "9529942c-45b0-43b6-8804-83e6caf4b560",  # Test Project
                "category": "Development",
                "description": "Software development costs",
                "planned_amount": 100000.00,
                "actual_amount": 95000.00,  # Under budget
                "currency": "USD",
                "date_incurred": "2024-01-15"
            },
            {
                "project_id": "d8d1e878-c9ce-4fed-bfe1-082ee81a504f",  # Customer Portal Redesign
                "category": "Infrastructure", 
                "description": "Cloud infrastructure costs",
                "planned_amount": 75000.00,
                "actual_amount": 82000.00,  # Over budget
                "currency": "USD",
                "date_incurred": "2024-01-20"
            },
            {
                "project_id": "1a8506b4-3b35-40cd-8d4c-105ec1826578",  # API Modernization
                "category": "Marketing",
                "description": "Marketing campaign costs",
                "planned_amount": 50000.00,
                "actual_amount": 51000.00,  # Slightly over budget
                "currency": "USD",
                "date_incurred": "2024-01-25"
            },
            {
                "project_id": "0eb89050-129e-445c-84c5-6cd86dfeaf8f",  # Security Audit
                "category": "Operations",
                "description": "Operational expenses",
                "planned_amount": 120000.00,
                "actual_amount": 115000.00,  # Under budget
                "currency": "USD",
                "date_incurred": "2024-02-01"
            },
            {
                "project_id": "43ec16eb-4299-4a44-aa11-1ce624880563",  # Test Project 2
                "category": "Support",
                "description": "Customer support costs",
                "planned_amount": 80000.00,
                "actual_amount": 88000.00,  # Over budget
                "currency": "USD",
                "date_incurred": "2024-02-10"
            }
        ]
        
        # Insert sample data
        for data in sample_data:
            try:
                result = supabase.table("financial_tracking").insert(data).execute()
                if result.data:
                    print(f"✓ Added sample data for {data['project_id']}")
                else:
                    print(f"⚠️ Failed to add data for {data['project_id']}")
            except Exception as e:
                print(f"⚠️ Error adding {data['project_id']}: {str(e)}")
        
        # Verify the data was added
        result = supabase.table("financial_tracking").select("*").execute()
        print(f"\n📊 Total financial_tracking records: {len(result.data)}")
        
        # Show sample of the data
        print("\n💰 Sample financial tracking data:")
        for record in result.data[:3]:
            planned = record.get('planned_amount', 0)
            actual = record.get('actual_amount', 0)
            variance = actual - planned
            print(f"   - {record.get('category')}: Planned ${planned:,.2f}, Actual ${actual:,.2f}, Variance ${variance:,.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    success = add_sample_data()
    sys.exit(0 if success else 1)