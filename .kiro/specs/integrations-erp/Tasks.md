# ERP & System-Integrationen – Tasks

## Task 1: Backend Adapter-Class + Implementierungen
- **1.1** Erweiterung/Neuanlage: Abstrakte Basis in Backend (z. B. `services/erp_adapter.py`) mit Methoden `sync_commitments`, `sync_actuals`, optional `sync_projects`. Bereits vorhanden: ErpAdapter, SapErpAdapter, CsvErpAdapter.
- **1.2** Implementierungen hinzufügen: MicrosoftDynamicsAdapter, OracleNetSuiteAdapter, JiraAdapter, SlackAdapter (Stubs mit klaren Rückgaben: total, inserted, updated, errors). Phase 1: SAP + Microsoft mit konfigurierbarem Host/Key; Phase 2: Oracle + Jira; Phase 3: Slack.
- **1.3** Frontend: `lib/integrations/ErpAdapter.ts` – Typen (SyncResult, IntegrationConfig), Konstanten (SYSTEM_NAMES), Hilfsfunktion `triggerSync(system, entity, token)` die API aufruft.

**Deliverable:** Erweiterte `backend/services/erp_adapter.py`, `lib/integrations/ErpAdapter.ts`.

---

## Task 2: FastAPI Endpoints /api/integrations
- **2.1** Router `routers/integrations.py` (oder unter `routers/integrations/router.py`) mit Prefix `/api/integrations`.
- **2.2** `GET /api/integrations/config` – Liste Connectors mit Status (enabled, last_sync). `GET /api/integrations/{system}/config` – Config für ein System (ohne sensible Werte in Response).
- **2.3** `PUT /api/integrations/{system}/config` – Config speichern (API URL, API Key, etc.). Body validieren, in DB/Config speichern.
- **2.4** `POST /api/integrations/{system}/sync` – Sync für ein System (Body: entity, organization_id). Ruft entsprechenden Adapter auf, gibt inserted/updated/errors zurück.
- **2.5** Main: Router registrieren.

**Deliverable:** `backend/routers/integrations.py`, Eintrag in `main.py`.

---

## Task 3: Frontend Admin Integrations Page
- **3.1** Route `/admin/integrations`: Seite `app/admin/integrations/page.tsx` mit Tailwind-Table (Name, Status, Last Sync, Actions). Daten: GET `/api/integrations/config` (via Next.js API Route).
- **3.2** Config-Button öffnet Modal: Formular mit Feldern (API URL, API Key, Client…) je nach System. Speichern → PUT `/api/integrations/{system}/config`.
- **3.3** Enable/Disable Toggle pro Zeile (optional: PATCH Status). Sync-Button pro Zeile → POST Sync, Toast mit Ergebnis.
- **3.4** Suspense + Loading-State für Tabelle.

**Deliverable:** `app/admin/integrations/page.tsx`, Next.js API Routes für `/api/integrations/*`.

---

## Task 4: Costbook Sync-Button + AI-Mapping (Basis)
- **4.1** Costbook.tsx: State für Sync (loading, last result). Handler `handleIntegrationSync(system?, entity?)` ruft `POST /api/v1/erp/sync` oder `POST /api/integrations/sync` auf (getApiUrl), zeigt bei Erfolg Toast „Sync erfolgreich – X neue Commitments“, bei Fehler Toast mit Fehlertext.
- **4.2** CostbookHeader: Prop `onSync?: () => void` und Sync-Button (Sync-Icon). Costbook übergibt `onSync={handleIntegrationSync}`.
- **4.3** (Phase 2) AI-Mapping: Platzhalter oder Link „Field Mapping“ in Admin/Integrations; Anzeige AI-Vorschläge (später).

**Deliverable:** Costbook.tsx + CostbookHeader.tsx mit Sync-Button und Toast.

---

## Task 5: Playwright E2E
- **5.1** Test: Admin-Integrations-Seite lädt, Tabelle oder leere State sichtbar.
- **5.2** Test: Config-Modal öffnen (z. B. SAP), Felder ausfüllen, Speichern (Backend mocken oder mit Test-Backend).
- **5.3** Test: Costbook öffnen, Sync-Button klicken, Toast erscheint (Erfolg oder Fehler).

**Deliverable:** `__tests__/e2e/integrations-sync.spec.ts` (oder in bestehende E2E-Struktur).

---

## Reihenfolge
1 → 2 → 3 → 4 → 5.

## Phasen
- **Phase 1:** Task 1.2 nur SAP + Microsoft; Task 2–4 vollständig; Task 5 Basis.
- **Phase 2:** Oracle + Jira Adapter; AI-Mapping UI; Real-time-Option.
- **Phase 3:** Slack Adapter; proaktive Alerts; Full Auto-Sync.
