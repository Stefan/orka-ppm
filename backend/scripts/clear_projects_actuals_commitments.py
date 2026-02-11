#!/usr/bin/env python3
"""
Delete all projects, actuals, and commitments so a fresh CSV/import can be run.
Uses Supabase REST API with service role. Order: commitments -> actuals -> projects (FK).
Only standard library (no pip install required).
"""
import os
import ssl
import sys
import urllib.request
import urllib.error

# Load .env manually if present
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for path in (os.path.join(backend_dir, ".env"), os.path.join(backend_dir, "..", ".env")):
    if os.path.isfile(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

def main():
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("❌ SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_KEY) in .env setzen")
        sys.exit(1)
    base = f"{url}/rest/v1"
    sentinel = "00000000-0000-0000-0000-000000000000"
    # macOS Python often has no CA bundle; set CLEAR_SCRIPT_INSECURE_SSL=1 to skip verify (local only)
    ctx = ssl.create_default_context()
    if os.getenv("CLEAR_SCRIPT_INSECURE_SSL") == "1":
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    def delete_table(name):
        req = urllib.request.Request(
            f"{base}/{name}?id=neq.{sentinel}",
            method="DELETE",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Prefer": "return=minimal",
            },
        )
        urllib.request.urlopen(req, context=ctx)

    for name, label in (("commitments", "Commitments"), ("actuals", "Actuals"), ("projects", "Projekte")):
        try:
            delete_table(name)
            print(f"✅ {label} gelöscht")
        except urllib.error.HTTPError as e:
            print(f"⚠️  {label}: {e.code} {e.reason}")
        except Exception as e:
            print(f"⚠️  {label}: {e}")
            if "SSL" in str(e) or "certificate" in str(e).lower():
                print("   Tipp: Bei macOS SSL-Fehler: CLEAR_SCRIPT_INSECURE_SSL=1 python scripts/clear_projects_actuals_commitments.py")
    print("\n✅ Fertig – du kannst jetzt neu importieren (Projekte, dann Commitments/Actuals).")

if __name__ == "__main__":
    main()
