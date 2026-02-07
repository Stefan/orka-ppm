# ERP & System-Integrationen – Design

## Architektur

- **Backend (FastAPI):** Abstrakte Adapter-Klasse + Implementierungen pro System. Router: `POST /api/integrations/{system}/sync`, `GET/PUT /api/integrations/config` (oder `/api/integrations/{system}/config`). Config in DB oder env; Keys nie im Frontend dauerhaft.
- **Frontend (Next.js):** Admin-Seite `/admin/integrations` mit Tabelle (Name, Status, Config-Button), Modal für API Key/URL. Costbook: Sync-Button ruft Next.js API Route auf, die Backend-Sync triggert; Toast für Erfolg/Fehler.
- **Sync-Flow:** User klickt Sync → Frontend POST `/api/integrations/sync` (oder `/api/v1/erp/sync` mit adapter) → Backend wählt Adapter, lädt Config, führt sync_commitments/sync_actuals aus → Response (inserted, updated, errors) → Frontend zeigt Toast.

## Admin Page
- **Layout:** Tailwind; Tabelle mit Spalten: Name (SAP, Microsoft Dynamics, Oracle NetSuite, Jira, Slack), Status (Enabled/Disabled), Last Sync, Actions (Config, Sync).
- **Config-Modal:** Pro System Felder (z. B. SAP: API URL, Client, API Key; Jira: Base URL, Token; Slack: Webhook URL). Speichern → PUT Config an Backend.

## Costbook
- **Sync-Button:** In CostbookHeader oder neben Refresh: Icon (lucide-react `RefreshCw` oder `Sync`). Bei Klick: POST Sync mit Default-Adapter (SAP oder aus Kontext); bei Erfolg Toast „Sync erfolgreich – X neue Commitments“, bei Fehler Toast mit Meldung.
- **AI-Mapping (Phase 2):** Separater Bereich oder Modal „Field Mapping“: Liste externes Feld → PPM-Feld; AI-Vorschläge anzeigen und bestätigen.

## Datenfluss Sync
1. Frontend: `POST /api/integrations/sync` Body: `{ system: 'sap', entity: 'commitments', organization_id?: string }`.
2. Backend: Lädt Config für `system`, instanziiert Adapter, ruft `adapter.sync_commitments(organization_id)` auf.
3. Adapter: Holt Daten von externem System (REST/RFC), mappt auf PPM-Schema, schreibt in commitments/actuals (über bestehende Services).
4. Response: `{ inserted, updated, errors, synced_at }`.
5. Frontend: Toast + ggf. Refresh der Costbook-Daten.

## Konfigurationsspeicher
- Option A: Tabelle `integration_config` (system, key, value_encrypted, updated_at). Option B: Pro System eine JSON-Config-Spalte. Keys nie im Log oder Frontend-Response loggen.

## Sicherheit
- Nur Rollen mit Admin/Integration-Recht dürfen Config ändern und Sync auslösen. Sync-Endpoint mit `Depends(get_current_user)` und Rollenprüfung.
