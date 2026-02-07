# Codebase Cleanup TODO

Use branch **chore/codebase-cleanup** and the cleanup PR for implementation.

## Completed
- [x] Move root one-off docs to docs/archive
- [x] Add docs/README.md index
- [x] Add docs/CLEANUP_INVESTIGATION.md
- [x] Document screenshot-service roles (lib vs lib/services)
- [x] Document lib/api.ts vs lib/api/ entry points

## Kategorisierung & Refactor (Backlog)

Für **Code Review, Cleanup, Kategorisierung, Restrukturierung, Refactoring** siehe:

- **[codebase-structure-and-refactor-backlog.md](codebase-structure-and-refactor-backlog.md)** — Struktur-Überblick, Kategorien (tote Code-Pfade, Duplikation, Naming, Tests, Docs, Tech Debt), Priorisierung, nächste Schritte.

Kurz-Checklist aus dem Backlog:

- [x] **A. Tote Code-Pfade:** chrome-scroll-test + page.optimized markiert/dokumentiert
- [x] **B. Duplikation:** lib/api + Screenshot in Code dokumentiert
- [ ] **C. Naming & Struktur:** Konventionen, Backend-Router-Namen, @/ Alias
- [x] **D. Tests:** Struktur in __tests__/README + pytest.ini; Doppelte bereinigen offen
- [x] **E. Docs:** *_SUMMARY.md + Root-MDs nach docs/archive/summaries bzw. docs/archive
- [x] **F. Tech Debt:** Logger (Frontend prod ohne Console), logging (Backend main.py), TODO-Triage gestartet

## In Progress
- [x] Archive obsolete *_SUMMARY.md (optional)
- [x] Frontend: logger in prod ohne Console; Beispiel in ThemeProvider
- [x] Backend: logging statt print() in main.py
- [x] Triage TODO/FIXME (einige behoben, Rest bei Gelegenheit)
- [ ] Remove dead code and unused exports
- [ ] Consolidate duplicated logic (e.g. costbook/lib)
- [ ] Align naming and file layout
- [x] Tidy tests and docs (Test-Struktur, Backend-Konvention)
- [ ] Fix obvious tech debt (add as you find)

See [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md) for details.
