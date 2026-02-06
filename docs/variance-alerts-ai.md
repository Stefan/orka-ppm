# Variance Alerts AI

AI features for dashboard variance alerts: root-cause suggestions, auto-fix suggestions, and optional browser push.

## Implemented

- **Root-cause service** (`backend/services/variance_anomaly_ai.py`): `get_root_cause_suggestions(alert_payload)` returns up to 3 causes with confidence.
- **Auto-fix service**: `get_auto_fix_suggestions(alert_payload)` returns suggestions (description, metric, change, currency, optional details).
- **API**
  - `GET /variance/alerts/{alert_id}/root-cause` – root-cause suggestions (auth + org scope).
  - `GET /variance/alerts/{alert_id}/suggestions` – auto-fix suggestions.
  - `POST /variance/push-subscribe` – push subscription (stub; full flow requires VAPID and storage).
- **UI** (`app/dashboards/components/VarianceAlerts.tsx`): Root-Cause block, "Suggestions" button and modal, push toggle calling the above APIs.

## Push (optional)

- **Storage**: Push subscriptions can be stored via `POST /variance/push-subscribe` (backend may persist in DB; table optional).
- **Send on new alert**: When a new variance alert is created, backend can look up subscriptions and send web push (e.g. PyWebPush). Requires VAPID keys in env and HTTPS.
- **Service Worker**: Extend `public/sw.js` (or build step) so that `push` shows a notification and `notificationclick` focuses/navigates to dashboard/alert.

## Tests

- `backend/tests/test_variance_root_cause_service.py` – root-cause rules (over/under budget, severity, max 3, confidence).
- `backend/tests/test_variance_autofix_service.py` – auto-fix rules (over/under, unique ids, currency, optional details).

## References

- Spec: `.kiro/specs/variance-alerts-ai/`
- FEATURE_AI_GAPS_SPEC.md §1
