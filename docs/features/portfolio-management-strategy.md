# Portfoliomanagement – Strategie und Integration („10x“-Ansatz)

## Warum nicht nur eine „Portfolio-Seite“?

Eine einzelne Seite mit Liste der Portfolios (analog zu Registers) reicht für echte PPM-Stärke nicht aus:

- **Wettbewerb:** Viele Tools haben „Portfolios“ als reine Kategorien oder Ordner – wenig Mehrwert.
- **Stärke von Orka PPM:** Portfolio als **Arbeitskontext** und **Steuerungsebene**: Alles (Dashboard, Projekte, Ressourcen, Finanzen, Risiken) ist portfolio-sensibel, mit klarem „Ich arbeite in Portfolio X“ und Roll-up für mehrere Portfolios.

Ziel: **Portfolio als durchgängiger Kontext** + **portfolio-spezifische Steuerung und Transparenz**, nicht nur eine CRUD-Liste.

---

## 1. Portfolio als Kontext („Workspace“)

### 1.1 Aktuelles Portfolio sichtbar und wechselbar

- **Portfolio-Selector in der Shell** (TopBar oder Sidebar), immer sichtbar:
  - Anzeige: „Aktuelles Portfolio: [Name]“
  - Dropdown: Liste der Portfolios, auf die der User Zugriff hat (RBAC).
  - Wechsel = Kontextwechsel: Dashboard, Projekte, ggf. Ressourcen/Finanzen reagieren auf das gewählte Portfolio.
- **Persistenz:** Auswahl in `localStorage` oder User-Preference (Backend), damit der Kontext beim nächsten Login erhalten bleibt.
- **Fallback:** Wenn der User nur ein Portfolio hat → automatisch auswählen und Selector optional/kompakt.

### 1.2 Technische Umsetzung Kontext

- **Frontend:** React Context (z.B. `PortfolioContext`) mit `currentPortfolioId` und `setCurrentPortfolioId`.
- **Provider** oberhalb der Hauptnavigation (z.B. in `AppLayout`), damit alle Seiten und die TopBar darauf zugreifen.
- **API-Aufrufe:** Wo fachlich sinnvoll, `portfolio_id` mitschicken:
  - Query-Parameter: `?portfolio_id=...`
  - Oder Header: `x-portfolio-id` (Backend unterstützt das bereits in RBAC).
- **Bereiche, die portfolio-sensibel werden sollen (priorisiert):**
  - Dashboard (KPIs, Projektliste, Widgets nur für aktuelles Portfolio).
  - Projekte-Liste (Filter „nur dieses Portfolio“ oder Default = aktuelles Portfolio).
  - Registers (optional: Filter nach Projekten des Portfolios).
  - Ressourcen (optional: nach Projekten/Portfolio filtern).
  - Finanzen (optional: Roll-up pro Portfolio).

---

## 2. Portfolio-Verwaltung (mehr als eine Liste)

### 2.1 Portfolio-Liste und -Detail

- **Route:** z.B. `/portfolios` (Übersicht) und `/portfolios/[id]` (Detail).
- **Liste:**
  - Karten oder Tabelle: Name, Beschreibung, Owner, Anzahl Projekte, ggf. Health/KPI-Summary.
  - Aktionen: Anlegen, Bearbeiten, (ggf. Archivieren). Löschen nur mit Sicherheitsabfrage („Projekte werden nicht gelöscht, nur Zuordnung …“).
- **Detailseite eines Portfolios:**
  - Steckbrief (Name, Beschreibung, Owner).
  - **Projekte in diesem Portfolio** (Teil der gleichen Seite oder Link „Projekte anzeigen“ mit Filter `portfolio_id`).
  - Optional: Platzhalter für „Portfolio-Dashboard“ (siehe Abschnitt 3).

### 2.2 Integration in die Navigation

- Eintrag **„Portfolios“** in der Hauptnav (Sidebar/TopBar), sichtbar für Rollen mit mindestens `portfolio_read`.
- „Portfolio anzeigen/verwalten“ von der Projektliste aus (z.B. Link „Zu Portfolio: X“) und umgekehrt von der Portfolio-Detailseite zu den Projekten.

---

## 3. Portfolio-Dashboard (Transparenz pro Portfolio)

- **Eigenes View pro Portfolio**, nicht nur das globale Dashboard:
  - Route z.B. `/portfolios/[id]` mit Tab „Übersicht“ / „Dashboard“.
  - Gleiche Widget-Idee wie das Haupt-Dashboard, aber **datengefühlt nur aus diesem Portfolio** (Projekte, KPIs, Risiken, Budget, Ressourcen).
- **Wiederverwendung:** Bestehende Dashboard-Komponenten und API-Calls mit `portfolio_id` füttern; Backend liefert gefilterte Daten.
- **Nutzen:** Portfolio-Manager sehen sofort Status, Probleme und Kapazität **ihres** Portfolios, ohne alles manuell zu filtern.

---

## 4. Bestehende Module portfolio-fähig machen

| Modul | Maßnahme |
|-------|----------|
| **Dashboard** | `loadDashboardData` (und Backend) akzeptieren `portfolio_id`; KPIs und Projektliste nur für dieses Portfolio. Bei „Alle Portfolios“ (Admin) aggregieren. |
| **Projekte** | Filter „Portfolio“ (Default = aktuelles Portfolio aus Kontext). URL-Option: `/projects?portfolio_id=...`. |
| **Registers** | Filter „Projekt“ kann durch „Portfolio“ ergänzt werden (Projekte des Portfolios vorauswählen). |
| **Ressourcen** | Optional: Filter „nur Ressourcen in Projekten des Portfolios“. |
| **Finanzen** | Optional: Tabs oder Filter „Nach Portfolio“; Roll-up Budget/Ist pro Portfolio. |
| **Risiken** | Optional: Aggregation/Filter nach Portfolio (über Projekt-Zugehörigkeit). |
| **Help-Chat** | `currentPortfolio` bereits vorgesehen – beibehalten und mit aktuellem Kontext füllen. |
| **Import** | Projekt-Import optional einem Portfolio zuordnen (bereits `portfolioId` in ProjectImportModal). |

---

## 5. Echte Hierarchie (Portfolio und/oder Projekt)

Eine **Tree-Struktur nur in der Darstellung** (Portfolios als Ordner, Projekte als Blätter) ist ohne Schema-Änderung möglich. Für **echte Hierarchie** im Datenmodell gelten die folgenden Optionen. Referenz im Codebase: **Organizations** in `backend/migrations/058_rls_sub_organizations.sql` (parent_id, path/ltree, depth, Trigger).

### 5.1 Portfolio-Hierarchie

- **Schema:** Tabelle `portfolios` um `parent_id UUID REFERENCES portfolios(id)` (nullable = Wurzel) ergänzen. Optional wie bei Organizations: `path LTREE`, `depth INT` und Trigger zur Pfad-Berechnung.
- **Regel:** Ein Portfolio hat höchstens ein Eltern-Portfolio. Projekte hängen weiter an genau einem Portfolio (Blatt oder Knoten); üblich: Projekte nur an Blatt-Portfolios, dann ist Roll-up eindeutig.
- **APIs:** `GET /portfolios` mit `?parent_id=…` oder `?root_only=true`; Response mit `parent_id`, `path`, `depth`, `children_count`. Beim Anlegen/Ändern: Validierung keine Zyklen.
- **Roll-up:** Metriken eines Portfolios = eigene Projekte + rekursiv alle Unter-Portfolios (über path oder rekursive CTE).
- **RBAC:** Festlegen, ob Zugriff auf ein Portfolio Zugriff auf Unter-Portfolios impliziert (Vererbung entlang path) oder pro Portfolio granular bleibt.
- **Frontend:** Portfolio-Selector als Baum (expand/collapse); Breadcrumb „Division / Bereich / Portfolio“.

### 5.2 Projekt-Hierarchie (Programme / Subprojects)

- **Schema:** Tabelle `projects` um `parent_project_id UUID REFERENCES projects(id)` (nullable = Top-Level). Optional: `path LTREE`, `depth INT` + Trigger.
- **Regel:** Ein Projekt hat höchstens ein Eltern-Projekt. **Invariante:** Parent und Kind im gleichen Portfolio (`portfolio_id` bei beiden; CHECK oder App-Validierung), damit bestehende Filter und RLS weiter funktionieren.
- **APIs:** `GET /projects` mit `?parent_project_id=…` oder `?root_only=true`; Erstellen/Bearbeiten mit Validierung (gleiches Portfolio, keine Zyklen). Roll-up: Budget, Risiken, Kapazität für ein Programm = Summe über sich und alle Nachfahren.
- **Bereiche anpassen:** Dashboard/Metriken (Roll-up pro Programm), Ressourcen (Auslastung Programm = Summe Teilprojekte), Finanzen (Budget/Ist pro Programm), Registers (Aggregation „Risiken im Programm“). Task-Hierarchie (`parent_task_id`) bleibt Projekt-intern; Projekt-Hierarchie ist die Ebene darüber.
- **RBAC:** Entscheidung: Zugriff auf Parent = Zugriff auf alle Children (Vererbung) oder granular pro Projekt.
- **Frontend:** Projektliste/Portfolio-Detail als Tree (Programm aufklappbar); Programm-Detailseite mit Teilprojekten und Roll-up-KPIs.

### 5.3 Kombination und Roll-up

- **Portfolio-Baum:** Struktur der „Schubladen“ (z. B. Division → Bereich → Portfolio).
- **Projekt-Baum:** Innerhalb eines Portfolios (Programm → Teilprojekte); jedes Projekt behält `portfolio_id`.
- **Kontext:** „Aktuelles Portfolio“ unverändert; Projekt-Ansicht „nur dieses Portfolio“ + optional Baum-Ansicht (Programme/Subprojects).
- **Roll-up:** Portfolio-Ebene = alle Projekte in diesem und in Unter-Portfolios. Programm-Ebene = alle Teilprojekte; Programm zählt im Portfolio als ein Projekt (mit aggregierten Werten).

### 5.4 Reihenfolge und Aufwand (Hierarchie)

| Schritt | Inhalt | Aufwand |
|--------|--------|--------|
| 1 | Portfolio-Hierarchie: Migration parent_id (+ path/depth/Trigger), API erweitern, Zyklen-Validierung, RBAC-Entscheid | mittel |
| 2 | Frontend Portfolio-Tree: Selector/Navigation als Baum, Breadcrumb | klein–mittel |
| 3 | Projekt-Hierarchie: Migration parent_project_id (+ path/depth), Invariante gleiches Portfolio, API + Validierung | mittel |
| 4 | Roll-up: Aggregationen (KPIs, Budget, Ressourcen) für Portfolio- und Projekt-Baum (rekursive CTEs oder path) | mittel–hoch |
| 5 | Frontend Projekt-Tree: Baum in Liste/Portfolio-Detail, Programm-Detail mit Teilprojekten | mittel |
| 6 | RBAC-Vererbung: Regeln „Zugriff Parent = Zugriff Children“ (Portfolio und/oder Projekt) | mittel |

Empfehlung: Zuerst Portfolio-Hierarchie (weniger Abhängigkeiten), dann Projekt-Hierarchie; Roll-up und UI schrittweise.

---

## 6. Erweiterungen („10x“-Ideen, später)

- **Portfolio-Health-Score:** Abgeleitet aus Projekt-Health, Budget, Terminen (einfache Formel, dann ggf. erweiterbar).
- **Portfolio-Ressourcen/Kapazität:** Aggregierte Auslastung pro Portfolio; Konflikte zwischen Portfolios sichtbar.
- **Governance:** Freigabe-Workflows auf Portfolio-Ebene (z.B. Budget- oder Projektaufnahme), Integration mit bestehenden Workflows.
- **Strategische Ausrichtung:** Portfolios mit „Strategischen Themen“ oder Zielen verknüpfen; Anzeige „Beitrag des Portfolios zu Ziel X“.
- **Vergleich:** Zwei Portfolios nebeneinander (KPIs, Projektanzahl, Budget).
- **Roll-up für Admins:** View „Alle Portfolios“ mit Kennzahlen-Matrix und Drill-down in ein Portfolio.

---

## 7. Phasierte Umsetzung

### Phase 1 – Kontext und Basis-UI (MVP)

1. **PortfolioContext** im Frontend mit `currentPortfolioId` und Persistenz.
2. **Portfolio-Selector** in der TopBar (Name, Dropdown mit Liste).
3. **Seite `/portfolios`:** Liste aller Portfolios (für User mit Berechtigung), Link zu Detail.
4. **Seite `/portfolios/[id]`:** Detail (Name, Beschreibung, Owner) + Liste der Projekte dieses Portfolios (z.B. über bestehende Projekte-API mit `?portfolio_id=...`).
5. **API-Aufrufe:** Dashboard und Projekte-Liste mit `portfolio_id` aus dem Kontext (Query oder Header).

### Phase 2 – Durchgängige Nutzung des Kontexts

1. **Dashboard:** Daten nur für aktuelles Portfolio (Backend + Frontend).
2. **Projekte:** Default-Filter = aktuelles Portfolio; Filter „Alle“ für Admins.
3. **Registers/Import:** Optional `portfolio_id` aus Kontext nutzen.

### Phase 3 – Portfolio-Dashboard und KPIs

1. **Portfolio-Dashboard** auf `/portfolios/[id]`: gleiche Widget-Struktur wie Haupt-Dashboard, Daten gefiltert nach `portfolio_id`.
2. **Backend:** Endpoints für portfolio-aggregierte Metriken (z.B. Erweiterung von `/portfolios/metrics` um `portfolio_id` oder dedizierter Endpoint).

### Phase 4 – Differenzierung (optional)

1. Portfolio-Health, Kapazität, Governance-Workflows, strategische Verknüpfung, Vergleichsansichten.

### Phase 5 – Echte Hierarchie (optional)

1. **Portfolio-Hierarchie:** Migration `parent_id` (+ path/depth), API + Validierung, Portfolio-Selector als Baum.
2. **Projekt-Hierarchie:** Migration `parent_project_id`, Invariante gleiches Portfolio, Roll-up pro Programm, Projekt-Tree in UI.
3. Roll-up und RBAC-Vererbung für beide Hierarchien (vgl. Abschnitt 5).

---

## 8. Backend-Stand (kurz)

- **portfolios:** CRUD vorhanden (`backend/routers/portfolios.py`).
- **Projekte:** `portfolio_id` vorhanden; Filter `?portfolio_id=...` in `projects.py`.
- **RBAC:** `portfolio_*` Permissions und `PermissionContext(portfolio_id=...)` (Pfad, Query, Header).
- **Help/RAG:** `current_portfolio` im Kontext.
- **Metriken:** `/portfolios/metrics` wird vom Dashboard-Loader aufgerufen; ggf. um portfolio-spezifische Variante ergänzen (z.B. `GET /portfolios/{id}/metrics`).

---

## 9. Kurzfassung

- **Nicht nur eine Seite:** Portfolio als **Kontext** (Selector in der Shell) + **eigene Liste/Detail/Dashboard**.
- **Kontext überall nutzen:** Dashboard, Projekte, optional Registers/Ressourcen/Finanzen mit `portfolio_id`.
- **Stärke:** Ein klares „Ich arbeite in Portfolio X“, ein Portfolio-Dashboard pro Portfolio und später Health, Kapazität, Governance – das hebt die App von einer einfachen Portfolio-Liste deutlich ab und macht Portfoliomanagement zum Kern der PPM-Nutzung.
- **Echte Hierarchie (optional):** Portfolio-Baum (`parent_id`, path/depth wie Organizations) und Projekt-Baum (Programme/Subprojects mit `parent_project_id`, gleiches Portfolio); Roll-up und Tree-UI in Phase 5.

Die Reihenfolge der Phasen kannst du je nach Ressourcen anpassen; Phase 1 + 2 bringen den größten spürbaren Nutzen (Kontext + gefilterte Ansichten).
