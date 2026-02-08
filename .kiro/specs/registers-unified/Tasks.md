# Tasks: Unified Register-Arten

## Task 1: Supabase-Tabellen für Registers + RLS

- **1.1** Migration anlegen: `061_registers_unified.sql`
- **1.2** Tabelle `registers` erstellen: id, type (text CHECK), project_id (FK projects), organization_id (UUID), data (jsonb), status (text), created_at, updated_at
- **1.3** Indizes: type, organization_id, project_id, (type, organization_id), updated_at
- **1.4** RLS aktivieren; Policies für SELECT/INSERT/UPDATE/DELETE (is_org_admin OR organization_id IN get_user_visible_org_ids)
- **1.5** Optional: Trigger für updated_at

**Acceptance:** Migration läuft fehlerfrei; RLS schränkt Zugriff auf Organisation ein.

---

## Task 2: Backend Endpoints /api/registers/{type} (CRUD + AI-Recommendations)

- **2.1** Pydantic-Modelle: RegisterCreate, RegisterUpdate, RegisterResponse (data als dict)
- **2.2** Router `registers.py` mit Prefix `/api/registers`; Dependency get_current_user
- **2.3** GET/POST `/api/registers/{type}` (List, Create); GET/PUT/DELETE `/api/registers/{type}/{id}`
- **2.4** Query-Parameter: project_id, status, limit, offset für List
- **2.5** POST `/api/registers/{type}/ai-recommend` (Stub oder Integration Grok/OpenAI): Kontext annehmen, type-spezifische Empfehlungen zurückgeben (z. B. data-Vorschläge)
- **2.6** Router in main.py einbinden

**Acceptance:** CRUD und Recommend über FastAPI testbar; Auth erforderlich.

---

## Task 3: Frontend RegistersPage mit Grid + Nested

- **3.1** Next.js API-Route: Proxy zu Backend (z. B. `app/api/registers/[...path]/route.ts`)
- **3.2** Types (registers.ts): RegisterType, RegisterEntry, ListResponse, Filters
- **3.3** Hooks: useRegisters(type, filters), useRegisterRecommend(type)
- **3.4** Seite `app/registers/page.tsx`: Layout mit Suspense, RegisterTypeSelector, Toolbar (Filter, Add, AI Suggest), RegisterGrid (Table/Grid mit Expand für Nested)
- **3.5** RegisterCard-Komponente: Tailwind flex, Status-Dot, Progress-Bar, AI-Suggest Button, Hover-Details
- **3.6** Nested Grid: Bei Expand einer Zeile Untereinträge (z. B. Mitigations für Risk) anzeigen – Daten aus `data` oder separatem Endpoint

**Acceptance:** Seite lädt; Type-Wechsel zeigt passende Einträge; CRUD und AI-Suggest angebunden; testbar mit Suspense.

---

## Task 4: AI-Integration (Predictions/Summaries)

- **4.1** Risk: AI-Prediction (probability/impact) in ai-recommend oder separatem Endpoint
- **4.2** Change: AI-Impact-Simulation (Stub oder echte Berechnung)
- **4.3** Cost: EAC/ETC-Optimierungsvorschläge
- **4.4** Issue: Priorisierungsvorschläge; optional Voice-to-Action (Sprache-zu-Text-API)
- **4.5** Benefits/Lessons/Decision/Opportunities: Stub-Empfehlungen mit type-spezifischen Feldern

**Acceptance:** Pro Register-Art mindestens ein AI-Feature (Stub oder integriert) nutzbar.

---

## Task 5: Grandiose Features (AR, Blockchain, Sustainability, Voice, Gamification, NLG)

- **5.1** Risiko: Optional AR-Overlay-Platzhalter (UI-Hinweis oder Link); Gamified Tracker (Badges für „Risiko gemindert“, „Review abgeschlossen“)
- **5.2** Change: Optional Blockchain-Audit (Stub: „Audit-Trail“-Badge oder Hash-Darstellung)
- **5.3** Cost: Sustainability-Score (Feld in data + Anzeige)
- **5.4** Issue: Voice-to-Action (Button „Per Sprache erfassen“ → Web Speech API oder Stub)
- **5.5** Lessons Learned: NLG (Stub: „Zusammenfassung generieren“)
- **5.6** Proaktive Alerts: Supabase Realtime Subscription auf `registers` (optional) oder Polling

**Acceptance:** Pro Phase mindestens ein „grandioses“ Feature pro priorisierter Register-Art als Stub oder MVP integriert.

---

## Roadmap Phasen

- **Phase 1 (4–6 Wochen):** Basis Registers (Risk, Change, Cost) mit Custom Fields (data jsonb) + Nested Grids. Tasks 1, 2, 3 für diese Typen.
- **Phase 2 (6–8 Wochen):** AI-Verbesserungen (Predictions, Recommendations) + Issue/Benefits. Task 4; Erweiterung Task 3.
- **Phase 3 (8–10 Wochen):** Customizing (Workflow-Builder), Grandiose Ideen (AR, Blockchain, Sustainability, Voice, Gamification, NLG). Task 5; No-Code Builder optional.
