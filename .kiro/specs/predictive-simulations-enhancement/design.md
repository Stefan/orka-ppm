# Design: Predictive Simulations Enhancement

## Overview

Dieses Dokument beschreibt das UI- und Integrationsdesign für die Erweiterung der Predictive Simulations (Monte Carlo + What-If) um Distribution Rules, AI-Auto-Szenarien, Multi-Scenario-Heatmap, Voice-Input, optional AR, Gamification und Sustainability. Es baut auf der bestehenden `MonteCarloAnalysisComponent` und dem Costbook Distribution Engine auf.

## Referenzen

- **Bestehende Komponenten:** `components/pmr/MonteCarloAnalysisComponent.tsx`, `lib/costbook/distribution-engine.ts`, `components/costbook/DistributionSettingsDialog.tsx`
- **Specs:** `.kiro/specs/monte-carlo-risk-simulations/`, `.kiro/specs/generic-construction-ppm-features/requirements.md` (Req. 2 & 3)

---

## 1. UI: Inline-Widget (Slider + Live-Chart)

### Platzierung

- **Kontext:** PMR-Report (bestehende Monte-Carlo-Sektion) bzw. optional eingebettet in Costbook/Financials als „Forecast Sim“-Widget.
- **Layout:** Kompakter Block unter oder neben den bestehenden Parametern (Iterations, Confidence, Analysis Types).

### Slider für Variables

- **Budget-Unsicherheit (%)** – bestehender Parameter, bleibt.
- **Schedule-Unsicherheit (%)** – bestehender Parameter, bleibt.
- **Forecast-Profil:** Dropdown oder Toggle „Linear“ | „Custom“; bei Custom optional Link zu „Distribution bearbeiten“ (öffnet DistributionSettingsDialog oder vereinfachte Inline-Duration).
- **Duration (From/To):** Zwei Datumsfelder (oder Slider für „Anteil H1/H2“ bei nur zwei Perioden), konsistent mit Costbook Duration.

### Live-Chart-Update

- Bei Änderung eines Sliders: **nicht** sofort vollen Monte-Carlo-Lauf starten (zu langsam).
- **Option A:** Gecachte letzte Sim-Ergebnisse mit neuem Parameter-Label anzeigen und Hintergrund-Rerun anstoßen; Ergebnis nach Fertigstellung nachladen.
- **Option B:** Vereinfachtes Modell (z.B. nur erwarteter Wert aus Formel) für sofortiges kleines Chart-Update; „Full Sim“ explizit per Button.
- **Latenz-Ziel:** Feedback < 2 s (z.B. Spinner oder vereinfachtes Chart).

### Komponenten-Struktur

```
MonteCarloAnalysisComponent (bestehend)
├── Params (iterations, confidence, analysis_types) (bestehend)
├── [NEU] DistributionParamsBlock
│   ├── Forecast-Profil (linear | custom)
│   ├── Duration From/To (wenn custom oder immer sichtbar)
│   └── Optional: Link „Distribution im Costbook bearbeiten“
├── [NEU] LiveSummaryChart (optional, bei Slider-Change)
├── Run / Scenario Compare (bestehend)
└── …
```

---

## 2. Multi-Scenario-Heatmap

### Darstellung

- **Bibliothek:** Recharts (z.B. `ResponsiveContainer` + rechteckige Zellen) oder Heatmap aus `recharts` (sofern vorhanden); alternativ einfache Tabelle mit `td`-Hintergrundfarben.
- **Achsen:** 
  - Zeilen = Szenarien (Name).
  - Spalten = Metriken: z.B. P50 (Budget), P90 (Budget), Expected Cost, P50 (Schedule), optional CO2 (tCO2e).
- **Farben:** Pro Metrik Skala relativ zu Baseline (z.B. Szenario 1 = Baseline): grün = besser (z.B. niedrigerer Cost), rot = schlechter; neutral (grau) wenn gleich. Skala kann pro Spalte normalisiert werden.

### Interaktion

- **Click-to-Apply:** Klick auf Zeile oder zusätzlicher Button „Apply“ pro Zeile.
  - Aktion: Gewähltes Szenario als „aktives“ Szenario setzen (Parameter + ggf. Ergebnis laden); Bestätigung optional („Szenario X übernehmen?“).
- **Legende:** Kurzlegende „Grün = besser als Baseline, Rot = schlechter“.

### Platzierung

- Tab „Scenario Comparison“ in `MonteCarloAnalysisComponent` erweitern: unter der bestehenden Side-by-Side-Tabelle einen Abschnitt „Heatmap-Ansicht“ mit Toggle oder direkt die Heatmap anzeigen.
- Responsive: Auf kleinen Bildschirmen horizontales Scrollen oder vereinfachte Tabelle.

### Datenfluss

- **Input:** `scenarios: ScenarioConfig[]` (bereits vorhanden), jeweils mit `results` (budget_analysis, schedule_analysis).
- **Baseline:** Erstes Szenario oder explizit markiertes „Baseline“-Szenario.
- **Output:** Bei Apply → Callback `onApplyScenario(scenarioId)` bzw. Setzen der aktiven Parameter und ggf. Neuladen der Ergebnisse.

---

## 3. Voice-Input-Integration

### UI

- **Mikrofon-Button** im Bereich der Sim-Parameter (z.B. neben „Run Simulation“ oder in der Parametertoolbar).
- Verhalten analog zu `DistributionSettingsDialog` (Voice für Datum) und `HelpChat` (Voice für Nachricht): Web Speech API starten, Transkript anzeigen, bei Erfolg parsen und Aktion ausführen.

### Parser

- **Eingabe:** Freitext (Transkript).
- **Befehle (Beispiele):**
  - „Set budget uncertainty to 20“ / „Budget uncertainty 20 percent“ → `budget_uncertainty = 0.2`.
  - „Set schedule uncertainty 15“ → `schedule_uncertainty = 0.15`.
  - „Run optimistic scenario“ / „Run scenario Optimistic“ → Szenario mit Name „Optimistic“ laden und Sim starten.
  - „Run simulation“ → Standard-Run.
- **Implementierung:** Regex-basierter Parser im Frontend (ähnlich `lib/voice-control.ts`); optional Backend/OpenAI für komplexere Phrasen.
- **Fehler:** Unbekannter Befehl → kurze Meldung (z.B. „Befehl nicht erkannt. Versuche z.B. ‚Set budget uncertainty 20‘.“).

### Integration

- Bestehende `lib/voice-control.ts` um Sim-spezifische Befehle erweiterbar (neuer Typ z.B. `set_budget_uncertainty`, `run_scenario`) oder eigener Parser in `components/pmr/` nur für Sim.

---

## 4. AI-Auto-Szenarien (Generator)

### Backend (empfohlen)

- **Endpoint:** z.B. `GET /api/v1/projects/{projectId}/simulations/ai-suggestions` oder `POST …/suggest-scenarios`.
- **Input:** projectId, optional time range, optional limit (default 5).
- **Output:** Liste von 3–5 Szenarien: `{ id, name, description, params: { iterations, confidence_level, budget_uncertainty, schedule_uncertainty, … } }`.
- **Logik:** Aus Risiken, historischer Varianz, Branchen-Heuristiken Presets ableiten (z.B. „Optimistic“, „Pessimistic“, „Baseline+10% Cost“, „Shortened Schedule“).

### Frontend

- **Button:** „AI-Szenarien vorschlagen“ (z.B. im Scenario-Comparison-Bereich).
- **Anzeige:** Liste/Karten der Vorschläge mit Name, Kurzbeschreibung; Buttons „Übernehmen & Simulieren“ bzw. „Nur übernehmen“.
- **Fallback:** Wenn Backend nicht verfügbar, 3–5 feste Presets (z.B. aus `exampleQueries`-ähnlicher Konstante) anzeigen.

---

## 5. AR-Overlay (Phase 3)

- **Kontext:** Eigenes Modal oder Fullscreen-Overlay mit Kamera-Feed.
- **Technik:** Optional three.js für Overlay-Grafik; Kamera-Stream via `getUserMedia`; Bild an Backend senden für OCR/Extraktion (PO-Nummer, Beträge).
- **Nach Extraktion:** Anzeige der erkannten Daten, Button „In Sim verwenden“ (z.B. als Referenz-Betrag für ein Risiko oder als feste Größe in einer Szenario-Variable).
- **Spezifikation:** Als eigene Story; hier nur Platzhalter im UI (z.B. „PO-Scan (Phase 3)“-Button).

---

## 6. Gamification (Badge „Bestes Szenario“)

- **Erweiterung:** `lib/gamification-engine.ts` um `BadgeContext`-Felder z.B. `bestScenarioChosen?: boolean`, `scenariosBetterThanBaseline?: number`.
- **Vergabe:** Wenn User ein Szenario speichert und die Metrik (z.B. Expected Cost oder P90) besser als Baseline ist → Kontext aktualisieren und `getEarnedBadges` prüfen; neuer Badge-Typ z.B. `best_scenario`.
- **UI:** Bestehende Gamification-Anzeige (Badges) nutzen; kein neues Groß-UI.

---

## 7. Sustainability (CO2-Impact)

- **Daten:** Pro Szenario optional Feld `co2_tco2e?: number`.
- **Berechnung:** Backend oder Frontend-Heuristik (z.B. Faktor × Duration × Budget-Kategorie); Konfiguration pro Tenant/App.
- **Anzeige:** Zusätzliche Spalte „CO2 (tCO2e)“ in Side-by-Side-Tabelle und in der Heatmap; Legende/Info-Icon für Erklärung.
- **Wenn nicht konfiguriert:** Spalte ausblenden oder „–“ anzeigen.

---

## 8. Integration in Roadmap

- **Phase 2:** R-PS1 (Distribution in Sim), R-PS2 (AI-Szenarien), R-PS3 (Heatmap), R-PS4 (Voice), R-PS7 (CO2 optional).
- **Phase 3:** R-PS5 (AR), R-PS6 (Badge „Bestes Szenario“) und ggf. erweiterte CO2-Faktoren.

---

## 9. Datenmodell-Erweiterungen (optional)

- **ScenarioConfig (bestehend):** Erweiterbar um `distribution?: { profile, duration_start, duration_end }`, `co2_tco2e?: number`.
- **API Simulation Run:** Request-Body um `distribution_settings` und optionale `sustainability_factors` erweiterbar.
