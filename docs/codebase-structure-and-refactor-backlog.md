# Codebase Structure & Refactor Backlog

Überblick für **Code Review, Cleanup, Kategorisierung, Restrukturierung und Refactoring** der orka-ppm Codebase. Ergänzt [CLEANUP_TODO.md](CLEANUP_TODO.md) und [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md).

---

## 1. High-Level-Struktur

| Bereich | Pfad | Kurzbeschreibung |
|--------|------|------------------|
| **Frontend App** | `app/` | Next.js App Router: Pages, Layouts, API Routes (`app/api/`), route-spezifische Components/Hooks |
| **Shared Components** | `components/` | Wiederverwendbare UI (ui/, shared/, navigation/, costbook/, pmr/, auth/, …) |
| **Lib** | `lib/` | API-Clients, i18n, costbook-Logik, workers, testing/PBT, enterprise, monitoring |
| **Backend** | `backend/` | FastAPI: `routers/`, `services/`, `auth/`, `models/`, `migrations/`, `tests/` |
| **Tests (Frontend)** | `__tests__/` (root), `**/__tests__/` | Jest/React-Tests; viele unter `__tests__/` (register-nested-grids, api-routes, components, lib) |
| **Specs/Pläne** | `.kiro/specs/` | Feature-Specs (design, requirements, tasks) |
| **Dokumentation** | `docs/` | Guides, Security, Archive; siehe [docs/README.md](README.md) |

**Bekannte Schmerzpunkte:**

- Sehr viele Root-Level-MDs (bereits größtenteils nach `docs/archive/` verschoben; Rest siehe CLEANUP_INVESTIGATION).
- `__tests__/` sehr groß (~626 Dateien); Mix aus Unit, Property, Integration, API-Route-Tests.
- Doppelte/überlappende Einstiegspunkte: `lib/api.ts` vs `lib/api/`; Screenshot-Service in `lib/` und `lib/services/`.
- Backend: viele Router-Dateien (50+), teils ähnliche Namensgebung (z. B. change_management vs change_orders vs change_analytics).

---

## 2. Kategorien für Cleanup & Refactoring

### A. Tote / ungenutzte Code-Pfade

- [x] Ungenutzte Exports: Re-Exports von `production-monitoring` und `security` aus `lib/monitoring/index.ts` entfernt (keine Usages). Weitere Prüfung: `npx ts-prune` (evtl. mit `--ignore '(__tests__|e2e)'`) oder [knip](https://github.com/webpro/knip); siehe [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md#ungenuetzte-exports).
- [ ] Ungenutzte API-Routen oder Backend-Endpoints prüfen (siehe [backend-api-route-coverage.md](backend-api-route-coverage.md)).
- [x] Alte/duplizierte Pages oder Components markieren oder entfernen: `app/chrome-scroll-test/` (README als deprecated), `page.optimized.tsx` (deprecated-Kommentar).

### B. Duplikation & Konsolidierung

- [x] **lib/api:** Nutzung von `lib/api.ts` vs `lib/api/` in Code dokumentiert (`lib/api.ts`, `lib/api/index.ts`, `lib/api/client.ts`); schrittweise auf `lib/api/` migrieren wo sinnvoll.
- [x] **Screenshot-Service:** Rollen dokumentiert (CLEANUP_INVESTIGATION); ggf. später konsolidieren.
- [ ] **Costbook:** Doppelte Logik zwischen `app/financials/`, `components/costbook/`, `lib/costbook/` prüfen und wo möglich zusammenführen.
- [ ] **Changes/Change-Orders:** Überschneidungen `app/changes/` vs `components/change-orders/` vs `components/changes/` verstehen und Benennung/Verantwortung klären.

### C. Naming & Dateistruktur

- [ ] Einheitliche Konventionen: z. B. Komponenten PascalCase, Hooks `use*`, Lib-Module kebab-case; wo abweichend dokumentieren oder anpassen.
- [x] Backend-Router: change_* in `routers/change/` gruppiert (change_orders, change_approvals, change_analytics); weitere Gruppierungen siehe [codebase-structure-recommendations.md](codebase-structure-recommendations.md).
- [ ] Alias-Konsistenz: `@/` für App-Imports prüfen (tsconfig paths); einheitlich nutzen.

### D. Tests

- [x] Test-Struktur: `__tests__/README.md` mit Kategorien; TESTING_GUIDE verweist darauf.
- [ ] Doppelte oder veraltete Tests (z. B. verwaiste Snapshots, doppelte API-Route-Tests) bereinigen.
- [x] Backend: Test-Import-Konvention in `backend/pytest.ini` festgehalten (von `backend/` aus `models.*`, `services.*`).

### E. Dokumentation

- [x] Obsolete `*_SUMMARY.md`: Backend-Summaries nach `docs/archive/summaries/backend/` verschoben; Root-One-off-MDs nach `docs/archive/`.
- [x] Root-Level-MDs: nach `docs/archive/` verschoben (One-off-Fix-/Deploy-Docs).
- [x] Sicherheit & Auth: Verweis „Aktualität“ in [docs/security/README.md](security/README.md) und [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) ergänzt; bei Änderungen an Auth/Env/RLS anpassen.

### F. Tech Debt (Markierungen & Logging)

- [x] **TODO/FIXME:** Einige behoben (main.py); Rest triagieren/Issues anlegen.
- [x] Frontend: Logger in Production ohne Console-Ausgabe; Nutzung in ThemeProvider, GeneralSettings, VarianceAnalysisView, POBreakdownView, CSVImportView, dashboards/page, api/projects/route.
- [x] Backend: `logging` statt `print()` in `main.py` sowie in `routers/financial.py`, `routers/reports.py`, `routers/variance.py`, `routers/projects.py`.

---

## 3. Priorisierung

| Priorität | Fokus | Beispiele |
|----------|--------|-----------|
| **Hoch** | Sicherheit, Stabilität, klare API-Einstiegspunkte | JWT/Auth bereits gehärtet; API-Clients dokumentieren; keine neuen kritischen Duplikate |
| **Mittel** | Wartbarkeit, Lesbarkeit | Logger einführen, TODO/FIXME triagieren, Test-Struktur dokumentieren, *_SUMMARY.md archivieren |
| **Niedrig** | Konsistenz, „nice-to-have“ | Roche→Generic Restbenennung in Tests/Docs, vollständige lib/api-Migration, Screenshot-Konsolidierung |

---

## 4. Verwandte Docs & Specs

- [CLEANUP_TODO.md](CLEANUP_TODO.md) — Checkliste für den Cleanup-PR.
- [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md) — Metriken und Empfehlungen (console, print, Duplikate).
- [CODE_REVIEW_CHECKLIST.md](CODE_REVIEW_CHECKLIST.md) — Roche→Generic, Tests, Costbook, CI/CD.
- [.kiro/specs/project-cleanup/](../.kiro/specs/project-cleanup/) — CLI-Tool für Root-Cleanup (bereits teilweise umgesetzt).
- [docs/security/](security/) — Vulnerability, JWT, Env-Setup.

---

## 5. Nächste Schritte (konkret)

1. **Erledigt (Stand Umsetzung):** Logger (Frontend prod ohne Console), Backend logging in main.py, *_SUMMARY.md + Root-MDs archiviert, lib/api dokumentiert, Test-Struktur + pytest.ini, chrome-scroll-test/page.optimized markiert, TODO in main.py bereinigt.
2. **Kurzfristig:** Restliche console.* in app/ schrittweise auf logger umstellen; Backend-Router/Services auf logging wo noch print(); Doppelte/veraltete Tests bereinigen.
3. **Optional:** Refactor-Sprints für Kategorie C (Naming), Costbook/Changes-Konsolidierung.

*Zuletzt aktualisiert: Februar 2025.*
