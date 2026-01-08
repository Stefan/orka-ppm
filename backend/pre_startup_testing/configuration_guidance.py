"""
Configuration guidance system for the pre-startup testing framework.
Provides specific error messages with resolution steps and issue prioritization.
"""

from typing import Dict, List, Optional, Tuple
from .models import ValidationResult, Severity, ValidationStatus


class ErrorResolutionGuidance:
    """Provides specific error resolution guidance with prioritization."""
    
    # Comprehensive error resolution mapping with detailed guidance
    RESOLUTION_GUIDANCE = {
        # Database-related errors
        "supabase_connection_failed": {
            "title": "Supabase Database Connection Failed",
            "description": "Cannot establish connection to Supabase database",
            "severity": Severity.CRITICAL,
            "steps": [
                "1. Verify SUPABASE_URL in your .env file",
                "   Example: SUPABASE_URL=https://your-project.supabase.co",
                "2. Check SUPABASE_ANON_KEY is valid and not expired",
                "   Example: SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "3. Test connection manually:",
                "   curl -H 'apikey: YOUR_ANON_KEY' YOUR_SUPABASE_URL/rest/v1/",
                "4. Verify your Supabase project is active and not paused",
                "5. Check network connectivity and firewall settings"
            ],
            "documentation_links": [
                "https://supabase.com/docs/guides/getting-started",
                "backend/.env.example"
            ],
            "config_files": [".env", "backend/.env"]
        },
        
        "missing_execute_sql_function": {
            "title": "Missing Database Function: execute_sql",
            "description": "Required custom database function is not available",
            "severity": Severity.CRITICAL,
            "steps": [
                "1. Run database migrations to create missing functions:",
                "   cd backend && python apply_migration_direct.py",
                "2. Alternatively, check if migrations exist:",
                "   ls backend/migrations/",
                "3. If no migrations, create the execute_sql function manually:",
                "   -- Connect to Supabase SQL editor and run:",
                "   -- CREATE OR REPLACE FUNCTION execute_sql(query text) ...",
                "4. Verify function exists:",
                "   SELECT routine_name FROM information_schema.routines WHERE routine_name = 'execute_sql';",
                "5. Consider modifying endpoints to use standard Supabase queries instead"
            ],
            "documentation_links": [
                "backend/migrations/README.md",
                "https://supabase.com/docs/guides/database/functions"
            ],
            "config_files": ["backend/migrations/"]
        },
        
        "database_table_missing": {
            "title": "Required Database Table Missing",
            "description": "Critical database table is not available",
            "severity": Severity.HIGH,
            "steps": [
                "1. Run all pending database migrations:",
                "   cd backend && python migrations/run_migrations.py",
                "2. Check migration status:",
                "   python migrations/verify_schema.py",
                "3. If table should exist, check migration files:",
                "   ls backend/migrations/*.sql",
                "4. Create table manually if migration is missing:",
                "   -- Use Supabase SQL editor to create required table",
                "5. Verify table permissions for your service role"
            ],
            "documentation_links": [
                "backend/migrations/MIGRATION_SUMMARY.md"
            ],
            "config_files": ["backend/migrations/"]
        },
        
        # Authentication-related errors
        "jwt_validation_failed": {
            "title": "JWT Token Validation Failed",
            "description": "Authentication token parsing or validation error",
            "severity": Severity.HIGH,
            "steps": [
                "1. Check JWT_SECRET in your environment variables",
                "2. Verify token format and expiration",
                "3. Test with a fresh token:",
                "   -- Use Supabase auth to generate new token",
                "4. Check if development mode auth is properly configured",
                "5. Verify Supabase JWT settings match your configuration"
            ],
            "documentation_links": [
                "https://supabase.com/docs/guides/auth/auth-helpers/nextjs"
            ],
            "config_files": [".env", "backend/.env"]
        },
        
        "rbac_validation_failed": {
            "title": "Role-Based Access Control Failed",
            "description": "User permissions or role validation error",
            "severity": Severity.MEDIUM,
            "steps": [
                "1. Check user roles are properly assigned in database",
                "2. Verify RLS (Row Level Security) policies are correct",
                "3. Test with different user roles:",
                "   -- Admin, regular user, etc.",
                "4. Check if RBAC tables exist and are populated",
                "5. Review permission inheritance logic"
            ],
            "documentation_links": [
                "https://supabase.com/docs/guides/auth/row-level-security"
            ],
            "config_files": ["backend/migrations/005_rbac_system.sql"]
        },
        
        # API endpoint errors
        "api_endpoint_failed": {
            "title": "API Endpoint Validation Failed",
            "description": "Critical API endpoint is not responding correctly",
            "severity": Severity.HIGH,
            "steps": [
                "1. Check if the endpoint exists in your FastAPI routes",
                "2. Verify required dependencies are available:",
                "   -- Database functions, tables, etc.",
                "3. Test endpoint manually:",
                "   curl -X GET http://localhost:8000/your-endpoint",
                "4. Check server logs for detailed error messages",
                "5. Verify authentication requirements are met"
            ],
            "documentation_links": [
                "backend/main.py"
            ],
            "config_files": ["backend/main.py"]
        },
        
        "missing_api_dependency": {
            "title": "Missing API Dependency",
            "description": "API endpoint depends on unavailable resource",
            "severity": Severity.HIGH,
            "steps": [
                "1. Identify the missing dependency from error details",
                "2. Check if it's a database function:",
                "   -- Run database migrations if needed",
                "3. Check if it's a table or view:",
                "   -- Verify schema is up to date",
                "4. Check if it's an external service:",
                "   -- Verify service is running and accessible",
                "5. Consider implementing fallback behavior"
            ],
            "documentation_links": [],
            "config_files": []
        },
        
        # Configuration errors
        "missing_environment_variable": {
            "title": "Missing Required Environment Variable",
            "description": "Required configuration variable is not set",
            "severity": Severity.CRITICAL,
            "steps": [
                "1. Check your .env file in the backend directory",
                "2. Copy missing variables from .env.example:",
                "   cp .env.example .env",
                "3. Set the specific missing variable:",
                "   echo 'VARIABLE_NAME=value' >> .env",
                "4. Restart your development server",
                "5. Verify the variable is loaded correctly"
            ],
            "documentation_links": [
                "backend/.env.example"
            ],
            "config_files": [".env", "backend/.env", "backend/.env.example"]
        },
        
        "invalid_configuration_format": {
            "title": "Invalid Configuration Format",
            "description": "Configuration value has incorrect format",
            "severity": Severity.MEDIUM,
            "steps": [
                "1. Check the expected format in documentation",
                "2. Compare with working examples in .env.example",
                "3. Common formats:",
                "   -- URLs: https://example.com",
                "   -- API Keys: sk-... or eyJ...",
                "   -- Booleans: true/false",
                "4. Remove quotes if not needed",
                "5. Check for trailing spaces or special characters"
            ],
            "documentation_links": [
                "backend/.env.example"
            ],
            "config_files": [".env", "backend/.env"]
        },
        
        # Performance and system errors
        "test_timeout": {
            "title": "Test Execution Timeout",
            "description": "Tests took too long to complete",
            "severity": Severity.MEDIUM,
            "steps": [
                "1. Check network connectivity to external services",
                "2. Verify database is responding quickly",
                "3. Consider increasing timeout in configuration",
                "4. Run tests individually to identify slow components",
                "5. Check system resources (CPU, memory)"
            ],
            "documentation_links": [],
            "config_files": []
        },
        
        "external_service_unavailable": {
            "title": "External Service Unavailable",
            "description": "Required external service is not accessible",
            "severity": Severity.MEDIUM,
            "steps": [
                "1. Check service status pages",
                "2. Verify network connectivity",
                "3. Consider using mock data for development:",
                "   -- Set DEVELOPMENT_MODE=true",
                "4. Check if service credentials are valid",
                "5. Implement fallback behavior if possible"
            ],
            "documentation_links": [],
            "config_files": [".env"]
        }
    }
    
    def __init__(self):
        """Initialize the error resolution guidance system."""
        pass
    
    def get_resolution_guidance(self, error: ValidationResult) -> Dict[str, any]:
        """Get comprehensive resolution guidance for an error.
        
        Args:
            error: ValidationResult object with FAIL status
            
        Returns:
            Dictionary containing guidance information
        """
        guidance_key = self._determine_guidance_key(error)
        
        if guidance_key in self.RESOLUTION_GUIDANCE:
            guidance = self.RESOLUTION_GUIDANCE[guidance_key].copy()
            guidance["error_key"] = guidance_key
            return guidance
        
        # Fallback guidance
        return {
            "title": f"Error in {error.component}",
            "description": error.message,
            "severity": error.severity,
            "steps": error.resolution_steps or [
                "1. Review the error message for specific details",
                "2. Check system logs for additional information",
                "3. Verify configuration and dependencies",
                "4. Consult documentation or seek team assistance"
            ],
            "documentation_links": [],
            "config_files": [],
            "error_key": "generic_error"
        }
    
    def prioritize_errors(self, errors: List[ValidationResult]) -> List[Tuple[ValidationResult, Dict[str, any]]]:
        """Prioritize errors by severity and impact.
        
        Args:
            errors: List of ValidationResult objects with FAIL status
            
        Returns:
            List of tuples (error, guidance) sorted by priority
        """
        error_guidance_pairs = []
        
        for error in errors:
            guidance = self.get_resolution_guidance(error)
            error_guidance_pairs.append((error, guidance))
        
        # Sort by severity priority (critical first), then by component impact
        return sorted(
            error_guidance_pairs,
            key=lambda x: (
                self._get_severity_priority(x[1]["severity"]),
                self._get_component_impact_priority(x[0].component)
            ),
            reverse=True
        )
    
    def generate_resolution_report(self, errors: List[ValidationResult]) -> str:
        """Generate a comprehensive resolution report.
        
        Args:
            errors: List of ValidationResult objects with FAIL status
            
        Returns:
            Formatted string with prioritized resolution guidance
        """
        if not errors:
            return "No errors require resolution."
        
        prioritized_errors = self.prioritize_errors(errors)
        
        lines = [
            "ERROR RESOLUTION GUIDE",
            "=" * 50,
            ""
        ]
        
        for i, (error, guidance) in enumerate(prioritized_errors, 1):
            lines.extend(self._format_error_guidance(i, error, guidance))
            lines.append("")
        
        # Add summary of configuration files to check
        config_files = set()
        for _, guidance in prioritized_errors:
            config_files.update(guidance.get("config_files", []))
        
        if config_files:
            lines.extend([
                "CONFIGURATION FILES TO CHECK:",
                "-" * 30
            ])
            for config_file in sorted(config_files):
                lines.append(f"• {config_file}")
            lines.append("")
        
        return "\n".join(lines)
    
    def _determine_guidance_key(self, error: ValidationResult) -> str:
        """Determine the appropriate guidance key for an error."""
        message_lower = error.message.lower()
        component_lower = error.component.lower()
        
        # Check error details for more specific matching
        details = error.details or {}
        
        # Database-related errors
        if "execute_sql" in message_lower or "function" in message_lower:
            return "missing_execute_sql_function"
        elif "supabase" in message_lower and "connection" in message_lower:
            return "supabase_connection_failed"
        elif "table" in message_lower and ("missing" in message_lower or "not found" in message_lower):
            return "database_table_missing"
        
        # Authentication errors
        elif "jwt" in message_lower or "token" in message_lower:
            return "jwt_validation_failed"
        elif "rbac" in message_lower or "permission" in message_lower or "role" in message_lower:
            return "rbac_validation_failed"
        
        # API errors
        elif "endpoint" in message_lower or "api" in message_lower:
            if "dependency" in message_lower or "missing" in message_lower:
                return "missing_api_dependency"
            else:
                return "api_endpoint_failed"
        
        # Configuration errors
        elif "environment" in message_lower or "variable" in message_lower:
            return "missing_environment_variable"
        elif "format" in message_lower or "invalid" in message_lower:
            return "invalid_configuration_format"
        
        # Performance errors
        elif "timeout" in message_lower:
            return "test_timeout"
        elif "service" in message_lower and "unavailable" in message_lower:
            return "external_service_unavailable"
        
        # Component-specific fallbacks
        elif "database" in component_lower:
            return "supabase_connection_failed"
        elif "auth" in component_lower:
            return "jwt_validation_failed"
        elif "api" in component_lower:
            return "api_endpoint_failed"
        elif "config" in component_lower:
            return "missing_environment_variable"
        
        return "generic_error"
    
    def _get_severity_priority(self, severity: Severity) -> int:
        """Get numeric priority for severity (higher = more severe)."""
        priority_map = {
            Severity.CRITICAL: 4,
            Severity.HIGH: 3,
            Severity.MEDIUM: 2,
            Severity.LOW: 1
        }
        return priority_map.get(severity, 0)
    
    def _get_component_impact_priority(self, component: str) -> int:
        """Get priority based on component impact (higher = more impactful)."""
        component_lower = component.lower()
        
        # Critical system components
        if "database" in component_lower:
            return 5
        elif "auth" in component_lower:
            return 4
        elif "api" in component_lower:
            return 3
        elif "config" in component_lower:
            return 2
        else:
            return 1
    
    def _format_error_guidance(self, index: int, error: ValidationResult, guidance: Dict[str, any]) -> List[str]:
        """Format a single error's guidance information."""
        lines = [
            f"{index}. {guidance['title']}",
            f"   Component: {error.component}",
            f"   Severity: {guidance['severity'].value.upper()}",
            f"   Description: {guidance['description']}",
            ""
        ]
        
        # Add resolution steps
        lines.append("   RESOLUTION STEPS:")
        for step in guidance["steps"]:
            lines.append(f"   {step}")
        
        # Add documentation links if available
        if guidance["documentation_links"]:
            lines.append("")
            lines.append("   DOCUMENTATION:")
            for link in guidance["documentation_links"]:
                lines.append(f"   • {link}")
        
        # Add configuration files if available
        if guidance["config_files"]:
            lines.append("")
            lines.append("   CONFIGURATION FILES:")
            for config_file in guidance["config_files"]:
                lines.append(f"   • {config_file}")
        
        return lines


class IssueClassifier:
    """Classifies issues by type and impact for better organization."""
    
    ISSUE_CATEGORIES = {
        "critical_system": {
            "name": "Critical System Issues",
            "description": "Issues that prevent system startup",
            "priority": 1
        },
        "data_access": {
            "name": "Data Access Issues", 
            "description": "Database and data-related problems",
            "priority": 2
        },
        "authentication": {
            "name": "Authentication Issues",
            "description": "User authentication and authorization problems",
            "priority": 3
        },
        "api_functionality": {
            "name": "API Functionality Issues",
            "description": "API endpoint and service problems",
            "priority": 4
        },
        "configuration": {
            "name": "Configuration Issues",
            "description": "Environment and configuration problems",
            "priority": 5
        },
        "performance": {
            "name": "Performance Issues",
            "description": "Performance and timeout problems",
            "priority": 6
        }
    }
    
    def classify_error(self, error: ValidationResult) -> str:
        """Classify an error into a category.
        
        Args:
            error: ValidationResult object
            
        Returns:
            Category key string
        """
        message_lower = error.message.lower()
        component_lower = error.component.lower()
        
        # Critical system issues
        if error.severity == Severity.CRITICAL:
            return "critical_system"
        
        # Data access issues
        if ("database" in component_lower or "supabase" in message_lower or 
            "table" in message_lower or "function" in message_lower):
            return "data_access"
        
        # Authentication issues
        if ("auth" in component_lower or "jwt" in message_lower or 
            "token" in message_lower or "permission" in message_lower):
            return "authentication"
        
        # API functionality issues
        if ("api" in component_lower or "endpoint" in message_lower):
            return "api_functionality"
        
        # Configuration issues
        if ("config" in component_lower or "environment" in message_lower or 
            "variable" in message_lower):
            return "configuration"
        
        # Performance issues
        if ("timeout" in message_lower or "performance" in message_lower):
            return "performance"
        
        # Default to configuration for unknown issues
        return "configuration"
    
    def group_errors_by_category(self, errors: List[ValidationResult]) -> Dict[str, List[ValidationResult]]:
        """Group errors by category.
        
        Args:
            errors: List of ValidationResult objects
            
        Returns:
            Dictionary mapping category keys to lists of errors
        """
        categorized = {category: [] for category in self.ISSUE_CATEGORIES}
        
        for error in errors:
            category = self.classify_error(error)
            categorized[category].append(error)
        
        # Remove empty categories
        return {k: v for k, v in categorized.items() if v}