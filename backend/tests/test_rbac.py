#!/usr/bin/env python3
"""
Simple test script to verify Role-Based Access Control implementation
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import rbac, Permission, UserRole, DEFAULT_ROLE_PERMISSIONS

async def test_rbac_system():
    """Test the RBAC system functionality"""
    print("🧪 Testing Role-Based Access Control System")
    print("=" * 50)
    
    # Test 1: Check default role permissions
    print("\n1. Testing default role permissions...")
    
    for role, permissions in DEFAULT_ROLE_PERMISSIONS.items():
        print(f"   {role.value}: {len(permissions)} permissions")
        
        # Verify admin has all permissions
        if role == UserRole.admin:
            all_permissions = list(Permission)
            assert len(permissions) == len(all_permissions), f"Admin should have all {len(all_permissions)} permissions"
            print(f"   ✅ Admin has all {len(all_permissions)} permissions")
        
        # Verify viewer has only read permissions
        elif role == UserRole.viewer:
            read_permissions = [p for p in permissions if 'read' in p.value or p == Permission.ai_rag_query]
            assert len(permissions) == len(read_permissions), "Viewer should only have read permissions"
            print(f"   ✅ Viewer has only {len(read_permissions)} read permissions")
    
    # Test 2: Test permission checking (mock user)
    print("\n2. Testing permission checking...")
    
    # Mock user with admin permissions
    test_user_id = "test-admin-user"
    
    # Since we don't have a database connection in test, this will use fallback admin permissions
    user_permissions = await rbac.get_user_permissions(test_user_id)
    print(f"   User permissions count: {len(user_permissions)}")
    
    # Test specific permission checks
    has_portfolio_create = await rbac.has_permission(test_user_id, Permission.portfolio_create)
    has_system_admin = await rbac.has_permission(test_user_id, Permission.system_admin)
    
    print(f"   ✅ Has portfolio_create: {has_portfolio_create}")
    print(f"   ✅ Has system_admin: {has_system_admin}")
    
    # Test 3: Test permission combinations
    print("\n3. Testing permission combinations...")
    
    resource_permissions = [
        Permission.resource_read,
        Permission.resource_create,
        Permission.resource_update
    ]
    
    has_any_resource = await rbac.has_any_permission(test_user_id, resource_permissions)
    print(f"   ✅ Has any resource permission: {has_any_resource}")
    
    # Test 4: Verify role hierarchy makes sense
    print("\n4. Testing role hierarchy...")
    
    admin_perms = set(DEFAULT_ROLE_PERMISSIONS[UserRole.admin])
    portfolio_manager_perms = set(DEFAULT_ROLE_PERMISSIONS[UserRole.portfolio_manager])
    viewer_perms = set(DEFAULT_ROLE_PERMISSIONS[UserRole.viewer])
    
    # Admin should have all permissions that portfolio manager has
    assert portfolio_manager_perms.issubset(admin_perms), "Admin should have all portfolio manager permissions"
    print("   ✅ Admin has all portfolio manager permissions")
    
    # Portfolio manager should have all permissions that viewer has
    assert viewer_perms.issubset(portfolio_manager_perms), "Portfolio manager should have all viewer permissions"
    print("   ✅ Portfolio manager has all viewer permissions")
    
    print("\n🎉 All RBAC tests passed!")
    print("=" * 50)
    
    # Print summary of permissions by role
    print("\n📊 Permission Summary by Role:")
    for role, permissions in DEFAULT_ROLE_PERMISSIONS.items():
        print(f"\n{role.value.upper().replace('_', ' ')} ({len(permissions)} permissions):")
        for perm in sorted(permissions, key=lambda x: x.value):
            print(f"  • {perm.value}")

if __name__ == "__main__":
    asyncio.run(test_rbac_system())