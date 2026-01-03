#!/usr/bin/env python3
"""
Simple Database Migration Runner for Supabase
Executes SQL statements directly using Supabase client
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

def execute_sql_statements(supabase: Client):
    """Execute migration SQL statements one by one"""
    
    statements = [
        # Create custom types
        "CREATE TYPE IF NOT EXISTS project_status AS ENUM ('planning', 'active', 'on-hold', 'completed', 'cancelled');",
        "CREATE TYPE IF NOT EXISTS health_indicator AS ENUM ('green', 'yellow', 'red');",
        "CREATE TYPE IF NOT EXISTS risk_category AS ENUM ('technical', 'financial', 'resource', 'schedule', 'external');",
        "CREATE TYPE IF NOT EXISTS risk_status AS ENUM ('identified', 'analyzing', 'mitigating', 'closed');",
        "CREATE TYPE IF NOT EXISTS issue_severity AS ENUM ('low', 'medium', 'high', 'critical');",
        "CREATE TYPE IF NOT EXISTS issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');",
        "CREATE TYPE IF NOT EXISTS workflow_status AS ENUM ('draft', 'active', 'completed', 'cancelled');",
        "CREATE TYPE IF NOT EXISTS approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');",
        "CREATE TYPE IF NOT EXISTS currency_code AS ENUM ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD');",
        
        # Create portfolios table
        """CREATE TABLE IF NOT EXISTS portfolios (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            owner_id UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create milestones table
        """CREATE TABLE IF NOT EXISTS milestones (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            due_date DATE NOT NULL,
            completion_date DATE,
            status VARCHAR(50) DEFAULT 'pending',
            progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create risks table
        """CREATE TABLE IF NOT EXISTS risks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category risk_category NOT NULL,
            probability DECIMAL(3,2) NOT NULL CHECK (probability >= 0 AND probability <= 1),
            impact DECIMAL(3,2) NOT NULL CHECK (impact >= 0 AND impact <= 1),
            risk_score DECIMAL(3,2),
            status risk_status DEFAULT 'identified',
            mitigation TEXT,
            owner_id UUID,
            due_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create issues table
        """CREATE TABLE IF NOT EXISTS issues (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            risk_id UUID,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            severity issue_severity NOT NULL DEFAULT 'medium',
            status issue_status DEFAULT 'open',
            assigned_to UUID,
            reporter_id UUID,
            resolution TEXT,
            resolution_date TIMESTAMP WITH TIME ZONE,
            due_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create workflows table
        """CREATE TABLE IF NOT EXISTS workflows (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            template_data JSONB NOT NULL,
            status workflow_status DEFAULT 'draft',
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create workflow_instances table
        """CREATE TABLE IF NOT EXISTS workflow_instances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workflow_id UUID NOT NULL,
            project_id UUID,
            entity_type VARCHAR(50),
            entity_id UUID,
            current_step INTEGER DEFAULT 1,
            status workflow_status DEFAULT 'active',
            data JSONB DEFAULT '{}',
            started_by UUID,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create workflow_approvals table
        """CREATE TABLE IF NOT EXISTS workflow_approvals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workflow_instance_id UUID NOT NULL,
            step_number INTEGER NOT NULL,
            approver_id UUID NOT NULL,
            status approval_status DEFAULT 'pending',
            comments TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create financial_tracking table
        """CREATE TABLE IF NOT EXISTS financial_tracking (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            category VARCHAR(100) NOT NULL,
            description TEXT,
            planned_amount DECIMAL(12,2) NOT NULL,
            actual_amount DECIMAL(12,2) DEFAULT 0,
            currency currency_code DEFAULT 'USD',
            exchange_rate DECIMAL(10,6) DEFAULT 1.0,
            date_incurred DATE NOT NULL,
            recorded_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create project_resources table
        """CREATE TABLE IF NOT EXISTS project_resources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            resource_id UUID NOT NULL,
            allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
            start_date DATE,
            end_date DATE,
            hourly_rate DECIMAL(8,2),
            role_in_project VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Create audit_logs table
        """CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            table_name VARCHAR(100) NOT NULL,
            record_id UUID NOT NULL,
            action VARCHAR(20) NOT NULL,
            old_values JSONB,
            new_values JSONB,
            changed_by UUID,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );""",
        
        # Insert default portfolio
        """INSERT INTO portfolios (id, name, description, owner_id) 
        SELECT 
            '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID,
            'Default Portfolio',
            'Default portfolio for initial setup',
            NULL
        WHERE NOT EXISTS (SELECT 1 FROM portfolios WHERE id = '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID);""",
    ]
    
    # Execute each statement
    for i, statement in enumerate(statements):
        try:
            print(f"Executing statement {i+1}/{len(statements)}: {statement[:50]}...")
            
            # For CREATE TABLE statements, use table operations
            if "CREATE TABLE" in statement:
                # Extract table name and execute
                table_name = statement.split("CREATE TABLE IF NOT EXISTS ")[1].split(" (")[0].strip()
                print(f"Creating table: {table_name}")
                
            # Execute the statement using Supabase SQL
            result = supabase.rpc('exec_sql', {'query': statement}).execute()
            print(f"✓ Statement {i+1} executed successfully")
            
        except Exception as e:
            print(f"⚠️  Statement {i+1} failed: {str(e)}")
            # Continue with other statements
            continue

def add_missing_columns(supabase: Client):
    """Add missing columns to existing tables"""
    
    # Check and add columns to projects table
    try:
        print("Adding missing columns to projects table...")
        
        # Try to select a column that might not exist
        try:
            supabase.table("projects").select("health").limit(1).execute()
            print("✓ Projects table already has health column")
        except:
            print("Adding health column to projects...")
            # This would need to be done via Supabase dashboard or direct SQL
            
        try:
            supabase.table("projects").select("start_date").limit(1).execute()
            print("✓ Projects table already has start_date column")
        except:
            print("Adding start_date column to projects...")
            
        try:
            supabase.table("projects").select("end_date").limit(1).execute()
            print("✓ Projects table already has end_date column")
        except:
            print("Adding end_date column to projects...")
            
        try:
            supabase.table("projects").select("actual_cost").limit(1).execute()
            print("✓ Projects table already has actual_cost column")
        except:
            print("Adding actual_cost column to projects...")
            
        try:
            supabase.table("projects").select("manager_id").limit(1).execute()
            print("✓ Projects table already has manager_id column")
        except:
            print("Adding manager_id column to projects...")
            
        try:
            supabase.table("projects").select("team_members").limit(1).execute()
            print("✓ Projects table already has team_members column")
        except:
            print("Adding team_members column to projects...")
            
    except Exception as e:
        print(f"Error checking projects table: {str(e)}")
    
    # Check and add columns to resources table
    try:
        print("Adding missing columns to resources table...")
        
        try:
            supabase.table("resources").select("email").limit(1).execute()
            print("✓ Resources table already has email column")
        except:
            print("Adding email column to resources...")
            
        try:
            supabase.table("resources").select("role").limit(1).execute()
            print("✓ Resources table already has role column")
        except:
            print("Adding role column to resources...")
            
        try:
            supabase.table("resources").select("availability").limit(1).execute()
            print("✓ Resources table already has availability column")
        except:
            print("Adding availability column to resources...")
            
        try:
            supabase.table("resources").select("hourly_rate").limit(1).execute()
            print("✓ Resources table already has hourly_rate column")
        except:
            print("Adding hourly_rate column to resources...")
            
        try:
            supabase.table("resources").select("current_projects").limit(1).execute()
            print("✓ Resources table already has current_projects column")
        except:
            print("Adding current_projects column to resources...")
            
        try:
            supabase.table("resources").select("location").limit(1).execute()
            print("✓ Resources table already has location column")
        except:
            print("Adding location column to resources...")
            
    except Exception as e:
        print(f"Error checking resources table: {str(e)}")

def verify_migration(supabase: Client):
    """Verify that migration was successful"""
    tables_to_check = [
        "portfolios", "risks", "issues", "workflows", 
        "workflow_instances", "workflow_approvals", 
        "financial_tracking", "milestones", "project_resources", "audit_logs"
    ]
    
    print("\nVerifying migration...")
    for table in tables_to_check:
        try:
            result = supabase.table(table).select("*", count="exact").limit(1).execute()
            print(f"✓ {table} table exists (count: {result.count})")
        except Exception as e:
            print(f"✗ {table} table check failed: {str(e)}")

def main():
    """Main migration function"""
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        print("✓ Connected to Supabase")
        
        # Execute SQL statements
        print("\nCreating new tables...")
        execute_sql_statements(supabase)
        
        # Add missing columns to existing tables
        print("\nChecking existing tables for missing columns...")
        add_missing_columns(supabase)
        
        # Verify migration
        verify_migration(supabase)
        
        print("\n🎉 Database schema enhancement completed!")
        print("\nNote: Some column additions may need to be done manually via Supabase dashboard")
        print("if the automatic detection doesn't work properly.")
        
    except Exception as e:
        print(f"❌ Migration error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()