# .kiro/specs – Prioritäten für „10x besser als Cora PPM“

Kurzüberblick: Welche Specs/Tasks aus `.kiro/specs` sollten noch umgesetzt werden, um die PPM-App klar von Cora PPM abzuheben? Fokus auf **noch offene** Tasks mit hohem Differenzierungs- und Nutzwert.

---

## Bereits stark umgesetzt (wenig offen)

Diese Specs sind weitgehend erledigt und bilden schon heute einen Unterschied zu klassischem PPM:

| Spec | Status | Differenzierung |
|------|--------|-----------------|
| **workflow-engine** | Tasks weitgehend [x] | Approval-Workflows, Benachrichtigungen |
| **ai-empowered-audit-trail** | Backend/Services [x] | Anomalie-Erkennung, RAG-Suche, Timeline |
| **monte-carlo-risk-simulations** | Core [x] | Kosten-/Termin-Risikosimulationen |
| **integrated-change-management** | Core [x] | Change Requests, Impact-Analyse, Workflows |
| **project-controls-etc-eac** | Phasen 1–2 [x] | ETC/EAC, Earned Value, Forecasts |
| **costbook-4-0** | Phase 1 Basis [x] | Financials, KPIs, Visualisierungen |
| **shareable-project-urls** | Teilweise | Gast-Zugriff per Link |

Hier lohnt sich vor allem: **Frontend-Polish**, bessere **Sichtbarkeit** der Features und **Stabilisierung** (Tests, Fehlerbehandlung).

---

## Hohe Priorität – offen und stark differenzierend

### 1. **Features Overview** (`features-overview/`) – **umgesetzt**

- **Status:** Tasks 1–5 und 6.1, 6.2, 6.5 erledigt ([x] in tasks.md). Offen: 4.4 (optional), 6.3–6.4 (Unit/E2E-Tests).
- **Warum 10x:** Klickbarer Feature-Katalog mit Baum, Fuse-/AI-Suche, Detail-Karten, Admin CRUD, Webhook/Sync, Playwright-Screenshots.
- **Quick Win:** Bereits implementiert; optional Tests (6.3–6.4) und AI-Scan (4.4) ergänzen.

### 2. **AI Help Chat Enhancement** (`ai-help-chat-enhancement/`) – **teilweise umgesetzt**

- **Status:** HelpChatProvider mit **ChatContext** (route, pageTitle, userRole), pathname-basierte Aktualisierung; **Feedback**: API + UI; **Help Analytics Dashboard** (7.1–7.3, 7.8). Offen: HelpLogger-Schema, RAG-Doku-Erweiterung, Analytics-Property-Tests (7.4–7.7), Proactive-Tip-Engine (Tasks 1, 3–4, 7.4–7.7, 9).
- **Warum 10x:** Kontextbewusster Chat und Feedback bereits vorhanden; Rest ergänzt Support und Proaktivität.

### 3. **AI-Empowered PPM Features – Agent-UI** (`ai-empowered-ppm-features/`) – **ergänzt**

- **Status:** Resource Optimizer (AIResourceOptimizer.tsx), Risk (AIRiskManagement, PredictiveAnalyticsDashboard), ConfidenceBadge und Confidence-Darstellung vorhanden. **Ergänzt:** Retry-Button („Try Again“) in AIResourceOptimizer bei Fehlerzustand.
- **Warum 10x:** Sichtbare AI-Assistenten mit Confidence und Retry – Differenzierung zu Cora PPM.

### 4. **Register Nested Grids** (`register-nested-grids/`)

- **Status:** Erledigt u. a.: Admin Save (5.5), Expand-State + Filter-State-Persistenz (9.2, 16.5), State-Preservation-Property-Test (9.3). Offen: viele Property-Tests, Checkpoints 4/7/11/15, Drag&Drop (14.x), Filter Application (16.3), Retry/Error Boundaries, Performance, Costbook-Tests.
- **Warum 10x:** Generische, verschachtelbare Grids mit Berechtigungen, Filter, Drag&Drop und AI-Highlights – ideal für Costbook und Construction-spezifische Tabellen; übertrifft Standard-Grids in Cora PPM.
- **Pragmatisch:** Nächste Schritte: Checkpoints 7/11, Property-Tests (5.2, 5.4, 6.3, 6.4, 8.2, …), ggf. Drag&Drop (14.x), Filter Application (16.3).

---

## Mittlere Priorität – sichtbarer Nutzen

### 5. **AI Help Chat Knowledge Base** (`ai-help-chat-knowledge-base/`)

- **Offen:** u. a. Task 25–33 (Feature Detection, Gap-Dashboard, Query-based Gaps, CI/CD-Doku-Reminder, Templates, Doc-as-Code, File Watcher, Workflow-Automation).
- **Warum 10x:** Doku bleibt aktuell, Lücken werden automatisch erkannt – weniger veraltete Help-Texte als bei klassischem PPM.


### 7. **Integrated Master Schedule** (`integrated-master-schedule/`)

- **Warum 10x:** Ein integrierter Master-Plan über Projekte hinweg ist in Construction/Engineering ein Kernbedarf und hebt sich von isolierten Projektplänen ab.

### 8. **SAP PO Breakdown Management** (`sap-po-breakdown-management/`)

- **Warum 10x:** Direkte SAP/PO-Integration und Breakdown für Bau/Engineering – stark domänenspezifisch.

---

## Niedrigere Priorität (Stabilität / Basis)

- **Dashboard-Layout-Fix, Design-System-Consistency, React-Rendering-Error-Fixes:** Weniger „10x-Feature“, aber wichtig für Zuverlässigkeit und einheitliches Erlebnis.
- **Enterprise-Test-Strategy, Pre-Startup-Testing, Property-Based-Testing:** Qualität und Regression – indirekt „10x“ durch weniger Ausfälle.

---

## Empfohlene Reihenfolge für „10x besser als Cora PPM“

1. ~~**Features Overview (MVP)**~~ – **erledigt** (Task 1–5, 6.1–6.2, 6.5; optional 6.3–6.4 Tests).  
2. ~~**AI Help Chat Enhancement (Phase 1)**~~ – **teilweise erledigt** (ChatContext, Feedback, Help Analytics Dashboard 7.1–7.3; offen: HelpLogger, RAG, Proactive Tips, Property-Tests).  
3. ~~**AI-PPM Frontend**~~ – **ergänzt** (Agent-UIs + Confidence vorhanden; Retry-Button in Resource Optimizer ergänzt).  
4. ~~**Register Nested Grids (Save & Expand State)**~~ – **erledigt** (5.5 Admin Save Logic, 9.2 Expand-State-Persistenz).  
5. **Register Nested Grids (nächste Schritte):** Checkpoint 7/11, Property-Tests (5.2, 5.4, 6.3, 6.4, 8.2, …), ggf. Drag&Drop (14.x), Filter Application (16.3). *(5.5, 9.2, 9.3, 16.5 erledigt.)*  
6. **AI Help Chat (nächste Schritte):** Task 1 (Schema/help_logs abgleichen), Task 3 (HelpLogger), Task 7.4–7.7 (Analytics-Property-Tests), Task 9 (Proactive Tip Engine). *(7.1–7.3, 7.8 erledigt.)*  
7. **Mobile-First (ausgewählte Tasks):** Vor allem Bereiche mit hoher Feldnutzung (Costbook, Dashboard).

---

## Referenzen

- Alle Specs: `.kiro/specs/*/requirements.md`, `tasks.md`
- Bereits umgesetzte API-Route-Tests: `__tests__/api-routes/`
- Test-Lücken: `docs/fehlende-tests-uebersicht.md`
