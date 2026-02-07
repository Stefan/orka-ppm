# Cora-Surpass Phase 1 – Backend Changes

Phase 1 of the [Cora-Surpass Roadmap](.kiro/specs/cora-surpass-roadmap/) adds scalability and integration foundations.

## Documentation reference

- **Specs:** [.kiro/specs/cora-surpass-roadmap/](../.kiro/specs/cora-surpass-roadmap/) (Requirements.md, Design.md, Tasks.md)

## Backend updates

- **Caching (projects, commitments, actuals):** Response cache with Redis/in-memory fallback; keys include org and pagination; TTL 60–120 s. See `backend/routers/projects.py`, `backend/routers/csv_import.py`, Design.md (Caching-Layer).
- **Adapter registry:** `backend/services/erp_adapter.py` – `register_erp_adapter()`, `get_erp_adapter()` uses registry then built-ins (SAP, CSV, Microsoft, etc.). Integrations router includes `csv` in SYSTEMS.
- **Pagination:** Shared `PaginationParams` in `backend/models/base.py`; list endpoints use `limit`/`offset` (projects, commitments, actuals). See Tasks.md Phase 1.2.

## Frontend / deployment

- Projects list returns `{ items, total, limit, offset }`; frontend accepts `data.items` where applicable.
- Admin API routes and CSP (wss for Supabase Realtime) are documented in the same spec/runbooks.
