# Codebase Cleanup TODO

Use branch **chore/codebase-cleanup** and the cleanup PR for implementation.

## Completed
- [x] Move root one-off docs to docs/archive
- [x] Add docs/README.md index
- [x] Add docs/CLEANUP_INVESTIGATION.md
- [x] Document screenshot-service roles (lib vs lib/services)
- [x] Document lib/api.ts vs lib/api/ entry points

## In Progress
- [ ] Archive obsolete *_SUMMARY.md (optional)
- [ ] Frontend: use logger instead of console.* in app/lib
- [ ] Backend: use logging instead of print() in production
- [ ] Triage TODO/FIXME/deprecated and create issues or fix
- [ ] Remove dead code and unused exports
- [ ] Consolidate duplicated logic (e.g. costbook/lib)
- [ ] Align naming and file layout
- [ ] Tidy tests and docs
- [ ] Fix obvious tech debt (add as you find)

See [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md) for details.
