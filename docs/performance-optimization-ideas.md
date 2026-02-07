# Weitere Performance-Optimierungen

Überblick über sinnvolle nächste Schritte nach den bereits umgesetzten Maßnahmen (Indizes, N+1-Fixes, parallele Queries, Caching für Roles/Languages, Audit/Financial/CSV-Optimierungen).

## Umgesetzt (diese Runde)

- **GZip-Middleware** in `backend/main.py`: Response-Kompression für Antworten ≥ 1 KB.
- **Projekte-Liste**: Cache (TTL 60 s, Key `projects:list`) in `backend/routers/projects.py`; Invalidierung bei Projekt-Erstellung; Select nur benötigte Spalten.
- **Compliance-Check**: Frameworks einmal laden, recent checks in einer Abfrage, neue Checks parallel per `asyncio.gather` in `backend/services/audit_compliance_service.py`.
- **Admin Users** (`/api/admin/users-with-roles`): Cache 60 s in `backend/routers/admin.py`.
- **Frontend Projekte**: React Query in `lib/projects-queries.ts`, Projekte-Seite nutzt `useProjectsQuery` + `useInvalidateProjects` (Deduplizierung + Client-Cache).
- **Dokumentation**: pg_stat_statements, VACUUM ANALYZE, Connection Pool in diesem Doc ergänzt.

---

## 1. Backend / API

### Caching ausweiten
- **GET /projects/** (256 Projekte): Antwort kurz cachen (z. B. Redis oder In-Memory, TTL 30–60 s), Key z. B. `projects:list:{tenant_id}`. Bei Änderungen (Create/Update/Delete Project) Cache invalidieren.
- **GET /api/admin/users**: RPC `get_users_with_profiles` ist schnell; Fallback `auth.admin.list_users()` ist langsam. Wenn RPC fehlt: Nutzerliste mit kurzem TTL cachen (z. B. 60 s) oder RPC-Migration priorisieren.
- **Audit Dashboard Stats**: Nutzt bereits Redis (30 s TTL) in `redis_cache_service`. Prüfen, ob Redis in allen Umgebungen läuft und Cache-Hits ansteigen.

### Schwere Endpoints entlasten
- **Compliance-Check** (`audit_compliance_service.check_compliance`): Pro Framework eine DB-Abfrage + ggf. _check_framework_compliance. Frameworks in einer Abfrage laden, Checks parallel (asyncio.gather) ausführen.
- **PO-Breakdown**: RPC `get_po_breakdown_hierarchy_paginated` beibehalten; wo RPC fehlt, Indizes auf `po_breakdowns(project_id, is_active)` nutzen (bereits in 055).

### Response-Größe
- **Select nur benötigte Spalten**: Wo möglich `select("id, name, ...")` statt `select("*")` für Listen (z. B. Projekte-Liste, wenn Frontend nicht alle Felder braucht).
- **Gzip/Brotli**: Middleware für Response-Kompression aktivieren (z. B. `GZipMiddleware` in FastAPI), v. a. für große JSON-Antworten.

---

## 2. Datenbank

### Bereits erledigt (055, 036)
- Indizes für audit_logs, commitments, actuals, financial_tracking, notifications, milestones, po_breakdowns.

### Optional (Betrieb/DB-Admin)
- **pg_stat_statements auswerten**
  - Extension aktivieren: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`
  - Häufige, langsame Queries: `SELECT query, calls, total_exec_time, mean_exec_time FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;`
  - Danach gezielt indizieren oder Queries umformulieren.
- **VACUUM ANALYZE regelmäßig**
  - Cron/Job (z. B. wöchentlich): `VACUUM ANALYZE;` oder pro Tabelle `VACUUM ANALYZE audit_logs;` usw.
  - Damit der Planner aktuelle Statistiken hat und Index-Nutzung optimal bleibt.
- **Connection Pooling**
  - Supabase/PostgREST nutzt Pools; bei eigener DB-Verbindung (z. B. SQLAlchemy) Pool-Größe (z. B. 5–20) und Timeouts prüfen.
  - PgBouncer vor PostgreSQL reduziert Verbindungs-Overhead bei vielen kurzen Requests.

---

## 3. Frontend

### Weniger Roundtrips
- **Request-Bündelung**: Mehrere kleine API-Calls (z. B. Projekte + Budget-Alerts + Notifications) in einen Batch-Endpoint oder per GraphQL/Data-Loader zusammenfassen, wo sinnvoll.
- **Lazy Loading**: Schwere Daten (z. B. PMR-Insights, große Tabellen) erst bei Bedarf laden (bereits z. T. mit `/insights/lazy` vorhanden).

### Caching & Deduplizierung
- **SWR / React Query**: Für GET-Requests Cache + Deduplizierung; gleiche URL nicht mehrfach parallel laden.
- **Cache-Control**: Weitere statische Listen (z. B. Rollen, Sprachen) mit `Cache-Control` versehen (Languages bereits umgesetzt).

### Lade-Reihenfolge
- Kritische Daten zuerst (Projektliste, Berechtigungen), sekundäre danach (Notifications, Analytics), um Wasserfälle zu verkürzen.

---

## 4. Infrastruktur

- **CDN** für statische Assets (JS, CSS, Bilder).
- **HTTP/2** für Multiplexing (falls noch nicht aktiv).
- **Redis** für alle Umgebungen, in denen Audit-Dashboard-/PMR-Cache genutzt werden soll.

---

## 5. Priorisierung (kurz)

| Priorität | Maßnahme                         | Aufwand | Nutzen        |
|----------|-----------------------------------|--------|---------------|
| Hoch     | Response-Kompression (GZip)      | Gering | Große Payloads |
| Hoch     | Projekte-Liste cachen (Redis)    | Mittel | Wiederholte Requests |
| Mittel   | Compliance-Check parallelisieren  | Mittel | Weniger Latenz |
| Mittel   | Frontend: SWR/React Query         | Mittel | Weniger Doppel-Requests |
| Niedrig  | Select nur benötigte Spalten      | Gering | Kleineres JSON |

Wenn du möchtest, können wir mit einer konkreten Maßnahme starten (z. B. GZipMiddleware oder Projekte-Cache).
