# ERP & System-Integrationen – Requirements

## Kontext
PPM-SaaS (Next.js 16 + Tailwind + Recharts + Supabase + FastAPI). Priorität: SAP (Financial Imports), Microsoft Dynamics/PPM (Project Sync), Oracle NetSuite (Accounting), Jira (Agile Tasks), Slack (Notifications). Jede Integration 10x besser: AI-gestützt, Auto-Config, Real-time Sync, proaktive Alerts.

## Datenmodell (Referenz)
- **projects:** id, budget, health, name, status, start_date, end_date
- **commitments:** id, project_id, total_amount, po_number, po_status, vendor, currency, po_date, po_line_nr, po_line_text, vendor_description, requester, cost_center, wbs_element, account_group_level1, account_subgroup_level2, account_level3, custom_fields
- **actuals:** id, project_id, amount, po_no, vendor_invoice_no, posting_date, status, currency, vendor, vendor_description, gl_account, cost_center, wbs_element, item_text, quantity, net_due_date, custom_fields

## Funktionale Anforderungen

### Adapter-Pattern
- **FR-1** Abstrakte ErpAdapter-Class (Backend) mit einheitlichen Methoden: `fetchCommitments`, `syncProjects`, `syncActuals` (und ggf. `fetchProjects`). Jedes System hat eine konkrete Implementierung (SAP, Microsoft, Oracle, Jira, Slack).
- **FR-2** Konfiguration pro System: API-URL, API-Key/Token, Mandant/Client (wo anwendbar). Config wird pro Connector gespeichert und bei Sync verwendet.

### Admin-UI
- **FR-3** Route `/admin/integrations`: Tabelle mit allen Connectors (Name, Status Enabled/Disabled, letzter Sync, Fehler). Button „Config“ öffnet Modal mit Formular (API Key, URL, etc.).
- **FR-4** Enable/Disable pro Connector ohne Config zu löschen.

### Real-time Sync
- **FR-5** Webhooks oder Polling für Updates (z. B. SAP-PO → commitments). Bei Polling: konfigurierbares Intervall; bei Webhook: Endpoint registrierbar.
- **FR-6** Nach Sync: Rückmeldung (inserted, updated, errors) und optional Anomaly-Check auf neu/geänderten Daten.

### AI-Verbesserung
- **FR-7** Auto-Mapping: AI matcht externe Felder auf PPM-Schema (z. B. „SAP PO_Number“ → commitments.po_number). Mapping-Regeln speicherbar und editierbar.
- **FR-8** Anomaly-Checks nach Sync (Varianzen, Duplikate, fehlende Pflichtfelder) mit Hinweisen in UI.

### Costbook-Integration
- **FR-9** Im Costbook: Sync-Button (z. B. Sync-Icon), der den aktuell gewählten Adapter/Entity-Sync auslöst. Toast: „Sync erfolgreich – X neue Commitments“ bzw. Fehlermeldung.

### Tests
- **FR-10** E2E mit Playwright: Sync-Flow simulieren (Config speichern, Sync anstoßen, Erfolg/Fehler prüfen).

## Nicht-funktionale Anforderungen
- **NFR-1** Konfiguration (API Keys) nur serverseitig speichern; Frontend sendet Config an Backend, Backend speichert verschlüsselt oder in env/DB.
- **NFR-2** Sync-Laufzeit begrenzen (Timeout); große Datenmengen in Batches.
- **NFR-3** Logging und Audit für Sync-Starts/Erfolge/Fehler.

## Priorisierung (Roadmap)
- **Phase 1 (Basis):** SAP + Microsoft – Basis-Sync + Config-UI.
- **Phase 2 (AI):** Oracle + Jira – AI-Mapping + Real-time-Option.
- **Phase 3 (Erweitert):** Slack – proaktive Alerts + Full Auto-Sync.
