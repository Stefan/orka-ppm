"""
API Documentation generator for the PPM Platform API.
Provides comprehensive documentation with examples, rate limits, and versioning info.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html

class APIDocumentationGenerator:
    """Generate comprehensive API documentation"""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.version = "1.0.0"
        self.title = "PPM SaaS API"
        self.description = """
# AI-Powered Project Portfolio Management API

A comprehensive API for managing project portfolios with AI-enhanced capabilities.

## Features

- **Portfolio Management**: Create and manage project portfolios
- **Project Tracking**: Track project status, health, and progress
- **Resource Management**: Manage team resources and allocations
- **Financial Tracking**: Monitor budgets, costs, and variances
- **Risk Management**: Track risks and issues across projects
- **AI Capabilities**: Resource optimization, risk forecasting, and RAG reporting
- **Bulk Operations**: Import/export data in various formats
- **Performance Monitoring**: Built-in caching and performance metrics

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:
- **Standard endpoints**: 60 requests per minute
- **Dashboard/KPI endpoints**: 30 requests per minute  
- **Bulk operations**: 5-10 requests per minute
- **Cache operations**: 5-30 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## API Versioning

The API supports versioning through multiple methods:

### 1. Header-based versioning (Recommended)
```
API-Version: v1
```

### 2. Query parameter versioning
```
GET /projects?version=v1
```

### 3. Path-based versioning
```
GET /v1/projects
```

**Supported Versions:**
- `v1`: Current stable version
- `v2`: Beta version with enhanced features

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z",
  "cache_status": "fresh|cached",
  "api_version": "v1"
}
```

### Error Response
```json
{
  "detail": "Error message",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Performance Features

### Caching
- Dashboard data cached for 60 seconds
- Resource data cached for 300 seconds
- Portfolio metrics cached for 180 seconds
- Cache can be cleared via `/cache/clear` endpoint

### Bulk Operations
- Support for CSV, JSON, and JSONL formats
- Progress tracking for long-running operations
- Validation-only mode for testing imports
- Configurable batch sizes (max 100 items)

### Monitoring
- Prometheus metrics available at `/metrics`
- Performance summary at `/performance/summary`
- Cache statistics at `/cache/stats`

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `BULK_OPERATION_ERROR` | Bulk operation failed |
| `CACHE_ERROR` | Cache operation failed |
| `AI_SERVICE_ERROR` | AI service unavailable |

## SDK and Examples

### Python Example
```python
import requests

headers = {
    'Authorization': 'Bearer your-jwt-token',
    'API-Version': 'v1',
    'Content-Type': 'application/json'
}

# Get dashboard data
response = requests.get(
    'https://api.ppm-platform.com/dashboard',
    headers=headers
)

if response.status_code == 200:
    data = response.json()
    print(f"Total projects: {data['metrics']['total_projects']}")
```

### JavaScript Example
```javascript
const headers = {
    'Authorization': 'Bearer your-jwt-token',
    'API-Version': 'v1',
    'Content-Type': 'application/json'
};

fetch('https://api.ppm-platform.com/dashboard', { headers })
    .then(response => response.json())
    .then(data => {
        console.log('Total projects:', data.metrics.total_projects);
    });
```

## Support

For API support and questions:
- Documentation: [API Docs](https://api.ppm-platform.com/docs)
- Status Page: [Status](https://status.ppm-platform.com)
- Support: support@ppm-platform.com
"""
    
    def generate_openapi_schema(self) -> Dict[str, Any]:
        """Generate enhanced OpenAPI schema"""
        if self.app.openapi_schema:
            return self.app.openapi_schema
        
        openapi_schema = get_openapi(
            title=self.title,
            version=self.version,
            description=self.description,
            routes=self.app.routes,
        )
        
        # Add custom extensions
        openapi_schema["info"]["x-logo"] = {
            "url": "https://api.ppm-platform.com/logo.png"
        }
        
        # Add server information
        openapi_schema["servers"] = [
            {
                "url": "https://api.ppm-platform.com",
                "description": "Production server"
            },
            {
                "url": "https://staging-api.ppm-platform.com", 
                "description": "Staging server"
            },
            {
                "url": "http://localhost:8000",
                "description": "Development server"
            }
        ]
        
        # Ensure components section exists
        if "components" not in openapi_schema:
            openapi_schema["components"] = {}
        
        # Add security schemes
        openapi_schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT token obtained from authentication"
            },
            "ApiKeyAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key",
                "description": "API key for service-to-service authentication"
            }
        }
        
        # Add global security requirement
        openapi_schema["security"] = [
            {"BearerAuth": []},
            {"ApiKeyAuth": []}
        ]
        
        # Add rate limiting information to paths
        for path, methods in openapi_schema["paths"].items():
            for method, details in methods.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    # Add rate limiting info
                    details["x-rate-limit"] = self._get_rate_limit_for_endpoint(path, method)
                    
                    # Add caching info
                    if method == "get":
                        details["x-cache-ttl"] = self._get_cache_ttl_for_endpoint(path)
                    
                    # Add version info
                    details["x-api-version"] = ["v1", "v2"]
        
        # Add custom tags
        openapi_schema["tags"] = [
            {
                "name": "Authentication",
                "description": "User authentication and authorization"
            },
            {
                "name": "Dashboard",
                "description": "Portfolio dashboard and KPI endpoints"
            },
            {
                "name": "Projects",
                "description": "Project management operations"
            },
            {
                "name": "Resources",
                "description": "Resource management and allocation"
            },
            {
                "name": "Financial",
                "description": "Financial tracking and budget management"
            },
            {
                "name": "Risk Management",
                "description": "Risk and issue tracking"
            },
            {
                "name": "AI Services",
                "description": "AI-powered features and analytics"
            },
            {
                "name": "Bulk Operations",
                "description": "Data import/export operations"
            },
            {
                "name": "Performance",
                "description": "Performance monitoring and optimization"
            },
            {
                "name": "System",
                "description": "System administration and monitoring"
            }
        ]
        
        self.app.openapi_schema = openapi_schema
        return openapi_schema
    
    def _get_rate_limit_for_endpoint(self, path: str, method: str) -> str:
        """Get rate limit information for an endpoint"""
        # Define rate limits based on endpoint patterns
        rate_limits = {
            "/dashboard": "30/minute",
            "/portfolio/kpis": "60/minute",
            "/portfolio/trends": "60/minute", 
            "/portfolio/metrics": "60/minute",
            "/resources": "60/minute",
            "/projects": "60/minute",
            "/bulk/import": "5/minute",
            "/bulk/export": "10/minute",
            "/cache/clear": "5/minute",
            "/performance/summary": "10/minute",
            "/ai/rag-query": "20/minute",
            "/ai/resource-optimizer": "10/minute",
            "/ai/risk-forecast": "10/minute"
        }
        
        # Check for exact matches first
        if path in rate_limits:
            return rate_limits[path]
        
        # Check for pattern matches
        for pattern, limit in rate_limits.items():
            if pattern in path:
                return limit
        
        # Default rate limit
        return "60/minute"
    
    def _get_cache_ttl_for_endpoint(self, path: str) -> Optional[int]:
        """Get cache TTL for GET endpoints"""
        cache_ttls = {
            "/dashboard": 60,
            "/portfolio/kpis": 60,
            "/portfolio/trends": 180,
            "/portfolio/metrics": 180,
            "/resources": 300,
            "/projects": 120,
            "/risks": 300,
            "/issues": 300
        }
        
        # Check for exact matches
        if path in cache_ttls:
            return cache_ttls[path]
        
        # Check for pattern matches
        for pattern, ttl in cache_ttls.items():
            if pattern in path:
                return ttl
        
        return None
    
    def get_api_stats(self) -> Dict[str, Any]:
        """Get API statistics and information"""
        return {
            "api_info": {
                "title": self.title,
                "version": self.version,
                "description": "AI-Powered Project Portfolio Management API",
                "documentation_url": "/docs",
                "redoc_url": "/redoc",
                "openapi_url": "/openapi.json"
            },
            "supported_versions": ["v1", "v2"],
            "default_version": "v1",
            "deprecated_versions": [],
            "endpoints": {
                "total_endpoints": len([
                    route for route in self.app.routes 
                    if hasattr(route, 'methods')
                ]),
                "authenticated_endpoints": "All except /health, /debug, /api/versions",
                "cached_endpoints": [
                    "/dashboard", "/portfolio/kpis", "/portfolio/trends",
                    "/portfolio/metrics", "/resources", "/projects"
                ]
            },
            "features": {
                "authentication": "JWT Bearer tokens",
                "rate_limiting": "Per-endpoint limits with SlowAPI",
                "caching": "Redis with memory fallback",
                "bulk_operations": "CSV, JSON, JSONL support",
                "ai_services": "RAG, resource optimization, risk forecasting",
                "monitoring": "Prometheus metrics, performance tracking",
                "versioning": "Header, query param, and path-based"
            },
            "rate_limits": {
                "standard": "60/minute",
                "dashboard": "30/minute",
                "bulk_operations": "5-10/minute",
                "ai_services": "10-20/minute"
            },
            "response_formats": ["JSON"],
            "supported_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
            "timestamp": datetime.now().isoformat()
        }

def setup_api_documentation(app: FastAPI) -> APIDocumentationGenerator:
    """Setup API documentation for the FastAPI app"""
    doc_generator = APIDocumentationGenerator(app)
    
    # Generate the OpenAPI schema
    doc_generator.generate_openapi_schema()
    
    return doc_generator

# Export main components
__all__ = [
    'APIDocumentationGenerator',
    'setup_api_documentation'
]