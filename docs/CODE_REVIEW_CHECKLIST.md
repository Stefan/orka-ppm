# Code Review Checklist (Roche→Generic + Costbook/CICD)

Use this checklist when reviewing the change set pushed in commit `c6fa75a` and follow-ups.

---

## 1. Roche / Generic rename

### Fixed in this pass
- **`backend/migrations/create_generic_audit_logs.sql`** – Indexes and comments referred to `roche_audit_logs`; table is `audit_logs`. Updated to `audit_logs`.
- **`backend/services/generic_audit_service.py`** – Class `RocheAuditService` → `GenericAuditService`; docstrings "Roche Construction" → "Generic Construction"; singleton `audit_service = GenericAuditService()`.
- **`backend/routers/reports.py`** – Comment "Roche Construction" → "Generic Construction".
- **`backend/tests/test_generic_construction_schema.py`** – Import `backend.models.generic_construction` → `models.generic_construction` (run from `backend/`).

### Remaining Roche references (non-blocking for runtime)

| Location | Type | Action |
|----------|------|--------|
| **Test feature tags** | Many backend tests use `Feature: roche-construction-ppm-features` in docstrings | Optional: replace with `generic-construction-ppm-features` for consistency |
| **`backend/tests/test_deployment_safety_properties.py`** | Feature tag, `roche-construction` in metadata, method names `test_all_roche_construction_*` | Optional: rename to generic; update tags |
| **`backend/tests/test_feature_flag_deployment_safety_properties.py`** | `test_roche_construction_endpoints_documented` | Optional: rename to generic |
| **`backend/tests/test_generic_construction_e2e_integration.py`** | Class `TestRocheConstructionE2EIntegration`, docstrings "Roche Construction" | Optional: rename class and docstrings |
| **`backend/tests/test_generic_construction_performance_security_validation.py`** | Docstrings "Roche Construction" | Optional: replace with Generic |
| **`backend/auth/rbac.py`** | Comments "Roche Construction/Engineering PPM features" | Optional: replace with Generic |
| **`backend/migrations/032_rename_roche_audit_logs_to_audit_logs.sql`** | Filename and SQL reference `roche_audit_logs` (intentional: renames that table) | Keep as-is |
| **Docs** (REFACTORING_GUIDE, GENERIC_CONSTRUCTION_*.md, CHECKPOINT_*.md, TASK_*.md, monte_carlo/FINAL_*.md, .kiro/specs) | Old filenames, commands, or "Roche" in prose | Optional: update when touching those docs |

No remaining **code** references to `roche_construction_services`, `roche_construction_models`, or `RocheAuditService` that affect runtime.

---

## 2. Test and build status

| Check | Result |
|-------|--------|
| **Frontend build** | ✅ `npm run build` succeeds |
| **Backend subset** (embedding_service_properties, generic_construction_schema, shareable_url_service) | ✅ 35 passed |
| **Backend full suite** | ⚠️ Long-running; run locally: `cd backend && pytest tests/ -q` |
| **Frontend Jest** | Run: `npm test -- --passWithNoTests` (exclude e2e if needed) |

### Backend test import convention
- From repo root, backend tests are run with CWD = `backend/`, so use `models.*`, `services.*`, `generic_construction_models` (top-level in backend). Do **not** use `backend.models.*` when running from `backend/`.

---

## 3. Review focus areas

### Generic Construction / audit
- [ ] All routers that use scenarios, PO breakdown, reports, or shareable URLs import `services.generic_construction_services` and `generic_construction_models` (or `models.generic_construction`).
- [ ] Audit logging uses `audit_logs` table and `GenericAuditService`; no references to `roche_audit_logs` or `RocheAuditService` in code.
- [ ] Migration `032_rename_roche_audit_logs_to_audit_logs.sql` is applied **after** any migration that creates `roche_audit_logs`; `create_generic_audit_logs.sql` creates `audit_logs` and uses it in indexes/comments.

### Costbook / frontend
- [ ] Costbook components and lib (e.g. `lib/costbook/`, `components/costbook/`) match current API and Supabase usage.
- [ ] Financials AbortError handling and API timeouts behave as intended in production.

### CI/CD
- [ ] `.github/workflows/ci-cd.yml` – Jobs, env vars, and secrets; no hardcoded secrets; required checks align with branch protection.

### Security / config
- [ ] No Roche (or other sensitive) strings in env examples or default config.
- [ ] RBAC and feature flags still align with intended feature set after rename.

---

## 4. Optional follow-ups

- Replace remaining test feature tags and docstrings from "roche-construction" / "Roche Construction" to "generic-construction" / "Generic Construction".
- Update legacy docs (CHECKPOINT_*, TASK_*, migration guides) when editing those files.
- Address Pydantic deprecation warnings in `generic_construction_models.py` (ConfigDict, `@field_validator`, `model_dump`).

---

*Last updated: code review pass after Roche→Generic fixes and test/build checks.*
