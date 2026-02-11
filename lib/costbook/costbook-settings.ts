/**
 * Costbook-specific user preferences (localStorage, not synced).
 * Used by Budget & Cost Management page only.
 */

const STORAGE_KEY = 'costbook-settings'

export type CostbookViewMode = 'list' | 'grid'
export type CostbookProjectsPerPage = 10 | 20 | 50 | 100
export type CostbookForecastMonths = 6 | 12 | 24

export interface CostbookSettings {
  /** Default project view when opening the page */
  defaultView: CostbookViewMode
  /** Number of projects per page in list/grid and forecast */
  projectsPerPage: CostbookProjectsPerPage
  /** Whether "List – Cost Structure (CES/WBS)" panel is open by default */
  hierarchyPanelDefaultOpen: boolean
  /** Forecast timeline: months ahead from current month */
  forecastMonthsAhead: CostbookForecastMonths
  /** Show Recommendations panel in the Forecast column */
  showRecommendationsPanel: boolean
  /** Compact numbers (e.g. 1.2M instead of 1,234,567) in project cards/list */
  compactNumbers: boolean
}

const DEFAULTS: CostbookSettings = {
  defaultView: 'list',
  projectsPerPage: 20,
  hierarchyPanelDefaultOpen: false,
  forecastMonthsAhead: 12,
  showRecommendationsPanel: true,
  compactNumbers: false
}

function getStored(): CostbookSettings | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CostbookSettings>
    return { ...DEFAULTS, ...parsed } as CostbookSettings
  } catch {
    return null
  }
}

/** Get current costbook settings (merged with defaults). */
export function getCostbookSettings(): CostbookSettings {
  const stored = getStored()
  return stored ? { ...DEFAULTS, ...stored } : { ...DEFAULTS }
}

/** Save costbook settings to localStorage. */
export function setCostbookSettings(settings: Partial<CostbookSettings>): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  const current = getCostbookSettings()
  const next: CostbookSettings = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('costbook-settings-changed', { detail: next }))
}

export const COSTBOOK_PROJECTS_PAGE_SIZE_OPTIONS: CostbookProjectsPerPage[] = [10, 20, 50, 100]
export const COSTBOOK_FORECAST_MONTHS_OPTIONS: { value: CostbookForecastMonths; label: string }[] = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' }
]
