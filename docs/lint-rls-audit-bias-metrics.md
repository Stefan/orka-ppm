# Lint: RLS Disabled on public.audit_bias_metrics

## Summary

| Item | Value |
|------|--------|
| **Title** | RLS Disabled in Public Entity |
| **Table** | `public.audit_bias_metrics` |
| **Schema** | `public` |
| **Lint rule** | Detects tables in PostgREST-exposed schema without Row-Level Security |

**Problem:** The table is in the `public` schema (exposed via PostgREST/Supabase) but Row-Level Security (RLS) is not enabled in the database the linter checks. Without RLS, access is controlled only by role-level GRANTs, so any role with table privileges can see or change all rows (risk of data leakage or unauthorized changes).

**Why it matters:** Per-row isolation (here: by `tenant_id`) is only enforced when RLS is enabled and policies are in place. Enabling RLS without policies would block all access; enabling RLS with tenant-scoped policies restricts access to the current tenant.

---

## Status in this repo

- **Table definition:** `backend/migrations/023_ai_empowered_audit_trail.sql` (columns include `tenant_id UUID NOT NULL`).
- **RLS and policies:** Already defined in `backend/migrations/024_tenant_isolation_policies.sql`:
  - `ALTER TABLE audit_bias_metrics ENABLE ROW LEVEL SECURITY`
  - `tenant_isolation_select_audit_bias_metrics` (SELECT by `tenant_id = get_current_tenant_id()`)
  - `tenant_isolation_insert_audit_bias_metrics` (INSERT with `tenant_id = get_current_tenant_id()`)
  - `prevent_update_audit_bias_metrics` (UPDATE → false)
  - `prevent_delete_audit_bias_metrics` (DELETE → false)

So the **codebase** already has the correct RLS design. The lint finding usually means **migration 024 was not applied** (or not fully) on the database the linter uses (e.g. CI or a specific Supabase project).

---

## Recommended fixes

### 1. Apply existing migrations (preferred)

Ensure migration **024** is applied after **023** on every environment (local, CI, staging, production):

- Run your normal migration process (e.g. `run_migrations.py` or Supabase migrations) so that `024_tenant_isolation_policies.sql` runs.
- Verify order: 023 creates the table, 024 enables RLS and creates the policies.

### 2. Idempotent “RLS-only” migration (if 024 can’t be guaranteed)

If some databases might have the table from 023 but never had 024 applied, add a small migration that **only enables RLS** and does nothing else:

- **Option A – Enable RLS only (policies must come from 024):**  
  Use a migration like `049_enable_audit_bias_metrics_rls.sql` that only runs:

  ```sql
  ALTER TABLE public.audit_bias_metrics ENABLE ROW LEVEL SECURITY;
  ```

  Safe to run multiple times. This fixes the “RLS disabled” lint. Policies must still come from 024 (so 024 must run before or with this).

- **Option B – Self-contained, idempotent RLS + policies:**  
  Use a migration that enables RLS and ensures the four policies exist (e.g. drop-then-recreate by name, and ensure `get_current_tenant_id()` exists). That way the linter passes even if 024 was never run.  
  → **`backend/migrations/049_enable_audit_bias_metrics_rls.sql`** does this: enables RLS, ensures `get_current_tenant_id()` exists, and (re)creates the four tenant-scoped policies. Safe to run after 024 or on a DB where 024 was never applied.

### 3. Nach dem Fix prüfen

**Schritt 1 – Migration ausführen (betroffene DB)**

- **Option A (empfohlen):** Script aus dem Backend-Verzeichnis ausführen (nutzt `exec_sql`-RPC, falls vorhanden):
  ```bash
  cd backend && python scripts/apply_049_and_verify_rls.py
  ```
- **Option B:** Migration 049 oder 024 manuell anwenden (z. B. Supabase Dashboard → SQL Editor → Inhalt von `backend/migrations/049_enable_audit_bias_metrics_rls.sql` einfügen und ausführen).

**Schritt 2 – Gesamte DB prüfen (alle public-Tabellen)**

- In Supabase SQL Editor (oder per `psql`) die Datei **`backend/migrations/verify_rls_public_tables.sql`** ausführen. Sie listet alle Tabellen in `public` mit ihrem RLS-Status (`rls_enabled` = true/false).
- Tabellen mit `rls_enabled = false` können vom Linter bemängelt werden; für diese ggf. weitere Migrationen (024 oder eigene RLS-Migrationen) anwenden.

**Schritt 3 – Einzeltabelle audit_bias_metrics**

- In der DB ausführen:
  ```sql
  SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'audit_bias_metrics';
  ```
- Erwartung: **`relrowsecurity = true`**.

**Schritt 4 – Lint erneut laufen lassen**

- Lint erneut ausführen → die Meldung **„RLS Disabled in Public Entity: public.audit_bias_metrics“** sollte verschwinden, sobald RLS aktiv und (falls gewünscht) Policies vorhanden sind.

**Optional:** Mit authentifiziertem JWT (mit `tenant_id` in den Claims) prüfen, dass Nutzer nur Zeilen des eigenen Tenants sehen bzw. einfügen können.

---

## Policy pattern in use

Access is **tenant-scoped** via `get_current_tenant_id()` (JWT claim `tenant_id` or `app.current_tenant_id`):

- **SELECT:** `tenant_id = get_current_tenant_id()`
- **INSERT:** `WITH CHECK (tenant_id = get_current_tenant_id())`
- **UPDATE/DELETE:** disallowed (`USING (false)`)

Indexes on `tenant_id` (and composite) already exist from 023, so policy checks are efficient.
