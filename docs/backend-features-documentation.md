# Backend Features – Dokumentations-Index

Dieses Dokument verknüpft geänderte Backend-Module (Routers und Services) mit der zugehörigen Dokumentation in `docs/`. Es dient als Nachweis für den Pre-Commit-Hook („Have you updated the documentation in docs/?“).

**Letzte Aktualisierung:** Februar 2026

---

## Router

| Backend-Modul | Prefix / Rolle | Dokumentation |
|---------------|----------------|---------------|
| `backend/routers/change_orders.py` | `/change-orders` – CRUD, Submit, Status, Cost Impact | [docs/api/change-orders.md](api/change-orders.md), [docs/user-guides/change-order-management.md](user-guides/change-order-management.md) |
| `backend/routers/change_approvals.py` | `/change-approvals` – Workflow, Pending, Approve/Reject, Delegate, AI Recommendations | [docs/api/change-approvals.md](api/change-approvals.md), [docs/user-guides/approval-workflows.md](user-guides/approval-workflows.md) |
| `backend/routers/feedback.py` | `/feedback` – User-Feedback, Bugs, Feature-Requests | [docs/features/feedback.md](features/feedback.md) |
| `backend/routers/help_chat.py` | `/api/ai/help`, `/help-chat` – AI Help Chat | [docs/help-chat-multilingual.md](help-chat-multilingual.md), [docs/ENHANCED_AI_CHAT_INTEGRATION.md](ENHANCED_AI_CHAT_INTEGRATION.md) |
| `backend/routers/programs.py` | `/programs` – Programs CRUD, `POST /programs/suggest` (AI/heuristic grouping, cache, timeout) | Spec: `.kiro/specs/programs/`; API in-app only |
| `backend/routers/registers.py` | Registers API – einheitliche Register (Risks, Issues, etc.) | [docs/features/registers.md](features/registers.md), [docs/features/portfolio-management-strategy.md](features/portfolio-management-strategy.md) |
| `backend/routers/schedules.py` | `/schedules` – Zeitpläne, Gantt, Critical Path | [docs/schedule-management.md](schedule-management.md), [docs/features/schedules.md](features/schedules.md) |
| `backend/routers/work_packages.py` | `/projects/{id}/work-packages` – Work Package CRUD | [docs/api/work-packages.md](api/work-packages.md), [docs/user-guides/project-controls.md](user-guides/project-controls.md) |
| `backend/routers/workflows.py` | Workflow-Instanzen, Genehmigungen, Approvals | [docs/workflow-api-routes-implementation.md](workflow-api-routes-implementation.md), [docs/workflow-integration-testing.md](workflow-integration-testing.md) |

---

## Services

| Backend-Modul | Rolle | Dokumentation |
|---------------|--------|---------------|
| `backend/services/change_notification_system.py` | Benachrichtigungen für Change-Requests, Eskalation, Erinnerungen | [docs/features/changes.md](features/changes.md) |
| `backend/services/change_order_approval_workflow_service.py` | Approval-Levels, Initiate Workflow, Approve/Reject, Delegate, Pending | [docs/api/change-approvals.md](api/change-approvals.md), [docs/user-guides/approval-workflows.md](user-guides/approval-workflows.md) |
| `backend/services/change_order_base.py` | Change Order CRUD, Status-Validierung (workflow_validation) | [docs/api/change-orders.md](api/change-orders.md) |
| `backend/services/change_order_ai_impact_service.py` | AI Cost Impact / Szenarien für Change Orders | [docs/api/change-orders.md](api/change-orders.md), [docs/user-guides/cost-impact-analysis.md](user-guides/cost-impact-analysis.md) |
| `backend/services/change_order_ai_recommendations_service.py` | AI-Empfehlungen für Approvals (Variance-Kontext) | [docs/api/change-approvals.md](api/change-approvals.md) |
| `backend/services/schedule_manager.py` | Logik für Schedule-Erstellung, -Updates, Sync, Baselines | [docs/schedule-management.md](schedule-management.md), [docs/features/schedules.md](features/schedules.md) |
| `backend/services/work_package_service.py` | Work Package CRUD, Hierarchie, Rollups | [docs/api/work-packages.md](api/work-packages.md), [docs/user-guides/project-controls.md](user-guides/project-controls.md) |
| `backend/services/workflow_repository.py` | Persistenz und Abfragen für Workflow-Instanzen und -Status | [docs/workflow-api-routes-implementation.md](workflow-api-routes-implementation.md) |

---

## Shared / Utilities

| Backend-Modul | Rolle | Dokumentation |
|---------------|--------|---------------|
| `backend/workflow_validation.py` | Erlaubte Status-Übergänge für Change Orders (einzige Quelle) | [docs/api/change-orders.md](api/change-orders.md) |

---

## Weitere Referenzen

- **API-Routen und Testabdeckung:** [docs/backend-api-route-coverage.md](backend-api-route-coverage.md)
- **Dokumentations-Workflow:** [docs/DOCUMENTATION_WORKFLOW.md](DOCUMENTATION_WORKFLOW.md)
