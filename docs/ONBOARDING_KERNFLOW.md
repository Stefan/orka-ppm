# Onboarding: Kernflow

Diese Dokumentation definiert den zentralen Nutzerflow für das Onboarding (Marktreife-Roadmap Phase 2.2) und verweist auf bestehende Touren/Tooltips.

## Definierter Kernflow

**Projekt anlegen → erste Simulation oder ersten Report sehen**

1. Nutzer ist eingeloggt (nach Sign-up/Login).
2. **Projekt anlegen:** Über Projekte-Seite ein neues Projekt erstellen (Name, optional Beschreibung, ggf. Portfolio).
3. **Erste sichtbare Wertschöpfung:**  
   - Entweder **Monte-Carlo-Simulation** starten (Projekt auswählen, Simulation anlegen, Ergebnis/Visualisierung ansehen),  
   - oder **Report/PMR** öffnen (Projekt auswählen, Report anzeigen).
4. Ziel: Nutzer hat innerhalb weniger Klicks ein Projekt und ein erstes Ergebnis (Simulation oder Report) gesehen.

## Bestehende Touren und UI

- **PMR/Onboarding:** [components/pmr/OnboardingTour.tsx](../components/pmr/OnboardingTour.tsx) – tour für PMR-Bereich.
- **Guided Tour:** [components/guided-tour/](../components/guided-tour/) – allgemeine geführte Touren.
- **Hinweise:** Loading- und Fehlerzustände auf zentralen Seiten (Projects, Dashboards, Admin) sind vereinheitlicht (Phase 1.2/2.3); Retry bei Backend-Fehlern ist vorgesehen.

## Empfehlung

- Den Kernflow (Projekt anlegen → Simulation oder Report) in QA manuell durchspielen und Fehler/Stolpersteine beseitigen.
- Optional: Eine kurze app-weite „Erste Schritte“-Tour (z. B. über guided-tour) mit 3–4 Schritten: „Projekt anlegen“ → „Simulation starten“ oder „Report öffnen“.
- Tooltips an zentralen Stellen (z. B. „Neues Projekt“, „Simulation starten“) können aus den bestehenden Komponenten ergänzt werden.

## Referenzen

- Roadmap: [MARKET_READINESS_ROADMAP.md](MARKET_READINESS_ROADMAP.md) Phase 2.2  
- Frontend-Übersicht: [frontend/PROJECT_OVERVIEW.md](frontend/PROJECT_OVERVIEW.md)
