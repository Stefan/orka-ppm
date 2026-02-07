# Documentation

## Main guides (current)

- [Project structure](PROJECT_STRUCTURE.md)
- [Testing guide](TESTING_GUIDE.md)
- [Design system](DESIGN_SYSTEM_GUIDE.md)
- [Security checklist](SECURITY_CHECKLIST.md) — siehe auch [Security (Vulnerability & Auth)](security/)
- [Deployment procedures](DEPLOYMENT_PROCEDURES.md)
- [I18n developer guide](I18N_DEVELOPER_GUIDE.md)
- [Enhanced PMR user guide](ENHANCED_PMR_USER_GUIDE.md)
- [RAG system](RAG_SYSTEM_README.md)
- [Workflow integration](workflow-integration-testing.md)

## By area

- **Security:** [docs/security/](security/) — [Vulnerability analysis](security/vulnerability-analysis.md), [JWT & env setup](security/env-setup.md). Backend und Next.js API-Routen verlangen verifizierte Bearer-Tokens; siehe Checkliste und env-setup.
- **Audit:** [Admin](audit-admin-guide.md), [API](audit-api-documentation.md), [Deployment](audit-deployment-checklist.md), [Monitoring](audit-monitoring-guide.md), [User guide](audit-user-guide.md)
- **Frontend:** [docs/frontend/](frontend/) — bootstrap admin, refactoring, UI/UX spec
- **User sync:** [Quick reference](USER_SYNC_QUICK_REFERENCE.md), [Full guide](USER_SYNCHRONIZATION.md)
- **User acceptance:** [docs/user-acceptance-testing/](user-acceptance-testing/)

## Archive and one-off docs

- **[docs/archive/](archive/)** — Past summaries, fix writeups, and one-off notes (API issues, deployment, help chat, Render, Vercel, etc.). Kept for reference; not part of current procedures.
- **[docs/fixes/](fixes/)** — Reserved for future fix/incident writeups.

## Cleanup and maintenance

- [codebase-structure-and-refactor-backlog.md](codebase-structure-and-refactor-backlog.md) — Structure overview, categories (dead code, duplication, naming, tests, docs, tech debt), prioritization, next steps.
- [codebase-structure-recommendations.md](codebase-structure-recommendations.md) — Thematische Unterverzeichnisse: Vorschläge für components/costbook, components/pmr, lib/utils, backend/routers, backend/services, __tests__.
- [CLEANUP_INVESTIGATION.md](CLEANUP_INVESTIGATION.md) — Codebase cleanup findings and recommendations.
- [CLEANUP_TODO.md](CLEANUP_TODO.md) — Checklist for the cleanup PR.
