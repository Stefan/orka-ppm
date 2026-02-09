# Backend Features – Dokumentations-Index

Dieses Dokument verknüpft geänderte Backend-Module (Routers und Services) mit der zugehörigen Dokumentation in `docs/`. Es dient als Nachweis für den Pre-Commit-Hook („Have you updated the documentation in docs/?“).

**Letzte Aktualisierung:** Februar 2026

---

## Router

| Backend-Modul | Prefix / Rolle | Dokumentation |
|---------------|----------------|---------------|
| `backend/routers/feedback.py` | `/feedback` – User-Feedback, Bugs, Feature-Requests | [docs/features/feedback.md](features/feedback.md) |
| `backend/routers/help_chat.py` | `/api/ai/help`, `/help-chat` – AI Help Chat | [docs/help-chat-multilingual.md](help-chat-multilingual.md), [docs/ENHANCED_AI_CHAT_INTEGRATION.md](ENHANCED_AI_CHAT_INTEGRATION.md) |
| `backend/routers/registers.py` | Registers API – einheitliche Register (Risks, Issues, etc.) | [docs/features/registers.md](features/registers.md), [docs/features/portfolio-management-strategy.md](features/portfolio-management-strategy.md) |
| `backend/routers/schedules.py` | `/schedules` – Zeitpläne, Gantt, Critical Path | [docs/schedule-management.md](schedule-management.md), [docs/features/schedules.md](features/schedules.md) |
| `backend/routers/workflows.py` | Workflow-Instanzen, Genehmigungen, Approvals | [docs/workflow-api-routes-implementation.md](workflow-api-routes-implementation.md), [docs/workflow-integration-testing.md](workflow-integration-testing.md) |

---

## Services

| Backend-Modul | Rolle | Dokumentation |
|---------------|--------|---------------|
| `backend/services/change_notification_system.py` | Benachrichtigungen für Change-Requests, Eskalation, Erinnerungen | [docs/features/changes.md](features/changes.md) |
| `backend/services/schedule_manager.py` | Logik für Schedule-Erstellung, -Updates, Sync, Baselines | [docs/schedule-management.md](schedule-management.md), [docs/features/schedules.md](features/schedules.md) |
| `backend/services/workflow_repository.py` | Persistenz und Abfragen für Workflow-Instanzen und -Status | [docs/workflow-api-routes-implementation.md](workflow-api-routes-implementation.md) |

---

## Weitere Referenzen

- **API-Routen und Testabdeckung:** [docs/backend-api-route-coverage.md](backend-api-route-coverage.md)
- **Dokumentations-Workflow:** [docs/DOCUMENTATION_WORKFLOW.md](DOCUMENTATION_WORKFLOW.md)
