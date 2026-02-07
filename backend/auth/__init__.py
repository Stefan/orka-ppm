# Authentication and authorization module

from .rbac import (
    Permission,
    UserRole,
    DEFAULT_ROLE_PERMISSIONS,
    RoleBasedAccessControl,
    rbac,
    require_permission,
    require_any_permission,
    require_admin,
    require_super_admin,
    require_org_admin_or_super,
)

from .enhanced_rbac_models import (
    ScopeType,
    PermissionContext,
    RoleAssignment,
    RoleAssignmentRequest,
    RoleAssignmentResponse,
    EffectiveRole,
    UserPermissionsResponse,
    PermissionCheckRequest,
    PermissionCheckResponse,
)

from .enhanced_permission_checker import (
    EnhancedPermissionChecker,
    get_enhanced_permission_checker,
)

from .dependencies import (
    get_current_user,
    get_current_user_id,
)

from .rbac_error_handler import (
    SecurityEventType,
    PermissionError,
    MultiplePermissionsError,
    AuthenticationError,
    SecurityEvent,
    PermissionDeniedResponse,
    AuthenticationRequiredResponse,
    RBACErrorHandler,
    create_permission_denied_response,
    create_authentication_required_response,
    raise_permission_denied,
    raise_authentication_required,
    raise_permission_requirement_denied,
    get_rbac_error_handler,
)

from .permission_requirements import (
    RequirementType,
    PermissionCheckResult,
    PermissionRequirement,
    SinglePermissionRequirement,
    AllOfRequirement,
    AnyOfRequirement,
    ComplexRequirement,
    AllRequirementsRequirement,
    PermissionRequirementError,
    require_read_and_write,
    require_full_access,
    require_manager_or_admin,
)

from .rbac_middleware import (
    RBACMiddleware,
    setup_rbac_middleware,
    EndpointPermissionConfig,
    get_endpoint_config,
    ContextExtractor,
    UserExtractor,
    require_permission_with_context,
    require_any_permission_with_context,
    require_all_permissions_with_context,
    create_project_context_extractor,
    create_portfolio_context_extractor,
    protected_endpoint,
    register_protected_endpoints,
)

from .supabase_rbac_bridge import (
    SupabaseRBACBridge,
    get_supabase_rbac_bridge,
)

__all__ = [
    # Original RBAC exports
    "Permission",
    "UserRole",
    "DEFAULT_ROLE_PERMISSIONS",
    "RoleBasedAccessControl",
    "rbac",
    "require_permission",
    "require_any_permission",
    "require_admin",
    "require_super_admin",
    "require_org_admin_or_super",
    # Enhanced RBAC models
    "ScopeType",
    "PermissionContext",
    "RoleAssignment",
    "RoleAssignmentRequest",
    "RoleAssignmentResponse",
    "EffectiveRole",
    "UserPermissionsResponse",
    "PermissionCheckRequest",
    "PermissionCheckResponse",
    # Enhanced permission checker
    "EnhancedPermissionChecker",
    "get_enhanced_permission_checker",
    # Dependencies
    "get_current_user",
    "get_current_user_id",
    # RBAC Error Handler (Requirements: 1.3)
    "SecurityEventType",
    "PermissionError",
    "MultiplePermissionsError",
    "AuthenticationError",
    "SecurityEvent",
    "PermissionDeniedResponse",
    "AuthenticationRequiredResponse",
    "RBACErrorHandler",
    "create_permission_denied_response",
    "create_authentication_required_response",
    "raise_permission_denied",
    "raise_authentication_required",
    "raise_permission_requirement_denied",
    "get_rbac_error_handler",
    # Permission Requirements (Requirements: 1.4)
    "RequirementType",
    "PermissionCheckResult",
    "PermissionRequirement",
    "SinglePermissionRequirement",
    "AllOfRequirement",
    "AnyOfRequirement",
    "ComplexRequirement",
    "AllRequirementsRequirement",
    "PermissionRequirementError",
    "require_read_and_write",
    "require_full_access",
    "require_manager_or_admin",
    # RBAC Middleware (Requirements: 1.5)
    "RBACMiddleware",
    "setup_rbac_middleware",
    "EndpointPermissionConfig",
    "get_endpoint_config",
    "ContextExtractor",
    "UserExtractor",
    "require_permission_with_context",
    "require_any_permission_with_context",
    "require_all_permissions_with_context",
    "create_project_context_extractor",
    "create_portfolio_context_extractor",
    "protected_endpoint",
    "register_protected_endpoints",
    # Supabase RBAC Bridge (Requirements: 2.1, 2.2, 2.3, 2.4)
    "SupabaseRBACBridge",
    "get_supabase_rbac_bridge",
]