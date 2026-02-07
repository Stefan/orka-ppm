# Cora-Surpass Roadmap – Requirements

## Kontext

PPM-SaaS (Next.js 16, Tailwind, Recharts, Supabase, FastAPI). Ziel: In allen Bereichen **Cora übertreffen** durch 10x-Verbesserungen (AI-gestützt, interaktiv, proaktiv). Datenmodell (Supabase):

- **projects:** id, budget, health, name, status, start_date, end_date
- **commitments:** id, project_id, total_amount, po_number, po_status, vendor, currency, po_date, po_line_nr, po_line_text, vendor_description, requester, cost_center, wbs_element, account_group_level1, account_subgroup_level2, account_level3, custom_fields
- **actuals:** id, project_id, amount, po_no, vendor_invoice_no, posting_date, status, currency, vendor, vendor_description, gl_account, cost_center, wbs_element, item_text, quantity, net_due_date, custom_fields

---

## Phasen-Ziele

### Phase 1 (4–6 Wochen) – Basis für Konkurrenz

- **Scalability:** Caching und Pagination für zentrale Listen (projects, commitments, actuals). 10x: AI-optimized Queries (Query-Optimierung, Cache-Key-Strategie), einheitliche Response-Zeiten.
- **Integration Basis:** Adapter-Class (ErpAdapter) mit einheitlicher API; Registry für SAP, CSV, ggf. Microsoft. 10x: Einheitliche Adapter-API, leichte Erweiterbarkeit.

### Phase 2 (6–8 Wochen) – Überlegenheit

- **Customizability:** No-Code Workflow-Builder, AI-empfohlene Views. 10x: Drag&Drop (react-flow), Auto-Config durch AI-Vorschläge.
- **Integration Erweiterung:** AI-Auto-Mapping für Imports (externe Felder → PPM-Schema). 10x: Automatisches Feld-Matching, editierbare Mapping-Regeln.

### Phase 3 (8–10 Wochen) – 10x besser

- **Compliance & Governance:** AI-Audit-Insights, proaktive Compliance-Alerts. 10x: Proaktive Toasts/Banner, Anomalie-Scores, vorgeschlagene Aktionen.
- **Analytics & Reporting:** AI-Benefits in Reports (Zusammenfassungen, Empfehlungen). 10x: Nutzung bestehender AI-Stärke, Predictive Insights.
- **AI & Innovation:** Copilot-Chat, Predictive Simulations; im Marketing betonen.

---

## Funktionale Anforderungen nach Bereich

### Integration & Ecosystem

- **FR-I1** Abstrakte Adapter-API (sync_commitments, sync_actuals) mit konkreten Implementierungen (SAP, CSV, Microsoft, Oracle, Jira, Slack). Phase 1: Basis; Phase 2: Erweiterung.
- **FR-I2** Konfiguration pro System (API-URL, Key, Mandant) in Admin-UI; Enable/Disable ohne Config zu löschen.
- **FR-I3** 10x: AI-Auto-Mapping (Phase 2) – externe Felder auf PPM-Schema mappen; Mapping-Regeln speicherbar und editierbar.
- **FR-I4** Nach Sync: Rückmeldung (inserted, updated, errors) und optional Anomaly-Check.

### Customizability & Configuration

- **FR-C1** No-Code Workflow-Builder (Phase 2): Drag&Drop-Knoten (Steps), Kanten, Eigenschaften-Panel; Technik react-flow.
- **FR-C2** AI-empfohlene Views: gespeicherte Views + AI-Vorschläge für Filter/Layout. 10x: Auto-Config aus Nutzerverhalten.

### Compliance & Governance

- **FR-G1** Audit mit AI-Insights (Phase 3): Anomalie-Erkennung, Timeline mit AI-Tags, semantische Suche (RAG).
- **FR-G2** Proaktive Compliance-Alerts: Toasts/Banner bei Auffälligkeiten; 10x: „Vorschlag: Überprüfe Key“-Style-Hinweise.

### Scalability & Performance

- **FR-S1** Caching für Listen (projects, commitments, actuals): Redis oder In-Memory-Fallback, TTL konfigurierbar; Cache-Key: org/tenant + Pagination.
- **FR-S2** Einheitliche Pagination (limit, offset oder page, page_size) für alle Listen-Endpoints; in OpenAPI dokumentiert.
- **FR-S3** 10x: AI-optimized Queries – wo sinnvoll Query-Vereinfachung oder Indizes empfehlen (Phase 2/3 optional).

### Analytics & Reporting

- **FR-A1** Bestehende Dashboards/Recharts beibehalten; Phase 3: AI-Benefits (Kurzfassungen, Empfehlungen, Trend-Hinweise).
- **FR-A2** 10x: Predictive Simulations (Monte Carlo, Risiko) stärker mit AI anreichern.

### AI & Innovation

- **FR-AI1** AI-Copilot-Chat (Phase 3): kontextbezogener Assistent für Projekte, Finanzen, Workflows.
- **FR-AI2** Predictive Simulations: bestehende Monte Carlo ausbauen; AI-gestützte Szenario-Vorschläge.
- **FR-AI3** Marketing: AI-Fähigkeiten klar als Differenzierung kommunizieren.

---

## Grandiose Ideen

| Idee | Beschreibung | Phase |
|------|--------------|--------|
| **AI-Copilot-Chat** | Kontextbezogener Chat (Projekt, Finanzen, Berichte); Integration mit Help-Chat und RAG. | Phase 3 |
| **Predictive Simulations** | Monte Carlo + AI-Szenario-Vorschläge; „Was-wäre-wenn“ mit natürlicher Sprache. | Phase 3 |
| **AR-Overlay** | Optional: AR-Ansicht für physische Projekt-Standorte (Proof-of-Concept). | Phase 3 (optional) |
| **Gamification** | Badges, Fortschrittsanzeigen, Ziele für Projekt-Meilensteine und Compliance. | Phase 2/3 |
| **Sustainability-Metrics** | CO2-/Ressourcen-Tracking pro Projekt; Berichte und KPIs. | Phase 2/3 |

---

## Nicht-funktionale Anforderungen

- **NFR-1** Konfiguration (API Keys) nur serverseitig; keine Secrets im Frontend.
- **NFR-2** Sync-Laufzeit begrenzen (Timeout); große Datenmengen in Batches.
- **NFR-3** Logging und Audit für Sync und kritische Aktionen.
- **NFR-4** Caching: bei Redis-Ausfall In-Memory-Fallback oder Cache-Skip; keine Blockierung.
