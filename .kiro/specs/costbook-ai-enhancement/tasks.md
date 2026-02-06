# Implementation Tasks: Costbook AI Enhancement

## Overview

Implementation of semantic/intent search, similar searches, voice search, personalized recommendations, and the AI Optimize Costbook button with modal. Builds on NLSearchInput, nl-query-parser, RecommendationsPanel, and costbook optimize API. Reference: `docs/FEATURE_AI_GAPS_SPEC.md` §2 and §3.

## Phase 1: Semantic / Intent Search

### Task 1.1: Extend NL Parser with Intent Mapping and Synonyms

**Status:** completed

**Description:** Map more phrases to costbook filter intents (e.g. "high variance", "over budget", "forecast") so that search behaves semantically, not only on exact keywords.

**Implementation Details:**
- Add synonym and intent map to `lib/nl-query-parser.ts` (or new `lib/costbook/intent-mapper.ts`) so that phrases like "hohe Varianz", "high variance", "forecast" resolve to the same filter type and threshold semantics as existing patterns.
- Ensure output shape remains compatible with current filter application in Costbook. Optionally add embedding-based resolution (query embedding + costbook column/description embeddings) if infrastructure exists; otherwise intent map is sufficient for Requirement 1.

**Files to Create/Modify:**
- `lib/nl-query-parser.ts` or `lib/costbook/intent-mapper.ts`
- Optional: backend or frontend embedding call for costbook metadata

**Requirements Reference:** Requirement 1 (Semantic Search)

---

### Task 1.2: Wire Intent-Aware Parse into Costbook Filter State

**Status:** completed

**Description:** Ensure costbook filter state is set from the intent-aware parse result and grid/list is filtered accordingly.

**Implementation Details:**
- Costbook container or NLSearchInput already applies parse result to filters; verify that new intent outputs (same shape as current parse) are applied correctly. Add tests for new phrases (e.g. "high variance in forecast") and confirm filtered results.

**Files to Create/Modify:**
- Components that consume NL parse result (e.g. Costbook page, NestedGridsTab, or NLSearchInput callback)
- Optional: `__tests__/nl-query-parser.intent.test.ts`

**Requirements Reference:** Requirement 1

---

## Phase 2: Similar Searches and Voice

### Task 2.1: Similar Searches (Backend or Frontend)

**Status:** completed

**Description:** After a search, show 2–3 similar search phrases; on click set query and run search again.

**Implementation Details:**
- Implement backend GET (e.g. `GET /api/costbook/similar-searches?q=...`) that returns 2–3 phrases (LLM or template-based), or implement frontend-only logic (predefined mappings or simple variants from current query).
- Add UI below NLSearchInput (or inside it): display similar phrases as chips or links; on click set query and trigger same search flow (parse + filter).

**Files to Create/Modify:**
- `app/api/costbook/similar-searches/route.ts` (new) or frontend helper
- `components/costbook/NLSearchInput.tsx` or `components/costbook/SearchSuggestions.tsx` (new)

**Requirements Reference:** Requirement 2 (Similar Searches)

---

### Task 2.2: Voice Search in Costbook Header

**Status:** completed

**Description:** Add microphone button next to NL search field; Web Speech API transcript drives same NL parse and filter.

**Implementation Details:**
- Add microphone button (lucide-react Mic) next to NLSearchInput in Costbook header. On click: request permission if needed, start SpeechRecognition, write transcript into search input on result, and on end (or user stop) trigger the same submit/parse handler as for text.
- Handle errors: permission denied, no speech recognized → show short message. Reuse existing voice pattern from DistributionSettingsDialog or HelpChat if available.

**Files to Create/Modify:**
- `components/costbook/NLSearchInput.tsx` or Costbook header component that contains the search field
- Optional: `components/costbook/VoiceSearchButton.tsx` (new)

**Requirements Reference:** Requirement 3 (Voice Search)

---

## Phase 3: Personalized Recommendations and Optimize Button

### Task 3.1: Pass User/Tenant Context to Recommendations API

**Status:** completed

**Description:** Recommendations API receives user_id and organization_id; backend returns tenant-specific or prioritized recommendations when available.

**Implementation Details:**
- Ensure RecommendationsPanel (or the code that fetches recommendations) sends user_id and organization_id (from auth/session) in the API request.
- Backend: extend recommendations endpoint to accept and use this context; return personalized list or priorities. Without context, keep current generic behavior.

**Files to Create/Modify:**
- `components/costbook/RecommendationsPanel.tsx` (or where recommendations are fetched)
- Backend recommendations endpoint (e.g. in costbook or dashboard API)

**Requirements Reference:** Requirement 4 (Personalized Recommendations)

---

### Task 3.2: AI Optimize Costbook Button and Modal

**Status:** completed

**Description:** Add visible "AI Optimize Costbook" button and modal with suggestions and Apply/Simulate actions.

**Implementation Details:**
- Add button in Costbook header or next to RecommendationsPanel (e.g. "AI Optimize Costbook" or "Optimiere Costbook"). On click open a modal.
- Modal: call POST /api/costbook/optimize (or existing backend) with current project/row context and optional user/tenant. Display returned suggestions (description, metric, change, impact). Buttons: "Apply" (apply selected or all; implement as copy to clipboard or Costbook update), "Simulate" (navigate to Monte Carlo/What-If with suggestion params if supported).
- Handle loading and empty/error state.

**Files to Create/Modify:**
- Costbook header or container (add button)
- `components/costbook/OptimizeCostbookModal.tsx` (new) or equivalent
- Confirm `app/api/costbook/optimize/route.ts` (or backend) returns the expected shape; extend if needed

**Requirements Reference:** Requirement 5 (AI Optimize Button)

---

## Phase 4: Testing and Documentation

### Task 4.1: Tests for Intent Parser and Similar Searches

**Status:** completed

**Description:** Unit tests for new intent/synonym mappings and for similar-searches (frontend or backend). Optional integration test for voice and optimize flow.

**Files to Create/Modify:**
- `__tests__/nl-query-parser.intent.test.ts` or extend existing nl-query-parser tests
- `__tests__/costbook/similar-searches.test.ts` (optional)
- Optional: `__tests__/OptimizeCostbookModal.test.tsx`

**Requirements Reference:** Requirements 1, 2

---

### Task 4.2: Documentation

**Status:** completed

**Description:** Document new/updated APIs (similar-searches, recommendations context, optimize), intent mapping coverage, and user-facing behavior for voice and optimize.

**Files to Create/Modify:**
- `docs/costbook-ai-enhancement.md` or extend costbook docs

**Requirements Reference:** All

---

## Dependencies

- Existing Costbook, NLSearchInput, nl-query-parser, RecommendationsPanel, and costbook optimize API.
- Web Speech API (browser); HTTPS for production. Optional: OpenAI or embedding service for semantic and similar searches; intent map and frontend similar-phrases are valid without LLM.
