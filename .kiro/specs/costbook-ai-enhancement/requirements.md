# Requirements: Costbook AI Enhancement

## Introduction

AI-Erweiterungen für das Costbook: semantische/Intent-Suche (nicht nur Keyword), „Ähnliche Suchen“-Vorschläge nach einer Suche, Voice-Search im Header, personalisierte Recommendations pro Tenant/User und ein sichtbarer „AI Optimize Costbook“-Button mit Modal. Baut auf `NLSearchInput`, `lib/nl-query-parser.ts`, `RecommendationsPanel` und bestehendem Costbook-API auf. Referenz: `docs/FEATURE_AI_GAPS_SPEC.md` §2 und §3.

## Glossary

- **NL_Search_Input**: Natürlichsprachliches Suchfeld im Costbook; `components/costbook/NLSearchInput.tsx`, `lib/nl-query-parser.ts`.
- **Semantic_Search**: Query-Intent-Erkennung (z. B. "high variance", "over budget") und Abbildung auf Costbook-Filter/Spalten; ggf. über Synonyme/Intent-Mapping oder Embedding-Service.
- **Similar_Searches**: 2–3 ähnliche Suchphrasen nach einer Suche, generiert aus aktueller Query und Kontext (Backend oder Frontend).
- **Recommendations_Panel**: Bestehendes Panel für Empfehlungen; `components/costbook/RecommendationsPanel.tsx`.
- **Costbook_Optimize**: Bestehender oder erweiterter Endpoint (z. B. `POST /api/costbook/optimize`) für vorgeschlagene Anpassungen (ETC, Accruals, Distribution).

## Requirements

### Requirement 1: Semantic Search in Costbook

**User Story:** As a user, I want the costbook search to understand similar phrases (e.g. "high variance in forecast") and apply the right filters, not only exact keywords.

#### Acceptance Criteria

1. THE system SHALL recognize query intent (e.g. "high variance", "forecast", "over budget") and map it to costbook filters (columns, thresholds).
2. Implementation MAY extend the NL-query-parser with synonyms and intent mapping, or integrate an embedding service for costbook metadata (column names, descriptions); fallback SHALL be current keyword/pattern behavior.
3. THE costbook filter state SHALL be set according to the recognized intent and the result list SHALL be filtered accordingly.
4. For ambiguous queries, THE system SHALL use a sensible default interpretation or optionally ask for clarification.

### Requirement 2: Similar Searches (AI Suggestions)

**User Story:** As a user, I want to see 2–3 similar search phrases after a search, so that I can quickly try related queries.

#### Acceptance Criteria

1. AFTER a search, THE system SHALL display 2–3 similar search phrases derived from the current query and context (e.g. visible columns, recent searches).
2. Generation MAY be backend (LLM) or frontend (predefined mappings or simple variants).
3. THE similar phrases SHALL be shown in or below the NL search field (e.g. in SearchSuggestions component or NLSearchInput).
4. WHEN the user clicks a similar phrase, THE system SHALL set that as the query and trigger the search (same NL parse and filter application).

### Requirement 3: Voice Search in Costbook

**User Story:** As a user, I want to use voice input for the costbook NL search so that I can search hands-free.

#### Acceptance Criteria

1. THE costbook header SHALL provide a microphone button next to the NL search field.
2. ON click, THE system SHALL start the Web Speech API (SpeechRecognition / webkitSpeechRecognition), write the transcript into the search field, and after recording end SHALL trigger the same NL parse and filter application as for text input.
3. THE system SHALL handle errors: microphone denied, language not recognized; show a short message to the user.
4. Implementation SHALL follow the same pattern as existing voice usage (e.g. DistributionSettingsDialog, HelpChat) where applicable.

### Requirement 4: Personalized Recommendations

**User Story:** As a user, I want recommendations that are tailored to my organization or role, so that they are more relevant.

#### Acceptance Criteria

1. THE recommendation API (frontend or backend) SHALL receive context: user_id and/or tenant_id (organization_id).
2. THE backend or rule logic SHALL return tenant- or organization-specific priorities, texts, or additional recommendations when available.
3. THE RecommendationsPanel SHALL call the API with user context and display personalized texts and priorities.
4. WHEN no tenant context is available, THE system SHALL behave as today (generic recommendations).

### Requirement 5: AI Optimize Costbook Button

**User Story:** As a project controller, I want a single "Optimize Costbook" action that suggests adjustments (ETC, Accruals, Distribution) with optional simulation, so that I can improve the costbook in one place.

#### Acceptance Criteria

1. THE system SHALL provide a backend endpoint (e.g. `POST /api/costbook/optimize` or equivalent) that accepts current projects/columns (or project IDs) and optional user/tenant, and returns a list of suggested adjustments with rationale and optional estimated effect.
2. Each suggestion SHALL include: description, affected metric, recommended change, optional impact estimate. The system MAY integrate with existing optimizer or Monte Carlo for impact.
3. THE frontend SHALL show a button (e.g. "AI Optimize Costbook") in the costbook header or next to the RecommendationsPanel; on click SHALL open a modal with the list of suggestions and actions "Apply" / "Simulate".
4. "Simulate" SHALL open a what-if or Monte Carlo view with pre-filled parameters where supported; "Apply" SHALL apply changes (or copy to clipboard / start Costbook update flow) as implemented.

## Implementation References

- **Frontend:** `components/costbook/NLSearchInput.tsx`, `components/costbook/RecommendationsPanel.tsx`, Costbook header/container
- **Logic:** `lib/nl-query-parser.ts`, `lib/costbook/distribution-engine.ts`
- **API:** `app/api/costbook/optimize/route.ts` (existing)
- **Spec source:** `docs/FEATURE_AI_GAPS_SPEC.md` §2, §3
- **Related:** `costbook-4-0` spec for base costbook; RAG/embeddings if semantic search uses vector search.

## Dependencies and Risks

- **Semantic search:** If no embedding service is available, implement intent mapping and synonyms first.
- **Similar searches:** LLM can add cost/latency; frontend mappings or cached variants are a valid fallback.
- **Optimize:** Existing `/api/costbook/optimize` may already return suggestions; frontend only needs button and modal if backend is done.
