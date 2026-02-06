# Predictive Simulations Enhancement

Erweiterung der **Predictive Simulations** (Monte Carlo + What-If) um Distribution Rules, AI-Auto-Szenarien, Multi-Scenario-Heatmap, Voice/NL, optional AR, Gamification und Sustainability.

## Spec-Dateien

| Datei | Inhalt |
|-------|--------|
| [requirements.md](./requirements.md) | R-PS1–R-PS7 (Distribution, AI-Szenarien, Heatmap, Voice, AR, Gamification, CO2) |
| [design.md](./design.md) | UI (Slider, Live-Chart, Heatmap, Voice, AR, Badge, CO2), Datenfluss, Integration |
| [tasks.md](./tasks.md) | Task 1–5 (Distribution, AI-Generator, Heatmap, Voice, AR+Gamification+Sustainability) |

## Bereits implementiert (Ist-Stand)

- **Monte Carlo:** Backend-Engine (10k+ Iterationen, Verteilungen, Percentile), PMR `MonteCarloAnalysisComponent` (Sliders, Scenario Save/Compare, **Side-by-Side-Tabelle** P50/P90/Expected/Schedule, Export).
- **Distribution Rules:** `lib/costbook/distribution-engine.ts` (linear/custom/ai_generated), `DistributionSettingsDialog` mit Predictive Rules (Variance-Reduktion, Bestätigung).
- **What-If:** Scenarios API, CreateScenarioModal, ScenarioComparison, Side-by-Side mit Deltas.
- **Voice:** Web Speech in DistributionSettingsDialog, NLSearchInput, HelpChat, VoiceControlManager.
- **Heatmap:** Resources-Seite (Resource Utilization).
- **Gamification:** `lib/gamification-engine.ts` (Badges).

## Neue Teile (diese Spec)

- **Core:** Distribution Rules (Profil/Duration) in Forecast-Sims; Slider + optional Live-Chart; AI-Auto-Szenarien (3–5); Multi-Scenario-Heatmap (Recharts, Click-to-Apply); Voice/NL für Sim-Parameter; AR/PO-Scan (Phase 3); Badge „Bestes Szenario“; CO2-Impact pro Szenario.
- **Roadmap:** Phase 2 = Distribution in Sim, AI-Szenarien, Heatmap, Voice, CO2 optional; Phase 3 = AR, Gamification-Badge.
- **Testbar:** Beispiele in [tasks.md](./tasks.md) (Abnahme).

## Referenzen

- `.kiro/specs/monte-carlo-risk-simulations/` – Monte Carlo Basis-Spec
- `.kiro/specs/generic-construction-ppm-features/requirements.md` – Req. 2 & 3 (Monte Carlo, What-If)
- `components/pmr/MonteCarloAnalysisComponent.tsx` – bestehende UI
- `lib/costbook/distribution-engine.ts` – Distribution Rules
