"""
Database connectivity checker for the pre-startup testing system.
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from .interfaces import BaseValidator
from .models import ValidationResult, ValidationStatus, Severity, ValidationConfiguration


class DatabaseConnectivityChecker(BaseValidator):
    """Validates database connectivity and required database objects."""
    
    def __init__(self, config: ValidationConfiguration):
        super().__init__(config)
        self.supabase_client: Optional[Client] = None
        
        # Critical tables that must exist
        self.critical_tables = [
            "user_profiles",
            "portfolios", 
            "projects",
            "financial_tracking",
            "variance_alerts",
            "csv_imports"
        ]
        
        # Required custom functions
        self.required_functions = [
            "execute_sql"
        ]
    
    @property
    def component_name(self) -> str:
        return "DatabaseConnectivityChecker"
    
    async def validate(self) -> List[ValidationResult]:
        """Run all database validation tests."""
        results = []
        
        # Test 1: Supabase connection
        connection_result = await self.test_supabase_connection()
        results.append(connection_result)
        
        # Only proceed with other tests if connection succeeded
        if connection_result.status == ValidationStatus.PASS:
            # Test 2: Critical table existence
            table_results = await self.check_critical_tables()
            results.extend(table_results)
            
            # Test 3: Required function existence
            function_results = await self.validate_database_functions()
            results.extend(function_results)
            
            # Test 4: Permission testing
            permission_results = await self.test_permissions()
            results.extend(permission_results)
        
        return results
    
    async def test_supabase_connection(self) -> ValidationResult:
        """Test Supabase connection with credential validation."""
        try:
            # Get environment variables
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url:
                return self.create_result(
                    test_name="supabase_connection",
                    status=ValidationStatus.FAIL,
                    message="SUPABASE_URL environment variable is missing",
                    severity=Severity.CRITICAL,
                    details={"missing_variable": "SUPABASE_URL"},
                    resolution_steps=[
                        "1. Check .env file in backend directory",
                        "2. Add SUPABASE_URL=your_supabase_project_url",
                        "3. Get URL from Supabase project dashboard"
                    ]
                )
            
            if not supabase_key:
                return self.create_result(
                    test_name="supabase_connection",
                    status=ValidationStatus.FAIL,
                    message="SUPABASE_ANON_KEY environment variable is missing",
                    severity=Severity.CRITICAL,
                    details={"missing_variable": "SUPABASE_ANON_KEY"},
                    resolution_steps=[
                        "1. Check .env file in backend directory",
                        "2. Add SUPABASE_ANON_KEY=your_supabase_anon_key",
                        "3. Get key from Supabase project dashboard"
                    ]
                )
            
            # Create Supabase client
            self.supabase_client = create_client(supabase_url, supabase_key)
            
            # Test connection with a simple query
            test_response = self.supabase_client.table("portfolios").select("count", count="exact").limit(1).execute()
            
            return self.create_result(
                test_name="supabase_connection",
                status=ValidationStatus.PASS,
                message="Supabase connection successful",
                details={
                    "supabase_url": supabase_url,
                    "connection_test": "passed"
                }
            )
            
        except Exception as e:
            error_message = str(e)
            
            # Use enhanced error guidance
            enhanced_guidance = self.get_database_error_guidance("auto_detect", error_message)
            
            return self.create_result(
                test_name="supabase_connection",
                status=ValidationStatus.FAIL,
                message=f"Supabase connection failed: {error_message}",
                severity=Severity.CRITICAL,
                details={"error": error_message, "error_type": type(e).__name__},
                resolution_steps=enhanced_guidance[1:]  # Skip the description line
            )
    
    async def check_critical_tables(self) -> List[ValidationResult]:
        """Check existence of critical database tables."""
        results = []
        
        if not self.supabase_client:
            return [self.create_result(
                test_name="table_existence_check",
                status=ValidationStatus.SKIP,
                message="Skipped table checks due to connection failure",
                severity=Severity.MEDIUM
            )]
        
        for table_name in self.critical_tables:
            try:
                # Test table access with a simple count query
                response = self.supabase_client.table(table_name).select("count", count="exact").limit(1).execute()
                
                results.append(self.create_result(
                    test_name=f"table_existence_{table_name}",
                    status=ValidationStatus.PASS,
                    message=f"Table '{table_name}' exists and is accessible",
                    details={"table_name": table_name, "accessible": True}
                ))
                
            except Exception as e:
                error_message = str(e)
                severity = Severity.CRITICAL if table_name in ["user_profiles", "portfolios"] else Severity.HIGH
                
                # Use enhanced error guidance
                enhanced_guidance = self.get_database_error_guidance("auto_detect", error_message, {"table_name": table_name})
                fallback_options = self.suggest_fallback_options(table_name)
                
                # Combine enhanced guidance with fallback options
                resolution_steps = enhanced_guidance[1:] + [""] + fallback_options
                
                results.append(self.create_result(
                    test_name=f"table_existence_{table_name}",
                    status=ValidationStatus.FAIL,
                    message=f"Table '{table_name}' check failed: {error_message}",
                    severity=severity,
                    details={"table_name": table_name, "error": error_message},
                    resolution_steps=resolution_steps
                ))
        
        return results
    
    async def validate_database_functions(self) -> List[ValidationResult]:
        """Check existence of required custom database functions."""
        results = []
        
        if not self.supabase_client:
            return [self.create_result(
                test_name="function_validation",
                status=ValidationStatus.SKIP,
                message="Skipped function checks due to connection failure",
                severity=Severity.MEDIUM
            )]
        
        for function_name in self.required_functions:
            try:
                # Test function existence by calling it with a simple query
                # The execute_sql function should be able to handle basic SQL
                test_query = "SELECT 1 as test_value"
                
                if function_name == "execute_sql":
                    # Try to call the execute_sql function
                    response = self.supabase_client.rpc(function_name, {"query": test_query}).execute()
                    
                    # Check if response is valid
                    if response.data and len(response.data) > 0:
                        results.append(self.create_result(
                            test_name=f"function_existence_{function_name}",
                            status=ValidationStatus.PASS,
                            message=f"Function '{function_name}' exists and is callable",
                            details={"function_name": function_name, "callable": True}
                        ))
                    else:
                        results.append(self.create_result(
                            test_name=f"function_existence_{function_name}",
                            status=ValidationStatus.FAIL,
                            message=f"Function '{function_name}' exists but returned unexpected response",
                            severity=Severity.HIGH,
                            details={"function_name": function_name, "response": response.data},
                            resolution_steps=[
                                f"1. Check function '{function_name}' implementation in database",
                                "2. Verify function returns expected data format",
                                "3. Test function manually in Supabase SQL editor"
                            ]
                        ))
                else:
                    # For other functions, try a generic RPC call
                    response = self.supabase_client.rpc(function_name).execute()
                    results.append(self.create_result(
                        test_name=f"function_existence_{function_name}",
                        status=ValidationStatus.PASS,
                        message=f"Function '{function_name}' exists and is callable",
                        details={"function_name": function_name, "callable": True}
                    ))
                    
            except Exception as e:
                error_message = str(e)
                
                # Use enhanced error guidance
                enhanced_guidance = self.get_database_error_guidance("auto_detect", error_message, {"function_name": function_name})
                fallback_options = self.suggest_fallback_options(function_name)
                
                # Combine enhanced guidance with fallback options
                resolution_steps = enhanced_guidance[1:] + [""] + fallback_options
                
                results.append(self.create_result(
                    test_name=f"function_existence_{function_name}",
                    status=ValidationStatus.FAIL,
                    message=f"Function '{function_name}' check failed: {error_message}",
                    severity=Severity.CRITICAL,
                    details={"function_name": function_name, "error": error_message},
                    resolution_steps=resolution_steps
                ))
        
        return results
    
    async def test_permissions(self) -> List[ValidationResult]:
        """Test database read/write permissions."""
        results = []
        
        if not self.supabase_client:
            return [self.create_result(
                test_name="permission_testing",
                status=ValidationStatus.SKIP,
                message="Skipped permission tests due to connection failure",
                severity=Severity.MEDIUM
            )]
        
        # Test read permissions on a critical table
        try:
            response = self.supabase_client.table("portfolios").select("id").limit(1).execute()
            results.append(self.create_result(
                test_name="read_permissions",
                status=ValidationStatus.PASS,
                message="Database read permissions are working",
                details={"operation": "read", "table": "portfolios"}
            ))
        except Exception as e:
            error_message = str(e)
            resolution_steps = [
                "1. Check RLS policies for read access",
                "2. Verify SUPABASE_ANON_KEY has appropriate permissions",
                "3. Test with authenticated user if RLS requires authentication"
            ]
            
            results.append(self.create_result(
                test_name="read_permissions",
                status=ValidationStatus.FAIL,
                message=f"Database read permissions failed: {error_message}",
                severity=Severity.HIGH,
                details={"operation": "read", "error": error_message},
                resolution_steps=resolution_steps
            ))
        
        # Test write permissions (insert a test record and delete it)
        try:
            # Try to insert a test record
            test_data = {
                "name": "pre_startup_test_portfolio",
                "description": "Test portfolio for pre-startup validation",
                "created_at": "now()"
            }
            
            insert_response = self.supabase_client.table("portfolios").insert(test_data).execute()
            
            if insert_response.data and len(insert_response.data) > 0:
                # Clean up: delete the test record
                test_id = insert_response.data[0].get("id")
                if test_id:
                    self.supabase_client.table("portfolios").delete().eq("id", test_id).execute()
                
                results.append(self.create_result(
                    test_name="write_permissions",
                    status=ValidationStatus.PASS,
                    message="Database write permissions are working",
                    details={"operation": "write", "table": "portfolios", "test_cleanup": True}
                ))
            else:
                results.append(self.create_result(
                    test_name="write_permissions",
                    status=ValidationStatus.FAIL,
                    message="Database write operation succeeded but returned no data",
                    severity=Severity.MEDIUM,
                    details={"operation": "write", "response": insert_response.data},
                    resolution_steps=[
                        "1. Check table schema and required fields",
                        "2. Verify RLS policies allow insert operations",
                        "3. Test insert operation manually"
                    ]
                ))
                
        except Exception as e:
            error_message = str(e)
            
            # Determine severity based on error type
            severity = Severity.HIGH
            if "permission" in error_message.lower() or "policy" in error_message.lower():
                severity = Severity.CRITICAL
            
            resolution_steps = [
                "1. Check RLS policies for insert/delete access",
                "2. Verify SUPABASE_ANON_KEY has write permissions",
                "3. Consider using service role key for admin operations"
            ]
            
            if "policy" in error_message.lower():
                resolution_steps.insert(1, "2. Review and update RLS policies for portfolios table")
            elif "constraint" in error_message.lower():
                resolution_steps.insert(1, "2. Check table constraints and required fields")
            
            results.append(self.create_result(
                test_name="write_permissions",
                status=ValidationStatus.FAIL,
                message=f"Database write permissions failed: {error_message}",
                severity=severity,
                details={"operation": "write", "error": error_message},
                resolution_steps=resolution_steps
            ))
        
        return results
    
    def get_database_error_guidance(self, error_type: str, error_message: str, context: Dict[str, Any] = None) -> List[str]:
        """Provide specific guidance for database authentication failures and other issues."""
        context = context or {}
        
        guidance_map = {
            "connection_failed": [
                "Database connection failed - check your Supabase configuration",
                "1. Verify SUPABASE_URL in .env file (should start with https://)",
                "2. Verify SUPABASE_ANON_KEY in .env file",
                "3. Check Supabase project status at https://app.supabase.com",
                "4. Test connection manually: curl -H 'apikey: YOUR_KEY' YOUR_URL/rest/v1/",
                "5. Check network connectivity and firewall settings"
            ],
            "authentication_failed": [
                "Database authentication failed - invalid credentials",
                "1. Check SUPABASE_ANON_KEY is correct and not expired",
                "2. Verify key permissions in Supabase dashboard",
                "3. Try regenerating the anon key if needed",
                "4. For admin operations, consider using service role key",
                "5. Check if project is paused or has billing issues"
            ],
            "table_missing": [
                f"Required table '{context.get('table_name', 'unknown')}' is missing",
                "1. Run database migrations to create missing tables",
                "2. Check migration files in backend/migrations/",
                "3. Verify table exists in Supabase dashboard",
                "4. Run: python backend/apply_migration_direct.py",
                "5. Check for typos in table name"
            ],
            "function_missing": [
                f"Required function '{context.get('function_name', 'unknown')}' is missing",
                "1. Run database migrations to create missing functions",
                "2. Check migration files in backend/migrations/",
                "3. Create function manually in Supabase SQL editor",
                "4. Verify function syntax and parameters",
                "5. Check function permissions and security settings"
            ],
            "permission_denied": [
                "Database permission denied - RLS policy issue",
                "1. Check Row Level Security (RLS) policies",
                "2. Verify anon key has required permissions",
                "3. Review table-specific RLS policies",
                "4. Consider disabling RLS for development (not recommended for production)",
                "5. Use service role key for admin operations"
            ],
            "timeout": [
                "Database operation timed out",
                "1. Check network connectivity to Supabase",
                "2. Verify Supabase project is not overloaded",
                "3. Check for long-running queries blocking operations",
                "4. Consider increasing timeout values",
                "5. Check Supabase status page for service issues"
            ],
            "invalid_query": [
                "Database query is invalid",
                "1. Check SQL syntax in the query",
                "2. Verify table and column names exist",
                "3. Check data types match expected values",
                "4. Test query manually in Supabase SQL editor",
                "5. Review query parameters and formatting"
            ]
        }
        
        # Determine error type from error message if not provided
        if error_type == "auto_detect":
            error_lower = error_message.lower()
            if "timeout" in error_lower:
                error_type = "timeout"
            elif "permission" in error_lower or "policy" in error_lower or "401" in error_lower:
                error_type = "permission_denied"
            elif "does not exist" in error_lower and "table" in error_lower:
                error_type = "table_missing"
            elif "does not exist" in error_lower and "function" in error_lower:
                error_type = "function_missing"
            elif "invalid" in error_lower and ("key" in error_lower or "token" in error_lower):
                error_type = "authentication_failed"
            elif "connection" in error_lower or "network" in error_lower:
                error_type = "connection_failed"
            elif "syntax" in error_lower or "query" in error_lower:
                error_type = "invalid_query"
            else:
                error_type = "connection_failed"  # Default fallback
        
        return guidance_map.get(error_type, [
            "Unknown database error occurred",
            "1. Check Supabase connection and credentials",
            "2. Review error message for specific details",
            "3. Check Supabase project status and logs",
            "4. Contact support if issue persists"
        ])
    
    def suggest_fallback_options(self, failed_component: str) -> List[str]:
        """Suggest fallback options for missing tables/functions."""
        fallback_suggestions = {
            "execute_sql": [
                "Function 'execute_sql' is missing - consider these alternatives:",
                "1. Use standard Supabase client methods instead of raw SQL",
                "2. Implement queries using .select(), .insert(), .update() methods",
                "3. Create the function using migration: backend/migrations/vector_search_functions.sql",
                "4. Use service role key for admin operations that need raw SQL",
                "5. Temporarily disable features that depend on this function"
            ],
            "user_profiles": [
                "Table 'user_profiles' is missing - critical for authentication:",
                "1. Run user management migration immediately",
                "2. Check backend/migrations/user_management_schema.sql",
                "3. Disable authentication features temporarily",
                "4. Use mock user data for development",
                "5. Verify Supabase Auth is properly configured"
            ],
            "portfolios": [
                "Table 'portfolios' is missing - core functionality affected:",
                "1. Run initial schema migration",
                "2. Check backend/migrations/001_initial_schema_enhancement.sql",
                "3. Create table manually in Supabase dashboard",
                "4. Use mock portfolio data for development",
                "5. Disable portfolio-related endpoints temporarily"
            ],
            "financial_tracking": [
                "Table 'financial_tracking' is missing - financial features disabled:",
                "1. Run financial tracking migration",
                "2. Check backend/migrations/003_financial_tracking_only.sql",
                "3. Disable financial endpoints temporarily",
                "4. Use mock financial data for development",
                "5. Focus on non-financial features first"
            ]
        }
        
        return fallback_suggestions.get(failed_component, [
            f"Component '{failed_component}' is missing:",
            "1. Check if component is critical for your current development",
            "2. Run relevant database migrations",
            "3. Consider temporary workarounds or mock data",
            "4. Disable dependent features if not immediately needed",
            "5. Prioritize fixing based on development workflow"
        ])