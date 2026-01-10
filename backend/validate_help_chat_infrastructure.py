#!/usr/bin/env python3
"""
Help Chat Infrastructure Validation Script

Validates the current deployment status and infrastructure readiness
for the Help Chat system.
"""

import os
import sys
import asyncio
import logging
from typing import Dict, List, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logger = logging.getLogger(__name__)

class InfrastructureValidator:
    """Validates Help Chat infrastructure readiness"""
    
    def __init__(self):
        self.results = []
    
    async def validate_infrastructure(self) -> Dict[str, Any]:
        """Run infrastructure validation checks"""
        logger.info("🔧 Validating Help Chat Infrastructure")
        
        # Check environment variables
        env_status = self._check_environment_variables()
        
        # Check database connectivity
        db_status = await self._check_database_connectivity()
        
        # Check database schema
        schema_status = await self._check_database_schema()
        
        # Check API endpoints (if server is running)
        api_status = await self._check_api_endpoints()
        
        # Generate summary
        summary = self._generate_summary(env_status, db_status, schema_status, api_status)
        
        return {
            "environment": env_status,
            "database": db_status,
            "schema": schema_status,
            "api": api_status,
            "summary": summary
        }
    
    def _check_environment_variables(self) -> Dict[str, Any]:
        """Check required environment variables"""
        required_vars = [
            "OPENAI_API_KEY",
            "SUPABASE_URL", 
            "SUPABASE_ANON_KEY"
        ]
        
        optional_vars = [
            "SUPABASE_SERVICE_ROLE_KEY",
            "HELP_CHAT_ENABLED",
            "HELP_CHAT_DEBUG"
        ]
        
        env_status = {
            "required": {},
            "optional": {},
            "all_required_present": True
        }
        
        for var in required_vars:
            value = os.getenv(var)
            is_present = value is not None and len(value.strip()) > 0
            env_status["required"][var] = {
                "present": is_present,
                "value_length": len(value) if value else 0
            }
            if not is_present:
                env_status["all_required_present"] = False
        
        for var in optional_vars:
            value = os.getenv(var)
            env_status["optional"][var] = {
                "present": value is not None,
                "value": value if value else "not_set"
            }
        
        return env_status
    
    async def _check_database_connectivity(self) -> Dict[str, Any]:
        """Check database connectivity"""
        try:
            from config.database import supabase
            
            # Test basic connectivity
            response = supabase.table("portfolios").select("count").limit(1).execute()
            
            return {
                "connected": True,
                "test_query_successful": len(response.data) >= 0,
                "error": None
            }
            
        except Exception as e:
            return {
                "connected": False,
                "test_query_successful": False,
                "error": str(e)
            }
    
    async def _check_database_schema(self) -> Dict[str, Any]:
        """Check if help chat database tables exist"""
        required_tables = [
            "help_sessions",
            "help_messages", 
            "help_feedback",
            "help_analytics",
            "help_content"
        ]
        
        schema_status = {
            "tables": {},
            "all_tables_exist": True,
            "migration_needed": False
        }
        
        try:
            from config.database import supabase
            
            for table in required_tables:
                try:
                    response = supabase.table(table).select("*").limit(1).execute()
                    schema_status["tables"][table] = {
                        "exists": True,
                        "accessible": True,
                        "error": None
                    }
                except Exception as e:
                    schema_status["tables"][table] = {
                        "exists": False,
                        "accessible": False,
                        "error": str(e)
                    }
                    schema_status["all_tables_exist"] = False
                    schema_status["migration_needed"] = True
            
        except Exception as e:
            schema_status["error"] = str(e)
            schema_status["all_tables_exist"] = False
            schema_status["migration_needed"] = True
        
        return schema_status
    
    async def _check_api_endpoints(self) -> Dict[str, Any]:
        """Check if help chat API endpoints are accessible"""
        try:
            import httpx
            
            base_url = "http://localhost:8000"
            endpoints = [
                "/ai/help/query",
                "/ai/help/context",
                "/ai/help/feedback",
                "/ai/help/tips"
            ]
            
            api_status = {
                "server_running": False,
                "endpoints": {},
                "base_url": base_url
            }
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Test if server is running
                try:
                    response = await client.get(f"{base_url}/docs")
                    api_status["server_running"] = response.status_code in [200, 404]  # 404 is OK, means server is running
                except:
                    api_status["server_running"] = False
                
                # Test individual endpoints (expect 401 without auth)
                for endpoint in endpoints:
                    try:
                        response = await client.post(f"{base_url}{endpoint}")
                        api_status["endpoints"][endpoint] = {
                            "accessible": True,
                            "status_code": response.status_code,
                            "requires_auth": response.status_code == 401
                        }
                    except Exception as e:
                        api_status["endpoints"][endpoint] = {
                            "accessible": False,
                            "error": str(e)
                        }
            
            return api_status
            
        except Exception as e:
            return {
                "server_running": False,
                "endpoints": {},
                "error": str(e)
            }
    
    def _generate_summary(self, env_status, db_status, schema_status, api_status) -> Dict[str, Any]:
        """Generate infrastructure readiness summary"""
        
        # Calculate readiness scores
        env_ready = env_status["all_required_present"]
        db_ready = db_status["connected"]
        schema_ready = schema_status["all_tables_exist"]
        api_ready = api_status["server_running"]
        
        readiness_score = sum([env_ready, db_ready, schema_ready, api_ready]) / 4 * 100
        
        # Determine next steps
        next_steps = []
        
        if not env_ready:
            next_steps.append("Configure missing environment variables")
        
        if not db_ready:
            next_steps.append("Fix database connectivity issues")
        
        if not schema_ready:
            next_steps.append("Run database migrations to create help chat tables")
        
        if not api_ready:
            next_steps.append("Start the FastAPI server")
        
        if readiness_score == 100:
            next_steps.append("Infrastructure ready - run full audit suite")
        
        return {
            "readiness_score": readiness_score,
            "environment_ready": env_ready,
            "database_ready": db_ready,
            "schema_ready": schema_ready,
            "api_ready": api_ready,
            "overall_status": "READY" if readiness_score == 100 else "NEEDS_SETUP",
            "next_steps": next_steps
        }


async def main():
    """Main validation function"""
    validator = InfrastructureValidator()
    results = await validator.validate_infrastructure()
    
    print("\n" + "=" * 80)
    print("HELP CHAT INFRASTRUCTURE VALIDATION REPORT")
    print("=" * 80)
    
    # Environment Variables
    print(f"\n🔧 Environment Variables:")
    env = results["environment"]
    print(f"   Status: {'✅ READY' if env['all_required_present'] else '❌ MISSING REQUIRED VARS'}")
    
    for var, status in env["required"].items():
        icon = "✅" if status["present"] else "❌"
        print(f"   {icon} {var}: {'Present' if status['present'] else 'Missing'}")
    
    # Database Connectivity
    print(f"\n🗄️  Database Connectivity:")
    db = results["database"]
    print(f"   Status: {'✅ CONNECTED' if db['connected'] else '❌ CONNECTION FAILED'}")
    if db.get("error"):
        print(f"   Error: {db['error']}")
    
    # Database Schema
    print(f"\n📋 Database Schema:")
    schema = results["schema"]
    print(f"   Status: {'✅ COMPLETE' if schema['all_tables_exist'] else '❌ MISSING TABLES'}")
    
    for table, status in schema["tables"].items():
        icon = "✅" if status["exists"] else "❌"
        print(f"   {icon} {table}: {'Exists' if status['exists'] else 'Missing'}")
    
    # API Endpoints
    print(f"\n🌐 API Server:")
    api = results["api"]
    print(f"   Status: {'✅ RUNNING' if api['server_running'] else '❌ NOT RUNNING'}")
    print(f"   Base URL: {api.get('base_url', 'N/A')}")
    
    if api.get("endpoints"):
        for endpoint, status in api["endpoints"].items():
            icon = "✅" if status["accessible"] else "❌"
            auth_note = " (requires auth)" if status.get("requires_auth") else ""
            print(f"   {icon} {endpoint}: {'Accessible' if status['accessible'] else 'Not accessible'}{auth_note}")
    
    # Summary
    print(f"\n📊 SUMMARY:")
    summary = results["summary"]
    print(f"   Readiness Score: {summary['readiness_score']:.1f}%")
    print(f"   Overall Status: {summary['overall_status']}")
    
    print(f"\n📝 Next Steps:")
    for i, step in enumerate(summary["next_steps"], 1):
        print(f"   {i}. {step}")
    
    print("\n" + "=" * 80)
    
    return summary["readiness_score"] == 100


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)