#!/usr/bin/env python3
"""
Script to add admin role to a user in the database.
Uses only Python stdlib (urllib, json) and backend/.env – no extra packages.

Usage:
    python scripts/add_admin_user.py <email>
    python scripts/add_admin_user.py --user-id <user_id>
"""

import json
import os
import ssl
import sys
import urllib.request
from pathlib import Path

# SSL: use unverified context so the script works on macOS when system certs aren't available to Python.
# Connection is still encrypted (TLS). Set ADD_ADMIN_VERIFY_SSL=1 to use default verification.
_SSL_CTX = ssl.create_default_context() if os.getenv("ADD_ADMIN_VERIFY_SSL") else ssl._create_unverified_context()

_backend_dir = Path(__file__).resolve().parent.parent
_project_root = _backend_dir.parent

# Load backend .env
_dotenv = _backend_dir / ".env"
if _dotenv.exists():
    with open(_dotenv) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ.setdefault(k, v)

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Admin role permissions (match auth.rbac DEFAULT_ROLE_PERMISSIONS[UserRole.admin])
ADMIN_PERMISSIONS = [
    "portfolio_create", "portfolio_read", "portfolio_update", "portfolio_delete",
    "project_create", "project_read", "project_update", "project_delete",
    "resource_create", "resource_read", "resource_update", "resource_delete", "resource_allocate",
    "financial_read", "financial_create", "financial_update", "financial_delete", "budget_alert_manage",
    "risk_create", "risk_read", "risk_update", "risk_delete",
    "issue_create", "issue_read", "issue_update", "issue_delete",
    "ai_rag_query", "ai_resource_optimize", "ai_risk_forecast", "ai_metrics_read",
    "user_manage", "role_manage", "system_admin", "data_import",
    "pmr_create", "pmr_read", "pmr_update", "pmr_delete",
    "pmr_approve", "pmr_export", "pmr_collaborate", "pmr_ai_insights",
    "pmr_template_manage", "pmr_audit_read",
    "shareable_url_create", "shareable_url_read", "shareable_url_revoke", "shareable_url_manage",
    "simulation_run", "simulation_read", "simulation_delete", "simulation_manage",
    "scenario_create", "scenario_read", "scenario_update", "scenario_delete", "scenario_compare",
    "change_create", "change_read", "change_update", "change_delete",
    "change_approve", "change_implement", "change_audit_read",
    "po_breakdown_import", "po_breakdown_create", "po_breakdown_read",
    "po_breakdown_update", "po_breakdown_delete",
    "report_generate", "report_read", "report_template_create", "report_template_manage",
    "audit:read", "audit:export",
    "workflow_create", "workflow_read", "workflow_update", "workflow_delete",
    "workflow_approve", "workflow_manage",
]


def _req(method: str, url: str, data=None, headers=None):
    h = {"Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    if headers:
        h.update(headers)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
        return json.loads(r.read().decode())


def find_user_by_email(email: str):
    """Find user by email via Supabase Auth Admin API."""
    if not SUPABASE_URL or not SERVICE_KEY:
        return None
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/users?per_page=1000"
        data = _req("GET", url)
        users = data if isinstance(data, list) else (data.get("users") or [])
        for u in users:
            if u.get("email") == email:
                return u.get("id")
        print(f"❌ User with email '{email}' not found")
        return None
    except Exception as e:
        print(f"❌ Error finding user: {e}")
        return None


def get_or_create_admin_role():
    """Get or create admin role via PostgREST."""
    if not SUPABASE_URL or not SERVICE_KEY:
        return None
    try:
        url = f"{SUPABASE_URL}/rest/v1/roles?name=eq.admin&select=id"
        req = urllib.request.Request(url, headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}, method="GET")
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            rows = json.loads(r.read().decode())
        if rows:
            print(f"✅ Admin role found: {rows[0]['id']}")
            return rows[0]["id"]
        print("📝 Creating admin role...")
        url = f"{SUPABASE_URL}/rest/v1/roles"
        req = urllib.request.Request(
            url,
            data=json.dumps({
                "name": "admin",
                "description": "Full system administrator with all permissions",
                "permissions": ADMIN_PERMISSIONS,
            }).encode(),
            headers={"Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Prefer": "return=representation"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            created = json.loads(r.read().decode())
        if created:
            print(f"✅ Admin role created: {created[0]['id']}")
            return created[0]["id"]
        return None
    except Exception as e:
        print(f"❌ Error getting/creating admin role: {e}")
        return None


def add_admin_role_to_user(user_id: str):
    """Add admin role to user (service role bypasses RLS)."""
    if not SUPABASE_URL or not SERVICE_KEY:
        return False
    try:
        admin_role_id = get_or_create_admin_role()
        if not admin_role_id:
            return False
        url = f"{SUPABASE_URL}/rest/v1/user_roles?user_id=eq.{user_id}&role_id=eq.{admin_role_id}&select=id"
        req = urllib.request.Request(url, headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}, method="GET")
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            existing = json.loads(r.read().decode())
        if existing:
            print("ℹ️  User already has admin role")
            return True
        print(f"📝 Adding admin role to user {user_id}...")
        url = f"{SUPABASE_URL}/rest/v1/user_roles"
        req = urllib.request.Request(
            url,
            data=json.dumps({"user_id": user_id, "role_id": admin_role_id}).encode(),
            headers={"Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Prefer": "return=representation"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            result = json.loads(r.read().decode())
        if result:
            print("✅ Admin role successfully added to user!")
            return True
        return False
    except Exception as e:
        print(f"❌ Error adding admin role: {e}")
        return False


def list_user_roles(user_id: str):
    """List roles for user (select with roles join)."""
    if not SUPABASE_URL or not SERVICE_KEY:
        return
    try:
        url = f"{SUPABASE_URL}/rest/v1/user_roles?user_id=eq.{user_id}&select=roles(name,description)"
        req = urllib.request.Request(url, headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}, method="GET")
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            rows = json.loads(r.read().decode())
        if not rows:
            print("ℹ️  User has no roles assigned")
            return
        print("\n📋 User roles:")
        for row in rows:
            r = row.get("roles") or {}
            print(f"  - {r.get('name')}: {r.get('description')}")
    except Exception as e:
        print(f"❌ Error listing user roles: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/add_admin_user.py <email>")
        print("       python scripts/add_admin_user.py --user-id <user_id>")
        print("Example: python scripts/add_admin_user.py user@example.com")
        sys.exit(1)

    if not SUPABASE_URL or not SERVICE_KEY:
        print("❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env")
        sys.exit(1)

    print("🚀 Admin User Setup")
    print("=" * 50)

    if sys.argv[1] == "--user-id":
        if len(sys.argv) < 3:
            print("❌ Please provide a user ID")
            sys.exit(1)
        user_id = sys.argv[2]
        print(f"📧 Using user ID: {user_id}")
    else:
        email = sys.argv[1]
        print(f"📧 Looking up user: {email}")
        user_id = find_user_by_email(email)
        if not user_id:
            sys.exit(1)
        print(f"✅ Found user ID: {user_id}")

    if add_admin_role_to_user(user_id):
        print("\n" + "=" * 50)
        print("✅ SUCCESS! User is now an admin")
        print("=" * 50)
        list_user_roles(user_id)
        print("\n💡 Next steps: refresh browser, log out and back in, then open /admin/performance")
    else:
        print("\n❌ Failed to add admin role")
        sys.exit(1)


if __name__ == "__main__":
    main()
