'use client'

import React from 'react'
import {
  Sparkles,
  BarChart3,
  AlertTriangle,
  Filter,
  LayoutGrid,
  Search,
  PieChart,
  Zap,
  Layers,
  Lightbulb,
  Sliders,
  Mic,
  TrendingUp,
  FileSpreadsheet,
  Upload,
  Users,
  ShieldAlert,
  Download,
} from 'lucide-react'
import type { TourStep } from '../pmr/OnboardingTour'

// Re-export type for consumers
export type { TourStep }

/** Dashboard: KPIs, Variance, Alerts, Filter, Project Cards. Bump version when layout/steps change. */
export const dashboardTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen im Dashboard',
    description: 'Hier siehst du die wichtigsten Kennzahlen und Alerts deines Portfolios. Die Tour zeigt dir in Kürze die zentralen Bereiche.',
    target: 'body',
    position: 'center',
    icon: <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'kpis',
    title: 'Was bedeuten die Kennzahlen?',
    description: 'Die KPI-Karten zeigen Erfolgsquote, Budget- und Zeitperformance, aktive Projekte und Ressourceneffizienz. Die Prozentwerte und Pfeile zeigen die Entwicklung.',
    target: '[data-tour="dashboard-kpis"]',
    position: 'bottom',
    icon: <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'filter',
    title: 'Nach Zeitraum filtern',
    description: 'Über das Filter-Dropdown kannst du den angezeigten Zeitraum ändern (z. B. „Last 30 days“). Die Daten und Kennzahlen werden entsprechend aktualisiert.',
    target: '[data-tour="dashboard-filter"]',
    position: 'bottom',
    icon: <Filter className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
  },
  {
    id: 'variance',
    title: 'Wo sind die Abweichungen?',
    description: 'In diesem Bereich siehst du Budget-Varianz (Net Variance, Over/Under Budget) und den Verlauf der Varianz. Hier erkennst du schnell Abweichungen vom Plan.',
    target: '[data-tour="dashboard-variance"]',
    position: 'right',
    icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: 'alerts',
    title: 'Variance Alerts',
    description: 'Kritische Hinweise erscheinen als Chips im Header oder in der Alert-Sektion. Mit KI kannst du Root-Cause und Vorschläge anzeigen.',
    target: '[data-tour="dashboard-header"]',
    position: 'bottom',
    icon: <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />,
  },
  {
    id: 'projects',
    title: 'Projektkarten',
    description: 'Die Projektliste zeigt deine Projekte mit Gesundheitsstatus (grün/gelb/rot). Klicke auf ein Projekt für Details.',
    target: '[data-tour="dashboard-projects"]',
    position: 'top',
    icon: <LayoutGrid className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
]

/** Costbook: NL-Suche, Distribution, AI Optimize, Hierarchy, Recommendations. */
export const costbookTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen im Costbook',
    description: 'Das Costbook verbindet Budget, Forecast und Verteilung. Diese Tour zeigt dir die wichtigsten Funktionen.',
    target: 'body',
    position: 'center',
    icon: <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'nl-search',
    title: 'Suche mit natürlicher Sprache',
    description: 'Gib hier z. B. „über Budget“, „hohe Varianz“ oder „Forecast Q4“ ein. Die Suche filtert automatisch nach Bedeutung – nicht nur nach Stichwörtern.',
    target: '[data-tour="costbook-nl-search"]',
    position: 'bottom',
    icon: <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'distribution',
    title: 'Verteilung einstellen',
    description: 'Hier stellst du die Verteilung (linear, custom, S-Curve) und den Zeitraum für Forecasts ein. Die KI schlägt ein Profil basierend auf dem Projektverlauf vor.',
    target: '[data-tour="costbook-distribution"]',
    position: 'left',
    icon: <PieChart className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
  },
  {
    id: 'ai-optimize',
    title: 'AI Optimize Costbook',
    description: 'Mit diesem Button erhältst du Vorschläge zur Anpassung von ETC, Accruals und Verteilung. Du kannst Vorschläge übernehmen oder simulieren.',
    target: '[data-tour="costbook-ai-optimize"]',
    position: 'bottom',
    icon: <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: 'hierarchy',
    title: 'Hierarchie (CES/WBS)',
    description: 'Die Baumansicht zeigt die Kostenstruktur (CES oder WBS). Hier siehst du Budget, Aufwand und Varianz pro Ebene.',
    target: '[data-tour="costbook-hierarchy"]',
    position: 'top',
    icon: <Layers className="h-6 w-6 text-teal-600 dark:text-teal-400" />,
  },
  {
    id: 'recommendations',
    title: 'Empfehlungen',
    description: 'Personalisierte Empfehlungen erscheinen hier – z. B. zur Budgetanpassung oder zur Verteilung. Du kannst sie annehmen oder verschieben.',
    target: '[data-tour="costbook-recommendations"]',
    position: 'top',
    icon: <Lightbulb className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />,
  },
]

/** Monte Carlo: Parameter, Szenarien, Heatmap, Voice, AI-Szenarien. */
export const monteCarloTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei Monte-Carlo-Simulationen',
    description: 'Hier erstellst du Szenarien und siehst Wahrscheinlichkeiten für Budget und Termine. Die Tour erklärt Parameter, Heatmap und KI-Szenarien.',
    target: 'body',
    position: 'center',
    icon: <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'parameters',
    title: 'Parameter einstellen',
    description: 'Stelle Unsicherheiten für Budget und Zeitplan ein (z. B. in %). Diese Parameter steuern die Streuung der Simulation.',
    target: '[data-tour="montecarlo-parameters"]',
    position: 'right',
    icon: <Sliders className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'ai-scenarios',
    title: 'AI-Szenarien nutzen',
    description: 'Klicke auf „AI-Szenarien vorschlagen“, um optimistische, pessimistische oder Baseline-Szenarien zu laden. Du kannst sie übernehmen und sofort simulieren.',
    target: '[data-tour="montecarlo-ai-scenarios"]',
    position: 'bottom',
    icon: <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
  },
  {
    id: 'heatmap',
    title: 'Heatmap lesen',
    description: 'Die Heatmap vergleicht Szenarien (P50, P90, Expected Cost). Grün = besser als Baseline, Rot = schlechter. Klicke auf eine Zeile, um das Szenario zu übernehmen.',
    target: '[data-tour="montecarlo-heatmap"]',
    position: 'top',
    icon: <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />,
  },
  {
    id: 'voice',
    title: 'Voice-Befehle',
    description: 'Mit dem Mikrofon kannst du z. B. sagen: „Set budget uncertainty to 15“ oder „Run optimistic scenario“. Die Befehle setzen Parameter oder starten die Simulation.',
    target: '[data-tour="montecarlo-voice"]',
    position: 'left',
    icon: <Mic className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
]

/** Financials: Tabs, Actuals vs Budget, EAC. */
export const financialsTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei Financials',
    description: 'Hier siehst du Budget, Ist-Werte, EAC und Varianzen. Die Tour erklärt die Tabs und wo du EAC bzw. Varianz findest.',
    target: 'body',
    position: 'center',
    icon: <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'tabs',
    title: 'Unterschied der Tabs',
    description: 'Overview: Zusammenfassung. Detailed: detaillierte Tabellen. Trends: Verläufe. Analysis: vertiefte Analysen. Wechsle die Tabs, um verschiedene Sichten zu nutzen.',
    target: '[data-tour="financials-tabs"]',
    position: 'bottom',
    icon: <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'eac-variance',
    title: 'EAC und Varianz',
    description: 'EAC (Estimate at Completion) und Varianz findest du in der Detail- und Analyseansicht pro Projekt. Die Tabellen zeigen Actuals vs. Budget und Abweichungen.',
    target: '[data-tour="financials-content"]',
    position: 'top',
    icon: <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
]

/** Project Import: Mapping, Validierung, CSV. */
export const importTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Projekt-Import',
    description: 'Hier importierst du Projekte aus CSV. Die Tour zeigt dir Spalten zuordnen, Vorschau und Import-Start.',
    target: 'body',
    position: 'center',
    icon: <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'mapping',
    title: 'Spalten zuordnen',
    description: 'Ordne die Spalten deiner CSV den Feldern (Name, Budget, Start, Ende, etc.) zu. Die Vorschau hilft dir, die Zuordnung zu prüfen.',
    target: '[data-tour="import-mapping"]',
    position: 'right',
    icon: <FileSpreadsheet className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
  },
  {
    id: 'preview',
    title: 'Vorschau prüfen',
    description: 'Vor dem Import siehst du eine Vorschau der Zeilen. Prüfe hier Fehler und Validierungshinweise.',
    target: '[data-tour="import-preview"]',
    position: 'top',
    icon: <BarChart3 className="h-6 w-6 text-teal-600 dark:text-teal-400" />,
  },
  {
    id: 'start',
    title: 'Import starten',
    description: 'Wenn alles passt, starte den Import. Die Projekte werden angelegt und erscheinen im Dashboard und in der Projektliste.',
    target: '[data-tour="import-start"]',
    position: 'bottom',
    icon: <Upload className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
]

/** Resources: AI-Optimizer, Auslastung, Zuweisungen. */
export const resourcesTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen bei Ressourcen',
    description: 'Hier verwaltest du Kapazität, Auslastung und Zuweisungen. Die Tour zeigt die Übersicht und den AI-Optimizer.',
    target: 'body',
    position: 'center',
    icon: <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'overview',
    title: 'Ressourcen-Übersicht',
    description: 'Sieh Auslastung, Zuweisungen und freie Kapazität. Die Karten und Listen zeigen alle relevanten Ressourcen.',
    target: '[data-tour="resources-overview"]',
    position: 'bottom',
    icon: <LayoutGrid className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'ai-optimizer',
    title: 'AI-Optimizer nutzen',
    description: 'Der AI-Optimizer schlägt Anpassungen der Ressourcenverteilung vor. Du kannst Vorschläge anwenden oder Konflikte auflösen.',
    target: '[data-tour="resources-ai-optimizer"]',
    position: 'left',
    icon: <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
  },
]

/** Audit: Anomalien, Filter, Export. */
export const auditTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen im Audit-Bereich',
    description: 'Hier siehst du Anomalien, Prüfungen und kannst Berichte exportieren. Die Tour erklärt Anomalien, Filter und Export.',
    target: 'body',
    position: 'center',
    icon: <ShieldAlert className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
  },
  {
    id: 'anomalies',
    title: 'Anomalien verstehen',
    description: 'Die KI kennzeichnet ungewöhnliche Muster (z. B. Auffälligkeiten bei Zugriffen oder Änderungen). Du kannst Anomalien bestätigen oder als falsch melden.',
    target: '[data-tour="audit-anomalies"]',
    position: 'bottom',
    icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: 'filter',
    title: 'Filter und Zeitraum',
    description: 'Filtere nach Zeitraum, Ereignistyp oder Benutzer. So findest du schnell die relevanten Einträge.',
    target: '[data-tour="audit-filter"]',
    position: 'bottom',
    icon: <Filter className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
  },
  {
    id: 'export',
    title: 'Export',
    description: 'Exportiere Audit-Daten für Compliance oder externe Auswertung. Verschiedene Formate (z. B. CSV, PDF) sind verfügbar.',
    target: '[data-tour="audit-export"]',
    position: 'left',
    icon: <Download className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
]
