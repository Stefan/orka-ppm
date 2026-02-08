# Cora-Surpass Roadmap – Tasks

## Phase 1 (4–6 Wochen) ✅ abgeschlossen

- **Abschluss:** Caching (projects, commitments, actuals), Pagination-Schema, Adapter-Registry, Suspense-kompatibel umgesetzt.
- Referenz: [docs/cora-surpass-phase1-backend.md](../../docs/cora-surpass-phase1-backend.md).

---

### 1.1 Caching für zentrale Listen

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Redis/Response-Cache Projects | GET-Liste projects mit `limit`/`offset`; Response-Cache (Redis oder In-Memory) Key `projects:list:{org_id}:{offset}:{limit}`, TTL 60–120 s | Redis verfügbar, [redis_cache_service.py](backend/services/redis_cache_service.py) | 1–2 d | Requirements FR-S1, Design Caching-Layer |
| Cache commitments/actuals | GET commitments + GET actuals (csv-import) mit limit/offset cachen; Key org + Pagination; TTL 60 s | Wie oben | 1 d | Design Caching-Layer |
| Frontend Cache-Option | Optional in einem Hook (z. B. Projects-Liste oder Financials) `cache`/`staleTime` nutzen (vgl. [lib/pmr-api.ts](lib/pmr-api.ts)) | - | 0.5 d | FR-S1 |
| Test | Unit/Integration: bei aktivem Redis Cache-Hit prüfen (oder Mock); optional Property-Test Cache-Key-Idempotenz | - | 0.5 d | - |

**Tools:** Redis, [backend/services/redis_cache_service.py](backend/services/redis_cache_service.py).

---

### 1.2 Pagination vereinheitlichen

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Gemeinsames Pagination-Schema | Schema `limit`, `offset` (oder `page`, `page_size`) für Listen-Endpoints; in OpenAPI dokumentieren | - | 0.5 d | [change_request_manager.py](backend/services/change_request_manager.py) |
| limit/offset in Routern | projects, commitments, actuals: wo fehlend `limit`/`offset` ergänzen | - | 0.5 d | Design Caching-Layer |
| Frontend | CommitmentsTable/ActualsTable limit/offset (oder page) übergeben; Loading/Suspense unterstützen | - | 0.5 d | Requirements FR-S2 |

---

### 1.3 Adapter-Registry & Integrations-Router

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Adapter-Registry | In [erp_adapter.py](backend/services/erp_adapter.py) Registry (Dict nach `adapter_type`); `get_erp_adapter` nutzt Registry; neue Adapter nur registrieren | ErpAdapter-Interface vorhanden | 0.5 d | Design Adapter-Registry |
| Integrations-Router | Sicherstellen, dass Sync-Aufruf konkrete Implementierung (SapErpAdapter, CsvErpAdapter, …) auswählt und `sync_commitments`/`sync_actuals` aufruft | Registry | 0.5 d | [integrations.py](backend/routers/integrations.py) |
| Frontend | Keine Pflichtänderung [ErpAdapter.ts](lib/integrations/ErpAdapter.ts) / [integrations/page.tsx](app/admin/integrations/page.tsx); ggf. Fehlerbehandlung/Typen | - | optional | - |

**Tools:** [backend/services/erp_adapter.py](backend/services/erp_adapter.py), [backend/routers/integrations.py](backend/routers/integrations.py).

---

### 1.4 Testbarkeit mit Suspense

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Suspense-kompatibel | Dort, wo neue/gecachte Datenladung (z. B. Projects-Liste) eingebunden wird: Komponente so belassen oder umschließen, dass unter React Suspense lauffähig (lazy oder Fetch mit Boundary); keine künstlichen Delays | Caching, Pagination | 0.5 d | Plan 2.4 |

---

## Phase 2 (6–8 Wochen) ✅ umgesetzt

### 2.1 Workflow-Builder (No-Code) ✅

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| react-flow einbinden | Paket `@xyflow/react` (react-flow) installieren; Canvas-Komponente mit Controls, MiniMap optional | Phase 1 | 0.5 d | Design Workflow-Builder |
| Step-Knoten-Typen | Custom Nodes für Step-Typ (APPROVAL, NOTIFICATION, CONDITION); Drag aus Sidebar oder Toolbox | - | 1 d | [workflow-engine/design.md](../workflow-engine/design.md) WorkflowStep |
| Kanten & Validierung | Edges zwischen Steps; beim Speichern prüfen: mind. ein Step, keine isolierten Knoten (optional) | Step-Knoten | 0.5 d | - |
| Eigenschaften-Panel | Bei Knoten-Auswahl: Panel für step_type, approvers, timeout_hours, conditions | Step-Knoten | 1 d | Design Eigenschaften-Panel |
| Backend-Anbindung | Workflow-Definition (JSON) an POST /workflows/ oder bestehenden Endpoint senden; Response/Fehler anzeigen | Backend workflows API | 0.5 d | [workflow-engine/design.md](../workflow-engine/design.md) |
| Admin-Seite | Route z. B. `/admin/workflow-builder` oder `/workflows/builder`; nur für Berechtigung workflow_manage | - | 0.5 d | - |

**Umsetzung:** [app/admin/workflow-builder/page.tsx](../../app/admin/workflow-builder/page.tsx), [WorkflowCanvas.tsx](../../app/admin/workflow-builder/WorkflowCanvas.tsx), POST /workflows mit step_type, timeout_hours, conditions. **Tools:** @xyflow/react (react-flow), ggf. react-dnd für Toolbox.

### 2.2 AI-Mapping-Service (Imports) ✅

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Embedding-Service | Backend: Service der CSV-Header/Extern-Felder auf PPM-Schema (commitments/actuals) mappt; OpenAI Embeddings oder einfache Heuristik | Phase 1 | 1–2 d | Requirements FR-I3 |
| Mapping-Regeln speichern | Speicherbare Konfiguration (z. B. org_id + source_system → Feld-Map); DB-Tabelle oder JSON in Config | - | 1 d | - |
| Import-UI erweitern | Beim CSV-Upload Mapping-Vorschläge anzeigen; Nutzer kann anpassen und übernehmen | Embedding-Service | 1 d | - |

**Tools:** OpenAI API (Embeddings), Backend [csv_import](backend/routers/csv_import.py).

**Umsetzung:** Service [services/csv_mapping_suggestions.py](backend/services/csv_mapping_suggestions.py); Endpoint `POST /csv-import/suggest-mapping`; Migration 060_csv_import_mappings.sql; Import-UI mit Mapping-Vorschau (CSVImportView). ✅

### 2.3 No-Code-Views ✅

| Sub-Task | Beschreibung | Abhängigkeiten | Dauer | Referenz |
|----------|--------------|----------------|-------|----------|
| Saved Views Modell | Backend/DB: gespeicherte View-Definitionen (Filter, Sortierung, Spalten) pro User/Org | Phase 1 | 0.5 d | Requirements FR-C2 |
| AI-Empfehlung | Optional: aus Nutzerverhalten (z. B. häufig genutzte Filter) Vorschläge für „View speichern“ | Saved Views | 0.5 d | - |
| UI: View auswählen/speichern | Dropdown oder Sidebar „Saved Views“; „Aktuelle Ansicht speichern“; Apply View | - | 1 d | - |

**Umsetzung:** Migration `059_saved_views.sql`, Model `models/saved_views.py`, Router `routers/saved_views.py` (GET/POST/PATCH/DELETE). Frontend: `lib/saved-views-api.ts`, `components/saved-views/SavedViewsDropdown.tsx`; Integration in Financials (CommitmentsActualsView). Apply-Logik umgesetzt. ✅

---

## Phase 3 (8–10 Wochen) ✅ umgesetzt

| Sub-Task | Beschreibung | Abhängigkeiten | Tools | Status |
|----------|--------------|----------------|--------|--------|
| AI-Audit-Insights | [audit_anomaly_service.py](backend/services/audit_anomaly_service.py); Timeline mit Anomalie-Filter, semantische Suche (API /api/audit/search) | Phase 2 | Sentry, OpenAI | ✅ |
| Proaktive Compliance-Toasts | Toasts bei Anomalien (Audit-Seite: „Anomalien erkannt – Vorschlag: Überprüfe Einträge“) | Phase 2 | [Toast.tsx](components/shared/Toast.tsx) | ✅ |
| AI-Benefits in Reports | Kurzfassung/Empfehlungs-Karte auf Dashboard (AI Insights Card) | Phase 2 | Recharts, OpenAI | ✅ |
| Copilot-Chat-Integration | Help-Chat mit Kontext (pathname, entityType, entityId) in [help-chat/context](app/api/help-chat/context/route.ts) | Phase 2 | OpenAI API | ✅ |
