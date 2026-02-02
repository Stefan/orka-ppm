/**
 * Phase 3 – Costbook-Copilot: Kontext für AI-Help-Chat
 * Enterprise Readiness: Kontextuell + proaktiv aus Costbook/Financials
 */

export interface CostbookContextInput {
  projectId?: string
  costbookSummary?: string
  commitmentsCount?: number
  actualsCount?: number
  currency?: string
}

/**
 * Baut einen Kontext-String für den AI-Help-Chat (Costbook-Copilot).
 * In Help-Chat-Query oder Kontext-API einbinden.
 */
export function buildCostbookContext(input: CostbookContextInput): string {
  const parts: string[] = []
  if (input.projectId) {
    parts.push(`Projekt: ${input.projectId}`)
  }
  if (input.costbookSummary) {
    parts.push(`Costbook: ${input.costbookSummary}`)
  }
  if (input.commitmentsCount != null) {
    parts.push(`Commitments: ${input.commitmentsCount}`)
  }
  if (input.actualsCount != null) {
    parts.push(`Actuals: ${input.actualsCount}`)
  }
  if (input.currency) {
    parts.push(`Währung: ${input.currency}`)
  }
  return parts.length ? `[Costbook-Kontext] ${parts.join('; ')}` : ''
}
