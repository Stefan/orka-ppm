# Backend API Route Test Coverage

Übersicht aller Router, Abdeckung durch Backend-Tests und Prioritäten für neue Tests.

**API-Auth:** Backend-Endpoints erwarten `Authorization: Bearer <JWT>`. JWT-Signatur wird mit `SUPABASE_JWT_SECRET` verifiziert. Details: [docs/security/env-setup.md](security/env-setup.md), [docs/security/vulnerability-analysis.md](security/vulnerability-analysis.md).

## Legende

| Abdeckung | Bedeutung |
|-----------|-----------|
| **Literal** | Nur in `test_api_literal_routes.py` (Prüfung: kein 422 durch Route-Order) |
| **Dedicated** | Eigene Endpoint-/Integrations-Tests (z. B. `test_*_endpoints.py`, `test_*_api*.py`) |
| **Keine** | Kein direkter Route-Test |

| Priorität | Bedeutung |
|-----------|-----------|
| **P0** | Kritisch (Auth, Dashboard, zentrale Flows) – zuerst testen |
| **P1** | Wichtig (CRUD, Kern-Features) |
| **P2** | Normal (spezielle Features, Reports, Admin) |

---

## Router und Abdeckung

| Router | Prefix | Routes (ca.) | Abdeckung | Priorität |
|--------|--------|--------------|-----------|-----------|
| workflows | `/api/workflows` | 21 | Literal + Dedicated (`test_workflow_*`, `test_workflow_instance_endpoints`) | P0 |
| schedules | `/schedules` | 45 | Literal + Dedicated (`test_schedule_api_integration`) | P0 |
| projects | `/projects` | 4 | Literal + Dedicated (`test_projects_endpoints`) | P0 |
| users (admin) | `/api/admin/users` | 11 | Dedicated (`test_user_crud_operations`, properties) | P0 |
| audit | `/api/audit` | 17 | Literal (Dashboard, Logs, Events, Timeline, Anomalies, Search, Export/PDF/CSV) + properties | P1 |
| financial | `/financial-tracking` | 4 | Literal (Tracking, Budget-Alerts, Summary, Monitor) | P1 |
| variance | `/variance` | 6 | Literal (Alerts, Summary, push-subscribe) | P1 |
| costbook | `/api/v1/costbook` | 2 | Literal (2) | P1 |
| simulations (Monte Carlo) | `/api/v1/monte-carlo` | 18 | Literal (5) + Dedicated (`test_monte_carlo_api_*`) | P1 |
| change_orders | `/change-orders` | 8 | Dedicated (`test_change_orders_api`, `test_change_management_api_integration`) | P1 |
| change_approvals | `/change-approvals` | 5 | Dedicated (`test_change_approvals_api`) | P1 |
| change_analytics | `/change-analytics` | 4 | Dedicated (`test_change_analytics_api`) | P2 |
| shareable_urls | `/api` (shareable) | 13 | Dedicated (`test_shareable_urls_*`) | P1 |
| help_chat | `/api/ai/help` | 20 | Literal (2) + Dedicated (`test_help_chat_*`) | P1 |
| help_chat_enhanced | `/help-chat` | 7 | Literal (query, proactive-tips, admin/analytics) | P2 |
| reports | `/reports` | 13 | Literal (templates, health, adhoc, generate, export-google, oauth) | P2 |
| po_breakdown | `/pos/breakdown` | 35 | Literal (1) + Dedicated (`test_po_breakdown_*`) | P1 |
| feature_toggles | `/api/features` | 4 | Literal (1) + `test_feature_toggles_api` | P2 |
| admin | `/api/admin` | 16 | Dedicated (`test_admin_performance_endpoints`) | P1 |
| admin/knowledge | `/api/admin/knowledge` | 7 | Dedicated (`test_admin_knowledge_endpoints`) | P2 |
| admin_performance | `/api/admin/performance` | 4 | Dedicated | P2 |
| feature_flags | `/api/admin/feature-flags` | 6 | Literal (GET/POST /, check) | P2 |
| rbac | `/api/rbac` | 10 | Literal (users-with-roles, roles, role-assignments, user-permissions, check-permission, audit/role-changes) + Dedicated | P0 |
| viewer_restrictions | `/api/rbac` | 6 | Literal (viewer-indicators, financial-access-level, filter-financial-data, check-report-access, check-write-operation, is-viewer-only) | P1 |
| imports | `/api/imports` | 4 | Dedicated (`test_import_*`, `test_project_import_*`) | P1 |
| projects_import | `/api/projects` | 2 | Literal (import, import/csv) | P1 |
| csv_import | `/csv-import` | 8 | Dedicated (`test_import_*`, integration) | P1 |
| resources | `/resources` | 7 | Dedicated (`test_enhanced_resources`, `test_resources`) | P1 |
| risks | `/risks` | 6 | Literal (2) | P1 |
| issues | `/issues` | – | Literal (GET/POST /) | P2 |
| feedback | `/feedback` | 12 | Literal (features, bugs, admin/stats) | P2 |
| notifications | `/notifications` | – | Literal (GET /) | P2 |
| portfolios | `/portfolios` | 3 | Literal (2) | P1 |
| scenarios | `/simulations/what-if` | 9 | Literal (POST /, compare) | P2 |
| ai | `/ai` | 17 | Dedicated (`test_ai_*`) | P2 |
| ai_resource_optimizer | `/ai/resource-optimizer` | 5 | Literal (/, conflicts, metrics) | P2 |
| enhanced_pmr | `/api/reports/pmr` | 16 | Literal (generate, health, performance/*) | P2 |
| pmr_performance | `/api/reports/pmr/performance` | 12 | Literal (stats, health, alerts, cache/*) | P2 |
| forecasts | `/forecasts` | 2 | Dedicated (`test_forecasts_api`) | P2 |
| earned_value | `/earned-value` | 3 | Dedicated (`test_earned_value_api`) | P2 |
| project_controls | `/project-controls` | 3 | Dedicated (`test_project_controls_*`) | P2 |
| performance_analytics | `/performance-analytics` | 3 | Dedicated (`test_performance_analytics_api`) | P2 |
| contract_integration | `/contract-integration` | 3 | Dedicated (`test_contract_integration_api`) | P2 |
| erp | `/api/v1/erp` | 1 | Literal (sync) | P2 |
| features (v1) | `/api/v1/features` | 2 | Literal (GET, update) | P2 |
| distribution | `/api/v1/distribution` | 8 | Literal (calculate, rules, rules/apply) | P2 |
| rundown | `/api/rundown` | 8 | Literal (generate, generate/async) | P2 |
| workflow_metrics | `/workflow-metrics` | 10 | Literal (stats, health, summary, dashboard) | P2 |
| change_management | `/changes` | 33 | Dedicated (`test_change_management_*`) | P1 |
| help_content_management | `/help-content` | 12 | Literal (search, bulk-operation, public/search) | P2 |
| visual_guides | `/visual-guides` | 10 | Literal (/, recommendations/context) | P2 |

---

## Priorisierte Backlog-Liste für neue Route-Tests

**Status:** Alle Punkte der Backlog-Liste sind mit Literal-Routen in `test_api_literal_routes.py` abgedeckt (Stand: ~100 Literal-Routen). Einige Routen liefern bekanntermaßen 422 (Route-Order) und sind mit 422 in `allowed` + TODO im Test vermerkt.

### P0 – umgesetzt

- **projects** (`/projects`): GET/POST + Dedicated `test_projects_endpoints`.
- **rbac / viewer_restrictions**: Literal für users-with-roles, roles, role-assignments, user-permissions, check-permission, audit/role-changes sowie viewer-indicators, financial-access-level, filter-financial-data, check-report-access, check-write-operation, is-viewer-only.

### P1 – umgesetzt

- **risks**, **portfolios**: Literal GET/POST.
- **variance**: Alerts, Summary, push-subscribe.
- **financial**: Tracking, budget-alerts/summary, monitor.
- **audit**: Search, Export, Export/PDF/CSV, Timeline, Anomalies.
- **imports / projects_import**: Literal für `/api/projects/import` und `/import/csv`.

### P2 – umgesetzt

- **reports**: adhoc, generate, export-google, oauth (authorize, callback, status).
- **help_chat_enhanced**, **help_content_management**, **visual_guides**: Literal-Pfade ergänzt.
- **feedback**, **notifications**, **issues**: Literal-Pfade ergänzt.
- **enhanced_pmr**, **pmr_performance**: generate, health, performance/stats, health, alerts, cache/*.
- **ai_resource_optimizer**, **erp**, **features** (v1), **distribution**, **rundown**, **workflow_metrics**: Literal-Pfade ergänzt.

---

## Zusätzliche dedizierte Test-Module (kritische Bereiche)

| Modul | Bereich | Inhalt |
|-------|---------|--------|
| `test_critical_operations_audit_events.py` | P0, Audit | Projekte/Workflows/Audit-Export erreichbar; kritische Operationen auditierbar |
| `test_audit_permission_enforcement.py` | P0, Auth/Audit | Audit-Endpoints mit/ohne Token (401/403) |
| `test_financial_tracking_endpoints.py` | P1, Financial | GET/POST /financial-tracking, budget-alerts, summary, monitor, comprehensive-report |
| `test_tenant_isolation_api.py` | Security | Audit-Lesepfade erreichbar; Tenant-Isolation im Handler |

## Wie neue Route-Tests ergänzen

1. **Literal-Route (Route-Order absichern)**  
   In `backend/tests/test_api_literal_routes.py` in `LITERAL_ROUTES` eintragen (Method, Pfad, erlaubte Status). Kein 422 in `allowed`, sofern die Route korrekt vor parametrisierten Routen definiert ist.

2. **Dedizierter Endpoint-Test**  
   - Neues Modul z. B. `tests/test_<bereich>_endpoints.py` oder in bestehendes (z. B. `test_workflow_instance_endpoints.py`) integrieren.
   - Mit `TestClient(app)` die volle URL (Prefix + Pfad) aufrufen.
   - Mindestens: erwarteter Status (200/201/401/404), optional Response-Schema oder Key-Checks.

3. **Priorität wählen**  
   Anhand der Tabelle oben: P0 zuerst, dann P1, dann P2.

---

## Script: Routen aus der App auslesen (optional)

Zum periodischen Aktualisieren der Übersicht kann die OpenAPI-Spec genutzt werden:

**Ausführung:** Aus dem Backend-Verzeichnis `backend/` ausführen:
```bash
cd backend && python scripts/list_routes.py
```

Das Script `backend/scripts/list_routes.py` importiert die App, ruft `app.openapi()` auf und gibt alle Routen als `METHOD path` aus. Damit lassen sich neue Routen finden und mit dieser Tabelle abgleichen.
