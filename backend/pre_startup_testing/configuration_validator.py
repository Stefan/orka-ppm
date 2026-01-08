"""
Configuration validator for the pre-startup testing system.

This module validates environment variables, configuration settings,
and provides guidance for configuration issues.
"""

import os
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from .interfaces import BaseValidator
from .models import ValidationResult, ValidationStatus, Severity, ValidationConfiguration
from .configuration_guidance import ErrorResolutionGuidance


class ConfigurationValidator(BaseValidator):
    """Validates environment variables and configuration settings."""
    
    # Required environment variables
    REQUIRED_ENV_VARS = {
        'SUPABASE_URL': {
            'description': 'Supabase project URL',
            'format': 'https://your-project.supabase.co',
            'validation_pattern': r'^https://[a-zA-Z0-9-]+\.supabase\.co$'
        },
        'SUPABASE_ANON_KEY': {
            'description': 'Supabase anonymous key',
            'format': 'eyJ... (JWT token format)',
            'validation_pattern': r'^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
        },
        'OPENAI_API_KEY': {
            'description': 'OpenAI API key',
            'format': 'sk-... (starts with sk-)',
            'validation_pattern': r'^sk-[a-zA-Z0-9]{48}$'
        }
    }
    
    # Optional environment variables with validation
    OPTIONAL_ENV_VARS = {
        'SUPABASE_SERVICE_ROLE_KEY': {
            'description': 'Supabase service role key (for admin operations)',
            'format': 'eyJ... (JWT token format)',
            'validation_pattern': r'^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
        },
        'JWT_SECRET': {
            'description': 'JWT secret for token signing',
            'format': 'Random string (minimum 32 characters)',
            'validation_pattern': r'^.{32,}$'
        }
    }
    
    @property
    def component_name(self) -> str:
        return "Configuration Validator"
    
    async def validate(self) -> List[ValidationResult]:
        """Run all configuration validation tests."""
        results = []
        
        # Validate required environment variables
        results.extend(await self._validate_required_env_vars())
        
        # Validate optional environment variables
        results.extend(await self._validate_optional_env_vars())
        
        # Validate configuration consistency
        results.extend(await self._validate_configuration_consistency())
        
        return results
    
    async def _validate_required_env_vars(self) -> List[ValidationResult]:
        """Validate all required environment variables."""
        results = []
        
        for var_name, var_config in self.REQUIRED_ENV_VARS.items():
            result = await self._validate_single_env_var(
                var_name, 
                var_config, 
                required=True
            )
            results.append(result)
        
        return results
    
    async def _validate_optional_env_vars(self) -> List[ValidationResult]:
        """Validate optional environment variables if they exist."""
        results = []
        
        for var_name, var_config in self.OPTIONAL_ENV_VARS.items():
            if os.getenv(var_name):  # Only validate if present
                result = await self._validate_single_env_var(
                    var_name, 
                    var_config, 
                    required=False
                )
                results.append(result)
        
        return results
    
    async def _validate_single_env_var(
        self, 
        var_name: str, 
        var_config: Dict[str, str], 
        required: bool = True
    ) -> ValidationResult:
        """Validate a single environment variable."""
        value = os.getenv(var_name)
        
        # Check if variable exists
        if not value:
            if required:
                guidance = ErrorResolutionGuidance().get_resolution_guidance(
                    type('MockResult', (), {
                        'component': 'Configuration',
                        'test_name': 'missing_env_var',
                        'message': f'Missing {var_name}',
                        'severity': Severity.CRITICAL,
                        'details': {'variable_name': var_name}
                    })()
                )
                return self.create_result(
                    test_name=f"Environment Variable: {var_name}",
                    status=ValidationStatus.FAIL,
                    message=f"Required environment variable {var_name} is missing",
                    severity=guidance['severity'],
                    details={
                        'variable_name': var_name,
                        'description': var_config['description'],
                        'expected_format': var_config['format'],
                        'where_to_find': guidance.get('where_to_find', 'Check documentation'),
                        'security_notes': guidance.get('security_notes', 'Handle securely')
                    },
                    resolution_steps=guidance['steps']
                )
            else:
                return self.create_result(
                    test_name=f"Environment Variable: {var_name}",
                    status=ValidationStatus.SKIP,
                    message=f"Optional environment variable {var_name} not set",
                    severity=Severity.LOW
                )
        
        # Validate format if pattern is provided
        if 'validation_pattern' in var_config:
            pattern = var_config['validation_pattern']
            if not re.match(pattern, value):
                guidance = ErrorResolutionGuidance().get_resolution_guidance(
                    type('MockResult', (), {
                        'component': 'Configuration',
                        'test_name': 'invalid_format',
                        'message': f'Invalid format for {var_name}',
                        'severity': Severity.HIGH,
                        'details': {'variable_name': var_name, 'value': value}
                    })()
                )
                return self.create_result(
                    test_name=f"Environment Variable Format: {var_name}",
                    status=ValidationStatus.FAIL,
                    message=f"Environment variable {var_name} has invalid format",
                    severity=guidance['severity'],
                    details={
                        'variable_name': var_name,
                        'current_value_preview': self._mask_sensitive_value(var_name, value),
                        'expected_format': guidance.get('expected_format', var_config['format']),
                        'current_issues': guidance.get('current_issues', 'Format validation failed'),
                        'example_value': guidance.get('example_value', 'See documentation')
                    },
                    resolution_steps=guidance['steps']
                )
        
        # Additional validation for specific variables
        additional_validation = await self._validate_variable_specific_rules(var_name, value)
        if additional_validation:
            return additional_validation
        
        # Variable is valid
        return self.create_result(
            test_name=f"Environment Variable: {var_name}",
            status=ValidationStatus.PASS,
            message=f"Environment variable {var_name} is properly configured",
            severity=Severity.LOW,
            details={
                'variable_name': var_name,
                'value_preview': self._mask_sensitive_value(var_name, value)
            }
        )
    
    async def _validate_variable_specific_rules(
        self, 
        var_name: str, 
        value: str
    ) -> Optional[ValidationResult]:
        """Apply variable-specific validation rules."""
        
        if var_name == 'SUPABASE_URL':
            return await self._validate_supabase_url(value)
        elif var_name in ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']:
            return await self._validate_jwt_token(var_name, value)
        elif var_name == 'OPENAI_API_KEY':
            return await self._validate_openai_key(value)
        
        return None
    
    async def _validate_supabase_url(self, url: str) -> Optional[ValidationResult]:
        """Validate Supabase URL format and accessibility."""
        try:
            parsed = urllib.parse.urlparse(url)
            
            # Check if URL is properly formatted
            if not parsed.scheme or not parsed.netloc:
                return self.create_result(
                    test_name="Supabase URL Format",
                    status=ValidationStatus.FAIL,
                    message="SUPABASE_URL is not a valid URL format",
                    severity=Severity.HIGH,
                    details={'url': url},
                    resolution_steps=[
                        "Ensure SUPABASE_URL follows format: https://your-project.supabase.co",
                        "Check your Supabase project settings for the correct URL",
                        "Verify there are no extra spaces or characters"
                    ]
                )
            
            # Check if it's HTTPS
            if parsed.scheme != 'https':
                return self.create_result(
                    test_name="Supabase URL Security",
                    status=ValidationStatus.WARNING,
                    message="SUPABASE_URL should use HTTPS for security",
                    severity=Severity.MEDIUM,
                    details={'url': url, 'scheme': parsed.scheme},
                    resolution_steps=[
                        "Change URL scheme from http:// to https://",
                        "Supabase requires HTTPS for production use"
                    ]
                )
            
        except Exception as e:
            return self.create_result(
                test_name="Supabase URL Validation",
                status=ValidationStatus.FAIL,
                message=f"Error validating SUPABASE_URL: {str(e)}",
                severity=Severity.HIGH,
                details={'url': url, 'error': str(e)},
                resolution_steps=[
                    "Check SUPABASE_URL format",
                    "Ensure URL is properly formatted: https://your-project.supabase.co"
                ]
            )
        
        return None
    
    async def _validate_jwt_token(self, var_name: str, token: str) -> Optional[ValidationResult]:
        """Validate JWT token format."""
        try:
            # JWT tokens have 3 parts separated by dots
            parts = token.split('.')
            if len(parts) != 3:
                return self.create_result(
                    test_name=f"JWT Token Format: {var_name}",
                    status=ValidationStatus.FAIL,
                    message=f"{var_name} is not a valid JWT token format",
                    severity=Severity.HIGH,
                    details={
                        'variable_name': var_name,
                        'parts_count': len(parts),
                        'expected_parts': 3
                    },
                    resolution_steps=[
                        f"Check {var_name} in your Supabase project settings",
                        "JWT tokens should have 3 parts separated by dots (header.payload.signature)",
                        "Copy the key exactly as shown in Supabase dashboard"
                    ]
                )
            
            # Check if parts are base64-encoded (basic check)
            for i, part in enumerate(parts):
                if not re.match(r'^[A-Za-z0-9_-]+$', part):
                    return self.create_result(
                        test_name=f"JWT Token Encoding: {var_name}",
                        status=ValidationStatus.FAIL,
                        message=f"{var_name} contains invalid characters for JWT token",
                        severity=Severity.HIGH,
                        details={
                            'variable_name': var_name,
                            'invalid_part': i + 1
                        },
                        resolution_steps=[
                            f"Verify {var_name} is copied correctly from Supabase",
                            "JWT tokens should only contain letters, numbers, hyphens, and underscores",
                            "Check for extra spaces or special characters"
                        ]
                    )
        
        except Exception as e:
            return self.create_result(
                test_name=f"JWT Token Validation: {var_name}",
                status=ValidationStatus.FAIL,
                message=f"Error validating {var_name}: {str(e)}",
                severity=Severity.HIGH,
                details={'variable_name': var_name, 'error': str(e)},
                resolution_steps=[
                    f"Check {var_name} format",
                    "Ensure token is a valid JWT from Supabase"
                ]
            )
        
        return None
    
    async def _validate_openai_key(self, key: str) -> Optional[ValidationResult]:
        """Validate OpenAI API key format."""
        if not key.startswith('sk-'):
            return self.create_result(
                test_name="OpenAI API Key Format",
                status=ValidationStatus.FAIL,
                message="OPENAI_API_KEY should start with 'sk-'",
                severity=Severity.HIGH,
                details={'key_prefix': key[:10] if len(key) > 10 else key},
                resolution_steps=[
                    "Check your OpenAI API key format",
                    "Valid keys start with 'sk-' followed by 48 characters",
                    "Get your API key from https://platform.openai.com/api-keys"
                ]
            )
        
        if len(key) != 51:  # sk- + 48 characters
            return self.create_result(
                test_name="OpenAI API Key Length",
                status=ValidationStatus.WARNING,
                message="OPENAI_API_KEY length appears incorrect",
                severity=Severity.MEDIUM,
                details={'key_length': len(key), 'expected_length': 51},
                resolution_steps=[
                    "Verify the complete API key was copied",
                    "OpenAI keys should be exactly 51 characters (sk- + 48 chars)",
                    "Check for missing or extra characters"
                ]
            )
        
        return None
    
    async def _validate_configuration_consistency(self) -> List[ValidationResult]:
        """Validate configuration consistency and development vs production settings."""
        results = []
        
        # Check if we're in development mode
        is_development = self.config.development_mode or os.getenv('NODE_ENV') != 'production'
        
        if is_development:
            # In development, warn about missing optional variables
            if not os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
                results.append(self.create_result(
                    test_name="Development Configuration",
                    status=ValidationStatus.WARNING,
                    message="SUPABASE_SERVICE_ROLE_KEY not set - some admin features may not work",
                    severity=Severity.LOW,
                    resolution_steps=[
                        "Set SUPABASE_SERVICE_ROLE_KEY for full admin functionality",
                        "Get service role key from Supabase project settings",
                        "This is optional for basic development"
                    ]
                ))
        else:
            # In production, require service role key
            if not os.getenv('SUPABASE_SERVICE_ROLE_KEY'):
                results.append(self.create_result(
                    test_name="Production Configuration",
                    status=ValidationStatus.FAIL,
                    message="SUPABASE_SERVICE_ROLE_KEY is required in production",
                    severity=Severity.CRITICAL,
                    resolution_steps=[
                        "Set SUPABASE_SERVICE_ROLE_KEY for production deployment",
                        "Get service role key from Supabase project settings",
                        "This key is required for admin operations"
                    ]
                ))
        
        return results
    
    def _mask_sensitive_value(self, var_name: str, value: str) -> str:
        """Mask sensitive values for logging/display."""
        if var_name in ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET']:
            return f"{value[:10]}...{value[-4:]}" if len(value) > 14 else "***"
        elif var_name == 'OPENAI_API_KEY':
            return f"sk-...{value[-4:]}" if len(value) > 7 else "sk-***"
        else:
            return value