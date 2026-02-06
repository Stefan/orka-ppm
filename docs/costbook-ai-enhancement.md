# Costbook AI Enhancement

Semantic/intent search, similar searches, voice search, personalized recommendations, and AI Optimize Costbook.

## Implemented

- **Intent / synonym mapping** in `lib/nl-query-parser.ts`: Phrases like "high variance", "over budget", "forecast" map to filter intents; output shape compatible with Costbook filter state.
- **Filter state**: Costbook/NLSearchInput applies parse result to filters; intent-aware parse is wired.
- **Similar searches**: Frontend `getSimilarSearches(query, limit)` in nl-query-parser; UI in NLSearchInput (chips/links). API: `GET /api/costbook/similar-searches?q=...&limit=3` returns same logic for consistency.
- **Voice search**: Microphone button and Web Speech API in Costbook header/NLSearchInput; transcript drives same parse and filter flow.
- **Recommendations**: RecommendationsPanel receives recommendations (from parent); user/tenant context can be passed where recommendations are fetched.
- **AI Optimize Costbook**: Button in Costbook overview; modal shows suggestions from `POST /api/costbook/optimize` with Apply/Simulate actions.

## APIs

- `GET /api/costbook/similar-searches?q=...&limit=3` – similar search phrases.
- `POST /api/costbook/optimize` – optimization suggestions (body: optional projectIds); returns `{ suggestions }`.

## Tests

- `__tests__/nl-query-parser.test.ts` includes getSimilarSearches and intent coverage.
- Optional: `__tests__/api-routes/costbook-optimize.route.test.ts`, `__tests__/OptimizeCostbookModal.test.tsx`.

## References

- Spec: `.kiro/specs/costbook-ai-enhancement/`
- FEATURE_AI_GAPS_SPEC.md §2 and §3
