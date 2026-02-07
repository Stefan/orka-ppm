# Cora-Surpass Roadmap – Tasks

## Phase 1 (4–6 Wochen)

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

## Phase 2 (6–8 Wochen)

| Sub-Task | Beschreibung | Abhängigkeiten | Tools |
|----------|--------------|----------------|--------|
| Workflow-Builder | react-flow: Drag&Drop-Knoten (Steps), Kanten, Eigenschaften-Panel; Steps-Definition wie workflow-engine/design | Phase 1 | react-flow, react-dnd |
| AI-Mapping-Service | OpenAI/Embeddings für Feld-Matching bei Imports; Mapping-Regeln speicherbar | Phase 1 | OpenAI API |
| No-Code-Views | Saved Views + AI-Empfehlung für Filter/Layout | Phase 1 | - |

---

## Phase 3 (8–10 Wochen)

| Sub-Task | Beschreibung | Abhängigkeiten | Tools |
|----------|--------------|----------------|--------|
| AI-Audit-Insights | [audit_anomaly_service.py](backend/services/audit_anomaly_service.py) erweitern; Timeline mit AI-Tags, semantische Suche (RAG) | Phase 2 | Sentry, OpenAI |
| Proaktive Compliance-Toasts | Toasts/Banner bei Anomalien; „Vorschlag: Überprüfe Key“ | Phase 2 | Bestehendes Toast-System |
| AI-Benefits in Reports | Kurzfassungen, Empfehlungen, Trend-Hinweise in Dashboards | Phase 2 | Recharts, OpenAI |
| Copilot-Chat-Integration | Kontextbezogener Assistent; Integration mit Help-Chat | Phase 2 | OpenAI API |
