/**
 * Build page context for help chat API from pathname and user role.
 * Used for property/unit tests (Tasks 2.2, 2.3, 2.4) and consistent API payloads.
 */

export interface PageContextFromPath {
  route: string
  pageTitle: string
  userRole: string
}

const SEGMENT_TITLES: Record<string, string> = {
  dashboards: 'Dashboards',
  projects: 'Projects',
  resources: 'Resources',
  risks: 'Risks',
  financials: 'Financials',
  reports: 'Reports',
  scenarios: 'Scenarios',
  'monte-carlo': 'Monte Carlo',
  changes: 'Changes',
  admin: 'Administration',
}

/**
 * Derive page context from URL pathname and user role.
 * Requirement 1.1, 1.3: context capture and formatting for help queries.
 */
export function getPageContextFromPath(pathname: string, userRole: string): PageContextFromPath {
  const route = pathname || '/'
  const segments = route.split('/').filter(Boolean)
  const first = segments[0] || 'dashboard'
  let pageTitle = SEGMENT_TITLES[first] || 'Dashboard'
  if (first === 'projects' && segments[1]) {
    pageTitle = `Project: ${segments[1]}`
  }
  return {
    route,
    pageTitle,
    userRole: userRole || 'user',
  }
}
