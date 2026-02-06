# Predictive Simulations Enhancement

Erweiterung der Monte-Carlo-/Simulations-Funktionen: Distribution Rules in Sim-Berechnungen, AI-Szenarien, Heatmap, Voice, optional AR/Gamification/Sustainability.

## Umgesetzt (laut tasks.md)

- **Task 1 – Distribution in Sim:** Distribution-Profil und Duration aus Costbook in Sim-Input; periodenweise Verteilung in Forecast; Slider/UI für Forecast-Profil und Duration im Sim-Widget.
- **Task 2 – AI-Szenarien:** Backend `GET /api/v1/projects/{projectId}/simulations/ai-suggestions`; Frontend Button „AI-Szenarien vorschlagen“, Karten mit Übernehmen & Simulieren.
- **Task 3 – Heatmap:** Multi-Scenario-Heatmap (Recharts/Tabelle), Farben relativ zu Baseline, Click-to-Apply; Integration in MonteCarloAnalysisComponent.
- **Task 4 – Voice:** Mikrofon-Button, Web Speech API, Parser für Sim-Befehle (budget/schedule uncertainty, run scenario/simulation), Anbindung an Sim-Actions.
- **Task 5 – Phase 3:** AR-Overlay (Spezifikation/Platzhalter), Badge „Bestes Szenario“ (gamification-engine), CO2-Indikator pro Szenario.

## Abnahme

Siehe „Testbare Beispiele“ in `.kiro/specs/predictive-simulations-enhancement/tasks.md`.

## Referenz

- Spec: `.kiro/specs/predictive-simulations-enhancement/`
