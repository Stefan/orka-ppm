// Costbook Phase-Based Feature Flags
// Task 58: Phase-Based Feature Delivery

export type CostbookPhase = 'phase1' | 'phase2' | 'phase3'

/**
 * Current Costbook phase. Controls which features are enabled.
 * phase1: Core financial tracking, UI components, data layer
 * phase2: AI features, NL search, predictive analytics, drag-and-drop
 * phase3: EVM, collaboration, vendor scoring, voice, gamification
 */
export const COSTBOOK_PHASE: CostbookPhase =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_COSTBOOK_PHASE as CostbookPhase) ||
  'phase3'

/**
 * Check if a phase is enabled (current phase is at or past the given phase).
 */
export function isPhaseEnabled(phase: CostbookPhase): boolean {
  const order: CostbookPhase[] = ['phase1', 'phase2', 'phase3']
  return order.indexOf(COSTBOOK_PHASE) >= order.indexOf(phase)
}

/** Phase 1: Core Costbook */
export const PHASE1_ENABLED = isPhaseEnabled('phase1')

/** Phase 2: AI & interactivity (anomaly, NL search, recommendations, predictive, drag-and-drop) */
export const PHASE2_ENABLED = isPhaseEnabled('phase2')

/** Phase 3: EVM, comments, vendor scoring, timeline, sync, voice, gamification */
export const PHASE3_ENABLED = isPhaseEnabled('phase3')

/**
 * Feature flags for Costbook. Unimplemented features can be gated here.
 */
export const costbookFeatures = {
  /** Natural language search */
  nlSearch: PHASE2_ENABLED,
  /** Anomaly detection */
  anomalyDetection: PHASE2_ENABLED,
  /** Smart recommendations */
  recommendations: PHASE2_ENABLED,
  /** Predictive EAC/ETC */
  predictiveEac: PHASE2_ENABLED,
  /** Drag-and-drop cash out forecast */
  dragDropForecast: PHASE2_ENABLED,
  /** Earned Value Management */
  evm: PHASE3_ENABLED,
  /** Collaborative comments */
  comments: PHASE3_ENABLED,
  /** Vendor score card */
  vendorScore: PHASE3_ENABLED,
  /** Cost estimate timeline */
  costEstimateTimeline: PHASE3_ENABLED,
  /** External sync indicator */
  syncStatus: PHASE3_ENABLED,
  /** Voice control (Phase 3) */
  voiceControl: PHASE3_ENABLED,
  /** Gamification badges (Phase 3) */
  gamification: PHASE3_ENABLED,
  /** AI-powered import builder */
  aiImport: PHASE3_ENABLED
} as const
