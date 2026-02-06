# Requirements: Variance Alerts AI

## Introduction

AI-Erweiterungen für Variance-Alerts im Dashboard: optionale Browser-Push-Benachrichtigungen bei neuen Alerts, AI-gestützte Root-Cause-Analyse pro Alert und konkrete Auto-Fix-Vorschläge mit optionaler Anbindung an Impact-Simulation. Baut auf dem bestehenden VarianceAlertService und der VarianceAlerts-Komponente auf. Referenz: `docs/FEATURE_AI_GAPS_SPEC.md` §1.

## Glossary

- **Variance_Alert**: Von VarianceAlertService erzeugter Alert bei Überschreitung konfigurierter Schwellen (z. B. Invoice Value, ETC).
- **Root_Cause_Service**: Backend- oder Frontend-Logik, die zu einem Alert eine oder mehrere Ursachen mit Konfidenz liefert (LLM oder regelbasiert).
- **Auto_Fix_Service**: Service/Endpoint, der konkrete Anpassungsvorschläge (ETC, Accruals, etc.) zu einem Alert liefert.
- **Push_Subscription**: Browser Push API (VAPID); Subscription wird pro User gespeichert und für Variance-Alert-Benachrichtigungen genutzt.

## Requirements

### Requirement 1: Proactive Alerts (Browser-Push)

**User Story:** As a project manager, I want optional browser push notifications when a new variance alert is created, so that I can react quickly without constantly checking the dashboard.

#### Acceptance Criteria

1. WHEN the user enables push for variance alerts, THE system SHALL request browser notification permission and store the push subscription (VAPID) per user.
2. WHEN a new variance alert is created (per VarianceAlertService), THE system SHALL send a push notification to all registered clients for that user if the PUSH channel is active for the rule.
3. THE push message SHALL include a short text (e.g. "Abweichung in Invoice Value – check PO #123") and optionally a link to the dashboard or alert detail.
4. THE frontend SHALL provide a toggle (e.g. "Push bei neuen Alerts") in settings or within the VarianceAlerts area to enable/disable push for variance alerts.
5. THE Service Worker (`public/sw.js` or equivalent) SHALL handle push events and display a notification; on click SHALL navigate to the dashboard or alert context where applicable.
6. IF the backend provides a push subscription endpoint, THE system SHALL store subscriptions (e.g. in a table or via existing auth/session) keyed by user_id and organization_id.

### Requirement 2: Root-Cause-UI

**User Story:** As a cost engineer, I want to see an optional AI-supported root-cause analysis per variance alert, so that I can understand why an alert was triggered and prioritize actions.

#### Acceptance Criteria

1. THE system SHALL provide a backend service or endpoint (e.g. `get_root_cause_suggestions(alert_id)`) that returns one or more root causes with a confidence value (0–100%).
2. Implementation MAY use an LLM or rule-based logic; on error or timeout THE system SHALL return an empty list or fallback message.
3. THE frontend SHALL display a "Root Cause" block in VarianceAlerts (alert card or alert detail modal) with cause(s) and confidence when available.
4. THE user MAY toggle the root-cause display per alert or globally (optional).
5. Root-cause data SHALL be loaded on demand (e.g. when the user expands the block or opens the alert detail) to avoid unnecessary backend calls.

### Requirement 3: AI Auto-Fix Suggestions

**User Story:** As a project controller, I want concrete suggestions to resolve variances (e.g. "Reduce ETC by 5k€ – simulate impact"), so that I can act quickly with optional simulation.

#### Acceptance Criteria

1. THE system SHALL provide a backend endpoint or extension that returns concrete adjustment suggestions for a given alert/variance (e.g. ETC, Accruals, other columns).
2. Each suggestion SHALL include: description, affected metric, recommended change, and optionally estimated impact.
3. THE system MAY integrate with impact simulation (e.g. Monte Carlo or EAC) to estimate effect of applying a suggestion.
4. THE frontend SHALL show a "Vorschläge anzeigen" button on the alert card; on click SHALL open a modal with the list of suggestions and actions "Impact simulieren" / "Übernehmen" (Apply may copy to clipboard or start Costbook integration).
5. WHEN simulation is requested, THE system SHALL navigate to or invoke the simulation flow with pre-filled parameters where supported.

## Implementation References

- **Frontend:** `app/dashboards/components/VarianceAlerts.tsx`, `app/dashboards/page.tsx`
- **Backend:** `backend/services/variance_alert_service.py`
- **Spec source:** `docs/FEATURE_AI_GAPS_SPEC.md` §1
- **Service Worker:** `public/sw.js` (extend for variance push)

## Dependencies and Risks

- **Push:** Requires HTTPS; browser permission flow and subscription storage must be tested. Optional backend endpoint for VAPID subscription storage.
- **Root-Cause / Auto-Fix:** May require LLM calls (cost, latency); rule-based fallbacks are recommended.
