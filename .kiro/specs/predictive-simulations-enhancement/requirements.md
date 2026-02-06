# Requirements: Predictive Simulations Enhancement

## Introduction

Erweiterung der bestehenden Monte Carlo Risk Simulations und What-If-Szenarien um Distribution Rules (Cora-Doc: linear/custom pro Zeile), AI-Auto-Szenarien, Multi-Scenario-Heatmap, Voice/NL-Steuerung, optional AR-Overlay, Gamification-Badges und Sustainability-Metriken. Baut auf `.kiro/specs/monte-carlo-risk-simulations/` und Generic Construction Requirements 2 & 3 auf.

## Glossary

- **Distribution_Rules**: Aus Costbook/Cora-Doc: Profil (linear/custom) und Duration (From/To, granularity) pro Projektzeile für Cash-Out-Forecast.
- **Forecast_Sim**: Simulation, die periodenweise Ausgaben unter Berücksichtigung von Distribution Rules berechnet.
- **AI_Auto_Scenarios**: Vom System vorgeschlagene 3–5 Szenarien basierend auf Trends (Historie, Risiken).
- **Multi_Scenario_Heatmap**: Recharts-basierte Darstellung Szenario × Metriken mit Farben (grün/rot) und Click-to-Apply.
- **Voice_NL_Parse**: Web Speech API bzw. optional OpenAI zum Setzen von Sim-Parametern oder Starten von Szenarien per Sprache.

## Referenz: Bereits implementiert

- Monte Carlo Engine (Iterationen, Verteilungen, Percentile, Cost/Schedule).
- PMR: MonteCarloAnalysisComponent mit Slidern, Scenario Save/Compare, Side-by-Side-Tabelle.
- Distribution Engine: `lib/costbook/distribution-engine.ts` (linear/custom/ai_generated), DistributionSettingsDialog mit Predictive Rules.
- What-If: Scenarios API, CreateScenarioModal, ScenarioComparison.
- Voice: Web Speech in DistributionSettingsDialog, NLSearchInput, HelpChat, VoiceControlManager.
- Heatmap: Resources-Seite (Resource Utilization).
- Gamification: `lib/gamification-engine.ts` (Badges).

---

## R-PS1: Erweiterung What-If-Sims mit Distribution (Profil/Duration in Sliders)

**User Story:** Als Projektmanager möchte ich Forecast-Simulationen mit denselben Distribution Rules (linear/custom) wie im Costbook steuern, damit Forecast und Sim konsistent sind.

### Acceptance Criteria

1. WHEN der User im Predictive-Sim-Widget die Slider „Forecast-Profil“ (linear/custom) und „Duration“ (From/To oder vereinfacht) ändert, SHALL die Berechnung die Distribution Rules (Cora-Doc: linear/custom per Line) nutzen und periodenweise Forecast in die Sim-Ergebnisse einbeziehen.
2. WHEN Slider für Budget-Unsicherheit, Schedule-Unsicherheit oder Distribution geändert werden, SHALL das UI optional ein Live-Chart-Update anzeigen (gecacht oder vereinfachtes Modell, Latenz < 2 s).
3. THE System SHALL die bestehende `calculateDistribution`-Logik aus `lib/costbook/distribution-engine.ts` bzw. Backend-Äquivalent wiederverwenden, wo möglich.
4. WHEN keine projektspezifische Distribution hinterlegt ist, SHALL ein Default (z.B. linear über Projekt-Duration) verwendet werden.

---

## R-PS2: AI-Auto-Szenarien (3–5 basierend auf Trends)

**User Story:** Als Risikomanager möchte ich vom System vorgeschlagene Szenarien erhalten, damit ich schnell sinnvolle Varianten vergleichen kann.

### Acceptance Criteria

1. WHEN der User „AI-Szenarien vorschlagen“ anfordert, SHALL das System 3–5 Szenarien generieren (Name, Kurzbeschreibung, Parameter-Set) basierend auf Trends (z.B. historische Varianz, letzte Risiken).
2. WHEN Szenarien vorgeschlagen werden, SHALL der User mindestens eines übernehmen und Simulation auslösen können.
3. THE Generierung SHALL optional Backend (Risiken, Historie) nutzen; Fallback: vordefinierte Presets (z.B. „Optimistic“, „Pessimistic“, „Baseline+10%“).
4. WHEN ein vorgeschlagenes Szenario übernommen wird, SHALL die Parameter (iterations, confidence, budget_uncertainty, schedule_uncertainty, ggf. Distribution) gesetzt und die Sim ausführbar sein.

---

## R-PS3: Multi-Scenario-Heatmap (Recharts, Vergleich)

**User Story:** Als PM möchte ich mehrere Szenarien in einer Heatmap vergleichen und mit einem Klick das beste übernehmen.

### Acceptance Criteria

1. WHEN mindestens 2 Szenarien mit Ergebnissen vorliegen, SHALL eine Heatmap-Darstellung verfügbar sein: Zeilen = Szenarien, Spalten = Metriken (z.B. P50, P90, Expected Cost, Schedule).
2. THE Heatmap SHALL Farben für Impact verwenden (z.B. grün = besser als Baseline, rot = schlechter); Legende SHALL angezeigt werden.
3. WHEN der User auf eine Zeile oder einen „Apply“-Button klickt (Click-to-Apply), SHALL das zugehörige Szenario als aktive Konfiguration übernommen werden können; Bestätigung optional.
4. THE Heatmap SHALL mit Recharts oder der bestehenden Chart-Bibliothek der App umgesetzt werden und in der Nähe der bestehenden Side-by-Side-Tabelle (MonteCarloAnalysisComponent) integriert sein.

---

## R-PS4: Voice / Natural Language Parse (Web Speech / optional OpenAI)

**User Story:** Als User möchte ich Sim-Parameter oder Szenario-Start per Spracheingabe auslösen.

### Acceptance Criteria

1. WHEN der User Voice-Input nutzt (z.B. „Set budget uncertainty 20%“ oder „Run optimistic scenario“), SHALL das System den Befehl parsen und die entsprechende Aktion ausführen (Parameter setzen oder Szenario starten).
2. Web Speech API SHALL für Spracherkennung genutzt werden; optional OpenAI für komplexere NL-Phrasen.
3. WHEN die Erkennung fehlschlägt oder der Befehl nicht interpretierbar ist, SHALL eine kurze Fehlermeldung angezeigt werden.
4. THE UI SHALL einen Mikrofon-Button im Sim-Parameter-Bereich bereitstellen (analog zu bestehenden Voice-UI in Costbook/HelpChat).

---

## R-PS5: AR-Overlay (three.js für PO-Scan in Sims) [Phase 3]

**User Story:** Als User möchte ich optional ein PO-Dokument scannen und die extrahierten Daten in den Sim-Kontext übernehmen.

### Acceptance Criteria

1. WHEN der User die AR/PO-Scan-Funktion nutzt, SHALL ein Overlay (z.B. three.js/WebXR) Kamera-Input verarbeiten, PO-relevante Daten extrahieren und optional in den Sim-Kontext (z.B. Referenz-Betrag) übernehmen.
2. THE Spezifikation SHALL als eigene Story geführt werden; Implementierung Phase 3.
3. WHEN OCR/Extraktion vom Backend bereitgestellt wird, SHALL das Frontend die Ergebnisse anzeigen und „In Sim verwenden“ anbieten können.

---

## R-PS6: Gamification (Badges für bestes Szenario)

**User Story:** Als User möchte ich für die Wahl eines „besseren“ Szenarios ein Badge erhalten.

### Acceptance Criteria

1. WHEN der User ein Szenario wählt und speichert, das nach definierter Metrik besser als die Baseline ist, SHALL ein Badge „Bestes Szenario“ (oder vergleichbar) vergeben werden können.
2. THE Integration SHALL die bestehende `lib/gamification-engine.ts` erweitern (z.B. Kontext `scenarioBetterThanBaseline`, `bestScenarioChosen`).
3. WHEN das Badge vergeben wird, SHALL es in der bestehenden Gamification-UI sichtbar sein.

---

## R-PS7: Sustainability (CO2-Impact Predict)

**User Story:** Als Stakeholder möchte ich pro Szenario einen groben CO2-Impact-Indikator sehen.

### Acceptance Criteria

1. WHEN Szenarien berechnet werden, SHALL optional ein CO2-Impact-Indikator (z.B. tCO2e) pro Szenario berechnet und in Vergleichstabelle/Heatmap angezeigt werden können.
2. THE Berechnung SHALL auf konfigurierbaren Faktoren (z.B. Dauer, Budget-Kategorie, Ressourcen) basieren; kein vollständiges Life-Cycle-Assessment.
3. WHEN keine Faktoren konfiguriert sind, SHALL die Anzeige ausgeblendet oder als „nicht berechnet“ dargestellt werden.

---

## Traceability

| Requirement | Phase | Abhängigkeiten |
|-------------|--------|----------------|
| R-PS1       | 2     | Distribution Engine, Monte Carlo API |
| R-PS2       | 2     | Monte Carlo, Scenarios API |
| R-PS3       | 2     | MonteCarloAnalysisComponent, Recharts |
| R-PS4       | 2     | Web Speech API, Sim-Parameter-API |
| R-PS5       | 3     | OCR/Backend, three.js/WebXR |
| R-PS6       | 3     | gamification-engine |
| R-PS7       | 2/3   | Szenario-Metriken, optional Backend |
