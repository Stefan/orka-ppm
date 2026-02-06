# AI Help Chat Enhancement

Erweiterung des Help-Chats: Kontext, Logging, RAG, Analytics (Phase 1), Proactive Tips mit Realtime + Cooldown (Phase 2 Task 9), Natural Language Actions (Phase 2 Task 10).

## Phase 1 (umgesetzt)

- DB-Schema help_logs, help_feedback; Embeddings für Help-Docs.
- ChatContext/HelpChatProvider mit page_context, user_role.
- HelpLogger, HelpDocumentationRAG, HelpQueryProcessor; Streaming, Feedback-API.
- Admin Help Analytics Dashboard (/admin/help-analytics).

## Phase 2 – Proactive Tip Engine (Task 9)

- **ProactiveTipsEngine** (`backend/services/proactive_tips_engine.py`):
  - `_load_tip_rules()`: Regeln für variance_alerts (new), projects (overdue, budget_utilization_high).
  - `start_monitoring(organization_id)`: Realtime-Subscription auf `variance_alerts` (INSERT); bei Event wird `_handle_change` aufgerufen.
  - `_handle_change(organization_id, payload)`: wertet Regeln aus, ruft `_trigger_tip` auf.
  - `_trigger_tip`: Broadcast auf Kanal `proactive_tips_{org_id}`, Cooldown pro (rule_key, user_id).
  - Cooldown: `_is_in_cooldown`, `_set_cooldown` (Standard 30 Min.).
- Frontend: GET /api/ai/help/tips liefert Tips; Anzeige/Toast und „Learn More“ (Chat mit Prefill) wie zuvor.
- Tests: `backend/tests/test_proactive_tips_engine_properties.py` (Cooldown, Variance-Regel, Notification-Content).

## Phase 2 – Natural Language Action Parser (Task 10)

- **NaturalLanguageActionsService** (`backend/services/natural_language_actions_service.py`):
  - `parse_and_execute(query, context, user_id, organization_id)` → `{ action_type, action_data, confidence, explanation }`.
  - Aktionen: `fetch_data` (z. B. EAC), `navigate` (Pfad aus Query), `open_modal`.
  - `_fetch_project_data(organization_id, user_id)` mit Org-Filter.
- Integration: Router `help_chat_enhanced` nutzt den Service für `/help-chat/action`. Hauptrouter ist `help_chat` (Phase 1); Enhanced-Router optional.

## Phase 2 – Task 10.3 & 11 (umgesetzt)

- **10.3 Frontend Action-Commands:** Help-Query-Router ruft NaturalLanguageActionsService auf; bei actionable Query werden `suggested_actions` (navigate, open_modal, show_data) an die Antwort angehängt. HelpChat nutzt `handleQuickAction` für navigate/open_modal; für `show_data` mit target `eac`/`costbook` erfolgt Navigation zu /financials bzw. /costbook.
- **11 Costbook-Integration:** NaturalLanguageActionsService erkennt Costbook-Intents („budget“, „variance“, „spend“); `_fetch_costbook_data(organization_id)` liefert pro Projekt budget, actual_cost, variance, variance_percent, variance_over_threshold (10 %), formatierte Währung. Unit-Tests in `tests/unit/test_natural_language_actions_service.py`.

## Offen (Phase 2/3)

- Task 10.4–10.10: Property-Tests für Action Parser.
- Phase 3: Translation, Support-Eskalation, Training-Data-Export, Performance, Security (Tasks 13–18).

## Referenz

- Spec: `.kiro/specs/ai-help-chat-enhancement/`
