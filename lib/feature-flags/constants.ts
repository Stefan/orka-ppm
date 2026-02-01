/**
 * Predefined feature flags. Matches backend migration 039_feature_toggle_system.sql.
 * Used by the admin feature-toggles page so these flags always appear and can be created if missing.
 */

export interface PredefinedFlag {
  name: string
  displayName: string
  description: string
}

export const PREDEFINED_FEATURE_FLAGS: PredefinedFlag[] = [
  {
    name: 'costbook_phase1',
    displayName: 'Budget & Cost Management',
    description: 'Enable comprehensive budget tracking, cost management, and financial oversight with detailed project analysis'
  },
  {
    name: 'costbook_phase2',
    displayName: 'Cost Forecasting & Distribution',
    description: 'Add advanced forecasting capabilities, budget distribution tools, and cost allocation features for better planning'
  },
  {
    name: 'ai_anomaly_detection',
    displayName: 'Automated Cost Risk Detection',
    description: 'Automatically identify cost anomalies, budget variances, and potential financial risks to prevent overruns'
  },
  {
    name: 'import_builder_ai',
    displayName: 'Intelligent Data Import',
    description: 'Streamline data import processes with AI-powered automation, reducing manual data entry by up to 80%'
  },
  {
    name: 'nested_grids',
    displayName: 'Expandable Project Structures',
    description: 'Support hierarchical project structures (WBS) with expandable views for complex project organization'
  },
  {
    name: 'predictive_forecast',
    displayName: 'Cost Trend Forecasting',
    description: 'Enable predictive analytics for cost trends, helping teams make data-driven decisions and avoid budget surprises'
  },
]
