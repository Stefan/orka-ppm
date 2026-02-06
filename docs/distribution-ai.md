# Distribution AI

Auto-suggestions (profile/duration) and variance impact preview for the Distribution Settings Dialog.

## Implemented

- **Recommendation**
  - Backend: `GET /api/v1/distribution/suggestion?duration_start=...&duration_end=...&project_id=...` (auth required).
  - Logic: Short remaining horizon (≤3 months) → "custom"; long (>6 months) → "linear"; invalid dates → 400.
- **Recommendation banner** in `DistributionSettingsDialog.tsx`: Fetches suggestion on context, shows rationale and "Übernehmen" to pre-fill profile.
- **Variance impact**: Frontend uses `lib/costbook/distribution-engine.ts` (`getDistributionVarianceMetric`) to compute estimated variance impact (predictive rules) in the dialog; no separate impact-preview API required for current scope.

## Tests

- `backend/tests/test_distribution_recommendation_service.py` – suggestion endpoint (short/long horizon, invalid dates, project_id).

## References

- Spec: `.kiro/specs/distribution-ai/`
- FEATURE_AI_GAPS_SPEC.md §4
