# Features implementiert, aber nicht über die Hauptnavigation erreichbar

Stand: Analyse der UI-Navigation (TopBar, SmartSidebar, MobileNav) vs. vorhandene App-Routen und Features.

---

## 1. Kein Eintrag in der Navigation

Diese Seiten/Features existieren, sind aber **weder in TopBar, SmartSidebar noch MobileNav** verlinkt. Nutzer können sie nur per direkter URL erreichen.

| Feature / Seite | Route | Beschreibung |
|-----------------|--------|--------------|
| **Project Controls (ETC/EAC)** | `/project-controls` | ETC/EAC-Steuerung, Forecast – eigene App-Page, kein Nav-Link. |
| **Schedule Management** | `/schedules` | Terminplanung, Tasks – eigene App-Page, kein Nav-Link. |
| **Enhanced PMR** | `/reports/pmr` | PMR-Editor mit AI Insights, Kollaboration – unter Reports, aber kein direkter Link „PMR“ in der Nav; Reports führt zum AI-Chat. |
| **Offline-Status** | `/offline` | Offline-Funktionalität, Sync-Status – keine Verlinkung. |
| **Import (Standalone)** | `/import` | Zentrale Import-Seite – nicht in Nav (Projekt-Import ist unter `/projects/import` erreichbar). |
| **Design System** | `/design-system` | Design-System-Dokumentation – typischerweise nur für Dev/Design, oft bewusst nicht in Hauptnav. |

---

## 2. Nur über Admin-Dashboard erreichbar

Diese Bereiche sind **nur über `/admin`** (Admin-Dashboard mit Karten) erreichbar, nicht als eigene Einträge in der Hauptnavigation:

| Feature | Route | Hinweis |
|---------|--------|---------|
| **Navigation Stats** | `/admin/navigation-stats` | Nur über Admin → Karte „Navigation Stats“. |
| **Feature Catalog** | `/admin/features` | Nur über Admin → „Feature catalog“. |
| **Feature Toggles** | `/admin/feature-toggles` | Nur über Admin → „Feature toggles“. |

Admin selbst ist in der Nav („Admin“ / „System Admin“); Performance und User Management haben in der SmartSidebar eigene Einträge, in TopBar nur im Admin-Dropdown.

---

## 3. Nur kontextbezogen / ohne eigene zentrale UI

| Feature | Erreichbarkeit | Hinweis |
|---------|----------------|---------|
| **Workflow-Instanzen / My Workflows** | API: `/api/workflows/instances/my-workflows` | Keine eigene Seite „Meine Workflows“. Workflows erscheinen kontextbezogen (z. B. Projekte mit WorkflowStatusBadge, Approval-Modal). |
| **AI Resource Optimizer** | Auf **Resources**-Seite | Komponente `AIResourceOptimizer` ist auf `/resources` eingebunden (lazy), also über UI erreichbar. |

---

## 4. Empfehlungen für bessere Auffindbarkeit

- **Project Controls:** In TopBar/Sidebar z. B. unter „Financials“ oder „Analysis“ als „Project Controls (ETC/EAC)“ verlinken.
- **Schedules:** Eigenen Nav-Eintrag „Schedule Management“ oder „Terminplanung“ (z. B. unter „Projects“ oder „Analysis“).
- **Enhanced PMR:** Unter „Reports“ einen direkten Link „PMR Report“ / „Enhanced PMR“ auf `/reports/pmr` anbieten.
- **Offline:** In Footer oder Settings einen Link „Offline-Status“ auf `/offline` (oder kleines Offline-Indicator mit Link).
- **Import:** Optional in TopBar/Sidebar einen Eintrag „Import“ auf `/import`, falls zentraler Import gewünscht ist.
- **Workflows:** Optional eigene Seite „Meine Workflows“ (z. B. unter Management) mit Liste der Instanzen und Pending Approvals.

---

## 5. Referenzen in der Codebasis

- **Navigation:** `components/navigation/TopBar.tsx`, `SmartSidebar.tsx`, `MobileNav.tsx`
- **Admin-Dashboard:** `app/admin/page.tsx` (Karten mit Links zu den Admin-Subseiten)
- **Feature-Übersicht:** `FEATURE_INVENTORY.md`
