# Implementation Tasks: Variance Alerts AI

## Overview

Incremental implementation of AI features for dashboard variance alerts: browser push, root-cause UI, and auto-fix suggestions. Tasks assume existing `VarianceAlertService` and `app/dashboards/components/VarianceAlerts.tsx`. Reference: `docs/FEATURE_AI_GAPS_SPEC.md` §1.

## Phase 1: Root-Cause and Auto-Fix Backend

### Task 1.1: Root-Cause Service

**Status:** completed

**Description:** Implement backend logic to return root-cause suggestions for a variance alert.

**Implementation Details:**
- Add service or router function that accepts alert_id or alert payload (project_id, metric, threshold, current value).
- Implement rule-based mapping (e.g. metric + threshold → cause text + confidence); optional: call LLM with timeout and parse response.
- On error/timeout return empty list. Return format: `[{ "cause": string, "confidence": number }]`.
- Expose via GET endpoint (e.g. `GET /api/v1/variance-alerts/{alert_id}/root-cause` or Next.js route under `app/api/`). Enforce auth and organization scope.

**Files to Create/Modify:**
- `backend/services/variance_root_cause_service.py` (new) or extend `backend/services/variance_alert_service.py`
- `backend/routers/` or `app/api/` route for root-cause

**Requirements Reference:** Requirement 2 (Root-Cause-UI)

---

### Task 1.2: Auto-Fix Suggestions Service

**Status:** completed

**Description:** Implement backend endpoint that returns concrete adjustment suggestions for an alert.

**Implementation Details:**
- Add service that takes alert_id or alert payload and returns list of suggestions: description, affected metric, recommended change, optional estimated_impact.
- Optionally integrate with EAC/Monte Carlo or existing costbook optimize logic for impact estimation.
- Expose via GET (or POST with body) endpoint. Auth and org scope required.

**Files to Create/Modify:**
- `backend/services/variance_autofix_service.py` (new) or extend variance_alert_service
- `backend/routers/` or `app/api/` route for suggestions

**Requirements Reference:** Requirement 3 (AI Auto-Fix Suggestions)

---

## Phase 2: VarianceAlerts UI – Root-Cause and Suggestions

### Task 2.1: Root-Cause Block in VarianceAlerts

**Status:** completed

**Description:** Add optional Root-Cause block to alert card or alert detail modal.

**Implementation Details:**
- In `VarianceAlerts.tsx` (or alert detail component), add collapsible "Root Cause" section.
- On expand (or when opening alert detail), call root-cause API with alert_id; display list of causes with confidence (e.g. percentage or progress bar).
- Handle loading and empty/error state. Optional: user preference to show/hide root cause per alert or globally.

**Files to Create/Modify:**
- `app/dashboards/components/VarianceAlerts.tsx`
- Optional: `app/dashboards/components/VarianceAlertDetail.tsx` or inline modal

**Requirements Reference:** Requirement 2

---

### Task 2.2: Suggestions Button and Modal

**Status:** completed

**Description:** Add "Vorschläge anzeigen" button and modal with suggestions and actions.

**Implementation Details:**
- Add button to alert card that opens a modal. Modal fetches suggestions from auto-fix API.
- Display list of suggestions (description, metric, change, optional impact). Buttons: "Impact simulieren" (navigate to Monte Carlo/EAC with params if supported), "Übernehmen" (copy to clipboard or trigger Costbook integration).
- Handle loading and empty state.

**Files to Create/Modify:**
- `app/dashboards/components/VarianceAlerts.tsx`
- `app/dashboards/components/VarianceSuggestionsModal.tsx` (new) or equivalent

**Requirements Reference:** Requirement 3

---

## Phase 3: Browser Push for Variance Alerts

### Task 3.1: Push Subscription Storage and Registration API

**Status:** completed

**Description:** Allow frontend to register VAPID push subscription for the current user.

**Implementation Details:**
- Add table or storage for push subscriptions (user_id, organization_id, subscription_json). Optional: endpoint in backend or Next.js API route.
- Implement POST endpoint to save subscription; DELETE to remove. Validate subscription shape and auth.

**Files to Create/Modify:**
- `backend/migrations/` (new table for push_subscriptions if using DB) or use existing storage
- `backend/routers/` or `app/api/.../push-subscriptions/route.ts` for register/unregister

**Requirements Reference:** Requirement 1 (Proactive Alerts)

---

### Task 3.2: Send Push When New Alert Is Created

**Status:** completed

**Description:** On new variance alert, send push notification to registered clients.

**Implementation Details:**
- In VarianceAlertService (or wherever alerts are created), after creating an alert, determine users who have push enabled for this rule/scope.
- For each user, retrieve stored subscription(s) and send web push (e.g. PyWebPush) with title/body and optional URL to dashboard/alert.
- Payload should be short (e.g. "Abweichung in Invoice Value – check PO #123"). Require VAPID keys in env.

**Files to Create/Modify:**
- `backend/services/variance_alert_service.py` (extend) or `backend/services/push_sender_service.py` (new)
- Integration point where alerts are persisted

**Requirements Reference:** Requirement 1

---

### Task 3.3: Frontend Push Toggle and Service Worker

**Status:** completed

**Description:** Add UI to enable/disable push and handle push events in Service Worker.

**Implementation Details:**
- In dashboard settings or VarianceAlerts area, add toggle "Push bei neuen Alerts". On enable: request notification permission, get subscription via Push API, send to backend.
- Extend `public/sw.js` (or create if missing): on `push` event, show notification; on `notificationclick` focus window and navigate to dashboard/alert URL.
- Store push-enabled state in UI (e.g. user preferences or context).

**Files to Create/Modify:**
- `app/dashboards/page.tsx` or `app/settings/` or within VarianceAlerts
- `public/sw.js`
- Optional: hook `usePushSubscription.ts`

**Requirements Reference:** Requirement 1

---

## Phase 4: Testing and Documentation

### Task 4.1: Unit and Integration Tests

**Status:** completed

**Description:** Add tests for root-cause and auto-fix services and API; optional tests for push registration.

**Files to Create/Modify:**
- `backend/tests/test_variance_root_cause_service.py` (new)
- `backend/tests/test_variance_autofix_service.py` (new)
- `__tests__/VarianceAlerts.root-cause.test.tsx` or similar (optional)

**Requirements Reference:** All

---

### Task 4.2: Documentation

**Status:** completed

**Description:** Document new API endpoints, push setup (VAPID keys, HTTPS), and user-facing behavior for push and suggestions.

**Files to Create/Modify:**
- `docs/variance-alerts-ai.md` or extend existing dashboard/alert docs

**Requirements Reference:** All

---

## Dependencies

- Existing VarianceAlertService and VarianceAlerts component.
- HTTPS for push; browser support for Push API and Service Worker.
- Optional: OpenAI/LLM for richer root-cause and suggestions; rule-based fallback recommended.
