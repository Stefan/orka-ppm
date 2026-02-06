# Requirements: Distribution AI

## Introduction

AI-Erweiterungen für den Distribution-Dialog (Costbook): Beim Öffnen eine Empfehlung für Profil/Duration aus Historie anzeigen (Auto-Vorschläge) und beim Ändern einer Rule eine Vorhersage der Variance-Reduktion anzeigen (Predictive Rules). Baut auf `DistributionSettingsDialog` und `lib/costbook/distribution-engine.ts` auf. Referenz: `docs/FEATURE_AI_GAPS_SPEC.md` §4.

## Glossary

- **Distribution_Settings_Dialog**: Dialog zur Konfiguration von Verteilungsprofilen (linear/custom) und Duration (From/To) pro Projektzeile; `components/costbook/DistributionSettingsDialog.tsx`.
- **Distribution_Engine**: Logik für Berechnung von Verteilungen; `lib/costbook/distribution-engine.ts`.
- **Auto_Suggestion**: Empfehlung für Profil und ggf. Duration basierend auf bisheriger Nutzung (Projekt/Quartal).
- **Predictive_Rule**: Beim Ändern von Profil/Duration/Custom-Anteilung wird eine kurze Simulation durchgeführt; Anzeige der erwarteten Variance-Reduktion (oder -änderung) in Prozent oder absoluter Betrag.

## Requirements

### Requirement 1: Auto-Suggestions (Profil/Duration)

**User Story:** As a project manager, I want to see a recommendation for distribution profile and duration when I open the distribution dialog, so that I can quickly apply proven settings based on history.

#### Acceptance Criteria

1. WHEN the user opens the DistributionSettingsDialog, THE system SHALL load a recommendation for profile (linear/custom) and optionally duration based on history (e.g. previously used profiles per project/quarter).
2. THE recommendation SHALL be provided by a backend endpoint or frontend logic that has access to historical distribution settings (per project, quarter, or organization).
3. THE recommendation SHALL include a short rationale (e.g. "Basierend auf Project-Historie: Custom für Q3 empfohlen").
4. THE DistributionSettingsDialog SHALL display this recommendation as a banner or info box above or beside the profile selection.
5. THE user MAY accept the recommendation (apply to current form) or ignore it and choose manually.

### Requirement 2: Predictive Rules (Variance Impact Preview)

**User Story:** As a cost engineer, I want to see an estimate of how much a distribution rule change will affect variance before applying it, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN the user changes profile, duration, or custom percentages in the DistributionSettingsDialog, THE system SHALL run a short simulation (backend or frontend): current variance vs. variance with the new rule.
2. THE system SHALL display the difference in variance (as percentage or absolute amount) in the dialog, e.g. near the "Apply" button or as a small preview label when profile/duration changes.
3. WHEN the user clicks "Apply", THE dialog SHALL show a confirmation that includes the variance impact hint (e.g. "Variance-Reduktion ca. X%" or "-X% Variance") where the calculation succeeded.
4. IF the simulation cannot be performed (e.g. insufficient data), THE system SHALL hide the hint or show "Simulation nicht verfügbar".
5. Simulation SHALL reuse existing distribution and variance logic (e.g. `calculateDistribution`, EAC/variance from costbook) where possible to keep results consistent.

## Implementation References

- **Frontend:** `components/costbook/DistributionSettingsDialog.tsx`
- **Logic:** `lib/costbook/distribution-engine.ts`
- **Spec source:** `docs/FEATURE_AI_GAPS_SPEC.md` §4
- **Related:** Costbook rows/API for current variance; project/quarter context for history.

## Dependencies and Risks

- **History data:** Recommendation requires stored or derivable history of distribution settings per project/quarter; if not available, show generic or no recommendation.
- **Simulation performance:** Predictive rule simulation should complete quickly (< 2 s); consider cached or simplified model if full recalculation is expensive.
