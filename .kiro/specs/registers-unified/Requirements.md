# Requirements: Unified Register-Arten (PPM Registers)

## Introduction

Integration und Weiterentwicklung von **Register-Arten** in der PPM-SaaS-App. Jede Register-Art ist 10x besser als Standard: AI-gestützt, interaktiv, proaktiv, mit erweiterten Ideen (AR-Overlay, Blockchain-Audit, Sustainability-Score, Voice-to-Action, Gamified Tracker, Natural Language Generation). Priorisierung nach Impact.

## Glossary

- **Register**: Ein typisierter Eintrags-Container (Risk, Change, Cost, Issue, Benefits, Lessons Learned, Decision, Opportunities) mit einheitlichem Datenmodell (`registers` Tabelle: type, project_id, organization_id, data jsonb, status).
- **Register-Art (type)**: Einer der Werte `risk` | `change` | `cost` | `issue` | `benefits` | `lessons_learned` | `decision` | `opportunities`.
- **Entry**: Ein einzelner Eintrag in einem Register (eine Zeile in der Tabelle mit type-spezifischen Feldern in `data`).
- **Unified View**: Eine gemeinsame UI unter `/app/registers` mit Type-Selector, Grid/Table und Nested Grids on Expand.
- **AI-Recommendations**: Automatische Vorschläge (Auto-Fill, Priorisierung, Predictions, Summaries) pro Register-Art.
- **Proactive Alerts**: Supabase Realtime-basierte Benachrichtigungen bei Änderungen oder Schwellenwerten.
- **10x UX**: No-Pop-ups (Inline-Panels), Mobile-First, Gamification (Badges), interaktive Nested Grids (ag-grid Inline-Editing).

## Priority Order (Impact)

1. **Risk** – AI-Prediction, Auto-Alerts, Gamified Tracker, optional AR-Overlay
2. **Change** – AI-Impact-Sims, Blockchain-Audit-Trail (optional)
3. **Cost** – AI-Optimierung EAC/ETC, Sustainability-Score
4. **Issue/Action** – AI-Priorisierung, Voice-to-Action
5. **Benefits** – AI-ROI-Forecast
6. **Lessons Learned** – AI-Summary aus Logs, Natural Language Generation
7. **Decision** – AI-Vorschläge
8. **Opportunities** – AI-Scoring

## Functional Requirements

### R1: Data Model & Storage

- **R1.1** Das System SHALL persistieren Register-Einträge in einer Tabelle `registers` mit: `id`, `type` (text), `project_id` (nullable), `organization_id`, `data` (jsonb für type-spezifische Felder), `status`, `created_at`, `updated_at`.
- **R1.2** Der Typ SHALL einer der Werte sein: `risk`, `change`, `cost`, `issue`, `benefits`, `lessons_learned`, `decision`, `opportunities`.
- **R1.3** RLS SHALL Zugriff auf `registers` nach `organization_id` (und optional project) beschränken (is_org_admin oder organization_id IN get_user_visible_org_ids).

### R2: API (Backend)

- **R2.1** Es SHALL Endpoints geben: `GET/POST /api/registers/{type}`, `GET/PUT/DELETE /api/registers/{type}/{id}` (CRUD pro Typ).
- **R2.2** Es SHALL einen Endpoint geben: `POST /api/registers/{type}/recommend` oder `GET /api/registers/{type}/ai-recommendations` für AI-Auto-Fill/Recommendations.
- **R2.3** Filter SHALL unterstützt werden: `project_id`, `organization_id`, `status`, Pagination (limit/offset).

### R3: Unified Frontend View

- **R3.1** Eine Seite `/app/registers` SHALL eine Unified View bereitstellen mit: Type-Selector (Dropdown), Grid/Table der Einträge, Nested Grids on Expand.
- **R3.2** Register-Cards SHALL Tailwind flex nutzen, mit AI-Suggest Button, Status-Dot, Progress-Bar; Hover SHALL Details anzeigen.
- **R3.3** Modals SHALL vermieden werden wo möglich; Inline-Panels SHALL bevorzugt werden (No-Pop-ups). Optional: No-Code Builder für Custom Fields/Workflows (react-flow).

### R4: AI & Proaktivität

- **R4.1** Risk: AI-Prediction (z. B. Wahrscheinlichkeit/Impact) und Auto-Alerts bei Schwellenwerten.
- **R4.2** Change: AI-Impact-Simulationen (Kosten/Zeit).
- **R4.3** Cost: AI-Optimierung EAC/ETC.
- **R4.4** Issue/Action: AI-Priorisierung und optional Voice-to-Action.
- **R4.5** Benefits: AI-ROI-Forecast; Lessons Learned: AI-Summary aus Logs / NLG.
- **R4.6** Decision: AI-Vorschläge; Opportunities: AI-Scoring.
- **R4.7** Proaktive Alerts SHALL über Supabase Realtime oder Polling unterstützt werden.

### R5: 10x UX & Grandiose Features

- **R5.1** Interaktive Nested Grids mit ag-grid und Inline-Editing.
- **R5.2** Mobile-First Layout; Gamification (Badges) für Fortschritt/Qualität.
- **R5.3** Optional (Roadmap): AR-Overlay (Risk), Blockchain-Audit (Change), Sustainability-Score (Cost), Voice-to-Action (Issue), Gamified Tracker, Natural Language Generation (Lessons Learned).

## Non-Functional Requirements

- **NFR1** Alle Register-Listen SHALL mit Suspense und sinnvollen Loading-States testbar sein.
- **NFR2** API SHALL mit bestehendem Auth (JWT / get_current_user) gesichert sein.
- **NFR3** Frontend SHALL mit Next.js 16, Tailwind, Recharts (wo Visuals nötig) und bestehender Design-System-Integration umgesetzt werden.

## Dependencies

- Bestehendes Datenmodell: `projects`, `commitments`, `actuals` (für Cost/Integration).
- Supabase (RLS, Realtime), FastAPI (Backend), Next.js App Router.
