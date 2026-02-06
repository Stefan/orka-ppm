# Implementation Tasks: Distribution AI

## Overview

Implementation of auto-suggestions (profile/duration recommendation) and predictive rules (variance impact preview) for the Distribution Settings Dialog. Builds on `DistributionSettingsDialog.tsx` and `lib/costbook/distribution-engine.ts`. Reference: `docs/FEATURE_AI_GAPS_SPEC.md` §4.

## Phase 1: Recommendation (Auto-Suggestions)

### Task 1.1: Distribution Recommendation Service or Logic

**Status:** completed

**Description:** Provide a recommended profile (and optionally duration) with rationale when the distribution dialog is opened.

**Implementation Details:**
- Implement backend endpoint GET recommendation (e.g. query params: project_id, quarter) or frontend logic that has access to history (e.g. last-used profile per project from local storage or API).
- If backend: query stored distribution settings by project/quarter; return most used or last used profile, optional duration, and short rationale string (e.g. "Basierend auf Project-Historie: Custom für Q3 empfohlen").
- Return shape: `{ profile, duration?, rationale }`. If no history, return generic recommendation or null.

**Files to Create/Modify:**
- `backend/services/distribution_recommendation_service.py` (new) or extend costbook/distribution API
- Optional: migration for `distribution_settings_history` or use existing tables
- `backend/routers/` or `app/api/` route for recommendation

**Requirements Reference:** Requirement 1 (Auto-Suggestions)

---

### Task 1.2: Recommendation Banner in DistributionSettingsDialog

**Status:** completed

**Description:** Show recommendation as banner in dialog and allow user to apply it.

**Implementation Details:**
- On dialog open (mount or when project/context available), fetch recommendation from new endpoint or local logic.
- Display banner or info box above profile selection with rationale text and optional "Übernehmen" button. Clicking "Übernehmen" pre-fills profile (and duration if provided) in the form.
- Handle loading and "no recommendation" state (hide banner or show neutral message).

**Files to Create/Modify:**
- `components/costbook/DistributionSettingsDialog.tsx`

**Requirements Reference:** Requirement 1

---

## Phase 2: Predictive Rules (Variance Impact Preview)

### Task 2.1: Variance Impact Simulation

**Status:** completed

**Description:** Compute variance difference between current rule and proposed rule (profile/duration/custom %).

**Implementation Details:**
- Implement backend endpoint POST impact-preview (or frontend-only logic) that accepts current rule, proposed rule, and project/row context (and optional cost/variance snapshot).
- Reuse `lib/costbook/distribution-engine.ts` and existing variance/EAC logic: compute variance with current rule and with proposed rule; return difference as percentage and optionally absolute. If data or calculation not available, return `available: false`.
- Response: `{ variance_delta_percent: number | null, variance_delta_absolute?: number, available: boolean }`.

**Files to Create/Modify:**
- `backend/services/distribution_impact_service.py` (new) or frontend helper using distribution-engine and costbook variance
- `backend/routers/` or `app/api/` route for impact-preview (if backend)
- `lib/costbook/distribution-engine.ts` (reuse only; no change unless new helper needed)

**Requirements Reference:** Requirement 2 (Predictive Rules)

---

### Task 2.2: Impact Preview in DistributionSettingsDialog

**Status:** completed

**Description:** Show variance impact when user changes profile/duration/custom and on Apply.

**Implementation Details:**
- When user changes profile, duration, or custom percentages, debounce (e.g. 300–500 ms) and call impact-preview API (or run frontend simulation). Display result as small label near "Apply" button, e.g. "Variance-Reduktion ca. 5%" or "Simulation nicht verfügbar".
- On "Apply" click, optionally show same hint in confirmation message. Ensure simulation runs with latest form values.

**Files to Create/Modify:**
- `components/costbook/DistributionSettingsDialog.tsx`

**Requirements Reference:** Requirement 2

---

## Phase 3: Testing and Documentation

### Task 3.1: Tests for Recommendation and Impact

**Status:** completed

**Description:** Add unit tests for recommendation and impact logic; optional integration test for dialog behavior.

**Files to Create/Modify:**
- `backend/tests/test_distribution_recommendation_service.py` (new) if backend
- `backend/tests/test_distribution_impact_service.py` (new) if backend
- Optional: `__tests__/DistributionSettingsDialog.recommendation.test.tsx`

**Requirements Reference:** All

---

### Task 3.2: Documentation

**Status:** completed

**Description:** Document new endpoints (if any), recommendation data source, and impact calculation assumptions.

**Files to Create/Modify:**
- `docs/distribution-ai.md` or extend costbook/distribution docs

**Requirements Reference:** All

---

## Dependencies

- Existing `DistributionSettingsDialog`, `lib/costbook/distribution-engine.ts`, and costbook/variance data.
- Optional: stored distribution history (table or API) for recommendation; if absent, recommendation can be generic or skipped.
