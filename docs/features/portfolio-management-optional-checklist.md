# Portfolio-Management – Optionale Punkte & Status

Kurzfassung: Nav-RBAC für „Portfolios“, Portfolio-Filter in Registers/Ressourcen/Finanzen, und Checkliste der optionalen Punkte aus `portfolio-management-strategy.md`.

---

## 1. Navigation & RBAC für „Portfolios“

### Aktueller Stand

| Ort | Portfolios-Link | RBAC (portfolio_read) |
|-----|------------------|------------------------|
| **TopBar** | Ja (Portfolio-Dropdown + Link „Portfolios“ im More-Menu und unter Projects) | **Nein** – Link ist für alle sichtbar |
| **MobileNav** | Ja (`/portfolios`, Label „Portfolios“) | **Nein** – kein PermissionGuard |
| **Sidebar** | Kein eigener Eintrag „Portfolios“ (nur „Portfolio Dashboards“, „Projects“) | – |

- Die Permission `portfolio_read` existiert (RBAC, Rollen, PermissionSelector).
- **Nav zeigt den Portfolios-Zugang derzeit nicht abhängig von `portfolio_read`** – wer eingeloggt ist, sieht die Links.

### Empfehlung

- **TopBar:** Portfolios-Dropdown und Link „Portfolios“ nur anzeigen, wenn `hasPermission('portfolio_read')` (oder vergleichbare Prüfung).
- **MobileNav:** Eintrag „Portfolios“ in `PermissionGuard` mit `permission="portfolio_read"` packen (analog zu RoleBasedNav-Beispiel).
- **Sidebar:** Falls ein expliziter Eintrag „Portfolios“ ergänzt wird, von vornherein mit `PermissionGuard permission="portfolio_read"` schützen.

---

## 2. Registers – Portfolio-Filter

### Aktueller Stand

- **Seite:** `app/registers/page.tsx`
- **Projekte für Filter:** `useProjectsQuery(accessToken, userId)` – **ohne** `portfolioId`.
- **Effekt:** Projekt-Dropdown enthält alle Projekte des Users, **kein** Filter nach aktuellem Portfolio.
- **Strategie (Phase 2):** „Registers: Optional `portfolio_id` aus Kontext nutzen.“

### Optionale Umsetzung

- [ ] `usePortfolio()` nutzen, `currentPortfolioId` aus Kontext lesen.
- [ ] `useProjectsQuery(accessToken, userId, currentPortfolioId)` aufrufen, damit die Projektliste auf das aktuelle Portfolio beschränkt ist (oder „Alle“ wenn kein Portfolio gewählt).
- [ ] Optional: URL-Parameter `?portfolio_id=...` unterstützen (z. B. für Deep-Links aus Portfolio-Detail).

---

## 3. Ressourcen – Portfolio-Filter

### Aktueller Stand

- **Seite:** `app/resources/page.tsx`
- **Daten:** Ressourcen-API, Filter (Rolle, Skills, Availability, etc.) – **kein** `portfolio_id` oder Projekt-/Portfolio-Filter.
- **Strategie (Abschnitt 4):** „Ressourcen: Optional: Filter ‚nur Ressourcen in Projekten des Portfolios‘.“

### Optionale Umsetzung

- [ ] Backend: Ressourcen-/Zuweisungs-Endpoint um optionalen Filter `portfolio_id` ergänzen (z. B. nur Ressourcen, die Projekten dieses Portfolios zugeordnet sind).
- [ ] Frontend: `usePortfolio()`, `currentPortfolioId` in Filterleiste (z. B. „Nur aktuelles Portfolio“) und bei API-Aufrufen mitsenden.

---

## 4. Finanzen – Portfolio-Filter

### Aktueller Stand

- **Seite:** `app/financials/page.tsx`
- **Daten:** `useFinancialData({ accessToken, selectedCurrency })` – **kein** `portfolioId`.
- **Strategie (Abschnitt 4):** „Finanzen: Optional: Tabs oder Filter ‚Nach Portfolio‘; Roll-up Budget/Ist pro Portfolio.“

### Optionale Umsetzung

- [ ] `useFinancialData` um optionales `portfolioId` erweitern; Backend-Aufrufe mit `?portfolio_id=...` (oder äquivalent).
- [ ] UI: Filter/Dropdown „Portfolio“ (aktueller Kontext + „Alle“), Auswahl an Hook übergeben.
- [ ] Optional: Roll-up-Ansicht „Pro Portfolio“ (Budget/Ist pro Portfolio).

---

## 5. Checkliste – Optionale Punkte (Strategie-Dokument)

### Persistenz & Kontext

- [ ] **Backend-User-Preference** für aktuelles Portfolio (zusätzlich zu localStorage), damit Kontext geräteübergreifend bleibt.

### Nav & RBAC

- [ ] **Portfolios in der Nav** nur anzeigen, wenn User `portfolio_read` hat (TopBar, MobileNav, ggf. Sidebar).

### Module portfolio-fähig (optional)

- [ ] **Registers:** Projektliste und ggf. Default-Filter aus `currentPortfolioId` (s. Abschnitt 2).
- [ ] **Ressourcen:** Filter „nur Ressourcen in Projekten des Portfolios“ (s. Abschnitt 3).
- [ ] **Finanzen:** Filter/Tabs „Nach Portfolio“ und Roll-up pro Portfolio (s. Abschnitt 4).
- [ ] **Risiken:** Optional Aggregation/Filter nach Portfolio (über Projekt-Zugehörigkeit).

### Phase 4 – Differenzierung (optional)

- [ ] **Portfolio-Health-Score** (aus Projekt-Health, Budget, Terminen).
- [ ] **Portfolio-Ressourcen/Kapazität** (aggregierte Auslastung, Konflikte zwischen Portfolios).
- [ ] **Governance:** Freigabe-Workflows auf Portfolio-Ebene.
- [ ] **Strategische Ausrichtung:** Portfolios mit Zielen/Themen verknüpfen.
- [ ] **Vergleich:** Zwei Portfolios nebeneinander (KPIs, Budget, Projektanzahl).
- [ ] **Roll-up für Admins:** View „Alle Portfolios“ mit Kennzahlen-Matrix und Drill-down.

### Phase 5 – Echte Hierarchie (optional)

- [ ] **Portfolio-Hierarchie:** Migration `parent_id` (+ path/depth) für Portfolios, API, Validierung, Selector als Baum, Breadcrumb.
- [ ] **Projekt-Hierarchie:** Migration `parent_project_id`, Invariante gleiches Portfolio, Roll-up pro Programm, Projekt-Tree in UI.
- [ ] **RBAC-Vererbung:** Zugriff auf Parent = Zugriff auf Children (Portfolio und/oder Projekt).

### Programme (Spec programs/Tasks.md)

- [ ] **Task 1.3:** CHECK oder Trigger: `project.portfolio_id` = Programm-Portfolio, wenn `project.program_id` gesetzt.
- [ ] **Task 4 (optional):** Program-Alerts (Backend + Badge auf Programm-Zeile).

---

## Kurz-Referenz: Wo wird Portfolio bereits genutzt?

- **Dashboard:** `currentPortfolioId` → `loadDashboardData(…, { portfolioId })`
- **Projekte-Liste:** `useProjectsQuery(accessToken, userId, currentPortfolioId)`
- **Portfolio-Detail:** `/portfolios/[id]` mit Projekten `?portfolio_id=...` und Dashboard-Tab mit `portfolioId: id`
- **Help-Chat:** `currentPortfolio` aus Kontext
- **Import:** `portfolioId` in ProjectImportModal (laut Strategie)

Damit sind Kontext, Dashboard, Projekte und Portfolio-Seiten bereits portfolio-sensibel; Registers, Ressourcen und Finanzen sind Kandidaten für optionale Portfolio-Filter.
