# API Performance & Caching

Kurze Übersicht zu Response-Caching, Cache-Invalidierung und Listen-Optimierungen im Backend.

## Cache-Backend

- **Redis (Produktion):** Setze `REDIS_URL` (z. B. `redis://localhost:6379/0` oder Redis-Cloud-URL). Dann nutzt `CacheManager` in `backend/performance_optimization.py` Redis; bei mehreren App-Instanzen ist der Cache geteilt.
- **Ohne Redis:** Es wird ein In-Memory-TTL-Cache (max 1000 Einträge, 5 min TTL) verwendet – pro Prozess, nicht geteilt.

## Gecachte Endpoints (Beispiele)

| Endpoint | TTL | Key-Muster |
|----------|-----|------------|
| GET /api/rbac/user-permissions | 60 s | user_id |
| GET /api/admin/organizations/me | 60 s | org_id |
| GET /schedules/ | 60 s | schedules:list:{org_id}:... |
| GET /api/workflows/instances/my-workflows | 60 s | workflows:my-workflows:{user_id} |
| GET /feedback/notifications | 45 s | feedback:notifications:{user_id}:... |
| GET /api/ai/help/languages | 5 min | ai:help:languages |

## Cache-Invalidierung

- **Schedules:** Nach Create/Update/Delete eines Schedule wird `schedules:list:*` gelöscht (`clear_pattern`).
- **Feedback Notifications:** Nach „als gelesen markieren“ (einzeln oder alle) wird `feedback:notifications:{user_id}:*` gelöscht.
- **Projekte:** Nach Create/Update/Delete wird der Projekte-Listen-Cache invalidiert (siehe `projects.py`).

## Listen ohne exakten Count (schneller)

Für Pagination kann der exakte Gesamt-Count weggelassen werden; die API liefert dann z. B. `total = offset + len(items)` und optional `has_more`.

- **GET /csv-import/commitments**, **/actuals:** `count_exact` Query-Parameter (default `false`). Frontend sendet `count_exact=true` nur auf Seite 1.
- **GET /projects/:** `count_exact` (default `false`).
- **GET /schedules/:** `count_exact` (default `false`).
- **GET /api/registers/{type}:** `count_exact` (default `false`). Frontend sendet `count_exact=true` nur bei offset 0.

## Registers API

- **Tabelle:** `registers` (Migration `061_registers_unified.sql`). Die Tabelle muss einmalig angelegt werden, sonst entsteht PGRST205 („table not in schema cache“). SQL in Supabase SQL Editor ausführen; Anleitung: `cd backend && python migrations/apply_registers_migration.py`. Optional vorher Migration 058 für RLS-Funktionen.
- **Endpoints:** CRUD pro Typ unter `/api/registers/{type}`; optional `POST /api/registers/{type}/ai-recommend` (Stub).
- **Frontend:** `/registers`, Hook `useRegisters`; `count_exact=true` nur für erste Seite.

## My-Workflows

- **GET /api/workflows/instances/my-workflows:** Liefert Workflow-Instanzen, bei denen der aktuelle User Initiator (`started_by`) ist. Gecacht 60 s.
